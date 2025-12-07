import * as THREE from 'three';
import { GraphicsEngine } from './core/GraphicsEngine.js';
import { InputController } from './core/InputController.js';
import { AudioController } from './audio/AudioController.js';
import { FileSystemLoader } from './core/FileSystemLoader.js';
import { DataGenerator } from './data/DataGenerator.js';
import { GalaxyView } from './scenes/GalaxyView.js';
import { SystemView } from './scenes/SystemView.js';
import { Config } from './Config.js';

export class App {
    constructor() {
        // Systems
        this.engine = new GraphicsEngine();
        this.audio = new AudioController();
        this.input = new InputController(this.engine.camera, this.engine.renderer.domElement);

        // Views
        this.galaxy = new GalaxyView(this.engine.scene);
        this.system = new SystemView(this.engine.scene);

        // State
        this.clock = new THREE.Clock();
        this.mode = 'IDLE'; // IDLE -> GALAXY -> SYSTEM

        // Player State
        this.currentAlbum = null;
        this.currentTrackIndex = -1;
        this.isShuffle = false;
        this.focusTarget = null; // For cinematic zoom
        this.idealCameraDistance = 50; // Ideal distance from planet when focused

        // Shuffle Bag - tracks indices not yet played in current shuffle cycle
        this.shuffleBag = [];

        // Galaxy Wanderer Mode
        this.wandererMode = false;
        this.wandererSongsPerAlbum = 3; // How many songs before jumping to new album
        this.wandererSongsPlayed = 0;   // Counter for current album
        this.allAlbums = [];            // Reference to all loaded albums

        // Settings State
        this.orbitSpeedMultiplier = Config.System.OrbitSpeedMultiplier;
        this.secretMenuVisible = false;

        // Streamer Mode State
        this.uiHidden = false;

        // Auto-advance callback
        this.audio.onTrackEnd = () => this.onTrackEnd();

        this.loader = new FileSystemLoader(); // Initialize loader early

        this.bindEvents();
        this.bindSecretMenu();
        this.animate();
        this.updateMediaBarVisibility();

        // Attempt to restore previous session
        this.attemptAutoLoad();
    }

    async attemptAutoLoad() {
        // quiet attempt
        const data = await this.loader.pickDirectory(true);
        if (data && data.length > 0) {
            console.log("Auto-loaded galaxy data:", data.length, "systems");
            // Change start button text to indicate ready state
            const btn = document.getElementById('init-btn');
            if (btn) {
                btn.innerText = "ENTER GALAXY";
                btn.onclick = () => {
                    this.onDataLoaded(data);
                };
            }
        }
    }

    bindEvents() {
        const get = (id) => document.getElementById(id);

        // Main UI
        if (get('init-btn')) {
            // Default behavior if not auto-loaded
            get('init-btn').addEventListener('click', () => this.startExperience());
        }
        if (get('back-btn')) get('back-btn').addEventListener('click', () => this.exitSystem());


        // Media Controls
        if (get('btn-play')) get('btn-play').onclick = () => {
            if (this.audio.isPlaying) this.pauseTrack();
            else this.resumeOrPlayTrack();
        };
        if (get('btn-stop')) get('btn-stop').onclick = () => this.stopTrack();
        if (get('btn-next')) get('btn-next').onclick = () => this.nextTrack();
        if (get('btn-prev')) get('btn-prev').onclick = () => this.prevTrack();
        if (get('btn-shuffle')) get('btn-shuffle').onclick = (e) => {
            this.isShuffle = !this.isShuffle;
            e.target.classList.toggle('active', this.isShuffle);
            if (this.isShuffle) {
                this.resetShuffleBag();
            }
        };

        // Volume Slider
        if (get('vol-music')) get('vol-music').oninput = (e) => this.audio.setMusicVolume(e.target.value);

        // Progress Bar
        const progressBar = get('progress-bar');
        if (progressBar) {
            progressBar.addEventListener('click', (e) => {
                if (!this.audio.duration) return;
                const rect = progressBar.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                this.audio.seek(percent * this.audio.duration);
            });
        }

        // Keyboard Controls
        window.addEventListener('keydown', (e) => this.onKeyDown(e));

        // 3D Interactions
        this.input.events.onClick = (target) => this.onObjectClicked(target);
    }

