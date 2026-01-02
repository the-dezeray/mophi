import * as THREE from 'three';
import ThreeGlobe from 'three-globe';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import * as satellite from 'satellite.js';
import { SatelliteManager } from './SatelliteManager.js';
import './style.css';

// Configuration
const SAT_ID = '63216'; // BOTSAT-1
const CELESTRAK_URL = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${SAT_ID}&FORMAT=TLE`;
const CACHE_KEY = `tle-${SAT_ID}`;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const EARTH_RADIUS_KM = 6371;

// Global State
let TIME_SCALE = 60;
let currentTime = new Date();
let isPaused = false;
let orbitVisible = false;
let orbitalPeriodMinutes = 0;
let cameraMode = 'FREE'; // FREE, FOLLOW, NADIR
let satData = [{ satrec: null, name: 'BOTSAT-1', lat: 0, lng: 0, alt: 0, velocity: 0 }];

// UI Elements
const timeLogger = document.createElement('div');
timeLogger.id = 'time-log';
document.body.appendChild(timeLogger);

// Search Bar
const searchContainer = document.createElement('div');
searchContainer.className = 'search-container glass';
searchContainer.innerHTML = `
  <span class="search-icon">🔍</span>
  <input type="text" id="sat-search" placeholder="Search by NORAD ID or Name...">
  <div class="loader" id="search-loader"></div>
`;
document.body.appendChild(searchContainer);

const infoBox = document.createElement('div');
infoBox.id = 'sat-info';
infoBox.className = 'glass';
document.body.appendChild(infoBox);

// Zoom Controls - Middle Left
const zoomControls = document.createElement('div');
zoomControls.id = 'zoom-controls';
zoomControls.className = 'glass';
zoomControls.innerHTML = `
  <button id="zoom-in-btn" title="Zoom In">+</button>
  <button id="zoom-out-btn" title="Zoom Out">-</button>
`;
document.body.appendChild(zoomControls);

// Action Buttons - Top Right
const actionButtons = document.createElement('div');
actionButtons.id = 'action-buttons';
actionButtons.className = 'glass';
actionButtons.innerHTML = `
  <button id="track-single-btn" title="Track Satellite">🎯</button>
  <button id="pause-btn" title="Play/Pause">
    <span id="pause-icon">⏸</span>
  </button>
  <button id="reset-btn" title="Reset Time">↻</button>
`;
document.body.appendChild(actionButtons);

// View Mode Selector - Top Right (below action buttons)
const viewModeSelector = document.createElement('div');
viewModeSelector.id = 'view-mode';
viewModeSelector.className = 'glass';
viewModeSelector.innerHTML = `
  <div class="selector-group">
    <div class="selector-option active" data-view="earth">🌍 Earth</div>
    <div class="selector-option" data-view="satellite">🛰️ Satellite</div>
  </div>
`;
document.body.appendChild(viewModeSelector);

// Main Controls Panel - Bottom Right
const controlsPanel = document.createElement('div');
controlsPanel.id = 'controls';
controlsPanel.className = 'glass';
controlsPanel.innerHTML = `
  <div class="control-item">
    <span class="control-label-text">Scale</span>
    <input type="range" id="speed-slider" min="1" max="500" value="60" step="1">
    <span class="value-badge" id="speed-value">60</span>
  </div>

  <div class="selector-group" id="mesh-selector">
    <div class="selector-option active" data-mesh="marble">Marble</div>
    <div class="selector-option" data-mesh="night">Night</div>
    <div class="selector-option" data-mesh="dark">Dark</div>
    <div class="selector-option" data-mesh="gray">Topo</div>
  </div>

  <div class="selector-group" id="camera-selector">
    <div class="selector-option active" data-mode="FREE">Free</div>
    <div class="selector-option" data-mode="FOLLOW">Follow</div>
    <div class="selector-option" data-mode="NADIR">Nadir</div>
  </div>
