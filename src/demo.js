import * as THREE from 'three';
import { state, updateState } from './state.js';

/**
 * Demo Sequence Manager
 * Handles the intro animation: Rotating, Zooming In, Zooming Out, and Focused Observation.
 */
export function initDemo(camera, controls, satelliteManager, selectSatelliteFn) {
    let phase = 0;
    const startTime = Date.now();

    console.log('--- DEMO SEQUENCE INITIATED ---');

    function runPhase() {
        if (!state.demoMode) return;

        const elapsed = (Date.now() - startTime) / 1000;

        // Phase 1: Deep Space Approach (0s - 8s) - Starting further away
        if (elapsed < 8) {
            if (phase !== 1) {
                console.log('Demo Phase 1: Deep Space Approach');
                phase = 1;
            }
            // Spiral inward from 2500 back to 1500
            const progress = elapsed / 8;
            const radius = 2500 - (1000 * progress);
            const angle = progress * Math.PI * 1.5;

            camera.position.x = radius * Math.cos(angle);
            camera.position.z = radius * Math.sin(angle);
            camera.position.y = 500 * Math.sin(progress * Math.PI);
            camera.lookAt(0, 0, 0);
            controls.target.set(0, 0, 0);
        }
        // Phase 2: Orbital Jump (8s - 14s) - Focus on 'BOTSAT-1'
        else if (elapsed < 14) {
            if (phase !== 2) {
                console.log('Demo Phase 2: Orbital Jump');
                phase = 2;

                // Targeted selection: BOTSAT-1
                const botsatIndex = satelliteManager.searchSatellite('BOTSAT-1');
                if (botsatIndex >= 0) {
                    console.log('Demo: Found and selecting BOTSAT-1');
                    selectSatelliteFn(botsatIndex);
                } else {
                    // Fallback if not found
                    const count = satelliteManager.count;
                    if (count > 0) {
                        const randomIndex = Math.floor(Math.random() * count);
                        selectSatelliteFn(randomIndex);
                    }
                }
            }
        }
        // Phase 3: High-Altitude Sweep (14s - 22s) - Pan globe at distance
        else if (elapsed < 22) {
            if (phase !== 3) {
                console.log('Demo Phase 3: High-Altitude Sweep');
                phase = 3;

                const startPos = camera.position.clone();
                const endPos = new THREE.Vector3(-1200, 800, 1200);
                const startTarget = controls.target.clone();
                const endTarget = new THREE.Vector3(0, 0, 0);

                updateState({
                    cameraAnimation: {
                        active: true,
                        startPos,
                        endPos,
                        startTarget,
                        endTarget,
                        progress: 0,
                        duration: 8
                    }
                });
            }
        }
        // Phase 4: Nadir View Transition (22s - 28s) - Top-down look
        else if (elapsed < 28) {
            if (phase !== 4) {
                console.log('Demo Phase 4: Polar Observation');
                phase = 4;

                const startPos = camera.position.clone();
                const endPos = new THREE.Vector3(0, 2000, 0);
                const startTarget = controls.target.clone();
                const endTarget = new THREE.Vector3(0, 0, 0);

                updateState({
                    cameraAnimation: {
                        active: true,
                        startPos,
                        endPos,
                        startTarget,
                        endTarget,
                        progress: 0,
                        duration: 6
                    }
                });
            }
        }
        // Phase 5: Constellation Expansion (28s - 34s) - View total swarm
        else if (elapsed < 34) {
            if (phase !== 5) {
                console.log('Demo Phase 5: Constellation Expansion');
                phase = 5;

                const startPos = camera.position.clone();
                const endPos = new THREE.Vector3(3000, 1000, 3000);

                updateState({
                    cameraAnimation: {
                        active: true,
                        startPos,
                        endPos,
                        startTarget: controls.target.clone(),
                        endTarget: new THREE.Vector3(0, 0, 0),
                        progress: 0,
                        duration: 6
                    }
                });
            }
        }
        // Phase 6: Final Descent (34s - 40s) - Return to Earth view
        else if (elapsed < 40) {
            if (phase !== 6) {
                console.log('Demo Phase 6: Final Descent');
                phase = 6;

                const startPos = camera.position.clone();
                const endPos = new THREE.Vector3(0, 0, 800);
                const startTarget = controls.target.clone();
                const endTarget = new THREE.Vector3(0, 0, 0);

                updateState({
                    cameraAnimation: {
                        active: true,
                        startPos,
                        endPos,
                        startTarget,
                        endTarget,
                        progress: 0,
                        duration: 6
                    }
                });
            }
        }
        // End Demo
        else {
            console.log('--- DEMO SEQUENCE COMPLETED ---');
            updateState({ demoMode: false });
            return;
        }

        requestAnimationFrame(runPhase);
    }

    runPhase();
}

