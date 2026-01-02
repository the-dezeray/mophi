import * as THREE from 'three';

export class SatelliteManager {
    constructor(globe) {
        this.globe = globe;
        this.mesh = null;
        this.worker = null;
        this.count = 0;
        this.dummy = new THREE.Object3D();
        this.isReady = false;
        this.lastUpdateTime = 0;
        this.updateInterval = 1000; 
        this.pendingUpdate = false;
        this.satelliteData = [];
        this.hoveredIndex = -1;
        this.selectedIndex = -1;
        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Points.threshold = 2;
    }

    async init() {
        // 1. Load Data
        try {
            const response = await fetch('/minified.json');
            const data = await response.json();
            this.satelliteData = data;
            this.count = data.length;
            console.log(`Loaded ${this.count} satellites.`);

            // 2. Create InstancedMesh
            // Increased size for visibility
            const geometry = new THREE.IcosahedronGeometry(0.8, 1); 
            
            const material = new THREE.MeshBasicMaterial({ color: 0xffffff }); // White for max visibility
            this.mesh = new THREE.InstancedMesh(geometry, material, this.count);
            this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            this.mesh.frustumCulled = false; // Prevent culling issues
            this.globe.add(this.mesh);

            // 3. Init Worker
            this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
            
            this.worker.onmessage = (e) => {
                const { type, positions, count } = e.data;
                if (type === 'ready') {
                    this.isReady = true;
                    console.log('Worker ready');
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

        // Send update request to worker
        this.worker.postMessage({ type: 'update', date: date.getTime() });
        this.pendingUpdate = true;
    }

    updateMesh(positions) {
        const EARTH_RADIUS_KM = 6371;
        const GLOBE_RADIUS = 100;
        const SCALE = GLOBE_RADIUS / EARTH_RADIUS_KM;
        let validCount = 0;
        this.currentPositions = positions;

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
                this.dummy.scale.set(1, 1, 1);
                this.dummy.lookAt(0, 0, 0); 
            }
            
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }
        
        this.mesh.instanceMatrix.needsUpdate = true;
        if (validCount === 0) console.warn('No valid satellites updated!');
        else if (Math.random() < 0.01) console.log(`Updated ${validCount} satellites`);
        
        // Update colors based on hover/selection
        this.updateColors();
    }

    updateColors() {
        if (!this.mesh) return;
        
        const color = new THREE.Color();
        const colors = new Float32Array(this.count * 3);
        
        for (let i = 0; i < this.count; i++) {
            if (i === this.selectedIndex) {
                color.setHex(0x00ff00); // Green for selected
            } else if (i === this.hoveredIndex) {
                color.setHex(0x00ff00); // Green for hovered
            } else {
                color.setHex(0xffffff); // White default
            }
            
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }
        
        if (!this.mesh.geometry.attributes.color) {
            this.mesh.geometry.setAttribute('color', new THREE.InstancedBufferAttribute(colors, 3));
            this.mesh.material.vertexColors = true;
        } else {
            this.mesh.geometry.attributes.color.array.set(colors);
            this.mesh.geometry.attributes.color.needsUpdate = true;
        }
    }

    checkHover(mouse, camera) {
        if (!this.mesh || !this.isReady) return -1;
        
        this.raycaster.setFromCamera(mouse, camera);
        const intersects = this.raycaster.intersectObject(this.mesh);
        
        if (intersects.length > 0) {
            return intersects[0].instanceId;
        }
        return -1;
    }

    setHovered(index) {
        if (this.hoveredIndex !== index) {
            this.hoveredIndex = index;
            this.updateColors();
        }
    }

    setSelected(index) {
        this.selectedIndex = index;
        this.updateColors();
    }

    getSelected() {
        return this.selectedIndex;
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

    getSelectedPosition() {
        if (this.selectedIndex < 0 || !this.currentPositions) return null;
        
        const EARTH_RADIUS_KM = 6371;
        const GLOBE_RADIUS = 100;
        const SCALE = GLOBE_RADIUS / EARTH_RADIUS_KM;
        
        const x = this.currentPositions[this.selectedIndex * 3];
        const y = this.currentPositions[this.selectedIndex * 3 + 1];
        const z = this.currentPositions[this.selectedIndex * 3 + 2];
        
        if (x === 0 && y === 0 && z === 0) return null;
        
        const threeX = y * SCALE;
        const threeY = z * SCALE;
        const threeZ = x * SCALE;
        
        return new THREE.Vector3(threeX, threeY, threeZ);
    }
}
