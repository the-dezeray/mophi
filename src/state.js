export const state = {
  timeScale: 1,
  currentTime: new Date(),
  isPaused: false,
  orbitVisible: false,
  cameraMode: 'FREE', // FREE, FOLLOW, NADIR
  selectedSatelliteIndex: -1,
  lastInfoUpdate: 0,
  viewMode: 'earth', // earth, satellite
  meshMode: 'marble', // marble, night, dark, gray
  autoSurvey: false,
  demoMode: false,
  // Camera animation state
  cameraAnimation: {
    active: false,
    startPos: null,
    endPos: null,
    startTarget: null,
    endTarget: null,
    progress: 0,
    duration: 1.2 // seconds
  }
};

export function updateState(updates) {
  Object.assign(state, updates);
}
