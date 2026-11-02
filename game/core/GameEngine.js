
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LevelLoader } from '../world/LevelLoader.js';
import { PlayerTank } from '../entities/PlayerTank.js';
import { EnemyTank } from '../entities/EnemyTank.js';
import { Projectile } from '../entities/Projectile.js';
import { Mine } from '../entities/Mine.js';
import { InputManager } from '../controls/InputManager.js';
import { VFXManager } from '../vfx/VFXManager.js';
import { Cursor } from '../vfx/Cursor.js';
import { AudioManager } from '../audio/AudioManager.js';

export class GameEngine {
  constructor(canvas, onEvent) {
    this.canvas = canvas;
    this.onEvent = onEvent;
    this.entities = [];
    this.walls = [];         // Indestructible, Bounces Projectiles
    this.destructibles = []; // Destructible (Cork), Destroys Projectiles
    this.tankBlockers = [];  // Holes/Pits, Blocks Tanks only (Projectiles fly over)
    this.projectiles = [];
    this.mines = [];
    this.floorTiles = [];
    this.lighthouses = [];   // Array to track rotating lighthouse parts
    this.barrels = [];       // Explosive Barrels ('B')
    this.powerUpCrates = []; // Power-Up Supply Crates ('U')
    this.boostPads = [];     // Speed Boost Accelerator Pads ('A')
    this.prisms = [];        // Laser Crystal Reflectors ('M')
    this.teleporters = [];   // Paired Warp Portals ('O')
    this.laserGates = [];    // Toggleable Laser Forcefields ('G')
    this.laserSwitches = []; // Shootable Laser Switches ('K')
    this.cryoBarrels = [];   // Cryogenic EMP Freeze Barrels ('F')
    this.repairPads = [];    // Medical Armor Repair Stations ('D')
    this.tableProps = [];    // Environmental props on the desk outside arena
    this.currentBiome = 'workshop';

    // Load Player Hangar Customization (Skin, Tactical Perk, 3D Hat, Bullet Trail & AI Difficulty)
    this.playerSkin = 'classic';
    this.playerPerk = 'ricochet';
    this.playerHat = 'none';
    this.playerTrail = 'cyan';
    this.aiDifficulty = 'normal';
    try {
      this.playerSkin = localStorage.getItem('tanks_player_skin') || 'classic';
      this.playerPerk = localStorage.getItem('tanks_player_perk') || 'ricochet';
      this.playerHat = localStorage.getItem('tanks_player_hat') || 'none';
      this.playerTrail = localStorage.getItem('tanks_player_trail') || 'cyan';
      this.aiDifficulty = localStorage.getItem('tanks_ai_difficulty') || 'normal';
    } catch (_) {}
    
    this.stats = { 
        score: 0, 
        lives: 3, 
        enemiesLeft: 0, 
        mission: 1, 
        missionName: 'The Basics', 
        mineReady: true,
        mineCooldownProgress: 1.0,
        bazookaReady: true,
        bazookaCooldownProgress: 1.0,
        empReady: true,
        empCooldownProgress: 1.0,
        mineUnlocked: false,
        bazookaUnlocked: false,
        empUnlocked: false,
        combo: 0,
        cameraMode: 'overview',
        zoomLevel: 0.9,
        biome: 'workshop',
        activePowerup: null,
        bossInfo: null,
        stealthStatus: null,
        isNightMode: false
    };
    this.nightModeOverride = false;
    this.isPlayerStealthed = false;
    this.isSpottedByLighthouse = false;
    this.muzzleRevealTimer = 0;
    this.lighthouseAlertCooldown = 0;
    this.searchlightBeamTex = null;
    this.isRunning = false;
    this.isPaused = false;
    this.isDying = false;
    this.deathFocusPos = null;
    this.deathTimeouts = [];
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.comboStreak = 0;
    this.comboTimer = 0;
    this.winTimeout = null;
    this.missionOutcome = null; // null | 'VICTORY' | 'DEFEAT'
    this.missionStartTime = 0;
    this.missionDamageTaken = 0;

    // Dynamic Camera State
    this.currentMapWidth = 80;
    this.currentMapHeight = 80;
    this.waterMeshes = [];
    this.waterShaderMat = null;
    this.weatherSystem = null;
    this.fishList = [];
    this.waterLilies = [];
    this.cattails = [];
    this.waterTex = null;
    this.fillLight = null;
    this.cameraState = {
        zoom: 0.9,           // 0.0 = close-up on tank, 1.0 = full map overview
        targetZoom: 0.9,     // Target zoom level for smooth lerp
        mode: 'overview',    // 'overview' or 'follow'
        currentPos: new THREE.Vector3(0, 95, 65),
        targetPos: new THREE.Vector3(0, 95, 65),
        currentLookAt: new THREE.Vector3(0, 0, 4),
        targetLookAt: new THREE.Vector3(0, 0, 4),
        overviewHeight: 95,
        overviewZ: 65,
        minHeight: 40,
        minZOffset: 25
    };

    this.init();
  }

  init() {
    // 1. Scene & VFX
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xd6cfc7); // Bright, luminous studio environment
    this.vfx = new VFXManager(this.scene);
    this.cursor = new Cursor(this.scene);
    this.audio = new AudioManager();

