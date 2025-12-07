import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Config } from '../Config.js';

export class GraphicsEngine {
    constructor() {
        this.container = document.getElementById('canvas-container');

        // Scene Setup
        this.scene = new THREE.Scene();
        // Fog disabled by default - can be enabled via settings
        this.fogDensity = 0;
        this.scene.fog = null;

        // Starfield background
        this.starfield = null;
        this.createStarfield(Config.Starfield.Count);
        
        // Camera Setup
        this.camera = new THREE.PerspectiveCamera(
            Config.Camera.FOV, 
            window.innerWidth / window.innerHeight, 
            Config.Camera.Near, 
            Config.Camera.Far
        );
        this.camera.position.set(0, 400, 600);

        // Renderer Setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.setClearColor(0x000000, 1); // Pure black background
        this.renderer.autoClear = true;
        this.container.appendChild(this.renderer.domElement);

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxDistance = 2000;

        // Post-Processing (Bloom)
        this.composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.2, 0.4, 0.85
        );
        this.bloomPass.strength = 1.2;
        this.bloomPass.radius = 0.5;
        this.bloomPass.threshold = 0.3; // Lower threshold for star glow, planets stay below this
        this.composer.addPass(this.bloomPass);

        // Resize Listener
        window.addEventListener('resize', () => this.onResize());

        // Twinkle animation time
        this.starfieldTime = 0;
    }

    createStarfield(count) {
        // Remove existing starfield if present
        if (this.starfield) {
            this.scene.remove(this.starfield);
            this.starfield.geometry.dispose();
            this.starfield.material.dispose();
        }

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const twinklePhases = new Float32Array(count);

        const radius = Config.Starfield.Radius;
        const starColors = [
            new THREE.Color(0xffffff),  // White
            new THREE.Color(0xaaccff),  // Blue-white
            new THREE.Color(0xffffee),  // Warm white
            new THREE.Color(0xffddaa),  // Orange tint
            new THREE.Color(0xaaddff),  // Cool blue
        ];

        for (let i = 0; i < count; i++) {
            // Spherical distribution
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = radius * (0.5 + Math.random() * 0.5);

            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);

            // Random star color
            const color = starColors[Math.floor(Math.random() * starColors.length)];
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;

            // Random size
            sizes[i] = Config.Starfield.MinSize + Math.random() * (Config.Starfield.MaxSize - Config.Starfield.MinSize);

            // Random twinkle phase
            twinklePhases[i] = Math.random() * Math.PI * 2;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('twinklePhase', new THREE.BufferAttribute(twinklePhases, 1));

        // Custom shader material for twinkling
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 }
            },
            vertexShader: `
                attribute float size;
                attribute float twinklePhase;
                varying vec3 vColor;
                varying float vTwinkle;
                uniform float time;

                void main() {
                    vColor = color;
                    // Twinkle effect
                    vTwinkle = 0.6 + 0.4 * sin(time * 2.0 + twinklePhase);

                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (300.0 / -mvPosition.z) * vTwinkle;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                varying float vTwinkle;

                void main() {
                    // Circular point with soft edge
                    float dist = length(gl_PointCoord - vec2(0.5));
                    if (dist > 0.5) discard;

                    float alpha = 1.0 - smoothstep(0.2, 0.5, dist);
                    alpha *= vTwinkle;

                    gl_FragColor = vec4(vColor, alpha);
                }
            `,
            transparent: true,
            vertexColors: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.starfield = new THREE.Points(geometry, material);
        this.scene.add(this.starfield);
    }

    updateStarfield(dt) {
        if (this.starfield && this.starfield.material.uniforms) {
            this.starfieldTime += dt;
            this.starfield.material.uniforms.time.value = this.starfieldTime;
        }
    }

    setFogDensity(density) {
        this.fogDensity = density;
        if (density <= 0) {
            this.scene.fog = null;
        } else {
            // Use dark gray fog so it's visible
            this.scene.fog = new THREE.FogExp2(0x111122, density);
        }
    }

    setToneMappingExposure(exposure) {
        this.renderer.toneMappingExposure = exposure;
    }

    setBackgroundBrightness(brightness) {
        // brightness: 0 = pure black, 1 = gray (0x808080)
        const val = Math.floor(brightness * 128);
        const color = (val << 16) | (val << 8) | val;
        this.renderer.setClearColor(color, 1);
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        this.controls.update();
        this.composer.render();
    }
}