`;
document.body.appendChild(controlsPanel);

// Satellite mesh reference for dynamic scaling
let satelliteMesh = null;
const SAT_REFERENCE_CAMERA_DISTANCE = 800;
const SAT_WORLD_RADIUS_AT_REFERENCE = 0.15;
const SAT_WORLD_RADIUS_MIN = 0.05;
const SAT_WORLD_RADIUS_MAX = 0.4;

const Globe = new ThreeGlobe()
  .globeImageUrl('//cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg')
  .showAtmosphere(true)
  .atmosphereColor('#5da9ff')
  .atmosphereAltitude(0.15)
  .particleLat('lat')
  .particleLng('lng')
  .particleAltitude('alt')
  .objectLat('lat')
  .objectLng('lng')
  .objectAltitude('alt')
  .objectThreeObject(() => {
    const geometry = new THREE.SphereGeometry(1, 32, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });
    satelliteMesh = new THREE.Mesh(geometry, material);
    return satelliteMesh;
  });

const satelliteManager = new SatelliteManager(Globe);
satelliteManager.init();

// Scene Setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.querySelector('#app').innerHTML = '<div id="globeViz"></div>';
const vizContainer = document.getElementById('globeViz');
vizContainer.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.add(Globe);
scene.add(new THREE.AmbientLight(0x404040, 0.6));

const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
sunLight.position.set(1000, 0, 1000);
scene.add(sunLight);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 200000);
camera.position.set(0, 0, 800);

const tbControls = new TrackballControls(camera, renderer.domElement);
tbControls.rotateSpeed = 5;
tbControls.zoomSpeed = 0.8;

// Data Fetching
async function getTLEData(id) {
  const url = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${id}&FORMAT=TLE`;
  const cacheKey = `tle-${id}`;
  const now = Date.now();
  const cached = localStorage.getItem(cacheKey);

  if (cached) {
    const { timestamp, data } = JSON.parse(cached);
    if (now - timestamp < CACHE_DURATION) return data;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');
    const text = await response.text();
    if (text.includes('No GP data found')) throw new Error('Satellite not found');
    localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data: text }));
    return text;
  } catch (err) {
    if (cached) return JSON.parse(cached).data;
    throw err;
  }
}

function calculateOrbit(satrec, startTime, numPoints = 100) {
  const points = [];
  const meanMotion = satrec.no * (1440 / (2 * Math.PI));
  const periodMinutes = 1440 / meanMotion;
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
      if (coords) points.push(new THREE.Vector3(coords.x, coords.y, coords.z));
    }
  }
  return points;
}

function drawOrbitPath(points, isSelected = false) {
  const oldLine = Globe.getObjectByName('orbitLine');
  if (oldLine) Globe.remove(oldLine);
  if (points.length < 2) return;

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: isSelected ? 0x00ff00 : 0x38bdf8,
    linewidth: 2,
    transparent: true,
    opacity: isSelected ? 0.8 : 0.4
  });
  const line = new THREE.Line(geometry, material);
  line.name = 'orbitLine';
  Globe.add(line);
}

async function loadSatellite(id) {
  const loader = document.getElementById('search-loader');
  loader.style.display = 'block';

  try {
    const rawData = await getTLEData(id);
    const lines = rawData.split('\n').map(l => l.trim()).filter(l => l);
    let name = 'UNKNOWN';
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
      satData[0].orbitPoints = calculateOrbit(satrec, currentTime);

      if (orbitVisible) {
        drawOrbitPath(satData[0].orbitPoints);
      }
    }
  } catch (err) {
    console.error('Failed to load satellite:', err);
    alert('Could not find satellite with ID: ' + id);
  } finally {
    loader.style.display = 'none';
  }
}

// Initial load
loadSatellite(SAT_ID);

function updateSatelliteInfo(d) {
  if (!orbitVisible) {
    infoBox.style.display = 'none';
    return;
  }
  infoBox.style.display = 'block';
  infoBox.innerHTML = `
    <div class="info-header">
      <div class="status-dot"></div>
      Telemetry
    </div>
    <div class="info-grid">
      <div class="info-field">
        <span class="field-label">Object Name</span>
        <span class="field-value">${d.name}</span>
      </div>
      <div class="info-field">
        <span class="field-label">Position</span>
        <span class="field-value">${d.lat.toFixed(4)}°, ${d.lng.toFixed(4)}°</span>
      </div>
      <div class="info-field">
        <span class="field-label">Altitude</span>
        <span class="field-value">${(d.alt * EARTH_RADIUS_KM).toFixed(2)} km</span>
      </div>
      <div class="info-field">
        <span class="field-label">Velocity</span>
        <span class="field-value">${d.velocity.toFixed(2)} km/s</span>
      </div>
      <div class="info-field">
        <span class="field-label">Period</span>
        <span class="field-value">${orbitalPeriodMinutes.toFixed(1)} min</span>
      </div>
    </div>
  `;
}

