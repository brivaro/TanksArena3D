
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3; 
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

  createAmbience() {
      if (!this.ctx) return;
      
      // Low drone for "Room Tone" / Tension
      const osc1 = this.ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.value = 60;
      
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = 100;

      const droneGain = this.ctx.createGain();
      droneGain.gain.value = 0.05;

      osc1.connect(droneGain);
      osc2.connect(droneGain);
      droneGain.connect(this.masterGain);
      
      osc1.start();
      osc2.start();
  }

  play(type) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    if (type === 'shoot') {
        // Pew pew
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(150, t + 0.15);
        
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start();
        osc.stop(t + 0.2);
    } 
    else if (type === 'impact') {
        // Metal ping/bounce
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.05);

        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(t + 0.06);
    }
    else if (type === 'explosion') {
        // Small explosion (Cork/Crate)
        const dur = 0.4;
        const bufferSize = this.ctx.sampleRate * dur;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, t);
        filter.frequency.linearRampToValueAtTime(100, t + dur);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + dur);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start();
    }
    else if (type === 'big_explosion') {
         // Tank explosion
         const dur = 0.8;
         const bufferSize = this.ctx.sampleRate * dur;
         const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
         const data = buffer.getChannelData(0);
         for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
 
         const noise = this.ctx.createBufferSource();
         noise.buffer = buffer;
 
         const filter = this.ctx.createBiquadFilter();
         filter.type = 'lowpass';
         filter.frequency.setValueAtTime(400, t);
         filter.frequency.linearRampToValueAtTime(50, t + dur);
 
         const gain = this.ctx.createGain();
         gain.gain.setValueAtTime(0.6, t);
         gain.gain.exponentialRampToValueAtTime(0.01, t + dur);
 
         noise.connect(filter);
         filter.connect(gain);
         gain.connect(this.masterGain);
 
         noise.start();
    }
  }
}
