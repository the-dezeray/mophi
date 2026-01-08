import * as THREE from 'three';
import * as satellite from 'satellite.js';

export class SatelliteManager {
    constructor(globe) {
        this.globe = globe;
        this.mesh = null;
        this.worker = null;
        this.count = 0;
        this.dummy = new THREE.Object3D();
        this.isReady = false;
        this.lastUpdateTime = 0;
        this.updateInterval = 50; // 20Hz for smooth motion
        this.pendingUpdate = false;
        this.satelliteData = [];
        this.hoveredIndex = -1;
        this.selectedIndex = -1;
        this.raycaster = new THREE.Raycaster();
        this.lastScale = 1;
        this.onReadyCallback = null;

        // Reusable objects for performance
        this._tempV1 = new THREE.Vector3();
        this._tempV2 = new THREE.Vector3();
        this._tempColor = new THREE.Color();
    }

    updateLoadingProgress(percentage, text) {
        const percentageEl = document.querySelector('.loading-percentage');
        const textEl = document.querySelector('.loading-text');
        if (percentageEl) percentageEl.textContent = `${percentage}%`;
        if (textEl && text) textEl.textContent = text;
    }

    async init() {
        // 1. Load Data
        try {
            this.updateLoadingProgress(10, 'Fetching satellite data...');
            const response = await fetch('./minified.json');
            this.updateLoadingProgress(30, 'Parsing satellite database...');
            const data = await response.json();
            this.satelliteData = data;
            this.count = data.length;
            console.log(`Loaded ${this.count} satellites.`);
            this.updateLoadingProgress(50, 'Creating 3D instances...');

            // 2. Create InstancedMesh
            // Increased size for visibility
            const geometry = new THREE.IcosahedronGeometry(0.8, 1);

            const material = new THREE.MeshBasicMaterial({ color: 0xffffff }); // White for max visibility
            this.mesh = new THREE.InstancedMesh(geometry, material, this.count);

            // Set colors based on orbit
            const color = new THREE.Color();
            for (let i = 0; i < this.count; i++) {
                const item = this.satelliteData[i];
                // item format: [id, name, epoch_unix, incl, raan, ecc, argp, ma, mm, bstar]
                const mm = item[8]; // Mean Motion

                if (mm >= 11.25) {
                    color.setHex(0xffffff); // LEO - Green
                } else if (mm > 1.0027) {
                    color.setHex(0xffff00); // MEO - Yellow
                } else {
                    color.setHex(0xff0000); // HEO - Red
                }
                this.mesh.setColorAt(i, color);
            }
            this.mesh.instanceColor.needsUpdate = true;

            this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            this.mesh.frustumCulled = false; // Prevent culling issues
            this.globe.add(this.mesh);
            this.updateLoadingProgress(70, 'Initializing worker thread...');

            // 3. Init Worker
            this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

            this.worker.onmessage = (e) => {
                const { type, positions, count } = e.data;
                if (type === 'ready') {
                    this.isReady = true;
                    console.log('Worker ready');
                    this.updateLoadingProgress(100, 'Ready!');
                    if (this.onReadyCallback) this.onReadyCallback();
                } else if (type === 'update') {
                    this.updateMesh(positions);
                    this.pendingUpdate = false;
                }
            };

            // Send data to worker
            this.worker.postMessage({ type: 'init', data });

        } catch (err) {
            console.error('Error initializing satellites:', err);
        }
    }

    update(date) {
        if (!this.isReady || this.pendingUpdate) return;

        // Throttle updates to respect updateInterval (default 50ms = 20Hz for smooth motion)
        const now = Date.now();
        if (now - this.lastUpdateTime < this.updateInterval) return;

        // Send update request to worker
        this.worker.postMessage({ type: 'update', date: date.getTime() });
        this.pendingUpdate = true;
        this.lastUpdateTime = now;
    }