function updateSelectedSatelliteInfo(satData) {
  if (!satData) {
    infoBox.style.display = 'none';
    return;
  }
  
  // Index mapping: [id, name, epoch, i, o, e, p, m, n, b]
  const id = satData[0];
  const name = satData[1];
  const epoch = satData[2];
  const inclination = satData[3];
  const raan = satData[4];
  const eccentricity = satData[5];
  const argOfPerigee = satData[6];
  const meanAnomaly = satData[7];
  const meanMotion = satData[8];
  const bstar = satData[9];
  
  infoBox.style.display = 'block';
  infoBox.innerHTML = `
    <div class="info-header">
      <div class="status-dot"></div>
      Satellite Telemetry
    </div>
    <div class="info-grid">
      <div class="info-field">
        <span class="field-label">NORAD ID</span>
        <span class="field-value">${id}</span>
      </div>
      <div class="info-field">
        <span class="field-label">Name</span>
        <span class="field-value">${name}</span>
      </div>
      <div class="info-field">
        <span class="field-label">Inclination</span>
        <span class="field-value">${inclination.toFixed(2)}°</span>
      </div>
      <div class="info-field">
        <span class="field-label">RAAN</span>
        <span class="field-value">${raan.toFixed(2)}°</span>
      </div>
      <div class="info-field">
        <span class="field-label">Eccentricity</span>
        <span class="field-value">${eccentricity.toFixed(6)}</span>
      </div>
      <div class="info-field">
        <span class="field-label">Arg Perigee</span>
        <span class="field-value">${argOfPerigee.toFixed(2)}°</span>
      </div>
      <div class="info-field">
        <span class="field-label">Mean Anomaly</span>
        <span class="field-value">${meanAnomaly.toFixed(2)}°</span>
      </div>
      <div class="info-field">
        <span class="field-label">Mean Motion</span>
        <span class="field-value">${meanMotion.toFixed(6)}</span>
      </div>
      <div class="info-field">
        <span class="field-label">BSTAR</span>
        <span class="field-value">${bstar.toExponential(4)}</span>
      </div>
      <div class="info-field">
        <span class="field-label">Epoch</span>
        <span class="field-value">${new Date(epoch * 1000).toISOString().slice(0, 10)}</span>
      </div>
    </div>
  `;
}

function drawDownwardLine(satPos) {
  const oldLine = Globe.getObjectByName('downwardLine');
  if (oldLine) Globe.remove(oldLine);
  
  if (!satPos) return;
  
  // Calculate the point on Earth's surface directly below the satellite
  const earthSurfacePoint = satPos.clone().normalize().multiplyScalar(100);
  
  const points = [satPos.clone(), earthSurfacePoint];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0x00ff00,
    linewidth: 2,
    transparent: true,
    opacity: 0.6
  });
  const line = new THREE.Line(geometry, material);
  line.name = 'downwardLine';
  Globe.add(line);
}

