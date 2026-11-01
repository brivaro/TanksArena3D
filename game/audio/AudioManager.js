export class AudioManager {
  constructor() {
    // Clean up any previous AudioManager instance so orphan BGM can never keep playing
    if (typeof window !== 'undefined') {
      if (window.__TANKS_ACTIVE_AUDIO__ && window.__TANKS_ACTIVE_AUDIO__ !== this) {
        try {
          window.__TANKS_ACTIVE_AUDIO__.dispose();
        } catch (_) {}
      }
      window.__TANKS_ACTIVE_AUDIO__ = this;
      try {
        document.querySelectorAll('audio[data-tanks-bgm="true"]').forEach(a => {
          try {
            a.pause();
            a.src = '';
            a.remove();
          } catch (_) {}
        });
      } catch (_) {}
    }

    this.ctx = null;
    this.masterGain = null;
    this.masterGainConnected = false;
    this.musicGain = null;
    this.noiseBuffer = null;
    this.initialized = false;
    this.unlockedOnMobile = false;
    this.disposed = false;
    this.isMuted = false;
    this.isMusicMuted = false;
    this.savedVolume = 0.34;
    this.musicVolume = 0.48;
    this.lastPlayed = {};

    // WebAudio BGM state (989KB optimized loop -> fast decode on Mobile & PC)
    this.bgmRawBuffer = null;
    this.bgmAudioBuffer = null;
    this.bgmSourceNode = null;
    this.bgmIsDecoding = false;
    this.bgmPlaying = false;

    try {
      this.isMuted = localStorage.getItem('tanks_sfx_muted') === 'true';
      this.isMusicMuted = localStorage.getItem('tanks_music_muted') === 'true';
    } catch (_) {}

    if (typeof window !== 'undefined') {
      // Pre-fetch the lightweight (<1MB) BGM loop immediately so it's ready in memory
      this.prefetchBgmData();

      this.handleUserGesture = () => {
        if (this.disposed) return;
        this.unlockAudioSynchronously();
      };

      // Listen to all mobile & desktop user interaction events
      window.addEventListener('touchstart', this.handleUserGesture, { capture: true, passive: true });
      window.addEventListener('touchend', this.handleUserGesture, { capture: true, passive: true });
      window.addEventListener('pointerdown', this.handleUserGesture, { capture: true, passive: true });
      window.addEventListener('mousedown', this.handleUserGesture, { capture: true, passive: true });
      window.addEventListener('click', this.handleUserGesture, { capture: true, passive: true });
      window.addEventListener('keydown', this.handleUserGesture, { capture: true, passive: true });

      // Pause/Resume cleanly when switching tabs or locking phone screen
      this.handleVisibilityChange = () => {
        if (this.disposed || !this.ctx) return;
        if (document.hidden) {
          if (this.ctx.state === 'running') {
            this.ctx.suspend().catch(() => {});
          }
        } else {
          if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
          }
          if (!this.isMusicMuted && !this.bgmPlaying) {
            this.startBgmPlayback();
          }
        }
      };
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  async prefetchBgmData() {
    if (this.disposed || this.bgmRawBuffer || this.bgmAudioBuffer) return;
    const urls = ['/music/bgm_loop.mp3', 'music/bgm_loop.mp3', '/music/0001_game_music_comprimido.mp3'];
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const arr = await res.arrayBuffer();
          if (arr && arr.byteLength > 1000) {
            this.bgmRawBuffer = arr;
            // If AudioContext already exists, decode and start immediately
            if (this.ctx) {
              this.decodeAndStartBgm();
            }
            return;
          }
        }
      } catch (_) {}
    }
  }

  decodeAndStartBgm() {
    if (this.disposed || !this.ctx) return;
    if (this.bgmAudioBuffer) {
      if (!this.isMusicMuted && !this.bgmPlaying) {
        this.startBgmNode();
      }
      return;
    }
    if (!this.bgmRawBuffer || this.bgmIsDecoding) return;

    this.bgmIsDecoding = true;
    try {
      // Clone ArrayBuffer so decodeAudioData never detaches the backup copy
      const bufferCopy = this.bgmRawBuffer.slice(0);
      this.ctx.decodeAudioData(
        bufferCopy,
        (decoded) => {
          this.bgmIsDecoding = false;
          if (this.disposed) return;
          this.bgmAudioBuffer = decoded;
          if (!this.isMusicMuted) {
            this.startBgmNode();
          }
        },
        () => {
          this.bgmIsDecoding = false;
        }
      );
    } catch (_) {
      this.bgmIsDecoding = false;
    }
  }

  startBgmNode() {
    if (this.disposed || !this.ctx || !this.musicGain || !this.bgmAudioBuffer) return;
    if (this.bgmPlaying && this.bgmSourceNode) {
      // Ensure gain reflects current mute state
      this.musicGain.gain.setValueAtTime(
        this.isMusicMuted ? 0 : this.musicVolume,
        this.ctx.currentTime
      );
      return;
    }

    this.stopBgmNode();

    try {
      const source = this.ctx.createBufferSource();
      source.buffer = this.bgmAudioBuffer;
      source.loop = true;
      this.musicGain.gain.setValueAtTime(
        this.isMusicMuted ? 0 : this.musicVolume,
        this.ctx.currentTime
      );
      source.connect(this.musicGain);
      source.onended = () => {
        if (this.bgmSourceNode === source) {
          this.bgmSourceNode = null;
          this.bgmPlaying = false;
        }
      };
      source.start(0);
      this.bgmSourceNode = source;
      this.bgmPlaying = true;
    } catch (_) {
      this.bgmPlaying = false;
    }
  }

  stopBgmNode() {
    this.bgmPlaying = false;
    if (this.bgmSourceNode) {
      try {
        this.bgmSourceNode.onended = null;
        this.bgmSourceNode.stop(0);
        this.bgmSourceNode.disconnect();
      } catch (_) {}
      this.bgmSourceNode = null;
    }
  }

  unlockAudioSynchronously() {
    if (this.disposed) return;
    if (!this.initialized) this.init();

    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().then(() => {
          if (!this.disposed && !this.isMusicMuted) {
            this.startBgmPlayback();
          }
        }).catch(() => {});
      }
      if (!this.unlockedOnMobile) {
        try {
          const silentBuf = this.ctx.createBuffer(1, 1, 22050);
          const src = this.ctx.createBufferSource();
          src.buffer = silentBuf;
          src.connect(this.ctx.destination);
          src.start(0);
          this.unlockedOnMobile = true;
        } catch (_) {}
      }
    }

    if (!this.isMusicMuted) {
      this.startBgmPlayback();
    }
  }

  startBgmPlayback() {
    if (this.disposed || this.isMusicMuted) return;
    if (!this.initialized) this.init();
    if (!this.ctx) return;

    if (this.bgmAudioBuffer) {
      this.startBgmNode();
    } else if (this.bgmRawBuffer) {
      this.decodeAndStartBgm();
    } else {
      this.prefetchBgmData();
    }
  }

  stopBgmPlayback() {
    if (this.musicGain && this.ctx) {
      try {
        this.musicGain.gain.setValueAtTime(0, this.ctx.currentTime);
      } catch (_) {}
    }
    this.stopBgmNode();
  }

  init() {
    if (this.initialized || this.disposed) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();

      // Master Gain for Game Sound Effects
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.savedVolume;
      if (!this.isMuted) {
        this.masterGain.connect(this.ctx.destination);
        this.masterGainConnected = true;
      }

      // Dedicated Gain for Background Music (independent of SFX mute)
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.isMusicMuted ? 0 : this.musicVolume;
      this.musicGain.connect(this.ctx.destination);

      // Pre-allocate shared white noise buffer once
      const bufferSize = Math.floor(this.ctx.sampleRate * 1.2);
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      this.initialized = true;

      // Start decoding BGM if prefetch already finished
      if (this.bgmRawBuffer) {
        this.decodeAndStartBgm();
      }
    } catch (e) {
      console.warn('Audio disabled:', e);
    }
  }

  resume() {
    if (this.disposed) return;
    this.unlockAudioSynchronously();
    this.syncBgmState();
  }

  syncBgmState() {
    if (this.disposed) return;
    if (!this.initialized) this.init();

    if (this.isMusicMuted) {
      this.stopBgmPlayback();
    } else {
      if (this.musicGain && this.ctx) {
        this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
      }
      this.startBgmPlayback();
    }
  }

  toggleMute() {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem('tanks_sfx_muted', String(this.isMuted));
    } catch (_) {}
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.cancelScheduledValues(0);
      this.masterGain.gain.value = this.isMuted ? 0 : this.savedVolume;
      if (this.isMuted && this.masterGainConnected) {
        try { this.masterGain.disconnect(); } catch (_) {}
        this.masterGainConnected = false;
      } else if (!this.isMuted && !this.masterGainConnected) {
        try {
          this.masterGain.connect(this.ctx.destination);
          this.masterGainConnected = true;
        } catch (_) {}
      }
    }
    return this.isMuted;
  }

  toggleMusic() {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.isMusicMuted = !this.isMusicMuted;
    try {
      localStorage.setItem('tanks_music_muted', String(this.isMusicMuted));
    } catch (_) {}
    this.syncBgmState();
    return this.isMusicMuted;
  }

  setMusicMuted(muted) {
    if (!this.initialized) this.init();
    this.isMusicMuted = Boolean(muted);
    try {
      localStorage.setItem('tanks_music_muted', String(this.isMusicMuted));
    } catch (_) {}
    this.syncBgmState();
    return this.isMusicMuted;
  }

  setVolume(vol) {
    this.savedVolume = Math.max(0, Math.min(1, vol));
    if (!this.isMuted && this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.savedVolume, this.ctx.currentTime);
    }
  }

  dispose() {
    this.disposed = true;
    this.stopBgmPlayback();
    if (typeof window !== 'undefined' && this.handleUserGesture) {
      window.removeEventListener('touchstart', this.handleUserGesture, { capture: true });
      window.removeEventListener('touchend', this.handleUserGesture, { capture: true });
      window.removeEventListener('pointerdown', this.handleUserGesture, { capture: true });
      window.removeEventListener('mousedown', this.handleUserGesture, { capture: true });
      window.removeEventListener('click', this.handleUserGesture, { capture: true });
      window.removeEventListener('keydown', this.handleUserGesture, { capture: true });
    }
    if (typeof document !== 'undefined' && this.handleVisibilityChange) {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (this.musicGain) {
      try { this.musicGain.disconnect(); } catch (_) {}
    }
    if (this.masterGain) {
      try { this.masterGain.disconnect(); } catch (_) {}
    }
    if (this.ctx) {
      try { this.ctx.close(); } catch (_) {}
      this.ctx = null;
    }
  }

  play(type, param = 1) {
    if (this.disposed) return;
    if (!this.initialized) this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.isMusicMuted && !this.bgmPlaying) {
      this.startBgmPlayback();
    }
    if (this.isMuted || !this.masterGainConnected) return;

    const t = this.ctx.currentTime;

    // Prevent audio node flooding during rapid fire or simultaneous multi-pellet bounces
    const minInterval = (type === 'shoot' || type === 'impact' || type === 'wood_pop') ? 0.032 : 0.045;
    if (this.lastPlayed[type] && (t - this.lastPlayed[type]) < minInterval) {
      return;
    }
    this.lastPlayed[type] = t;

    if (type === 'wood_pop') {
        // Warm hollow wooden toy block clack/knock for splash intro
        const baseFreq = 260 + ((param % 7) * 32);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(baseFreq * 1.4, t);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.65, t + 0.065);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.008, t + 0.07);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(t);
        osc.stop(t + 0.075);
    }
    else if (type === 'shoot') {
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
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
        
        osc.start(t);
        osc.stop(t + 0.17);
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
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };

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
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
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
            osc.onended = () => {
              osc.disconnect();
              gain.disconnect();
            };
            osc.start(start);
            osc.stop(start + 0.08);
        });
    }
    else if (type === 'explosion') {
        if (!this.noiseBuffer) return;
        const dur = 0.4;
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

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
        noise.onended = () => {
          noise.disconnect();
          filter.disconnect();
          gain.disconnect();
        };

        noise.start(t);
        noise.stop(t + dur);
    }
    else if (type === 'big_explosion') {
         if (!this.noiseBuffer) return;
         const dur = 0.85;
         const noise = this.ctx.createBufferSource();
         noise.buffer = this.noiseBuffer;
 
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
         sub.onended = () => {
           sub.disconnect();
           subGain.disconnect();
         };
         sub.start(t);
         sub.stop(t + 0.5);

         const gain = this.ctx.createGain();
         gain.gain.setValueAtTime(0.62, t);
         gain.gain.exponentialRampToValueAtTime(0.01, t + dur);
 
         noise.connect(filter);
         filter.connect(gain);
         gain.connect(this.masterGain);
         noise.onended = () => {
           noise.disconnect();
           filter.disconnect();
           gain.disconnect();
         };
 
         noise.start(t);
         noise.stop(t + dur);
    }
    else if (type === 'barrel_explosion') {
         if (!this.noiseBuffer) return;
         const dur = 1.1;
         const noise = this.ctx.createBufferSource();
         noise.buffer = this.noiseBuffer;

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
         subOsc.onended = () => {
           subOsc.disconnect();
           subGain.disconnect();
         };
         subOsc.start(t);
         subOsc.stop(t + 0.6);

         const gain = this.ctx.createGain();
         gain.gain.setValueAtTime(0.75, t);
         gain.gain.exponentialRampToValueAtTime(0.01, t + dur);

         noise.connect(filter);
         filter.connect(gain);
         gain.connect(this.masterGain);
         noise.onended = () => {
           noise.disconnect();
           filter.disconnect();
           gain.disconnect();
         };

         noise.start(t);
         noise.stop(t + dur);
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
             osc.onended = () => {
               osc.disconnect();
               gain.disconnect();
             };
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
         osc.onended = () => {
           osc.disconnect();
           gain.disconnect();
         };
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
             osc.onended = () => {
               osc.disconnect();
               gain.disconnect();
             };
             osc.start(start);
             osc.stop(start + 0.4);
         });
    }
  }
}
