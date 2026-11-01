// Note frequency helper (MIDI note number -> Hz)
function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// --- Composed 16-Step (1-Bar) & 64-Step (4-Bar) Toy Military March Patterns (Wii Play Style) ---
// MIDI Reference:
// C2=36, D2=38, E2=40, F2=41, G2=43, A2=45, Bb2=46, B2=47
// C3=48, D3=50, Eb3=51, E3=52, F3=53, F#3=54, G3=55, Ab3=56, A3=57, Bb3=58, B3=59
// C4=60, D4=62, Eb4=63, E4=64, F4=65, F#4=66, G4=67, Ab4=68, A4=69, Bb4=70, B4=71
// C5=72, D5=74, Eb5=75, E5=76, F5=77, G5=79, A5=81, C6=84

const MARCH_THEMES = {
  // 1. TEMA DE COMBATE ESTÁNDAR (120 BPM - Fiel a Wii Play Tanks: Marcha juguetona en Do Mayor / Sol)
  march_standard: {
    bpm: 120,
    // 64 steps (4 bars of 16th notes)
    tuba: [
      // Bar 1 (C major oom-pah)
      48, 0, 0, 0,  43, 0, 0, 0,  48, 0, 0, 0,  43, 0, 45, 0,
      // Bar 2 (C -> G)
      48, 0, 0, 0,  43, 0, 0, 0,  43, 0, 0, 0,  38, 0, 43, 0,
      // Bar 3 (F -> C)
      41, 0, 0, 0,  48, 0, 0, 0,  48, 0, 0, 0,  43, 0, 0, 0,
      // Bar 4 (G7 turnaround -> C)
      43, 0, 47, 0,  50, 0, 43, 0,  48, 0, 43, 0,  48, 0, 0, 0
    ],
    brass: [
      // Bar 1: Quirky staccato bugle call
      60, 0, 64, 0,  67, 0, 64, 0,  69, 0, 67, 0,  64, 0, 0, 0,
      // Bar 2: Playful answer
      62, 0, 65, 0,  64, 0, 62, 0,  67, 0, 0, 0,   55, 0, 0, 0,
      // Bar 3: Climbing toy march
      65, 0, 69, 0,  72, 0, 69, 0,  67, 0, 64, 0,  60, 0, 64, 0,
      // Bar 4: Cadence
      62, 0, 67, 0,  65, 0, 62, 0,  60, 0, 0, 0,   0,  0, 0, 0
    ],
    piccolo: [
      // Bar 1
      0,  0, 0,  0,  79, 0, 76, 0,  0,  0, 0,  0,  72, 76, 79, 0,
      // Bar 2
      0,  0, 0,  0,  0,  0, 0,  0,  79, 77, 76, 74, 79, 0,  0,  0,
      // Bar 3
      0,  0, 81, 0,  84, 0, 81, 0,  79, 0, 76, 0,  72, 0,  0,  0,
      // Bar 4
      74, 0, 79, 0,  77, 0, 74, 0,  72, 0, 76, 79, 84, 0,  0,  0
    ],
    // Snare pattern per 16-step bar: 1=hit, 2=accent, 3=rudiment roll
    snareBar: [1, 0, 1, 0,  2, 0, 1, 3,  1, 0, 1, 0,  2, 0, 3, 1],
    kickBar:  [1, 0, 0, 0,  0, 0, 0, 0,  1, 0, 0, 0,  0, 0, 1, 0],
    cymbalBar:[1, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0,  1, 0, 0, 0],
    useMarimba: false,
    mutedBrass: false
  },

  // 2. COMBATE TENSO / ÚLTIMO TANQUE ENEMIGO (138 BPM - Menor armónica urgente)
  march_danger: {
    bpm: 138,
    tuba: [
      // Bar 1 (A minor urgent walking tuba)
      45, 0, 52, 0,  45, 0, 52, 0,  45, 0, 48, 0,  52, 0, 50, 0,
      // Bar 2 (D minor -> E7)
      50, 0, 45, 0,  50, 0, 45, 0,  40, 0, 47, 0,  52, 0, 40, 0,
      // Bar 3 (F -> E7)
      41, 0, 48, 0,  41, 0, 48, 0,  40, 0, 47, 0,  52, 0, 47, 0,
      // Bar 4 (A minor tension turnaround)
      45, 0, 47, 0,  48, 0, 50, 0,  52, 0, 40, 0,  45, 0, 0,  0
    ],
    brass: [
      // Bar 1: Urgent minor stabs
      69, 0, 69, 0,  72, 0, 69, 0,  76, 0, 0, 0,  75, 0, 76, 0,
      // Bar 2
      74, 0, 72, 0,  71, 0, 69, 0,  68, 0, 71, 0, 76, 0, 0,  0,
      // Bar 3
      65, 0, 69, 0,  72, 0, 76, 0,  74, 0, 71, 0, 68, 0, 71, 0,
      // Bar 4
      69, 0, 72, 0,  71, 0, 68, 0,  69, 0, 0,  0, 69, 0, 0,  0
    ],
    piccolo: [
      // Nervous woodwind runs
      81, 76, 81, 76, 84, 81, 76, 0,  88, 0, 0, 0,  87, 88, 0, 0,
      86, 84, 83, 81, 80, 0,  0,  0,  80, 83, 86, 88, 0, 0, 0, 0,
      77, 81, 84, 88, 86, 83, 80, 76, 81, 0, 84, 0, 83, 0, 80, 0,
      81, 0,  0,  0,  80, 81, 83, 84, 81, 0, 0,  0, 0,  0, 0,  0
    ],
    snareBar: [2, 1, 1, 3,  2, 0, 3, 1,  2, 1, 1, 3,  2, 3, 2, 1],
    kickBar:  [1, 0, 0, 0,  1, 0, 0, 0,  1, 0, 0, 0,  1, 0, 1, 0],
    cymbalBar:[1, 0, 0, 0,  0, 0, 0, 0,  1, 0, 0, 0,  1, 0, 0, 0],
    useMarimba: false,
    mutedBrass: false
  },

  // 3. ENFRENTAMIENTO CON TANQUE JEFE (116 BPM - Marcha Pesada en Do Menor)
  march_boss: {
    bpm: 116,
    tuba: [
      // Heavy menacing ostinato in C minor
      36, 0, 36, 0,  43, 0, 39, 0,  36, 0, 0, 0,  43, 0, 42, 0,
      36, 0, 36, 0,  43, 0, 39, 0,  41, 0, 39, 0, 38, 0, 43, 0,
      36, 0, 36, 0,  44, 0, 43, 0,  36, 0, 39, 0, 42, 0, 43, 0,
      44, 0, 43, 0,  41, 0, 39, 0,  38, 0, 43, 0, 36, 0, 0,  0
    ],
    brass: [
      // Heavy low brass menace
      60, 0, 60, 0,  63, 0, 60, 0,  66, 0, 67, 0, 63, 0, 0,  0,
      65, 0, 63, 0,  62, 0, 60, 0,  59, 0, 62, 0, 67, 0, 0,  0,
      68, 0, 67, 0,  63, 0, 60, 0,  66, 0, 67, 0, 72, 0, 0,  0,
      68, 0, 67, 0,  65, 0, 63, 0,  62, 0, 59, 0, 60, 0, 0,  0
    ],
    piccolo: [
      0,  0, 0,  0,  75, 0, 72, 0,  78, 0, 79, 0, 75, 0, 0,  0,
      77, 0, 75, 0,  74, 0, 72, 0,  71, 0, 74, 0, 79, 0, 0,  0,
      80, 0, 79, 0,  75, 0, 72, 0,  78, 0, 79, 0, 84, 0, 0,  0,
      80, 79, 77, 75, 74, 0, 71, 0, 72, 0, 0,  0, 0,  0, 0,  0
    ],
    snareBar: [2, 0, 3, 1,  2, 0, 1, 0,  2, 0, 3, 1,  2, 3, 2, 0],
    kickBar:  [1, 0, 1, 0,  0, 0, 1, 0,  1, 0, 1, 0,  0, 0, 1, 0],
    cymbalBar:[1, 0, 0, 0,  1, 0, 0, 0,  1, 0, 0, 0,  1, 0, 0, 0],
    useMarimba: false,
    mutedBrass: false
  },

  // 4. NIVEL LABERINTO / SIGILO NOCTURNO (112 BPM - Muted brass, tip-toe snare & marimba)
  march_stealth: {
    bpm: 112,
    tuba: [
      // Sneaky tip-toe bassoon/tuba in D Dorian
      50, 0, 0, 0,  57, 0, 0, 0,  53, 0, 0, 0,  57, 0, 55, 0,
      50, 0, 0, 0,  57, 0, 0, 0,  48, 0, 0, 0,  55, 0, 57, 0,
      50, 0, 0, 0,  58, 0, 0, 0,  57, 0, 0, 0,  52, 0, 0,  0,
      50, 0, 53, 0, 57, 0, 55, 0,  50, 0, 0, 0,  0,  0, 0,  0
    ],
    brass: [
      // Sparse muted horn stabs
      62, 0, 0, 0,  65, 0, 64, 0,  0,  0, 69, 0,  67, 0, 0, 0,
      0,  0, 62, 0, 65, 0, 0,  0,  60, 0, 64, 0,  62, 0, 0, 0,
      65, 0, 0, 0,  70, 0, 69, 0,  0,  0, 67, 0,  64, 0, 0, 0,
      62, 0, 65, 0, 69, 0, 67, 0,  62, 0, 0,  0,  0,  0, 0, 0
    ],
    piccolo: [
      // Playful wooden marimba accents
      74, 0, 77, 0,  81, 0, 79, 0,  74, 0, 0, 0,  81, 0, 79, 0,
      74, 0, 77, 0,  81, 0, 0,  0,  72, 0, 76, 0, 79, 0, 0,  0,
      77, 0, 82, 0,  81, 0, 79, 0,  76, 0, 79, 0, 81, 0, 0,  0,
      74, 0, 77, 0,  81, 0, 79, 0,  74, 0, 0,  0, 0,  0, 0,  0
    ],
    snareBar: [1, 0, 0, 1,  0, 0, 1, 0,  1, 0, 0, 1,  0, 0, 3, 0],
    kickBar:  [1, 0, 0, 0,  0, 0, 0, 0,  1, 0, 0, 0,  0, 0, 0, 0],
    cymbalBar:[0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0],
    useMarimba: true,
    mutedBrass: true
  },

  // 5. CAOS ARCADE / ACCIÓN RÁPIDA (126 BPM - Fa Mayor brillante y juguetón)
  march_arcade: {
    bpm: 126,
    tuba: [
      // Bouncy F major arcade march
      41, 0, 48, 0,  45, 0, 48, 0,  41, 0, 48, 0,  46, 0, 48, 0,
      41, 0, 48, 0,  45, 0, 48, 0,  48, 0, 43, 0,  48, 0, 52, 0,
      46, 0, 53, 0,  46, 0, 53, 0,  41, 0, 48, 0,  45, 0, 48, 0,
      43, 0, 48, 0,  48, 0, 43, 0,  41, 0, 48, 0,  41, 0, 0,  0
    ],
    brass: [
      65, 0, 69, 0,  72, 0, 69, 0,  74, 0, 72, 0,  69, 0, 65, 0,
      67, 0, 72, 0,  69, 0, 65, 0,  67, 0, 0,  0,  60, 0, 64, 0,
      70, 0, 74, 0,  72, 0, 70, 0,  69, 0, 72, 0,  65, 0, 69, 0,
      67, 0, 72, 0,  70, 0, 67, 0,  65, 0, 0,  0,  0,  0, 0,  0
    ],
    piccolo: [
      77, 0, 81, 0,  84, 0, 81, 0,  86, 84, 81, 0, 77, 0, 0,  0,
      79, 0, 84, 0,  81, 0, 77, 0,  79, 77, 76, 74, 72, 0, 0, 0,
      82, 0, 86, 0,  84, 0, 82, 0,  81, 0,  84, 0,  77, 0, 0, 0,
      79, 0, 84, 0,  82, 0, 79, 0,  77, 0,  81, 84, 89, 0, 0, 0
    ],
    snareBar: [1, 0, 1, 3,  2, 0, 1, 0,  1, 0, 3, 1,  2, 0, 3, 1],
    kickBar:  [1, 0, 0, 0,  1, 0, 0, 0,  1, 0, 0, 0,  1, 0, 0, 0],
    cymbalBar:[1, 0, 0, 0,  0, 0, 0, 0,  1, 0, 0, 0,  0, 0, 0, 0],
    useMarimba: false,
    mutedBrass: false
  }
};

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
    // User-facing normalized slider levels (0.0 to 1.0):
    // Default SFX = 85% (loud & punchy), Default Music = 35% (never drowns out cannon shots/explosions)
    this.sfxVolumeLevel = 0.85;
    this.musicVolumeLevel = 0.35;
    this.savedVolume = this.sfxVolumeLevel * 0.95;
    this.musicVolume = this.musicVolumeLevel * 0.55;
    this.lastPlayed = {};

    // Music Mode: 'menu' (MP3 BGM) vs 'combat' (Procedural Wii Play Toy Military March)
    this.musicMode = 'menu';
    this.currentMarchKey = 'march_standard';
    this.baseMarchKey = 'march_standard';

    // Menu MP3 BGM state
    this.bgmRawBuffer = null;
    this.bgmAudioBuffer = null;
    this.bgmSourceNode = null;
    this.bgmIsDecoding = false;
    this.bgmPlaying = false;

    // Procedural Combat March Sequencer state
    this.marchTimer = null;
    this.marchPlaying = false;
    this.marchStep = 0;
    this.nextStepTime = 0;
    this.fanfareEndTime = 0;

    try {
      this.isMuted = localStorage.getItem('tanks_sfx_muted') === 'true';
      this.isMusicMuted = localStorage.getItem('tanks_music_muted') === 'true';
      const savedSfxVol = localStorage.getItem('tanks_sfx_volume');
      if (savedSfxVol !== null) {
        const parsedSfx = parseFloat(savedSfxVol);
        if (!Number.isNaN(parsedSfx)) {
          this.sfxVolumeLevel = Math.max(0, Math.min(1, parsedSfx));
          this.savedVolume = this.sfxVolumeLevel * 0.95;
        }
      }
      const savedMusicVol = localStorage.getItem('tanks_music_volume');
      if (savedMusicVol !== null) {
        const parsedMus = parseFloat(savedMusicVol);
        if (!Number.isNaN(parsedMus)) {
          this.musicVolumeLevel = Math.max(0, Math.min(1, parsedMus));
          this.musicVolume = this.musicVolumeLevel * 0.55;
        }
      }
    } catch (_) {}

    if (typeof window !== 'undefined') {
      // Pre-fetch the lightweight (<1MB) Menu BGM loop immediately
      this.prefetchBgmData();

      this.handleUserGesture = () => {
        if (this.disposed) return;
        this.unlockAudioSynchronously();
      };

      window.addEventListener('touchstart', this.handleUserGesture, { capture: true, passive: true });
      window.addEventListener('touchend', this.handleUserGesture, { capture: true, passive: true });
      window.addEventListener('pointerdown', this.handleUserGesture, { capture: true, passive: true });
      window.addEventListener('mousedown', this.handleUserGesture, { capture: true, passive: true });
      window.addEventListener('click', this.handleUserGesture, { capture: true, passive: true });
      window.addEventListener('keydown', this.handleUserGesture, { capture: true, passive: true });

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
          if (!this.isMusicMuted) {
            this.syncBgmState();
          }
        }
      };
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  // --- MENU MP3 BGM METHODS ---

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
            if (this.ctx && this.musicMode === 'menu') {
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
      if (!this.isMusicMuted && this.musicMode === 'menu' && !this.bgmPlaying) {
        this.startBgmNode();
      }
      return;
    }
    if (!this.bgmRawBuffer || this.bgmIsDecoding) return;

    this.bgmIsDecoding = true;
    try {
      const bufferCopy = this.bgmRawBuffer.slice(0);
      this.ctx.decodeAudioData(
        bufferCopy,
        (decoded) => {
          this.bgmIsDecoding = false;
          if (this.disposed) return;
          this.bgmAudioBuffer = decoded;
          if (!this.isMusicMuted && this.musicMode === 'menu') {
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
    if (this.musicMode !== 'menu') return;

    if (this.bgmPlaying && this.bgmSourceNode) {
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

  // --- MODE SWITCHING: MENU MUSIC vs PROCEDURAL WII PLAY COMBAT MARCH ---

  startMenuMusic() {
    if (this.disposed) return;
    this.musicMode = 'menu';
    this.stopCombatMarch();
    if (!this.isMusicMuted) {
      this.startBgmPlayback();
    }
  }

  startMissionMusic(options = {}) {
    if (this.disposed) return;
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    // Stop Menu MP3 so the procedural Toy Military March takes center stage
    this.musicMode = 'combat';
    this.stopBgmNode();

    const { biome = 'workshop', isBoss = false, isStealth = false } = options;

    if (isBoss) {
      this.baseMarchKey = 'march_boss';
    } else if (isStealth || biome === 'night_stealth' || biome === 'cyber') {
      this.baseMarchKey = 'march_stealth';
    } else if (
      biome === 'volcano' ||
      biome === 'sunset_city' ||
      biome === 'matsuri' ||
      biome === 'tropical_island'
    ) {
      this.baseMarchKey = 'march_arcade';
    } else {
      this.baseMarchKey = 'march_standard';
    }

    this.currentMarchKey = this.baseMarchKey;

    if (!this.isMusicMuted) {
      this.startCombatMarch(true);
    }
  }

  setDangerState(isDanger) {
    if (this.disposed || this.musicMode !== 'combat') return;
    // Boss levels keep their heavy boss theme; normal missions shift to urgent 138 BPM "Last Enemy" theme
    if (this.baseMarchKey === 'march_boss') return;
    const nextKey = isDanger ? 'march_danger' : this.baseMarchKey;
    if (this.currentMarchKey !== nextKey) {
      this.currentMarchKey = nextKey;
    }
  }

  startCombatMarch(withIntroFanfare = false) {
    if (this.disposed || this.isMusicMuted || this.musicMode !== 'combat') return;
    if (!this.initialized) this.init();
    if (!this.ctx || !this.musicGain) return;

    this.stopCombatMarch();
    this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);

    const now = this.ctx.currentTime;
    if (withIntroFanfare) {
      const fanfareDur = this.playMissionStartFanfare(now + 0.04);
      this.nextStepTime = now + fanfareDur;
    } else {
      this.nextStepTime = now + 0.06;
    }

    this.marchStep = 0;
    this.marchPlaying = true;

    // Lookahead scheduler (runs every 35ms, schedules 120ms ahead with sample-accurate WebAudio timing)
    this.marchTimer = setInterval(() => {
      this.scheduleMarchSteps();
    }, 35);
  }

  stopCombatMarch() {
    this.marchPlaying = false;
    if (this.marchTimer) {
      clearInterval(this.marchTimer);
      this.marchTimer = null;
    }
  }

  // Short Triumphant Military Bugle Call + Snare Roll Fanfare at Mission Start
  playMissionStartFanfare(startTime) {
    if (!this.ctx || !this.musicGain || this.isMusicMuted) return 0.1;

    // Crisp snare roll intro
    this.synthMarchSnare(startTime, true, true, false);
    this.synthMarchSnare(startTime + 0.18, false, true, false);
    this.synthMarchSnare(startTime + 0.36, true, false, false);
    this.synthMarchKick(startTime + 0.36, true);

    // Bugle call notes: C4 -> E4 -> G4 -> C5!
    const bugleNotes = [
      { midi: 60, offset: 0.0, dur: 0.11 },
      { midi: 64, offset: 0.12, dur: 0.11 },
      { midi: 67, offset: 0.24, dur: 0.11 },
      { midi: 72, offset: 0.36, dur: 0.32 }
    ];
    bugleNotes.forEach(n => {
      this.synthBrassNote(midiToFreq(n.midi), startTime + n.offset, n.dur, false, 0.34);
    });
    // Harmony fifth on final note
    this.synthBrassNote(midiToFreq(67), startTime + 0.36, 0.32, false, 0.22);
    this.synthTubaNote(midiToFreq(48), startTime + 0.36, 0.32, true);

    return 0.76;
  }

  scheduleMarchSteps() {
    if (this.disposed || !this.marchPlaying || this.isMusicMuted || !this.ctx) return;
    if (this.ctx.state !== 'running') return;

    const lookahead = 0.12;
    const now = this.ctx.currentTime;

    // Reset nextStepTime if tab was backgrounded
    if (this.nextStepTime < now - 0.2) {
      this.nextStepTime = now + 0.04;
    }

    const theme = MARCH_THEMES[this.currentMarchKey] || MARCH_THEMES.march_standard;
    const stepDur = (60 / theme.bpm) / 4; // 16th-note duration in seconds

    while (this.nextStepTime < now + lookahead) {
      this.triggerMarchStep(this.marchStep, this.nextStepTime, stepDur, theme);
      this.nextStepTime += stepDur;
      this.marchStep = (this.marchStep + 1) % 64;
    }
  }

  triggerMarchStep(step, t, stepDur, theme) {
    const barStep = step % 16;

    // 1. Percussion: Marching Snare, Dry Kick, Cymbals
    const snareType = theme.snareBar[barStep];
    if (snareType === 1) {
      this.synthMarchSnare(t, false, false, theme.mutedBrass);
    } else if (snareType === 2) {
      this.synthMarchSnare(t, true, false, theme.mutedBrass);
    } else if (snareType === 3) {
      this.synthMarchSnare(t, false, true, theme.mutedBrass);
    }

    if (theme.kickBar[barStep]) {
      this.synthMarchKick(t, this.currentMarchKey === 'march_boss');
    }

    if (theme.cymbalBar[barStep]) {
      this.synthMarchCymbal(t, barStep === 12);
    }

    // 2. Staccato Toy Tuba Bassline ("Oom-pah")
    const tubaMidi = theme.tuba[step];
    if (tubaMidi > 0) {
      this.synthTubaNote(
        midiToFreq(tubaMidi),
        t,
        stepDur * 1.65,
        barStep % 4 === 0
      );
    }

    // 3. Synthetic Military Brass / Bugle Lead
    const brassMidi = theme.brass[step];
    if (brassMidi > 0) {
      this.synthBrassNote(
        midiToFreq(brassMidi),
        t,
        stepDur * 1.75,
        theme.mutedBrass,
        0.26
      );
    }

    // 4. Playful Piccolo Flute / Toy Marimba Counter-Melody
    const piccMidi = theme.piccolo[step];
    if (piccMidi > 0) {
      this.synthPiccoloOrMarimba(
        midiToFreq(piccMidi),
        t,
        stepDur * 1.5,
        theme.useMarimba
      );
    }
  }

  // --- SYNTHESIS INSTRUMENTS FOR WII PLAY TOY MILITARY BAND ---

  synthMarchSnare(t, accent = false, isRoll = false, isBrush = false) {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;

    const hits = isRoll ? [0, 0.042, 0.084] : [0];
    hits.forEach((offset, idx) => {
      const start = t + offset;
      const vol = (accent ? 0.22 : 0.13) * (isRoll ? (idx === 2 ? 0.95 : 0.65) : 1) * (isBrush ? 0.6 : 1);
      const dur = isBrush ? 0.055 : 0.075;

      // Crisp snare wires (bandpass filtered white noise)
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(isBrush ? 2400 : 1850, start);
      filter.Q.setValueAtTime(isBrush ? 1.8 : 1.1, start);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(vol, start);
      nGain.gain.exponentialRampToValueAtTime(0.003, start + dur);

      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.musicGain);

      noise.onended = () => {
        noise.disconnect();
        filter.disconnect();
        nGain.disconnect();
      };
      noise.start(start);
      noise.stop(start + dur + 0.01);

      // Toy drum shell snap (only on main hit)
      if (!isBrush && idx === 0) {
        const body = this.ctx.createOscillator();
        const bGain = this.ctx.createGain();
        body.type = 'triangle';
        body.frequency.setValueAtTime(240, start);
        body.frequency.exponentialRampToValueAtTime(115, start + 0.045);

        bGain.gain.setValueAtTime(vol * 0.75, start);
        bGain.gain.exponentialRampToValueAtTime(0.004, start + 0.05);

        body.connect(bGain);
        bGain.connect(this.musicGain);
        body.onended = () => {
          body.disconnect();
          bGain.disconnect();
        };
        body.start(start);
        body.stop(start + 0.055);
      }
    });
  }

  synthMarchKick(t, heavy = false) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(heavy ? 150 : 130, t);
    osc.frequency.exponentialRampToValueAtTime(heavy ? 38 : 46, t + 0.095);

    gain.gain.setValueAtTime(heavy ? 0.38 : 0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.005, t + 0.11);

    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(t);
    osc.stop(t + 0.12);
  }

  synthMarchCymbal(t, crash = false) {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;
    const dur = crash ? 0.24 : 0.06;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(5200, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(crash ? 0.12 : 0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.002, t + dur);

    noise.connect(hp);
    hp.connect(gain);
    gain.connect(this.musicGain);
    noise.onended = () => {
      noise.disconnect();
      hp.disconnect();
      gain.disconnect();
    };
    noise.start(t);
    noise.stop(t + dur + 0.01);
  }

  synthTubaNote(freq, t, dur, accent = false) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);

    // Brassy lowpass envelope ("oom-pah" staccato bounce)
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(2.4, t);
    filter.frequency.setValueAtTime(freq * 4.8, t);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.6, t + dur * 0.85);

    const peak = accent ? 0.28 : 0.21;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.004, t + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  synthBrassNote(freq, t, dur, muted = false, volume = 0.25) {
    if (!this.ctx || !this.musicGain) return;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    // Slight stereo/chorus detune for authentic Wii synth horn warmth
    osc1.frequency.setValueAtTime(freq * 0.998, t);
    osc2.frequency.setValueAtTime(freq * 1.002, t);

    filter.type = muted ? 'bandpass' : 'lowpass';
    filter.Q.setValueAtTime(muted ? 3.2 : 1.8, t);
    filter.frequency.setValueAtTime(muted ? freq * 2.2 : freq * 1.5, t);
    filter.frequency.linearRampToValueAtTime(muted ? freq * 3.0 : Math.min(3400, freq * 4.2), t + 0.03);
    filter.frequency.exponentialRampToValueAtTime(muted ? freq * 1.8 : freq * 2.1, t + dur);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.016);
    gain.gain.setValueAtTime(volume * 0.82, t + dur * 0.65);
    gain.gain.exponentialRampToValueAtTime(0.004, t + dur);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc1.onended = () => {
      osc1.disconnect();
      osc2.disconnect();
      filter.disconnect();
      gain.disconnect();
    };

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + dur + 0.01);
    osc2.stop(t + dur + 0.01);
  }

  synthPiccoloOrMarimba(freq, t, dur, isMarimba = false) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isMarimba ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq, t);

    const peak = isMarimba ? 0.20 : 0.15;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(peak, t + (isMarimba ? 0.005 : 0.012));
    gain.gain.exponentialRampToValueAtTime(0.003, t + (isMarimba ? dur * 0.75 : dur));

    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  // --- CORE AUDIO CONTEXT & LIFECYCLE ---

  unlockAudioSynchronously() {
    if (this.disposed) return;
    if (!this.initialized) this.init();

    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().then(() => {
          if (!this.disposed && !this.isMusicMuted) {
            this.syncBgmState();
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
      this.syncBgmState();
    }
  }

  startBgmPlayback() {
    if (this.disposed || this.isMusicMuted) return;
    if (!this.initialized) this.init();
    if (!this.ctx) return;

    if (this.musicMode === 'combat') {
      if (!this.marchPlaying) {
        this.startCombatMarch(false);
      }
      return;
    }

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
    this.stopCombatMarch();
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

      // Dedicated Gain for Background Music (Menu MP3 + Combat March)
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

      if (this.bgmRawBuffer && this.musicMode === 'menu') {
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
      if (this.musicMode === 'combat') {
        if (!this.marchPlaying) {
          this.startCombatMarch(false);
        }
      } else {
        this.stopCombatMarch();
        this.startBgmPlayback();
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
    return this.setSfxVolume(vol);
  }

  setSfxVolume(vol0to1) {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.sfxVolumeLevel = Math.max(0, Math.min(1, Number(vol0to1)));
    this.savedVolume = this.sfxVolumeLevel * 0.95;
    try {
      localStorage.setItem('tanks_sfx_volume', String(this.sfxVolumeLevel));
    } catch (_) {}

    if (this.sfxVolumeLevel <= 0.001) {
      this.isMuted = true;
    } else if (this.isMuted) {
      this.isMuted = false;
    }
    try {
      localStorage.setItem('tanks_sfx_muted', String(this.isMuted));
    } catch (_) {}

    if (this.masterGain && this.ctx) {
      this.masterGain.gain.cancelScheduledValues(0);
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.savedVolume, this.ctx.currentTime);
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
    return this.sfxVolumeLevel;
  }

  setMusicVolume(vol0to1) {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.musicVolumeLevel = Math.max(0, Math.min(1, Number(vol0to1)));
    this.musicVolume = this.musicVolumeLevel * 0.55;
    try {
      localStorage.setItem('tanks_music_volume', String(this.musicVolumeLevel));
    } catch (_) {}

    if (this.musicVolumeLevel <= 0.001) {
      this.isMusicMuted = true;
    } else if (this.isMusicMuted) {
      this.isMusicMuted = false;
    }
    try {
      localStorage.setItem('tanks_music_muted', String(this.isMusicMuted));
    } catch (_) {}

    if (this.musicGain && this.ctx) {
      this.musicGain.gain.cancelScheduledValues(0);
      this.musicGain.gain.setValueAtTime(this.isMusicMuted ? 0 : this.musicVolume, this.ctx.currentTime);
    }
    this.syncBgmState();
    return this.musicVolumeLevel;
  }

  getSfxVolume() {
    return this.sfxVolumeLevel;
  }

  getMusicVolume() {
    return this.musicVolumeLevel;
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
    if (!this.isMusicMuted) {
      if (this.musicMode === 'menu' && !this.bgmPlaying) {
        this.startBgmPlayback();
      } else if (this.musicMode === 'combat' && !this.marchPlaying) {
        this.startCombatMarch(false);
      }
    }
    if (this.isMuted || !this.masterGainConnected) return;

    const t = this.ctx.currentTime;

    const minInterval = (type === 'shoot' || type === 'impact' || type === 'wood_pop') ? 0.032 : 0.045;
    if (this.lastPlayed[type] && (t - this.lastPlayed[type]) < minInterval) {
      return;
    }
    this.lastPlayed[type] = t;

    if (type === 'wood_pop') {
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
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(560, t);
        osc.frequency.exponentialRampToValueAtTime(105, t + 0.17);
        
        gain.gain.setValueAtTime(0.44, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.17);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
        
        osc.start(t);
        osc.stop(t + 0.18);
    } 
    else if (type === 'impact') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1080, t);
        osc.frequency.exponentialRampToValueAtTime(290, t + 0.09);

        gain.gain.setValueAtTime(0.32, t);
        gain.gain.exponentialRampToValueAtTime(0.008, t + 0.09);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };

        osc.start(t);
        osc.stop(t + 0.10);
    }
    else if (type === 'combo') {
        const baseFreq = 440 * Math.pow(1.12, Math.min(param, 8));
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, t);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, t + 0.18);

        gain.gain.setValueAtTime(0.38, t);
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
        [880, 1320].forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const start = t + idx * 0.08;
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0.34, start);
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
        const dur = 0.42;
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(920, t);
        filter.frequency.linearRampToValueAtTime(95, t + dur);

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
    else if (type === 'big_explosion') {
         if (!this.noiseBuffer) return;
         const dur = 0.85;
         const noise = this.ctx.createBufferSource();
         noise.buffer = this.noiseBuffer;
 
         const filter = this.ctx.createBiquadFilter();
         filter.type = 'lowpass';
         filter.frequency.setValueAtTime(480, t);
         filter.frequency.linearRampToValueAtTime(45, t + dur);
 
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
         // Triumphant military victory fanfare (snare roll + brass parade cadence + cymbal crash)
         const fanfareNotes = [
           { midi: 60, delay: 0.0, dur: 0.11 },
           { midi: 64, delay: 0.11, dur: 0.11 },
           { midi: 67, delay: 0.22, dur: 0.11 },
           { midi: 72, delay: 0.33, dur: 0.22 },
           { midi: 67, delay: 0.56, dur: 0.12 },
           { midi: 72, delay: 0.70, dur: 0.55 }
         ];
         fanfareNotes.forEach(n => {
             const osc = this.ctx.createOscillator();
             const gain = this.ctx.createGain();
             const start = t + n.delay;
             osc.type = 'sawtooth';
             osc.frequency.setValueAtTime(midiToFreq(n.midi), start);
             gain.gain.setValueAtTime(0.24, start);
             gain.gain.exponentialRampToValueAtTime(0.008, start + n.dur);
             osc.connect(gain);
             gain.connect(this.masterGain);
             osc.onended = () => {
               osc.disconnect();
               gain.disconnect();
             };
             osc.start(start);
             osc.stop(start + n.dur + 0.02);
         });
    }
  }
}
