import * as THREE from 'three';
import { GraphicsEngine } from './core/GraphicsEngine.js';
import { InputController } from './core/InputController.js';
import { AudioController } from './audio/AudioController.js';
import { FileSystemLoader } from './core/FileSystemLoader.js';
import { DataGenerator } from './data/DataGenerator.js';
import { GalaxyView } from './scenes/GalaxyView.js';
import { SystemView } from './scenes/SystemView.js';
import { Config } from './Config.js';
import { InfoTicker } from './ui/InfoTicker.js';
import { readTrackMetadata } from './utils/MetadataReader.js';

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
        this.focusTarget = null; // Active planet mesh while playing
        this.planetCameraDistance = 80;
        this.cinematicOrbitSpeed = 0.08;
        this._cinematicOrbitAngle = 0;
        this._cinematicOrbitPitch = 0.32;
        this._planetFocusScratch = new THREE.Vector3();
        this._idealCamScratch = new THREE.Vector3();

        // Shuffle Bag - tracks indices not yet played in current shuffle cycle
        this.shuffleBag = [];
        this.shuffleHistory = [];

        // Pre-scanned library from auto-load (avoids double init on ENTER GALAXY)
        this.preloadedGalaxyData = null;
        this.warpGeneration = 0;

        // Galaxy Wanderer Mode
        this.wandererMode = false;
        this.wandererSongsPerAlbum = 3;
        this.wandererManaging = false;
        this.wandererBusy = false;
        this._wandererExiting = false;
        this._wandererAbort = false;
        this._trackEndResolve = null;
        this._trackEndTimeout = null;
        this.allAlbums = [];

        // Bottom info ticker
        this.tickerEnabled = false;
        this.ticker = new InfoTicker(Config.App.Version);

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

        this.updateLoaderHint();

        // Attempt to restore previous session
        this.attemptAutoLoad();
    }

    updateLoaderHint() {
        const sub = document.querySelector('#loader .loader-subtitle');
        if (!sub) return;
        sub.textContent = 'Select your music library folder when prompted (Chrome or Edge)';
    }

    async attemptAutoLoad() {
        // quiet attempt
        const data = await this.loader.pickDirectory(true);
        if (data && data.length > 0) {
            console.log("Auto-loaded galaxy data:", data.length, "systems");
            this.preloadedGalaxyData = data;
            const btn = document.getElementById('init-btn');
            if (btn) btn.innerText = "ENTER GALAXY";
        }
    }

    bindEvents() {
        const get = (id) => document.getElementById(id);

        // Main UI
        if (get('init-btn')) {
            get('init-btn').addEventListener('click', () => this.onInitClick());
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
                this.saveSettings();
                if (this.wandererMode) {
                    this.startWandererSession();
                } else {
                    this.cancelWandererCycle();
                    this.wandererManaging = false;
                }
            };
        }

        if (get('ticker-enabled')) {
            get('ticker-enabled').onchange = (e) => {
                this.tickerEnabled = e.target.checked;
                this.ticker.setEnabled(this.tickerEnabled);
                this.saveSettings();
                if (this.tickerEnabled) {
                    this.refreshTickerFromCurrentTrack();
                }
            };
        }

        // Orbit speed
        bindSlider('orbit-speed', 'orbit-speed-value', (v) => this.orbitSpeedMultiplier = v, parseFloat, (v) => v.toFixed(2) + 'x');
        const orbitEl = get('orbit-speed');
        if (orbitEl) orbitEl.dispatchEvent(new Event('input'));

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
            tickerEnabled: getCheck('ticker-enabled'),
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

            if (s.tickerEnabled !== undefined && get('ticker-enabled')) {
                get('ticker-enabled').checked = s.tickerEnabled;
                this.tickerEnabled = s.tickerEnabled;
                this.ticker.setEnabled(s.tickerEnabled);
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

    async resumeOrPlayTrack() {
        if (this.audio.isPaused) {
            const resumed = await this.audio.resumeAudio();
            document.getElementById('btn-play').innerText = resumed ? '⏸' : '▶';
        } else {
            await this.playTrack();
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
        document.body.classList.toggle('has-media-bar', isSystem);
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

    async onInitClick() {
        if (this.preloadedGalaxyData) {
            const data = this.preloadedGalaxyData;
            this.preloadedGalaxyData = null;
            await this.audio.init();
            await this.onDataLoaded(data);
            return;
        }
        await this.startExperience();
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
        if (!this.audio.initialized) {
            await this.audio.init();
        }

        if (this.audio.ctx.state === 'suspended') {
            await this.audio.ctx.resume();
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

        if (this.wandererMode) {
            this.startWandererSession();
        }
    }

    onObjectClicked(target) {
        this._wandererAbort = true;
        this.cancelWandererCycle();
        this.wandererManaging = false;
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
                const idx = this.currentAlbum.tracks.indexOf(data);
                if (idx < 0) return;

                if (idx === this.currentTrackIndex && this.audio.isPlaying) {
                    this.pauseTrack();
                    return;
                }

                this.currentTrackIndex = idx;
                this.playTrack();
            }
        }
    }

    enterSystem(albumData) {
        const generation = ++this.warpGeneration;
        this.mode = 'TRANSITION';
        this.currentAlbum = albumData;

        let speed = 0;

        return new Promise((resolve) => {
            const warpAnimation = () => {
                if (generation !== this.warpGeneration) {
                    resolve(false);
                    return;
                }

                speed += 2;
                this.engine.camera.position.z -= speed * speed;

                if (this.engine.camera.position.z < -2000) {
                    this.galaxy.hide();
                    this.system.loadAlbum(albumData);
                    this.system.show();

                    this.systemViewRadius = this.getSystemViewRadius();
                    const enterDist = Math.max(380, this.systemViewRadius * 1.35);
                    this.engine.camera.position.set(enterDist * 0.55, enterDist * 0.55, enterDist * 0.85);
                    this.engine.controls.target.set(0, 0, 0);
                    this.engine.controls.maxDistance = Math.max(2000, enterDist * 2.5);
                    this.engine.controls.minDistance = 80;
                    this.engine.controls.autoRotate = false;

                    this.mode = 'SYSTEM';

                    if (document.getElementById('mode-label')) {
                        document.getElementById('mode-label').innerText = albumData.title;
                        document.getElementById('sub-label').innerText = albumData.artist;
                    }
                    document.getElementById('back-btn').style.display = 'block';

                    this.currentTrackIndex = 0;
                    this.wandererSongsPlayed = 0;
                    this.resetShuffleBag();
                    this.updatePlayerUI();
                    this.updateMediaBarVisibility();

                    resolve(true);
                } else {
                    requestAnimationFrame(warpAnimation);
                }
            };
            warpAnimation();
        });
    }

    exitSystem() {
        if (this.wandererManaging && !this._wandererExiting) {
            this._wandererAbort = true;
            this.cancelWandererCycle();
            this.wandererManaging = false;
            const wandererCb = document.getElementById('wanderer-mode');
            if (wandererCb) wandererCb.checked = false;
            this.wandererMode = false;
            this.saveSettings();
        }

        this.warpGeneration++;
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

    /** Farthest orbit radius in the current album (star sits at 0,0,0). */
    getSystemViewRadius() {
        if (!this.currentAlbum?.tracks?.length) return 320;
        let max = 200;
        for (const t of this.currentAlbum.tracks) {
            const orbit = (t.dist || 60) * 1.5;
            const body = (t.size || 2) * 8;
            max = Math.max(max, orbit + body);
        }
        return max;
    }

    findPlanetMeshForTrack(trackData) {
        let planet = this.system.interactables.find(
            (m) => m.userData.type === 'track' && m.userData.data === trackData
        );
        if (!planet) {
            const tracks = this.system.interactables.filter((m) => m.userData.type === 'track');
            if (this.currentTrackIndex >= 0 && this.currentTrackIndex < tracks.length) {
                planet = tracks[this.currentTrackIndex];
            }
        }
        return planet || null;
    }

    beginPlanetFocus(planet) {
        if (!planet) return;

        this.focusTarget = planet;
        this.system.highlight(planet);

        const planetSize = planet.userData.data?.size || 2;
        this.planetCameraDistance = THREE.MathUtils.clamp(planetSize * 22, 55, 150);

        const planetPos = this._planetFocusScratch;
        planet.getWorldPosition(planetPos);
        const camOffset = new THREE.Vector3().subVectors(
            this.engine.camera.position,
            planetPos
        );
        if (camOffset.lengthSq() > 1) {
            this._cinematicOrbitAngle = Math.atan2(camOffset.z, camOffset.x);
            this._cinematicOrbitPitch = THREE.MathUtils.clamp(
                Math.asin(camOffset.y / camOffset.length()),
                0.18,
                0.62
            );
        }

        this.engine.controls.autoRotate = false;
    }

    // --- MEDIA CONTROLS ---

    async playTrack() {
        if (!this.currentAlbum) return false;

        this.cancelPendingTrackEnd();
        this.audio.stopAudio();

        const trackData = this.currentAlbum.tracks[this.currentTrackIndex];
        let started = false;

        if (trackData.path) {
            started = await this.audio.playAudioFile(trackData.path);
        } else if (trackData.handle) {
            started = await this.audio.playAudioFile(trackData.handle);
        } else {
            started = this.audio.playTrackSim();
        }

        document.getElementById('btn-play').innerText = started ? '⏸' : '▶';
        this.updatePlayerUI();
        if (started) {
            await this.refreshTickerFromCurrentTrack();
        }

        if (!started) return false;

        // We need to find the mesh in the system view interactables that matches this data
        // Note: SystemView recreates meshes, so we need to find the new one based on data reference or ID
        // Since objects are recreated, the data reference might be the same object if passed through
        const planet = this.findPlanetMeshForTrack(trackData);
        this.beginPlanetFocus(planet);

        return true;
    }

    pauseTrack() {
        this.audio.pauseAudio();
        document.getElementById('btn-play').innerText = '▶';
        // Note: We stay focused on the planet
    }

    stopTrack() {
        this.audio.stopAudio();
        document.getElementById('btn-play').innerText = '▶';
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

    onTrackEnd() {
        if (this._trackEndResolve) {
            const resolve = this._trackEndResolve;
            this._trackEndResolve = null;
            if (this._trackEndTimeout) {
                clearTimeout(this._trackEndTimeout);
                this._trackEndTimeout = null;
            }
            resolve();
            return;
        }

        if (this.wandererManaging) return;

        this.nextTrack();
    }

    // Initialize or refill the shuffle bag with all track indices
    resetShuffleBag() {
        if (!this.currentAlbum) return;
        this.shuffleBag = [];
        this.shuffleHistory = [];
        for (let i = 0; i < this.currentAlbum.tracks.length; i++) {
            this.shuffleBag.push(i);
        }
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
        const idx = this.shuffleBag.pop();
        this.shuffleHistory.push(idx);
        return idx;
    }

    nextTrack() {
        if (!this.currentAlbum) return;
        if (this.isShuffle) {
            this.currentTrackIndex = this.getNextShuffleIndex();
        } else {
            this.currentTrackIndex = (this.currentTrackIndex + 1) % this.currentAlbum.tracks.length;
        }
        this.playTrack();
    }

    prevTrack() {
        if (!this.currentAlbum) return;
        if (this.isShuffle && this.shuffleHistory.length > 1) {
            this.shuffleHistory.pop();
            this.currentTrackIndex = this.shuffleHistory[this.shuffleHistory.length - 1];
        } else {
            this.currentTrackIndex = (this.currentTrackIndex - 1 + this.currentAlbum.tracks.length) % this.currentAlbum.tracks.length;
        }
        this.playTrack();
    }

    // --- Galaxy Wanderer (auto-travel between album systems) ---

    delay(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }

    cancelWandererCycle() {
        this._wandererAbort = true;
        this.warpGeneration++;
        this.cancelPendingTrackEnd();
    }

    cancelPendingTrackEnd() {
        if (this._trackEndResolve) {
            const resolve = this._trackEndResolve;
            this._trackEndResolve = null;
            if (this._trackEndTimeout) {
                clearTimeout(this._trackEndTimeout);
                this._trackEndTimeout = null;
            }
            resolve();
        }
    }

    waitForTrackEnd() {
        return new Promise((resolve) => {
            this._trackEndResolve = resolve;
            this._trackEndTimeout = setTimeout(() => {
                if (this._trackEndResolve === resolve) {
                    this._trackEndResolve = null;
                    this._trackEndTimeout = null;
                    resolve();
                }
            }, 900000);
        });
    }

    pickRandomAlbum(excludeAlbum) {
        const albums = this.allAlbums;
        if (!albums.length) return null;
        if (albums.length === 1) return albums[0];

        let pick;
        do {
            pick = albums[Math.floor(Math.random() * albums.length)];
        } while (pick === excludeAlbum);
        return pick;
    }

    pickRandomTrackIndex(excludeIndex = -1) {
        const len = this.currentAlbum?.tracks?.length || 0;
        if (len <= 1) return 0;

        let idx;
        do {
            idx = Math.floor(Math.random() * len);
        } while (idx === excludeIndex);
        return idx;
    }

    async returnToGalaxyView() {
        this._wandererExiting = true;
        this.exitSystem();
        this._wandererExiting = false;

        document.getElementById('mode-label').innerText = 'WANDERING...';
        document.getElementById('sub-label').innerText = 'Selecting new destination';
    }

    async runWandererAlbumVisit() {
        if (!this.wandererMode || !this.allAlbums.length) return;

        const album = this.pickRandomAlbum(this.currentAlbum);
        if (!album) return;

        document.getElementById('mode-label').innerText = 'WANDERING...';
        document.getElementById('sub-label').innerText = album.title;

        const entered = await this.enterSystem(album);
        if (!entered || !this.wandererMode) return;

        // Brief beat at system scale, then ease into the first planet
        await this.delay(800);

        for (let i = 0; i < this.wandererSongsPerAlbum; i++) {
            if (!this.wandererMode || this.mode !== 'SYSTEM') break;

            this.currentTrackIndex = this.pickRandomTrackIndex(
                i > 0 ? this.currentTrackIndex : -1
            );

            const started = await this.playTrack();
            if (!started) break;

            await this.waitForTrackEnd();
        }

        if (this.wandererMode && this.mode === 'SYSTEM') {
            await this.returnToGalaxyView();
        }
    }

    async startWandererSession() {
        if (this.mode === 'IDLE' || !this.allAlbums.length) return;
        if (this.wandererBusy) return;

        this._wandererAbort = false;
        this.wandererManaging = true;
        this.wandererBusy = true;

        try {
            if (this.mode === 'SYSTEM') {
                await this.returnToGalaxyView();
                if (!this.wandererMode || this._wandererAbort) return;
                await this.delay(2500);
            }

            while (this.wandererMode && this.mode === 'GALAXY' && !this._wandererAbort) {
                await this.runWandererAlbumVisit();
                if (!this.wandererMode || this._wandererAbort) break;
                await this.delay(2500);
            }
        } finally {
            this.wandererBusy = false;
            if (!this.wandererMode || this._wandererAbort) {
                this.wandererManaging = false;
            }
        }
    }

    // --- Info ticker ---

    async enrichTrackMetadata(trackData) {
        if (!trackData || trackData.metadataLoaded) return;

        if (trackData.path) {
            const meta = await readTrackMetadata(trackData.path);
            if (meta.title) trackData.metaTitle = meta.title;
            if (meta.artist) trackData.metaArtist = meta.artist;
            if (meta.album) trackData.metaAlbum = meta.album;
            if (meta.blurb) trackData.blurb = meta.blurb;
        } else if (trackData.handle) {
            const meta = await readTrackMetadata(trackData.handle);
            if (meta.title) trackData.metaTitle = meta.title;
            if (meta.artist) trackData.metaArtist = meta.artist;
            if (meta.album) trackData.metaAlbum = meta.album;
            if (meta.blurb) trackData.blurb = meta.blurb;
        }

        trackData.metadataLoaded = true;
    }

    async refreshTickerFromCurrentTrack() {
        if (!this.tickerEnabled) return;

        if (!this.currentAlbum || this.currentTrackIndex < 0) {
            this.ticker.showIdle();
            return;
        }

        const trackData = this.currentAlbum.tracks[this.currentTrackIndex];
        await this.enrichTrackMetadata(trackData);

        const albumName = this.currentAlbum.title;
        const trackTitle = trackData.metaTitle || trackData.title;
        const artistName = trackData.metaArtist || this.currentAlbum.artist || 'Unknown Artist';

        this.ticker.update({
            album: albumName,
            track: trackTitle,
            artist: artistName,
            blurb: trackData.blurb || null
        });
    }

    updatePlayerUI() {
        if (this.currentAlbum && this.currentTrackIndex > -1) {
            const t = this.currentAlbum.tracks[this.currentTrackIndex];
            document.getElementById('player-title').innerText = t.metaTitle || t.title;
            const artist = t.metaArtist || this.currentAlbum.artist || 'Unknown Artist';
            document.getElementById('player-artist').innerText = artist;
            if (this.tickerEnabled) {
                this.refreshTickerFromCurrentTrack();
            }
        } else {
            document.getElementById('player-title').innerText = "No Track Selected";
            document.getElementById('player-artist').innerText = "--";
            if (this.tickerEnabled) {
                this.ticker.showIdle();
            }
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

            // Full 360° cinematic orbit around the playing planet
            if (this.focusTarget) {
                const planetPos = this._planetFocusScratch;
                this.focusTarget.getWorldPosition(planetPos);

                this.engine.controls.target.lerp(planetPos, 0.04);

                this._cinematicOrbitAngle += dt * this.cinematicOrbitSpeed;

                const dist = this.planetCameraDistance;
                const pitch = this._cinematicOrbitPitch;
                const cosP = Math.cos(pitch);
                const idealOffset = this._idealCamScratch.set(
                    Math.cos(this._cinematicOrbitAngle) * dist * cosP,
                    dist * Math.sin(pitch),
                    Math.sin(this._cinematicOrbitAngle) * dist * cosP
                );

                const idealCam = new THREE.Vector3().addVectors(planetPos, idealOffset);
                this.engine.camera.position.lerp(idealCam, 0.028);
            }
        }

        this.engine.render();
    }
}