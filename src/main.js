import * as THREE from 'three';
import ThreeGlobe from 'three-globe';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { SatelliteManager } from './SatelliteManager.js';
import { state, updateState } from './state.js';
import { createUI, updateInfoBox } from './ui.js';
import { initDemo } from './demo.js';
import './style.css';

// --- DEMO SETTINGS ---
const ENABLE_STARTUP_DEMO = false; // CHANGE TO 'false' TO DISABLE THE DEMO SEQUENCE
// --------------------

// UI Elements
const UI = createUI(null, ENABLE_STARTUP_DEMO);
const {
  timeLogger,
  searchContainer,
  infoBox,
  hoverLabel,
  zoomControls,
  actionButtons,
  viewModeSelector,
  controlsPanel,
  trackingCard
} = UI;

const Globe = new ThreeGlobe()
  .globeImageUrl('//cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg')
  .showAtmosphere(true)
  .atmosphereColor('#5da9ff')
  .atmosphereAltitude(0.15);

const satelliteManager = new SatelliteManager(Globe);
satelliteManager.init();

function handleUrlParams() {
  const params = new URLSearchParams(window.location.search);
  // Support ?select=name or ?s=name or ?name (if it's the only param)
  let query = params.get('select') || params.get('s');

  if (!query) {
    // Check if there's a param with no value, e.g. ?botsat-1
    for (const [key, value] of params.entries()) {
      if (value === '' && key !== '') {
        query = key;
        break;
      }
    }
  }

  // Handle the specific case /select?=botsat-1
  if (!query && window.location.search.startsWith('?=')) {
    query = window.location.search.substring(2);
  }

  if (query) {
    const index = satelliteManager.searchSatellite(query);
    if (index >= 0) {
      selectSatellite(index);
    }
  }
}

// Hide loading overlay when ready
satelliteManager.onReadyCallback = () => {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
    setTimeout(() => overlay.remove(), 500);
  }
  handleUrlParams();

  // Trigger demo if enabled
  if (ENABLE_STARTUP_DEMO) {
    updateState({ demoMode: true });
    initDemo(camera, tbControls, satelliteManager, selectSatellite);
  }
};

// Handle browser back/forward buttons
window.addEventListener('popstate', () => {
  handleUrlParams();
});

// Scene Setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
// Clamp pixel ratio to reduce GPU cost on high-DPI screens
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

// Performance optimization variables
let lastHoverCheck = 0;
const HOVER_THROTTLE_MS = 16; // ~60Hz max
let hoverCheckScheduled = false;
let lastOrbitUpdate = 0;
const ORBIT_UPDATE_INTERVAL = 100; // 10Hz for orbit/downward lines
const reusedMouse = new THREE.Vector2(); // Reuse mouse vector

function drawOrbitPath(points, isSelected = false) {
  // Throttle orbit path updates to 10Hz
  const now = performance.now();
  if (now - lastOrbitUpdate < ORBIT_UPDATE_INTERVAL) return;
  lastOrbitUpdate = now;

  const oldLine = Globe.getObjectByName('orbitLine');
  if (oldLine) Globe.remove(oldLine);
  if (points.length < 2) return;

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: isSelected ? 0x00ff00 : 0x38bdf8,
    linewidth: 2,
    transparent: true,
    opacity: 0 // Start invisible for animation
  });
  const line = new THREE.Line(geometry, material);
  line.name = 'orbitLine';
  line.userData.targetOpacity = isSelected ? 0.8 : 0.4;
  line.userData.currentOpacity = 0;
  Globe.add(line);
}

