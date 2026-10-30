export class AudioManager {
  constructor() {
    // Clean up any previous AudioManager instance or stray <audio> tags so orphan BGM can never keep playing
    if (typeof window !== 'undefined') {
      if (window.__TANKS_ACTIVE_AUDIO__ && window.__TANKS_ACTIVE_AUDIO__ !== this) {
        try {
          window.__TANKS_ACTIVE_AUDIO__.dispose();
        } catch (_) {}
      }
      window.__TANKS_ACTIVE_AUDIO__ = this;
      try {
        document.querySelectorAll('audio').forEach(a => {
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
    this.musicGain = null;
    this.masterGainConnected = false;
    this.musicGainConnected = false;
    this.noiseBuffer = null;
    this.initialized = false;
    this.disposed = false;
    this.isMuted = false;
    this.isMusicMuted = false;
    this.savedVolume = 0.32;
    this.musicVolume = 0.36;
    this.lastPlayed = {};

    // WebAudio Segmented Soundtrack State (35 fast 470KB 60s chunks of 0001_game_music_comprimido.mp3)
    this.totalBgmChunks = 35;
    this.currentChunkIndex = 0;
    this.rawChunkCache = new Map();     // index -> ArrayBuffer
    this.decodedChunkCache = new Map(); // index -> AudioBuffer
    this.fetchingChunks = new Map();    // index -> Promise<ArrayBuffer>
    this.activeBgmSources = new Set();  // Set<AudioBufferSourceNode>
    this.bgmPlayToken = 0;
    this.bgmPlaying = false;
    this.bgmStarting = false;

    try {
      this.isMuted = localStorage.getItem('tanks_sfx_muted') === 'true';
      this.isMusicMuted = localStorage.getItem('tanks_music_muted') === 'true';
    } catch (_) {}

    if (typeof window !== 'undefined') {
      // Pre-fetch first chunk (470 KB) immediately into memory so it starts with zero network delay
      this.prefetchRawChunk(0);

      this.handleUserGesture = (e) => {
        if (this.disposed) return;
        // Ignore clicks on music/mute toggle buttons so capture-phase doesn't fight the toggle handler
        if (e && e.target && typeof e.target.closest === 'function') {
          if (e.target.closest('[data-audio-toggle="true"]')) {
            return;
          }
        }
        if (!this.initialized) this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        if (!this.isMusicMuted && !this.bgmPlaying && !this.bgmStarting) {
          this.startBgmPlayback(this.currentChunkIndex);
        }
      };

      window.addEventListener('click', this.handleUserGesture, { capture: true, passive: true });
      window.addEventListener('pointerdown', this.handleUserGesture, { capture: true, passive: true });
      window.addEventListener('touchstart', this.handleUserGesture, { capture: true, passive: true });
      window.addEventListener('keydown', this.handleUserGesture, { capture: true, passive: true });
    }
  }

  prefetchRawChunk(index) {
    const idx = ((index % this.totalBgmChunks) + this.totalBgmChunks) % this.totalBgmChunks;
    if (this.rawChunkCache.has(idx)) {
      return Promise.resolve(this.rawChunkCache.get(idx));
    }
    if (this.fetchingChunks.has(idx)) {
      return this.fetchingChunks.get(idx);
    }

    const url = `/music/bgm_${idx}.mp3`;
    const promise = fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then(buf => {
        if (this.rawChunkCache.size > 4) {
          const oldestKey = this.rawChunkCache.keys().next().value;
          if (oldestKey !== idx && oldestKey !== 0) {
            this.rawChunkCache.delete(oldestKey);
          }
        }
        this.rawChunkCache.set(idx, buf);
        this.fetchingChunks.delete(idx);
        return buf;
      })
      .catch(err => {
        this.fetchingChunks.delete(idx);
        console.warn('BGM chunk fetch warning:', err);
        return null;
      });

    this.fetchingChunks.set(idx, promise);
    return promise;
  }

  async decodeChunk(index) {
    const idx = ((index % this.totalBgmChunks) + this.totalBgmChunks) % this.totalBgmChunks;
    if (this.decodedChunkCache.has(idx)) {
      return this.decodedChunkCache.get(idx);
    }
    if (!this.ctx) this.init();
    if (!this.ctx || this.disposed) return null;

    const rawBuf = await this.prefetchRawChunk(idx);
    if (!rawBuf || !this.ctx || this.disposed) return null;

    try {
      const copyBuf = rawBuf.slice(0);
      const audioBuffer = await this.ctx.decodeAudioData(copyBuf);
      if (this.decodedChunkCache.size > 3) {
        const oldestKey = this.decodedChunkCache.keys().next().value;
        if (oldestKey !== idx) {
          this.decodedChunkCache.delete(oldestKey);
        }
      }
      this.decodedChunkCache.set(idx, audioBuffer);
      return audioBuffer;
    } catch (e) {
      console.warn('BGM decode warning:', e);
      return null;
    }
  }

  async startBgmPlayback(chunkIndex = this.currentChunkIndex) {
    if (this.disposed || this.isMusicMuted) return;
    if (this.bgmPlaying || this.bgmStarting) return;
    if (!this.initialized) this.init();
    if (!this.ctx || !this.musicGain) return;

    const myToken = ++this.bgmPlayToken;
    this.bgmStarting = true;

    try {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume().catch(() => {});
      }

      if (this.disposed || this.isMusicMuted || myToken !== this.bgmPlayToken) {
        this.bgmStarting = false;
        return;
      }

      const idx = ((chunkIndex % this.totalBgmChunks) + this.totalBgmChunks) % this.totalBgmChunks;
      const audioBuffer = await this.decodeChunk(idx);

      if (this.disposed || this.isMusicMuted || myToken !== this.bgmPlayToken || !audioBuffer) {
        this.bgmStarting = false;
        return;
      }

      // Stop any previous sources before starting the new one
      this.stopAllActiveSources();

      // Ensure musicGain is connected and audible
      if (!this.musicGainConnected && this.ctx) {
        try {
          this.musicGain.connect(this.ctx.destination);
          this.musicGainConnected = true;
        } catch (_) {}
      }
      this.musicGain.gain.cancelScheduledValues(0);
      this.musicGain.gain.value = this.musicVolume;

      const source = this.ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.musicGain);

      this.currentChunkIndex = idx;
      this.activeBgmSources.add(source);
      this.bgmStarting = false;
      this.bgmPlaying = true;

      // Pre-fetch and decode next 60s segment in background for seamless continuation
      const nextIdx = (idx + 1) % this.totalBgmChunks;
      this.decodeChunk(nextIdx);

      source.onended = () => {
        this.activeBgmSources.delete(source);
        try { source.disconnect(); } catch (_) {}
        if (this.activeBgmSources.size === 0) {
          this.bgmPlaying = false;
        }
        if (!this.disposed && !this.isMusicMuted && myToken === this.bgmPlayToken) {
          this.currentChunkIndex = nextIdx;
          this.startBgmPlayback(nextIdx);
        }
      };

      source.start(0);
    } catch (e) {
      this.bgmStarting = false;
      this.bgmPlaying = false;
      console.warn('BGM start error:', e);
    }
  }

  stopAllActiveSources() {
    for (const src of this.activeBgmSources) {
      try {
        src.onended = null;
        src.stop(0);
      } catch (_) {}
      try {
        src.disconnect();
      } catch (_) {}
    }
    this.activeBgmSources.clear();
  }

  stopBgmPlayback() {
    this.bgmPlayToken++;
    this.bgmPlaying = false;
    this.bgmStarting = false;
    this.stopAllActiveSources();
  }

  init() {
    if (this.initialized || this.disposed) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();

      // 1. Master Gain for Game Sound Effects
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.savedVolume;
      if (!this.isMuted) {
        this.masterGain.connect(this.ctx.destination);
        this.masterGainConnected = true;
      }

      // 2. Dedicated Gain for Background Music Soundtrack
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.isMusicMuted ? 0 : this.musicVolume;
      if (!this.isMusicMuted) {
        this.musicGain.connect(this.ctx.destination);
        this.musicGainConnected = true;
      }

      // Pre-allocate shared white noise buffer once
      const bufferSize = Math.floor(this.ctx.sampleRate * 1.2);
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      this.initialized = true;
    } catch (e) {
      console.warn('Audio disabled:', e);
    }
  }

  resume() {
    if (this.disposed) return;
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.syncBgmState();
  }

  syncBgmState() {
    if (this.disposed) return;
    if (!this.initialized) this.init();
    if (!this.ctx || !this.musicGain) return;

    if (this.isMusicMuted) {
      this.stopBgmPlayback();
      try {
        this.musicGain.gain.cancelScheduledValues(0);
        this.musicGain.gain.value = 0;
      } catch (_) {}
      if (this.musicGainConnected) {
        try {
          this.musicGain.disconnect();
        } catch (_) {}
        this.musicGainConnected = false;
      }
    } else {
      if (!this.musicGainConnected) {
        try {
          this.musicGain.connect(this.ctx.destination);
          this.musicGainConnected = true;
        } catch (_) {}
      }
      try {
        this.musicGain.gain.cancelScheduledValues(0);
        this.musicGain.gain.value = this.musicVolume;
      } catch (_) {}
      if (!this.bgmPlaying && !this.bgmStarting) {
        this.startBgmPlayback(this.currentChunkIndex);
      }
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
      window.removeEventListener('click', this.handleUserGesture, { capture: true });
      window.removeEventListener('pointerdown', this.handleUserGesture, { capture: true });
      window.removeEventListener('touchstart', this.handleUserGesture, { capture: true });
      window.removeEventListener('keydown', this.handleUserGesture, { capture: true });
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
    if (!this.isMusicMuted && !this.bgmPlaying && !this.bgmStarting) {
      this.startBgmPlayback(this.currentChunkIndex);
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
