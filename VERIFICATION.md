# Satellite Tracking Verification Guide

## How to Verify Accuracy

### 1. **Orbital Period Check**
The orbital period is now displayed in the top-right corner of the screen. For BOTSAT-1:
- **Expected**: ~90-95 minutes per orbit
- **How to verify**: Watch the satellite complete one full orbit and compare the time elapsed

### 2. **Compare with Real Tracking Sites**

#### N2YO.com
- Visit: https://www.n2yo.com/?s=63216
- Compare:
  - Current latitude/longitude (click the satellite to see info)
  - Altitude
  - Ground track path

#### Heavens-Above
- Visit: https://www.heavens-above.com/
- Search for "BOTSAT-1" or catalog number 63216
- Compare position and trajectory

#### CelesTrak
- Your app fetches TLE data from: https://celestrak.org/NORAD/elements/gp.php?CATNR=63216&FORMAT=TLE
- TLE data is cached for 24 hours
- Click "Reset Time" to refresh the orbit calculation

### 3. **Visual Verification**

#### Green Orbital Path
- The **green line** shows the complete orbital trajectory
- Should form a smooth ellipse around Earth
- Path updates when you click "Reset Time"
- Toggle visibility with the "Show Orbit Path" checkbox

#### Satellite Movement
- Satellite should move smoothly along the green path
- Should complete one orbit in the displayed orbital period
- At 60x speed: ~1.5 minutes per orbit
- At 1x speed: ~90 minutes per orbit (real-time)

### 4. **Calculation Accuracy**

The app uses the **SGP4 propagator** via `satellite.js`:
- ✅ Industry-standard orbital mechanics
- ✅ Same algorithm used by NORAD/Space Force
- ✅ Accurate to within a few kilometers for LEO satellites
- ✅ TLE data updated every 24 hours

**Potential Error Sources:**
- TLE data age (older = less accurate)
- Atmospheric drag (not fully modeled in SGP4)
- Solar radiation pressure
- Gravitational perturbations

**Accuracy Range:** Typically ±5-10 km for fresh TLE data

## Using the Controls

### Speed Control
- **Range**: 1x to 500x real-time
- **Default**: 60x (recommended for observation)
- **Suggested speeds**:
  - 1x: Real-time (very slow)
  - 60x: Good for watching orbits (~1.5 min/orbit)
  - 120x: Faster observation (~45 sec/orbit)
  - 300x: Quick overview (~20 sec/orbit)

### Play/Pause
- Pause the simulation to inspect specific positions
- Time continues to display but satellite stops moving

### Reset Time
- Resets simulation to current real-time
- Recalculates orbital path from current moment
- Useful after long simulation runs

### Show Orbit Path
- Toggle the green trajectory line
- Helps verify the orbital path is correct
- Can disable for cleaner view

## Verification Checklist

- [ ] Orbital period matches expected ~90-95 minutes
- [ ] Green path forms smooth ellipse
- [ ] Satellite follows the green path
- [ ] Position roughly matches N2YO.com or Heavens-Above
- [ ] Altitude stays consistent (check info box by clicking satellite)
- [ ] TLE data is recent (check cache timestamp in browser dev tools)

## Troubleshooting

**Satellite moving too fast/slow:**
- Adjust speed slider
- Default 60x is recommended

**Path doesn't look right:**
- Click "Reset Time" to recalculate
- Check TLE data freshness (may need to clear localStorage)

**Position doesn't match tracking sites:**
- Ensure TLE data is recent
- Small differences (few km) are normal
- Large differences may indicate stale TLE data

**Green line not visible:**
- Check "Show Orbit Path" is enabled
- Line may be behind Earth - rotate view
- Zoom out to see full orbit

## Technical Details

**Coordinate Systems:**
- ECI (Earth-Centered Inertial) → internal calculations
- Geodetic (lat/lng/alt) → display and comparison
- GMST (Greenwich Mean Sidereal Time) → Earth rotation

**Propagation:**
- Uses SGP4 (Simplified General Perturbations 4)
- Accounts for Earth's oblateness (J2 perturbation)
- Models atmospheric drag
- Updates position 60 times per second

**Visualization:**
- Earth radius: 6,371 km
- Satellite sphere: 4 units (scaled for visibility)
- Altitude normalized to Earth radius for rendering
