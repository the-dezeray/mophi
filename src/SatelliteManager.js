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
    }

    async init() {
        // 1. Load Data
        try {
            const response = await fetch('/minified.json');
            const data = await response.json();
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
    }
}
