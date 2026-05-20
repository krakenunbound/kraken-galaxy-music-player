export class AudioController {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        // Mixer Channels
        this.masterGain = this.ctx.createGain(); // Main output
        this.musicGain = this.ctx.createGain(); // Music channel
        this.sfxGain = this.ctx.createGain();   // SFX channel

        // Wiring: Music/SFX -> Master -> Destination
        this.musicGain.connect(this.masterGain);
        this.sfxGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        // Analysis
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 256;
        this.musicGain.connect(this.analyser);
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

        // Defaults
        this.masterGain.gain.value = 1.0;
        this.musicGain.gain.value = 0.5;
        this.sfxGain.gain.value = 0.5;

        this.initialized = false;
        this.isMuted = false;
        this.isPlaying = false;
        this.isPaused = false;
        this.currentAudioElement = null;
        this.currentBlobUrl = null;
        this.currentSource = null;
        this._playId = 0;

        // Callbacks
        this.onTrackEnd = null;
    }

    async init() {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
        this.initialized = true;
    }

    getAudioData() {
        if (!this.initialized) return 0;
        this.analyser.getByteFrequencyData(this.dataArray);

        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i];
        }
        return sum / this.dataArray.length;
    }

    toggleMute() {
        const t = this.ctx.currentTime;
        if (this.isMuted) {
            this.masterGain.gain.setTargetAtTime(1.0, t, 0.1);
            this.isMuted = false;
        } else {
            this.masterGain.gain.setTargetAtTime(0, t, 0.1);
            this.isMuted = true;
        }
        return this.isMuted;
    }

    setMusicVolume(val) {
        this.musicGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.1);
    }

    setSfxVolume(val) {
        this.sfxGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.1);
    }

    resolveFileSrc(path) {
        if (window.__TAURI__?.core?.convertFileSrc) {
            return window.__TAURI__.core.convertFileSrc(path);
        }
        return path;
    }

    async playAudioFile(fileHandleOrPath) {
        if (!this.initialized) await this.init();

        const playId = ++this._playId;
        this.hardStop();

        try {
            let audioUrl;

            if (typeof fileHandleOrPath === 'string') {
                audioUrl = this.resolveFileSrc(fileHandleOrPath);
                this.currentBlobUrl = null;
            } else {
                const file = await fileHandleOrPath.getFile();
                if (playId !== this._playId) return false;
                this.currentBlobUrl = URL.createObjectURL(file);
                audioUrl = this.currentBlobUrl;
            }

            if (playId !== this._playId) return false;

            const element = new Audio(audioUrl);
            element.crossOrigin = "anonymous";

            this.currentAudioElement = element;
            this.currentSource = this.ctx.createMediaElementSource(element);
            this.currentSource.connect(this.musicGain);

            element.onended = () => {
                if (playId !== this._playId) return;
                this.isPlaying = false;
                this.isPaused = false;
                if (this.onTrackEnd) {
                    this.onTrackEnd();
                }
            };

            await element.play();

            if (playId !== this._playId) {
                element.pause();
                element.removeAttribute('src');
                element.load();
                return false;
            }

            this.isPlaying = true;
            this.isPaused = false;
            return true;
        } catch (err) {
            console.error("Error playing audio file:", err);
            if (playId === this._playId) {
                this.hardStop();
            }
            return false;
        }
    }

    pauseAudio() {
        if (this.currentAudioElement && this.isPlaying) {
            this.currentAudioElement.pause();
            this.isPlaying = false;
            this.isPaused = true;
        }
    }

    async resumeAudio() {
        if (this.currentAudioElement && this.isPaused) {
            try {
                await this.currentAudioElement.play();
                this.isPlaying = true;
                this.isPaused = false;
                return true;
            } catch (err) {
                console.error("Error resuming audio:", err);
                return false;
            }
        }
        return false;
    }

    stopAudio() {
        this._playId++;
        this.hardStop();
    }

    hardStop() {
        if (this.currentSource) {
            try {
                this.currentSource.disconnect();
            } catch (_) { /* already disconnected */ }
            this.currentSource = null;
        }
        if (this.currentAudioElement) {
            const el = this.currentAudioElement;
            el.onended = null;
            el.pause();
            el.removeAttribute('src');
            el.load();
            this.currentAudioElement = null;
        }
        if (this.currentBlobUrl) {
            URL.revokeObjectURL(this.currentBlobUrl);
            this.currentBlobUrl = null;
        }
        this.isPlaying = false;
        this.isPaused = false;
    }

    /** @deprecated Use hardStop — kept for any legacy callers */
    cleanupAudio() {
        this.hardStop();
    }

    seek(time) {
        if (this.currentAudioElement) {
            this.currentAudioElement.currentTime = time;
        }
    }

    get currentTime() {
        return this.currentAudioElement ? this.currentAudioElement.currentTime : 0;
    }

    get duration() {
        return this.currentAudioElement ? this.currentAudioElement.duration : 0;
    }

    playTrackSim() {
        console.warn("Simulation playback: no audio file handle for this track.");
        return false;
    }
}
