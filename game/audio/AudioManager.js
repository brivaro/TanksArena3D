
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.initialized = false;
    this.isMuted = false;
    this.savedVolume = 0.32;
  }

  init() {
    if (this.initialized) return;
    
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.savedVolume; 
      this.masterGain.connect(this.ctx.destination);
      
      this.createAmbience();
      this.initialized = true;
    } catch (e) {
      console.warn('Audio disabled:', e);
    }
  }

  resume() {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.savedVolume, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  setVolume(vol) {
    this.savedVolume = Math.max(0, Math.min(1, vol));
    if (!this.isMuted && this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.savedVolume, this.ctx.currentTime);
    }
  }

  createAmbience() {
      if (!this.ctx) return;
      
      const osc1 = this.ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.value = 60;
      
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = 100;

      const droneGain = this.ctx.createGain();
      droneGain.gain.value = 0.04;

      osc1.connect(droneGain);
      osc2.connect(droneGain);
      droneGain.connect(this.masterGain);
      
      osc1.start();
      osc2.start();
  }

  play(type, param = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    if (type === 'shoot') {
        // Punchy Cannon Thump + High Mechanical Snap
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, t);
        osc.frequency.exponentialRampToValueAtTime(110, t + 0.16);
        
        gain.gain.setValueAtTime(0.24, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.16);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(t);
        osc.stop(t + 0.18);
    } 
    else if (type === 'impact') {
        // Crisp Metallic Ricochet Ping
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(980, t);
        osc.frequency.exponentialRampToValueAtTime(280, t + 0.08);

        gain.gain.setValueAtTime(0.14, t);
        gain.gain.exponentialRampToValueAtTime(0.008, t + 0.08);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(t);
        osc.stop(t + 0.09);
    }
    else if (type === 'combo') {
        // Escalating pitch chime based on combo count (param = streak)
        const baseFreq = 440 * Math.pow(1.12, Math.min(param, 8));
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, t);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, t + 0.18);

        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.008, t + 0.22);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.24);
    }
    else if (type === 'mine_drop') {
        // Tactical double-beep arming sound
        [880, 1320].forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const start = t + idx * 0.08;
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0.18, start);
            gain.gain.exponentialRampToValueAtTime(0.008, start + 0.07);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(start);
            osc.stop(start + 0.08);
        });
    }
    else if (type === 'explosion') {
        const dur = 0.4;
        const bufferSize = this.ctx.sampleRate * dur;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(850, t);
        filter.frequency.linearRampToValueAtTime(100, t + dur);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.42, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + dur);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(t);
    }
    else if (type === 'big_explosion') {
         const dur = 0.85;
         const bufferSize = this.ctx.sampleRate * dur;
         const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
         const data = buffer.getChannelData(0);
         for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
 
         const noise = this.ctx.createBufferSource();
         noise.buffer = buffer;
 
         const filter = this.ctx.createBiquadFilter();
         filter.type = 'lowpass';
         filter.frequency.setValueAtTime(480, t);
         filter.frequency.linearRampToValueAtTime(45, t + dur);
 
         // Sub-bass punch
         const sub = this.ctx.createOscillator();
         const subGain = this.ctx.createGain();
         sub.type = 'sine';
         sub.frequency.setValueAtTime(120, t);
         sub.frequency.exponentialRampToValueAtTime(28, t + 0.45);
         subGain.gain.setValueAtTime(0.55, t);
         subGain.gain.exponentialRampToValueAtTime(0.01, t + 0.48);
         sub.connect(subGain);
         subGain.connect(this.masterGain);
         sub.start(t);
         sub.stop(t + 0.5);

         const gain = this.ctx.createGain();
         gain.gain.setValueAtTime(0.62, t);
         gain.gain.exponentialRampToValueAtTime(0.01, t + dur);
 
         noise.connect(filter);
         filter.connect(gain);
         gain.connect(this.masterGain);
 
         noise.start(t);
    }
    else if (type === 'barrel_explosion') {
         const dur = 1.1;
         const bufferSize = this.ctx.sampleRate * dur;
         const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
         const data = buffer.getChannelData(0);
         for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

         const noise = this.ctx.createBufferSource();
         noise.buffer = buffer;

         const filter = this.ctx.createBiquadFilter();
         filter.type = 'lowpass';
         filter.frequency.setValueAtTime(650, t);
         filter.frequency.exponentialRampToValueAtTime(40, t + dur);

         const subOsc = this.ctx.createOscillator();
         const subGain = this.ctx.createGain();
         subOsc.type = 'sine';
         subOsc.frequency.setValueAtTime(140, t);
         subOsc.frequency.exponentialRampToValueAtTime(25, t + 0.5);
         subGain.gain.setValueAtTime(0.7, t);
         subGain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
         subOsc.connect(subGain);
         subGain.connect(this.masterGain);
         subOsc.start(t);
         subOsc.stop(t + 0.6);

         const gain = this.ctx.createGain();
         gain.gain.setValueAtTime(0.75, t);
         gain.gain.exponentialRampToValueAtTime(0.01, t + dur);

         noise.connect(filter);
         filter.connect(gain);
         gain.connect(this.masterGain);

         noise.start(t);
    }
    else if (type === 'powerup') {
         const freqs = [523.25, 659.25, 783.99, 1046.50];
         freqs.forEach((freq, idx) => {
             const osc = this.ctx.createOscillator();
             const gain = this.ctx.createGain();
             const start = t + idx * 0.07;
             osc.type = 'sine';
             osc.frequency.setValueAtTime(freq, start);

             gain.gain.setValueAtTime(0.25, start);
             gain.gain.exponentialRampToValueAtTime(0.005, start + 0.28);

             osc.connect(gain);
             gain.connect(this.masterGain);
             osc.start(start);
             osc.stop(start + 0.3);
         });
    }
    else if (type === 'boost') {
         const osc = this.ctx.createOscillator();
         const gain = this.ctx.createGain();
         osc.type = 'sawtooth';
         osc.frequency.setValueAtTime(220, t);
         osc.frequency.exponentialRampToValueAtTime(680, t + 0.25);

         gain.gain.setValueAtTime(0.18, t);
         gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

         osc.connect(gain);
         gain.connect(this.masterGain);
         osc.start(t);
         osc.stop(t + 0.32);
    }
    else if (type === 'victory') {
         const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
         notes.forEach((freq, idx) => {
             const osc = this.ctx.createOscillator();
             const gain = this.ctx.createGain();
             const start = t + idx * 0.09;
             osc.type = 'triangle';
             osc.frequency.setValueAtTime(freq, start);
             gain.gain.setValueAtTime(0.26, start);
             gain.gain.exponentialRampToValueAtTime(0.008, start + 0.38);
             osc.connect(gain);
             gain.connect(this.masterGain);
             osc.start(start);
             osc.stop(start + 0.4);
         });
    }
  }
}
