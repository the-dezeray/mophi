import * as THREE from 'three';
import ThreeGlobe from 'three-globe';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { SatelliteManager } from './SatelliteManager.js';
import './style.css';

// Global State
let TIME_SCALE = 60;
let currentTime = new Date();
let isPaused = false;
let orbitVisible = false;
let cameraMode = 'FREE'; // FREE, FOLLOW, NADIR

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
  <div class="search-results" id="search-results"></div>
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

const Globe = new ThreeGlobe()
  .globeImageUrl('//cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg')
  .showAtmosphere(true)
  .atmosphereColor('#5da9ff')
  .atmosphereAltitude(0.15);

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
  satelliteManager.updateSatelliteScale(camera);
  
  // Update selected satellite telemetry and draw downward line
  const selectedIndex = satelliteManager.getSelected();
  if (selectedIndex >= 0) {
    const satData = satelliteManager.getSatelliteData(selectedIndex);
    if (satData) {
      updateSelectedSatelliteInfo(satData);
    }
    
    // Draw downward line
    const satPos = satelliteManager.getSelectedPosition();
    if (satPos) {
        drawDownwardLine(satPos);
        
        // Camera Modes Logic
        if (cameraMode !== 'FREE') {
            const globalPos = satPos.clone();
            globalPos.applyMatrix4(Globe.matrixWorld);

            if (cameraMode === 'FOLLOW') {
                const offset = camera.position.clone().sub(tbControls.target);
                tbControls.target.copy(globalPos);
                camera.position.copy(globalPos.clone().add(offset));
            } else if (cameraMode === 'NADIR') {
                const nadirPos = globalPos.clone().normalize().multiplyScalar(globalPos.length() + 50);
                camera.position.lerp(nadirPos, 0.1);
                tbControls.target.lerp(globalPos, 0.1);
            }
        }
    }
  } else {
    const oldLine = Globe.getObjectByName('downwardLine');
    if (oldLine) Globe.remove(oldLine);
    infoBox.style.display = 'none';
  }

  timeLogger.innerText = `UTC ${currentTime.toISOString().replace('T', ' ').slice(0, 19)} | GLOBAL SURVEILLANCE ACTIVE`;

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
window.addEventListener('click', async (event) => {
  if (event.target.closest('.glass') || event.target.closest('.search-container')) return;

  const mouse = new THREE.Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );

  // Check if clicking on a satellite from the satellite manager
  const clickedIndex = satelliteManager.checkHover(mouse, camera);
  if (clickedIndex >= 0) {
    selectSatellite(clickedIndex);
    return;
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

  const selectedIndex = satelliteManager.getSelected();
  if (selectedIndex >= 0) {
      const satPos = satelliteManager.getSelectedPosition();
      if (satPos) {
          const globalPos = satPos.clone();
          globalPos.applyMatrix4(Globe.matrixWorld);
          tbControls.target.copy(globalPos);
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
    const selectedIndex = satelliteManager.getSelected();
    if (selectedIndex >= 0) {
      const satPos = satelliteManager.getSelectedPosition();
      if (satPos) {
        const globalPos = satPos.clone();
        globalPos.applyMatrix4(Globe.matrixWorld);
        tbControls.target.copy(globalPos);

        // Position camera close to satellite
        const offset = new THREE.Vector3(20, 20, 20);
        camera.position.copy(globalPos.clone().add(offset));

        cameraMode = 'FOLLOW';
        document.querySelectorAll('#camera-selector .selector-option').forEach(el => el.classList.remove('active'));
        document.querySelector('#camera-selector [data-mode="FOLLOW"]').classList.add('active');
      }
    }
  }
});

// Search Listener
const searchInput = document.getElementById('sat-search');
const searchResults = document.getElementById('search-results');

searchInput.addEventListener('input', (e) => {
  const query = e.target.value.trim();
  if (query.length < 2) {
    searchResults.style.display = 'none';
    return;
  }

  const results = satelliteManager.searchSatellites(query);
  if (results.length > 0) {
    searchResults.innerHTML = results.map(res => `
      <div class="search-result-item" data-index="${res.index}">
        <span class="sat-name">${res.name}</span>
        <span class="sat-id">#${res.id}</span>
      </div>
    `).join('');
    searchResults.style.display = 'block';
  } else {
    searchResults.style.display = 'none';
  }
});

// Handle search result selection
searchResults.addEventListener('click', async (e) => {
  const item = e.target.closest('.search-result-item');
  if (!item) return;

  const index = parseInt(item.dataset.index);
  selectSatellite(index);
  searchResults.style.display = 'none';
  searchInput.value = '';
});

// Helper to select satellite
async function selectSatellite(index) {
  if (index >= 0) {
    satelliteManager.setSelected(index);
    
    // Get satellite data
    const satData = satelliteManager.getSatelliteData(index);
    if (satData) {
      // Initial info update (will be updated live in loop)
      updateSelectedSatelliteInfo(satData);
      
      // Calculate and draw orbit arc
      try {
        const orbitPoints = await satelliteManager.calculateOrbitPath(satData, Globe, currentTime);
        drawOrbitPath(orbitPoints, true);
      } catch (err) {
        console.error('Failed to calculate orbit:', err);
      }
    }
    
    // Focus camera on selected satellite
    setTimeout(() => {
      const satPos = satelliteManager.getSelectedPosition();
      if (satPos) {
        const globalPos = satPos.clone();
        globalPos.applyMatrix4(Globe.matrixWorld);
        
        tbControls.target.copy(globalPos);
        
        // Position camera relative to the satellite's position on the globe
        // Calculate normal vector from center of earth (0,0,0) to satellite
        const normal = globalPos.clone().normalize();
        const distance = 80; // Distance above the satellite
        const newCameraPos = globalPos.clone().add(normal.multiplyScalar(distance));
        
        camera.position.copy(newCameraPos);
        camera.lookAt(globalPos);
      }
    }, 100);
  }
}

// Keep Enter key for fallback or immediate first result
searchInput.addEventListener('keypress', async (e) => {
  if (e.key === 'Enter') {
    const query = e.target.value.trim();
    if (query) {
      const index = satelliteManager.searchSatellite(query);
      if (index >= 0) {
        selectSatellite(index);
        searchResults.style.display = 'none';
      }
    }
  }
});

// Close search results when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-container')) {
    searchResults.style.display = 'none';
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