// Animation Loop
(function animate() {
  requestAnimationFrame(animate);

  if (!isPaused) {
    currentTime = new Date(currentTime.getTime() + (1000 / 60) * TIME_SCALE);
  }

  satelliteManager.update(currentTime);
  
  // Update selected satellite telemetry and draw downward line
  const selectedIndex = satelliteManager.getSelected();
  if (selectedIndex >= 0) {
    const satData = satelliteManager.getSatelliteData(selectedIndex);
    updateSelectedSatelliteInfo(satData);
    
    // Draw downward line
    const satPos = satelliteManager.getSelectedPosition();
    drawDownwardLine(satPos);
  } else {
    const oldLine = Globe.getObjectByName('downwardLine');
    if (oldLine) Globe.remove(oldLine);
  }

  timeLogger.innerText = `UTC ${currentTime.toISOString().replace('T', ' ').slice(0, 19)} | GLOBAL SURVEILLANCE ACTIVE`;

  if (satData[0].satrec) {
    const gmst = satellite.gstime(currentTime);
    const propagate = satellite.propagate(satData[0].satrec, currentTime);
    const positionEci = propagate.position;
    const velocityEci = propagate.velocity;

    if (positionEci) {
      const gdPos = satellite.eciToGeodetic(positionEci, gmst);
      satData[0].lat = satellite.radiansToDegrees(gdPos.latitude);
      satData[0].lng = satellite.radiansToDegrees(gdPos.longitude);
      satData[0].alt = gdPos.height / EARTH_RADIUS_KM;

      if (velocityEci) {
        satData[0].velocity = Math.sqrt(
          Math.pow(velocityEci.x, 2) +
          Math.pow(velocityEci.y, 2) +
          Math.pow(velocityEci.z, 2)
        );
      }

      Globe.objectsData([...satData]);

      // Dynamic scaling
      if (satelliteMesh) {
        const cameraDistance = camera.position.length();
        const worldRadius = THREE.MathUtils.clamp(
          (cameraDistance / SAT_REFERENCE_CAMERA_DISTANCE) * SAT_WORLD_RADIUS_AT_REFERENCE,
          SAT_WORLD_RADIUS_MIN,
          SAT_WORLD_RADIUS_MAX
        );
        satelliteMesh.scale.setScalar(worldRadius);
      }

      // Update info box live
      updateSatelliteInfo(satData[0]);

      // Camera Modes Logic
      if (cameraMode !== 'FREE') {
        const coords = Globe.getCoords(satData[0].lat, satData[0].lng, satData[0].alt);
        if (coords) {
          const satPos = new THREE.Vector3(coords.x, coords.y, coords.z);
          satPos.applyMatrix4(Globe.matrixWorld);

          if (cameraMode === 'FOLLOW') {
            const offset = camera.position.clone().sub(tbControls.target);
            tbControls.target.copy(satPos);
            camera.position.copy(satPos.clone().add(offset));
          } else if (cameraMode === 'NADIR') {
            const nadirPos = satPos.clone().normalize().multiplyScalar(satPos.length() + 50);
            camera.position.lerp(nadirPos, 0.1);
            tbControls.target.lerp(satPos, 0.1);
          }
        }
      }

      // Update orbit path intermittently
      if (orbitVisible && satData[0].orbitPoints) {
        if (Math.random() < 0.01) {
          const newOrbitPoints = calculateOrbit(satData[0].satrec, currentTime);
          satData[0].orbitPoints = newOrbitPoints;
          drawOrbitPath(newOrbitPoints);
        }
      }
    }
  }

  // Add slow Earth rotation for scale perception
  Globe.rotation.y += 0.0002;

  tbControls.update();
  renderer.render(scene, camera);
})();

// Mouse move for hover detection
window.addEventListener('mousemove', (event) => {
  if (event.target.closest('.glass') || event.target.closest('.search-container')) {
    satelliteManager.setHovered(-1);
    document.body.classList.remove('hovering-satellite');
    return;
  }

  const mouse = new THREE.Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );

  const hoveredIndex = satelliteManager.checkHover(mouse, camera);
  satelliteManager.setHovered(hoveredIndex);
  
  if (hoveredIndex >= 0) {
    document.body.classList.add('hovering-satellite');
  } else {
    document.body.classList.remove('hovering-satellite');
  }
});

// Interaction - Click to select satellite
window.addEventListener('click', (event) => {
  if (event.target.closest('.glass') || event.target.closest('.search-container')) return;

  const mouse = new THREE.Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );

  // Check if clicking on a satellite from the satellite manager
  const clickedIndex = satelliteManager.checkHover(mouse, camera);
  if (clickedIndex >= 0) {
    satelliteManager.setSelected(clickedIndex);
    return;
  }

  // Original click handler for single satellite
  if (!satData[0].lat) return;
  const coords = Globe.getCoords(satData[0].lat, satData[0].lng, satData[0].alt);
  if (!coords) return;

  const satPos = new THREE.Vector3(coords.x, coords.y, coords.z);
  satPos.applyMatrix4(Globe.matrixWorld);
  satPos.project(camera);
  const dist = Math.sqrt((mouse.x - satPos.x) ** 2 + (mouse.y - satPos.y) ** 2);

  if (dist < 0.15) {
    orbitVisible = !orbitVisible;
    if (orbitVisible) {
      const orbitPoints = calculateOrbit(satData[0].satrec, currentTime);
      drawOrbitPath(orbitPoints, false);
    } else {
      const orbitLine = Globe.getObjectByName('orbitLine');
      if (orbitLine) Globe.remove(orbitLine);
    }
  }
});

// Controls Listeners
document.getElementById('speed-slider').addEventListener('input', (e) => {
  TIME_SCALE = parseInt(e.target.value);
  document.getElementById('speed-value').textContent = TIME_SCALE;
});

document.getElementById('pause-btn').addEventListener('click', () => {
  isPaused = !isPaused;
  document.getElementById('pause-icon').textContent = isPaused ? '▶' : '⏸';
  document.getElementById('pause-btn').classList.toggle('active', isPaused);
});

document.getElementById('reset-btn').addEventListener('click', () => {
  currentTime = new Date();
});

