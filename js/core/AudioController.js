/*
    Handles the Web Audio API.
    EXPANSION: This is where you would add methods to load MP3s or connect to an API.
*/
export class AudioController {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3;
        this.masterGain.connect(this.ctx.destination);
        this.initialized = false;
    }

    async init() {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
        this.initialized = true;
        this.startAmbientDrone();
    }

    startAmbientDrone() {
        // Creates that deep space hum
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.value = 50;
        
        filter.type = 'lowpass';
        filter.frequency.value = 120;

        gain.gain.value = 0.15;

        osc.connect(filter).connect(gain).connect(this.masterGain);
        osc.start();

        // LFO to modulate the drone so it feels alive
        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.1;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 50;
        lfo.connect(lfoGain).connect(filter.frequency);
        lfo.start();
    }

    playSound(type) {
        if (!this.initialized) return;
        const t = this.ctx.currentTime;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain).connect(this.masterGain);

        if (type === 'warp') {
            // Sci-fi Warp Sound
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, t);
            osc.frequency.exponentialRampToValueAtTime(6000, t + 2.0);
            
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.5, t + 0.5);
            gain.gain.linearRampToValueAtTime(0, t + 2.0);
            
            osc.start();
            osc.stop(t + 2.0);
        } else if (type === 'ui_hover') {
            // High pitch beep
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, t);
            gain.gain.setValueAtTime(0.05, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
            osc.start();
            osc.stop(t + 0.1);
        } else if (type === 'scan') {
            // Data processing sound
            osc.type = 'square';
            osc.frequency.setValueAtTime(800, t);
            osc.frequency.exponentialRampToValueAtTime(200, t + 0.3);
            gain.gain.setValueAtTime(0.05, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            osc.start();
            osc.stop(t + 0.3);
        }
    }
}