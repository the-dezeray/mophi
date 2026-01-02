import * as THREE from 'three';
import ThreeGlobe from 'three-globe';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import * as satellite from 'satellite.js';
import './style.css';

let TIME_SCALE = 60; // Speed up time (60x real-time)
let currentTime = new Date();

// Configuration
const SAT_ID = '63216'; // BOTSAT-1
const CELESTRAK_URL = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${SAT_ID}&FORMAT=TLE`;
const CACHE_KEY = `tle-${SAT_ID}`;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const EARTH_RADIUS_KM = 6371;

const timeLogger = document.createElement('div');
timeLogger.id = 'time-log';
document.body.appendChild(timeLogger);

// Info box for satellite details
const infoBox = document.createElement('div');
infoBox.id = 'sat-info';
document.body.appendChild(infoBox);

// Controls panel
const controlsPanel = document.createElement('div');
controlsPanel.id = 'controls';
controlsPanel.innerHTML = `
  <div class="control-group">
    <label>Speed: <span id="speed-value">60</span>x</label>
    <input type="range" id="speed-slider" min="1" max="500" value="60" step="1">
  </div>
  <div class="control-group">
    <button id="pause-btn">⏸ Pause</button>
    <button id="reset-btn">↻ Reset Time</button>
  </div>
  <div class="control-group model-info">
    <span class="model-badge">SGP4 Model</span>
  </div>
  <div class="control-group hint">
    <span>Click satellite to toggle orbit</span>
  </div>