    updateMesh(positions) {
        const EARTH_RADIUS_KM = 6371;
        const GLOBE_RADIUS = 100;
        const SCALE = GLOBE_RADIUS / EARTH_RADIUS_KM;
        let validCount = 0;
        this.currentPositions = positions;
        const currentScale = this.lastScale || 1;

        for (let i = 0; i < this.count; i++) {
            const x = positions[i * 3];
            const y = positions[i * 3 + 1];
            const z = positions[i * 3 + 2];

            if (x === 0 && y === 0 && z === 0 || isNaN(x) || isNaN(y) || isNaN(z)) {
                this.dummy.position.set(0, 0, 0);
                this.dummy.scale.set(0, 0, 0);
            } else {
                validCount++;
                // Axis Mapping:
                // Satellite (ECF): X=PrimeMeridian, Z=North, Y=90E
                // ThreeGlobe: Z=PrimeMeridian, Y=North, X=90E

                const threeX = y * SCALE;
                const threeY = z * SCALE;
                const threeZ = x * SCALE;

                this.dummy.position.set(threeX, threeY, threeZ);
                this.dummy.scale.set(currentScale, currentScale, currentScale);
                this.dummy.lookAt(0, 0, 0);
            }

            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        this.mesh.instanceMatrix.needsUpdate = true;
        if (validCount === 0) console.warn('No valid satellites updated!');
        else if (Math.random() < 0.01) console.log(`Updated ${validCount} satellites`);
    }

    updateSatelliteScale(camera) {
        if (!this.mesh || !this.currentPositions) return;

        const SAT_REFERENCE_CAMERA_DISTANCE = 800;
        const SAT_WORLD_RADIUS_AT_REFERENCE = 0.6;
        const SAT_WORLD_RADIUS_MIN = 0.2;
        const SAT_WORLD_RADIUS_MAX = 1.5;

        const cameraDistance = camera.position.length();
        const worldRadius = THREE.MathUtils.clamp(
            (cameraDistance / SAT_REFERENCE_CAMERA_DISTANCE) * SAT_WORLD_RADIUS_AT_REFERENCE,
            SAT_WORLD_RADIUS_MIN,
            SAT_WORLD_RADIUS_MAX
        );

        if (Math.abs(this.lastScale - worldRadius) < 0.0001) return;
        this.lastScale = worldRadius;

        this.updateMesh(this.currentPositions);
    }

    updateColors() {
        if (!this.mesh) return;

        for (let i = 0; i < this.count; i++) {
            this._updateSingleColorInternal(i);
        }

        if (this.mesh.instanceColor) {
            this.mesh.instanceColor.needsUpdate = true;
        }
    }

    _updateSingleColorInternal(index) {
        if (index === this.selectedIndex || index === this.hoveredIndex) {
            this._tempColor.setHex(0x00ff00); // Green for selected/hovered
        } else {
            const item = this.satelliteData[index];
            const name = item[1] || '';
            const mm = item[8]; // Mean Motion

            if (name.includes('STARLINK')) {
                this._tempColor.setHex(0xbbbbff); // Premium Purple for Starlink
            } else if (mm >= 11.25) {
                this._tempColor.setHex(0xffffff); // LEO - White
            } else if (mm > 1.0027) {
                this._tempColor.setHex(0xffff00); // MEO - Yellow
            } else {
                this._tempColor.setHex(0xff0000); // HEO - Red
            }
        }
        this.mesh.setColorAt(index, this._tempColor);
    }

    updateSingleSatelliteColor(index) {
        if (!this.mesh || index < 0 || index >= this.count) return;
        this._updateSingleColorInternal(index);
        if (this.mesh.instanceColor) {
            this.mesh.instanceColor.needsUpdate = true;
        }
    }

    checkHover(mouse, camera) {
        if (!this.mesh || !this.isReady || !this.currentPositions) return -1;

        this.raycaster.setFromCamera(mouse, camera);
        const ray = this.raycaster.ray;

        let closestIndex = -1;
        let minDistanceToRay = Infinity;

        const cameraDist = camera.position.length();
        // Threshold increases with zoom distance for better UX
        const threshold = (cameraDist / 800) * 4;

        const EARTH_RADIUS_KM = 6371;
        const GLOBE_RADIUS = 100;
        const SCALE = GLOBE_RADIUS / EARTH_RADIUS_KM;

        // Optimization: Pre-calculate some values for occlusion check
        const camPos = camera.position;
        const earthCenter = new THREE.Vector3(0, 0, 0);
        const earthRadiusSq = 100 * 100;

        for (let i = 0; i < this.count; i++) {
            const x = this.currentPositions[i * 3];
            const y = this.currentPositions[i * 3 + 1];
            const z = this.currentPositions[i * 3 + 2];
            if (x === 0 && y === 0 && z === 0) continue;

            // Transformed position
            this._tempV1.set(y * SCALE, z * SCALE, x * SCALE);

            // 1. Is it behind the camera?
            this._tempV2.subVectors(this._tempV1, ray.origin);
            if (this._tempV2.dot(ray.direction) < 0) continue;

            // 2. Distance to ray
            const distToRay = ray.distanceToPoint(this._tempV1);

            if (distToRay < threshold) {
                // 3. Occlusion Check: Simple Sphere/Point visibility
                // A satellite is hidden if the globe is between it and camera
                const dot = this._tempV1.dot(camPos);
                if (dot < 0) {
                    // Check if it's behind the horizon
                    // Mathematically, if angle between Cam->Center and Cam->Sat is large, 
                    // it might be occluded. 
                    // Simpler: if it's on the other side of the planet (dot < 0), skip.
                    continue;
                }

                if (distToRay < minDistanceToRay) {
                    minDistanceToRay = distToRay;
                    closestIndex = i;
                }
            }
        }

        return closestIndex;
    }

    setHovered(index) {
        if (this.hoveredIndex !== index) {
            const prevHovered = this.hoveredIndex;
            this.hoveredIndex = index;

            if (prevHovered >= 0) this.updateSingleSatelliteColor(prevHovered);
            if (this.hoveredIndex >= 0) this.updateSingleSatelliteColor(this.hoveredIndex);
        }
    }

    setSelected(index) {
        if (this.selectedIndex !== index) {
            const prevSelected = this.selectedIndex;
            this.selectedIndex = index;

            if (prevSelected >= 0) this.updateSingleSatelliteColor(prevSelected);
            if (this.selectedIndex >= 0) this.updateSingleSatelliteColor(this.selectedIndex);
        }
    }

    getSelected() {
        return this.selectedIndex;
    }

    getHovered() {
        return this.hoveredIndex;
    }

    getSatelliteData(index) {
        if (index >= 0 && index < this.satelliteData.length) {
            return this.satelliteData[index];
        }
        return null;
    }

    searchSatellite(query) {
        const lowerQuery = query.toLowerCase();
        for (let i = 0; i < this.satelliteData.length; i++) {
            const sat = this.satelliteData[i];
            const id = String(sat[0]);
            const name = String(sat[1]).toLowerCase();

            if (id === query || name.includes(lowerQuery)) {
                return i;
            }
        }
        return -1;
    }

    searchSatellites(query, limit = 5) {
        const lowerQuery = query.toLowerCase();
        const results = [];

        for (let i = 0; i < this.satelliteData.length; i++) {
            if (results.length >= limit) break;

            const sat = this.satelliteData[i];
            const id = String(sat[0]);
            const name = String(sat[1]).toLowerCase();

            if (id.includes(lowerQuery) || name.includes(lowerQuery)) {
                results.push({
                    index: i,
                    id: sat[0],
                    name: sat[1]
                });
            }
        }
        return results;
    }

    getSatrec(index) {
        if (index < 0 || index >= this.satelliteData.length) return null;

        const satellite = this.satelliteData[index];
        // satellite data format: [id, name, epoch, i, o, e, p, m, n, b]
        const epoch = satellite[2];
        const inclination = satellite[3];
        const raan = satellite[4];
        const eccentricity = satellite[5];
        const argOfPerigee = satellite[6];
        const meanAnomaly = satellite[7];
        const meanMotion = satellite[8];
        const bstar = satellite[9];

        // Create satrec manually
        return {
            no: meanMotion * (2 * Math.PI / 1440),
            inclo: inclination * (Math.PI / 180),
            nodeo: raan * (Math.PI / 180),
            ecco: eccentricity,
            argpo: argOfPerigee * (Math.PI / 180),
            mo: meanAnomaly * (Math.PI / 180),
            bstar: bstar,
            epochyr: new Date(epoch * 1000).getUTCFullYear() % 100,
            epochdays: this.getDayOfYear(new Date(epoch * 1000)),
            jdsatepoch: (epoch / 86400.0) + 2440587.5 // Approximate JD from unix timestamp
        };
    }


    getPosition(index) {
        if (index < 0 || index >= this.count || !this.currentPositions) return null;

        const EARTH_RADIUS_KM = 6371;
        const GLOBE_RADIUS = 100;
        const SCALE = GLOBE_RADIUS / EARTH_RADIUS_KM;

        const x = this.currentPositions[index * 3];
        const y = this.currentPositions[index * 3 + 1];
        const z = this.currentPositions[index * 3 + 2];

        if (x === 0 && y === 0 && z === 0) return null;

        const threeX = y * SCALE;
        const threeY = z * SCALE;
        const threeZ = x * SCALE;

        return new THREE.Vector3(threeX, threeY, threeZ);
    }

    getSelectedPosition() {
        return this.getPosition(this.selectedIndex);
    }

    async calculateOrbitPath(satData, globe, currentTime, numPoints = 100) {
        const points = [];

        const satrec = this.createSatRecFromData(satData);
        const meanMotion = satData[8];

        const periodMinutes = 1440 / meanMotion;
        const periodMs = periodMinutes * 60 * 1000;
        const EARTH_RADIUS_KM = 6371;

        for (let i = 0; i <= numPoints; i++) {
            const time = new Date(currentTime.getTime() + (periodMs / numPoints) * i);
            const gmst = satellite.gstime(time);
            const positionAndVelocity = satellite.propagate(satrec, time);
            const positionEci = positionAndVelocity.position;

            if (positionEci && typeof positionEci.x === 'number') {
                const gdPos = satellite.eciToGeodetic(positionEci, gmst);
                const lat = satellite.radiansToDegrees(gdPos.latitude);
                const lng = satellite.radiansToDegrees(gdPos.longitude);
                const alt = gdPos.height / EARTH_RADIUS_KM;

                const coords = globe.getCoords(lat, lng, alt);
                if (coords) points.push(new THREE.Vector3(coords.x, coords.y, coords.z));
            }
        }

        return points;
    }

    getDayOfYear(date) {
        const start = new Date(date.getFullYear(), 0, 0);
        const diff = date - start;
        const oneDay = 1000 * 60 * 60 * 24;
        return Math.floor(diff / oneDay);
    }

    createSatRecFromData(data) {
        // data: [id, name, epoch_unix, incl, raan, ecc, argp, ma, mm, bstar]
        const [id, _name, epochUnix, incl, raan, ecc, argp, ma, mm, _bstar] = data;

        const f = (n, w, d) => Number(n).toFixed(d).padStart(w, ' ');
        const i = (n, w) => String(Math.trunc(Number(n))).padStart(w, '0');

        const date = new Date(epochUnix * 1000);
        const yearFull = date.getUTCFullYear();
        const year = yearFull % 100;
        const startOfYear = new Date(Date.UTC(yearFull, 0, 0));
        const diff = date - startOfYear;
        const oneDay = 1000 * 60 * 60 * 24;
        const dayOfYear = diff / oneDay;

        // Keep BSTAR as 0 for stability (matches worker.js)
        const bstarStr = '00000-0';

        const line1Body = `1 ${i(id, 5)}U 00000A   ${i(year, 2)}${f(dayOfYear, 12, 8)}  .00000000  00000-0  ${bstarStr} 0  999`;
        const line1 = line1Body + this.computeChecksum(line1Body);

        const eccStr = f(ecc, 9, 7).replace('0.', '').substring(0, 7);
        const line2Body = `2 ${i(id, 5)} ${f(incl, 8, 4)} ${f(raan, 8, 4)} ${eccStr} ${f(argp, 8, 4)} ${f(ma, 8, 4)} ${f(mm, 11, 8)}00001`;
        const line2 = line2Body + this.computeChecksum(line2Body);

        return satellite.twoline2satrec(line1, line2);
    }

    getLiveStats(index) {
        if (index < 0 || index >= this.count || !this.currentPositions) return null;

        const EARTH_RADIUS_KM = 6371;
        const x = this.currentPositions[index * 3];
        const y = this.currentPositions[index * 3 + 1];
        const z = this.currentPositions[index * 3 + 2];

        if (x === 0 && y === 0 && z === 0) return null;

        // ECF to Geodetic
        const lng = Math.atan2(y, x) * (180 / Math.PI);
        const hypot = Math.sqrt(x * x + y * y);
        const lat = Math.atan2(z, hypot) * (180 / Math.PI);
        const alt = Math.sqrt(x * x + y * y + z * z) - EARTH_RADIUS_KM;

        return {
            lat,
            lng,
            alt,
            x, y, z
        };
    }

    computeChecksum(line) {
        let sum = 0;
        for (let idx = 0; idx < line.length; idx++) {
            const char = line[idx];
            if (char >= '0' && char <= '9') sum += parseInt(char, 10);
            else if (char === '-') sum += 1;
        }
        return sum % 10;
    }
}