document.getElementById('camera-selector').addEventListener('click', (e) => {
  const option = e.target.closest('.selector-option');
  if (!option) return;

  document.querySelectorAll('.selector-option').forEach(el => el.classList.remove('active'));
  option.classList.add('active');
  cameraMode = option.dataset.mode;

  if (cameraMode === 'FREE') {
    tbControls.target.set(0, 0, 0);
  }
});

// Zoom Controls Listeners
document.getElementById('zoom-in-btn').addEventListener('click', () => {
  const currentDist = camera.position.length();
  const newDist = Math.max(105, currentDist * 0.8);
  camera.position.normalize().multiplyScalar(newDist);
});

document.getElementById('zoom-out-btn').addEventListener('click', () => {
  const currentDist = camera.position.length();
  const newDist = Math.min(2000, currentDist * 1.2);
  camera.position.normalize().multiplyScalar(newDist);
});

// Mesh Selector Listener
const MESHES = {
  marble: '//cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg',
  night: '//cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg',
  dark: '//cdn.jsdelivr.net/npm/three-globe/example/img/earth-dark.jpg',
  gray: '//cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png'
};

document.getElementById('mesh-selector').addEventListener('click', (e) => {
  const option = e.target.closest('.selector-option');
  if (!option) return;

  document.querySelectorAll('#mesh-selector .selector-option').forEach(el => el.classList.remove('active'));
  option.classList.add('active');
  const meshType = option.dataset.mesh;
  Globe.globeImageUrl(MESHES[meshType]);
});

// Track Single Listener
document.getElementById('track-single-btn').addEventListener('click', () => {
  cameraMode = 'FOLLOW';
  document.querySelectorAll('#camera-selector .selector-option').forEach(el => el.classList.remove('active'));
  document.querySelector('#camera-selector [data-mode="FOLLOW"]').classList.add('active');

  if (satData[0].lat) {
    const coords = Globe.getCoords(satData[0].lat, satData[0].lng, satData[0].alt);
    if (coords) {
      const satPos = new THREE.Vector3(coords.x, coords.y, coords.z);
      tbControls.target.copy(satPos);
    }
  }
});

// View Mode Selector Listener
document.getElementById('view-mode').addEventListener('click', (e) => {
  const option = e.target.closest('.selector-option');
  if (!option) return;

  document.querySelectorAll('#view-mode .selector-option').forEach(el => el.classList.remove('active'));
  option.classList.add('active');
  const viewMode = option.dataset.view;

  if (viewMode === 'earth') {
    // Earth View - center on Earth
    tbControls.target.set(0, 0, 0);
    const currentDist = camera.position.length();
    camera.position.set(0, 0, Math.max(currentDist, 400));
    cameraMode = 'FREE';
    document.querySelectorAll('#camera-selector .selector-option').forEach(el => el.classList.remove('active'));
    document.querySelector('#camera-selector [data-mode="FREE"]').classList.add('active');
  } else if (viewMode === 'satellite') {
    // Satellite View - focus on satellite
    if (satData[0].lat) {
      const coords = Globe.getCoords(satData[0].lat, satData[0].lng, satData[0].alt);
      if (coords) {
        const satPos = new THREE.Vector3(coords.x, coords.y, coords.z);
        tbControls.target.copy(satPos);

        // Position camera close to satellite
        const offset = new THREE.Vector3(20, 20, 20);
        camera.position.copy(satPos.clone().add(offset));

        cameraMode = 'FOLLOW';
        document.querySelectorAll('#camera-selector .selector-option').forEach(el => el.classList.remove('active'));
        document.querySelector('#camera-selector [data-mode="FOLLOW"]').classList.add('active');
      }
    }
  }
});

// Search Listener
document.getElementById('sat-search').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const query = e.target.value.trim();
    if (query) {
      // Search in satellite manager
      const index = satelliteManager.searchSatellite(query);
      if (index >= 0) {
        satelliteManager.setSelected(index);
        
        // Focus camera on selected satellite
        setTimeout(() => {
          const satPos = satelliteManager.getSelectedPosition();
          if (satPos) {
            const globalPos = satPos.clone();
            globalPos.applyMatrix4(Globe.matrixWorld);
            
            tbControls.target.copy(globalPos);
            const offset = new THREE.Vector3(50, 50, 50);
            camera.position.copy(globalPos.clone().add(offset));
          }
        }, 100);
      } else {
        // Fallback to old single satellite search
        loadSatellite(query);
      }
    }
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});