    // 2. Camera
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 1, 1200);
    this.updateCameraFraming();
    this.camera.position.copy(this.cameraState.currentPos); 
    this.camera.lookAt(this.cameraState.currentLookAt);

    // 3. Renderer & Studio PBR Environment Reflections
    this.renderer = new THREE.WebGLRenderer({ 
        canvas: this.canvas, 
        antialias: true, 
        alpha: false,
        powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.22;

    // Procedural Studio RoomEnvironment for crisp clearcoat & metallic reflections
    try {
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();
    } catch (_) {}

    // 4. Input
    this.input = new InputManager(this.camera, this.canvas);

    // 5. Lighting (High-contrast key sun + rich sky/ground hemisphere + rim fill)
    this.ambientLight = new THREE.HemisphereLight(0xffffff, 0x5d4037, 0.82);
    this.ambientLight.userData.isEnvironment = true;
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xfff4d6, 1.55);
    this.dirLight.position.set(-42, 88, 48);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(2048, 2048);
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.normalBias = 0.02;
    this.dirLight.shadow.camera.left = -95;
    this.dirLight.shadow.camera.right = 95;
    this.dirLight.shadow.camera.top = 95;
    this.dirLight.shadow.camera.bottom = -95;
    this.dirLight.userData.isEnvironment = true;
    this.scene.add(this.dirLight);

    // Secondary fill light from opposite angle for crisp 3D rim definition without washing out shadows
    this.fillLight = new THREE.DirectionalLight(0x90caf9, 0.45);
    this.fillLight.position.set(48, 55, -45);
    this.fillLight.userData.isEnvironment = true;
    this.scene.add(this.fillLight);

    // 6. Environment (The Desk & Living Diorama Backdrop)
    this.createTableEnvironment();
    this.decorateTable('workshop', 80, 80);

    // 7. Listeners
    window.addEventListener('resize', this.onResize.bind(this));
    this.clock = new THREE.Clock();
    this.animate();
  }
  
  startAudio() {
      this.audio.resume();
  }

  createTableEnvironment() {
    // Vast clean luminous tabletop / ground surface (4500x4500 so terrain never cuts off)
    const tableGeo = new THREE.PlaneGeometry(4500, 4500);
    const tableMat = new THREE.MeshStandardMaterial({ 
        color: 0xc8beb2, 
        roughness: 0.65, 
        metalness: 0.05 
    });
    this.tableMesh = new THREE.Mesh(tableGeo, tableMat);
    this.tableMesh.rotation.x = -Math.PI / 2;
    this.tableMesh.position.y = -3.5;
    this.tableMesh.receiveShadow = true;
    this.tableMesh.userData.isEnvironment = true;
    this.scene.add(this.tableMesh);

    // Subtle framing desk mat surrounding the battlefield perimeter
    const matGeo = new THREE.PlaneGeometry(160, 160);
    const matMat = new THREE.MeshStandardMaterial({ 
        color: 0xb0a496, 
        roughness: 0.75 
    });
    this.deskMatMesh = new THREE.Mesh(matGeo, matMat);
    this.deskMatMesh.rotation.x = -Math.PI / 2;
    this.deskMatMesh.position.y = -3.2;
    this.deskMatMesh.receiveShadow = true;
    this.deskMatMesh.userData.isEnvironment = true;
    this.scene.add(this.deskMatMesh);
  }

  updateCameraFraming() {
    if (!this.camera) return;
    const aspect = window.innerWidth / window.innerHeight;
    // Extra padding so the water moat, stone bridges, and outer riverbanks are fully visible
    const padW = (this.currentMapWidth || 80) + 38;
    const padH = (this.currentMapHeight || 80) + 38;

    // Vertical FOV is 45 degrees
    const fovY = (this.camera.fov * Math.PI) / 180;
    const tanHalfFovY = Math.tan(fovY / 2);

    // Height needed for map height (accounting for ~55 deg tilt)
    const reqH = (padH / 2) / (tanHalfFovY * 0.92);
    // Height needed for map width
    const reqW = (padW / 2) / (tanHalfFovY * aspect * 0.92);

    // Margin factor on mobile devices to prevent touch controls from obscuring the board
    const isMobile = window.innerWidth < 1024 || ('ontouchstart' in window);
    const mobileMargin = isMobile ? (aspect < 1 ? 1.35 : 1.15) : 1.05;

    this.cameraState.overviewHeight = Math.max(reqH, reqW, 60) * mobileMargin;
    this.cameraState.overviewZ = this.cameraState.overviewHeight * 0.65;
  }

  isNightStealthActive() {
    return this.currentBiome === 'night_stealth' || this.nightModeOverride === true;
  }

  toggleNightMode() {
    this.nightModeOverride = !this.nightModeOverride;
    this.applyBiomeLighting(this.currentBiome, false);
    this.stats.isNightMode = this.isNightStealthActive();
    this.updateUI();
    return this.stats.isNightMode;
  }

  applyBiomeLighting(biome, fromLevelLoad = false) {
    if (!this.ambientLight || !this.dirLight) return;

    const isNight = (biome === 'night_stealth' || this.nightModeOverride);

    let target = {
      bgColor: 0xc8beae,
      ambientColor: 0xfff8e7,
      groundColor: 0x5d4037,
      ambientIntensity: 0.85,
      dirColor: 0xffecb3,
      dirIntensity: 1.55,
      fillColor: 0x90caf9,
      fillIntensity: 0.45,
      tableColor: 0xb8a996,
      deskMatColor: 0x9c8c78,
      landscapeTint: 0xffffff,
      floorTint: 0xffffff,
      exposure: 1.22,
      envIntensity: 0.72
    };

    if (isNight) {
      // Authentic Moonlit Night Stealth: Deep nocturnal atmosphere where ambient light dims down smoothly while 3D wall bevels, silhouettes, and searchlight cones remain crisp and readable!
      target = {
        bgColor: 0x050a14,
        ambientColor: 0x38bdf8,
        groundColor: 0x040812,
        ambientIntensity: 0.24,
        dirColor: 0x7dd3fc,
        dirIntensity: 0.36,
        fillColor: 0x2563eb,
        fillIntensity: 0.24,
        tableColor: 0x070d19,
        deskMatColor: 0x050912,
        landscapeTint: biome === 'night_stealth' ? 0x64748b : 0x1e293b,
        floorTint: biome === 'night_stealth' ? 0x829ab8 : 0x334155,
        exposure: 0.78,
        envIntensity: 0.14
      };
    } else if (biome === 'workshop') {
      target = {
        bgColor: 0xc8beae,
        ambientColor: 0xfff8e7,
        groundColor: 0x5d4037,
        ambientIntensity: 0.85,
        dirColor: 0xffecb3,
        dirIntensity: 1.55,
        fillColor: 0x90caf9,
        fillIntensity: 0.45,
        tableColor: 0xb8a996,
        deskMatColor: 0x9c8c78,
        landscapeTint: 0xffffff,
        floorTint: 0xffffff,
        exposure: 1.22,
        envIntensity: 0.72
      };
    } else if (biome === 'desert') {
      target = {
        bgColor: 0xeccfa2,
        ambientColor: 0xfff3e0,
        groundColor: 0x8d5524,
        ambientIntensity: 0.88,
        dirColor: 0xffd54f,
        dirIntensity: 1.65,
        fillColor: 0x4dd0e1,
        fillIntensity: 0.42,
        tableColor: 0xe0be8b,
        deskMatColor: 0xc8a16b,
        landscapeTint: 0xffffff,
        floorTint: 0xffffff,
        exposure: 1.22,
        envIntensity: 0.75
      };
    } else if (biome === 'cyber') {
      target = {
        bgColor: 0x0b1324,
        ambientColor: 0x80deea,
        groundColor: 0x111827,
        ambientIntensity: 0.85,
        dirColor: 0x00e5ff,
        dirIntensity: 1.45,
        fillColor: 0xd500f9,
        fillIntensity: 0.55,
        tableColor: 0x111c2d,
        deskMatColor: 0x0b1320,
        landscapeTint: 0xffffff,
        floorTint: 0xffffff,
        exposure: 1.18,
        envIntensity: 0.65
      };
    } else if (biome === 'arctic') {
      target = {
        bgColor: 0xb3e5fc,
        ambientColor: 0xe1f5fe,
        groundColor: 0x0277bd,
        ambientIntensity: 0.82,
        dirColor: 0xfff9c4,
        dirIntensity: 1.48,
        fillColor: 0x29b6f6,
        fillIntensity: 0.48,
        tableColor: 0x90caf9,
        deskMatColor: 0x64b5f6,
        landscapeTint: 0xffffff,
        floorTint: 0xffffff,
        exposure: 1.20,
        envIntensity: 0.70
      };
    } else if (biome === 'volcano') {
      target = {
        bgColor: 0x2b110c,
        ambientColor: 0xff8a65,
        groundColor: 0x210b07,
        ambientIntensity: 0.92,
        dirColor: 0xff6d00,
        dirIntensity: 1.6,
        fillColor: 0xffd600,
        fillIntensity: 0.5,
        tableColor: 0x2d140e,
        deskMatColor: 0x1f0d09,
        landscapeTint: 0xffffff,
        floorTint: 0xffffff,
        exposure: 1.20,
        envIntensity: 0.68
      };
    } else if (biome === 'sunset_city') {
      target = {
        bgColor: 0x241438,
        ambientColor: 0xffb74d,
        groundColor: 0x281845,
        ambientIntensity: 0.9,
        dirColor: 0xff6e40,
        dirIntensity: 1.65,
        fillColor: 0x7c4dff,
        fillIntensity: 0.56,
        tableColor: 0x1f1630,
        deskMatColor: 0x140e22,
        landscapeTint: 0xffffff,
        floorTint: 0xffffff,
        exposure: 1.18,
        envIntensity: 0.65
      };
    } else if (biome === 'matsuri') {
      target = {
        bgColor: 0x160f29,
        ambientColor: 0xffcc80,
        groundColor: 0x311b32,
        ambientIntensity: 0.92,
        dirColor: 0xffab40,
        dirIntensity: 1.62,
        fillColor: 0xff80ab,
        fillIntensity: 0.55,
        tableColor: 0x28152b,
        deskMatColor: 0x1a0d1c,
        landscapeTint: 0xffffff,
        floorTint: 0xffffff,
        exposure: 1.18,
        envIntensity: 0.65
      };
    } else if (biome === 'tropical_island') {
      // Warm Golden-Orange Tropical Sunset Beach: Rich toasted sand & amber-orange glow (never washed-out white!)
      target = {
        bgColor: 0xe08e45,
        ambientColor: 0xffb74d,
        groundColor: 0x8d4e1f,
        ambientIntensity: 0.68,
        dirColor: 0xff9800,
        dirIntensity: 1.25,
        fillColor: 0xff7043,
        fillIntensity: 0.36,
        tableColor: 0xd98a3c,
        deskMatColor: 0xb86b23,
        landscapeTint: 0xf2b476,
        floorTint: 0xf7c88e,
        exposure: 1.04,
        envIntensity: 0.36
      };
    } else { // jungle
      target = {
        bgColor: 0x1b3b2b,
        ambientColor: 0xc8e6c9,
        groundColor: 0x1b5e20,
        ambientIntensity: 0.9,
        dirColor: 0xffe082,
        dirIntensity: 1.6,
        fillColor: 0x00e676,
        fillIntensity: 0.48,
        tableColor: 0x204632,
        deskMatColor: 0x163324,
        landscapeTint: 0xffffff,
        floorTint: 0xffffff,
        exposure: 1.22,
        envIntensity: 0.72
      };
    }

    this.lightingTarget = {
      bgColor: new THREE.Color(target.bgColor),
      ambientColor: new THREE.Color(target.ambientColor),
      groundColor: new THREE.Color(target.groundColor),
      ambientIntensity: target.ambientIntensity,
      dirColor: new THREE.Color(target.dirColor),
      dirIntensity: target.dirIntensity,
      fillColor: new THREE.Color(target.fillColor),
      fillIntensity: target.fillIntensity,
      tableColor: new THREE.Color(target.tableColor),
      deskMatColor: new THREE.Color(target.deskMatColor),
      landscapeTint: new THREE.Color(target.landscapeTint),
      floorTint: new THREE.Color(target.floorTint),
      exposure: target.exposure,
      envIntensity: target.envIntensity
    };

    this.baseAmbientIntensity = target.ambientIntensity;
    this.baseDirIntensity = target.dirIntensity;
    this.stageLightBoost = 0;

    if (!this.scene.background || !(this.scene.background instanceof THREE.Color)) {
      this.scene.background = new THREE.Color(target.bgColor);
    }
    if (this.currentEnvIntensity === undefined) {
      this.currentEnvIntensity = 0.72;
    }

    // When entering Night Stealth on level load (or coming from a bright menu/biome), seed a strong twilight/daylight ambient start so the player visibly sees the ambient light smoothly dim down into night ("no bruscamente, sino que baje la luz cuando vengamos de una luz ambiental potente")!
    if (isNight && fromLevelLoad) {
      this.ambientLight.intensity = Math.max(this.ambientLight.intensity, 0.92);
      this.dirLight.intensity = Math.max(this.dirLight.intensity, 1.55);
      if (this.fillLight) this.fillLight.intensity = Math.max(this.fillLight.intensity, 0.52);
      if (this.renderer) this.renderer.toneMappingExposure = Math.max(this.renderer.toneMappingExposure, 1.24);
      this.currentEnvIntensity = Math.max(this.currentEnvIntensity, 0.78);
      if (this.landscapeMat) this.landscapeMat.color.setHex(0xdbeafe);
      if (this.floorMat) this.floorMat.color.setHex(0xe2e8f0);
      this.applySceneEnvIntensity(this.currentEnvIntensity);
    } else if (!isNight && fromLevelLoad) {
      // For standard daytime biome loads, apply immediately unless transitioning from Night Mode
      this.scene.background.copy(this.lightingTarget.bgColor);
      if (this.scene.fog) this.scene.fog.color.copy(this.lightingTarget.bgColor);
      this.ambientLight.color.copy(this.lightingTarget.ambientColor);
      this.ambientLight.groundColor.copy(this.lightingTarget.groundColor);
      this.ambientLight.intensity = target.ambientIntensity;
      this.dirLight.color.copy(this.lightingTarget.dirColor);
      this.dirLight.intensity = target.dirIntensity;
      if (this.fillLight) {
        this.fillLight.color.copy(this.lightingTarget.fillColor);
        this.fillLight.intensity = target.fillIntensity;
      }
      if (this.tableMesh) this.tableMesh.material.color.copy(this.lightingTarget.tableColor);
      if (this.deskMatMesh) this.deskMatMesh.material.color.copy(this.lightingTarget.deskMatColor);
      if (this.landscapeMat) this.landscapeMat.color.copy(this.lightingTarget.landscapeTint);
      if (this.floorMat) this.floorMat.color.copy(this.lightingTarget.floorTint);
      if (this.renderer) this.renderer.toneMappingExposure = target.exposure;
      this.currentEnvIntensity = target.envIntensity;
      this.applySceneEnvIntensity(this.currentEnvIntensity);
    }
  }

  applySceneEnvIntensity(envInt) {
    if (!this.scene) return;
    this.scene.traverse(obj => {
      if (obj.isMesh && obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => {
            if (m && 'envMapIntensity' in m) m.envMapIntensity = envInt;
          });
        } else if ('envMapIntensity' in obj.material) {
          obj.material.envMapIntensity = envInt;
        }
      }
    });
  }

  updateLightingTransition(dt) {
    if (!this.lightingTarget || !this.ambientLight || !this.dirLight) return;

    // Smooth exponential damping (~2.5 seconds gradual dimming from strong ambient light down to deep night)
    const speed = 1.35;
    const alpha = 1.0 - Math.exp(-speed * Math.min(dt, 0.1));

    // Calculate temporary boost if a prism crystal or lighthouse was shot
    let boostRatio = 0;
    if (this.stageLightBoost > 0) {
      this.stageLightBoost = Math.max(0, this.stageLightBoost - dt);
      boostRatio = this.stageLightBoost / 5.0;
    }

    const targetAmb = this.lightingTarget.ambientIntensity + (boostRatio * 0.80);
    const targetDir = this.lightingTarget.dirIntensity + (boostRatio * 0.65);
    const targetFill = this.lightingTarget.fillIntensity + (boostRatio * 0.25);
    const targetExp = this.lightingTarget.exposure + (boostRatio * 0.32);
    const targetEnv = this.lightingTarget.envIntensity + (boostRatio * 0.45);

    this.ambientLight.intensity += (targetAmb - this.ambientLight.intensity) * alpha;
    this.dirLight.intensity += (targetDir - this.dirLight.intensity) * alpha;
    this.ambientLight.color.lerp(this.lightingTarget.ambientColor, alpha);
    this.ambientLight.groundColor.lerp(this.lightingTarget.groundColor, alpha);
    this.dirLight.color.lerp(this.lightingTarget.dirColor, alpha);

    if (this.fillLight) {
      this.fillLight.intensity += (targetFill - this.fillLight.intensity) * alpha;
      this.fillLight.color.lerp(this.lightingTarget.fillColor, alpha);
    }

    if (this.scene.background && this.scene.background instanceof THREE.Color) {
      this.scene.background.lerp(this.lightingTarget.bgColor, alpha);
      if (this.scene.fog) this.scene.fog.color.copy(this.scene.background);
    }

    if (this.tableMesh && this.tableMesh.material) {
      this.tableMesh.material.color.lerp(this.lightingTarget.tableColor, alpha);
    }
    if (this.deskMatMesh && this.deskMatMesh.material) {
      this.deskMatMesh.material.color.lerp(this.lightingTarget.deskMatColor, alpha);
    }
    if (this.landscapeMat) {
      this.landscapeMat.color.lerp(this.lightingTarget.landscapeTint, alpha);
    }
    if (this.floorMat) {
      this.floorMat.color.lerp(this.lightingTarget.floorTint, alpha);
    }

    if (this.renderer) {
      this.renderer.toneMappingExposure += (targetExp - this.renderer.toneMappingExposure) * alpha;
    }

    if (this.currentEnvIntensity === undefined) this.currentEnvIntensity = targetEnv;
    const prevEnv = this.currentEnvIntensity;
    this.currentEnvIntensity += (targetEnv - this.currentEnvIntensity) * alpha;
    if (Math.abs(this.currentEnvIntensity - prevEnv) > 0.002) {
      this.applySceneEnvIntensity(this.currentEnvIntensity);
    }

    // Smoothly fade in the player tank's tactical nocturnal aura light as the ambient light dims at night
    if (this.playerNightLight && this.player && this.player.mesh && !this.player.isDead) {
      this.playerNightLight.position.set(
        this.player.mesh.position.x,
        3.2,
        this.player.mesh.position.z
      );
      const isNight = this.isNightStealthActive();
      const targetPlayerGlow = isNight ? 1.85 : 0.0;
      this.playerNightLight.intensity += (targetPlayerGlow - this.playerNightLight.intensity) * alpha;
    }
  }

  createWaterTexture(biome) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    if (biome === 'volcano') {
      // Flowing glowing lava river
      const grad = ctx.createLinearGradient(0, 0, 256, 256);
      grad.addColorStop(0, '#dd2c00');
      grad.addColorStop(0.5, '#ff6d00');
      grad.addColorStop(1, '#bf360c');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#ffd600';
      ctx.lineWidth = 4;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        const y = i * 32 + 16;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(64, y - 10, 192, y + 10, 256, y);
        ctx.stroke();
      }
    } else if (biome === 'cyber') {
      // Neon cyan data canal
      ctx.fillStyle = '#041220';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 3;
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        const y = i * 28 + 12;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(80, y - 8, 160, y + 8, 256, y);
        ctx.stroke();
      }
    } else if (biome === 'jungle') {
      // Deep tropical emerald-turquoise lagoon water with golden sun caustics
      const grad = ctx.createLinearGradient(0, 0, 256, 256);
      grad.addColorStop(0, '#00695c');
      grad.addColorStop(0.5, '#00acc1');
      grad.addColorStop(1, '#00897b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);

      ctx.strokeStyle = 'rgba(167, 255, 235, 0.55)';
      ctx.lineWidth = 3.5;
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        const y = i * 28 + 12;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(60, y - 12, 180, y + 12, 256, y);
        ctx.stroke();
      }
    } else {
      // Rich saturated azure water with crisp sunlight caustics
      const grad = ctx.createLinearGradient(0, 0, 256, 256);
      grad.addColorStop(0, '#01579b');
      grad.addColorStop(0.5, '#0288d1');
      grad.addColorStop(1, '#0277bd');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
      
      // Caustic light shimmer ribbons
      ctx.strokeStyle = 'rgba(179, 229, 252, 0.55)';
      ctx.lineWidth = 3.5;
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        const y = i * 28 + 12;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(60, y - 12, 180, y + 12, 256, y);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        const x = i * 36 + 18;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x - 10, 80, x + 10, 180, x, 256);
        ctx.stroke();
      }
    }
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    return tex;
  }

  createFishMesh(biome, index) {
    const group = new THREE.Group();

    let bodyColor = 0xff6d00; // Vibrant Koi Orange
    let accentColor = 0xffffff; // White patches
    let finColor = 0xffab91;
    let emissiveColor = 0x000000;
    let emissiveInt = 0;

    if (biome === 'desert') {
      // Golden / Turquoise oasis fish
      bodyColor = index % 2 === 0 ? 0xff8f00 : 0x00bfa5;
      accentColor = 0xfff9c4;
      finColor = 0xffd54f;
    } else if (biome === 'cyber') {
      // Neon glowing cyber fish
      bodyColor = 0x00e5ff;
      accentColor = 0xd500f9;
      finColor = 0x00e5ff;
      emissiveColor = 0x00e5ff;
      emissiveInt = 0.85;
    } else if (biome === 'arctic') {
      // Vibrant coral-salmon & glacial silver trout (stands out against blue water!)
      bodyColor = index % 2 === 0 ? 0xff5252 : 0x40c4ff;
      accentColor = 0xffffff;
      finColor = 0xff8a80;
    } else if (biome === 'volcano') {
      // Magma salamander / fire fish
      bodyColor = 0xff3d00;
      accentColor = 0xffea00;
      finColor = 0xff6e40;
      emissiveColor = 0xff3d00;
      emissiveInt = 0.75;
    } else if (biome === 'jungle') {
      // Exotic Amazonian discus / scarlet-gold-emerald fish
      if (index % 3 === 0) {
        bodyColor = 0xff1744;
        accentColor = 0xffd600;
        finColor = 0xff5252;
      } else if (index % 3 === 1) {
        bodyColor = 0xffd600;
        accentColor = 0x00e676;
        finColor = 0xffff00;
      } else {
        bodyColor = 0x00e5ff;
        accentColor = 0xff6d00;
        finColor = 0x18ffff;
      }
    } else if (biome === 'sunset_city') {
      // Sunset golden-amber & neon magenta urban bay fish
      bodyColor = index % 2 === 0 ? 0xff9100 : 0xff4081;
      accentColor = 0xffe57f;
      finColor = 0xff80ab;
      emissiveColor = 0xff6d00;
      emissiveInt = 0.35;
    } else if (biome === 'matsuri') {
      // Imperial Japanese Festival Nishikigoi Koi (vermilion red, pure white, and gold)
      if (index % 3 === 0) {
        bodyColor = 0xff1744;
        accentColor = 0xffffff;
        finColor = 0xff8a80;
      } else if (index % 3 === 1) {
        bodyColor = 0xffffff;
        accentColor = 0xd50000;
        finColor = 0xff5252;
      } else {
        bodyColor = 0xffca28;
        accentColor = 0xff3d00;
        finColor = 0xffe082;
      }
      emissiveColor = 0xff9100;
      emissiveInt = 0.25;
    } else if (biome === 'tropical_island') {
      // Coral Reef Clownfish & Blue-Yellow Tang
      if (index % 2 === 0) {
        bodyColor = 0xff6d00; // Clownfish orange
        accentColor = 0xffffff; // White band
        finColor = 0xffab40;
      } else {
        bodyColor = 0x00b0ff; // Regal Blue Tang
        accentColor = 0xffea00; // Bright yellow tail/accent
        finColor = 0xffea00;
      }
    } else {
      // Traditional Japanese Koi (orange, white, black/red markings)
      if (index % 3 === 0) {
        bodyColor = 0xff5722; // Deep vibrant orange
        accentColor = 0xffffff;
      } else if (index % 3 === 1) {
        bodyColor = 0xffffff; // White with crimson Kohaku markings
        accentColor = 0xd50000;
      } else {
        bodyColor = 0xffab00; // Imperial Gold
        accentColor = 0xffffff;
      }
    }

    const fishMat = new THREE.MeshStandardMaterial({ 
      color: bodyColor, 
      roughness: 0.3, 
      metalness: 0.1,
      emissive: emissiveColor,
      emissiveIntensity: emissiveInt
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.3,
      emissive: emissiveColor,
      emissiveIntensity: emissiveInt * 0.8
    });

    // 1. Sleek Torpedo Fish Body
    const bodyGeo = new THREE.ConeGeometry(0.55, 2.2, 8);
    bodyGeo.rotateX(Math.PI / 2);
    bodyGeo.scale(1, 0.75, 1);
    const body = new THREE.Mesh(bodyGeo, fishMat);
    body.position.z = 0.4;
    group.add(body);

    // 2. Koi color spot / saddle patch on back
    const spotGeo = new THREE.SphereGeometry(0.35, 8, 8);
    spotGeo.scale(1, 0.6, 1.4);
    const spot = new THREE.Mesh(spotGeo, accentMat);
    spot.position.set(0, 0.25, 0.3);
    group.add(spot);

    // 3. Wagging Tail Pivot Joint
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0, -0.6); // Rear of body
    
    // Tail fin (flat triangle/fin)
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(0.5, -0.9);
    finShape.lineTo(0, -0.6);
    finShape.lineTo(-0.5, -0.9);
    finShape.closePath();
    const finGeo = new THREE.ShapeGeometry(finShape);
    finGeo.rotateY(Math.PI / 2);
    const tailFin = new THREE.Mesh(finGeo, new THREE.MeshStandardMaterial({ 
      color: finColor, 
      side: THREE.DoubleSide, 
      transparent: true, 
      opacity: 0.9,
      emissive: emissiveColor,
      emissiveIntensity: emissiveInt
    }));
    tailFin.position.set(0, 0, -0.2);
    tailPivot.add(tailFin);
    group.add(tailPivot);

    // 4. Pectoral side fins
    const pecGeo = new THREE.PlaneGeometry(0.4, 0.35);
    const leftPec = new THREE.Mesh(pecGeo, fishMat);
    leftPec.rotation.set(0.3, -0.5, -0.2);
    leftPec.position.set(-0.45, -0.05, 0.5);
    group.add(leftPec);

    const rightPec = new THREE.Mesh(pecGeo, fishMat);
    rightPec.rotation.set(0.3, 0.5, 0.2);
    rightPec.position.set(0.45, -0.05, 0.5);
    group.add(rightPec);

    return { mesh: group, tailPivot };
  }

  createLilyPadMesh() {
    const padGroup = new THREE.Group();

    // Circular pad with a pie-slice notch
    const shape = new THREE.Shape();
    const radius = 1.35;
    shape.absarc(0, 0, radius, 0.25, Math.PI * 2 - 0.25, false);
    shape.lineTo(0, 0);
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.8, side: THREE.DoubleSide });
    const pad = new THREE.Mesh(geo, mat);
    padGroup.add(pad);

    // Lotus flower on top
    const flowerGeo = new THREE.ConeGeometry(0.38, 0.45, 6);
    const flowerMat = new THREE.MeshStandardMaterial({ color: 0xf48fb1, roughness: 0.4 });
    const flower = new THREE.Mesh(flowerGeo, flowerMat);
    flower.position.set(0.2, 0.2, 0.2);
    padGroup.add(flower);

    // Yellow center stamen
    const centerGeo = new THREE.SphereGeometry(0.12, 6, 6);
    const centerMat = new THREE.MeshBasicMaterial({ color: 0xffeb3b });
    const center = new THREE.Mesh(centerGeo, centerMat);
    center.position.set(0.2, 0.4, 0.2);
    padGroup.add(center);

    return padGroup;
  }

  createCattailsCluster() {
    const group = new THREE.Group();
    const reedMat = new THREE.MeshStandardMaterial({ color: 0x388e3c, roughness: 0.8 });
    const cattailMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.9 });

    for (let i = 0; i < 5; i++) {
      const h = 2.5 + Math.random() * 1.5;
      const stemGeo = new THREE.CylinderGeometry(0.06, 0.08, h, 5);
      const stem = new THREE.Mesh(stemGeo, reedMat);
      stem.position.set((Math.random() - 0.5) * 1.2, h / 2 - 1.2, (Math.random() - 0.5) * 1.2);
      stem.rotation.z = (Math.random() - 0.5) * 0.15;
      group.add(stem);

      if (i % 2 === 0) {
        const topGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.7, 6);
        const top = new THREE.Mesh(topGeo, cattailMat);
        top.position.set(stem.position.x, stem.position.y + h / 2 - 0.2, stem.position.z);
        group.add(top);
      }
    }
    return group;
  }

  createHorizonMountains(biome) {
    const group = new THREE.Group();
    let mountainColor = 0x6d5d4b;
    if (biome === 'desert') mountainColor = 0xc68b59;
    else if (biome === 'cyber') mountainColor = 0x0f172a;
    else if (biome === 'arctic') mountainColor = 0x4fc3f7;
    else if (biome === 'volcano') mountainColor = 0x261410;
    else if (biome === 'jungle') mountainColor = 0x1b5e20;
    else if (biome === 'sunset_city') mountainColor = 0x311b47;
    else if (biome === 'matsuri') mountainColor = 0x28183b;
    else if (biome === 'tropical_island') mountainColor = 0x26a69a;
    else if (biome === 'night_stealth') mountainColor = 0x0a1426;

    const mtnMat = new THREE.MeshStandardMaterial({ 
      color: mountainColor, 
      roughness: 0.85, 
      flatShading: true 
    });

    const numPeaks = 32;
    const radius = 450;

    for (let i = 0; i < numPeaks; i++) {
      const angle = (i / numPeaks) * Math.PI * 2 + (Math.sin(i * 3) * 0.1);
      const r = radius + (Math.sin(i * 5) * 40);
      const h = 45 + (Math.sin(i * 7) * 20) + (Math.cos(i * 3) * 15);
      const w = 45 + (Math.cos(i * 4) * 15);

      const peakGeo = new THREE.ConeGeometry(w, h, 6);
      const peak = new THREE.Mesh(peakGeo, mtnMat);
      peak.position.set(Math.cos(angle) * r, h / 2 - 2, Math.sin(angle) * r);
      group.add(peak);
    }
    return group;
  }

  createStoneBridgeMesh(length, width, biome) {
    const bridgeGroup = new THREE.Group();

    // 1. Stone deck material
    let stoneColor = 0x8d8070;
    let railColor = 0x6d5e50;
    let lanternColor = 0xffca28;

    if (biome === 'desert') {
      stoneColor = 0xc89666;
      railColor = 0xa67346;
    } else if (biome === 'cyber') {
      stoneColor = 0x1e293b;
      railColor = 0x00e5ff;
      lanternColor = 0x00e5ff;
    } else if (biome === 'arctic') {
      stoneColor = 0x4fc3f7;
      railColor = 0x0288d1;
      lanternColor = 0xffd54f;
    } else if (biome === 'volcano') {
      stoneColor = 0x37474f;
      railColor = 0xd84315;
      lanternColor = 0xff6d00;
    } else if (biome === 'jungle') {
      stoneColor = 0x4e6e58;
      railColor = 0x2e4c38;
      lanternColor = 0xffd600;
    } else if (biome === 'sunset_city') {
      stoneColor = 0x334155;
      railColor = 0xff6e40;
      lanternColor = 0xffab40;
    } else if (biome === 'matsuri') {
      // Traditional Japanese Vermilion Red Lacquer Bridge (Taiko-bashi style)
      stoneColor = 0x5d4037;
      railColor = 0xd32f2f;
      lanternColor = 0xff5252;
    } else if (biome === 'tropical_island') {
      // Warm Tropical Bamboo & Coral Sandstone Pier Bridge
      stoneColor = 0xd7b377;
      railColor = 0xa1662f;
      lanternColor = 0xffea00;
    } else if (biome === 'night_stealth') {
      // Dark Midnight Tactical Steel & Cyan Beacon Bridge
      stoneColor = 0x162238;
      railColor = 0x0284c7;
      lanternColor = 0x38bdf8;
    }

    const stoneMat = new THREE.MeshStandardMaterial({ 
      color: stoneColor, 
      roughness: 0.65, 
      metalness: 0.1 
    });
    const railMat = (biome === 'cyber') 
      ? new THREE.MeshStandardMaterial({ color: railColor, emissive: 0x00e5ff, emissiveIntensity: 0.6 })
      : new THREE.MeshStandardMaterial({ color: railColor, roughness: 0.55 });

    // Deck slab (length across canal, width along wall)
    const deckGeo = new THREE.BoxGeometry(width, 1.2, length);
    const deck = new THREE.Mesh(deckGeo, stoneMat);
    deck.position.y = -0.4;
    deck.castShadow = true;
    deck.receiveShadow = true;
    bridgeGroup.add(deck);

    // Stone Under-Arch pier (curved support dipping into the water)
    const archGeo = new THREE.CylinderGeometry(width * 0.45, width * 0.45, length * 0.7, 12, 1, false, 0, Math.PI);
    archGeo.rotateZ(Math.PI / 2);
    archGeo.rotateY(Math.PI / 2);
    const arch = new THREE.Mesh(archGeo, stoneMat);
    arch.position.set(0, -1.0, 0);
    arch.castShadow = true;
    bridgeGroup.add(arch);

    // Left and Right Stone Parapets / Railings
    const railThickness = 0.8;
    const railHeight = 1.6;
    const railGeo = new THREE.BoxGeometry(railThickness, railHeight, length);
    
    const leftRail = new THREE.Mesh(railGeo, railMat);
    leftRail.position.set(-width / 2 + railThickness / 2, 0.7, 0);
    leftRail.castShadow = true;
    bridgeGroup.add(leftRail);

    const rightRail = new THREE.Mesh(railGeo, railMat);
    rightRail.position.set(width / 2 - railThickness / 2, 0.7, 0);
    rightRail.castShadow = true;
    bridgeGroup.add(rightRail);

    // 4 Corner Stone Baluster Pillars with glowing lanterns (Additive aura halo instead of 16 PointLights!)
    const pillarGeo = new THREE.BoxGeometry(1.2, 2.4, 1.2);
    const lanternGeo = new THREE.SphereGeometry(0.45, 10, 8);
    const lanternMat = new THREE.MeshBasicMaterial({ color: lanternColor });
    const lanternHaloGeo = new THREE.SphereGeometry(0.95, 10, 8);
    const lanternHaloMat = new THREE.MeshBasicMaterial({
      color: lanternColor,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const cornerOffsets = [
      { x: -width / 2 + 0.6, z: -length / 2 + 0.6 },
      { x: width / 2 - 0.6, z: -length / 2 + 0.6 },
      { x: -width / 2 + 0.6, z: length / 2 - 0.6 },
      { x: width / 2 - 0.6, z: length / 2 - 0.6 },
    ];

    cornerOffsets.forEach(pos => {
      const pillar = new THREE.Mesh(pillarGeo, stoneMat);
      pillar.position.set(pos.x, 0.9, pos.z);
      pillar.castShadow = true;
      bridgeGroup.add(pillar);

      const lantern = new THREE.Mesh(lanternGeo, lanternMat);
      lantern.position.set(pos.x, 2.3, pos.z);
      bridgeGroup.add(lantern);

      const halo = new THREE.Mesh(lanternHaloGeo, lanternHaloMat);
      halo.position.set(pos.x, 2.3, pos.z);
      bridgeGroup.add(halo);
    });

    return bridgeGroup;
  }

  createLandscapeTexture(biome) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    if (biome === 'desert') {
      ctx.fillStyle = '#dca868';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = 'rgba(180, 122, 58, 0.28)';
      ctx.lineWidth = 3;
      for (let y = 16; y < 256; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(85, y + 10, 170, y - 10, 256, y);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255, 232, 185, 0.22)';
      for (let i = 0; i < 40; i++) {
        ctx.fillRect((i * 53) % 256, (i * 97) % 256, 4, 4);
      }
    } else if (biome === 'cyber') {
      ctx.fillStyle = '#0b1322';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.16)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 256; i += 64) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0, 229, 255, 0.22)';
      ctx.fillRect(60, 60, 8, 8);
      ctx.fillRect(188, 188, 8, 8);
    } else if (biome === 'arctic') {
      ctx.fillStyle = '#bce6fa';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const x = (i * 67) % 256;
        const y = (i * 43) % 256;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 28, y + 14);
        ctx.stroke();
      }
    } else if (biome === 'volcano') {
      ctx.fillStyle = '#26130e';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = 'rgba(255, 87, 34, 0.22)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 10; i++) {
        const x = (i * 73) % 220;
        const y = (i * 59) % 220;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 24, y + 18);
        ctx.lineTo(x + 12, y + 34);
        ctx.stroke();
      }
    } else if (biome === 'jungle') {
      ctx.fillStyle = '#235c27';
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 55; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(46, 125, 50, 0.38)' : 'rgba(20, 68, 26, 0.35)';
        ctx.beginPath();
        ctx.arc((i * 47) % 256, (i * 89) % 256, 8 + (i % 7), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (biome === 'sunset_city') {
      // Twilight metropolitan asphalt grid with illuminated sunset-gold & magenta avenue markings
      ctx.fillStyle = '#1e1b2e';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = 'rgba(255, 138, 101, 0.28)';
      ctx.lineWidth = 3;
      for (let i = 0; i <= 256; i += 64) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255, 193, 7, 0.25)';
      for (let i = 0; i < 24; i++) {
        ctx.fillRect((i * 43) % 240, (i * 71) % 240, 6, 4);
      }
    } else if (biome === 'matsuri') {
      // Japanese night festival garden moss & stone courtyard with fallen pink sakura petals
      ctx.fillStyle = '#231829';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = 'rgba(255, 171, 64, 0.22)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 256; i += 64) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
      }
      for (let i = 0; i < 50; i++) {
        ctx.fillStyle = i % 3 === 0 ? 'rgba(255, 128, 171, 0.55)' : 'rgba(255, 204, 128, 0.35)';
        ctx.beginPath();
        ctx.arc((i * 53) % 256, (i * 89) % 256, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (biome === 'tropical_island') {
      // Rich warm golden-orange tropical beach sand with toasted amber dune ripples & terracotta coral accents
      ctx.fillStyle = '#e09145';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = 'rgba(176, 96, 26, 0.42)';
      ctx.lineWidth = 3;
      for (let y = 16; y < 256; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(85, y + 8, 170, y - 8, 256, y);
        ctx.stroke();
      }
      for (let i = 0; i < 36; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(214, 114, 32, 0.42)' : 'rgba(46, 139, 87, 0.32)';
        ctx.beginPath();
        ctx.arc((i * 61) % 256, (i * 97) % 256, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (biome === 'night_stealth') {
      // Deep nocturnal midnight slate-blue terrain with subtle tactical grid & dark shadow foliage
      ctx.fillStyle = '#081020';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = 'rgba(15, 28, 52, 0.65)';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillRect(128, 128, 128, 128);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 256; i += 64) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
      }
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = i % 3 === 0 ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.5)';
        ctx.fillRect((i * 47) % 248, (i * 83) % 248, 5, 5);
      }
    } else {
      // Workshop lush alpine meadow grass with subtle clover & tile variation
      ctx.fillStyle = '#5a9234';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = 'rgba(104, 159, 56, 0.45)';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillRect(128, 128, 128, 128);
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = i % 3 === 0 ? 'rgba(139, 195, 74, 0.35)' : 'rgba(51, 105, 30, 0.28)';
        const gx = (i * 41) % 250;
        const gy = (i * 83) % 250;
        ctx.fillRect(gx, gy, 4, 8);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(110, 110);
    return tex;
  }

  // Helper: Creates two Japanese festival lamp posts ("farolas") connected by a catenary string cable with hanging glowing paper lanterns ("Chōchin")
  createFestivalLanternFestoon(x1, z1, x2, z2, numLanterns = 5, poleHeight = 7.4, includePoles = true) {
    const group = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.7 });
    const vermilionMat = new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.45 });
    const goldCapMat = new THREE.MeshStandardMaterial({ color: 0xffca28, metalness: 0.65, roughness: 0.25 });
    const cableMat = new THREE.MeshBasicMaterial({ color: 0x1a1110 });

    const buildFarolaPole = (px, pz) => {
      const poleGrp = new THREE.Group();
      poleGrp.position.set(px, 0, pz);
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 1.1), vermilionMat);
      base.position.y = 0.5;
      poleGrp.add(base);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, poleHeight, 8), poleMat);
      shaft.position.y = poleHeight / 2;
      shaft.castShadow = true;
      poleGrp.add(shaft);
      const topBar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.24, 0.35), vermilionMat);
      topBar.position.y = poleHeight - 0.2;
      poleGrp.add(topBar);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.65, 4), poleMat);
      roof.position.y = poleHeight + 0.35;
      roof.rotation.y = Math.PI / 4;
      poleGrp.add(roof);
      const topLamp = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffe082 }));
      topLamp.position.y = poleHeight - 0.55;
      poleGrp.add(topLamp);
      return poleGrp;
    };

    if (includePoles) {
      group.add(buildFarolaPole(x1, z1));
      group.add(buildFarolaPole(x2, z2));
    }

    // Catenary sag curve between the two lamp posts
    const sag = Math.min(2.1, Math.hypot(x2 - x1, z2 - z1) * 0.065);
    const pStart = new THREE.Vector3(x1, poleHeight - 0.35, z1);
    const pMid = new THREE.Vector3((x1 + x2) / 2, poleHeight - 0.35 - sag, (z1 + z2) / 2);
    const pEnd = new THREE.Vector3(x2, poleHeight - 0.35, z2);
    const curve = new THREE.CatmullRomCurve3([pStart, pMid, pEnd]);
    const cableGeo = new THREE.TubeGeometry(curve, 14, 0.055, 5, false);
    const cableMesh = new THREE.Mesh(cableGeo, cableMat);
    group.add(cableMesh);

    // Hang Chōchin paper lanterns along the catenary curve
    const lanternGeo = new THREE.SphereGeometry(0.46, 10, 8);
    lanternGeo.scale(0.88, 1.28, 0.88);
    const rimGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.12, 8);
    const haloGeo = new THREE.SphereGeometry(0.95, 8, 8);
    const lanternPalette = [0xff1744, 0xffab00, 0xff4081, 0xff6d00];

    for (let i = 1; i <= numLanterns; i++) {
      const t = i / (numLanterns + 1);
      const pt = curve.getPoint(t);
      const col = lanternPalette[(i - 1) % lanternPalette.length];

      const lGrp = new THREE.Group();
      lGrp.position.set(pt.x, pt.y - 0.52, pt.z);

      const body = new THREE.Mesh(lanternGeo, new THREE.MeshBasicMaterial({ color: col }));
      lGrp.add(body);

      const topRim = new THREE.Mesh(rimGeo, poleMat);
      topRim.position.y = 0.55;
      lGrp.add(topRim);

      const botRim = new THREE.Mesh(rimGeo, goldCapMat);
      botRim.position.y = -0.55;
      lGrp.add(botRim);

      const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      }));
      lGrp.add(halo);

      group.add(lGrp);
    }

    return group;
  }

  decorateTable(biome, mapW, mapH) {
    // Clear old props
    this.tableProps.forEach(p => this.scene.remove(p));
    this.tableProps = [];
    this.waterMeshes = [];
    this.fishList = [];
    this.waterLilies = [];
    this.cattails = [];
    this.envRotators = [];

    // Scale minimalist framing mat to fit snugly outside map border
    if (this.deskMatMesh) {
      this.deskMatMesh.scale.set((mapW + 36) / 160, (mapH + 36) / 160, 1);
    }

    const moatWidth = 16;
    const halfW = mapW / 2;
    const halfH = mapH / 2;

    // --- 1. EXPANSIVE TEXTURED LANDSCAPE TERRAIN (Zero extra draw calls) ---
    const landscapeTex = this.createLandscapeTexture(biome);
    const landscapeGeo = new THREE.PlaneGeometry(3500, 3500);
    const landscapeMat = new THREE.MeshStandardMaterial({ 
      map: landscapeTex,
      roughness: 0.86 
    });
    this.landscapeMat = landscapeMat;
    const landscapeMesh = new THREE.Mesh(landscapeGeo, landscapeMat);
    landscapeMesh.rotation.x = -Math.PI / 2;
    landscapeMesh.position.y = -1.45;
    landscapeMesh.receiveShadow = true;
    landscapeMesh.userData = { isEnvironment: true };
    this.scene.add(landscapeMesh);
    this.tableProps.push(landscapeMesh);

    // Horizon panoramic mountain ring
    const horizonMountains = this.createHorizonMountains(biome);
    horizonMountains.userData = { isEnvironment: true };
    this.scene.add(horizonMountains);
    this.tableProps.push(horizonMountains);

    // --- 2. SEAMLESS WORLD-SPACE GLSL WATER MOAT & RIVERBED ---
    this.waterShaderMat = this.createWaterShaderMaterial(biome, halfW, halfH, moatWidth);

    // Textured Riverbed Floor underneath the water so Koi fish & lily pads cast depth
    const bedColor = biome === 'desert' ? 0x8d6e63
      : biome === 'cyber' ? 0x050b14
      : biome === 'arctic' ? 0x01579b
      : biome === 'volcano' ? 0x1a0804
      : biome === 'jungle' ? 0x004d40
      : biome === 'sunset_city' ? 0x1a1033
      : biome === 'matsuri' ? 0x141229
      : biome === 'tropical_island' ? 0x00acc1
      : biome === 'night_stealth' ? 0x050d1a
      : 0x014f86;
    const bedMat = new THREE.MeshStandardMaterial({ color: bedColor, roughness: 0.9 });

    const addWaterChannel = (w, d, x, z) => {
      // Riverbed bottom slab (placed above landscapeMesh at -1.45 so grass never pokes through!)
      const bedMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), bedMat);
      bedMesh.rotation.x = -Math.PI / 2;
      bedMesh.position.set(x, -1.39, z);
      bedMesh.receiveShadow = true;
      bedMesh.userData = { isEnvironment: true };
      this.scene.add(bedMesh);
      this.tableProps.push(bedMesh);

      // Seamless Water Surface Plane at y = -1.16 (cleanly above riverbed and below stone quay top)
      const geo = new THREE.PlaneGeometry(w, d, 1, 1);
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, this.waterShaderMat);
      mesh.position.set(x, -1.16, z);
      mesh.userData = { isEnvironment: true };
      this.scene.add(mesh);
      this.tableProps.push(mesh);
      this.waterMeshes.push(mesh);
    };

    // North canal (full width including corners)
    addWaterChannel(mapW + moatWidth * 2 + 4, moatWidth, 0, -halfH - 1 - moatWidth / 2);
    // South canal (full width including corners)
    addWaterChannel(mapW + moatWidth * 2 + 4, moatWidth, 0, halfH + 1 + moatWidth / 2);
    // West canal (exact middle span between North and South canals so corners NEVER overlap!)
    addWaterChannel(moatWidth, mapH + 2, -halfW - 1 - moatWidth / 2, 0);
    // East canal (exact middle span between North and South canals so corners NEVER overlap!)
    addWaterChannel(moatWidth, mapH + 2, halfW + 1 + moatWidth / 2, 0);

    // --- 2B. LIGHTWEIGHT BIOME WEATHER PARTICLE SYSTEM (1 Draw Call) ---
    this.createWeatherSystem(biome, mapW, mapH);

    // --- 3. ANIMATED SWIMMING FISH IN THE WATER MOAT ---
    const numFish = 10;
    const L_horiz = (halfW * 2) + 2 + moatWidth;
    const L_vert = (halfH * 2) + 2 + moatWidth;
    const totalP = 2 * (L_horiz + L_vert);

    for (let i = 0; i < numFish; i++) {
      const fishObj = this.createFishMesh(biome, i);
      const startDist = (i / numFish) * totalP;
      const speed = 8.5 + (i % 3) * 2.4;
      const laneOffset = ((i % 4) - 1.5) * 2.8;

      fishObj.mesh.userData = { isEnvironment: true };
      this.scene.add(fishObj.mesh);
      this.tableProps.push(fishObj.mesh);

      this.fishList.push({
        mesh: fishObj.mesh,
        tailPivot: fishObj.tailPivot,
        dist: startDist,
        speed: speed,
        laneOffset: laneOffset,
        seed: i * 2.1
      });
    }

    // --- 4. STONE QUAY EMBANKMENTS ---
    const stoneBankMat = new THREE.MeshStandardMaterial({
      color: biome === 'desert' ? 0xc89666
        : biome === 'cyber' ? 0x1e293b
        : biome === 'arctic' ? 0x29b6f6
        : biome === 'volcano' ? 0x4e342e
        : biome === 'jungle' ? 0x33691e
        : biome === 'sunset_city' ? 0x334155
        : biome === 'matsuri' ? 0xb71c1c
        : biome === 'tropical_island' ? 0xd4853b
        : biome === 'night_stealth' ? 0x162238
        : 0x795548,
      roughness: 0.65
    });

    const addCurb = (w, d, x, z) => {
      const geo = new THREE.BoxGeometry(w, 1.2, d);
      const mesh = new THREE.Mesh(geo, stoneBankMat);
      mesh.position.set(x, -1.2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { isEnvironment: true };
      this.scene.add(mesh);
      this.tableProps.push(mesh);
    };

    // Outer canal stone quays
    const outerNorthZ = -halfH - 1 - moatWidth;
    const outerSouthZ = halfH + 1 + moatWidth;
    const outerWestX = -halfW - 1 - moatWidth;
    const outerEastX = halfW + 1 + moatWidth;

    addCurb(mapW + moatWidth * 2 + 8, 1.8, 0, outerNorthZ - 0.9);
    addCurb(mapW + moatWidth * 2 + 8, 1.8, 0, outerSouthZ + 0.9);
    addCurb(1.8, mapH + moatWidth * 2 + 8, outerWestX - 0.9, 0);
    addCurb(1.8, mapH + moatWidth * 2 + 8, outerEastX + 0.9, 0);

    // --- 5. STONE BRIDGES & PAVED EXTERIOR ROADS ---
    const bridgeWidth = 8.5;
    const bridgeLength = moatWidth + 4;

    const southBridge = this.createStoneBridgeMesh(bridgeLength, bridgeWidth, biome);
    southBridge.position.set(0, 0, halfH + 1 + moatWidth / 2);
    southBridge.userData = { isEnvironment: true };
    this.scene.add(southBridge);
    this.tableProps.push(southBridge);

    const northBridge = this.createStoneBridgeMesh(bridgeLength, bridgeWidth, biome);
    northBridge.position.set(0, 0, -halfH - 1 - moatWidth / 2);
    northBridge.userData = { isEnvironment: true };
    this.scene.add(northBridge);
    this.tableProps.push(northBridge);

    const eastBridge = this.createStoneBridgeMesh(bridgeLength, bridgeWidth, biome);
    eastBridge.rotation.y = Math.PI / 2;
    eastBridge.position.set(halfW + 1 + moatWidth / 2, 0, 0);
    eastBridge.userData = { isEnvironment: true };
    this.scene.add(eastBridge);
    this.tableProps.push(eastBridge);

    const westBridge = this.createStoneBridgeMesh(bridgeLength, bridgeWidth, biome);
    westBridge.rotation.y = Math.PI / 2;
    westBridge.position.set(-halfW - 1 - moatWidth / 2, 0, 0);
    westBridge.userData = { isEnvironment: true };
    this.scene.add(westBridge);
    this.tableProps.push(westBridge);

    // Paved roads extending outward from all 4 bridges so bridges connect naturally into the landscape
    const roadLen = 180;
    const roadW = 7.4;
    const roadColor = biome === 'desert' ? 0xb88655
      : biome === 'cyber' ? 0x111c2d
      : biome === 'arctic' ? 0x81d4fa
      : biome === 'volcano' ? 0x37474f
      : biome === 'jungle' ? 0x557153
      : biome === 'sunset_city' ? 0x1e293b
      : biome === 'matsuri' ? 0x4e342e
      : biome === 'tropical_island' ? 0xc87a32
      : biome === 'night_stealth' ? 0x111a2e
      : 0x9e9284;
    const roadMat = new THREE.MeshStandardMaterial({
      color: roadColor,
      roughness: 0.78,
      emissive: biome === 'cyber' ? 0x00e5ff : (biome === 'volcano' ? 0xbf360c : (biome === 'sunset_city' ? 0xff6e40 : (biome === 'night_stealth' ? 0x0284c7 : 0x000000))),
      emissiveIntensity: biome === 'cyber' ? 0.15 : (biome === 'volcano' ? 0.12 : (biome === 'sunset_city' ? 0.1 : (biome === 'night_stealth' ? 0.12 : 0)))
    });
    const nsRoadGeo = new THREE.BoxGeometry(roadW, 0.22, roadLen);
    const ewRoadGeo = new THREE.BoxGeometry(roadLen, 0.22, roadW);

    const northRoad = new THREE.Mesh(nsRoadGeo, roadMat);
    northRoad.position.set(0, -1.42, outerNorthZ - 1.5 - roadLen / 2);
    northRoad.receiveShadow = true;
    northRoad.userData = { isEnvironment: true };
    this.scene.add(northRoad);
    this.tableProps.push(northRoad);

    const southRoad = new THREE.Mesh(nsRoadGeo, roadMat);
    southRoad.position.set(0, -1.42, outerSouthZ + 1.5 + roadLen / 2);
    southRoad.receiveShadow = true;
    southRoad.userData = { isEnvironment: true };
    this.scene.add(southRoad);
    this.tableProps.push(southRoad);

    const westRoad = new THREE.Mesh(ewRoadGeo, roadMat);
    westRoad.position.set(outerWestX - 1.5 - roadLen / 2, -1.42, 0);
    westRoad.receiveShadow = true;
    westRoad.userData = { isEnvironment: true };
    this.scene.add(westRoad);
    this.tableProps.push(westRoad);

    const eastRoad = new THREE.Mesh(ewRoadGeo, roadMat);
    eastRoad.position.set(outerEastX + 1.5 + roadLen / 2, -1.42, 0);
    eastRoad.receiveShadow = true;
    eastRoad.userData = { isEnvironment: true };
    this.scene.add(eastRoad);
    this.tableProps.push(eastRoad);

    // --- 6. NATURE: LILY PADS WITH LOTUS FLOWERS IN WATER ---
    const lilyOffsets = [
      { x: -halfW / 2, z: -halfH - 1 - moatWidth / 2 - 3 },
      { x: halfW / 2 + 2, z: -halfH - 1 - moatWidth / 2 + 2 },
      { x: -halfW / 2 - 4, z: halfH + 1 + moatWidth / 2 + 3 },
      { x: halfW / 2, z: halfH + 1 + moatWidth / 2 - 2 },
      { x: -halfW - 1 - moatWidth / 2 - 2, z: -halfH / 2 },
      { x: -halfW - 1 - moatWidth / 2 + 3, z: halfH / 2 + 3 },
      { x: halfW + 1 + moatWidth / 2 - 2, z: -halfH / 2 - 2 },
      { x: halfW + 1 + moatWidth / 2 + 3, z: halfH / 2 },
      { x: 10, z: halfH + 1 + moatWidth / 2 + 3 },
      { x: -12, z: -halfH - 1 - moatWidth / 2 - 2 }
    ];

    lilyOffsets.forEach((pos, idx) => {
      const lily = this.createLilyPadMesh();
      lily.position.set(pos.x, -1.13, pos.z);
      lily.rotation.y = idx * 1.3;
      lily.userData = { isEnvironment: true, seed: idx * 1.5 };
      this.scene.add(lily);
      this.tableProps.push(lily);
      this.waterLilies.push(lily);
    });

    // --- 7. NATURE: RIVER CATTAILS & REEDS ---
    const cattailLocations = [
      { x: -7, z: outerNorthZ - 0.5 },
      { x: 7, z: outerNorthZ - 0.5 },
      { x: -7, z: outerSouthZ + 0.5 },
      { x: 7, z: outerSouthZ + 0.5 },
      { x: outerWestX - 0.5, z: -7 },
      { x: outerWestX - 0.5, z: 7 },
      { x: outerEastX + 0.5, z: -7 },
      { x: outerEastX + 0.5, z: 7 },
      { x: -halfW * 0.7, z: outerNorthZ - 0.5 },
      { x: halfW * 0.7, z: outerSouthZ + 0.5 }
    ];

    cattailLocations.forEach((pos, idx) => {
      const reeds = this.createCattailsCluster();
      reeds.position.set(pos.x, 0, pos.z);
      reeds.userData = { isEnvironment: true, seed: idx * 2.0 };
      this.scene.add(reeds);
      this.tableProps.push(reeds);
      this.cattails.push(reeds);
    });

    // --- 8. HIGH-EFFICIENCY SHARED-GEOMETRY OUTER DIORAMA & BIOME LANDMARKS ---
    const addProp = (mesh, x, z, yOffset = -1.45) => {
      mesh.position.set(x, yOffset, z);
      mesh.userData = { isEnvironment: true };
      this.scene.add(mesh);
      this.tableProps.push(mesh);
    };

    // Shared River Boulders along the outer banks
    const stoneGeo = new THREE.DodecahedronGeometry(1.5, 0);
    const stoneMat = new THREE.MeshStandardMaterial({
      color: biome === 'volcano' ? 0x3e2723 : biome === 'arctic' ? 0x90caf9 : biome === 'cyber' ? 0x1e293b : 0x8d8376,
      roughness: 0.82,
      flatShading: true
    });
    const boulderCoords = [
      { x: outerWestX - 4, z: -halfH - 4, s: 1.1 },
      { x: outerEastX + 5, z: halfH + 4, s: 1.3 },
      { x: outerWestX - 5, z: halfH + 5, s: 0.95 },
      { x: outerEastX + 4, z: -halfH - 5, s: 1.15 },
      { x: -14, z: outerNorthZ - 4, s: 0.85 },
      { x: 14, z: outerSouthZ + 4, s: 1.05 },
      { x: outerWestX - 4, z: -15, s: 0.9 },
      { x: outerEastX + 4, z: 15, s: 1.1 }
    ];
    boulderCoords.forEach((b, idx) => {
      const rock = new THREE.Mesh(stoneGeo, stoneMat);
      rock.scale.set(b.s, b.s * 0.72, b.s);
      rock.rotation.set(idx * 0.7, idx * 1.1, 0);
      addProp(rock, b.x, b.z, -0.9);
    });

    // Standard perimeter coordinates for trees / pillars around the moat & roads
    const perimeterRing = [
      { x: -11, z: outerNorthZ - 9, s: 1.1 },
      { x: 11, z: outerNorthZ - 9, s: 1.0 },
      { x: -11, z: outerSouthZ + 9, s: 1.05 },
      { x: 11, z: outerSouthZ + 9, s: 1.15 },
      { x: outerWestX - 9, z: -11, s: 1.0 },
      { x: outerWestX - 9, z: 11, s: 1.12 },
      { x: outerEastX + 9, z: -11, s: 1.08 },
      { x: outerEastX + 9, z: 11, s: 0.96 },
      { x: outerWestX - 10, z: outerNorthZ - 8, s: 1.25 },
      { x: outerEastX + 10, z: outerNorthZ - 8, s: 1.2 },
      { x: outerWestX - 10, z: outerSouthZ + 8, s: 1.18 },
      { x: outerEastX + 10, z: outerSouthZ + 8, s: 1.3 },
      { x: -halfW * 0.65, z: outerNorthZ - 12, s: 1.15 },
      { x: halfW * 0.65, z: outerSouthZ + 12, s: 1.1 },
      { x: outerWestX - 13, z: -halfH * 0.6, s: 1.22 },
      { x: outerEastX + 13, z: halfH * 0.6, s: 1.16 }
    ];

    if (biome === 'workshop') {
      // Shared geometries for multi-tiered alpine pines (zero extra shader compilations)
      const trunkGeo = new THREE.CylinderGeometry(0.42, 0.62, 2.4, 6);
      const cone1Geo = new THREE.ConeGeometry(2.7, 3.6, 7);
      const cone2Geo = new THREE.ConeGeometry(2.1, 3.2, 7);
      const cone3Geo = new THREE.ConeGeometry(1.4, 2.5, 7);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.85 });
      const foliageMatDark = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.78, flatShading: true });
      const foliageMatLight = new THREE.MeshStandardMaterial({ color: 0x43a047, roughness: 0.75, flatShading: true });

      const buildPine = (scale = 1) => {
        const tree = new THREE.Group();
        const t = new THREE.Mesh(trunkGeo, trunkMat); t.position.y = 1.2; tree.add(t);
        const c1 = new THREE.Mesh(cone1Geo, foliageMatDark); c1.position.y = 3.2; tree.add(c1);
        const c2 = new THREE.Mesh(cone2Geo, foliageMatLight); c2.position.y = 5.0; tree.add(c2);
        const c3 = new THREE.Mesh(cone3Geo, foliageMatDark); c3.position.y = 6.5; tree.add(c3);
        tree.scale.setScalar(scale);
        return tree;
      };

      perimeterRing.forEach(p => {
        addProp(buildPine(p.s), p.x, p.z, -1.45);
      });

      // Charming Riverside Watermill & Watchtower on the West Bank (replaces the old yellow stick!)
      const millGroup = new THREE.Group();
      const stoneBaseMat = new THREE.MeshStandardMaterial({ color: 0x8d8070, roughness: 0.8 });
      const timberMat = new THREE.MeshStandardMaterial({ color: 0xede0d4, roughness: 0.7 });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0xb71c1c, roughness: 0.65, flatShading: true });
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.75 });

      const base = new THREE.Mesh(new THREE.BoxGeometry(6.5, 3.2, 6.5), stoneBaseMat);
      base.position.y = 1.6;
      base.castShadow = true;
      millGroup.add(base);

      const upper = new THREE.Mesh(new THREE.BoxGeometry(5.8, 3.6, 5.8), timberMat);
      upper.position.y = 5.0;
      upper.castShadow = true;
      millGroup.add(upper);

      const roof = new THREE.Mesh(new THREE.ConeGeometry(5.2, 3.8, 4), roofMat);
      roof.position.y = 8.7;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      millGroup.add(roof);

      // Rotating Waterwheel on the canal-facing side
      const wheelPivot = new THREE.Group();
      wheelPivot.position.set(3.55, 2.2, 0);
      const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.22, 6, 12), woodMat);
      wheelRim.rotation.y = Math.PI / 2;
      wheelPivot.add(wheelRim);
      const bladeGeo = new THREE.BoxGeometry(0.45, 4.6, 0.22);
      for (let b = 0; b < 4; b++) {
        const spoke = new THREE.Mesh(bladeGeo, woodMat);
        spoke.rotation.x = (b * Math.PI) / 4;
        wheelPivot.add(spoke);
      }
      millGroup.add(wheelPivot);
      this.envRotators.push({ mesh: wheelPivot, axis: 'x', speed: 1.1 });

      addProp(millGroup, outerWestX - 5.2, -halfH * 0.32, -1.45);

      // Stone Lantern Bollards flanking the 4 exterior roads
      const postGeo = new THREE.BoxGeometry(1.0, 2.2, 1.0);
      const lampGeo = new THREE.SphereGeometry(0.42, 8, 6);
      const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd54f });
      const roadLanterns = [
        { x: -5.2, z: outerNorthZ - 14 }, { x: 5.2, z: outerNorthZ - 14 },
        { x: -5.2, z: outerSouthZ + 14 }, { x: 5.2, z: outerSouthZ + 14 },
        { x: outerWestX - 14, z: -5.2 }, { x: outerWestX - 14, z: 5.2 },
        { x: outerEastX + 14, z: -5.2 }, { x: outerEastX + 14, z: 5.2 }
      ];
      roadLanterns.forEach(lp => {
        const lg = new THREE.Group();
        const post = new THREE.Mesh(postGeo, stoneBaseMat); post.position.y = 1.1; lg.add(post);
        const bulb = new THREE.Mesh(lampGeo, lampMat); bulb.position.y = 2.4; lg.add(bulb);
        addProp(lg, lp.x, lp.z, -1.45);
      });

    } else if (biome === 'desert') {
      // Oasis Palm Trees around the canal & roads
      const palmTrunkGeo = new THREE.CylinderGeometry(0.32, 0.55, 5.5, 6);
      const frondGeo = new THREE.ConeGeometry(2.2, 0.8, 5);
      const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.85 });
      const frondMat = new THREE.MeshStandardMaterial({ color: 0x558b2f, roughness: 0.75, flatShading: true });

      const buildPalm = (scale = 1) => {
        const palm = new THREE.Group();
        const trunk = new THREE.Mesh(palmTrunkGeo, palmTrunkMat);
        trunk.position.y = 2.7;
        trunk.rotation.z = 0.08;
        palm.add(trunk);
        const crown = new THREE.Mesh(frondGeo, frondMat);
        crown.position.set(-0.2, 5.6, 0);
        crown.scale.set(1.3, 1.0, 1.3);
        palm.add(crown);
        palm.scale.setScalar(scale);
        return palm;
      };

      perimeterRing.forEach(p => {
        addProp(buildPalm(p.s), p.x, p.z, -1.45);
      });

      // Ancient Stepped Sandstone Pyramids with floating golden capstones
      const sandMat = new THREE.MeshStandardMaterial({ color: 0xd49b63, roughness: 0.78, flatShading: true });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd54f, metalness: 0.65, roughness: 0.25 });
      const buildPyramid = (scale = 1) => {
        const pyr = new THREE.Group();
        const p1 = new THREE.Mesh(new THREE.BoxGeometry(10, 2.2, 10), sandMat); p1.position.y = 1.1; pyr.add(p1);
        const p2 = new THREE.Mesh(new THREE.BoxGeometry(7.2, 2.2, 7.2), sandMat); p2.position.y = 3.3; pyr.add(p2);
        const p3 = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.2, 4.6), sandMat); p3.position.y = 5.5; pyr.add(p3);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.5, 4), goldMat);
        cap.position.y = 8.4;
        cap.rotation.y = Math.PI / 4;
        pyr.add(cap);
        this.envRotators.push({ mesh: cap, axis: 'y', speed: 0.9 });
        pyr.scale.setScalar(scale);
        return pyr;
      };
      addProp(buildPyramid(1.1), outerWestX - 14, outerNorthZ - 12, -1.45);
      addProp(buildPyramid(0.95), outerEastX + 15, outerSouthZ + 12, -1.45);

    } else if (biome === 'cyber') {
      // Neon Server Monoliths & Spinning Holographic Rings
      const pillarGeo = new THREE.BoxGeometry(2.6, 8.5, 2.6);
      const pillarMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x00e5ff, emissiveIntensity: 0.35, roughness: 0.2, metalness: 0.8 });
      const holoGeo = new THREE.TorusGeometry(2.4, 0.14, 6, 16);
      const holoMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });

      perimeterRing.slice(0, 12).forEach((p, idx) => {
        const nodeGroup = new THREE.Group();
        const col = new THREE.Mesh(pillarGeo, pillarMat);
        col.position.y = 4.25;
        nodeGroup.add(col);
        if (idx % 2 === 0) {
          const ring = new THREE.Mesh(holoGeo, holoMat);
          ring.position.y = 9.8;
          ring.rotation.x = Math.PI / 3;
          nodeGroup.add(ring);
          this.envRotators.push({ mesh: ring, axis: 'y', speed: 1.6 });
        }
        nodeGroup.scale.setScalar(p.s * 0.85);
        addProp(nodeGroup, p.x, p.z, -1.45);
      });

    } else if (biome === 'arctic') {
      // Snow-Clad Alpine Spruces & Translucent Glacier Spires
      const trunkGeo = new THREE.CylinderGeometry(0.38, 0.55, 2.0, 6);
      const snowCone1 = new THREE.ConeGeometry(2.5, 4.0, 6);
      const snowCone2 = new THREE.ConeGeometry(1.8, 3.2, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4e342e });
      const snowFoliageMat = new THREE.MeshStandardMaterial({ color: 0xe1f5fe, roughness: 0.5, flatShading: true });
      const iceGeo = new THREE.ConeGeometry(2.4, 8.5, 6);
      const iceMat = new THREE.MeshPhysicalMaterial({ color: 0x29b6f6, roughness: 0.15, transmission: 0.45, opacity: 0.9, transparent: true, flatShading: true });

      perimeterRing.forEach((p, idx) => {
        if (idx % 3 === 0) {
          const crystal = new THREE.Mesh(iceGeo, iceMat);
          crystal.scale.setScalar(p.s);
          addProp(crystal, p.x, p.z, 2.5);
        } else {
          const tree = new THREE.Group();
          const t = new THREE.Mesh(trunkGeo, trunkMat); t.position.y = 1.0; tree.add(t);
          const c1 = new THREE.Mesh(snowCone1, snowFoliageMat); c1.position.y = 3.2; tree.add(c1);
          const c2 = new THREE.Mesh(snowCone2, snowFoliageMat); c2.position.y = 5.4; tree.add(c2);
          tree.scale.setScalar(p.s);
          addProp(tree, p.x, p.z, -1.45);
        }
      });

    } else if (biome === 'volcano') {
      // Obsidian Spires & Glowing Magma Vent Monoliths
      const spireGeo = new THREE.ConeGeometry(2.6, 8.5, 6);
      const spireMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, emissive: 0xff3d00, emissiveIntensity: 0.45, roughness: 0.8, flatShading: true });
      const coreGeo = new THREE.OctahedronGeometry(1.3, 0);
      const coreMat = new THREE.MeshBasicMaterial({ color: 0xff9100 });

      perimeterRing.slice(0, 12).forEach((p, idx) => {
        const vent = new THREE.Group();
        const cone = new THREE.Mesh(spireGeo, spireMat);
        cone.position.y = 4.2;
        vent.add(cone);
        if (idx % 2 === 0) {
          const magmaCrystal = new THREE.Mesh(coreGeo, coreMat);
          magmaCrystal.position.y = 9.5;
          vent.add(magmaCrystal);
          this.envRotators.push({ mesh: magmaCrystal, axis: 'y', speed: 1.4 });
        }
        vent.scale.setScalar(p.s * 0.9);
        addProp(vent, p.x, p.z, -1.45);
      });

    } else if (biome === 'jungle') {
      // Giant Rainforest Canopy Trees & Stepped El Dorado Ziggurats
      const trunkGeo = new THREE.CylinderGeometry(0.45, 0.7, 3.2, 6);
      const canopyGeo = new THREE.DodecahedronGeometry(2.6, 0);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.85 });
      const canopyMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.75, flatShading: true });

      perimeterRing.forEach(p => {
        const tree = new THREE.Group();
        const t = new THREE.Mesh(trunkGeo, trunkMat); t.position.y = 1.6; tree.add(t);
        const c = new THREE.Mesh(canopyGeo, canopyMat); c.position.y = 4.2; c.scale.set(1.25, 0.85, 1.25); tree.add(c);
        tree.scale.setScalar(p.s);
        addProp(tree, p.x, p.z, -1.45);
      });

      const templeMat = new THREE.MeshStandardMaterial({ color: 0x4e6e58, roughness: 0.75 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xffca28, metalness: 0.75, roughness: 0.22 });
      const buildZiggurat = (scale = 1) => {
        const templeGroup = new THREE.Group();
        const s1 = new THREE.Mesh(new THREE.BoxGeometry(9.5, 2.2, 9.5), templeMat); s1.position.y = 1.1; templeGroup.add(s1);
        const s2 = new THREE.Mesh(new THREE.BoxGeometry(6.6, 2.2, 6.6), templeMat); s2.position.y = 3.3; templeGroup.add(s2);
        const s3 = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.0, 3.8), goldMat); s3.position.y = 5.4; templeGroup.add(s3);
        const idol = new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 0), goldMat);
        idol.position.y = 7.8;
        templeGroup.add(idol);
        this.envRotators.push({ mesh: idol, axis: 'y', speed: 1.2 });
        templeGroup.scale.setScalar(scale);
        return templeGroup;
      };
      addProp(buildZiggurat(1.05), outerWestX - 14, outerNorthZ - 12, -1.45);
      addProp(buildZiggurat(0.95), outerEastX + 14, outerSouthZ + 12, -1.45);

    } else if (biome === 'sunset_city') {
      // --- SUNSET NIGHT METROPOLIS: Illuminated 3D Skyscrapers, Neon Dusk Rooftops & Urban Boulevard Streetlights ---
      const makeBuildingWindowTex = (hueShift = 0) => {
        const c = document.createElement('canvas');
        c.width = 128; c.height = 256;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#141829';
        ctx.fillRect(0, 0, 128, 256);
        const winColors = ['#ffd54f', '#ff8a65', '#ff4081', '#40c4ff', '#1e293b'];
        for (let r = 10; r < 244; r += 16) {
          for (let col = 10; col < 116; col += 20) {
            const pick = (r * 7 + col * 3 + hueShift) % 7;
            ctx.fillStyle = pick < 4 ? winColors[pick] : '#0f172a';
            ctx.fillRect(col, r, 12, 9);
          }
        }
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
      };

      const winTexA = makeBuildingWindowTex(0);
      const winTexB = makeBuildingWindowTex(3);
      const bldgMatA = new THREE.MeshStandardMaterial({ map: winTexA, roughness: 0.35, metalness: 0.4, emissive: 0xff9100, emissiveMap: winTexA, emissiveIntensity: 0.65 });
      const bldgMatB = new THREE.MeshStandardMaterial({ map: winTexB, roughness: 0.35, metalness: 0.4, emissive: 0xff4081, emissiveMap: winTexB, emissiveIntensity: 0.6 });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.6 });
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });

      perimeterRing.forEach((p, idx) => {
        const tower = new THREE.Group();
        const w = 4.8 + (idx % 3) * 1.1;
        const h = 11.0 + (idx % 4) * 3.8;
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), idx % 2 === 0 ? bldgMatA : bldgMatB);
        body.position.y = h / 2;
        body.castShadow = true;
        tower.add(body);

        const crown = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 1.4, w * 0.72), roofMat);
        crown.position.y = h + 0.7;
        tower.add(crown);

        const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 3.2, 6), roofMat);
        spire.position.y = h + 2.8;
        tower.add(spire);

        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), beaconMat);
        beacon.position.y = h + 4.4;
        tower.add(beacon);

        addProp(tower, p.x * 1.08, p.z * 1.08, -1.45);
      });

      // Boulevard Streetlights with warm sunset-amber twin lamps along the canal avenues
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 });
      const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffab40 });
      const streetLampCoords = [
        { x: -6.2, z: outerNorthZ - 6 }, { x: 6.2, z: outerNorthZ - 6 },
        { x: -6.2, z: outerSouthZ + 6 }, { x: 6.2, z: outerSouthZ + 6 },
        { x: outerWestX - 6, z: -6.2 }, { x: outerWestX - 6, z: 6.2 },
        { x: outerEastX + 6, z: -6.2 }, { x: outerEastX + 6, z: 6.2 }
      ];
      streetLampCoords.forEach(sl => {
        const lamp = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 6.8, 8), poleMat);
        pole.position.y = 3.4;
        lamp.add(pole);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 0.18), poleMat);
        arm.position.y = 6.7;
        lamp.add(arm);
        const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), bulbMat);
        b1.position.set(-0.95, 6.5, 0);
        lamp.add(b1);
        const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), bulbMat);
        b2.position.set(0.95, 6.5, 0);
        lamp.add(b2);
        addProp(lamp, sl.x, sl.z, -1.45);
      });

    } else if (biome === 'matsuri') {
      // --- JAPANESE NIGHT FESTIVAL (MATSURI): Connected Lamp Posts with Hanging Paper Lanterns ("Luces entre Farolas"), Torii Gates, Sakura Trees & 5-Tier Pagoda ---
      // 1. Continuous Festival Lantern Festoons ("luces entre farolas") along all 4 outer canal banks
      const festoonSpans = [
        // North promenade (West & East of North bridge)
        { x1: -halfW - 8, z1: outerNorthZ - 3.5, x2: -6.5, z2: outerNorthZ - 3.5, n: 6 },
        { x1: 6.5, z1: outerNorthZ - 3.5, x2: halfW + 8, z2: outerNorthZ - 3.5, n: 6 },
        // South promenade (West & East of South bridge)
        { x1: -halfW - 8, z1: outerSouthZ + 3.5, x2: -6.5, z2: outerSouthZ + 3.5, n: 6 },
        { x1: 6.5, z1: outerSouthZ + 3.5, x2: halfW + 8, z2: outerSouthZ + 3.5, n: 6 },
        // West promenade (North & South of West bridge)
        { x1: outerWestX - 3.5, z1: -halfH - 8, x2: outerWestX - 3.5, z2: -6.5, n: 5 },
        { x1: outerWestX - 3.5, z1: 6.5, x2: outerWestX - 3.5, z2: halfH + 8, n: 5 },
        // East promenade (North & South of East bridge)
        { x1: outerEastX + 3.5, z1: -halfH - 8, x2: outerEastX + 3.5, z2: -6.5, n: 5 },
        { x1: outerEastX + 3.5, z1: 6.5, x2: outerEastX + 3.5, z2: halfH + 8, n: 5 }
      ];
      festoonSpans.forEach(sp => {
        const festoon = this.createFestivalLanternFestoon(sp.x1, sp.z1, sp.x2, sp.z2, sp.n, 7.8, true);
        addProp(festoon, 0, 0, -1.45);
      });

      // 2. Traditional Vermilion Torii Gates (鳥居) straddling the 4 exterior roads
      const vermilionMat = new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.42 });
      const blackWoodMat = new THREE.MeshStandardMaterial({ color: 0x1c1412, roughness: 0.65 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xffca28, metalness: 0.7, roughness: 0.25 });

      const buildToriiGate = (rotY = 0) => {
        const torii = new THREE.Group();
        const colGeo = new THREE.CylinderGeometry(0.45, 0.55, 8.8, 12);
        const leftCol = new THREE.Mesh(colGeo, vermilionMat);
        leftCol.position.set(-4.3, 4.4, 0);
        leftCol.castShadow = true;
        torii.add(leftCol);
        const rightCol = new THREE.Mesh(colGeo, vermilionMat);
        rightCol.position.set(4.3, 4.4, 0);
        rightCol.castShadow = true;
        torii.add(rightCol);

        // Top Kasagi lintel beam
        const topBeam = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.65, 0.95), blackWoodMat);
        topBeam.position.y = 8.9;
        torii.add(topBeam);
        const subBeam = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.48, 0.8), vermilionMat);
        subBeam.position.y = 8.4;
        torii.add(subBeam);
        // Nuki tie-beam
        const nukiBeam = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.45, 0.6), vermilionMat);
        nukiBeam.position.y = 6.9;
        torii.add(nukiBeam);
        // Gold Gaku plaque in center
        const plaque = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.35, 0.35), goldMat);
        plaque.position.y = 7.65;
        torii.add(plaque);

        torii.rotation.y = rotY;
        return torii;
      };

      addProp(buildToriiGate(0), 0, outerNorthZ - 8, -1.45);
      addProp(buildToriiGate(0), 0, outerSouthZ + 8, -1.45);
      addProp(buildToriiGate(Math.PI / 2), outerWestX - 8, 0, -1.45);
      addProp(buildToriiGate(Math.PI / 2), outerEastX + 8, 0, -1.45);

      // 3. Blooming Pink Sakura Cherry Blossom Trees around the perimeter
      const sakuraTrunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2c2a, roughness: 0.85 });
      const sakuraPinkMat = new THREE.MeshStandardMaterial({ color: 0xff80ab, roughness: 0.65, flatShading: true });
      const sakuraLightMat = new THREE.MeshStandardMaterial({ color: 0xf8bbd0, roughness: 0.6, flatShading: true });
      const blossomGeo = new THREE.DodecahedronGeometry(2.3, 0);

      perimeterRing.forEach((p, idx) => {
        const sakura = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.68, 3.2, 6), sakuraTrunkMat);
        trunk.position.y = 1.6;
        sakura.add(trunk);
        const c1 = new THREE.Mesh(blossomGeo, sakuraPinkMat);
        c1.position.set(0, 4.1, 0);
        c1.scale.set(1.25, 0.85, 1.25);
        sakura.add(c1);
        const c2 = new THREE.Mesh(blossomGeo, sakuraLightMat);
        c2.position.set(0.9, 5.1, 0.4);
        c2.scale.set(0.85, 0.7, 0.85);
        sakura.add(c2);
        sakura.scale.setScalar(p.s);
        addProp(sakura, p.x * 1.12, p.z * 1.12, -1.45);
      });

      // 4. Illuminated 5-Tier Japanese Pagoda Landmark on the Northwest & Southeast corners
      const buildPagoda = (scale = 1) => {
        const pag = new THREE.Group();
        for (let tier = 0; tier < 5; tier++) {
          const w = 6.8 - tier * 0.95;
          const y = tier * 2.5;
          const core = new THREE.Mesh(new THREE.BoxGeometry(w * 0.68, 2.0, w * 0.68), vermilionMat);
          core.position.y = y + 1.0;
          pag.add(core);
          const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.88, 1.15, 4), blackWoodMat);
          roof.position.y = y + 2.3;
          roof.rotation.y = Math.PI / 4;
          pag.add(roof);
        }
        const sorin = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.24, 3.2, 8), goldMat);
        sorin.position.y = 13.8;
        pag.add(sorin);
        pag.scale.setScalar(scale);
        return pag;
      };
      addProp(buildPagoda(1.0), outerWestX - 15, outerNorthZ - 14, -1.45);
      addProp(buildPagoda(0.92), outerEastX + 15, outerSouthZ + 14, -1.45);

    } else if (biome === 'tropical_island') {
      // --- TROPICAL PARADISE ISLAND: Curved Coconut Palm Trees, Striped Beach Umbrellas, Tiki Torches & Overwater Cabanas ---
      const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.85 });
      const palmFrondMat = new THREE.MeshStandardMaterial({ color: 0x2ecc71, roughness: 0.65, flatShading: true });
      const coconutMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.8 });

      const buildCoconutPalm = (scale = 1, leanAngle = 0.18) => {
        const palm = new THREE.Group();
        // Curved segmented trunk
        for (let s = 0; s < 4; s++) {
          const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.36 - s * 0.04, 0.44 - s * 0.04, 1.65, 7), palmTrunkMat);
          seg.position.set(Math.sin(leanAngle) * s * 0.55, s * 1.45 + 0.8, 0);
          seg.rotation.z = -leanAngle * (0.7 + s * 0.2);
          seg.castShadow = true;
          palm.add(seg);
        }
        const topX = Math.sin(leanAngle) * 1.85;
        const topY = 6.2;
        // Coconuts cluster
        for (let c = 0; c < 3; c++) {
          const nut = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 6), coconutMat);
          const a = (c / 3) * Math.PI * 2;
          nut.position.set(topX + Math.cos(a) * 0.32, topY - 0.25, Math.sin(a) * 0.32);
          palm.add(nut);
        }
        // Radiating tropical palm fronds
        for (let f = 0; f < 6; f++) {
          const fAngle = (f / 6) * Math.PI * 2;
          const frond = new THREE.Mesh(new THREE.ConeGeometry(0.85, 3.2, 4), palmFrondMat);
          frond.scale.set(1.0, 1.0, 0.28);
          frond.position.set(topX + Math.cos(fAngle) * 1.25, topY + 0.1, Math.sin(fAngle) * 1.25);
          frond.rotation.y = -fAngle;
          frond.rotation.z = -Math.PI / 2.6;
          palm.add(frond);
        }
        palm.scale.setScalar(scale);
        return palm;
      };

      perimeterRing.forEach((p, idx) => {
        const palm = buildCoconutPalm(p.s, (idx % 2 === 0 ? 1 : -1) * 0.2);
        palm.rotation.y = idx * 1.1;
        addProp(palm, p.x, p.z, -1.45);
      });

      // Colorful Beach Umbrellas & Tiki Torches along the sandy lagoon shores
      const umbrellaColors = [0xff5252, 0xffca28, 0x00e5ff, 0xff4081];
      const poleWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const flameMat = new THREE.MeshBasicMaterial({ color: 0xff9100 });
      const beachSpots = [
        { x: -16, z: outerNorthZ - 5 }, { x: 16, z: outerNorthZ - 5 },
        { x: -16, z: outerSouthZ + 5 }, { x: 16, z: outerSouthZ + 5 },
        { x: outerWestX - 5, z: -16 }, { x: outerEastX + 5, z: 16 }
      ];
      beachSpots.forEach((bs, idx) => {
        const umb = new THREE.Group();
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.4, 6), poleWhiteMat);
        stick.position.y = 1.7;
        umb.add(stick);
        const shade = new THREE.Mesh(
          new THREE.ConeGeometry(2.4, 1.1, 8),
          new THREE.MeshStandardMaterial({ color: umbrellaColors[idx % umbrellaColors.length], roughness: 0.5, flatShading: true })
        );
        shade.position.y = 3.3;
        shade.rotation.z = 0.12;
        umb.add(shade);
        addProp(umb, bs.x, bs.z, -1.45);

        // Adjacent Tiki Torch
        const torch = new THREE.Group();
        const bamboo = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.2, 6), palmTrunkMat);
        bamboo.position.y = 1.6;
        torch.add(bamboo);
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.75, 6), flameMat);
        flame.position.y = 3.45;
        torch.add(flame);
        addProp(torch, bs.x + (idx % 2 === 0 ? 3.2 : -3.2), bs.z, -1.45);
      });

      // Overwater Polynesian Tiki Cabana Huts on the corners
      const thatchMat = new THREE.MeshStandardMaterial({ color: 0xd4a359, roughness: 0.85, flatShading: true });
      const buildTikiCabana = (scale = 1) => {
        const hut = new THREE.Group();
        const deck = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.5, 7.2), palmTrunkMat);
        deck.position.y = 1.2;
        hut.add(deck);
        [[-2.8, -2.8], [2.8, -2.8], [-2.8, 2.8], [2.8, 2.8]].forEach(([px, pz]) => {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 4.4, 6), palmTrunkMat);
          post.position.set(px, 2.2, pz);
          hut.add(post);
        });
        const roof = new THREE.Mesh(new THREE.ConeGeometry(5.8, 3.6, 6), thatchMat);
        roof.position.y = 5.8;
        hut.add(roof);
        hut.scale.setScalar(scale);
        return hut;
      };
      addProp(buildTikiCabana(1.0), outerWestX - 13, outerNorthZ - 12, -1.45);
      addProp(buildTikiCabana(0.95), outerEastX + 13, outerSouthZ + 12, -1.45);
    } else if (biome === 'night_stealth') {
      // --- NIGHT STEALTH PERIMETER: Moonlit Pines, Rotating Radar Domes & Guard Beacons ---
      const pineTrunkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
      const pineLeafMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.65, flatShading: true });
      const radarBaseMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.35 });
      const radarDishMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.45, metalness: 0.5, roughness: 0.25 });

      perimeterRing.forEach((p, idx) => {
        if (idx % 3 === 0) {
          const radar = new THREE.Group();
          const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.9, 3.6, 8), radarBaseMat);
          ped.position.y = 1.8;
          radar.add(ped);
          const dish = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.3, 10, 1, true), radarDishMat);
          dish.position.y = 4.4;
          dish.rotation.x = Math.PI / 3;
          radar.add(dish);
          this.envRotators.push({ mesh: dish, axis: 'y', speed: 1.5 });
          radar.scale.setScalar(p.s);
          addProp(radar, p.x, p.z, -1.45);
        } else {
          const pine = new THREE.Group();
          const t = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.55, 2.2, 6), pineTrunkMat);
          t.position.y = 1.1;
          pine.add(t);
          const c1 = new THREE.Mesh(new THREE.ConeGeometry(2.6, 4.2, 6), pineLeafMat);
          c1.position.y = 3.4;
          pine.add(c1);
          const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.9, 3.4, 6), pineLeafMat);
          c2.position.y = 5.6;
          pine.add(c2);
          pine.scale.setScalar(p.s);
          addProp(pine, p.x, p.z, -1.45);
        }
      });
    }
  }

  updateFish(dt, time) {
    if (!this.fishList || this.fishList.length === 0) return;

    const moatW = 16;
    const halfW = (this.currentMapWidth || 80) / 2;
    const halfH = (this.currentMapHeight || 80) / 2;

    const L_horiz = (halfW * 2) + 2 + moatW;
    const L_vert = (halfH * 2) + 2 + moatW;
    const P = 2 * (L_horiz + L_vert);

    this.fishList.forEach((fish) => {
      fish.dist = (fish.dist + fish.speed * dt) % P;
      const t = fish.dist;
      let x = 0, z = 0, targetAngle = 0;

      const lane = fish.laneOffset;

      if (t < L_horiz) {
        // North canal: moving East (+X)
        const ratio = t / L_horiz;
        x = -L_horiz / 2 + ratio * L_horiz;
        z = -halfH - 1 - moatW / 2 + lane;
        targetAngle = Math.PI / 2;
      } else if (t < L_horiz + L_vert) {
        // East canal: moving South (+Z)
        const ratio = (t - L_horiz) / L_vert;
        x = halfW + 1 + moatW / 2 + lane;
        z = -halfH - 1 - moatW / 2 + ratio * L_vert;
        targetAngle = Math.PI;
      } else if (t < 2 * L_horiz + L_vert) {
        // South canal: moving West (-X)
        const ratio = (t - (L_horiz + L_vert)) / L_horiz;
        x = halfW + 1 + moatW / 2 - ratio * L_horiz;
        z = halfH + 1 + moatW / 2 + lane;
        targetAngle = -Math.PI / 2;
      } else {
        // West canal: moving North (-Z)
        const ratio = (t - (2 * L_horiz + L_vert)) / L_vert;
        x = -halfW - 1 - moatW / 2 + lane;
        z = halfH + 1 + moatW / 2 - ratio * L_vert;
        targetAngle = 0;
      }

      fish.mesh.position.x = x;
      fish.mesh.position.z = z;
      fish.mesh.position.y = -1.28 + Math.sin(time * 3.5 + fish.seed) * 0.035;
      fish.mesh.rotation.y = targetAngle;

      // Wag tail fin
      if (fish.tailPivot) {
        fish.tailPivot.rotation.y = Math.sin(time * 9.0 + fish.seed) * 0.45;
      }
    });
  }

  createBiomeFloorTexture(biome) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');

    if (biome === 'workshop') {
      // Vivid warm golden-honey parquet tiles with crisp bevel borders
      ctx.fillStyle = '#f5c77e'; ctx.fillRect(0,0,256,256);
      ctx.fillStyle = '#e5b162';
      for(let i=0; i<480; i++) ctx.fillRect(Math.random()*256, Math.random()*256, 5, 2);
      ctx.strokeStyle = '#c48636'; ctx.lineWidth = 5;
      ctx.strokeRect(2,2,252,252);
      ctx.strokeStyle = 'rgba(255,248,225,0.55)'; ctx.lineWidth = 2;
      ctx.strokeRect(6,6,244,244);
    } else if (biome === 'desert') {
      // Vivid sun-drenched golden-amber sandstone tiles
      ctx.fillStyle = '#f7be6d'; ctx.fillRect(0,0,256,256);
      ctx.fillStyle = '#e8a248';
      for(let i=0; i<550; i++) ctx.fillRect(Math.random()*256, Math.random()*256, 3, 2);
      ctx.strokeStyle = '#c27125'; ctx.lineWidth = 5;
      ctx.strokeRect(2,2,252,252);
      ctx.strokeStyle = 'rgba(165, 82, 20, 0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 128); ctx.lineTo(256, 128); ctx.stroke();
    } else if (biome === 'cyber') {
      // Deep electric indigo-obsidian with vivid cyan & neon magenta grid
      ctx.fillStyle = '#070b18'; ctx.fillRect(0,0,256,256);
      ctx.fillStyle = '#0f1b38';
      ctx.fillRect(8, 8, 240, 240);
      ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, 248, 248);
      ctx.fillStyle = '#ff00e5';
      ctx.fillRect(16, 16, 8, 8);
      ctx.fillRect(232, 16, 8, 8);
      ctx.fillRect(16, 232, 8, 8);
      ctx.fillRect(232, 232, 8, 8);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.36)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(128, 0); ctx.lineTo(128, 256);
      ctx.moveTo(0, 128); ctx.lineTo(256, 128);
      ctx.stroke();
    } else if (biome === 'arctic') {
      // Vivid crystal sky-blue glacial tiles with bright azure joints
      ctx.fillStyle = '#b3ecff'; ctx.fillRect(0,0,256,256);
      ctx.fillStyle = '#80dfff';
      for(let i=0; i<420; i++) ctx.fillRect(Math.random()*256, Math.random()*256, 4, 2);
      ctx.strokeStyle = '#00b0ff'; ctx.lineWidth = 5;
      ctx.strokeRect(2,2,252,252);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(36, 36); ctx.lineTo(105, 120); ctx.lineTo(165, 88); ctx.lineTo(215, 215);
      ctx.stroke();
    } else if (biome === 'volcano') {
      // Rich volcanic obsidian with vibrant glowing lava seams
      ctx.fillStyle = '#1f100c'; ctx.fillRect(0,0,256,256);
      ctx.fillStyle = '#321912';
      for(let i=0; i<400; i++) ctx.fillRect(Math.random()*256, Math.random()*256, 4, 3);
      ctx.strokeStyle = '#ff3d00'; ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, 252, 252);
      ctx.strokeStyle = '#ffab00'; ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(0, 60); ctx.lineTo(80, 120); ctx.lineTo(180, 110); ctx.lineTo(256, 200);
      ctx.stroke();
      ctx.strokeStyle = '#ffff00'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, 60); ctx.lineTo(80, 120); ctx.lineTo(180, 110); ctx.lineTo(256, 200);
      ctx.stroke();
    } else if (biome === 'sunset_city') {
      // Twilight Sunset Metropolis Asphalt Tiles with warm golden-amber avenue lane lines & high contrast for tank tracks
      ctx.fillStyle = '#3b4254'; ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#434c61';
      ctx.fillRect(10, 10, 236, 236);
      for (let i = 0; i < 320; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 171, 64, 0.14)' : 'rgba(30, 41, 59, 0.35)';
        ctx.fillRect(Math.random() * 256, Math.random() * 256, 4, 3);
      }
      // Crisp sunset-amber & neon magenta avenue tile borders
      ctx.strokeStyle = '#ff9100'; ctx.lineWidth = 4.5;
      ctx.strokeRect(3, 3, 250, 250);
      ctx.strokeStyle = 'rgba(255, 64, 129, 0.35)'; ctx.lineWidth = 2;
      ctx.strokeRect(14, 14, 228, 228);
      // Dashed golden road marking
      ctx.fillStyle = '#ffd54f';
      ctx.fillRect(122, 24, 12, 36);
      ctx.fillRect(122, 196, 12, 36);
    } else if (biome === 'matsuri') {
      // Warm Lantern-Lit Japanese Festival Flagstones with vermilion lacquer borders & scattered pink sakura petals
      ctx.fillStyle = '#f2cfa0'; ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#e5be8a';
      for (let i = 0; i < 360; i++) ctx.fillRect(Math.random() * 256, Math.random() * 256, 4, 3);
      // Vermilion festival lacquer frame
      ctx.strokeStyle = '#d32f2f'; ctx.lineWidth = 5;
      ctx.strokeRect(3, 3, 250, 250);
      // Imperial gold inner trim
      ctx.strokeStyle = '#ffb300'; ctx.lineWidth = 2;
      ctx.strokeRect(12, 12, 232, 232);
      // Fallen pink sakura blossom petals on the stone
      ctx.fillStyle = '#ff4081';
      for (let p = 0; p < 7; p++) {
        const px = 28 + ((p * 57) % 200);
        const py = 32 + ((p * 83) % 190);
        ctx.beginPath();
        ctx.arc(px, py, 3.8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (biome === 'tropical_island') {
      // Rich Toasted Golden-Orange Beach Sand Tiles ("tono arena, naranjita, no tan iluminado de blanco")
      ctx.fillStyle = '#e59849'; ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#db8a37';
      ctx.fillRect(10, 10, 236, 236);
      for (let i = 0; i < 420; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(181, 95, 22, 0.35)' : 'rgba(242, 168, 82, 0.35)';
        ctx.fillRect(Math.random() * 256, Math.random() * 256, 4, 2);
      }
      // Warm wind-swept orange-amber sand ripple curves
      ctx.strokeStyle = 'rgba(163, 82, 18, 0.45)'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 85); ctx.bezierCurveTo(80, 75, 175, 95, 256, 85);
      ctx.moveTo(0, 175); ctx.bezierCurveTo(80, 165, 175, 185, 256, 175);
      ctx.stroke();
      // Rich toasted bamboo border
      ctx.strokeStyle = '#9c4d14'; ctx.lineWidth = 5;
      ctx.strokeRect(3, 3, 250, 250);
      // Warm coral-orange shell corner accents
      ctx.fillStyle = '#ff6d00';
      ctx.fillRect(14, 14, 8, 8);
      ctx.fillRect(234, 14, 8, 8);
      ctx.fillRect(14, 234, 8, 8);
      ctx.fillRect(234, 234, 8, 8);
    } else if (biome === 'night_stealth') {
      // Deep Nocturnal Stealth Base Slate-Blue Floor Tiles: Genuinely dark night floor where golden searchlights pop while silver-cyan grid lines keep every cell readable!
      ctx.fillStyle = '#152033'; ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#1b2942';
      ctx.fillRect(10, 10, 236, 236);
      for (let i = 0; i < 300; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(56, 189, 248, 0.08)' : 'rgba(9, 14, 26, 0.42)';
        ctx.fillRect(Math.random() * 256, Math.random() * 256, 4, 3);
      }
      // Subtle moonlit steel-cyan tile border so every cell shape is clearly visible at night without over-brightening
      ctx.strokeStyle = '#0284c7'; ctx.lineWidth = 4;
      ctx.strokeRect(3, 3, 250, 250);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(16, 16, 224, 224);
      // Subtle tactical corner markers
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(12, 12, 7, 7);
      ctx.fillRect(237, 12, 7, 7);
      ctx.fillRect(12, 237, 7, 7);
      ctx.fillRect(237, 237, 7, 7);
    } else { // jungle
      // Vivid tropical lime-emerald turf tiles so dark tank tread marks pop with maximum contrast!
      ctx.fillStyle = '#9be548'; ctx.fillRect(0,0,256,256);
      ctx.fillStyle = '#86d136';
      for(let i=0; i<380; i++) ctx.fillRect(Math.random()*256, Math.random()*256, 4, 3);
      // Lush emerald border joints
      ctx.strokeStyle = '#4d9e1a'; ctx.lineWidth = 5;
      ctx.strokeRect(3, 3, 250, 250);
      // Subtle inner relief frame
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)'; ctx.lineWidth = 2;
      ctx.strokeRect(18, 18, 220, 220);
      // Golden El Dorado corner glyphs
      ctx.fillStyle = '#ffd600';
      ctx.fillRect(14, 14, 9, 9);
      ctx.fillRect(233, 14, 9, 9);
      ctx.fillRect(14, 233, 9, 9);
      ctx.fillRect(233, 233, 9, 9);
    }

    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  createCorkTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 128; canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#cba374'; ctx.fillRect(0,0,128,128);
      ctx.fillStyle = '#8f6b4e';
      for(let i=0; i<400; i++) {
          const s = Math.random()*3;
          ctx.fillRect(Math.random()*128, Math.random()*128, s, s);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
  }

  createBrickTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 256;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#777'; ctx.fillRect(0,0,256,256);
      
      ctx.fillStyle = '#888'; // Lighter bricks
      ctx.strokeStyle = '#444'; // Dark mortar
      ctx.lineWidth = 4;

      const brickH = 64;
      const brickW = 128;
      
      for(let y=0; y<256; y+=brickH) {
          const offset = (y/brickH)%2 === 0 ? 0 : -brickW/2;
          for(let x=offset; x<256; x+=brickW) {
              ctx.fillRect(x, y, brickW, brickH);
              ctx.strokeRect(x, y, brickW, brickH);
              
              // Add noise
              ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
              ctx.fillRect(x+10, y+10, brickW-20, brickH-20);
              ctx.fillStyle = '#888'; // Reset
          }
      }
      
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
  }

  // --- Interactive Object Factory Methods ---
  createBarrelMesh(x, z) {
      const group = new THREE.Group();
      group.position.set(x, 0, z);

      // Main red barrel cylinder
      const barrelGeo = new THREE.CylinderGeometry(1.6, 1.6, 3.8, 16);
      const barrelMat = new THREE.MeshStandardMaterial({ 
          color: 0xD32F2F, 
          roughness: 0.35, 
          metalness: 0.3 
      });
      const drum = new THREE.Mesh(barrelGeo, barrelMat);
      drum.position.y = 1.9;
      drum.castShadow = true;
      drum.receiveShadow = true;
      group.add(drum);

      // Dark steel reinforcement rings (top and bottom)
      const ringGeo = new THREE.TorusGeometry(1.63, 0.12, 8, 16);
      ringGeo.rotateX(Math.PI / 2);
      const ringMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 });
      
      const ringTop = new THREE.Mesh(ringGeo, ringMat);
      ringTop.position.y = 2.8;
      group.add(ringTop);

      const ringBottom = new THREE.Mesh(ringGeo, ringMat);
      ringBottom.position.y = 1.0;
      group.add(ringBottom);

      // Yellow Warning / Hazard band in center
      const bandGeo = new THREE.CylinderGeometry(1.62, 1.62, 0.9, 16);
      const bandMat = new THREE.MeshBasicMaterial({ color: 0xFFD600 });
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.y = 1.9;
      group.add(band);

      // Top cap bung
      const bungGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8);
      const bung = new THREE.Mesh(bungGeo, ringMat);
      bung.position.set(0.6, 3.8, 0);
      group.add(bung);

      group.userData = { 
          bounds: new THREE.Box3().setFromObject(group), 
          collisionRadius: 1.65,
          type: 'barrel', 
          exploded: false 
      };
      return group;
  }

  createPowerUpCrateMesh(x, z) {
      const group = new THREE.Group();
      group.position.set(x, 0, z);

      // Golden wood box with brass borders
      const boxGeo = new THREE.BoxGeometry(3.0, 3.0, 3.0);
      const boxMat = new THREE.MeshStandardMaterial({ 
          color: 0xF57F17, 
          roughness: 0.35, 
          metalness: 0.15 
      });
      const box = new THREE.Mesh(boxGeo, boxMat);
      box.position.y = 1.6;
      box.castShadow = true;
      box.receiveShadow = true;
      group.add(box);

      // Brass corner banding
      const bandMat = new THREE.MeshStandardMaterial({ color: 0xFFD54F, metalness: 0.8, roughness: 0.2 });
      const bandH = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.5, 3.1), bandMat);
      bandH.position.y = 1.6;
      group.add(bandH);

      // Glowing emblem glyph hovering above
      const glyphGeo = new THREE.OctahedronGeometry(0.8);
      const glyphMat = new THREE.MeshBasicMaterial({ color: 0x00E5FF, wireframe: true });
      const glyph = new THREE.Mesh(glyphGeo, glyphMat);
      glyph.position.y = 3.6;
      group.add(glyph);

      group.userData = { 
          bounds: new THREE.Box3().setFromObject(group), 
          type: 'powerup', 
          collected: false,
          seed: Math.random() * 10
      };
      return group;
  }

  createSpeedPadMesh(x, z) {
      const group = new THREE.Group();
      group.position.set(x, 0.05, z);

      // Flat floor plate
      const padGeo = new THREE.BoxGeometry(6.5, 0.1, 6.5);
      const padMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.receiveShadow = true;
      group.add(pad);

      // Glowing Chevron Arrows (pointing North / forward)
      const arrowShape = new THREE.Shape();
      arrowShape.moveTo(0, 2.2);
      arrowShape.lineTo(1.8, 0);
      arrowShape.lineTo(0.9, 0);
      arrowShape.lineTo(0, 1.2);
      arrowShape.lineTo(-0.9, 0);
      arrowShape.lineTo(-1.8, 0);
      arrowShape.closePath();

      const arrowGeo = new THREE.ShapeGeometry(arrowShape);
      arrowGeo.rotateX(-Math.PI / 2);
      const arrowMat = new THREE.MeshBasicMaterial({ color: 0x00FF88 });
      const arrow1 = new THREE.Mesh(arrowGeo, arrowMat);
      arrow1.position.set(0, 0.08, 0.5);
      group.add(arrow1);

      const arrow2 = new THREE.Mesh(arrowGeo, arrowMat);
      arrow2.position.set(0, 0.08, -1.2);
      group.add(arrow2);

      group.userData = { 
          bounds: new THREE.Box3().setFromObject(group), 
          type: 'boost' 
      };
      return group;
  }

  createCryoBarrelMesh(x, z) {
      const group = new THREE.Group();
      group.position.set(x, 0, z);

      // Cyan / Liquid Nitrogen Cryogenic Drum
      const barrelGeo = new THREE.CylinderGeometry(1.6, 1.6, 3.8, 16);
      const barrelMat = new THREE.MeshStandardMaterial({
          color: 0x0288D1,
          emissive: 0x00B0FF,
          emissiveIntensity: 0.35,
          roughness: 0.2,
          metalness: 0.45
      });
      const drum = new THREE.Mesh(barrelGeo, barrelMat);
      drum.position.y = 1.9;
      drum.castShadow = true;
      drum.receiveShadow = true;
      group.add(drum);

      // Frosted chrome rings
      const ringGeo = new THREE.TorusGeometry(1.64, 0.12, 8, 16);
      ringGeo.rotateX(Math.PI / 2);
      const ringMat = new THREE.MeshStandardMaterial({ color: 0xE1F5FE, metalness: 0.85, roughness: 0.15 });
      const ringTop = new THREE.Mesh(ringGeo, ringMat);
      ringTop.position.y = 2.85;
      group.add(ringTop);
      const ringBottom = new THREE.Mesh(ringGeo, ringMat);
      ringBottom.position.y = 0.95;
      group.add(ringBottom);

      // Glowing Ice Cyan Center Band
      const bandGeo = new THREE.CylinderGeometry(1.63, 1.63, 0.85, 16);
      const bandMat = new THREE.MeshBasicMaterial({ color: 0x80D8FF });
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.y = 1.9;
      group.add(band);

      // Floating Ice Crystal Core on top
      const crysGeo = new THREE.OctahedronGeometry(0.75, 0);
      const crysMat = new THREE.MeshBasicMaterial({ color: 0x00E5FF, wireframe: false });
      const crystal = new THREE.Mesh(crysGeo, crysMat);
      crystal.position.y = 4.35;
      group.add(crystal);

      group.userData = {
          bounds: new THREE.Box3().setFromObject(group),
          collisionRadius: 1.65,
          type: 'cryo_barrel',
          exploded: false,
          crystal
      };
      return group;
  }

  createRepairPadMesh(x, z) {
      const group = new THREE.Group();
      group.position.set(x, 0.05, z);

      // Armored Medical Platform Base
      const padGeo = new THREE.CylinderGeometry(3.2, 3.5, 0.22, 24);
      const padMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.5 });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.receiveShadow = true;
      group.add(pad);

      // Glowing Emerald Ring
      const ringGeo = new THREE.RingGeometry(2.45, 2.95, 28);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x00E676, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.14;
      group.add(ring);

      // Rotating 3D Medical Cross Hologram
      const crossGroup = new THREE.Group();
      crossGroup.position.y = 1.65;
      const crossMat = new THREE.MeshBasicMaterial({ color: 0x69F0AE });
      const barH = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.48, 0.48), crossMat);
      const barV = new THREE.Mesh(new THREE.BoxGeometry(0.48, 1.7, 0.48), crossMat);
      crossGroup.add(barH, barV);
      group.add(crossGroup);

      group.userData = {
          bounds: new THREE.Box3().setFromObject(group),
          type: 'repair_pad'
      };
      return {
          mesh: group,
          crossGroup,
          ringMat,
          position: new THREE.Vector3(x, 0, z),
          cooldown: 0
      };
  }

  createPrismCrystalMesh(x, z) {
      const group = new THREE.Group();
      group.position.set(x, 0, z);

      // Dark stone base
      const baseGeo = new THREE.CylinderGeometry(2.0, 2.4, 1.2, 6);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x37474F, roughness: 0.9 });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = 0.6;
      base.castShadow = true;
      base.receiveShadow = true;
      group.add(base);

      // Faceted refractive crystal (Rotating Blue Pillar)
      const crystalGeo = new THREE.CylinderGeometry(0.2, 1.6, 5.0, 6);
      const crystalMat = new THREE.MeshPhysicalMaterial({ 
          color: 0x00E5FF, 
          emissive: 0x00B0FF, 
          emissiveIntensity: 0.8,
          roughness: 0.1, 
          metalness: 0.1, 
          transparent: true, 
          opacity: 0.88 
      });
      const crystal = new THREE.Mesh(crystalGeo, crystalMat);
      crystal.position.y = 3.6;
      crystal.castShadow = true;
      group.add(crystal);

      // Dedicated PointLight attached to the pillar for illumination
      const beaconLight = new THREE.PointLight(0x00E5FF, 0.8, 35, 1.2);
      beaconLight.position.set(0, 4.5, 0);
      group.add(beaconLight);

      // Glowing aura ring around the pillar
      const haloGeo = new THREE.RingGeometry(1.6, 2.6, 24);
      haloGeo.rotateX(-Math.PI / 2);
      const haloMat = new THREE.MeshBasicMaterial({
          color: 0x00E5FF,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.y = 1.25;
      group.add(halo);

      group.userData = { 
          bounds: new THREE.Box3().setFromObject(group), 
          collisionRadius: 2.05,
          type: 'prism',
          crystal: crystal,
          light: beaconLight,
          halo: halo,
          pulseTimer: 0
      };
      return group;
  }

  activatePrismLight(prism, source = 'hit') {
      if (!prism || !prism.userData) return;
      prism.userData.pulseTimer = 5.0; // Stays illuminated for 5 full seconds
      this.stageLightBoost = 5.0;      // Illuminates whole stage

      // Pillar's beacon point light surges to illuminate the battlefield
      if (prism.userData.light) {
          prism.userData.light.intensity = 8.5;
          prism.userData.light.distance = 160;
          prism.userData.light.color.setHex(0x80ffff);
      }

      // Crystal material pulses with neon incandescence
      if (prism.userData.crystal && prism.userData.crystal.material) {
          prism.userData.crystal.material.emissiveIntensity = 3.5;
      }
      if (prism.userData.halo && prism.userData.halo.material) {
          prism.userData.halo.material.opacity = 0.9;
      }

      // VFX: Crystalline burst, shockwave, and flash of illumination
      const pos = prism.position.clone();
      pos.y = 3.5;
      this.vfx.spawnShockwave(pos, 0x00E5FF, 32);
      this.vfx.spawnPowerUpBurst(pos, 0x80FFFF);
      this.audio.play('powerup');

      this.onEvent({
          type: 'LIGHT_PULSE',
          data: { text: '💡 ¡PILAR LUMINOSO ACTIVADO! ESCENARIO ILUMINADO' }
      });
  }

  checkPrismHit(hitObj, hitPoint) {
      if (!hitObj) return;
      const hitPrism = this.prisms.find(p => p === hitObj || p === hitObj.parent || (p.children && p.children.includes(hitObj)));
      if (hitPrism) {
          this.activatePrismLight(hitPrism, 'projectile');
          return;
      }
      const hitLh = this.walls.find(w => w.userData && w.userData.type === 'lighthouse' && (w === hitObj || w === hitObj.parent || (w.children && w.children.includes(hitObj))));
      if (hitLh) {
          this.stageLightBoost = 5.0;
          this.vfx.spawnShockwave(hitLh.position, 0xFFEE55, 30);
          this.audio.play('powerup');
          this.onEvent({
              type: 'LIGHT_PULSE',
              data: { text: '💡 ¡FARO ACTIVADO! ESCENARIO ILUMINADO' }
          });
      }
      // Check if projectile hit a Laser Gate Switch Pylon
      const hitSw = this.laserSwitches.find(sw => sw.mesh === hitObj || sw.mesh === hitObj.parent || (sw.mesh.children && sw.mesh.children.includes(hitObj)));
      if (hitSw) {
          this.toggleLaserGates(hitSw);
      }
  }

  createWaterShaderMaterial(biome, halfW, halfH, moatWidth) {
      let deepColor = new THREE.Color(0x01579b);
      let shallowColor = new THREE.Color(0x00b0ff);
      let causticColor = new THREE.Color(0xb3e5fc);
      let foamColor = new THREE.Color(0xffffff);
      let opacity = 0.88;

      if (biome === 'desert') {
          deepColor.setHex(0x00695c);
          shallowColor.setHex(0x26c6da);
          causticColor.setHex(0xb2ebf2);
      } else if (biome === 'cyber') {
          deepColor.setHex(0x051b2c);
          shallowColor.setHex(0x00b8d4);
          causticColor.setHex(0x18ffff);
          foamColor.setHex(0x00e5ff);
          opacity = 0.92;
      } else if (biome === 'arctic') {
          deepColor.setHex(0x01579b);
          shallowColor.setHex(0x29b6f6);
          causticColor.setHex(0xe1f5fe);
          opacity = 0.9;
      } else if (biome === 'volcano') {
          deepColor.setHex(0x8c1d04);
          shallowColor.setHex(0xff3d00);
          causticColor.setHex(0xffea00);
          foamColor.setHex(0xff9100);
          opacity = 0.95;
      } else if (biome === 'jungle') {
          deepColor.setHex(0x004d40);
          shallowColor.setHex(0x00bfa5);
          causticColor.setHex(0xa7ffeb);
      } else if (biome === 'sunset_city') {
          // Twilight bay reflecting warm golden-coral sunset & neon violet
          deepColor.setHex(0x1a103c);
          shallowColor.setHex(0x5e35b1);
          causticColor.setHex(0xff8a65);
          foamColor.setHex(0xffcc80);
          opacity = 0.91;
      } else if (biome === 'matsuri') {
          // Night festival mirror pond reflecting warm golden-crimson paper lanterns
          deepColor.setHex(0x121830);
          shallowColor.setHex(0x283593);
          causticColor.setHex(0xffb74d);
          foamColor.setHex(0xff80ab);
          opacity = 0.9;
      } else if (biome === 'tropical_island') {
          // Crystal-clear Caribbean turquoise-aqua coral lagoon
          deepColor.setHex(0x00838f);
          shallowColor.setHex(0x00e5ff);
          causticColor.setHex(0xe0f7fa);
          foamColor.setHex(0xffffff);
          opacity = 0.86;
      } else if (biome === 'night_stealth') {
          // Moonlit midnight stealth harbor water with silver-cyan reflections
          deepColor.setHex(0x091930);
          shallowColor.setHex(0x1e40af);
          causticColor.setHex(0x7dd3fc);
          foamColor.setHex(0xbae6fd);
          opacity = 0.91;
      }

      return new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          uniforms: {
              uTime: { value: 0 },
              uDeepColor: { value: deepColor },
              uShallowColor: { value: shallowColor },
              uCausticColor: { value: causticColor },
              uFoamColor: { value: foamColor },
              uOpacity: { value: opacity },
              uInnerHalf: { value: new THREE.Vector2(halfW + 1.0, halfH + 1.0) },
              uOuterHalf: { value: new THREE.Vector2(halfW + 1.0 + moatWidth, halfH + 1.0 + moatWidth) }
          },
          vertexShader: `
              varying vec3 vWorldPos;

              void main() {
                  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                  vWorldPos = worldPosition.xyz;
                  gl_Position = projectionMatrix * viewMatrix * worldPosition;
              }
          `,
          fragmentShader: `
              uniform float uTime;
              uniform vec3 uDeepColor;
              uniform vec3 uShallowColor;
              uniform vec3 uCausticColor;
              uniform vec3 uFoamColor;
              uniform float uOpacity;
              uniform vec2 uInnerHalf;
              uniform vec2 uOuterHalf;
              varying vec3 vWorldPos;

              // Fast 2D hash & Voronoi cellular distance for realistic water caustics
              vec2 hash2(vec2 p) {
                  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
              }

              float voronoiCaustic(vec2 p, float t) {
                  vec2 n = floor(p);
                  vec2 f = fract(p);
                  float md = 8.0;
                  for (int j = -1; j <= 1; j++) {
                      for (int i = -1; i <= 1; i++) {
                          vec2 g = vec2(float(i), float(j));
                          vec2 o = hash2(n + g);
                          o = 0.5 + 0.42 * sin(t + 6.2831 * o);
                          vec2 r = g + o - f;
                          float d = dot(r, r);
                          md = min(md, d);
                      }
                  }
                  return pow(clamp(1.0 - sqrt(md), 0.0, 1.0), 2.6);
              }

              void main() {
                  vec2 wp = vWorldPos.xz;

                  // Distance from inner arena wall and outer stone quay embankment
                  vec2 dInnerVec = abs(wp) - uInnerHalf;
                  float dInner = max(dInnerVec.x, dInnerVec.y);
                  vec2 dOuterVec = uOuterHalf - abs(wp);
                  float dOuter = min(dOuterVec.x, dOuterVec.y);
                  float shoreDist = min(max(dInner, 0.0), max(dOuter, 0.0));

                  // Also detect proximity to the 4 stone bridges (centered on X=0 or Z=0)
                  float bridgeDist = min(abs(wp.x), abs(wp.y));
                  float nearBridge = smoothstep(5.4, 3.8, bridgeDist);

                  // Shallow-to-deep color gradient across canal
                  float depthFactor = smoothstep(0.0, 5.5, shoreDist);
                  vec3 baseWater = mix(uShallowColor, uDeepColor, depthFactor * 0.78);

                  // Smooth liquid wave distortion in UV space (zero polygon warping!)
                  vec2 flowDistort = vec2(
                      sin(wp.y * 0.35 + uTime * 1.6) * 0.12,
                      cos(wp.x * 0.35 + uTime * 1.4) * 0.12
                  );

                  // Dual-layer counter-drifting world-space Voronoi caustics (no seams!)
                  vec2 uv1 = (wp + flowDistort) * 0.20 + vec2(uTime * 0.14, -uTime * 0.11);
                  vec2 uv2 = (wp - flowDistort) * 0.26 + vec2(-uTime * 0.12, uTime * 0.16);
                  float c1 = voronoiCaustic(uv1, uTime * 1.1);
                  float c2 = voronoiCaustic(uv2, uTime * 0.95);
                  float caustics = clamp((c1 + c2) * 0.62, 0.0, 1.0);

                  // Subtle surface shimmer
                  float shimmer = (sin(wp.x * 0.45 + wp.y * 0.35 + uTime * 2.1) * 0.5 + 0.5) * 0.12;

                  // Animated shoreline & bridge pier foam
                  float waveRipple = sin(shoreDist * 4.2 - uTime * 3.2 + sin(wp.x * 0.4 + wp.y * 0.4)) * 0.5 + 0.5;
                  float shoreFoam = smoothstep(1.35, 0.0, shoreDist) * (0.4 + 0.6 * waveRipple);
                  float L_foam = smoothstep(0.38, 0.0, shoreDist);
                  float bridgeFoam = nearBridge * 0.42 * (0.5 + 0.5 * sin(bridgeDist * 4.5 - uTime * 2.6));
                  float totalFoam = clamp(L_foam + shoreFoam * 0.6 + bridgeFoam, 0.0, 1.0);

                  vec3 col = baseWater + uCausticColor * (caustics * 0.40 + shimmer);
                  col = mix(col, uFoamColor, totalFoam);

                  gl_FragColor = vec4(col, uOpacity);
              }
          `
      });
  }

  createWeatherSystem(biome, mapW, mapH) {
      const count = 75;
      const positions = new Float32Array(count * 3);
      const phases = new Float32Array(count);
      const areaW = mapW + 40;
      const areaH = mapH + 40;

      for (let i = 0; i < count; i++) {
          positions[i * 3] = (Math.random() - 0.5) * areaW;
          positions[i * 3 + 1] = 1.0 + Math.random() * 22.0;
          positions[i * 3 + 2] = (Math.random() - 0.5) * areaH;
          phases[i] = Math.random() * Math.PI * 2;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const canvas = document.createElement('canvas');
      canvas.width = 32; canvas.height = 32;
      const ctx = canvas.getContext('2d');
      const grad = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.6)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, 32);
      const tex = new THREE.CanvasTexture(canvas);

      let color = 0xfff8e1;
      let size = 1.1;
      let vy = -1.2;
      let vx = 0.8;

      if (biome === 'arctic') {
          color = 0xffffff;
          size = 1.45;
          vy = -5.5;
          vx = 2.0;
      } else if (biome === 'volcano') {
          color = 0xff6d00;
          size = 1.35;
          vy = 5.2;
          vx = 1.5;
      } else if (biome === 'cyber') {
          color = 0x00e5ff;
          size = 1.2;
          vy = 4.2;
          vx = 0.3;
      } else if (biome === 'jungle') {
          color = 0xc6ff00;
          size = 1.3;
          vy = 0.6;
          vx = 0.5;
      } else if (biome === 'desert') {
          color = 0xffe082;
          size = 1.05;
          vy = -0.8;
          vx = 6.5;
      } else if (biome === 'sunset_city') {
          // Glowing golden-coral twilight embers & city dusk motes
          color = 0xff9e80;
          size = 1.25;
          vy = 1.4;
          vx = 1.2;
      } else if (biome === 'matsuri') {
          // Floating sakura cherry blossom petals & warm festival lantern sparks
          color = 0xff80ab;
          size = 1.45;
          vy = -1.8;
          vx = 2.2;
      } else if (biome === 'tropical_island') {
          // Warm golden tropical sun-sparkles & sea breeze mist
          color = 0xfff59d;
          size = 1.2;
          vy = -0.6;
          vx = 2.4;
      } else if (biome === 'night_stealth') {
          // Soft moonlit fireflies & nocturnal mist motes
          color = 0x7dd3fc;
          size = 1.25;
          vy = 0.7;
          vx = 0.9;
      }

      const mat = new THREE.PointsMaterial({
          color,
          size,
          map: tex,
          transparent: true,
          opacity: 0.78,
          depthWrite: false,
          blending: THREE.AdditiveBlending
      });

      const points = new THREE.Points(geo, mat);
      points.userData = { isEnvironment: true };
      this.scene.add(points);
      this.tableProps.push(points);
      this.weatherSystem = { points, geo, phases, count, areaW, areaH, vx, vy, biome };
  }

  updateWeather(dt, time) {
      if (!this.weatherSystem || !this.weatherSystem.geo) return;
      const { geo, phases, count, areaW, areaH, vx, vy } = this.weatherSystem;
      const posAttr = geo.attributes.position;
      const arr = posAttr.array;
      const halfW = areaW / 2;
      const halfH = areaH / 2;

      for (let i = 0; i < count; i++) {
          const idx = i * 3;
          arr[idx] += (vx + Math.sin(time * 1.5 + phases[i]) * 1.2) * dt;
          arr[idx + 1] += (vy + Math.cos(time * 2.0 + phases[i]) * 0.6) * dt;
          arr[idx + 2] += Math.cos(time * 1.2 + phases[i]) * 0.9 * dt;

          if (arr[idx] > halfW) arr[idx] = -halfW;
          if (arr[idx] < -halfW) arr[idx] = halfW;
          if (arr[idx + 1] > 23.0) arr[idx + 1] = 1.0;
          if (arr[idx + 1] < 0.8) arr[idx + 1] = 22.5;
          if (arr[idx + 2] > halfH) arr[idx + 2] = -halfH;
          if (arr[idx + 2] < -halfH) arr[idx + 2] = halfH;
      }
      posAttr.needsUpdate = true;
  }

  createTeleporterMesh(x, z, index = 0) {
      const group = new THREE.Group();
      group.position.set(x, 0.06, z);

      const portalColor = index % 2 === 0 ? 0x00e5ff : 0xd500f9;
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.25 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 0.22, 20), baseMat);
      group.add(base);

      const ringOuterMat = new THREE.MeshBasicMaterial({ color: portalColor });
      const ringOuter = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.16, 8, 24), ringOuterMat);
      ringOuter.rotation.x = Math.PI / 2;
      ringOuter.position.y = 0.16;
      group.add(ringOuter);

      const ringInnerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const ringInner = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.12, 8, 20), ringInnerMat);
      ringInner.rotation.x = Math.PI / 2;
      ringInner.position.y = 0.22;
      group.add(ringInner);

      const coreMat = new THREE.MeshBasicMaterial({
          color: portalColor,
          transparent: true,
          opacity: 0.38,
          side: THREE.DoubleSide
      });
      const coreDisc = new THREE.Mesh(new THREE.CircleGeometry(2.0, 20), coreMat);
      coreDisc.rotation.x = -Math.PI / 2;
      coreDisc.position.y = 0.14;
      group.add(coreDisc);

      return { mesh: group, ringOuter, ringInner, position: new THREE.Vector3(x, 0, z), color: portalColor };
  }

  createLaserGateMesh(x, z) {
      const group = new THREE.Group();
      group.position.set(x, 0, z);

      const postMat = new THREE.MeshStandardMaterial({ color: 0x263238, metalness: 0.8, roughness: 0.25 });
      const postGeo = new THREE.CylinderGeometry(0.45, 0.55, 3.8, 12);
      const postL = new THREE.Mesh(postGeo, postMat);
      postL.position.set(-3.4, 1.9, 0);
      postL.castShadow = true;
      group.add(postL);

      const postR = new THREE.Mesh(postGeo, postMat);
      postR.position.set(3.4, 1.9, 0);
      postR.castShadow = true;
      group.add(postR);

      const beamsGroup = new THREE.Group();
      const beamMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
      const beamGeo = new THREE.CylinderGeometry(0.14, 0.14, 6.6, 8);
      beamGeo.rotateZ(Math.PI / 2);
      [0.9, 1.9, 2.9].forEach(by => {
          const beam = new THREE.Mesh(beamGeo, beamMat);
          beam.position.y = by;
          beamsGroup.add(beam);
      });
      group.add(beamsGroup);

      const blocker = new THREE.Mesh(new THREE.BoxGeometry(7.6, 4.0, 2.2), new THREE.MeshBasicMaterial({ visible: false }));
      blocker.position.set(x, 2.0, z);
      blocker.userData = { bounds: new THREE.Box3().setFromObject(blocker), isLaserBlocker: true };

      return { mesh: group, beamsGroup, blocker, active: true, position: new THREE.Vector3(x, 0, z) };
  }

  createLaserSwitchMesh(x, z) {
      const group = new THREE.Group();
      group.position.set(x, 0, z);

      const pedMat = new THREE.MeshStandardMaterial({ color: 0x37474f, metalness: 0.7, roughness: 0.3 });
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.6, 2.2, 8), pedMat);
      ped.position.y = 1.1;
      ped.castShadow = true;
      group.add(ped);

      const orbMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(1.05, 0), orbMat);
      orb.position.y = 3.1;
      group.add(orb);

      group.userData = { bounds: new THREE.Box3().setFromObject(group), collisionRadius: 1.45, type: 'laser_switch' };
      return { mesh: group, orb, orbMat, cooldown: 0 };
  }

  toggleLaserGates(hitSw) {
      if (hitSw && hitSw.cooldown > 0) return;
      if (hitSw) hitSw.cooldown = 0.6;

      let anyActive = false;
      this.laserGates.forEach(lg => {
          lg.active = !lg.active;
          anyActive = lg.active;
          lg.beamsGroup.visible = lg.active;
          if (lg.active) {
              if (!this.tankBlockers.includes(lg.blocker)) this.tankBlockers.push(lg.blocker);
          } else {
              this.tankBlockers = this.tankBlockers.filter(b => b !== lg.blocker);
          }
      });

      this.laserSwitches.forEach(sw => {
          sw.orbMat.color.setHex(anyActive ? 0xff1744 : 0x00e676);
      });

      const pos = hitSw ? hitSw.mesh.position : new THREE.Vector3(0, 2, 0);
      this.audio.play('powerup');
      this.vfx.spawnShockwave(pos, anyActive ? 0xff1744 : 0x00e676, 18);
      this.vfx.spawnFloatingText(
          pos,
          anyActive ? '🔒 ¡BARRERA LÁSER ACTIVADA!' : '⚡ ¡BARRERA LÁSER DESACTIVADA!',
          anyActive ? '#ff5252' : '#00e676',
          1.15
      );
  }

  setPlayerLoadout(skinId, perkId, hatId, trailId) {
      this.playerSkin = skinId || this.playerSkin || 'classic';
      this.playerPerk = perkId || this.playerPerk || 'ricochet';
      if (hatId !== undefined) this.playerHat = hatId || 'none';
      if (trailId !== undefined) this.playerTrail = trailId || 'cyan';
      try {
          localStorage.setItem('tanks_player_skin', this.playerSkin);
          localStorage.setItem('tanks_player_perk', this.playerPerk);
          localStorage.setItem('tanks_player_hat', this.playerHat);
          localStorage.setItem('tanks_player_trail', this.playerTrail);
      } catch (_) {}
      if (this.player && this.player.mesh && !this.player.isDead) {
          this.player.trailId = this.playerTrail;
          if (typeof this.player.buildTurretHat === 'function') {
              this.player.buildTurretHat(this.playerHat);
          }
      }
  }

  setDifficulty(diffId) {
      this.aiDifficulty = diffId || 'normal';
      try {
          localStorage.setItem('tanks_ai_difficulty', this.aiDifficulty);
      } catch (_) {}
      this.entities.forEach(entity => {
          if (entity instanceof EnemyTank && !entity.isDead) {
              entity.applyDifficulty(this.aiDifficulty, false);
          }
      });
      return this.aiDifficulty;
  }

  getDifficulty() {
      return this.aiDifficulty || 'normal';
  }

  // --- Realistic Single-Origin GLSL Lighthouse Searchlight & Night Stealth System ---

  // Creates the smooth Fresnel volumetric shader material for the upper lantern cone (originating strictly at the top lantern y = 7.65)
  createUpperBeamMaterial() {
      return new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          uniforms: {
              uColor: { value: new THREE.Color(0xffe082) },
              uOpacity: { value: 0.22 }
          },
          vertexShader: `
              varying vec2 vUv;
              varying vec3 vNormalView;
              varying vec3 vViewPos;
              void main() {
                  vUv = uv;
                  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                  vViewPos = -mvPosition.xyz;
                  vNormalView = normalMatrix * normal;
                  gl_Position = projectionMatrix * mvPosition;
              }
          `,
          fragmentShader: `
              uniform vec3 uColor;
              uniform float uOpacity;
              varying vec2 vUv;
              varying vec3 vNormalView;
              varying vec3 vViewPos;
              void main() {
                  // vUv.y = 1.0 at the lantern lens apex, 0.0 at the far end of the cylinder
                  float distFromLens = 1.0 - vUv.y;
                  // Smooth longitudinal fade: bright near lantern lens, softly vanishes as it meets the ground light pool
                  float longFade = smoothstep(0.0, 0.08, distFromLens) * pow(clamp(1.0 - distFromLens, 0.0, 1.0), 1.65);
                  // Smooth view-space Fresnel rim fade so the cone edges never look sharp or striated
                  vec3 N = normalize(vNormalView);
                  vec3 V = normalize(vViewPos);
                  float fresnel = pow(abs(dot(N, V)), 1.45);
                  float alpha = longFade * (0.32 + 0.68 * fresnel) * uOpacity;
                  gl_FragColor = vec4(uColor, alpha);
              }
          `
      });
  }

  // Creates the per-pixel world-space Ground Searchlight Shader (no cone at the base of the lighthouse, zero radial triangle seams, smooth wall shadows)
  createGroundSearchlightMaterial(ox, oz, halfCone, maxRange) {
      const initialDists = new Float32Array(64);
      initialDists.fill(maxRange);
      return new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: {
              uOrigin: { value: new THREE.Vector2(ox, oz) },
              uAngle: { value: 0.0 },
              uHalfCone: { value: halfCone },
              uMaxRange: { value: maxRange },
              uColor: { value: new THREE.Color(0xffd54f) },
              uOpacity: { value: 0.36 },
              uWallDist: { value: initialDists }
          },
          vertexShader: `
              varying vec3 vWorldPos;
              void main() {
                  vec4 wp = modelMatrix * vec4(position, 1.0);
                  vWorldPos = wp.xyz;
                  gl_Position = projectionMatrix * viewMatrix * wp;
              }
          `,
          fragmentShader: `
              uniform vec2 uOrigin;
              uniform float uAngle;
              uniform float uHalfCone;
              uniform float uMaxRange;
              uniform vec3 uColor;
              uniform float uOpacity;
              uniform float uWallDist[64];
              varying vec3 vWorldPos;

              void main() {
                  vec2 rel = vWorldPos.xz - uOrigin;
                  float dist = length(rel);

                  // The beam comes from the TOP lantern (y = 7.65) angled downward, so it only touches the ground starting ~5.5 units away from the tower!
                  // This guarantees zero light ever comes out of the bottom base of the lighthouse.
                  if (dist < 4.5 || dist > uMaxRange) discard;

                  // Angle from lighthouse to this floor pixel (matching sin(angle) = X, cos(angle) = Z convention)
                  float fragAngle = atan(rel.x, rel.y);
                  float diff = fragAngle - uAngle;
                  if (diff > 3.14159265) diff -= 6.2831853;
                  if (diff < -3.14159265) diff += 6.2831853;

                  float absDiff = abs(diff);
                  if (absDiff > uHalfCone) discard;

                  // Smooth bell-curve angular spotlight profile (zero radial lines!)
                  float normAngle = absDiff / uHalfCone;
                  float angularFade = pow(clamp(1.0 - normAngle * normAngle, 0.0, 1.0), 1.85);

                  // Lookup smooth wall occlusion distance across the 64 angular samples
                  float samplePos = ((diff / uHalfCone) * 0.5 + 0.5) * 63.0;
                  int idx0 = int(clamp(floor(samplePos), 0.0, 62.0));
                  int idx1 = idx0 + 1;
                  float frac = fract(samplePos);

                  float d0 = uWallDist[0];
                  float d1 = uWallDist[0];
                  for (int i = 0; i < 64; i++) {
                      if (i == idx0) d0 = uWallDist[i];
                      if (i == idx1) d1 = uWallDist[i];
                  }
                  float wallDist = mix(d0, d1, frac);

                  // Soft shadow cutoff where the beam hits a wall, crate, pillar, or triangle prism
                  float wallShadow = 1.0 - smoothstep(wallDist - 1.35, wallDist + 0.35, dist);
                  if (wallShadow <= 0.005) discard;

                  // Smooth inner ground touch-down (5.0 -> 9.5 units) and outer range attenuation
                  float innerTouchdown = smoothstep(4.6, 9.2, dist);
                  float outerFade = 1.0 - smoothstep(12.0, uMaxRange, dist);

                  // Subtle warm hotspot where the main lantern axis hits the floor
                  float hotspot = exp(-pow((dist - 12.5) / 6.5, 2.0) - pow(normAngle * 1.6, 2.0)) * 0.35;

                  float intensity = (innerTouchdown * outerFade * angularFade + hotspot * innerTouchdown) * wallShadow;
                  gl_FragColor = vec4(uColor, clamp(intensity * uOpacity, 0.0, 0.75));
              }
          `
      });
  }

  // Exact 2D ray-vs-segment intersection distance helper (used for triangle prisms 'T')
  raySegmentDistance(ox, oz, dx, dz, ax, az, bx, bz) {
      const v1x = ox - ax;
      const v1z = oz - az;
      const v2x = bx - ax;
      const v2z = bz - az;
      const v3x = -dz;
      const v3z = dx;
      const dot = v2x * v3x + v2z * v3z;
      if (Math.abs(dot) < 1e-6) return Infinity;
      const t1 = (v2x * v1z - v2z * v1x) / dot;
      const t2 = (v1x * v3x + v1z * v3z) / dot;
      if (t1 > 1.8 && t2 >= 0.0 && t2 <= 1.0) {
          return t1;
      }
      return Infinity;
  }

  // Computes exact 2D ray distance from lighthouse (ox, oz) along direction (dx, dz) to the nearest wall, crate, pillar, triangle prism, or border
  getSearchlightWallDistance(ox, oz, dx, dz, maxDist, ignoreGroup) {
      let closest = maxDist;
      const obstacles = this.walls;
      for (let i = 0; i < obstacles.length; i++) {
          const w = obstacles[i];
          if (!w || w === ignoreGroup || !w.userData) continue;

          // 1. Triangle Prisms ('T') using exact 2D triangle edges
          if (w.userData.triPoints && w.userData.triPoints.length === 3) {
              const pts = w.userData.triPoints;
              for (let e = 0; e < 3; e++) {
                  const pA = pts[e];
                  const pB = pts[(e + 1) % 3];
                  const t = this.raySegmentDistance(ox, oz, dx, dz, pA.x, pA.z, pB.x, pB.z);
                  if (t < closest) closest = t;
              }
              continue;
          }

          // 2. Circular obstacles (pillars, trees, barrels, other lighthouses)
          if (w.userData.collisionRadius) {
              const r = w.userData.collisionRadius;
              const fx = ox - w.position.x;
              const fz = oz - w.position.z;
              if (fx * fx + fz * fz <= r * r + 0.2) continue;
              const b = 2 * (fx * dx + fz * dz);
              const c = (fx * fx + fz * fz) - r * r;
              const disc = b * b - 4 * c;
              if (disc >= 0) {
                  const t = (-b - Math.sqrt(disc)) * 0.5;
                  if (t > 1.8 && t < closest) {
                      closest = t;
                  }
              }
              continue;
          }

          // 3. Rectangular AABB walls ('W', 'S', 'C', borders)
          const box = w.userData.bounds;
          if (!box) continue;
          const invDx = Math.abs(dx) > 1e-6 ? 1.0 / dx : 1e6;
          const invDz = Math.abs(dz) > 1e-6 ? 1.0 / dz : 1e6;

          const t1 = (box.min.x - ox) * invDx;
          const t2 = (box.max.x - ox) * invDx;
          const t3 = (box.min.z - oz) * invDz;
          const t4 = (box.max.z - oz) * invDz;

          const tmin = Math.max(Math.min(t1, t2), Math.min(t3, t4));
          const tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4));

          if (tmax >= 0 && tmin <= tmax && tmin > 1.8 && tmin < closest) {
              closest = tmin;
          }
      }
      // Also check destructible cork crates ('C') not in this.walls
      for (let i = 0; i < this.destructibles.length; i++) {
          const d = this.destructibles[i];
          if (!d || !d.userData || !d.userData.bounds || d.userData.collisionRadius) continue;
          const box = d.userData.bounds;
          const invDx = Math.abs(dx) > 1e-6 ? 1.0 / dx : 1e6;
          const invDz = Math.abs(dz) > 1e-6 ? 1.0 / dz : 1e6;
          const t1 = (box.min.x - ox) * invDx;
          const t2 = (box.max.x - ox) * invDx;
          const t3 = (box.min.z - oz) * invDz;
          const t4 = (box.max.z - oz) * invDz;
          const tmin = Math.max(Math.min(t1, t2), Math.min(t3, t4));
          const tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4));
          if (tmax >= 0 && tmin <= tmax && tmin > 1.8 && tmin < closest) {
              closest = tmin;
          }
      }
      return closest;
  }

  updateLighthousesAndStealth(dt) {
      if (this.muzzleRevealTimer > 0) {
          this.muzzleRevealTimer = Math.max(0, this.muzzleRevealTimer - dt);
      }
      if (this.lighthouseAlertCooldown > 0) {
          this.lighthouseAlertCooldown = Math.max(0, this.lighthouseAlertCooldown - dt);
      }

      let playerIlluminatedByAnyLighthouse = false;
      const playerPos = (this.player && this.player.mesh && !this.isDying) ? this.player.mesh.position : null;

      for (let i = 0; i < this.lighthouses.length; i++) {
          const lh = this.lighthouses[i];
          if (!lh || !lh.group) continue;

          lh.angle = (lh.angle || 0) - lh.speed * dt;
          while (lh.angle > Math.PI) lh.angle -= Math.PI * 2;
          while (lh.angle < -Math.PI) lh.angle += Math.PI * 2;

          if (lh.headGroup) {
              lh.headGroup.rotation.y = lh.angle;
          }

          const ox = lh.group.position.x;
          const oz = lh.group.position.z;
          const N = 64;
          const halfCone = lh.halfCone || 0.42;
          const maxRange = lh.maxRange || 32.0;

          const rawDists = lh.rawDists;
          const smoothDists = lh.smoothDists;

          // 1. Sample 64 rays across the searchlight cone
          for (let r = 0; r < N; r++) {
              const frac = (r / (N - 1)) * 2.0 - 1.0; // -1 .. +1
              const rayAngle = lh.angle + frac * halfCone;
              const rdx = Math.sin(rayAngle);
              const rdz = Math.cos(rayAngle);
              rawDists[r] = this.getSearchlightWallDistance(ox, oz, rdx, rdz, maxRange, lh.group);
          }

          // 2. Apply a 5-tap spatial smoothing filter across the 64 samples so shadow edges are organic and never jagged
          let centerSum = 0;
          let centerCount = 0;
          for (let r = 0; r < N; r++) {
              const d_2 = rawDists[Math.max(0, r - 2)];
              const d_1 = rawDists[Math.max(0, r - 1)];
              const d_0 = rawDists[r];
              const d1  = rawDists[Math.min(N - 1, r + 1)];
              const d2  = rawDists[Math.min(N - 1, r + 2)];
              smoothDists[r] = d_2 * 0.12 + d_1 * 0.24 + d_0 * 0.28 + d1 * 0.24 + d2 * 0.12;
              if (r >= 24 && r <= 39) {
                  centerSum += smoothDists[r];
                  centerCount++;
              }
          }

          const centerDist = centerCount > 0 ? (centerSum / centerCount) : maxRange;

          // 3. Dynamically scale the upper volumetric cone so it connects the top lantern lens (y = 7.65) to the ground pool or stops at a nearby wall
          if (lh.upperConeMesh) {
              const coneReach = Math.max(4.5, Math.min(centerDist * 0.78, 19.0));
              lh.upperConeMesh.scale.set(1.0, 1.0, coneReach / 18.0);
          }

          // 4. Update Ground Searchlight Shader uniforms
          if (lh.groundMat && lh.groundMat.uniforms) {
              lh.groundMat.uniforms.uAngle.value = lh.angle;
          }

          // 5. Move the efficient no-shadow PointLight to the illuminated ground spot
          const lightDist = Math.max(5.5, Math.min(centerDist * 0.58, 15.5));
          if (lh.groundPointLight) {
              lh.groundPointLight.position.set(
                  Math.sin(lh.angle) * lightDist,
                  3.0,
                  Math.cos(lh.angle) * lightDist
              );
          }

          // 6. Check if the player tank is inside this lighthouse's unblocked ground beam
          let spottingPlayer = false;
          if (playerPos) {
              const px = playerPos.x - ox;
              const pz = playerPos.z - oz;
              const pDist = Math.hypot(px, pz);
              // Matches the ground shader's illuminated zone (dist >= 4.8 up to maxRange)
              if (pDist >= 4.8 && pDist <= maxRange) {
                  const pAngle = Math.atan2(px, pz);
                  let angleDiff = pAngle - lh.angle;
                  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                  if (Math.abs(angleDiff) <= halfCone * 0.92) {
                      const dirX = px / pDist;
                      const dirZ = pz / pDist;
                      const wallDist = this.getSearchlightWallDistance(ox, oz, dirX, dirZ, maxRange, lh.group);
                      if (pDist <= wallDist + 1.0) {
                          spottingPlayer = true;
                          playerIlluminatedByAnyLighthouse = true;
                      }
                  }
              }
          }

          // 7. Update Lighthouse Beam Colors (Warm Searchlight Gold vs High-Alert Crimson)
          const isNight = this.isNightStealthActive();
          if (spottingPlayer) {
              if (lh.groundMat) {
                  lh.groundMat.uniforms.uColor.value.setHex(0xff1744);
                  lh.groundMat.uniforms.uOpacity.value = isNight ? 0.72 : 0.45;
              }
              if (lh.upperConeMat) {
                  lh.upperConeMat.uniforms.uColor.value.setHex(0xff1744);
                  lh.upperConeMat.uniforms.uOpacity.value = isNight ? 0.42 : 0.25;
              }
              if (lh.bulbMat) lh.bulbMat.color.setHex(0xff1744);
              if (lh.groundPointLight) {
                  lh.groundPointLight.color.setHex(0xff1744);
                  lh.groundPointLight.intensity = isNight ? 6.2 : 3.4;
              }
          } else {
              if (lh.groundMat) {
                  lh.groundMat.uniforms.uColor.value.setHex(isNight ? 0xffe57f : 0xffd54f);
                  lh.groundMat.uniforms.uOpacity.value = isNight ? 0.58 : 0.30;
              }
              if (lh.upperConeMat) {
                  lh.upperConeMat.uniforms.uColor.value.setHex(isNight ? 0xfff59d : 0xffe082);
                  lh.upperConeMat.uniforms.uOpacity.value = isNight ? 0.32 : 0.16;
              }
              if (lh.bulbMat) lh.bulbMat.color.setHex(0xffffcc);
              if (lh.groundPointLight) {
                  lh.groundPointLight.color.setHex(0xffd54f);
                  lh.groundPointLight.intensity = isNight ? 4.8 : 2.4;
              }
          }
      }

      const wasSpotted = this.isSpottedByLighthouse;
      this.isSpottedByLighthouse = playerIlluminatedByAnyLighthouse;

      // Trigger high-alert warning when player steps into a lighthouse searchlight beam
      if (playerIlluminatedByAnyLighthouse && !wasSpotted && this.lighthouseAlertCooldown <= 0 && playerPos) {
          this.lighthouseAlertCooldown = 2.6;
          this.vfx.spawnShockwave(playerPos, 0xff1744, 7.5);
          this.vfx.spawnFloatingText(playerPos, '🚨 ¡ILUMINADO POR EL FARO!', '#ff1744', 1.15);
          this.onEvent({
              type: 'LIGHT_PULSE',
              data: { text: '🚨 ¡EL FARO TE HA ILUMINADO! LOS ENEMIGOS VEN TU POSICIÓN' }
          });
      }

      // Compute overall stealth state for Night Stealth missions or maps with Lighthouses
      const isNight = this.isNightStealthActive();
      const hasStealthGameplay = isNight || this.lighthouses.length > 0;
      if (!hasStealthGameplay || !playerPos) {
          this.isPlayerStealthed = false;
          if (this.stats.stealthStatus !== null) {
              this.stats.stealthStatus = null;
              this.updateUI();
          }
          return;
      }

      if (playerIlluminatedByAnyLighthouse) {
          this.isPlayerStealthed = false;
      } else if (isNight) {
          // In Night Stealth mode, player is hidden in the shadows unless firing weapon or standing < 14 units in front of an enemy
          this.isPlayerStealthed = (this.muzzleRevealTimer <= 0 && this.stageLightBoost <= 0);
      } else {
          this.isPlayerStealthed = false;
      }

      const nextStatus = playerIlluminatedByAnyLighthouse
          ? 'SPOTTED'
          : (this.isPlayerStealthed ? 'STEALTH' : (isNight ? 'COMBAT' : null));

      if (this.stats.stealthStatus !== nextStatus || this.stats.isNightMode !== isNight) {
          this.stats.stealthStatus = nextStatus;
          this.stats.isNightMode = isNight;
          this.updateUI();
      }
  }

  loadLevel(levelIndex) {
    this.cleanup();
    this.stageLightBoost = 0;
    this.hitStopTimer = 0;
    this.comboStreak = 0;
    this.comboTimer = 0;
    this.stats.combo = 0;
    this.stats.activePowerup = null;
    this.stats.bazookaReady = true;
    this.stats.bazookaCooldownProgress = 1.0;
    if (this.input) this.input.resetInputs();

    this.stats.mission = levelIndex;
    const unlocks = LevelLoader.getUnlockedFeatures(levelIndex);
    this.stats.mineUnlocked = unlocks.mineUnlocked;
    this.stats.bazookaUnlocked = unlocks.bazookaUnlocked;
    this.stats.empUnlocked = unlocks.empUnlocked;
    this.stats.empReady = true;
    this.stats.empCooldownProgress = 1.0;

    const levelData = LevelLoader.getLevel(levelIndex);
    const map = levelData.map;
    this.stats.missionName = levelData.name || `Mission ${levelIndex}`;
    
    const biome = levelData.biome || LevelLoader.getBiome(levelIndex) || 'workshop';
    this.currentBiome = biome;
    this.stats.biome = biome;

    const cellSize = 8; 
    
    const mapW = map[0].length * cellSize;
    const mapH = map.length * cellSize;
    this.currentMapWidth = mapW;
    this.currentMapHeight = mapH;
    this.updateCameraFraming();

    // Decorate table environment outside arena
    this.decorateTable(biome, mapW, mapH);

    const offX = mapW / 2;
    const offZ = mapH / 2;

    // Biome-specific High-Contrast 3D Materials
    this.floorTex = this.createBiomeFloorTexture(biome);
    const floorMat = new THREE.MeshStandardMaterial({ map: this.floorTex, roughness: 0.72 });
    this.floorMat = floorMat;
    const floorGeo = new THREE.BoxGeometry(cellSize, 1, cellSize); 

    // Apply Biome lighting and smooth nocturnal dimming after floorMat & landscapeMat exist
    this.applyBiomeLighting(biome, true);
    
    let woodMat, brickMat, borderMat, capMat, foliagePrimaryColor, foliageSecondaryColor;
    if (biome === 'workshop') {
        woodMat = new THREE.MeshStandardMaterial({ color: 0xb86522, roughness: 0.4 });
        capMat = new THREE.MeshStandardMaterial({ color: 0xe68a2e, roughness: 0.32 });
        brickMat = new THREE.MeshStandardMaterial({ map: this.createBrickTexture(), roughness: 0.58 });
        borderMat = new THREE.MeshStandardMaterial({ color: 0x5d3a1a, roughness: 0.5 });
        foliagePrimaryColor = 0x22c55e;
        foliageSecondaryColor = 0x4ade80;
    } else if (biome === 'desert') {
        woodMat = new THREE.MeshStandardMaterial({ color: 0xe07a28, roughness: 0.48 });
        capMat = new THREE.MeshStandardMaterial({ color: 0xffa73b, roughness: 0.38 });
        brickMat = new THREE.MeshStandardMaterial({ color: 0xc86428, map: this.createBrickTexture(), roughness: 0.62 });
        borderMat = new THREE.MeshStandardMaterial({ color: 0x7c3f16, roughness: 0.58 });
        foliagePrimaryColor = 0x65a30d;
        foliageSecondaryColor = 0x84cc16;
    } else if (biome === 'cyber') {
        woodMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.75, roughness: 0.2, emissive: 0x006688, emissiveIntensity: 0.45 });
        capMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00b8d4, emissiveIntensity: 0.72, roughness: 0.18 });
        brickMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.15, emissive: 0x6a1b9a, emissiveIntensity: 0.45 });
        borderMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x0088aa, emissiveIntensity: 0.55 });
        foliagePrimaryColor = 0x00e5ff;
        foliageSecondaryColor = 0x18ffff;
    } else if (biome === 'arctic') {
        woodMat = new THREE.MeshStandardMaterial({ color: 0x0091ea, roughness: 0.22, metalness: 0.15 });
        capMat = new THREE.MeshStandardMaterial({ color: 0x40c4ff, roughness: 0.15, metalness: 0.1 });
        brickMat = new THREE.MeshStandardMaterial({ color: 0x0277bd, map: this.createBrickTexture(), roughness: 0.35 });
        borderMat = new THREE.MeshStandardMaterial({ color: 0x01579b, roughness: 0.32 });
        foliagePrimaryColor = 0x00bfa5;
        foliageSecondaryColor = 0x64ffda;
    } else if (biome === 'volcano') {
        woodMat = new THREE.MeshStandardMaterial({ color: 0x3e1e14, roughness: 0.65, emissive: 0x6d1b07, emissiveIntensity: 0.42 });
        capMat = new THREE.MeshStandardMaterial({ color: 0xff6d00, emissive: 0xff3d00, emissiveIntensity: 0.65, roughness: 0.35 });
        brickMat = new THREE.MeshStandardMaterial({ color: 0x4e2c22, map: this.createBrickTexture(), roughness: 0.72 });
        borderMat = new THREE.MeshStandardMaterial({ color: 0xff3d00, emissive: 0xd50000, emissiveIntensity: 0.6 });
        foliagePrimaryColor = 0xd50000;
        foliageSecondaryColor = 0xff9100;
    } else if (biome === 'sunset_city') {
        woodMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.55, roughness: 0.28, emissive: 0x311b47, emissiveIntensity: 0.35 });
        capMat = new THREE.MeshStandardMaterial({ color: 0xff6e40, emissive: 0xff3d00, emissiveIntensity: 0.55, roughness: 0.25 });
        brickMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, map: this.createBrickTexture(), roughness: 0.45 });
        borderMat = new THREE.MeshStandardMaterial({ color: 0x4a148c, emissive: 0x7c4dff, emissiveIntensity: 0.35, roughness: 0.4 });
        foliagePrimaryColor = 0xff6e40;
        foliageSecondaryColor = 0xffab40;
    } else if (biome === 'matsuri') {
        // Traditional Vermilion Red & Imperial Gold Japanese Festival Architecture
        woodMat = new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.38 });
        capMat = new THREE.MeshStandardMaterial({ color: 0xffca28, metalness: 0.65, roughness: 0.22 });
        brickMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, map: this.createBrickTexture(), roughness: 0.55 });
        borderMat = new THREE.MeshStandardMaterial({ color: 0xb71c1c, roughness: 0.42 });
        foliagePrimaryColor = 0xff80ab;
        foliageSecondaryColor = 0xf8bbd0;
    } else if (biome === 'tropical_island') {
        // Warm Toasted Sand, Terracotta Amber & Tropical Teak Hardwood ("tono arena, naranjita, no tan iluminado de blanco")
        woodMat = new THREE.MeshStandardMaterial({ color: 0xc87225, roughness: 0.48 });
        capMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35 });
        brickMat = new THREE.MeshStandardMaterial({ color: 0xd98032, map: this.createBrickTexture(), roughness: 0.58 });
        borderMat = new THREE.MeshStandardMaterial({ color: 0x7c3f16, roughness: 0.52 });
        foliagePrimaryColor = 0x15803d;
        foliageSecondaryColor = 0x22c55e;
    } else if (biome === 'night_stealth') {
        // Moonlit Tactical Stealth Operations: High-contrast steel-indigo walls with luminous cyan bevel caps so all 3D shapes are clearly visible at night!
        woodMat = new THREE.MeshStandardMaterial({ color: 0x2b3d59, metalness: 0.45, roughness: 0.32, emissive: 0x0f1f38, emissiveIntensity: 0.35 });
        capMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.48, roughness: 0.22 });
        brickMat = new THREE.MeshStandardMaterial({ color: 0x334155, map: this.createBrickTexture(), roughness: 0.48 });
        borderMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: 0x0369a1, emissiveIntensity: 0.32, roughness: 0.4 });
        foliagePrimaryColor = 0x0284c7;
        foliageSecondaryColor = 0x38bdf8;
    } else { // jungle
        woodMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.45 });
        capMat = new THREE.MeshStandardMaterial({ color: 0xffd600, metalness: 0.45, roughness: 0.3 });
        brickMat = new THREE.MeshStandardMaterial({ color: 0x15803d, map: this.createBrickTexture(), roughness: 0.55 });
        borderMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.5 });
        foliagePrimaryColor = 0x16a34a;
        foliageSecondaryColor = 0x4ade80;
    }
    
    const corkTex = this.createCorkTexture();
    const corkMat = new THREE.MeshStandardMaterial({ map: corkTex, roughness: 0.85, color: 0xffe0b2 });
    const crateFrameMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.6 });
    const geomMat = new THREE.MeshStandardMaterial({
      color: biome === 'arctic' ? 0x01579b
        : biome === 'jungle' ? 0xd4af37
        : biome === 'matsuri' ? 0xd32f2f
        : biome === 'sunset_city' ? 0x475569
        : biome === 'tropical_island' ? 0x00acc1
        : biome === 'night_stealth' ? 0x38bdf8
        : 0x5d4037,
      roughness: 0.45,
      metalness: 0.2
    }); 
    
    const brickGeo = new THREE.BoxGeometry(cellSize, 4.2, cellSize);
    brickGeo.scale(0.95, 1, 0.95);

    const blockGeo = new THREE.BoxGeometry(cellSize, 4.0, cellSize);
    blockGeo.scale(0.95, 1, 0.95);

    // 3D Architectural Top Cap / Bevel Relief for Walls ('W') & Stone ('S')
    const wallCapGeo = new THREE.BoxGeometry(cellSize * 0.82, 0.55, cellSize * 0.82);
    const stoneCapGeo = new THREE.BoxGeometry(cellSize * 0.88, 0.65, cellSize * 0.88);
    const crateBandHGeo = new THREE.BoxGeometry(cellSize * 0.98, 0.6, cellSize * 0.98);
    
    const cylGeo = new THREE.CylinderGeometry(cellSize/2.6, cellSize/2.6, 3.8, 24);
    const cylRingGeo = new THREE.CylinderGeometry(cellSize/2.25, cellSize/2.25, 0.55, 24);
    
    // Triangle (Prism) Geometry — Compact centered triangular wedge so tanks can pass along the diagonal and between adjacent prisms
    const triHalf = cellSize * 0.24; // 1.92 units half-extent (leaves a wide 4.16-unit visual corridor between adjacent triangles!)
    const triColHalf = cellSize * 0.15; // 1.20 units inset physical collision triangle (prevents snagging on sharp 45° tips)
    const triShape = new THREE.Shape();
    triShape.moveTo(-triHalf, -triHalf);
    triShape.lineTo(triHalf, -triHalf);
    triShape.lineTo(-triHalf, triHalf);
    triShape.lineTo(-triHalf, -triHalf);
    const triGeo = new THREE.ExtrudeGeometry(triShape, { depth: 3.9, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.12, bevelSegments: 2 });
    
    // Lighthouse Geometry (Composite)
    const lhBaseGeo = new THREE.CylinderGeometry(2.5, 3, 6, 16);
    const lhTopGeo = new THREE.CylinderGeometry(2, 2.5, 2, 16);
    const lhRoofGeo = new THREE.ConeGeometry(2.5, 2, 16);
    const lhWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const lhRedMat = new THREE.MeshStandardMaterial({ color: 0xd32f2f });

    // Multi-tiered 3D Tree Geometry ('R')
    const treeTrunkGeo = new THREE.CylinderGeometry(0.9, 1.3, 2.8, 8);
    const treeFoliageLowGeo = new THREE.ConeGeometry(3.6, 3.4, 8);
    const treeFoliageMidGeo = new THREE.ConeGeometry(2.9, 3.0, 8);
    const treeFoliageTopGeo = new THREE.ConeGeometry(2.0, 2.4, 8);
    const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
    const treeFoliageMat = new THREE.MeshStandardMaterial({ color: foliagePrimaryColor, roughness: 0.65 });
    const treeFoliageTopMat = new THREE.MeshStandardMaterial({ color: foliageSecondaryColor, roughness: 0.6 });

    // Borders (The Arena Outer Wall with 3D Top Coping — strictly indestructible)
    const addBorder = (w, d, x, z) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 6, d), borderMat);
        m.position.set(x, 2, z);
        m.castShadow = true; m.receiveShadow = true;
        const coping = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.6, d + 0.3), capMat);
        coping.position.y = 3.1;
        coping.castShadow = true;
        m.add(coping);
        m.updateMatrixWorld(true);
        m.userData = { bounds: new THREE.Box3().setFromObject(m), isBorder: true, type: 'border' };
        this.scene.add(m);
        this.walls.push(m); 
    };
    addBorder(mapW+2, 2, 0, -mapH/2 - 1);
    addBorder(mapW+2, 2, 0, mapH/2 + 1);
    addBorder(2, mapH, -mapW/2 - 1, 0);
    addBorder(2, mapH, mapW/2 + 1, 0);

    // For Japanese Festival ('matsuri') & Sunset City ('sunset_city'), string festive overhead lantern festoons ("luces entre farolas") right along the arena border walls so they frame the battlefield!
    if (biome === 'matsuri' || biome === 'sunset_city') {
      const numLanternsPerSpan = biome === 'matsuri' ? 6 : 4;
      const borderSpans = [
        // North wall (left & right of center)
        { x1: -mapW / 2, z1: -mapH / 2 - 1.2, x2: -6, z2: -mapH / 2 - 1.2 },
        { x1: 6, z1: -mapH / 2 - 1.2, x2: mapW / 2, z2: -mapH / 2 - 1.2 },
        // South wall (left & right of center)
        { x1: -mapW / 2, z1: mapH / 2 + 1.2, x2: -6, z2: mapH / 2 + 1.2 },
        { x1: 6, z1: mapH / 2 + 1.2, x2: mapW / 2, z2: mapH / 2 + 1.2 },
        // West wall
        { x1: -mapW / 2 - 1.2, z1: -mapH / 2, x2: -mapW / 2 - 1.2, z2: 0 },
        { x1: -mapW / 2 - 1.2, z1: 0, x2: -mapW / 2 - 1.2, z2: mapH / 2 },
        // East wall
        { x1: mapW / 2 + 1.2, z1: -mapH / 2, x2: mapW / 2 + 1.2, z2: 0 },
        { x1: mapW / 2 + 1.2, z1: 0, x2: mapW / 2 + 1.2, z2: mapH / 2 }
      ];
      borderSpans.forEach(sp => {
        const fest = this.createFestivalLanternFestoon(sp.x1, sp.z1, sp.x2, sp.z2, numLanternsPerSpan, 9.2, true);
        fest.userData = { isEnvironment: true };
        this.scene.add(fest);
        this.tableProps.push(fest);
      });
    }

    // Build Map Tile by Tile
    for (let r = 0; r < map.length; r++) {
      for (let c = 0; c < map[r].length; c++) {
        const type = map[r][c];
        const x = (c * cellSize) - offX + cellSize/2;
        const z = (r * cellSize) - offZ + cellSize/2;
        
        // 1. Floor Logic
        if (type !== 'H') {
            const tile = new THREE.Mesh(floorGeo, floorMat);
            tile.position.set(x, -0.5, z);
            tile.receiveShadow = true;
            this.scene.add(tile);
            this.floorTiles.push(tile);
        } else {
            // Hole Logic (Pit / Lava chasm with visible 3D rim)
            const blocker = new THREE.Mesh(new THREE.BoxGeometry(cellSize, 5, cellSize), new THREE.MeshBasicMaterial({ visible: false }));
            blocker.position.set(x, 2.5, z);
            blocker.userData = { bounds: new THREE.Box3().setFromObject(blocker) };
            this.scene.add(blocker);
            this.tankBlockers.push(blocker);
            continue; 
        }

        // 2. Object Spawning
        if (type === 'P') {
           this.playerSpawnPos = new THREE.Vector3(x, 0, z);
           this.player = new PlayerTank(this.scene, x, z, this.input, this.playerSkin, this.playerPerk, this.playerHat, this.playerTrail);
           this.player.mineUnlocked = unlocks.mineUnlocked;
           this.player.bazookaUnlocked = unlocks.bazookaUnlocked;
           this.player.empUnlocked = unlocks.empUnlocked;
           this.player.mesh.rotation.y = Math.PI;
           this.entities.push(this.player);

           // Subtle nocturnal tactical aura light that smoothly fades in as ambient light dims at night
           this.playerNightLight = new THREE.PointLight(0x38bdf8, 0, 15, 1.45);
           this.playerNightLight.position.set(x, 3.2, z);
           this.playerNightLight.castShadow = false;
           this.scene.add(this.playerNightLight);
        } else if (type === 'W') {
            const m = new THREE.Mesh(blockGeo, woodMat);
            m.position.set(x, 2, z);
            m.castShadow = true; m.receiveShadow = true;
            // 3D Beveled Architectural Cap Plate
            const cap = new THREE.Mesh(wallCapGeo, capMat);
            cap.position.y = 2.15;
            cap.castShadow = true; cap.receiveShadow = true;
            m.add(cap);
            m.updateMatrixWorld(true);
            m.userData = { bounds: new THREE.Box3().setFromObject(m), type: 'wall' };
            this.scene.add(m);
            this.walls.push(m);
        } else if (type === 'C') {
            const m = new THREE.Mesh(blockGeo, corkMat);
            m.position.set(x, 2, z);
            m.castShadow = true; m.receiveShadow = true;
            // 3D Wooden Supply Crate Reinforcement Bands
            const bandTop = new THREE.Mesh(crateBandHGeo, crateFrameMat);
            bandTop.position.y = 1.35;
            m.add(bandTop);
            const bandBot = new THREE.Mesh(crateBandHGeo, crateFrameMat);
            bandBot.position.y = -1.35;
            m.add(bandBot);
            m.updateMatrixWorld(true);
            m.userData = { bounds: new THREE.Box3().setFromObject(m), type: 'cork' };
            this.scene.add(m);
            this.destructibles.push(m);
        } else if (type === 'Y') {
            const m = new THREE.Mesh(cylGeo, geomMat);
            m.position.set(x, 1.9, z);
            m.castShadow = true; m.receiveShadow = true;
            // Column Base & Capital Rings
            const baseRing = new THREE.Mesh(cylRingGeo, capMat);
            baseRing.position.y = -1.6;
            m.add(baseRing);
            const topRing = new THREE.Mesh(cylRingGeo, capMat);
            topRing.position.y = 1.65;
            m.add(topRing);
            m.updateMatrixWorld(true);
            m.userData = { bounds: new THREE.Box3().setFromObject(m), collisionRadius: 2.55, type: 'cyl' };
            this.scene.add(m);
            this.walls.push(m);
        } else if (type === 'S') { // Stone Fortress Block
            const m = new THREE.Mesh(brickGeo, brickMat);
            m.position.set(x, 2.1, z);
            m.castShadow = true; m.receiveShadow = true;
            const stoneCap = new THREE.Mesh(stoneCapGeo, borderMat);
            stoneCap.position.y = 2.25;
            stoneCap.castShadow = true;
            m.add(stoneCap);
            m.updateMatrixWorld(true);
            m.userData = { bounds: new THREE.Box3().setFromObject(m), type: 'stone' };
            this.scene.add(m);
            this.walls.push(m);
        } else if (type === 'T') { // Triangle Prism (Properly centered in cell (x, z) with inset 2D triangle vertices)
            const m = new THREE.Mesh(triGeo, woodMat);
            m.rotation.x = -Math.PI / 2;
            m.position.set(x, 0, z);
            m.castShadow = true; m.receiveShadow = true;
            m.updateMatrixWorld(true);
            const triPoints = [
                { x: x - triColHalf, z: z + triColHalf },
                { x: x + triColHalf, z: z + triColHalf },
                { x: x - triColHalf, z: z - triColHalf }
            ];
            m.userData = {
                bounds: new THREE.Box3().setFromObject(m),
                triPoints,
                type: 'tri'
            };
            this.scene.add(m);
            this.walls.push(m);
        } else if (type === 'L') { // Realistic Single-Origin GLSL Lighthouse Searchlight Tower
            const grp = new THREE.Group();
            grp.position.set(x, 0, z);
            
            const base = new THREE.Mesh(lhBaseGeo, lhWhiteMat);
            base.position.y = 3;
            base.castShadow = true; base.receiveShadow = true;
            grp.add(base);

            // Red warning stripe band around lighthouse tower
            const stripe = new THREE.Mesh(new THREE.CylinderGeometry(2.68, 2.82, 1.5, 16), lhRedMat);
            stripe.position.y = 3.2;
            grp.add(stripe);
            
            const mid = new THREE.Mesh(lhTopGeo, lhRedMat);
            mid.position.y = 6.8;
            mid.castShadow = true;
            grp.add(mid);

            // Observation gallery rim
            const gallery = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.55, 0.35, 16), borderMat);
            gallery.position.y = 6.0;
            grp.add(gallery);

            const roof = new THREE.Mesh(lhRoofGeo, lhRedMat);
            roof.position.y = 9.1;
            roof.castShadow = true;
            grp.add(roof);

            // Rotating Searchlight Head housing & glowing lens (strictly at the top lantern y = 7.65)
            const headGroup = new THREE.Group();
            headGroup.position.y = 7.65;
            grp.add(headGroup);

            const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
            const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.1, 16), bulbMat);
            bulb.rotation.x = Math.PI / 2;
            bulb.position.z = 0.7;
            bulb.userData = { isEffect: true };
            bulb.raycast = () => {};
            headGroup.add(bulb);

            // 1. Upper Volumetric Cone (originates ONLY at the top lantern y = 7.65, tilted downward toward the floor pool)
            const coneLen = 18.0;
            const upperConeGeo = new THREE.CylinderGeometry(0.65, 5.2, coneLen, 36, 1, true);
            upperConeGeo.rotateX(-Math.PI / 2);
            upperConeGeo.translate(0, 0, coneLen / 2);
            const upperConeMat = this.createUpperBeamMaterial();
            const upperConeMesh = new THREE.Mesh(upperConeGeo, upperConeMat);
            upperConeMesh.position.set(0, 0, 1.0);
            upperConeMesh.rotation.x = 0.36; // Angles downward from the top lantern to the ground pool
            upperConeMesh.frustumCulled = false;
            upperConeMesh.userData = { isEffect: true };
            upperConeMesh.raycast = () => {};
            headGroup.add(upperConeMesh);

            // 2. Per-Pixel Ground Searchlight Projection Shader on the Floor (y = 0.05)
            const halfCone = 0.42;
            const maxRange = 32.0;
            const groundGeo = new THREE.PlaneGeometry(maxRange * 2.1, maxRange * 2.1);
            groundGeo.rotateX(-Math.PI / 2);
            const groundMat = this.createGroundSearchlightMaterial(x, z, halfCone, maxRange);
            const groundMesh = new THREE.Mesh(groundGeo, groundMat);
            groundMesh.position.set(0, 0.05, 0);
            groundMesh.frustumCulled = false;
            groundMesh.userData = { isEffect: true };
            groundMesh.raycast = () => {};
            grp.add(groundMesh);

            // 3. Single efficient PointLight (castShadow = false) that glides along the illuminated floor zone
            const groundPointLight = new THREE.PointLight(0xffd54f, 3.0, 26, 1.35);
            groundPointLight.position.set(0, 3.0, 11);
            groundPointLight.castShadow = false;
            grp.add(groundPointLight);

            this.scene.add(grp);
            grp.updateMatrixWorld(true);

            const initialAngle = (this.lighthouses.length * 1.57) % (Math.PI * 2);
            const smoothDists = groundMat.uniforms.uWallDist.value;
            this.lighthouses.push({
                group: grp,
                headGroup,
                bulbMat,
                upperConeMesh,
                upperConeMat,
                groundMat,
                groundPointLight,
                angle: initialAngle,
                speed: 0.9,
                halfCone,
                maxRange,
                rawDists: new Float32Array(64),
                smoothDists
            });

            grp.userData = { bounds: new THREE.Box3().setFromObject(base), collisionRadius: 2.95, type: 'lighthouse' };
            this.walls.push(grp);

        } else if (type === 'R') { // Biome-Themed 3D Tree (Coconut Palm in Tropical Island, Sakura Blossom in Matsuri, or 3-Tiered Tree)
            const grp = new THREE.Group();
            grp.position.set(x, 0, z);

            const trunk = new THREE.Mesh(treeTrunkGeo, treeTrunkMat);
            trunk.position.y = 1.4;
            trunk.castShadow = true; trunk.receiveShadow = true;
            grp.add(trunk);

            if (biome === 'tropical_island') {
              // Tropical Island Arena Coconut Palm Tree
              const upperTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.9, 3.2, 8), treeTrunkMat);
              upperTrunk.position.set(0.25, 4.1, 0);
              upperTrunk.rotation.z = -0.12;
              upperTrunk.castShadow = true;
              grp.add(upperTrunk);

              const nutMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.8 });
              for (let n = 0; n < 3; n++) {
                const nut = new THREE.Mesh(new THREE.SphereGeometry(0.38, 6, 6), nutMat);
                const na = (n / 3) * Math.PI * 2;
                nut.position.set(0.45 + Math.cos(na) * 0.45, 5.5, Math.sin(na) * 0.45);
                grp.add(nut);
              }

              for (let f = 0; f < 6; f++) {
                const fa = (f / 6) * Math.PI * 2;
                const frond = new THREE.Mesh(new THREE.ConeGeometry(1.15, 3.8, 4), f % 2 === 0 ? treeFoliageMat : treeFoliageTopMat);
                frond.scale.set(1.0, 1.0, 0.3);
                frond.position.set(0.45 + Math.cos(fa) * 1.55, 5.9, Math.sin(fa) * 1.55);
                frond.rotation.y = -fa;
                frond.rotation.z = -Math.PI / 2.6;
                frond.castShadow = true;
                grp.add(frond);
              }
            } else {
              const leavesLow = new THREE.Mesh(treeFoliageLowGeo, treeFoliageMat);
              leavesLow.position.y = 3.5;
              leavesLow.castShadow = true; leavesLow.receiveShadow = true;
              grp.add(leavesLow);

              const leavesMid = new THREE.Mesh(treeFoliageMidGeo, treeFoliageTopMat);
              leavesMid.position.y = 5.2;
              leavesMid.castShadow = true; leavesMid.receiveShadow = true;
              grp.add(leavesMid);

              const leavesTop = new THREE.Mesh(treeFoliageTopGeo, treeFoliageMat);
              leavesTop.position.y = 6.7;
              leavesTop.castShadow = true; leavesTop.receiveShadow = true;
              grp.add(leavesTop);
            }

            this.scene.add(grp);
            grp.updateMatrixWorld(true);
            grp.userData = { bounds: new THREE.Box3().setFromObject(trunk), collisionRadius: 1.15, type: 'tree' };
            this.walls.push(grp);
        }
        // --- NEW INTERACTIVE TOKENS ---
        else if (type === 'B') { // Explosive Barrel (TNT Red Drum)
            const barrel = this.createBarrelMesh(x, z);
            this.scene.add(barrel);
            this.destructibles.push(barrel);
            this.walls.push(barrel);
            this.barrels.push(barrel);
        } else if (type === 'U') { // Power-Up Supply Crate
            const crate = this.createPowerUpCrateMesh(x, z);
            this.scene.add(crate);
            this.destructibles.push(crate);
            this.walls.push(crate);
            this.powerUpCrates.push(crate);
        } else if (type === 'A') { // Speed Boost Accelerator Pad
            const pad = this.createSpeedPadMesh(x, z);
            this.scene.add(pad);
            this.boostPads.push({ mesh: pad, position: new THREE.Vector3(x, 0, z), dirX: 0, dirZ: -1, cooldown: 0 });
        } else if (type === 'M') { // Laser Prism Reflector Crystal
            const prism = this.createPrismCrystalMesh(x, z);
            this.scene.add(prism);
            this.walls.push(prism);
            this.prisms.push(prism);
        } else if (type === 'O') { // Teleporter Portal
            const tp = this.createTeleporterMesh(x, z, this.teleporters.length);
            this.scene.add(tp.mesh);
            this.teleporters.push(tp);
        } else if (type === 'G') { // Laser Gate Forcefield
            const lg = this.createLaserGateMesh(x, z);
            this.scene.add(lg.mesh);
            this.scene.add(lg.blocker);
            this.tankBlockers.push(lg.blocker);
            this.laserGates.push(lg);
        } else if (type === 'K') { // Shootable Laser Switch
            const sw = this.createLaserSwitchMesh(x, z);
            this.scene.add(sw.mesh);
            this.walls.push(sw.mesh);
            this.laserSwitches.push(sw);
        } else if (type === 'F') { // Cryogenic EMP Freeze Barrel
            const cryo = this.createCryoBarrelMesh(x, z);
            this.scene.add(cryo);
            this.destructibles.push(cryo);
            this.walls.push(cryo);
            this.cryoBarrels.push(cryo);
        } else if (type === 'D') { // Medical Armor Repair Station
            const rpad = this.createRepairPadMesh(x, z);
            this.scene.add(rpad.mesh);
            this.repairPads.push(rpad);
        }
        // --- ENEMIES ---
        else if (['E', '1', '2', '3', '4'].includes(type)) {
           let enemyType = 'basic';
           if (type === '1') enemyType = 'static';
           if (type === '2') enemyType = 'basic';
           if (type === '3') enemyType = 'fast';
           if (type === '4') enemyType = 'heavy';
           if (type === 'E') enemyType = 'basic';

           this.entities.push(new EnemyTank(this.scene, x, z, enemyType, null, this.aiDifficulty));
        }
      }
    }

    // --- AUTO-DEPLOY TELEPORTER PORTALS & LASER BARRIERS ON TACTICAL MISSIONS (Gated by Progressive Unlocks!) ---
    const findFreeCell = (rPref, cPref) => {
      const rows = map.length;
      const cols = map[0].length;
      for (let rad = 0; rad <= 3; rad++) {
        for (let dr = -rad; dr <= rad; dr++) {
          for (let dc = -rad; dc <= rad; dc++) {
            const rr = rPref + dr;
            const cc = cPref + dc;
            if (rr >= 1 && rr < rows - 1 && cc >= 1 && cc < cols - 1 && map[rr][cc] === ' ') {
              const wx = (cc * cellSize) - offX + cellSize / 2;
              const wz = (rr * cellSize) - offZ + cellSize / 2;
              return { r: rr, c: cc, x: wx, z: wz };
            }
          }
        }
      }
      return null;
    };

    // Deploy paired Teleporter Portals (A <-> B) only from Mission 10+ (when Portals unlock!)
    if (this.teleporters.length === 0 && levelIndex >= 10 && levelIndex % 2 === 0) {
      const cellA = findFreeCell(2, 2);
      const cellB = findFreeCell(map.length - 3, map[0].length - 3);
      if (cellA && cellB && (cellA.r !== cellB.r || cellA.c !== cellB.c)) {
        const tpA = this.createTeleporterMesh(cellA.x, cellA.z, 0);
        const tpB = this.createTeleporterMesh(cellB.x, cellB.z, 1);
        this.scene.add(tpA.mesh);
        this.scene.add(tpB.mesh);
        this.teleporters.push(tpA, tpB);
      }
    }

    // Deploy Laser Forcefield Gate + Shootable Crystal Switch only from Mission 12+ (when Laser Gates unlock!)
    if (this.laserGates.length === 0 && levelIndex >= 12 && levelIndex % 3 === 0) {
      const gateCell = findFreeCell(Math.floor(map.length / 2), Math.floor(map[0].length / 2));
      const switchCell = findFreeCell(Math.floor(map.length / 2) + 2, 2);
      if (gateCell && switchCell && (gateCell.r !== switchCell.r || gateCell.c !== switchCell.c)) {
        const lg = this.createLaserGateMesh(gateCell.x, gateCell.z);
        this.scene.add(lg.mesh);
        this.scene.add(lg.blocker);
        this.tankBlockers.push(lg.blocker);
        this.laserGates.push(lg);

        const sw = this.createLaserSwitchMesh(switchCell.x, switchCell.z);
        this.scene.add(sw.mesh);
        this.walls.push(sw.mesh);
        this.laserSwitches.push(sw);
      }
    }

    // --- PUNTO 1: BIOME BOSS FINALE ON EVERY 8TH MISSION ---
    this.bossEntity = null;
    this.stats.bossInfo = null;
    if (levelIndex % 8 === 0) {
      const BOSS_METADATA = {
        8:   { name: '👑 COLOSO DE ROBLE MK-I', color: 0xb71c1c, maxHp: 10 },
        16:  { name: '👑 FARAÓN ESCORPIÓN', color: 0xe65100, maxHp: 12 },
        24:  { name: '👑 OVERLORD MATRIX Ω', color: 0xd500f9, maxHp: 14 },
        32:  { name: '👑 TITÁN CRIOGÉNICO', color: 0x0091ea, maxHp: 16 },
        40:  { name: '👑 VULCANO DESTRUCTOR', color: 0xff1744, maxHp: 18 },
        48:  { name: '👑 GUARDIÁN DE EL DORADO', color: 0xffab00, maxHp: 20 },
        56:  { name: '👑 GUARDIÁN METRÓPOLIS NOCTURNA', color: 0xff6e40, maxHp: 22 },
        64:  { name: '👑 SHOGUN DEL FESTIVAL CARMESÍ', color: 0xff1744, maxHp: 24 },
        72:  { name: '👑 KRAKEN DE CORAL MK-IX', color: 0x00e5ff, maxHp: 26 },
        80:  { name: '👑 ESPECTRO NOCTURNO MK-X', color: 0x38bdf8, maxHp: 28 },
        88:  { name: '👑 ARQUITECTO DEL PORTAL MK-XI', color: 0x00e5ff, maxHp: 28 },
        96:  { name: '👑 EMPERADOR DE LA PIROTECNIA', color: 0xff3d00, maxHp: 30 },
        104: { name: '👑 LEVIATÁN DEL CENTURIÓN', color: 0x40c4ff, maxHp: 32 },
        112: { name: '👑 SOBERANO CIBERNÉTICO DE TOKIO', color: 0xf50057, maxHp: 34 },
        120: { name: '👑 OMEGA PRIME: COMANDANTE SUPREMO', color: 0xffd700, maxHp: 36 },
        128: { name: '👑 CRIO-LEVIATÁN ZERO-K', color: 0x00e5ff, maxHp: 38 },
        136: { name: '👑 AEGIS MÉDICO IMPERIAL', color: 0x00e676, maxHp: 40 },
        144: { name: '👑 SEÑOR DEL ECLIPSE PULSAR', color: 0x7c4dff, maxHp: 42 },
        152: { name: '👑 DRAGÓN SOLAR DE MAGMA', color: 0xff3d00, maxHp: 44 },
        160: { name: '👑 EMPERADOR SUPREMO DEL ARENA 160', color: 0xffd700, maxHp: 48 }
      };
      const bossCfg = BOSS_METADATA[levelIndex] || { name: '👑 MEGATANK JEFE', color: 0xb71c1c, maxHp: 12 };
      const enemies = this.entities.filter(e => e instanceof EnemyTank);
      if (enemies.length > 0) {
        const targetEnemy = enemies[enemies.length - 1];
        const bx = targetEnemy.mesh.position.x;
        const bz = targetEnemy.mesh.position.z;
        this.scene.remove(targetEnemy.mesh);
        targetEnemy.isDead = true;
        targetEnemy.mesh = null;
        this.entities = this.entities.filter(e => e !== targetEnemy);

        const bossTank = new EnemyTank(this.scene, bx, bz, 'boss', bossCfg, this.aiDifficulty);
        this.entities.push(bossTank);
        this.bossEntity = bossTank;
        this.stats.bossInfo = {
          name: bossTank.bossName,
          hp: bossTank.hp,
          maxHp: bossTank.maxHp,
          enraged: false
        };
      }
    }

    this.stats.enemiesLeft = this.entities.filter(e => e instanceof EnemyTank).length;
    this.initialEnemyCount = this.stats.enemiesLeft;
    this.stats.lives = this.playerPerk === 'heavy_armor' ? 4 : 3;
    this.stats.isNightMode = this.isNightStealthActive();
    this.muzzleRevealTimer = 0;
    this.isSpottedByLighthouse = false;
    this.applySceneEnvIntensity(this.currentEnvIntensity !== undefined ? this.currentEnvIntensity : 0.72);
    this.updateLighthousesAndStealth(0.016);
    this.missionStartTime = performance.now();
    this.missionDamageTaken = 0;
    this.isRunning = true;

    if (this.audio && typeof this.audio.startMissionMusic === 'function') {
      this.audio.startMissionMusic({
        level: levelIndex,
        biome: this.currentBiome,
        isBoss: Boolean(this.bossEntity || levelIndex % 8 === 0),
        isStealth: this.isNightStealthActive()
      });
    }

    // Pre-compile scene shaders once on level load so shooting/explosions never stall the frame
    try {
      if (this.renderer && this.scene && this.camera) {
        this.renderer.compile(this.scene, this.camera);
      }
    } catch (_) {}

    this.updateUI();
  }

  cleanup() {
    if (this.winTimeout) {
      clearTimeout(this.winTimeout);
      this.winTimeout = null;
    }
    if (this.deathTimeouts && this.deathTimeouts.length > 0) {
      this.deathTimeouts.forEach(t => clearTimeout(t));
      this.deathTimeouts = [];
    }
    this.isDying = false;
    this.missionOutcome = null;
    this.deathFocusPos = null;
    this.bossEntity = null;
    this.stats.bossInfo = null;
    this.stats.activePowerup = null;

    this.stageLightBoost = 0;
    if (this.input) this.input.resetInputs();

    this.entities.forEach(e => this.scene.remove(e.mesh));
    this.walls.forEach(w => this.scene.remove(w));
    this.destructibles.forEach(d => this.scene.remove(d));
    this.tankBlockers.forEach(t => this.scene.remove(t));
    this.floorTiles.forEach(f => this.scene.remove(f));
    this.projectiles.forEach(p => this.scene.remove(p.mesh));
    this.mines.forEach(m => this.scene.remove(m.mesh));
    this.barrels.forEach(b => this.scene.remove(b));
    this.powerUpCrates.forEach(c => this.scene.remove(c));
    this.boostPads.forEach(p => this.scene.remove(p.mesh));
    this.prisms.forEach(p => this.scene.remove(p));
    this.teleporters.forEach(tp => this.scene.remove(tp.mesh));
    this.laserGates.forEach(lg => {
      this.scene.remove(lg.mesh);
      this.scene.remove(lg.blocker);
    });
    this.laserSwitches.forEach(sw => this.scene.remove(sw.mesh));
    this.cryoBarrels.forEach(cb => this.scene.remove(cb));
    this.repairPads.forEach(rp => this.scene.remove(rp.mesh));
    this.tableProps.forEach(tp => this.scene.remove(tp));
    this.vfx.clear();
    
    this.entities = []; 
    this.walls = []; 
    this.destructibles = []; 
    this.tankBlockers = []; 
    this.floorTiles = []; 
    this.projectiles = [];
    this.mines = [];
    this.lighthouses = [];
    this.barrels = [];
    this.powerUpCrates = [];
    this.boostPads = [];
    this.prisms = [];
    this.teleporters = [];
    this.laserGates = [];
    this.laserSwitches = [];
    this.cryoBarrels = [];
    this.repairPads = [];
    this.tableProps = [];
    this.waterMeshes = [];
    this.waterShaderMat = null;
    this.weatherSystem = null;
    this.fishList = [];
    this.waterLilies = [];
    this.cattails = [];
    
    for(let i = this.scene.children.length - 1; i >= 0; i--) {
        const obj = this.scene.children[i];
        if (!obj.userData.isEnvironment && obj !== this.cursor.mesh && obj !== this.cursor.dots) {
            this.scene.remove(obj);
        }
    }
  }

  spawnProjectile(sourceTank) {
    if (!sourceTank || !sourceTank.mesh) return;

    // Boss Tanks fire Twin Heavy Salvos, or a 3-Way Fan Salvo when Enraged!
    const angles = sourceTank.isBoss
      ? (sourceTank.enraged ? [-0.22, 0, 0.22] : [-0.08, 0.08])
      : [0];

    angles.forEach(offsetAngle => {
      const p = new Projectile(this.scene, sourceTank.mesh.position, sourceTank.turret.rotation.y, sourceTank, offsetAngle);
      if (sourceTank.config && sourceTank.config.bulletSpeed) {
          p.speed = sourceTank.config.bulletSpeed;
          p.velocity.normalize().multiplyScalar(p.speed);
      }
      this.projectiles.push(p);
    });
    
    // Play sound
    this.audio.play('shoot');

    // --- Muzzle Flash & Screen Shake ---
    const barrelOffset = new THREE.Vector3(0, 1.3, 2.8); 
    const totalRotation = sourceTank.mesh.rotation.y + sourceTank.turret.rotation.y;
    barrelOffset.applyAxisAngle(new THREE.Vector3(0,1,0), totalRotation);
    const tipPos = sourceTank.mesh.position.clone().add(barrelOffset);
    
    // Spawn smoke/flash at tip
    this.vfx.spawnMuzzleEffect(tipPos, totalRotation);
    
    // Subtle screen shake on shoot for player + brief muzzle flash reveal in Night Stealth
    if (sourceTank instanceof PlayerTank) {
        this.screenShake = 0.3;
        this.muzzleRevealTimer = 0.65;
    }
  }

  spawnMine(owner) {
      const m = new Mine(this.scene, owner.mesh.position);
      if (owner && owner.perkId === 'ordnance') {
          m.proximityRadius = 4.6;
      }
      this.mines.push(m);
      this.audio.play('mine_drop');
      this.vfx.spawnFloatingText(owner.mesh.position, '💣 MINA ACTIVA', '#ff5252', 0.85);
  }

  spawnBazookaProjectile(sourceTank) {
      if (!sourceTank || !sourceTank.mesh) return;
      const p = new Projectile(this.scene, sourceTank.mesh.position, sourceTank.turret.rotation.y, sourceTank, 0, true);
      this.projectiles.push(p);

      this.audio.play('shoot');
      this.audio.play('explosion');

      const barrelOffset = new THREE.Vector3(0, 1.3, 2.9);
      const totalRotation = sourceTank.mesh.rotation.y + sourceTank.turret.rotation.y;
      barrelOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), totalRotation);
      const tipPos = sourceTank.mesh.position.clone().add(barrelOffset);

      this.vfx.spawnMuzzleEffect(tipPos, totalRotation);
      this.vfx.spawnShockwave(tipPos, 0xff3d00, 3.4);
      this.vfx.spawnFloatingText(sourceTank.mesh.position, '🚀 ¡BAZOCA!', '#ff6d00', 0.95);
      this.screenShake = 0.65;
  }

  triggerBazookaDemolition(pos, primaryWall = null, attackerTank = null) {
      this.audio.play('barrel_explosion');
      this.vfx.spawnScorchDecal(pos, 1.15);
      this.vfx.spawnExplosion(pos, 0xff3d00, 38, 2.3);
      this.vfx.spawnShockwave(pos, 0xff9100, 8.5);
      this.screenShake = Math.max(this.screenShake, 1.05);
      this.hitStopTimer = 0.04;

      if (primaryWall && (!primaryWall.userData || !primaryWall.userData.isBorder)) {
          this.destroyBlock(primaryWall, attackerTank);
      }

      // Demolish any interior obstacle within blast radius (strictly preserving outer arena borders!)
      const blastRadius = 5.0;
      const allBreakables = [...this.walls, ...this.destructibles];
      allBreakables.forEach(w => {
          if (!w || (w.userData && w.userData.isBorder)) return;
          const d = Math.hypot(w.position.x - pos.x, w.position.z - pos.z);
          if (d <= blastRadius) {
              this.destroyBlock(w, attackerTank);
          }
      });

      // Heavy splash damage to enemy tanks in radius
      const enemySplashRadius = 7.5;
      [...this.entities].forEach(entity => {
          if (entity instanceof EnemyTank && entity.mesh) {
              if (entity.mesh.position.distanceTo(pos) <= enemySplashRadius) {
                  this.destroyEntity(entity, 'BAZOOKA');
              }
          }
      });
  }

  triggerMineExplosion(mine) {
      if (!mine || mine.exploded) return;
      mine.exploded = true;
      const pos = mine.mesh.position.clone();
      const radius = (this.player && this.player.perkId === 'ordnance') ? 15.0 : 12.0; 
      
      this.audio.play('big_explosion');
      this.vfx.spawnScorchDecal(pos, 1.25);
      this.vfx.spawnExplosion(pos, 0xff3300, 50, 3.0); 
      this.vfx.spawnShockwave(pos, 0xff8800, radius); 
      this.screenShake = 1.1; 
      this.hitStopTimer = 0.045;
      
      this.scene.remove(mine.mesh);
      this.mines = this.mines.filter(m => m !== mine);

      [...this.entities].forEach(entity => {
          if (entity.mesh && entity.mesh.position.distanceTo(pos) < radius) {
              if (entity instanceof PlayerTank) {
                  this.damagePlayer(1);
              } else {
                  this.destroyEntity(entity, 'MINE');
              }
          }
      });

      // Demolish all interior walls, stone blocks, cork blocks, trees, and obstacles within blast radius (covering full 8-unit adjacent tiles, preserving outer arena borders!)
      const wallBlastRadius = Math.max(10.2, radius * 0.86);
      const allBreakables = [...this.walls, ...this.destructibles];
      allBreakables.forEach(block => {
          if (!block || (block.userData && block.userData.isBorder)) return;
          const d = Math.hypot(block.position.x - pos.x, block.position.z - pos.z);
          if (d <= wallBlastRadius) {
              this.destroyBlock(block, this.player);
          }
      });

      // Explicitly detonate any Explosive Barrels ('B') within extended blast radius (orthogonal & diagonal adjacent tiles!)
      [...this.barrels].forEach(barrel => {
          if (barrel && (!barrel.userData || !barrel.userData.exploded)) {
              const d = Math.hypot(barrel.position.x - pos.x, barrel.position.z - pos.z);
              if (d <= radius + 3.0) {
                  this.triggerBarrelExplosion(barrel);
              }
          }
      });

      // Trigger any Laser Gate Switches ('K') or Prism Pillars ('M') caught in the mine shockwave
      this.laserSwitches.forEach(sw => {
          if (sw && sw.mesh && Math.hypot(sw.mesh.position.x - pos.x, sw.mesh.position.z - pos.z) <= radius) {
              this.toggleLaserGates(sw);
          }
      });
      this.prisms.forEach(prism => {
          if (prism && Math.hypot(prism.position.x - pos.x, prism.position.z - pos.z) <= radius) {
              this.activatePrismLight(prism, 'mine');
          }
      });

      [...this.mines].forEach(otherMine => {
          if (!otherMine.exploded && otherMine.mesh.position.distanceTo(pos) < radius + 2.0) {
              this.triggerMineExplosion(otherMine);
          }
      });
  }

  damagePlayer(amount = 1) {
      // Never damage or kill the player if the mission has already been won!
      if (!this.player || !this.player.mesh || !this.isRunning || this.isDying) return;
      if (this.missionOutcome === 'VICTORY' || this.stats.enemiesLeft <= 0 || this.winTimeout) return;

      const hitResult = this.player.triggerHit();
      if (!hitResult) return; // Ignored if invulnerable
      if (hitResult === 'shield_absorbed') {
          this.audio.play('impact');
          this.vfx.spawnPowerUpBurst(this.player.mesh.position, 0x00E5FF);
          this.vfx.spawnFloatingText(this.player.mesh.position, '🛡️ ¡BLOQUEADO!', '#00e5ff', 1.1);
          this.screenShake = 0.55;
          this.hitStopTimer = 0.04;
          this.stats.activePowerup = null;
          this.updateUI();
          this.onEvent({ type: 'SHIELD_BROKEN' });
          return;
      }

      this.stats.lives = Math.max(0, this.stats.lives - amount);
      this.missionDamageTaken += amount;
      this.comboStreak = 0;
      this.stats.combo = 0;

      if (this.stats.lives <= 0) {
          this.updateUI();
          this.triggerSpectacularPlayerDeath();
          return;
      }

      this.screenShake = 0.95;
      this.hitStopTimer = 0.06;
      this.audio.play('impact');
      this.vfx.spawnExplosion(this.player.mesh.position, 0x0074D9, 18, 0.9);
      this.vfx.spawnFloatingText(this.player.mesh.position, '⚠️ -1 BLINDAJE', '#ff5252', 1.15);
      this.updateUI();
      this.onEvent({ type: 'PLAYER_DAMAGED', data: { lives: this.stats.lives } });
  }

  triggerSpectacularPlayerDeath() {
      if (!this.player || !this.player.mesh || this.isDying) return;
      if (this.missionOutcome === 'VICTORY' || this.stats.enemiesLeft <= 0) return;

      this.missionOutcome = 'DEFEAT';
      if (this.winTimeout) {
          clearTimeout(this.winTimeout);
          this.winTimeout = null;
      }
      this.isDying = true;
      if (this.audio && typeof this.audio.stopCombatMarch === 'function') {
          this.audio.stopCombatMarch();
      }
      if (this.input) this.input.resetInputs();
      this.cursor.setVisible(false);

      const deathPos = this.player.mesh.position.clone();
      this.deathFocusPos = deathPos.clone();

      // Dramatic camera zoom-in onto the doomed tank & heavy shock shake
      this.cameraState.targetZoom = 0.14;
      this.screenShake = 2.4;
      this.hitStopTimer = 0.08;

      // Primary catastrophic blast + flying 3D turret wreckage
      this.audio.play('barrel_explosion');
      this.audio.play('big_explosion');
      this.vfx.spawnCatastrophicTankDestruction(deathPos, 0x0074D9);
      this.vfx.spawnFloatingText(deathPos, '💥 ¡TANQUE DESTRUIDO!', '#ff1744', 1.45);

      // Remove player tank mesh while wreckage and fireballs fly
      this.scene.remove(this.player.mesh);
      this.entities = this.entities.filter(e => e !== this.player);

      // Notify UI immediately to begin cinematic death vignette & slow cross-fade
      this.onEvent({
          type: 'PLAYER_DYING',
          data: { mission: this.stats.mission, score: this.stats.score }
      });

      // Secondary delayed ammunition cook-off explosions
      const t1 = setTimeout(() => {
          if (!this.isDying) return;
          const offset1 = deathPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3.5, 0.6, (Math.random() - 0.5) * 3.5));
          this.audio.play('explosion');
          this.vfx.spawnExplosion(offset1, 0xFF6D00, 32, 2.2);
          this.vfx.spawnShockwave(offset1, 0xFFD600, 14);
          this.screenShake = Math.max(this.screenShake, 1.35);
      }, 280);

      const t2 = setTimeout(() => {
          if (!this.isDying) return;
          const offset2 = deathPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3.0, 0.8, (Math.random() - 0.5) * 3.0));
          this.audio.play('big_explosion');
          this.vfx.spawnExplosion(offset2, 0xFF1744, 28, 2.0);
          this.vfx.spawnShockwave(offset2, 0xFF3D00, 18);
          this.screenShake = Math.max(this.screenShake, 1.1);
      }, 640);

      // Blend smoothly into the Game Over screen as the smoke rises
      const t3 = setTimeout(() => {
          if (!this.isDying) return;
          this.endGame(false);
      }, 1650);

      this.deathTimeouts.push(t1, t2, t3);
  }

  // Instant Tactical Revive (Microtransaction / Gem / Daily Free Revive): Respawns Player Tank in-place with Shield & Shockwave!
  revivePlayer() {
      if (this.deathTimeouts && this.deathTimeouts.length > 0) {
          this.deathTimeouts.forEach(t => clearTimeout(t));
          this.deathTimeouts = [];
      }
      this.isDying = false;
      this.missionOutcome = null;

      const spawnPos = this.deathFocusPos
          ? this.deathFocusPos.clone()
          : (this.playerSpawnPos ? this.playerSpawnPos.clone() : new THREE.Vector3(0, 0, 0));

      // Remove any old player instance
      if (this.player && this.player.mesh) {
          this.scene.remove(this.player.mesh);
      }
      this.entities = this.entities.filter(e => !(e instanceof PlayerTank));

      // Spawn fresh PlayerTank with full armor + Energy Shield + 3.5s Invulnerability
      this.player = new PlayerTank(
          this.scene,
          spawnPos.x,
          spawnPos.z,
          this.input,
          this.playerSkin,
          this.playerPerk,
          this.playerHat,
          this.playerTrail
      );
      this.player.mesh.rotation.y = Math.PI;
      const unlocks = LevelLoader.getUnlockedFeatures(this.stats.mission || 1);
      this.player.mineUnlocked = unlocks.mineUnlocked;
      this.player.bazookaUnlocked = unlocks.bazookaUnlocked;
      this.player.empUnlocked = unlocks.empUnlocked;
      this.player.applyPowerUp('shield');
      this.player.invulnerableTimer = 3.5;
      this.entities.push(this.player);

      // Clear any enemy projectiles within 18 units so player isn't hit immediately
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
          const p = this.projectiles[i];
          if (p.mesh && p.mesh.position.distanceTo(spawnPos) < 18) {
              this.scene.remove(p.mesh);
              this.projectiles.splice(i, 1);
          }
      }

      this.stats.lives = this.playerPerk === 'heavy_armor' ? 4 : 3;
      this.stats.activePowerup = '🛡️ ESCUDO DE REANIMACIÓN ACTIVO';
      this.cameraState.targetZoom = this.cameraState.mode === 'follow' ? 0.05 : 0.9;
      this.screenShake = 0.85;
      this.isRunning = true;
      this.isPaused = false;

      if (this.audio && typeof this.audio.startCombatMarch === 'function' && !this.audio.isMusicMuted) {
          this.audio.startCombatMarch(false);
      }
      this.audio.play('powerup');
      this.audio.play('victory');
      this.vfx.spawnPowerUpBurst(spawnPos, 0xffd700);
      this.vfx.spawnShockwave(spawnPos, 0x00e5ff, 18.0);
      this.vfx.spawnFloatingText(spawnPos, '⚡ ¡BLINDAJE REANIMADO AL 100%!', '#fde047', 1.35);

      this.updateUI();
      return true;
  }

  update(dt) {
    if (this.isPaused) return;

    // --- Always keep ambient GLSL water, weather, fish, nature & VFX particles alive ---
    const time = this.clock.getElapsedTime();
    if (this.waterShaderMat && this.waterShaderMat.uniforms) {
        this.waterShaderMat.uniforms.uTime.value = time;
    }
    this.updateWeather(dt, time);
    this.updateFish(dt, time);
    if (this.waterLilies && this.waterLilies.length > 0) {
        this.waterLilies.forEach(lp => {
            lp.position.y = -1.13 + Math.sin(time * 2.2 + lp.userData.seed) * 0.015;
            lp.rotation.y += dt * 0.08;
        });
    }
    if (this.cattails && this.cattails.length > 0) {
        this.cattails.forEach(ct => {
            ct.rotation.z = Math.sin(time * 1.8 + ct.userData.seed) * 0.05;
        });
    }
    if (this.envRotators && this.envRotators.length > 0) {
        this.envRotators.forEach(r => {
            if (r.axis === 'x') r.mesh.rotation.x += dt * r.speed;
            else if (r.axis === 'z') r.mesh.rotation.z += dt * r.speed;
            else r.mesh.rotation.y += dt * r.speed;
        });
    }

    if (!this.isRunning) {
        // Keep residual explosion debris, smoke plumes, and camera drift alive while Game Over / Menu is open
        this.vfx.update(dt * 0.75);
        if (this.screenShake > 0) {
            this.screenShake = Math.max(0, this.screenShake - dt * 3.0);
        }
        return;
    }

    // Dramatic slow-motion time scale during catastrophic player death sequence
    const effectiveDt = this.isDying ? dt * 0.55 : dt;

    // Micro Hit-Stop Freeze for impactful explosions (VFX and camera still render smoothly)
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      this.vfx.update(dt * 0.35);
      return;
    }

    // Combo Streak Decay Timer
    if (this.comboTimer > 0) {
      this.comboTimer -= effectiveDt;
      if (this.comboTimer <= 0) {
        this.comboStreak = 0;
        if (this.stats.combo !== 0) {
          this.stats.combo = 0;
          this.updateUI();
        }
      }
    }

    if (this.player && !this.isDying) {
      const ready = this.player.mineCooldown <= 0;
      const progress = ready ? 1.0 : Math.max(0, 1 - (this.player.mineCooldown / this.player.maxMineCooldown));

      const bazookaReady = (this.player.bazookaCooldown || 0) <= 0;
      const bazookaProgress = bazookaReady ? 1.0 : Math.max(0, 1 - ((this.player.bazookaCooldown || 0) / (this.player.maxBazookaCooldown || 4.5)));

      const empReady = (this.player.empCooldown || 0) <= 0;
      const empProgress = empReady ? 1.0 : Math.max(0, 1 - ((this.player.empCooldown || 0) / (this.player.maxEmpCooldown || 14.0)));

      // Live sync of active power-up status pill so it NEVER gets stuck when shield/timers expire
      let currentPowerupLabel = null;
      if (this.player.shieldActive) {
        currentPowerupLabel = '🛡️ ESCUDO ENERGÉTICO ACTIVADO';
      } else if (this.player.rapidFireTimer > 0) {
        currentPowerupLabel = `⚡ RÁFAGA RÁPIDA (${Math.ceil(this.player.rapidFireTimer)}s)`;
      } else if (this.player.speedBoostTimer > 0) {
        currentPowerupLabel = `🚀 MOTOR TURBO (${Math.ceil(this.player.speedBoostTimer)}s)`;
      }

      if (
        this.stats.mineReady !== ready ||
        Math.abs((this.stats.mineCooldownProgress || 0) - progress) > 0.06 ||
        this.stats.bazookaReady !== bazookaReady ||
        Math.abs((this.stats.bazookaCooldownProgress || 0) - bazookaProgress) > 0.06 ||
        this.stats.empReady !== empReady ||
        Math.abs((this.stats.empCooldownProgress || 0) - empProgress) > 0.06 ||
        this.stats.activePowerup !== currentPowerupLabel
      ) {
        this.stats.mineReady = ready;
        this.stats.mineCooldownProgress = progress;
        this.stats.bazookaReady = bazookaReady;
        this.stats.bazookaCooldownProgress = bazookaProgress;
        this.stats.empReady = empReady;
        this.stats.empCooldownProgress = empProgress;
        this.stats.activePowerup = currentPowerupLabel;
        this.updateUI();
      }
    }

    this.vfx.update(effectiveDt);
    
    // Dynamic Camera Tracking & Smooth Zooming (Focuses on burning wreck when dying)
    const zoomSpeed = Math.min(1, dt * (this.isDying ? 3.5 : 7.0));
    this.cameraState.zoom += (this.cameraState.targetZoom - this.cameraState.zoom) * zoomSpeed;

    const zoom = this.cameraState.zoom; // 0 = close follow, 1 = full map overview

    const centerLookAt = new THREE.Vector3(0, 0, 3);
    const focusPoint = this.isDying && this.deathFocusPos
        ? new THREE.Vector3(this.deathFocusPos.x, 1.0, this.deathFocusPos.z)
        : (this.player && this.player.mesh) 
            ? new THREE.Vector3(this.player.mesh.position.x, 0.8, this.player.mesh.position.z)
            : centerLookAt;

    // Blend LookAt: close zoom looks directly at player tank / wreck, overview looks at center
    this.cameraState.targetLookAt.lerpVectors(focusPoint, centerLookAt, zoom);

    // Blend Position: close follow is centered on player tank / wreck, overview is elevated at center
    const overviewPos = new THREE.Vector3(0, this.cameraState.overviewHeight, this.cameraState.overviewZ);
    const closePos = new THREE.Vector3(
        focusPoint.x + (this.isDying ? Math.sin(time * 1.4) * 4.5 : 0),
        this.cameraState.minHeight * (this.isDying ? 0.82 : 1.0),
        focusPoint.z + this.cameraState.minZOffset * (this.isDying ? 0.85 : 1.0)
    );
    this.cameraState.targetPos.lerpVectors(closePos, overviewPos, zoom);

    // Smooth camera motion
    const camLerpSpeed = Math.min(1, dt * (this.isDying ? 5.0 : 8.0));
    this.cameraState.currentPos.lerp(this.cameraState.targetPos, camLerpSpeed);
    this.cameraState.currentLookAt.lerp(this.cameraState.targetLookAt, camLerpSpeed);

    // Camera Shake Offset
    const shakeOffset = new THREE.Vector3();
    if (this.screenShake > 0) {
        this.screenShake -= dt * 4.2; 
        if (this.screenShake < 0) this.screenShake = 0;
        const intensity = this.screenShake * 1.6;
        shakeOffset.set(
            (Math.random() - 0.5) * intensity,
            (Math.random() - 0.5) * intensity,
            (Math.random() - 0.5) * intensity
        );
    }

    this.camera.position.copy(this.cameraState.currentPos).add(shakeOffset);
    this.camera.lookAt(this.cameraState.currentLookAt);

    // Keep input raycaster or touch aim vector updated with moving camera & tank
    if (this.input) {
        if (this.input.usingTouchControls && this.player && this.player.mesh) {
            const aimDist = 28;
            const dirX = this.input.lastAimDir ? this.input.lastAimDir.x : 0;
            const dirZ = this.input.lastAimDir ? this.input.lastAimDir.z : -1;
            this.input.mouseWorldPos.set(
                this.player.mesh.position.x + (dirX * aimDist),
                0.5,
                this.player.mesh.position.z + (dirZ * aimDist)
            );
        } else if (!this.input.isTouchDevice && !this.input.usingTouchControls) {
            this.input.updateRaycaster();
        }
    }
    
    if (this.player && this.player.mesh) {
        const isTouchAiming = (this.input.virtualAimStick && this.input.virtualAimStick.active && this.input.virtualAimStick.distance >= 0.18) ||
                              (this.input.bazookaAimStick && this.input.bazookaAimStick.active && this.input.bazookaAimStick.distance >= 0.18);
        const isAiming = !this.input.usingTouchControls || isTouchAiming;
        this.cursor.setVisible(isAiming);
        if (isAiming) {
            this.cursor.update(this.input.getAimPosition(), this.player.mesh.position, this.walls, this.destructibles);
        }
    } else {
        this.cursor.setVisible(false);
    }

    // Update Realistic Wall-Occluded Lighthouse Searchlights & Night Stealth Detection
    this.updateLighthousesAndStealth(effectiveDt);

    // If player is in the middle of the catastrophic death sequence, freeze enemy shooting so camera focuses on the wreck
    if (this.isDying) {
        return;
    }

    // 1. Power-Up Crates (gentle bobbing & hovering rotation; collectible by Player OR Enemy Tanks!)
    this.powerUpCrates.forEach(crate => {
        if (!crate.userData.collected) {
            crate.rotation.y += dt * 1.6;
            crate.position.y = 0.2 + Math.sin(time * 3 + crate.userData.seed) * 0.35;

            if (this.player && this.player.mesh) {
                const dist = this.player.mesh.position.distanceTo(crate.position);
                if (dist < 3.2) {
                    this.collectPowerUp(crate, this.player);
                    return;
                }
            }
            for (const ent of this.entities) {
                if (ent instanceof EnemyTank && !ent.isDead && ent.mesh) {
                    if (ent.mesh.position.distanceTo(crate.position) < 3.2) {
                        this.collectPowerUp(crate, ent);
                        return;
                    }
                }
            }
        }
    });

    // 2. Animate Crystals & Reflectors (Blue Rotating Pillars)
    this.prisms.forEach(prism => {
        const speed = (prism.userData.pulseTimer > 0) ? 3.5 : 1.2;
        if (prism.userData.crystal) {
            prism.userData.crystal.rotation.y += dt * speed;
        }
        if (prism.userData.halo) {
            prism.userData.halo.rotation.z += dt * (speed * 0.8);
        }

        if (prism.userData.pulseTimer > 0) {
            prism.userData.pulseTimer -= dt;
            const progress = Math.max(0, prism.userData.pulseTimer / 5.0);

            if (prism.userData.light) {
                prism.userData.light.intensity = 0.8 + (progress * 7.7);
                prism.userData.light.distance = 35 + (progress * 125);
            }
            if (prism.userData.crystal && prism.userData.crystal.material) {
                prism.userData.crystal.material.emissiveIntensity = 0.8 + (progress * 2.7);
            }
            if (prism.userData.halo && prism.userData.halo.material) {
                prism.userData.halo.material.opacity = 0.35 + (progress * 0.55);
            }
        }

        if (this.player && this.player.mesh) {
            const dist = this.player.mesh.position.distanceTo(prism.position);
            if (dist < 4.2 && (!prism.userData.pulseTimer || prism.userData.pulseTimer < 1.0)) {
                this.activatePrismLight(prism, 'tank');
            }
        }
    });

    // Smooth Progressive Ambient & Nocturnal Lighting Transition
    this.updateLightingTransition(dt);

    // 3. Speed Boost Pads
    this.boostPads.forEach(pad => {
        if (this.player && this.player.mesh) {
            const dist = this.player.mesh.position.distanceTo(pad.position);
            if (dist < 3.4 && pad.cooldown <= 0) {
                pad.cooldown = 0.8;
                this.player.applyBoost(pad.dirX, pad.dirZ, 32);
                this.vfx.spawnPowerUpBurst(pad.position, 0x00FF88);
                this.vfx.spawnFloatingText(pad.position, '🚀 ¡TURBO!', '#00e676', 1.0);
                this.audio.play('boost');
            }
        }
        if (pad.cooldown > 0) pad.cooldown -= dt;
    });

    // 4. Animate Teleporter Portals & Laser Switches
    if (this.teleporters.length >= 2) {
        this.teleporters.forEach((tp, idx) => {
            tp.ringOuter.rotation.z += dt * 1.8;
            tp.ringInner.rotation.z -= dt * 2.8;
            const partner = this.teleporters[(idx + 1) % this.teleporters.length];

            // Check Tank Warp
            this.entities.forEach(ent => {
                if (ent.mesh && (!ent.warpCooldown || ent.warpCooldown <= 0)) {
                    if (ent.mesh.position.distanceTo(tp.position) < 2.5) {
                        ent.warpCooldown = 1.45;
                        ent.mesh.position.set(partner.position.x, ent.mesh.position.y, partner.position.z);
                        this.vfx.spawnShockwave(tp.position, tp.color, 6.0);
                        this.vfx.spawnPowerUpBurst(partner.position, partner.color);
                        this.vfx.spawnFloatingText(partner.position, '🌀 ¡PORTAL!', '#e040fb', 0.95);
                        this.audio.play('boost');
                    }
                }
            });

            // Check Projectile Warp (Trick Shots through Portals!)
            this.projectiles.forEach(proj => {
                if (!proj.isDead && proj.mesh && (!proj.warpCooldown || proj.warpCooldown <= 0)) {
                    const dx = proj.mesh.position.x - tp.position.x;
                    const dz = proj.mesh.position.z - tp.position.z;
                    if (dx * dx + dz * dz < 4.8) {
                        proj.warpCooldown = 0.45;
                        proj.mesh.position.x = partner.position.x;
                        proj.mesh.position.z = partner.position.z;
                        this.vfx.spawnShockwave(partner.position, partner.color, 4.2);
                    }
                }
            });
        });
    }

    this.laserSwitches.forEach(sw => {
        sw.orb.rotation.y += dt * 2.4;
        if (sw.cooldown > 0) sw.cooldown -= dt;
    });

    // 5. Animate Cryogenic EMP Barrels ('F') & Medical Armor Repair Stations ('D')
    this.cryoBarrels.forEach(cb => {
        if (cb && cb.userData && cb.userData.crystal) {
            cb.userData.crystal.rotation.y += dt * 2.5;
            cb.userData.crystal.position.y = 4.35 + Math.sin(time * 3.5) * 0.16;
        }
    });

    this.repairPads.forEach(rpad => {
        if (rpad.crossGroup) {
            rpad.crossGroup.rotation.y += dt * 2.2;
            rpad.crossGroup.position.y = 1.65 + Math.sin(time * 3.0) * 0.2;
            rpad.crossGroup.visible = rpad.cooldown <= 0;
        }
        if (rpad.ringMat) {
            rpad.ringMat.opacity = rpad.cooldown <= 0 ? 0.85 : 0.22;
        }
        if (rpad.cooldown > 0) {
            rpad.cooldown -= dt;
        } else if (this.player && this.player.mesh) {
            const dist = this.player.mesh.position.distanceTo(rpad.position);
            if (dist < 3.4) {
                rpad.cooldown = 16.0;
                this.audio.play('powerup');
                this.vfx.spawnPowerUpBurst(rpad.position, 0x00E676);
                this.vfx.spawnShockwave(rpad.position, 0x69F0AE, 7.0);
                if (this.stats.lives < 4) {
                    this.stats.lives++;
                    this.vfx.spawnFloatingText(rpad.position, '🩹 +1 BLINDAJE REPARADO', '#00e676', 1.15);
                    this.onEvent({
                        type: 'POWERUP_COLLECTED',
                        data: { type: 'life', label: '🩹 ¡ESTACIÓN MÉDICA: +1 BLINDAJE REPARADO!' }
                    });
                } else {
                    this.player.applyPowerUp('speed');
                    this.stats.score += 150;
                    this.vfx.spawnFloatingText(rpad.position, '🩹 ¡SOBRECARGA MÉDICA +150!', '#00e676', 1.1);
                }
                this.updateUI();
            }
        }
    });

    const collisionObstacles = [...this.walls, ...this.destructibles, ...this.tankBlockers];
    const visionObstacles = [...this.walls, ...this.destructibles];
    const stealthContext = {
        isNightStealth: this.isNightStealthActive() || this.lighthouses.length > 0,
        isPlayerStealthed: this.isPlayerStealthed,
        isSpottedByLighthouse: this.isSpottedByLighthouse
    };

    this.entities.forEach(entity => {
        if (!entity.mesh) return;
        
        entity.update(dt, collisionObstacles, visionObstacles, this.entities, stealthContext); 
        
        if (entity.velocity && entity.velocity.lengthSq() > 0.04) {
            this.vfx.spawnTrack(entity.mesh.position, entity.mesh.rotation.y, entity);
            entity.exhaustTimer = (entity.exhaustTimer || 0) + dt;
            if (entity.exhaustTimer > 0.12) {
                entity.exhaustTimer = 0;
                const isBoosted = (entity instanceof PlayerTank && (entity.speedBoostTimer > 0 || entity.boostVelocity.lengthSq() > 1));
                this.vfx.spawnExhaustPuff(entity.mesh.position, entity.mesh.rotation.y, isBoosted);
            }
        }

        if (entity.lockedWeaponAttempt) {
            const lockedType = entity.lockedWeaponAttempt;
            entity.lockedWeaponAttempt = null;
            this.onEvent({
                type: 'WEAPON_LOCKED',
                data: { weapon: lockedType }
            });
        }

        if (entity.needsEmp) {
            this.triggerEmpPulse(entity);
            entity.needsEmp = false;
        }
        if (entity.needsBazooka) {
            this.spawnBazookaProjectile(entity);
            entity.needsBazooka = false;
        }
        if (entity.needsShoot) {
            this.spawnProjectile(entity);
            entity.needsShoot = false;
        }
        if (entity.needsMine) {
            this.spawnMine(entity);
            entity.needsMine = false;
        }
    });

    // Update Mines & Check Proximity Sensor against Enemy Tanks, Explosive Barrels, and Countdown Fuse
    for (let i = this.mines.length - 1; i >= 0; i--) {
        const m = this.mines[i];
        if (!m || !m.mesh) continue;

        // Detect if this mine was placed near an Explosive Barrel ('B') or Cryo Barrel ('F') so it accelerates its fuse and blows the barrel up!
        let nearAnyBarrel = false;
        for (const barrel of this.barrels) {
            if (barrel && (!barrel.userData || !barrel.userData.exploded)) {
                const distToBarrel = Math.hypot(barrel.position.x - m.mesh.position.x, barrel.position.z - m.mesh.position.z);
                if (distToBarrel <= 9.8) {
                    nearAnyBarrel = true;
                    break;
                }
            }
        }
        if (!nearAnyBarrel) {
            for (const cb of this.cryoBarrels) {
                if (cb && (!cb.userData || !cb.userData.exploded)) {
                    const distToCryo = Math.hypot(cb.position.x - m.mesh.position.x, cb.position.z - m.mesh.position.z);
                    if (distToCryo <= 9.8) {
                        nearAnyBarrel = true;
                        break;
                    }
                }
            }
        }
        m.nearBarrel = nearAnyBarrel;

        m.update(dt);
        if (m.armed && !m.exploded) {
            if (m.shouldExplode) {
                this.triggerMineExplosion(m);
                continue;
            }
            for (const entity of this.entities) {
                if (entity instanceof EnemyTank && entity.mesh) {
                    if (entity.mesh.position.distanceTo(m.mesh.position) < m.proximityRadius) {
                        this.triggerMineExplosion(m);
                        break;
                    }
                }
            }
        }
    }

    // Bullet vs Bullet Mid-Air Intercept
    for (let i = 0; i < this.projectiles.length; i++) {
        const p1 = this.projectiles[i];
        if (!p1 || p1.isDead || !p1.mesh) continue;
        
        for (let j = i + 1; j < this.projectiles.length; j++) {
            const p2 = this.projectiles[j];
            if (!p2 || p2.isDead || !p2.mesh) continue;

            const dist = p1.mesh.position.distanceTo(p2.mesh.position);
            
            if (dist < 0.85) { 
                p1.isDead = true;
                p2.isDead = true;
                const mid = p1.mesh.position.clone().add(p2.mesh.position).multiplyScalar(0.5);
                this.audio.play('impact');
                this.vfx.spawnExplosion(mid, 0xffd54f, 14, 0.6);
                this.vfx.spawnShockwave(mid, 0x00e5ff, 3.5);
                this.vfx.spawnFloatingText(mid, '⚔️ ¡INTERCEPTADO! +25', '#80d8ff', 0.85);
                this.stats.score += 25;
                this.updateUI();
            }
        }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        if (!p) continue;

        if (p.isDead) {
            if (p.mesh) this.scene.remove(p.mesh);
            this.projectiles.splice(i, 1);
            continue;
        }

        // Spawn glowing plasma tracer trail behind moving bullets
        p.trailTimer = (p.trailTimer || 0) + dt;
        if (p.trailTimer >= (p.isBazooka ? 0.016 : 0.025)) {
            p.trailTimer = 0;
            this.vfx.spawnBulletTrail(p.mesh.position, p.isPlayerBullet, p.isBazooka, p.trailId);
        }

        // Pass audio bounce callback and check for prism illumination
        const alive = p.update(dt, this.walls, this.destructibles, this.entities, this.mines, (hitObj, hitPoint) => {
            this.audio.play('impact');
            this.vfx.spawnRicochetSpark(hitPoint || p.mesh.position);
            if (hitObj) this.checkPrismHit(hitObj, hitPoint);
        });
        
        if (!alive) {
            this.scene.remove(p.mesh);
            this.projectiles.splice(i, 1);
            
            if (p.isBazooka) {
                if (p.hitTarget && p.hitTarget.mesh) {
                    if (p.hitTarget instanceof EnemyTank) {
                        this.destroyEntity(p.hitTarget, 'BAZOOKA');
                    } else if (p.hitTarget instanceof PlayerTank) {
                        this.damagePlayer(1);
                    }
                }
                if (p.hitMine) {
                    this.triggerMineExplosion(p.hitMine);
                }
                this.triggerBazookaDemolition(p.mesh.position, p.hitWallToDemolish || p.hitDestructible, p.owner);
            } else if (p.hitTarget && p.hitTarget.mesh) {
                if (p.hitTarget instanceof EnemyTank) {
                   const wasRicochet = p.bounces > 0;
                   this.destroyEntity(p.hitTarget, wasRicochet ? 'RICOCHET' : 'DIRECT');
                } else if (p.hitTarget instanceof PlayerTank) {
                   this.damagePlayer(1);
                }
                this.vfx.spawnExplosion(p.mesh.position, 0xffff00, 6, 0.35);
            } else if (p.hitDestructible) {
                this.destroyBlock(p.hitDestructible, p.owner);
            } else if (p.hitMine) {
                this.triggerMineExplosion(p.hitMine);
            } else {
                if (p.hitObstacle) {
                    this.checkPrismHit(p.hitObstacle, p.mesh.position);
                }
                this.vfx.spawnExplosion(p.mesh.position, 0xffaa00, 4, 0.15);
            }
        }
    }
  }

  destroyBlock(block, attackerTank = null) {
      if (!block || (block.userData && block.userData.isBorder)) return;
      if (block.userData && block.userData.type === 'barrel') {
          this.triggerBarrelExplosion(block);
          return;
      }
      if (block.userData && block.userData.type === 'cryo_barrel') {
          this.triggerCryoBarrelExplosion(block);
          return;
      }
      if (block.userData && block.userData.type === 'powerup') {
          const collector = (attackerTank && !attackerTank.isDead && attackerTank.mesh) ? attackerTank : this.player;
          this.collectPowerUp(block, collector);
          return;
      }

      const pos = block.position.clone();
      
      let color = 0xd7a876;
      if (block.userData && block.userData.type === 'cork') color = 0xd7a876; 
      else if (block.userData && block.userData.type === 'stone') color = 0x888888;
      else if (block.userData && block.userData.type === 'wall') color = 0xb86522;
      else if (block.userData && block.userData.type === 'lighthouse') color = 0xef4444;
      else if (block.userData && block.userData.type === 'tree') color = 0x22c55e;
      
      this.audio.play('explosion');
      this.vfx.spawnExplosion(pos, color, 20, 1.15);
      if (block.userData) block.userData.bounds = null;
      this.scene.remove(block);
      this.destructibles = this.destructibles.filter(b => b !== block);
      this.walls = this.walls.filter(w => w !== block);
      this.tankBlockers = this.tankBlockers.filter(t => t !== block);
      this.lighthouses = this.lighthouses.filter(lh => lh.group !== block);
      this.prisms = this.prisms.filter(pr => pr !== block);
  }

  triggerBarrelExplosion(barrel) {
      if (!barrel || barrel.userData.exploded) return;
      barrel.userData.exploded = true;
      if (barrel.userData) barrel.userData.bounds = null;

      const pos = barrel.position.clone();
      this.vfx.spawnBarrelDebris(pos);
      this.vfx.spawnScorchDecal(pos, 1.3);
      this.vfx.spawnFloatingText(pos, '💥 ¡BOOM!', '#ff6d00', 1.25);
      this.audio.play('barrel_explosion');
      this.screenShake = 1.45;
      this.hitStopTimer = 0.055;

      this.scene.remove(barrel);
      this.destructibles = this.destructibles.filter(b => b !== barrel);
      this.walls = this.walls.filter(w => w !== barrel);
      this.barrels = this.barrels.filter(b => b !== barrel);

      const radius = 12.5;

      if (this.player && this.player.mesh && this.player.mesh.position.distanceTo(pos) < radius) {
          this.damagePlayer(1);
      }

      [...this.entities].forEach(entity => {
          if (entity && entity.mesh && entity !== this.player) {
              if (entity.mesh.position.distanceTo(pos) < radius) {
                  this.destroyEntity(entity, 'BARREL');
              }
          }
      });

      // Demolish adjacent interior walls, cork crates, stone blocks, and obstacles (preserving outer border walls!)
      const wallBlastRadius = 9.8;
      const allBreakables = [...this.walls, ...this.destructibles];
      allBreakables.forEach(block => {
          if (!block || block === barrel || (block.userData && block.userData.isBorder)) return;
          if (block.userData && block.userData.type === 'barrel') return;
          const d = Math.hypot(block.position.x - pos.x, block.position.z - pos.z);
          if (d <= wallBlastRadius) {
              this.destroyBlock(block, this.player);
          }
      });

      // Chain-detonate any nearby Mines!
      [...this.mines].forEach(mine => {
          if (mine && !mine.exploded && mine.mesh) {
              const d = Math.hypot(mine.mesh.position.x - pos.x, mine.mesh.position.z - pos.z);
              if (d <= radius + 3.0) {
                  this.triggerMineExplosion(mine);
              }
          }
      });

      // Trigger any Laser Gate Switches ('K') or Prism Pillars ('M') in the barrel blast
      this.laserSwitches.forEach(sw => {
          if (sw && sw.mesh && Math.hypot(sw.mesh.position.x - pos.x, sw.mesh.position.z - pos.z) <= radius) {
              this.toggleLaserGates(sw);
          }
      });
      this.prisms.forEach(prism => {
          if (prism && Math.hypot(prism.position.x - pos.x, prism.position.z - pos.z) <= radius) {
              this.activatePrismLight(prism, 'barrel');
          }
      });

      [...this.barrels].forEach(otherBarrel => {
          if (otherBarrel !== barrel && otherBarrel.userData && !otherBarrel.userData.exploded) {
              const d = otherBarrel.position.distanceTo(pos);
              if (d < radius + 3.5) {
                  setTimeout(() => {
                      if (this.isRunning && !this.isPaused) {
                          this.triggerBarrelExplosion(otherBarrel);
                      }
                  }, 105);
              }
          }
      });

      [...this.cryoBarrels].forEach(cb => {
          if (cb && cb.userData && !cb.userData.exploded) {
              const d = cb.position.distanceTo(pos);
              if (d < radius + 3.5) {
                  this.triggerCryoBarrelExplosion(cb);
              }
          }
      });
  }

  triggerCryoBarrelExplosion(barrel) {
      if (!barrel || barrel.userData.exploded) return;
      barrel.userData.exploded = true;
      if (barrel.userData) barrel.userData.bounds = null;

      const pos = barrel.position.clone();
      this.vfx.spawnExplosion(pos, 0x00E5FF, 36, 2.2);
      this.vfx.spawnShockwave(pos, 0x80D8FF, 15.5);
      this.vfx.spawnPowerUpBurst(pos, 0x00B0FF);
      this.vfx.spawnFloatingText(pos, '❄️ ¡ONDA CRIOGÉNICA!', '#00e5ff', 1.25);
      this.audio.play('barrel_explosion');
      this.audio.play('powerup');
      this.screenShake = 1.15;
      this.hitStopTimer = 0.045;

      this.scene.remove(barrel);
      this.destructibles = this.destructibles.filter(b => b !== barrel);
      this.walls = this.walls.filter(w => w !== barrel);
      this.cryoBarrels = this.cryoBarrels.filter(b => b !== barrel);

      const freezeRadius = 15.5;
      let frozenCount = 0;
      this.entities.forEach(entity => {
          if (entity instanceof EnemyTank && !entity.isDead && entity.mesh) {
              if (entity.mesh.position.distanceTo(pos) <= freezeRadius) {
                  if (typeof entity.applyFreeze === 'function') {
                      entity.applyFreeze(5.0);
                      frozenCount++;
                  }
              }
          }
      });

      // Short-circuit any nearby Laser Gates / Switches
      this.laserSwitches.forEach(sw => {
          if (sw && sw.mesh && Math.hypot(sw.mesh.position.x - pos.x, sw.mesh.position.z - pos.z) <= freezeRadius) {
              this.toggleLaserGates(sw);
          }
      });

      // Chain-detonate other Cryo Barrels in radius
      [...this.cryoBarrels].forEach(other => {
          if (other !== barrel && other.userData && !other.userData.exploded) {
              if (other.position.distanceTo(pos) < freezeRadius) {
                  setTimeout(() => {
                      if (this.isRunning && !this.isPaused) {
                          this.triggerCryoBarrelExplosion(other);
                      }
                  }, 110);
              }
          }
      });

      if (frozenCount > 0) {
          this.stats.score += frozenCount * 75;
          this.updateUI();
      }
  }

  triggerEmpPulse(sourceTank) {
      if (!sourceTank || !sourceTank.mesh) return;
      const pos = sourceTank.mesh.position.clone();
      const empRadius = 26.0;

      this.audio.play('powerup');
      this.audio.play('big_explosion');
      this.vfx.spawnShockwave(pos, 0x00E5FF, empRadius);
      this.vfx.spawnPowerUpBurst(pos, 0x80D8FF);
      this.vfx.spawnFloatingText(pos, '⚡ ¡PULSO EMP ORBITAL!', '#00e5ff', 1.25);
      this.screenShake = Math.max(this.screenShake, 0.95);

      // 1. Vaporize all enemy projectiles in mid-air!
      let vaporizedBullets = 0;
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
          const p = this.projectiles[i];
          if (p && !p.isDead && !p.isPlayerBullet && p.mesh) {
              if (p.mesh.position.distanceTo(pos) <= empRadius) {
                  this.vfx.spawnExplosion(p.mesh.position, 0x00E5FF, 10, 0.45);
                  this.scene.remove(p.mesh);
                  this.projectiles.splice(i, 1);
                  vaporizedBullets++;
              }
          }
      }

      // 2. Paralyze & freeze all enemy tanks within EMP radius for 3.8s + strip enemy energy shields!
      let stunnedEnemies = 0;
      this.entities.forEach(ent => {
          if (ent instanceof EnemyTank && !ent.isDead && ent.mesh) {
              if (ent.mesh.position.distanceTo(pos) <= empRadius) {
                  if (ent.shieldActive) {
                      ent.shieldActive = false;
                      if (ent.shieldMesh) ent.shieldMesh.visible = false;
                  }
                  if (typeof ent.applyFreeze === 'function') {
                      ent.applyFreeze(3.8);
                      stunnedEnemies++;
                  }
              }
          }
      });

      // 3. Toggle Laser Gates if any exist on the map
      if (this.laserSwitches.length > 0) {
          this.toggleLaserGates(this.laserSwitches[0]);
      }

      // 4. Detonate nearby Cryogenic Barrels
      [...this.cryoBarrels].forEach(cb => {
          if (cb && cb.userData && !cb.userData.exploded && cb.position.distanceTo(pos) <= empRadius) {
              this.triggerCryoBarrelExplosion(cb);
          }
      });

      const bonusPts = vaporizedBullets * 25 + stunnedEnemies * 50;
      if (bonusPts > 0) {
          this.stats.score += bonusPts;
      }
      this.stats.empReady = false;
      this.stats.empCooldownProgress = 0;
      this.updateUI();
  }

  collectPowerUp(crate, tank) {
      if (!crate || crate.userData.collected) return;
      crate.userData.collected = true;
      if (crate.userData) crate.userData.bounds = null;

      const pos = crate.position.clone();
      const isEnemyCollector = (tank instanceof EnemyTank);

      this.scene.remove(crate);
      this.destructibles = this.destructibles.filter(b => b !== crate);
      this.walls = this.walls.filter(w => w !== crate);
      this.powerUpCrates = this.powerUpCrates.filter(c => c !== crate);

      const rand = Math.random();

      // If an Enemy Tank shot or drove into the Power-Up Crate, the ENEMY gets the advantage!
      if (isEnemyCollector) {
          this.vfx.spawnPowerUpBurst(pos, 0xFF1744);
          if (tank.mesh) {
              this.vfx.spawnPowerUpBurst(tank.mesh.position, 0xFF1744);
              this.vfx.spawnShockwave(tank.mesh.position, 0xFF1744, 5.0);
          }
          this.audio.play('boost');
          this.audio.play('impact');

          let eType = 'shield';
          let eFloat = '⚠️ ¡ENEMIGO CON ESCUDO!';
          let eToast = '⚠️ ¡EL ENEMIGO HA ROBADO UN ESCUDO ENERGÉTICO!';

          if (rand < 0.38) {
              eType = 'shield';
              eFloat = '🛡️ ¡ENEMIGO CON ESCUDO!';
              eToast = '⚠️ ¡EL ENEMIGO DISPARÓ A LA CAJA Y OBTUVO ESCUDO!';
          } else if (rand < 0.72) {
              eType = 'rapid';
              eFloat = '⚡ ¡ENEMIGO CON RÁFAGA!';
              eToast = '⚠️ ¡EL ENEMIGO ROBÓ LA CAJA: RÁFAGA RÁPIDA ENEMIGA!';
          } else if (rand < 0.90) {
              eType = 'speed';
              eFloat = '🚀 ¡ENEMIGO TURBO!';
              eToast = '⚠️ ¡EL ENEMIGO ROBÓ LA CAJA: MOTOR TURBO ENEMIGO!';
          } else {
              eType = 'life';
              eFloat = '🛡️ ¡ENEMIGO REFORZADO!';
              eToast = '⚠️ ¡EL ENEMIGO ROBÓ LA CAJA: BLINDAJE EXTRA ENEMIGO!';
          }

          if (typeof tank.applyPowerUp === 'function') {
              tank.applyPowerUp(eType);
          }
          if (tank.isBoss && eType === 'life') {
              this.stats.bossInfo = {
                  name: tank.bossName,
                  hp: tank.hp,
                  maxHp: tank.maxHp,
                  enraged: tank.enraged
              };
              this.updateUI();
          }

          const textPos = (tank.mesh && tank.mesh.position) ? tank.mesh.position : pos;
          this.vfx.spawnFloatingText(textPos, eFloat, '#ff5252', 1.18);
          this.onEvent({
              type: 'POWERUP_COLLECTED',
              data: { type: 'enemy_stolen', label: eToast, isEnemy: true }
          });
          return;
      }

      this.vfx.spawnPowerUpBurst(pos, 0x00E5FF);
      this.audio.play('powerup');

      let pType = 'shield';
      let pLabel = '🛡️ ESCUDO ENERGÉTICO ACTIVADO';
      let floatText = '🛡️ +ESCUDO';
      let floatColor = '#00e5ff';

      if (rand < 0.35) {
          pType = 'shield';
          pLabel = '🛡️ ESCUDO ENERGÉTICO ACTIVADO';
          floatText = '🛡️ +ESCUDO';
          floatColor = '#00e5ff';
          if (this.player) this.player.applyPowerUp('shield');
      } else if (rand < 0.70) {
          pType = 'rapid';
          pLabel = '⚡ RÁFAGA RÁPIDA (8s)';
          floatText = '⚡ ¡RÁFAGA RÁPIDA!';
          floatColor = '#ffeb3b';
          if (this.player) this.player.applyPowerUp('rapid');
      } else if (rand < 0.88) {
          pType = 'speed';
          pLabel = '🚀 MOTOR TURBO (6.5s)';
          floatText = '🚀 ¡SUPER VELOCIDAD!';
          floatColor = '#00e676';
          if (this.player) this.player.applyPowerUp('speed');
      } else {
          pType = 'life';
          pLabel = '❤️ ¡VIDA EXTRA RECUPERADA!';
          floatText = '❤️ +1 BLINDAJE';
          floatColor = '#ff4081';
          if (this.stats.lives < 4) {
              this.stats.lives++;
          }
      }

      this.vfx.spawnFloatingText(pos, floatText, floatColor, 1.15);
      this.stats.score += 200;
      this.stats.activePowerup = pLabel;
      this.updateUI();
      this.onEvent({
          type: 'POWERUP_COLLECTED',
          data: { type: pType, label: pLabel }
      });
  }

  destroyEntity(entity, killMethod = 'DIRECT') {
      if (!entity.mesh) return;
      
      const pos = entity.mesh.position.clone();
      const color = entity.color || 0xff0000;

      // Stolen Enemy Energy Shield Absorbs 1 Hit!
      if (entity instanceof EnemyTank && entity.shieldActive) {
          entity.shieldActive = false;
          if (entity.shieldMesh) entity.shieldMesh.visible = false;
          entity.hitFlashTimer = 0.25;
          this.audio.play('impact');
          this.vfx.spawnPowerUpBurst(pos, 0xFF1744);
          this.vfx.spawnShockwave(pos, 0xFF5252, 4.5);
          this.vfx.spawnFloatingText(pos, '🛡️ ¡ESCUDO ENEMIGO ROTO!', '#ff5252', 1.12);
          this.screenShake = Math.max(this.screenShake, 0.45);
          return;
      }

      // Multi-HP Boss Tank Damage Handling (Punto 1)
      if (entity.isBoss && entity.hp > 0) {
          const dmg = (killMethod === 'MINE' || killMethod === 'BARREL') ? 3 : 1;
          const wasEnraged = entity.enraged;
          const died = entity.takeBossDamage(dmg);
          this.stats.bossInfo = {
              name: entity.bossName,
              hp: entity.hp,
              maxHp: entity.maxHp,
              enraged: entity.enraged
          };

          if (!died) {
              this.audio.play('explosion');
              this.vfx.spawnExplosion(pos, 0xffab00, 18, 1.1);
              this.vfx.spawnShockwave(pos, entity.enraged ? 0xff1744 : 0xffca28, 5.0);
              this.screenShake = Math.max(this.screenShake, 0.55);
              if (!wasEnraged && entity.enraged) {
                  this.vfx.spawnFloatingText(pos, '🔥 ¡JEFE ENFURECIDO!', '#ff1744', 1.3);
              } else {
                  this.vfx.spawnFloatingText(pos, `💥 -${dmg} BLINDAJE (${entity.hp}/${entity.maxHp})`, '#ffca28', 1.05);
              }
              this.updateUI();
              return;
          }
      }

      this.audio.play('big_explosion');
      if (entity.isBoss) {
          this.vfx.spawnCatastrophicTankDestruction(pos, color);
          this.stats.bossInfo = null;
      } else {
          this.vfx.spawnExplosion(pos, color, 34, 1.6);
          this.vfx.spawnShockwave(pos, color, 6.5);
          this.vfx.spawnDeathMark(pos);
      }
      this.screenShake = Math.max(this.screenShake, entity.isBoss ? 1.8 : 0.75);
      this.hitStopTimer = entity.isBoss ? 0.08 : 0.045;

      const deadMesh = entity.mesh;
      entity.isDead = true;
      entity.mesh = null;
      if (deadMesh) {
          this.scene.remove(deadMesh);
      }
      this.entities = this.entities.filter(e => e !== entity && !e.isDead && e.mesh);
      if (entity instanceof EnemyTank) {
          this.stats.enemiesLeft--;

          // Calculate Combo Multiplier & Style Bonus
          this.comboStreak++;
          this.comboTimer = 4.5; // 4.5 seconds window to chain next kill
          this.stats.combo = this.comboStreak;

          let basePts = entity.isBoss ? 1000 : 100;
          if (!entity.isBoss) {
              if (killMethod === 'RICOCHET') basePts = 150;
              else if (killMethod === 'BARREL' || killMethod === 'MINE') basePts = 150;
          }

          // Stealth Ambush Bonus: Reward eliminating enemies from the shadows or before they spot the player!
          const isStealthAmbush = (this.isNightStealthActive() || this.lighthouses.length > 0) &&
              !this.isSpottedByLighthouse &&
              (this.isPlayerStealthed || !entity.wasAlertedToPlayer);
          const stealthBonusPts = isStealthAmbush ? 150 : 0;

          const multiplier = entity.isBoss ? 1 : Math.min(this.comboStreak, 5);
          const totalPts = (basePts * multiplier) + stealthBonusPts;
          this.stats.score += totalPts;

          // Instant Tactical Recharge Reward on Stealth Kill (+35% Mine & Bazooka Cooldown)
          if (isStealthAmbush && this.player) {
              if (this.player.mineCooldown > 0) {
                  this.player.mineCooldown = Math.max(0, this.player.mineCooldown - this.player.maxMineCooldown * 0.35);
              }
              if (this.player.bazookaCooldown > 0) {
                  this.player.bazookaCooldown = Math.max(0, this.player.bazookaCooldown - this.player.maxBazookaCooldown * 0.35);
              }
          }

          // Spawn Floating 3D Score & Style Banner
          let popLabel = entity.isBoss ? `👑 ¡JEFE ABATIDO! +${totalPts}` : `+${totalPts}`;
          let popColor = entity.isBoss ? '#ffd700' : '#ffeb3b';
          if (!entity.isBoss && isStealthAmbush) {
              popLabel = `🥷 ¡GOLPE DE SIGILO! +${totalPts}`;
              popColor = '#38bdf8';
          } else if (!entity.isBoss && killMethod === 'RICOCHET') {
              popLabel = `🎯 ¡REBOTE! +${totalPts}`;
              popColor = '#00e5ff';
          } else if (!entity.isBoss && this.comboStreak >= 2) {
              popLabel = `🔥 COMBO x${this.comboStreak}! +${totalPts}`;
              popColor = '#ff9100';
              this.audio.play('combo', this.comboStreak);
          }

          this.vfx.spawnFloatingText(pos, popLabel, popColor, entity.isBoss ? 1.4 : ((isStealthAmbush || this.comboStreak >= 2) ? 1.22 : 1.0));
          this.onEvent({
              type: 'ENEMY_DESTROYED',
              data: { combo: this.comboStreak, points: totalPts, method: isStealthAmbush ? 'STEALTH' : killMethod }
          });

          this.updateUI();
          if (this.stats.enemiesLeft === 1 && (this.initialEnemyCount || 0) > 1 && !this.bossEntity) {
              if (this.audio && typeof this.audio.setDangerState === 'function') {
                  this.audio.setDangerState(true);
              }
          }
          if (this.stats.enemiesLeft <= 0 && !this.isDying && this.missionOutcome !== 'DEFEAT') {
              this.missionOutcome = 'VICTORY';
              // Immediately make the player invulnerable and disarm all in-flight projectiles & mines so a stray bullet can NEVER kill the player after winning!
              if (this.player) {
                  this.player.invulnerableTimer = 15.0;
              }
              for (let i = this.projectiles.length - 1; i >= 0; i--) {
                  const remP = this.projectiles[i];
                  if (remP && remP.mesh) {
                      this.vfx.spawnExplosion(remP.mesh.position, 0x00e5ff, 4, 0.15);
                      this.scene.remove(remP.mesh);
                  }
              }
              this.projectiles = [];
              for (let i = this.mines.length - 1; i >= 0; i--) {
                  const remM = this.mines[i];
                  if (remM && remM.mesh) {
                      this.scene.remove(remM.mesh);
                  }
              }
              this.mines = [];

              if (this.audio && typeof this.audio.stopCombatMarch === 'function') {
                  this.audio.stopCombatMarch();
              }
              this.audio.play('victory');
              this.vfx.spawnFloatingText(
                  this.player && this.player.mesh ? this.player.mesh.position : pos,
                  '🏆 ¡MISIÓN CUMPLIDA!',
                  '#00e676',
                  1.35
              );
              if (this.winTimeout) clearTimeout(this.winTimeout);
              this.winTimeout = setTimeout(() => {
                  if (this.isRunning && this.missionOutcome === 'VICTORY') {
                      this.endGame(true);
                  }
              }, 1350);
          }
      }
  }

  endGame(won) {
      if (!this.isRunning && this.missionOutcome === 'ENDED') return;
      // Enforce locked outcome so Victory and Defeat can never overwrite each other
      if (this.missionOutcome === 'VICTORY' && !won) return;
      if (this.missionOutcome === 'DEFEAT' && won) return;

      this.isRunning = false;
      this.missionOutcome = 'ENDED';
      if (this.winTimeout) {
          clearTimeout(this.winTimeout);
          this.winTimeout = null;
      }
      if (this.deathTimeouts && this.deathTimeouts.length > 0) {
          this.deathTimeouts.forEach(t => clearTimeout(t));
          this.deathTimeouts = [];
      }

      const elapsedSec = Math.round((performance.now() - (this.missionStartTime || performance.now())) / 1000);
      let starsEarned = 0;
      if (won) {
          starsEarned = 1; // 1 Star: Mission Complete
          if (elapsedSec <= 55 || this.stats.score >= 350) starsEarned++; // 2nd Star: Speed / Tactical Score
          if (this.missionDamageTaken === 0) starsEarned++; // 3rd Star: Flawless Armor (No damage taken)
      }
      this.onEvent({
          type: 'GAME_OVER',
          data: {
              won,
              mission: this.stats.mission,
              starsEarned,
              elapsedSec,
              damageTaken: this.missionDamageTaken
          }
      });
  }

  togglePause() {
      return this.setPause(!this.isPaused);
  }

  setPause(paused) {
      this.isPaused = paused;
      if (this.audio) {
          if (paused) {
              if (typeof this.audio.stopCombatMarch === 'function') {
                  this.audio.stopCombatMarch();
              }
          } else if (this.isRunning && this.audio.musicMode === 'combat' && !this.audio.isMusicMuted) {
              if (typeof this.audio.startCombatMarch === 'function') {
                  this.audio.startCombatMarch(false);
              }
          }
      }
      return this.isPaused;
  }

  startMenuMusic() {
      if (this.audio && typeof this.audio.startMenuMusic === 'function') {
          this.audio.startMenuMusic();
      }
  }

  toggleMute() {
      return this.audio ? this.audio.toggleMute() : false;
  }

  isMuted() {
      return this.audio ? this.audio.isMuted : false;
  }

  toggleMusic() {
      return this.audio ? this.audio.toggleMusic() : false;
  }

  isMusicMuted() {
      return this.audio ? this.audio.isMusicMuted : false;
  }

  setSfxVolume(vol0to1) {
      if (this.audio && typeof this.audio.setSfxVolume === 'function') {
          return this.audio.setSfxVolume(vol0to1);
      }
      return 0.85;
  }

  setMusicVolume(vol0to1) {
      if (this.audio && typeof this.audio.setMusicVolume === 'function') {
          return this.audio.setMusicVolume(vol0to1);
      }
      return 0.35;
  }

  getSfxVolume() {
      return (this.audio && typeof this.audio.getSfxVolume === 'function') ? this.audio.getSfxVolume() : 0.85;
  }

  getMusicVolume() {
      return (this.audio && typeof this.audio.getMusicVolume === 'function') ? this.audio.getMusicVolume() : 0.35;
  }

  // --- Mobile Touch Virtual Controls Delegates ---
  setJoystickInput(x, y, active) {
      if (this.input) this.input.setJoystickInput(x, y, active);
  }

  triggerShoot() {
      if (this.input) this.input.triggerShoot();
  }

  // Brawl Stars Quick-Tap Auto-Aim: Targets nearest enemy or fires ahead
  triggerAutoAimShoot() {
      if (!this.player || !this.player.mesh) {
          this.triggerShoot();
          return;
      }

      let closestEnemy = null;
      let closestDistSq = Infinity;
      const playerPos = this.player.mesh.position;

      for (const entity of this.entities) {
          if (entity instanceof EnemyTank && entity.mesh) {
              const dSq = playerPos.distanceToSquared(entity.mesh.position);
              if (dSq < closestDistSq) {
                  closestDistSq = dSq;
                  closestEnemy = entity;
              }
          }
      }

      if (closestEnemy && closestEnemy.mesh) {
          if (this.input) {
              this.input.mouseWorldPos.set(
                  closestEnemy.mesh.position.x,
                  0.5,
                  closestEnemy.mesh.position.z
              );
              this.input.virtualAim.active = true;
          }
      } else {
          const angle = this.player.mesh.rotation.y + (this.player.turret ? this.player.turret.rotation.y : 0);
          const fwdX = Math.sin(angle);
          const fwdZ = Math.cos(angle);
          if (this.input) {
              this.input.mouseWorldPos.set(
                  playerPos.x + fwdX * 25,
                  0.5,
                  playerPos.z + fwdZ * 25
              );
              this.input.virtualAim.active = true;
          }
      }

      this.triggerShoot();
  }

  setShootHold(holding) {
      if (this.input) this.input.setShootHold(holding);
  }

  triggerMine() {
      if (this.player) {
          const placed = this.player.dropMine();
          if (placed && this.player.needsMine) {
              this.spawnMine(this.player);
              this.player.needsMine = false;
          }
          this.stats.mineReady = this.player.mineCooldown <= 0;
          this.stats.mineCooldownProgress = this.player.mineCooldown <= 0 ? 1.0 : Math.max(0, 1.0 - (this.player.mineCooldown / this.player.maxMineCooldown));
          this.updateUI();
          return placed;
      }
      if (this.input) this.input.triggerMine();
      return false;
  }

  triggerBazooka() {
      if (this.player) {
          // Ensure turret is aligned with current aim position before spawning rocket
          if (this.player.mesh && this.player.turret && this.input) {
              const aimPos = this.input.getAimPosition();
              if (aimPos) {
                  const dx = aimPos.x - this.player.mesh.position.x;
                  const dz = aimPos.z - this.player.mesh.position.z;
                  if (dx * dx + dz * dz > 0.01) {
                      const angle = Math.atan2(dx, dz);
                      this.player.turret.rotation.y = angle - this.player.mesh.rotation.y;
                  }
              }
          }
          const fired = this.player.fireBazooka();
          if (fired && this.player.needsBazooka) {
              this.spawnBazookaProjectile(this.player);
              this.player.needsBazooka = false;
          }
          this.stats.bazookaReady = this.player.bazookaCooldown <= 0;
          this.stats.bazookaCooldownProgress = this.player.bazookaCooldown <= 0 ? 1.0 : Math.max(0, 1.0 - (this.player.bazookaCooldown / this.player.maxBazookaCooldown));
          this.updateUI();
          return fired;
      }
      if (this.input) this.input.triggerBazooka();
      return false;
  }

  triggerEmp() {
      if (this.player) {
          const fired = this.player.fireEmp();
          if (fired && this.player.needsEmp) {
              this.triggerEmpPulse(this.player);
              this.player.needsEmp = false;
          } else if (this.player.lockedWeaponAttempt) {
              const lockedType = this.player.lockedWeaponAttempt;
              this.player.lockedWeaponAttempt = null;
              this.onEvent({
                  type: 'WEAPON_LOCKED',
                  data: { weapon: lockedType }
              });
          }
          this.stats.empReady = this.player.empCooldown <= 0;
          this.stats.empCooldownProgress = this.player.empCooldown <= 0 ? 1.0 : Math.max(0, 1.0 - (this.player.empCooldown / this.player.maxEmpCooldown));
          this.updateUI();
          return fired;
      }
      if (this.input) this.input.triggerEmp();
      return false;
  }

  // Twin-Stick Cannon Aim & Fire
  setAimStickInput(x, y, active, shouldAutoFire = true) {
      const playerPos = (this.player && this.player.mesh) ? this.player.mesh.position : null;
      if (this.input) {
          this.input.setAimStickInput(x, y, active, playerPos, shouldAutoFire);
      }
  }

  // Dedicated Bazooka Drag-to-Aim & Release-to-Fire Stick
  setBazookaStickInput(x, y, active, fireOnRelease = false) {
      const playerPos = (this.player && this.player.mesh) ? this.player.mesh.position : null;
      if (this.input) {
          this.input.setBazookaStickInput(x, y, active, playerPos, fireOnRelease);
          if (!active && fireOnRelease) {
              this.triggerBazooka();
          }
      }
  }

  setTouchAimPosition(clientX, clientY) {
      if (this.input) this.input.setTouchAimPosition(clientX, clientY);
  }

  clearTouchAim() {
      if (this.input) this.input.clearTouchAim();
  }

  // --- Dynamic Camera Zoom & Follow Controls ---
  setZoom(zoom) {
      this.cameraState.targetZoom = Math.max(0.0, Math.min(1.0, zoom));
      this.cameraState.mode = this.cameraState.targetZoom > 0.5 ? 'overview' : 'follow';
      this.stats.zoomLevel = this.cameraState.targetZoom;
      this.stats.cameraMode = this.cameraState.mode;
      this.updateUI();
  }

  adjustZoom(delta) {
      this.setZoom(this.cameraState.targetZoom + delta);
  }

  toggleCameraMode() {
      if (this.cameraState.targetZoom > 0.5) {
          this.setZoom(0.05); // Switch to focused tank follow
      } else {
          this.setZoom(0.95); // Switch to full map overview
      }
      return this.cameraState.mode;
  }

  setCameraMode(mode) {
      if (mode === 'follow') {
          this.setZoom(0.05);
      } else {
          this.setZoom(0.95);
      }
      return this.cameraState.mode;
  }

  getCameraMode() {
      return this.cameraState.mode;
  }

  getZoomLevel() {
      return this.cameraState.targetZoom;
  }

  updateUI() {
      this.onEvent({ 
          type: 'STATS_UPDATE', 
          data: { 
              ...this.stats, 
              isPaused: this.isPaused,
              cameraMode: this.cameraState.mode,
              zoomLevel: this.cameraState.targetZoom
          } 
      });
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    const aspect = window.innerWidth / window.innerHeight;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.updateCameraFraming();
  }

  dispose() { 
    if (this.winTimeout) {
      clearTimeout(this.winTimeout);
      this.winTimeout = null;
    }
    if (this.audio && typeof this.audio.dispose === 'function') {
      this.audio.dispose();
    }
    this.cleanup();
    window.removeEventListener('resize', this.onResize);
  }
}
