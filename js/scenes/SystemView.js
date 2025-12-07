import * as THREE from 'three';
import { TextureFactory } from '../utils/Utils.js';
import { AtmosphereShader, StarShader, PlanetShader } from '../utils/Shaders.js';

export class SystemView {
    constructor(scene) {
        this.scene = scene;
        this.container = new THREE.Group();
        this.scene.add(this.container);

        this.container.visible = false;
        this.interactables = [];
        this.orbitAnimations = [];

        // --- SELECTION INDICATOR ---
        const ringTex = TextureFactory.createRing();
        const ringGeo = new THREE.PlaneGeometry(1, 1);
        const ringMat = new THREE.MeshBasicMaterial({
            map: ringTex,
            color: 0x00ffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.selector = new THREE.Mesh(ringGeo, ringMat);
        this.selector.rotation.x = -Math.PI / 2;
        this.selector.visible = false;
        this.container.add(this.selector);

        // --- AUDIO WAVEFORM RINGS ---
        this.waveformRings = [];
        this.waveformContainer = new THREE.Group();
        this.container.add(this.waveformContainer);

        // Create multiple expanding ring layers
        const waveformTex = TextureFactory.createWaveformRing();
        for (let i = 0; i < 5; i++) {
            const waveGeo = new THREE.PlaneGeometry(1, 1);
            const waveMat = new THREE.MeshBasicMaterial({
                map: waveformTex,
                color: new THREE.Color().setHSL(0.5 + i * 0.02, 1, 0.5),
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                visible: false
            });
            const waveRing = new THREE.Mesh(waveGeo, waveMat);
            waveRing.rotation.x = -Math.PI / 2;
            waveRing.userData.phase = i * 0.2; // Stagger the rings
            waveRing.userData.baseScale = 1;
            waveRing.visible = false;
            this.waveformRings.push(waveRing);
            this.waveformContainer.add(waveRing);
        }
        this.waveformContainer.visible = false;

        this.selectedTarget = null;
        this.activeStarMat = null;

        // Add ambient light so planets are visible even in shadows
        this.ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.container.add(this.ambientLight);
    }

    highlight(target) {
        this.selectedTarget = target;

        if (target) {
            this.selector.visible = true;

            // Determine scale based on object type size
            let baseSize = 1;
            if (target.userData.type === 'star') {
                baseSize = target.userData.data.star.radius;
            } else if (target.userData.type === 'track') {
                baseSize = target.userData.data.size * 0.4; // Correct for new scale
            }

            // The ring texture has the ring starting at ~55% from center.
            // We want the inner edge of the ring to clear the planet.
            // Planet radius = baseSize.
            // Ring Inner Radius (in texture space 0-0.5) ~= 0.27 (140/512)
            // So actual radius on a 1x1 plane is 0.27.
            // We want 0.27 * scale > baseSize * 1.1 (gap).
            // scale > (baseSize * 1.1) / 0.27 ~= baseSize * 4.

            const scale = baseSize * 5.0;
            this.selector.scale.set(scale, scale, 1);
        } else {
            this.selector.visible = false;
        }
    }

    loadAlbum(data) {
        this.clear();

        // --- STAR GENERATION ---
        if (data.star.type === 'black_hole') {
            // Black Hole Core
            const bhGeo = new THREE.SphereGeometry(data.star.radius, 32, 32);
            const bhMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
            const star = new THREE.Mesh(bhGeo, bhMat);

            // Accretion Disk Glow
            const glow = new THREE.Sprite(new THREE.SpriteMaterial({
                map: TextureFactory.createStar(null, 'black_hole'),
                color: 0xffffff,
                blending: THREE.AdditiveBlending
            }));
            glow.scale.set(data.star.radius * 8, data.star.radius * 8, 1);
            star.add(glow);

            // Accretion Ring
            const diskGeo = new THREE.RingGeometry(data.star.radius * 1.5, data.star.radius * 4, 64);
            const diskMat = new THREE.MeshBasicMaterial({ color: 0xaa00ff, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });
            const disk = new THREE.Mesh(diskGeo, diskMat);
            disk.rotation.x = Math.PI / 2;
            star.add(disk);

            star.userData = { type: 'star', data: data };
            this.container.add(star);
            this.interactables.push(star);
        } else {
            // Shader-based Star
            const starGeo = new THREE.SphereGeometry(data.star.radius, 64, 64);
            const starMat = new THREE.ShaderMaterial({
                uniforms: {
                    time: { value: 0 },
                    color: { value: new THREE.Color(data.star.color) },
                    cameraPosition: { value: new THREE.Vector3() }
                },
                vertexShader: StarShader.vertexShader,
                fragmentShader: StarShader.fragmentShader,
                side: THREE.FrontSide
            });

            const star = new THREE.Mesh(starGeo, starMat);

            // Add corona glow as separate layer
            const coronaGeo = new THREE.SphereGeometry(data.star.radius * 1.3, 32, 32);
            const coronaMat = new THREE.ShaderMaterial({
                uniforms: {
                    color: { value: new THREE.Color(data.star.color) },
                    power: { value: 3.0 },
                    intensity: { value: 0.8 }
                },
                vertexShader: AtmosphereShader.vertexShader,
                fragmentShader: AtmosphereShader.fragmentShader,
                transparent: true,
                side: THREE.BackSide,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const corona = new THREE.Mesh(coronaGeo, coronaMat);
            star.add(corona);

            // Light Source
            const intensity = data.sizeClass === 'SuperGiant' ? 5.0 : 3.0;
            const light = new THREE.PointLight(data.star.color, intensity, 0, 0);
            star.add(light);

            star.userData = { type: 'star', data: data };
            this.container.add(star);
            this.interactables.push(star);

            // Store reference to update time
            this.activeStarMat = starMat;
        }

        // --- PLANETS (TRACKS) ---
        // GPU SHADER GENERATION - INSTANT, NO LAG
        data.tracks.forEach((track, index) => {
            const orbitGroup = new THREE.Group();
            const seed = (data.id || 0) * 1000 + index;
            const seededRandom = Math.sin(seed * 9999) * 10000;
            const randomValue = seededRandom - Math.floor(seededRandom);
            orbitGroup.rotation.z = (randomValue - 0.5) * 0.3;
            this.container.add(orbitGroup);

            const visualSize = track.size * 0.4;
            const visualDist = track.dist * 1.5;

            const orbitColor = this.getOrbitColor(track.planetType);
            const lineGeo = new THREE.RingGeometry(visualDist - 0.2, visualDist + 0.2, 128);
            const lineMat = new THREE.MeshBasicMaterial({
                color: orbitColor, side: THREE.DoubleSide, transparent: true, opacity: 0.12
            });
            const line = new THREE.Mesh(lineGeo, lineMat);
            line.rotation.x = Math.PI / 2;
            orbitGroup.add(line);

            // Setup Planet shader material colors
            const baseColor = new THREE.Color(track.color);
            const color1 = baseColor;
            const color2 = baseColor.clone().multiplyScalar(0.6);
            const color3 = baseColor.clone().multiplyScalar(1.2);

            // Map types to IDs
            const types = { 'rocky': 0, 'ocean': 1, 'gas': 2, 'lava': 3, 'ice': 4, 'forest': 0, 'desert': 0, 'ice_giant': 2 };
            const typeId = types[track.planetType] !== undefined ? types[track.planetType] : 0;

            const pGeo = new THREE.SphereGeometry(visualSize, 64, 64);
            const pMat = new THREE.ShaderMaterial({
                uniforms: {
                    time: { value: 0 },
                    color1: { value: color1 },
                    color2: { value: color2 },
                    color3: { value: color3 },
                    type: { value: typeId },
                    hasClouds: { value: track.hasClouds ? 1.0 : 0.0 },
                    seed: { value: seed },
                    ambientLightColor: { value: new THREE.Color(0x101010) }
                },
                vertexShader: PlanetShader.vertexShader,
                fragmentShader: PlanetShader.fragmentShader
            });

            const planet = new THREE.Mesh(pGeo, pMat);
            // Store material ref for animation
            planet.userData.shaderMat = pMat;

            // Atmosphere Glow
            if (track.hasAtmosphere) {
                const atmoGeo = new THREE.SphereGeometry(visualSize * 1.15, 64, 64);
                const atmoColor = track.atmosphereColor || track.color;
                const atmoMat = new THREE.ShaderMaterial({
                    uniforms: {
                        color: { value: new THREE.Color(atmoColor) },
                        power: { value: 5.0 },
                        intensity: { value: 0.4 }
                    },
                    vertexShader: AtmosphereShader.vertexShader,
                    fragmentShader: AtmosphereShader.fragmentShader,
                    transparent: true,
                    side: THREE.BackSide,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                });
                const atmo = new THREE.Mesh(atmoGeo, atmoMat);
                atmo.renderOrder = 2; // Make sure atmosphere renders after planet
                planet.add(atmo);
            }

            // Lava glow
            if (track.planetType === 'lava') {
                const glowGeo = new THREE.SphereGeometry(visualSize * 1.05, 32, 32);
                const glowMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false });
                const glow = new THREE.Mesh(glowGeo, glowMat);
                planet.add(glow);
            }

            // Planet rings
            if (track.hasRings) {
                const ringInner = visualSize * 1.4;
                const ringOuter = visualSize * 2.4;
                const ringGeo = new THREE.RingGeometry(ringInner, ringOuter, 64);
                // Keep JS texture for rings as they are static and fast
                const pos = ringGeo.attributes.position;
                const uv = ringGeo.attributes.uv;
                for (let k = 0; k < pos.count; k++) {
                    const x = pos.getX(k);
                    const y = pos.getY(k);
                    const dist = Math.sqrt(x * x + y * y);
                    const u = (dist - ringInner) / (ringOuter - ringInner);
                    uv.setXY(k, u, 0.5);
                }
                const ringTex = TextureFactory.createPlanetRing(track.seed || index, track.ringColor || '#D2B48C');
                const ringMat = new THREE.MeshBasicMaterial({
                    map: ringTex,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.85,
                    blending: THREE.NormalBlending,
                    depthWrite: false,
                    depthTest: true
                });
                const rings = new THREE.Mesh(ringGeo, ringMat);
                rings.rotation.x = Math.PI / 2 + (randomValue - 0.5) * 0.3;
                rings.renderOrder = 3;
                planet.add(rings);
            }

            planet.userData = { type: 'track', data: track, shaderMat: pMat }; // Include shaderMat in userData
            this.interactables.push(planet);

            this.orbitAnimations.push({
                mesh: planet,
                dist: visualDist,
                angle: track.angle,
                speed: track.speed,
                baseScale: track.size,
                planetType: track.planetType
            });

            orbitGroup.add(planet);
        });
    }

    getOrbitColor(planetType) {
        const colors = {
            rocky: 0x888888,
            ocean: 0x4488aa,
            forest: 0x448844,
            ice: 0x88aacc,
            lava: 0xaa4422,
            desert: 0xaa8844,
            gas: 0xccaa88,
            ice_giant: 0x66aacc
        };
        return colors[planetType] || 0x888888;
    }

    getPlanetRoughness(planetType) {
        const roughness = {
            rocky: 0.95,
            ocean: 0.15, // Shinier oceans
            forest: 0.8,
            ice: 0.05, // Very shiny ice
            lava: 0.9,
            desert: 1.0,
            gas: 0.6,
            ice_giant: 0.4
        };
        return roughness[planetType] || 0.7;
    }

    getPlanetMetalness(planetType) {
        const metalness = {
            rocky: 0.1,
            ocean: 0.1,
            forest: 0.0,
            ice: 0.3,
            lava: 0.2,
            desert: 0.0,
            gas: 0.0,
            ice_giant: 0.1
        };
        return metalness[planetType] || 0.1;
    }

    clear() {
        // Remove all children except selector, waveformContainer, and ambient light
        const keepObjects = [this.selector, this.waveformContainer, this.ambientLight];
        const toRemove = this.container.children.filter(child => !keepObjects.includes(child));
        toRemove.forEach(child => this.container.remove(child));

        // Reset selector and waveform state
        this.selector.visible = false;
        this.waveformContainer.visible = false;
        this.waveformRings.forEach(ring => {
            ring.material.opacity = 0;
            ring.visible = false;
            ring.material.visible = false;
        });

        this.interactables = [];
        this.orbitAnimations = [];
        this.selectedTarget = null;
        this.activeStarMat = null;
    }

    update(dt, isPulse, audioLevel = 0, orbitSpeedMultiplier = 0.1, camera = null) {
        // Update Star Shader
        if (this.activeStarMat) {
            this.activeStarMat.uniforms.time.value += dt;

            // Critical for Shader: Update camera position uniform manually.
            // The StarShader calculates limb darkening based on the view angle relative to the surface normal.
            // Since we Are using a custom shader, we feed the camera's world position to it.
            if (camera && this.activeStarMat.uniforms.cameraPosition) {
                this.activeStarMat.uniforms.cameraPosition.value.copy(camera.position);
            }
        }

        // Track time for waveform animation
        this.waveformTime = (this.waveformTime || 0) + dt;

        // Orbit Logic - use the speed multiplier to scale orbit speed
        // The slider goes 0.01 to 0.5, with 0.1 being default
        // Scale so that 0.1 = 1x, 0.5 = 5x, 0.01 = 0.1x
        const speedScale = orbitSpeedMultiplier * 10; // 0.1 * 10 = 1x base speed
        this.orbitAnimations.forEach(orbit => {
            orbit.angle += orbit.speed * dt * speedScale;
            orbit.mesh.position.x = Math.cos(orbit.angle) * orbit.dist;
            orbit.mesh.position.z = Math.sin(orbit.angle) * orbit.dist;
            orbit.mesh.rotation.y += dt * 0.5;

            // Animate Planet Shader
            if (orbit.mesh.userData.shaderMat) {
                orbit.mesh.userData.shaderMat.uniforms.time.value += dt;
            }

            // Music Pulse Effect (Real Audio Data)
            if (isPulse && this.selectedTarget === orbit.mesh) {
                const intensity = (audioLevel / 255) * 0.25;
                const scale = orbit.baseScale * (1 + intensity);
                orbit.mesh.scale.set(scale, scale, scale);
            } else {
                // Smoothly return to base scale
                const currentScale = orbit.mesh.scale.x;
                const targetScale = orbit.baseScale;
                const newScale = currentScale + (targetScale - currentScale) * 0.1;
                orbit.mesh.scale.set(newScale, newScale, newScale);
            }
        });

        // Selector follows target
        if (this.selectedTarget && this.selector.visible) {
            const targetPos = new THREE.Vector3();
            this.selectedTarget.getWorldPosition(targetPos);
            this.selector.position.copy(targetPos);
            this.selector.rotation.z += dt;
        }

        // Waveform visualization
        if (isPulse && this.selectedTarget && audioLevel > 10) {
            this.waveformContainer.visible = true;

            // Position waveform at selected planet
            const targetPos = new THREE.Vector3();
            this.selectedTarget.getWorldPosition(targetPos);
            this.waveformContainer.position.copy(targetPos);

            // Get base size from planet
            const planetSize = this.selectedTarget.userData.data?.size || 2;

            // Animate each ring
            this.waveformRings.forEach((ring, i) => {
                ring.visible = true;
                ring.material.visible = true;

                const phase = this.waveformTime * 2 + ring.userData.phase * Math.PI * 2;
                const cycle = (phase % 1);

                // Scale expands outward
                const minScale = planetSize * 1.5;
                const maxScale = planetSize * 6;
                const scale = minScale + cycle * (maxScale - minScale);
                ring.scale.set(scale, scale, 1);

                // Opacity fades as it expands
                const normalizedAudio = audioLevel / 255;
                const baseOpacity = normalizedAudio * 0.6;
                const opacity = baseOpacity * (1 - cycle * 0.9);
                ring.material.opacity = Math.max(0, opacity);

                // Color shifts with audio intensity
                const hue = 0.5 + normalizedAudio * 0.1 + i * 0.02;
                ring.material.color.setHSL(hue, 0.8, 0.5 + normalizedAudio * 0.2);
            });
        } else {
            // Fade out waveform when not playing
            let allFaded = true;
            this.waveformRings.forEach(ring => {
                ring.material.opacity *= 0.9;
                if (ring.material.opacity < 0.01) {
                    ring.material.opacity = 0;
                    ring.visible = false;
                    ring.material.visible = false;
                } else {
                    allFaded = false;
                }
            });
            if (allFaded) {
                this.waveformContainer.visible = false;
            }
        }
    }

    show() { this.container.visible = true; }
    hide() { this.container.visible = false; }
}