function drawDownwardLine(satPos) {
  // Throttle downward line updates to 10Hz
  const now = performance.now();
  if (now - lastOrbitUpdate < ORBIT_UPDATE_INTERVAL) return;

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

  if (!state.isPaused) {
    state.currentTime = new Date(state.currentTime.getTime() + (1000 / 60) * state.timeScale);
  }

  satelliteManager.update(state.currentTime);
  satelliteManager.updateSatelliteScale(camera);

  // Handle camera animation
  if (state.cameraAnimation.active) {
    state.cameraAnimation.progress += 1 / (60 * state.cameraAnimation.duration);

    if (state.cameraAnimation.progress >= 1) {
      // Animation complete
      state.cameraAnimation.active = false;
      state.cameraAnimation.progress = 1;
    }

    // Easing function (easeInOutCubic)
    const t = state.cameraAnimation.progress;
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    // Interpolate camera position and target
    camera.position.lerpVectors(
      state.cameraAnimation.startPos,
      state.cameraAnimation.endPos,
      eased
    );

    tbControls.target.lerpVectors(
      state.cameraAnimation.startTarget,
      state.cameraAnimation.endTarget,
      eased
    );
  }

  // Animate orbit line opacity
  const orbitLine = Globe.getObjectByName('orbitLine');
  if (orbitLine && orbitLine.material) {
    const targetOpacity = orbitLine.userData.targetOpacity || 0.4;
    orbitLine.userData.currentOpacity = orbitLine.userData.currentOpacity || 0;

    if (orbitLine.userData.currentOpacity < targetOpacity) {
      orbitLine.userData.currentOpacity = Math.min(
        orbitLine.userData.currentOpacity + 0.02,
        targetOpacity
      );
      orbitLine.material.opacity = orbitLine.userData.currentOpacity;
    }
  }

  // Update selected satellite telemetry and draw downward line
  const selectedIndex = satelliteManager.getSelected();
  if (selectedIndex >= 0) {
    const now = performance.now();
    // Throttle UI updates to 10Hz (every 100ms)
    if (now - state.lastInfoUpdate > 100) {
      const satData = satelliteManager.getSatelliteData(selectedIndex);
      if (satData) {
        const liveData = satelliteManager.getLiveStats(selectedIndex);
        updateInfoBox(infoBox, satData, liveData);
      }
      timeLogger.innerText = `UTC ${state.currentTime.toISOString().replace('T', ' ').slice(0, 19)} | GLOBAL SURVEILLANCE ACTIVE`;
      state.lastInfoUpdate = now;
    }

    // Draw downward line
    const satPos = satelliteManager.getSelectedPosition();
    if (satPos) {
      drawDownwardLine(satPos);

      // Camera Modes Logic
      if (state.cameraMode !== 'FREE') {
        const globalPos = satPos.clone();
        globalPos.applyMatrix4(Globe.matrixWorld);

        if (state.cameraMode === 'FOLLOW') {
          const offset = camera.position.clone().sub(tbControls.target);
          tbControls.target.copy(globalPos);
          camera.position.copy(globalPos.clone().add(offset));
        } else if (state.cameraMode === 'NADIR') {
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

    // Still update time logger even if no satellite is selected
    const now = performance.now();
    if (now - state.lastInfoUpdate > 100) {
      timeLogger.innerText = `UTC ${state.currentTime.toISOString().replace('T', ' ').slice(0, 19)} | GLOBAL SURVEILLANCE ACTIVE`;
      state.lastInfoUpdate = now;
    }
  }

  tbControls.update();

  // Make sunlight follow camera slightly to ensure view is always lit
  sunLight.position.copy(camera.position).add(new THREE.Vector3(100, 100, 100));

  renderer.render(scene, camera);
})();

// Throttled hover check function
function performHoverCheck(event) {
  if (event.target.closest('.glass') || event.target.closest('.search-container')) {
    satelliteManager.setHovered(-1);
    document.body.classList.remove('hovering-satellite');
    hoverLabel.style.display = 'none';
    return;
  }

  // Reuse mouse vector to avoid allocations
  reusedMouse.set(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );

  const hoveredIndex = satelliteManager.checkHover(reusedMouse, camera);
  satelliteManager.setHovered(hoveredIndex);

  if (hoveredIndex >= 0) {
    document.body.classList.add('hovering-satellite');

    const hoveredSat = satelliteManager.getSatelliteData(hoveredIndex);
    const hoveredPos = satelliteManager.getPosition(hoveredIndex);
    if (hoveredSat && hoveredPos) {
      // Anchor hover label to the hovered satellite's screen projection
      const worldPos = hoveredPos.clone().applyMatrix4(Globe.matrixWorld);
      const projected = worldPos.clone().project(camera);

      if (projected.z > -1 && projected.z < 1) {
        const screenX = (projected.x * 0.5 + 0.5) * window.innerWidth;
        const screenY = (-projected.y * 0.5 + 0.5) * window.innerHeight;
        hoverLabel.textContent = hoveredSat[1];
        hoverLabel.style.display = 'block';
        hoverLabel.style.transform = `translate(${screenX + 12}px, ${screenY + 12}px)`;
      } else {
        hoverLabel.style.display = 'none';
      }
    } else {
      hoverLabel.style.display = 'none';
    }
  } else {
    document.body.classList.remove('hovering-satellite');
    hoverLabel.style.display = 'none';
  }
  hoverCheckScheduled = false;
}

// Mouse move for hover detection (throttled)
window.addEventListener('mousemove', (event) => {
  // Throttle hover checks to ~60Hz max using requestAnimationFrame
  if (!hoverCheckScheduled) {
    hoverCheckScheduled = true;
    requestAnimationFrame(() => performHoverCheck(event));
  }
});

window.addEventListener('mouseleave', () => {
  satelliteManager.setHovered(-1);
  document.body.classList.remove('hovering-satellite');
  hoverLabel.style.display = 'none';
});

// Interaction - Click to select satellite
window.addEventListener('click', async (event) => {
  if (event.target.closest('.glass') || event.target.closest('.search-container')) return;

  // Reuse mouse vector to avoid allocations
  reusedMouse.set(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );

  // Check if clicking on a satellite from the satellite manager
  const clickedIndex = satelliteManager.checkHover(reusedMouse, camera);
  if (clickedIndex >= 0) {
    selectSatellite(clickedIndex);
    return;
  }
});

// Controls Listeners
document.getElementById('speed-slider').addEventListener('input', (e) => {
  const timeScale = parseInt(e.target.value);
  updateState({ timeScale });
  document.getElementById('speed-value').textContent = timeScale;
});

document.getElementById('pause-btn').addEventListener('click', () => {
  const isPaused = !state.isPaused;
  updateState({ isPaused });
  document.getElementById('pause-icon').textContent = isPaused ? '▶' : '⏸';
  document.getElementById('pause-btn').classList.toggle('active', isPaused);
});

document.getElementById('reset-btn').addEventListener('click', () => {
  updateState({ currentTime: new Date() });
});

document.getElementById('camera-selector').addEventListener('click', (e) => {
  const option = e.target.closest('.selector-option');
  if (!option) return;

  document.querySelectorAll('#camera-selector .selector-option').forEach(el => el.classList.remove('active'));
  option.classList.add('active');
  const cameraMode = option.dataset.mode;
  updateState({ cameraMode });

  if (cameraMode === 'FREE') {
    tbControls.target.set(0, 0, 0);
  }
});

// Auto Survey Logic
let autoSurveyTimer = null;
function runAutoSurvey() {
  if (!state.autoSurvey) return;

  const count = satelliteManager.count;
  if (count > 0) {
    const randomIndex = Math.floor(Math.random() * count);
    selectSatellite(randomIndex);
  }

  // Next jump in 10-15 seconds
  const nextDelay = 10000 + Math.random() * 5000;
  autoSurveyTimer = setTimeout(runAutoSurvey, nextDelay);
}

document.getElementById('auto-survey-btn').addEventListener('click', (e) => {
  const active = !state.autoSurvey;
  updateState({ autoSurvey: active });

  const btn = e.currentTarget;
  btn.classList.toggle('status-on', active);
  trackingCard.style.display = active ? 'flex' : 'none';

  if (active) {
    runAutoSurvey();
  } else {
    if (autoSurveyTimer) clearTimeout(autoSurveyTimer);
  }
});

document.getElementById('demo-btn').addEventListener('click', () => {
  if (state.demoMode) return;
  updateState({ demoMode: true });
  initDemo(camera, tbControls, satelliteManager, selectSatellite);
});

document.getElementById('more-options-btn').addEventListener('click', (e) => {
  const panel = document.getElementById('controls');
  const isCollapsed = panel.classList.contains('collapsed');
  panel.classList.toggle('collapsed', !isCollapsed);
  e.currentTarget.classList.toggle('status-on', isCollapsed);
});

// Zoom Controls Listeners
document.getElementById('zoom-slider').addEventListener('input', (e) => {
  const value = parseInt(e.target.value);
  const minDist = 105;
  const maxDist = 2000;
  // Inverted logic: Higher value (Top) = Closer (Zoom In)
  const newDist = maxDist - (maxDist - minDist) * (value / 100);
  camera.position.normalize().multiplyScalar(newDist);
  document.getElementById('zoom-value').textContent = value;
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
  const meshMode = option.dataset.mesh;
  updateState({ meshMode });
  Globe.globeImageUrl(MESHES[meshMode]);
});

// Track Single Listener
document.getElementById('track-single-btn').addEventListener('click', () => {
  updateState({ cameraMode: 'FOLLOW' });
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
  updateState({ viewMode });

  if (viewMode === 'earth') {
    // Earth View - center on Earth
    tbControls.target.set(0, 0, 0);
    const currentDist = camera.position.length();
    camera.position.set(0, 0, Math.max(currentDist, 400));
    updateState({ cameraMode: 'FREE' });
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

        updateState({ cameraMode: 'FOLLOW' });
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
    const prevSelected = satelliteManager.getSelected();

    // Toggle orbit off if clicking the same selected satellite again
    if (prevSelected === index && state.orbitVisible) {
      updateState({ orbitVisible: false });
      const orbitLine = Globe.getObjectByName('orbitLine');
      if (orbitLine) Globe.remove(orbitLine);

      // Clear URL parameter
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    satelliteManager.setSelected(index);
    updateState({ orbitVisible: true });

    // Get satellite data
    const satData = satelliteManager.getSatelliteData(index);
    if (satData) {
      // Update URL parameter
      const name = satData[1];
      const newUrl = `${window.location.pathname}?select=${encodeURIComponent(name)}`;
      window.history.replaceState({ path: newUrl }, '', newUrl);

      // Initial info update (will be updated live in loop)
      updateInfoBox(infoBox, satData);

      // Calculate and draw orbit arc
      try {
        const orbitPoints = await satelliteManager.calculateOrbitPath(satData, Globe, state.currentTime);
        drawOrbitPath(orbitPoints, true);
      } catch (err) {
        console.error('Failed to calculate orbit:', err);
        updateState({ orbitVisible: false });
      }
    }

    // Animate camera to selected satellite
    setTimeout(() => {
      const satPos = satelliteManager.getSelectedPosition();
      if (satPos) {
        const globalPos = satPos.clone();
        globalPos.applyMatrix4(Globe.matrixWorld);

        // Calculate target camera position at an angle (not directly above)
        const normal = globalPos.clone().normalize();
        const distance = 80;

        // Create offset: move outward along normal, then add tangential offset for angled view
        const tangent = new THREE.Vector3(-normal.y, normal.x, 0).normalize();
        const newCameraPos = globalPos.clone()
          .add(normal.multiplyScalar(distance * 0.6)) // Reduced outward distance
          .add(tangent.multiplyScalar(distance * 0.5)); // Add side offset

        // Start camera animation
        state.cameraAnimation = {
          active: true,
          startPos: camera.position.clone(),
          endPos: newCameraPos,
          startTarget: tbControls.target.clone(),
          endTarget: globalPos.clone(),
          progress: 0,
          duration: 1.2
        };
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