`;
document.body.appendChild(controlsPanel);

// Satellite mesh reference for dynamic scaling
let satelliteMesh = null;
// Satellite is intentionally not to-scale; we keep it visible but bounded.
// Tuned so that at the default camera distance (~400) it looks reasonable.
const SAT_REFERENCE_CAMERA_DISTANCE = 400;
const SAT_WORLD_RADIUS_AT_REFERENCE = 0.8;
const SAT_WORLD_RADIUS_MIN = 0.2;
const SAT_WORLD_RADIUS_MAX = 2.0;

const Globe = new ThreeGlobe()
  .globeImageUrl('//cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg')
  .particleLat('lat')
  .particleLng('lng')
  .particleAltitude('alt')
  .objectLat('lat')
  .objectLng('lng')
  .objectAltitude('alt')
  .objectThreeObject(() => {
    // Relative satellite size - scaled dynamically based on camera distance
    const geometry = new THREE.SphereGeometry(1, 32, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.5
    });
    satelliteMesh = new THREE.Mesh(geometry, material);
    return satelliteMesh;
  });

// Scene Setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.querySelector('#app').innerHTML = '<div id="globeViz"></div>';
const vizContainer = document.getElementById('globeViz');
vizContainer.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.add(Globe);
scene.add(new THREE.AmbientLight(0xcccccc, Math.PI));
scene.add(new THREE.DirectionalLight(0xffffff, 0.6 * Math.PI));

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 100000);
camera.position.z = 400;

const tbControls = new TrackballControls(camera, renderer.domElement);
tbControls.minDistance = 101;
tbControls.rotateSpeed = 5;
tbControls.zoomSpeed = 0.8;

// Data Fetching
async function getTLEData() {
  const now = Date.now();
  const cached = localStorage.getItem(CACHE_KEY);

  if (cached) {
    const { timestamp, data } = JSON.parse(cached);
    if (now - timestamp < CACHE_DURATION) {
      return data;
    }
  }

  try {
    const response = await fetch(CELESTRAK_URL);
    if (!response.ok) throw new Error('Network response was not ok');
    const text = await response.text();
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: now, data: text }));
    return text;
  } catch (err) {
    if (cached) return JSON.parse(cached).data;
    throw err;
  }
}

let satData = [{ satrec: null, name: 'BOTSAT-1', lat: 0, lng: 0, alt: 0 }];
let isPaused = false;
let orbitalPeriodMinutes = 0;
let orbitVisible = false; // Orbit shown only when satellite is clicked

// Function to calculate orbital trajectory
function calculateOrbit(satrec, startTime, numPoints = 100) {
  const points = [];

  // Estimate orbital period from TLE (mean motion is in revolutions per day)
  const meanMotion = satrec.no * (1440 / (2 * Math.PI)); // Convert to revs/day
  const periodMinutes = 1440 / meanMotion; // Period in minutes
  orbitalPeriodMinutes = periodMinutes;

  const periodMs = periodMinutes * 60 * 1000;

  for (let i = 0; i <= numPoints; i++) {
    const time = new Date(startTime.getTime() + (periodMs / numPoints) * i);
    const gmst = satellite.gstime(time);
    const positionAndVelocity = satellite.propagate(satrec, time);
    const positionEci = positionAndVelocity.position;

    if (positionEci && typeof positionEci.x === 'number') {
      const gdPos = satellite.eciToGeodetic(positionEci, gmst);
      const lat = satellite.radiansToDegrees(gdPos.latitude);
      const lng = satellite.radiansToDegrees(gdPos.longitude);
      const alt = gdPos.height / EARTH_RADIUS_KM;

      const coords = Globe.getCoords(lat, lng, alt);
      if (coords) {
        points.push(new THREE.Vector3(coords.x, coords.y, coords.z));
      }
    }
  }

  return points;
}

// Function to draw orbital path
function drawOrbitPath(points) {
  // Remove old orbit line if exists
  const oldLine = scene.getObjectByName('orbitLine');
  if (oldLine) scene.remove(oldLine);

  if (points.length < 2) return;

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0x00ff00,
    linewidth: 2,
    transparent: true,
    opacity: 0.8
  });
  const line = new THREE.Line(geometry, material);
  line.name = 'orbitLine';
  scene.add(line);
}

getTLEData().then(rawData => {
  const lines = rawData.split('\n').map(l => l.trim()).filter(l => l);
  let name = 'BOTSAT-1';
  let tle1, tle2;

  if (lines.length >= 3) {
    name = lines[0];
    tle1 = lines[1];
    tle2 = lines[2];
  } else if (lines.length === 2) {
    tle1 = lines[0];
    tle2 = lines[1];
  }

  if (tle1 && tle2) {
    const satrec = satellite.twoline2satrec(tle1, tle2);
    satData[0].satrec = satrec;
    satData[0].name = name;

    // SGP4 model verification - satrec contains the initialized SGP4 model
    console.log('SGP4 Model initialized:', {
      satnum: satrec.satnum,
      epochyr: satrec.epochyr,
      epochdays: satrec.epochdays,
      method: satrec.method, // 'n' for near-earth SGP4, 'd' for deep-space SDP4
      opsmode: satrec.operationmode,
      error: satrec.error // 0 = no error
    });

    // Calculate orbit but don't draw initially (shown on click)
    const orbitPoints = calculateOrbit(satrec, currentTime);
    // Store orbit points for later use
    satData[0].orbitPoints = orbitPoints;
  }
});

// Animation Loop
(function animate() {
  requestAnimationFrame(animate);

  if (!isPaused) {
    currentTime = new Date(currentTime.getTime() + (1000 / 60) * TIME_SCALE);
  }

  // Enhanced time display
  const timeInfo = [
    `Sim Time: ${currentTime.toISOString().slice(0, 19).replace('T', ' ')}`,
    `Speed: ${TIME_SCALE}x`,
    orbitalPeriodMinutes > 0 ? `Orbital Period: ${orbitalPeriodMinutes.toFixed(1)} min` : '',
    isPaused ? '⏸ PAUSED' : '▶ Playing'
  ].filter(Boolean).join(' | ');

  timeLogger.innerText = timeInfo;

  if (satData[0].satrec) {
    const gmst = satellite.gstime(currentTime);
    const positionAndVelocity = satellite.propagate(satData[0].satrec, currentTime);
    const positionEci = positionAndVelocity.position;

    if (positionEci) {
      const gdPos = satellite.eciToGeodetic(positionEci, gmst);
      const lat = satellite.radiansToDegrees(gdPos.latitude);
      const lng = satellite.radiansToDegrees(gdPos.longitude);
      const alt = gdPos.height / EARTH_RADIUS_KM;

      satData[0].lat = lat;
      satData[0].lng = lng;
      satData[0].alt = alt;

      Globe.objectsData([...satData]);

      // Dynamic satellite sizing based on camera distance
      if (satelliteMesh) {
        const cameraDistance = camera.position.length();
        const worldRadius = THREE.MathUtils.clamp(
          (cameraDistance / SAT_REFERENCE_CAMERA_DISTANCE) * SAT_WORLD_RADIUS_AT_REFERENCE,
          SAT_WORLD_RADIUS_MIN,
          SAT_WORLD_RADIUS_MAX
        );
        satelliteMesh.scale.setScalar(worldRadius);
      }

      // Update orbit path if visible
      if (orbitVisible && satData[0].orbitPoints) {
        // Recalculate orbit periodically (every 60 frames)
        if (Math.random() < 0.017) { // ~1/60 chance per frame
          const newOrbitPoints = calculateOrbit(satData[0].satrec, currentTime);
          satData[0].orbitPoints = newOrbitPoints;
          drawOrbitPath(newOrbitPoints);
        }
      }
    }
  }

  tbControls.update();
  renderer.render(scene, camera);
})();

// Click Interaction - shows orbit when satellite is clicked
window.addEventListener('click', (event) => {
  // Ignore clicks on controls
  if (event.target.closest('#controls')) return;

  const mouse = new THREE.Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );

  if (!satData[0].lat) return;
  const { x, y, z } = Globe.getCoords(satData[0].lat, satData[0].lng, satData[0].alt);
  const satPos = new THREE.Vector3(x, y, z).project(camera);
  const dist = Math.sqrt((mouse.x - satPos.x) ** 2 + (mouse.y - satPos.y) ** 2);

  if (dist < 0.15) {
    // Toggle orbit visibility when satellite is clicked
    orbitVisible = !orbitVisible;

    if (orbitVisible) {
      // Calculate and draw orbit
      const orbitPoints = calculateOrbit(satData[0].satrec, currentTime);
      satData[0].orbitPoints = orbitPoints;
      drawOrbitPath(orbitPoints);
      showInfo(satData[0]);
    } else {
      // Hide orbit
      const orbitLine = scene.getObjectByName('orbitLine');
      if (orbitLine) scene.remove(orbitLine);
      hideInfo();
    }
  }
});

function showInfo(d) {
  infoBox.style.display = 'block';
  infoBox.innerHTML = `
    <strong>${d.name}</strong><br>
    <span class="info-label">Model:</span> SGP4<br>
    <span class="info-label">Lat:</span> ${d.lat.toFixed(2)}&deg;<br>
    <span class="info-label">Lng:</span> ${d.lng.toFixed(2)}&deg;<br>
    <span class="info-label">Alt:</span> ${(d.alt * EARTH_RADIUS_KM).toFixed(2)} km<br>
    <span class="info-label">Period:</span> ${orbitalPeriodMinutes.toFixed(1)} min
  `;
}

function hideInfo() { infoBox.style.display = 'none'; }

// Control event listeners
const speedSlider = document.getElementById('speed-slider');
const speedValue = document.getElementById('speed-value');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');

speedSlider.addEventListener('input', (e) => {
  TIME_SCALE = parseInt(e.target.value);
  speedValue.textContent = TIME_SCALE;
});

pauseBtn.addEventListener('click', () => {
  isPaused = !isPaused;
  pauseBtn.textContent = isPaused ? '▶ Play' : '⏸ Pause';
});

resetBtn.addEventListener('click', () => {
  currentTime = new Date();
  if (satData[0].satrec && orbitVisible) {
    const orbitPoints = calculateOrbit(satData[0].satrec, currentTime);
    satData[0].orbitPoints = orbitPoints;
    drawOrbitPath(orbitPoints);
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
