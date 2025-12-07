import * as THREE from 'three';
import { seedNoise, simplex3, fbm } from './Noise.js';

export class TextureFactory {
    static createStar(colorHex, type, sizeClass) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        const cx = 256;
        const cy = 256;

        if (type === 'black_hole') {
            // Black Hole Accretion
            const g = ctx.createRadialGradient(cx, cy, 30, cx, cy, 240);
            g.addColorStop(0, 'black');
            g.addColorStop(0.1, 'black');
            g.addColorStop(0.12, '#440022'); // Event horizon glow
            g.addColorStop(0.2, '#aa00ff');
            g.addColorStop(0.35, '#4400aa');
            g.addColorStop(0.55, '#00ffff');
            g.addColorStop(0.8, 'transparent');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 512, 512);

            // Distortion rings
            ctx.filter = 'blur(4px)';
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.arc(cx, cy, 100 + i * 30, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(180, 50, 255, ${0.4 - i * 0.08})`;
                ctx.lineWidth = 4 + i;
                ctx.stroke();
            }
            ctx.filter = 'none';

        } else if (sizeClass === 'SuperGiant') {
            // Unstable, massive star
            const g = ctx.createRadialGradient(cx, cy, 50, cx, cy, 256);
            g.addColorStop(0, '#ffffff');
            g.addColorStop(0.2, colorHex || '#ffaa44');
            g.addColorStop(0.4, '#ff4400'); // Core heat
            g.addColorStop(0.6, 'rgba(255,50,0,0.3)');
            g.addColorStop(1, 'transparent');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 512, 512);

        } else {
            // Main Sequence
            const g = ctx.createRadialGradient(cx, cy, 50, cx, cy, 240);
            g.addColorStop(0, '#ffffff');
            g.addColorStop(0.2, colorHex || '#aaccff');
            g.addColorStop(0.5, 'rgba(100,150,255,0.4)');
            g.addColorStop(1, 'transparent');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 512, 512);
        }

        return new THREE.CanvasTexture(canvas);
    }

    /**
     * Generates a seamless planet texture using 3D noise sampled on a sphere.
     */
    static createPlanet(planetType, seed, colorStr, hasClouds = false) {
        seedNoise(seed); // Seed the noise generator

        const width = 1024; // High res for "10/10" look
        const height = 512;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const imgData = ctx.createImageData(width, height);
        const data = imgData.data;

        const baseColor = new THREE.Color(colorStr);
        const secondaryColor = baseColor.clone().multiplyScalar(0.6);
        const terrainColor = baseColor.clone().multiplyScalar(1.2);

        // Pre-parse hex to rgb for fast pixel manipulation
        const c1 = { r: baseColor.r * 255, g: baseColor.g * 255, b: baseColor.b * 255 };
        const c2 = { r: secondaryColor.r * 255, g: secondaryColor.g * 255, b: secondaryColor.b * 255 };
        const c3 = { r: terrainColor.r * 255, g: terrainColor.g * 255, b: terrainColor.b * 255 };

        // Constants used in loop
        const PI = Math.PI;
        const TWO_PI = Math.PI * 2;

        for (let y = 0; y < height; y++) {
            // Normalized V coordinate (0 to 1)
            const v = y / height;
            // Phi angle (0 to PI) - strictly for sphere mapping
            const phi = v * PI;

            for (let x = 0; x < width; x++) {
                // Normalized U coordinate (0 to 1)
                const u = x / width;
                // Theta angle (0 to 2*PI)
                const theta = u * TWO_PI;

                // Map 2D UV to 3D Sphere Coords (Unit Sphere)
                const sx = Math.sin(phi) * Math.cos(theta);
                const sy = Math.cos(phi);
                const sz = Math.sin(phi) * Math.sin(theta);

                // Index in pixel array
                const idx = (x + y * width) * 4;

                // --- NOISE GENERATION BASED ON TYPE ---
                let noise = 0;
                let r, g, b;

                if (planetType === 'gas' || planetType === 'ice_giant') {
                    // Gas Giants: Banded noise + turbulence
                    const turb = fbm(sx * 2, sy * 8, sz * 2, 4, 0.5, 2.0);
                    const band = Math.sin(sy * 10 + turb * 5);
                    noise = (band + 1) * 0.5; // 0-1 range

                    // Color Mixing
                    if (noise < 0.33) {
                        const t = noise / 0.33;
                        r = c2.r + (c1.r - c2.r) * t;
                        g = c2.g + (c1.g - c2.g) * t;
                        b = c2.b + (c1.b - c2.b) * t;
                    } else if (noise < 0.66) {
                        const t = (noise - 0.33) / 0.33;
                        r = c1.r + (c3.r - c1.r) * t;
                        g = c1.g + (c3.g - c1.g) * t;
                        b = c1.b + (c3.b - c1.b) * t;
                    } else {
                        const t = (noise - 0.66) / 0.34;
                        r = c3.r * (1 - t) + 255 * t; // Highlights
                        g = c3.g * (1 - t) + 255 * t;
                        b = c3.b * (1 - t) + 255 * t;
                    }

                } else if (planetType === 'lava') {
                    // Lava
                    noise = fbm(sx * 3, sy * 3, sz * 3, 5, 0.5, 2.0);
                    const crack = Math.pow(noise, 3);

                    if (crack > 0.65) {
                        // Lava vein
                        r = 255; g = 100 + (crack - 0.65) * 400; b = 0;
                    } else {
                        // Cooled rock
                        r = 20; g = 10; b = 10;
                    }

                } else if (planetType === 'ocean') {
                    // Ocean: Continents vs Water
                    const continents = fbm(sx * 1.5, sy * 1.5, sz * 1.5, 4, 0.5, 2.0);

                    if (continents > 0.55) {
                        // Land
                        const detail = fbm(sx * 6, sy * 6, sz * 6, 2);
                        r = c3.r * detail;
                        g = c3.g * detail;
                        b = c3.b * detail;
                    } else {
                        // Deep Ocean
                        const depth = continents / 0.55;
                        r = c2.r * depth;
                        g = c2.g * depth;
                        b = c2.b * depth + 40;
                    }

                } else {
                    // Rocky/Desert/Ice/Forest
                    noise = fbm(sx * 2.5, sy * 2.5, sz * 2.5, 6, 0.5, 2.0);

                    if (noise < 0.45) {
                        r = c2.r; g = c2.g; b = c2.b;
                    } else if (noise < 0.6) {
                        const t = (noise - 0.45) / 0.15;
                        r = c2.r * (1 - t) + c1.r * t;
                        g = c2.g * (1 - t) + c1.g * t;
                        b = c2.b * (1 - t) + c1.b * t;
                    } else {
                        const t = (noise - 0.6) / 0.4;
                        r = c1.r * (1 - t) + c3.r * t;
                        g = c1.g * (1 - t) + c3.g * t;
                        b = c1.b * (1 - t) + c3.b * t;
                    }

                    if (planetType === 'rocky') {
                        const craterNoise = simplex3(sx * 15, sy * 15, sz * 15);
                        if (craterNoise > 0.6) {
                            r *= 0.7; g *= 0.7; b *= 0.7;
                        }
                    }
                }

                // Add Clouds noise
                if (hasClouds) {
                    const cloudNoise = fbm(sx * 3 + 10, sy * 3, sz * 3, 3);
                    if (cloudNoise > 0.65) {
                        const alpha = (cloudNoise - 0.65) * 3;
                        r = r * (1 - alpha) + 255 * alpha;
                        g = g * (1 - alpha) + 255 * alpha;
                        b = b * (1 - alpha) + 255 * alpha;
                    }
                }

                // Write pixel
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255;
            }
        }

        ctx.putImageData(imgData, 0, 0);
        return new THREE.CanvasTexture(canvas);
    }

    static createRing() {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;

        ctx.clearRect(0, 0, size, size);

        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ffff';

        ctx.beginPath();
        ctx.arc(cx, cy, 180, 0, Math.PI * 2);
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, 195, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        return new THREE.CanvasTexture(canvas);
    }

    static createPlanetRing(seed, colorHex = '#D2B48C') {
        const size = 1024;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;

        seedNoise(seed);

        ctx.clearRect(0, 0, size, size);

        const c = new THREE.Color(colorHex);

        for (let r = 250; r < 480; r += 0.5) {
            const n = simplex3(r * 0.1, 0, 0);
            const n2 = simplex3(r * 1.5, 10, 0);

            let alpha = (n * 0.5 + 0.5) * (n2 * 0.3 + 0.7) * 0.8;

            if (r < 270) alpha *= (r - 250) / 20;
            if (r > 460) alpha *= (480 - r) / 20;

            if (alpha < 0.05) continue;

            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${c.r * 255}, ${c.g * 255}, ${c.b * 255}, ${alpha})`;
            ctx.lineWidth = 1.0;
            ctx.stroke();
        }

        return new THREE.CanvasTexture(canvas);
    }

    static createWaveformRing() {
        return this.createRing();
    }
}