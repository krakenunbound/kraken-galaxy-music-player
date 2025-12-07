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

        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i];
        }
        return sum / this.dataArray.length; // Returns 0-255
    }

    toggleMute() {
        const t = this.ctx.currentTime;
        if (this.isMuted) {
            // Unmute
            this.masterGain.gain.setTargetAtTime(1.0, t, 0.1);
            this.isMuted = false;
        } else {
            // Mute
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

    // --- REAL AUDIO PLAYBACK ---

    async playAudioFile(fileHandle) {
        if (!this.initialized) return;

        // Clean up previous audio
        this.cleanupAudio();

        try {
            const file = await fileHandle.getFile();
            this.currentBlobUrl = URL.createObjectURL(file);

            this.currentAudioElement = new Audio(this.currentBlobUrl);
            this.currentAudioElement.crossOrigin = "anonymous";

            // Connect to Web Audio API for visualization
            this.currentSource = this.ctx.createMediaElementSource(this.currentAudioElement);
            this.currentSource.connect(this.musicGain);

            await this.currentAudioElement.play();
            this.isPlaying = true;
            this.isPaused = false;

            this.currentAudioElement.onended = () => {
                this.isPlaying = false;
                this.isPaused = false;
                if (this.onTrackEnd) {
                    this.onTrackEnd();
                }
            };

        } catch (err) {
            console.error("Error playing audio file:", err);
        }
    }

    pauseAudio() {
        if (this.currentAudioElement && this.isPlaying) {
            this.currentAudioElement.pause();
            this.isPlaying = false;
            this.isPaused = true;
        }
    }

    resumeAudio() {
        if (this.currentAudioElement && this.isPaused) {
            this.currentAudioElement.play();
            this.isPlaying = true;
            this.isPaused = false;
        }
    }

    stopAudio() {
        if (this.currentAudioElement) {
            this.currentAudioElement.pause();
            this.currentAudioElement.currentTime = 0;
        }
        this.isPlaying = false;
        this.isPaused = false;
    }

    cleanupAudio() {
        if (this.currentAudioElement) {
            this.currentAudioElement.pause();
            this.currentAudioElement.src = "";
            this.currentAudioElement = null;
        }
        if (this.currentBlobUrl) {
            URL.revokeObjectURL(this.currentBlobUrl);
            this.currentBlobUrl = null;
        }
        this.currentSource = null;
        this.isPlaying = false;
        this.isPaused = false;
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

    // Legacy method signature for compatibility
    playTrackSim() {
        console.warn("Simulation playback disabled. Use playAudioFile.");
    }

    playSound(type) {
        // Sounds removed as per user request
    }
}