    onKeyDown(e) {
        // Ignore if typing in an input
        if (e.target.tagName === 'INPUT') return;

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                if (this.mode === 'SYSTEM') {
                    if (this.audio.isPlaying) this.pauseTrack();
                    else this.resumeOrPlayTrack();
                }
                break;
            case 'ArrowRight':
                if (this.mode === 'SYSTEM') this.nextTrack();
                break;
            case 'ArrowLeft':
                if (this.mode === 'SYSTEM') this.prevTrack();
                break;
            case 'Escape':
                // If UI is hidden (streamer mode), reveal it
                if (this.uiHidden) {
                    this.showUI();
                } else if (this.secretMenuVisible) {
                    this.toggleSecretMenu(false);
                } else if (this.mode === 'SYSTEM') {
                    this.exitSystem();
                }
                break;
            case 'Backquote': // ~ key
                this.toggleSecretMenu();
                break;
        }
    }

    bindSecretMenu() {
        const get = (id) => document.getElementById(id);

        // Load saved settings immediately
        this.loadSettings();

        // Helper to bind input and change events
        const bindSlider = (id, displayId, onInput, processVal = parseFloat, displayFormat = (v) => v.toFixed(2)) => {
            const el = get(id);
            if (!el) return;
            const handler = (e) => {
                const val = processVal(e.target.value);
                if (get(displayId)) get(displayId).innerText = displayFormat(val);
                onInput(val);
            };
            el.oninput = handler;
            el.onchange = (e) => {
                handler(e); // Ensure value is applied
                this.saveSettings();
            };
        };

        // Close button
        if (get('secret-close')) {
            get('secret-close').onclick = () => this.toggleSecretMenu(false);
        }

        // Streamer mode hide button
        if (get('streamer-hide-btn')) {
            get('streamer-hide-btn').onclick = () => {
                this.hideUI();
                this.toggleSecretMenu(false);
            };
        }

        // Galaxy Wanderer mode
        if (get('wanderer-mode')) {
            get('wanderer-mode').onchange = (e) => {
                this.wandererMode = e.target.checked;
                this.wandererSongsPlayed = 0;
                this.saveSettings();
            };
        }

        // Orbit speed
        bindSlider('orbit-speed', 'orbit-speed-value', (v) => this.orbitSpeedMultiplier = v, parseFloat, (v) => v.toFixed(2) + 'x');

        // Wanderer songs
        bindSlider('wanderer-songs', 'wanderer-songs-value', (v) => this.wandererSongsPerAlbum = v, parseInt, (v) => v);

        // Starfield density
        bindSlider('starfield-density', 'starfield-density-value', (v) => this.engine.createStarfield(v), parseInt, (v) => v);

        // Background brightness
        bindSlider('bg-brightness', 'bg-brightness-value', (v) => this.engine.setBackgroundBrightness(v));

        // Exposure
        bindSlider('tone-exposure', 'tone-exposure-value', (v) => this.engine.setToneMappingExposure(v));

        // Fog density
        bindSlider('fog-density', 'fog-density-value', (v) => this.engine.setFogDensity(v), parseFloat, (v) => v === 0 ? 'Off' : v.toFixed(5));

        // Bloom threshold
        bindSlider('bloom-threshold', 'bloom-threshold-value', (v) => this.engine.bloomPass.threshold = v);

        // Bloom strength
        bindSlider('bloom-strength', 'bloom-strength-value', (v) => this.engine.bloomPass.strength = v);

        // Bloom radius
        bindSlider('bloom-radius', 'bloom-radius-value', (v) => this.engine.bloomPass.radius = v);
    }

    saveSettings() {
        const getVal = (id, type = 'float') => {
            const el = document.getElementById(id);
            if (!el) return null;
            return type === 'int' ? parseInt(el.value) : parseFloat(el.value);
        };
        const getCheck = (id) => {
            const el = document.getElementById(id);
            return el ? el.checked : false;
        };

        const settings = {
            orbitSpeed: getVal('orbit-speed'),
            wandererMode: getCheck('wanderer-mode'),
            wandererSongs: getVal('wanderer-songs', 'int'),
            starfieldDensity: getVal('starfield-density', 'int'),
            bgBrightness: getVal('bg-brightness'),
            toneExposure: getVal('tone-exposure'),
            fogDensity: getVal('fog-density'),
            bloomThreshold: getVal('bloom-threshold'),
            bloomStrength: getVal('bloom-strength'),
            bloomRadius: getVal('bloom-radius')
        };

        try {
            localStorage.setItem('galaxy_settings', JSON.stringify(settings));
        } catch (e) {
            console.error("Failed to save settings:", e);
        }
    }

    loadSettings() {
        try {
            const raw = localStorage.getItem('galaxy_settings');
            if (!raw) return;
            const s = JSON.parse(raw);
            const get = (id) => document.getElementById(id);
            const setVal = (id, val, trigger = false) => {
                const el = get(id);
                if (el && val !== null && val !== undefined) {
                    el.value = val;
                    if (trigger) el.dispatchEvent(new Event('input')); // Trigger visual updates
                }
            };

            if (s.wandererMode !== undefined && get('wanderer-mode')) {
                get('wanderer-mode').checked = s.wandererMode;
                this.wandererMode = s.wandererMode;
            }

            // Set values and trigger input events to update engine/UI
            setVal('orbit-speed', s.orbitSpeed, true);
            setVal('wanderer-songs', s.wandererSongs, true);
            setVal('starfield-density', s.starfieldDensity, true);
            setVal('bg-brightness', s.bgBrightness, true);
            setVal('tone-exposure', s.toneExposure, true);
            setVal('fog-density', s.fogDensity, true);
            setVal('bloom-threshold', s.bloomThreshold, true);
            setVal('bloom-strength', s.bloomStrength, true);
            setVal('bloom-radius', s.bloomRadius, true);

            console.log("Settings loaded.");
        } catch (e) {
            console.error("Error loading settings:", e);
        }
    }

    toggleSecretMenu(forceState) {
        const menu = document.getElementById('secret-menu');
        if (!menu) return;

        this.secretMenuVisible = forceState !== undefined ? forceState : !this.secretMenuVisible;
        menu.classList.toggle('visible', this.secretMenuVisible);
    }

    hideUI() {
        this.uiHidden = true;
        document.body.classList.add('streamer-hidden');
    }

    showUI() {
        this.uiHidden = false;
        document.body.classList.remove('streamer-hidden');
    }

    resumeOrPlayTrack() {
        if (this.audio.isPaused) {
            this.audio.resumeAudio();
            document.getElementById('btn-play').innerText = '⏸';
        } else {
            this.playTrack();
        }
    }

    updateMediaBarVisibility() {
        const mediaBar = document.getElementById('media-bar');
        const keyboardHints = document.getElementById('keyboard-hints');
        const isSystem = this.mode === 'SYSTEM';

        if (mediaBar) {
            mediaBar.classList.toggle('visible', isSystem);
        }
        if (keyboardHints) {
            keyboardHints.classList.toggle('visible', isSystem);
        }
    }

    showLoading(show, text = 'Loading') {
        const overlay = document.getElementById('loading-overlay');
        const loadingText = document.getElementById('loading-text');
        if (overlay) {
            overlay.classList.toggle('active', show);
        }
        if (loadingText && text) {
            loadingText.innerText = text;
        }
    }

    async startExperience() {
        await this.audio.init();

        // Show loading overlay
        this.showLoading(true, 'Scanning Directory');

        // 1. Try to pick a folder using persistent loader
        let data = await this.loader.pickDirectory();

        // 2. Fallback if cancelled
        if (!data || data.length === 0) {
            this.showLoading(true, 'Generating Galaxy');
            console.log("No folder selected. Generating simulation data...");
            data = [];
            for (let i = 0; i < Config.Galaxy.Count; i++) {
                data.push(DataGenerator.generateAlbum(i));
            }
        }

        this.onDataLoaded(data);
    }

    async onDataLoaded(data) {
        // Ensure audio context is ready/initialized
        if (!this.audio.context) {
            await this.audio.init();
        }

        if (this.audio.context && this.audio.context.state === 'suspended') {
            await this.audio.context.resume();
        }

        const loader = document.getElementById('loader');

        // 3. Initialize Galaxy
        this.showLoading(true, 'Rendering Stars');
        await new Promise(r => setTimeout(r, 100)); // Allow UI to update
        this.galaxy.setData(data);
        this.allAlbums = data; // Store reference for wanderer mode

        // Hide loading
        this.showLoading(false);

        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => {
                if (loader.parentNode) loader.remove();
            }, 1000);
        }

        this.mode = 'GALAXY';
    }

    onObjectClicked(target) {
        let rootObj = target;
        while (rootObj.parent && !rootObj.userData.type && rootObj.parent.type !== 'Scene') {
            rootObj = rootObj.parent;
        }

        const type = rootObj.userData.type;
        const data = rootObj.userData.data;

        if (this.mode === 'GALAXY' && type === 'album') {
            this.enterSystem(data);
        } else if (this.mode === 'SYSTEM') {
            if (type === 'track') {
                // If clicking a planet, play that track
                const idx = this.currentAlbum.tracks.indexOf(data);
                this.currentTrackIndex = idx;
                this.playTrack();
                this.system.highlight(rootObj);
            }
        }
    }

    enterSystem(albumData) {
        this.mode = 'TRANSITION';
        this.audio.playSound('warp');
        this.currentAlbum = albumData;

        let speed = 0;
        const warpAnimation = async () => {
            speed += 2;
            this.engine.camera.position.z -= speed * speed;

            if (this.engine.camera.position.z < -2000) {
                // Transition point
                this.galaxy.hide();

                // Instant GPU Load
                this.system.loadAlbum(albumData);

                this.system.show();

                this.engine.camera.position.set(0, 200, 350);
                this.engine.controls.target.set(0, 0, 0);
                this.engine.controls.maxDistance = 1000;
                this.engine.controls.autoRotate = false;

                this.mode = 'SYSTEM';

                // Update UI text
                if (document.getElementById('mode-label')) {
                    document.getElementById('mode-label').innerText = albumData.title;
                    document.getElementById('sub-label').innerText = albumData.artist;
                }
                document.getElementById('back-btn').style.display = 'block';

                // Reset player for new system
                this.currentTrackIndex = 0;
                this.wandererSongsPlayed = 0;
                this.resetShuffleBag();
                this.updatePlayerUI();
                this.updateMediaBarVisibility();

            } else {
                requestAnimationFrame(warpAnimation);
            }
        };
        warpAnimation();
    }

    exitSystem() {
        this.audio.playSound('scan');
        this.stopTrack(); // Stop music when leaving
        this.system.highlight(null);
        this.system.hide();
        this.galaxy.show();

        this.engine.camera.position.set(0, 400, 600);
        this.engine.controls.target.set(0, 0, 0);
        this.engine.controls.maxDistance = 3000;
        this.engine.controls.autoRotate = false;

        // Reset Camera
        this.focusTarget = null;
        this.engine.controls.autoRotate = false;
        this.engine.controls.target.set(0, 0, 0);

        this.mode = 'GALAXY';
        document.getElementById('mode-label').innerText = 'EXPLORATION MODE';
        document.getElementById('sub-label').innerText = 'Local Galaxy Group';
        document.getElementById('back-btn').style.display = 'none';
        this.updateMediaBarVisibility();
    }

    // --- MEDIA CONTROLS ---

    async playTrack() {
        if (!this.currentAlbum) return;

        // Visual Logic: Find the planet mesh for this track
        const trackData = this.currentAlbum.tracks[this.currentTrackIndex];

        // Play Audio
        if (trackData.handle) {
            await this.audio.playAudioFile(trackData.handle);
        } else {
            // Fallback for simulation mode
            this.audio.playTrackSim();
        }

        document.getElementById('btn-play').innerText = '⏸';
        this.updatePlayerUI();

        // We need to find the mesh in the system view interactables that matches this data
        // Note: SystemView recreates meshes, so we need to find the new one based on data reference or ID
        // Since objects are recreated, the data reference might be the same object if passed through
        const planet = this.system.interactables.find(m => m.userData.data === trackData);

        if (planet) {
            this.system.highlight(planet);
            this.focusTarget = planet;

            // Calculate ideal viewing distance based on planet size
            const planetSize = planet.userData.data?.size || 2;
            // Larger planets need more distance, smaller planets we zoom in closer
            // Distance is generous enough to still see the solar system context
            this.idealCameraDistance = Math.max(40, planetSize * 25);

            // Enable Cinematic Mode
            this.engine.controls.autoRotate = true;
            this.engine.controls.autoRotateSpeed = 0.5;
        }
    }

    pauseTrack() {
        this.audio.pauseAudio();
        document.getElementById('btn-play').innerText = '▶';
        // Note: We stay focused on the planet
    }

    stopTrack() {
        this.audio.stopAudio();
        document.getElementById('btn-play').innerText = '▶';
        this.currentTrackIndex = 0;
        this.updatePlayerUI();
        this.system.highlight(null);

        // Reset progress bar
        const progressFill = document.getElementById('progress-fill');
        if (progressFill) progressFill.style.width = '0%';
        const timeCurrent = document.getElementById('time-current');
        if (timeCurrent) timeCurrent.innerText = '0:00';

        // Reset Camera
        this.focusTarget = null;
        this.engine.controls.autoRotate = false;
        this.engine.controls.target.set(0, 0, 0);
    }

    // Called when a track ends naturally
    onTrackEnd() {
        this.wandererSongsPlayed++;

        // Check if wanderer mode should jump to new album
        if (this.wandererMode && this.wandererSongsPlayed >= this.wandererSongsPerAlbum) {
            this.wanderToNewAlbum();
        } else {
            this.nextTrack();
        }
    }

    // Initialize or refill the shuffle bag with all track indices
    resetShuffleBag() {
        if (!this.currentAlbum) return;
        this.shuffleBag = [];
        for (let i = 0; i < this.currentAlbum.tracks.length; i++) {
            this.shuffleBag.push(i);
        }
        // Fisher-Yates shuffle
        for (let i = this.shuffleBag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.shuffleBag[i], this.shuffleBag[j]] = [this.shuffleBag[j], this.shuffleBag[i]];
        }
    }

    // Get next track from shuffle bag
    getNextShuffleIndex() {
        if (this.shuffleBag.length === 0) {
            this.resetShuffleBag();
        }
        return this.shuffleBag.pop();
    }

    nextTrack() {
        if (!this.currentAlbum) return;
        if (this.isShuffle) {
            // Use bag shuffle - no repeats until all played
            this.currentTrackIndex = this.getNextShuffleIndex();
        } else {
            this.currentTrackIndex = (this.currentTrackIndex + 1) % this.currentAlbum.tracks.length;
        }
        this.playTrack();
    }

    prevTrack() {
        if (!this.currentAlbum) return;
        this.currentTrackIndex = (this.currentTrackIndex - 1 + this.currentAlbum.tracks.length) % this.currentAlbum.tracks.length;
        this.playTrack();
    }

    // Galaxy Wanderer: zoom out, pause, pick new random album
    async wanderToNewAlbum() {
        if (this.allAlbums.length <= 1) {
            // Only one album, just keep playing
            this.nextTrack();
            return;
        }

        // Exit current system with cinematic effect
        this.audio.playSound('scan');
        this.system.highlight(null);
        this.focusTarget = null;
        this.engine.controls.autoRotate = false;

        // Zoom out to galaxy view
        this.system.hide();
        this.galaxy.show();
        this.engine.camera.position.set(0, 400, 600);
        this.engine.controls.target.set(0, 0, 0);
        this.engine.controls.maxDistance = 3000;

        this.mode = 'GALAXY';
        document.getElementById('mode-label').innerText = 'WANDERING...';
        document.getElementById('sub-label').innerText = 'Selecting new destination';
        document.getElementById('back-btn').style.display = 'none';
        this.updateMediaBarVisibility();

        // Pause for dramatic effect (2.5 seconds)
        await new Promise(r => setTimeout(r, 2500));

        // Pick a random different album
        let newAlbum;
        do {
            const randomIndex = Math.floor(Math.random() * this.allAlbums.length);
            newAlbum = this.allAlbums[randomIndex];
        } while (newAlbum === this.currentAlbum && this.allAlbums.length > 1);

        // Enter the new system
        this.enterSystem(newAlbum);

        // Wait for transition to complete, then start playing
        await new Promise(r => setTimeout(r, 1500));

        // Reset wanderer counter and shuffle bag for new album
        this.wandererSongsPlayed = 0;
        this.resetShuffleBag();
        this.currentTrackIndex = this.isShuffle ? this.getNextShuffleIndex() : 0;
        this.playTrack();
    }

    updatePlayerUI() {
        if (this.currentAlbum && this.currentTrackIndex > -1) {
            const t = this.currentAlbum.tracks[this.currentTrackIndex];
            document.getElementById('player-title').innerText = t.title;
            document.getElementById('player-artist').innerText = t.artist;
        } else {
            document.getElementById('player-title').innerText = "No Track Selected";
            document.getElementById('player-artist').innerText = "--";
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const dt = this.clock.getDelta();

        // Update starfield twinkle
        this.engine.updateStarfield(dt);

        if (this.mode === 'GALAXY') {
            this.galaxy.update(dt);
            this.input.scan(this.galaxy.interactables);
        } else if (this.mode === 'SYSTEM') {
            // Get Real Audio Data (0-255)
            const audioLevel = this.audio.getAudioData();

            this.system.update(dt, this.audio.isPlaying, audioLevel, this.orbitSpeedMultiplier, this.engine.camera);
            this.input.scan(this.system.interactables);

            // Update Progress Bar and Time Displays
            if (this.audio.currentAudioElement) {
                const audio = this.audio.currentAudioElement;
                if (audio.duration && !isNaN(audio.duration)) {
                    // Update progress bar
                    const progress = (audio.currentTime / audio.duration) * 100;
                    const progressFill = document.getElementById('progress-fill');
                    if (progressFill) {
                        progressFill.style.width = `${progress}%`;
                    }

                    // Update time displays
                    const currentMins = Math.floor(audio.currentTime / 60);
                    const currentSecs = Math.floor(audio.currentTime % 60).toString().padStart(2, '0');
                    const totalMins = Math.floor(audio.duration / 60);
                    const totalSecs = Math.floor(audio.duration % 60).toString().padStart(2, '0');

                    const timeCurrentEl = document.getElementById('time-current');
                    const timeTotalEl = document.getElementById('time-total');
                    if (timeCurrentEl) timeCurrentEl.innerText = `${currentMins}:${currentSecs}`;
                    if (timeTotalEl) timeTotalEl.innerText = `${totalMins}:${totalSecs}`;
                }
            }

            // Cinematic Zoom Logic
            if (this.focusTarget) {
                const targetPos = new THREE.Vector3();
                this.focusTarget.getWorldPosition(targetPos);
                // Smoothly interpolate camera target to the moving planet
                this.engine.controls.target.lerp(targetPos, 0.1);

                // Calculate ideal camera position at the desired distance from planet
                const cameraPos = this.engine.camera.position;
                const dirToCamera = new THREE.Vector3().subVectors(cameraPos, targetPos).normalize();
                const idealPos = new THREE.Vector3().addVectors(
                    targetPos,
                    dirToCamera.multiplyScalar(this.idealCameraDistance)
                );

                // Smoothly move camera toward ideal position
                cameraPos.lerp(idealPos, 0.03);
            }
        }

        this.engine.render();
    }
}