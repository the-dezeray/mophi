export function createUI(handlers, demoEnabled = true) {
  // Time Logger
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

  // Info Box
  const infoBox = document.createElement('div');
  infoBox.id = 'sat-info';
  infoBox.className = 'glass';
  document.body.appendChild(infoBox);

  // Hover label
  const hoverLabel = document.createElement('div');
  hoverLabel.id = 'sat-hover-label';
  hoverLabel.className = 'glass';
  hoverLabel.style.display = 'none';
  document.body.appendChild(hoverLabel);

  // Zoom Controls
  const zoomControls = document.createElement('div');
  zoomControls.id = 'zoom-controls';
  zoomControls.className = 'glass';
  zoomControls.innerHTML = `
    <div class="control-item">
      <span class="control-label-text">Zoom</span>
      <input type="range" id="zoom-slider" min="0" max="100" value="63" step="1">
      <span class="value-badge" id="zoom-value">63</span>
    </div>
  `;
  document.body.appendChild(zoomControls);

  // Action Buttons
  const actionButtons = document.createElement('div');
  actionButtons.id = 'action-buttons';
  actionButtons.className = 'glass';
  actionButtons.innerHTML = `
    <button id="track-single-btn" title="Track Satellite">🎯</button>
    <button id="pause-btn" title="Play/Pause">
      <span id="pause-icon">⏸</span>
    </button>
    <button id="reset-btn" title="Reset Time">↻</button>
    <button id="auto-survey-btn" title="Auto Survey Mode">🎥</button>
    <button id="demo-btn" title="Run Demo Sequence" style="${demoEnabled ? '' : 'display: none;'}">🎬</button>
    <button id="more-options-btn" title="More Options">⚙️</button>
  `;
  document.body.appendChild(actionButtons);

  // View Mode Selector
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

  // Orbit Legend (removed for a cleaner, more mobile-friendly UI)

  // Main Controls Panel
  const controlsPanel = document.createElement('div');
  controlsPanel.id = 'controls';
  controlsPanel.className = 'glass collapsed';
  controlsPanel.innerHTML = `
    <div class="control-item">
      <span class="control-label-text">Scale</span>
      <input type="range" id="speed-slider" min="1" max="200" value="1" step="1">
      <span class="value-badge" id="speed-value">1</span>
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

  // Tracking Card
  const trackingCard = document.createElement('div');
  trackingCard.id = 'tracking-card';
  trackingCard.className = 'glass';
  trackingCard.style.display = 'none';
  trackingCard.innerHTML = `
    <div class="tracking-content">
      <div class="pulse-dot"></div>
      <span class="tracking-text">TRACKING</span>
    </div>
  `;
  document.body.appendChild(trackingCard);

  // About Button - Top Left
  const aboutButton = document.createElement('button');
  aboutButton.id = 'about-text';
  aboutButton.type = 'button';
  aboutButton.textContent = 'about me';
  aboutButton.title = 'Open About';
  aboutButton.setAttribute('aria-label', 'Open about me');
  aboutButton.addEventListener('click', () => {
    window.open('https://www.dezeray.me', '_blank', 'noopener,noreferrer');
  });
  document.body.appendChild(aboutButton);

  return {
    timeLogger,
    searchContainer,
    infoBox,
    hoverLabel,
    zoomControls,
    actionButtons,
    viewModeSelector,
    controlsPanel,
    trackingCard
  };
}

export function updateInfoBox(infoBox, satData, liveData) {
  if (!satData) {
    infoBox.style.display = 'none';
    infoBox.dataset.currentSatId = '';
    return;
  }

  const isCollapsed = infoBox.classList.contains('collapsed');

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

  // If it's a different satellite, rebuild the whole structure
  if (infoBox.dataset.currentSatId !== id.toString()) {
    infoBox.dataset.currentSatId = id.toString();
    infoBox.classList.toggle('collapsed', isCollapsed);
    infoBox.innerHTML = `
      <div class="info-header">
        <div class="status-dot"></div>
        <span class="info-title">Satellite Telemetry</span>
        <div class="info-header-spacer"></div>
        <button
          type="button"
          class="info-minimize-btn"
          data-role="telemetry-minimize"
          aria-label="${isCollapsed ? 'Expand telemetry' : 'Minimize telemetry'}"
          title="${isCollapsed ? 'Expand' : 'Minimize'}"
        >${isCollapsed ? '▸' : '▾'}</button>
      </div>
      <div class="info-grid">
        <div class="info-field full-width">
          <span class="field-label">Name</span>
          <span class="field-value" id="val-name" style="font-size: 14px; color: var(--accent-primary);">${name}</span>
        </div>
        
        <div id="live-fields" style="display: ${liveData ? 'contents' : 'none'}">
          <div class="info-field active-field">
            <span class="field-label" style="color: #10b981;">Latitude</span>
            <span class="field-value active" id="val-lat">--</span>
          </div>
          <div class="info-field active-field">
            <span class="field-label" style="color: #10b981;">Longitude</span>
            <span class="field-value active" id="val-lng">--</span>
          </div>
          <div class="info-field active-field">
            <span class="field-label" style="color: #10b981;">Altitude</span>
            <span class="field-value active" id="val-alt">--</span>
          </div>
          <div class="info-field">
            <span class="field-label">ECC_KM (X,Y,Z)</span>
            <span class="field-value" id="val-xyz">--</span>
          </div>
        </div>

        <div class="info-field">
          <span class="field-label">NORAD ID</span>
          <span class="field-value">${id}</span>
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

    const minimizeBtn = infoBox.querySelector('[data-role="telemetry-minimize"]');
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => {
        const nextCollapsed = !infoBox.classList.contains('collapsed');
        infoBox.classList.toggle('collapsed', nextCollapsed);
        minimizeBtn.textContent = nextCollapsed ? '▸' : '▾';
        minimizeBtn.setAttribute('aria-label', nextCollapsed ? 'Expand telemetry' : 'Minimize telemetry');
        minimizeBtn.title = nextCollapsed ? 'Expand' : 'Minimize';
      });
    }
  }

  // Update live values
  if (liveData) {
    document.getElementById('live-fields').style.display = 'contents';
    document.getElementById('val-lat').textContent = `${liveData.lat.toFixed(4)}°`;
    document.getElementById('val-lng').textContent = `${liveData.lng.toFixed(4)}°`;
    document.getElementById('val-alt').textContent = `${liveData.alt.toFixed(2)} km`;
    document.getElementById('val-xyz').textContent = `${Math.round(liveData.x)},${Math.round(liveData.y)},${Math.round(liveData.z)}`;
  } else {
    document.getElementById('live-fields').style.display = 'none';
  }
}
