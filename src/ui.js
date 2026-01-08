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

  // Orbit Legend
  const orbitLegend = document.createElement('div');
  orbitLegend.id = 'orbit-legend';
  orbitLegend.className = 'glass';
  orbitLegend.innerHTML = `
    <div class="legend-item"><span class="dot leo"></span> LEO (Low)</div>
    <div class="legend-item"><span class="dot meo"></span> MEO (Mid)</div>
    <div class="legend-item"><span class="dot heo"></span> HEO (High)</div>
    <div class="legend-item"><span class="dot starlink"></span> Starlink</div>
  `;
  document.body.appendChild(orbitLegend);

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

  // Top Left Controls Container
  const topLeftControls = document.createElement('div');
  topLeftControls.id = 'top-left-controls';
  document.body.appendChild(topLeftControls);

  // GitHub Button
  const githubButton = document.createElement('button');
  githubButton.id = 'github-link';
  githubButton.className = 'glass-icon-btn';
  githubButton.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
    </svg>
  `;
  githubButton.title = 'View Source on GitHub';
  githubButton.addEventListener('click', () => {
    window.open('https://github.com/the-dezeray/sat2', '_blank', 'noopener,noreferrer');
  });
  topLeftControls.appendChild(githubButton);

  // Contact Button
  const contactButton = document.createElement('button');
  contactButton.id = 'contact-btn';
  contactButton.innerHTML = `
    <span class="contact-icon">></span>
    <span class="contact-text">get in touch</span>
  `;
  contactButton.title = 'Contact me';
  topLeftControls.appendChild(contactButton);

  // Contact Card
  const contactCard = document.createElement('div');
  contactCard.id = 'contact-card';
  contactCard.className = 'glass contact-card-hidden';
  contactCard.innerHTML = `
    <div class="contact-card-header">
      <h3>Let's Connect</h3>
      <button class="close-contact-card">&times;</button>
    </div>
    <div class="contact-links">
      <a href="mailto:chingwaru.desiree@gmail.com" class="contact-link-item">
        <span class="link-icon">📧</span>
        <div class="link-info">
          <span class="link-label">Gmail</span>
          <span class="link-value">chingwaru.desiree@gmail.com</span>
        </div>
      </a>
      <a href="https://www.linkedin.com/in/desiree-chingwaru-294747248/" target="_blank" class="contact-link-item">
        <span class="link-icon">🔗</span>
        <div class="link-info">
          <span class="link-label">LinkedIn</span>
          <span class="link-value">Desiree Chingwaru</span>
        </div>
      </a>
      <a href="https://www.dezeray.me/" target="_blank" class="contact-link-item">
        <span class="link-icon">🌐</span>
        <div class="link-info">
          <span class="link-label">Portfolio</span>
          <span class="link-value">dezeray.me</span>
        </div>
      </a>
    </div>
  `;
  document.body.appendChild(contactCard);

  // Contact Button Interaction
  contactButton.addEventListener('click', () => {
    contactCard.classList.toggle('contact-card-hidden');
    contactCard.classList.toggle('contact-card-visible');
  });

  contactCard.querySelector('.close-contact-card').addEventListener('click', () => {
    contactCard.classList.add('contact-card-hidden');
    contactCard.classList.remove('contact-card-visible');
  });

  // Version Info
  const versionBadge = document.createElement('div');
  versionBadge.id = 'version-badge';
  versionBadge.innerHTML = `MOPHI <span class="version-num">v0.0.0</span>`;
  document.body.appendChild(versionBadge);

  return {
    timeLogger,
    searchContainer,
    infoBox,
    hoverLabel,
    zoomControls,
    actionButtons,
    viewModeSelector,
    orbitLegend,
    controlsPanel,
    trackingCard,
    contactCard,
    versionBadge
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
