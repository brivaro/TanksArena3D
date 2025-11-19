import * as THREE from 'three';
import { LevelLoader } from './world/LevelLoader.js';
import { PlayerTank } from './entities/PlayerTank.js';
import { EnemyTank } from './entities/EnemyTank.js';
import { Projectile } from './entities/Projectile.js';

export class GameEngine {
  constructor(canvas, onEvent) {
    this.canvas = canvas;
    this.onEvent = onEvent;
    this.entities = [];
    this.walls = [];
    this.projectiles = [];
    
    this.stats = { score: 0, lives: 3, enemiesLeft: 0, mission: 1 };
    this.isRunning = false;

    this.init();
  }

  init() {
    // 1. Setup Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xd0e7f9); // Soft toy-like blue background
    this.scene.fog = new THREE.Fog(0xd0e7f9, 40, 90);

    // 2. Camera (Toy Box Style - High Angle, Centered)
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 65; // Size of the view area
    this.camera = new THREE.OrthographicCamera(
      frustumSize * aspect / -2, 
      frustumSize * aspect / 2, 
      frustumSize / 2, 
      frustumSize / -2, 
      1, 
      1000
    );
    // Position: Centered on X, High up on Y, Tilted back on Z
    this.camera.position.set(0, 60, 45); 
    this.camera.lookAt(0, 0, 5); // Look slightly ahead of center

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; // Better color accuracy

    // 4. Lighting (Studio Setup)
    // Hemisphere Light: Simulates sky/ground reflection for soft shadows
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffeedd, 0.7); 
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    // Directional Light: The "Sun" or main lamp
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(-20, 60, 30);
    dirLight.castShadow = true;
    
    // Shadow properties for crisp but soft edges
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.left = -40;
    dirLight.shadow.camera.right = 40;
    dirLight.shadow.camera.top = 40;
    dirLight.shadow.camera.bottom = -40;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    // 5. Environment
    this.createEnvironment();

    // 6. Inputs
    this.keys = {};
    this.mouse = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.mousePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    window.addEventListener('resize', this.onResize.bind(this));
    window.addEventListener('keydown', (e) => this.keys[e.code] = true);
    window.addEventListener('keyup', (e) => this.keys[e.code] = false);
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('mousedown', this.onMouseDown.bind(this));

    this.clock = new THREE.Clock();
    this.animate();
  }

  createEnvironment() {
    // -- Floor Texture (Procedural Wood Parquet) --
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Base wood color
    ctx.fillStyle = '#e3cca8'; 
    ctx.fillRect(0,0,512,512);
    
    // Wood grain/plank lines
    ctx.strokeStyle = '#d4b895';
    ctx.lineWidth = 2;
    const tileSize = 64;
    
    for(let y=0; y<512; y+=tileSize) {
        for(let x=0; x<512; x+=tileSize) {
            // Randomize slightly to look natural
            ctx.fillStyle = (Math.random() > 0.5) ? '#e3cca8' : '#dec59f';
            ctx.fillRect(x, y, tileSize, tileSize);
            ctx.strokeRect(x, y, tileSize, tileSize);
            
            // Inner grain
            ctx.globalAlpha = 0.1;
            ctx.fillStyle = '#8b5a2b';
            for(let i=0; i<5; i++) {
                ctx.fillRect(x + Math.random()*tileSize, y, 2, tileSize);
            }
            ctx.globalAlpha = 1.0;
        }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    tex.colorSpace = THREE.SRGBColorSpace;

    // Main Floor Plane
    const geo = new THREE.PlaneGeometry(120, 120);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.0 });
    const floor = new THREE.Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // -- The "Toy Box" Walls --
    // Large surrounding walls to make it feel like an enclosed arena
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.9 });
    const wallHeight = 8;
    
    const createWall = (w, d, x, z) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, wallHeight, d), boxMat);
        mesh.position.set(x, wallHeight/2, z);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        this.scene.add(mesh);
    }

    // Assuming arena is roughly 60x40, put walls outside
    createWall(80, 4, 0, -28); // Top
    createWall(80, 4, 0, 28);  // Bottom
    createWall(4, 60, -42, 0); // Left
    createWall(4, 60, 42, 0);  // Right
  }

  loadLevel(levelIndex) {
    // Cleanup
    this.entities.forEach(e => this.scene.remove(e.mesh));
    this.walls.forEach(w => this.scene.remove(w));
    this.projectiles.forEach(p => this.scene.remove(p.mesh));
    this.entities = []; this.walls = []; this.projectiles = [];

    const levelData = LevelLoader.getLevel(levelIndex);
    const map = levelData.map;
    const cellSize = 4;
    const offsetX = (map[0].length * cellSize) / 2;
    const offsetZ = (map.length * cellSize) / 2;

    // Material for destructible/obstacle blocks (Cork/Wood look)
    // Using a slightly different color than floor
    const blockMat = new THREE.MeshStandardMaterial({ 
        color: 0xcd853f, // Peru color (Woody)
        roughness: 0.8 
    });
    const blockGeo = new THREE.BoxGeometry(cellSize, 3, cellSize);
    // Scale down slightly to create gaps between blocks (Toy aesthetics)
    blockGeo.scale(0.92, 1, 0.92);

    for (let row = 0; row < map.length; row++) {
      for (let col = 0; col < map[row].length; col++) {
        const type = map[row][col];
        const x = col * cellSize - offsetX + (cellSize/2);
        const z = row * cellSize - offsetZ + (cellSize/2);

        if (type === 'W') {
          const wall = new THREE.Mesh(blockGeo, blockMat);
          wall.position.set(x, 1.5, z);
          wall.castShadow = true;
          wall.receiveShadow = true;
          wall.userData = { type: 'wall', bounds: new THREE.Box3().setFromObject(wall) };
          this.scene.add(wall);
          this.walls.push(wall);
        } else if (type === 'P') {
          this.player = new PlayerTank(this.scene, x, z);
          this.entities.push(this.player);
        } else if (type === 'E') {
          const enemy = new EnemyTank(this.scene, x, z, 'basic');
          this.entities.push(enemy);
        }
      }
    }

    this.stats.enemiesLeft = this.entities.filter(e => e instanceof EnemyTank).length;
    this.stats.lives = 3;
    this.stats.score = 0;
    this.isRunning = true;
    this.updateUI();
  }

  spawnProjectile(sourceTank) {
    const p = new Projectile(this.scene, sourceTank.mesh.position, sourceTank.turret.rotation.y, sourceTank);
    this.projectiles.push(p);
  }

  update(dt) {
    if (!this.isRunning) return;

    // Logic update
    this.entities.forEach(entity => {
        entity.update(dt, this.keys, this.mouseWorldPos, this.walls, this.entities);
        if (entity.needsShoot) {
            this.spawnProjectile(entity);
            entity.needsShoot = false;
        }
    });

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        const alive = p.update(dt, this.walls, this.entities);
        if (!alive) {
            this.scene.remove(p.mesh);
            this.projectiles.splice(i, 1);
            if (p.hitTarget) {
                if (p.hitTarget instanceof EnemyTank) {
                   this.destroyEntity(p.hitTarget);
                   this.stats.score += 100;
                } else if (p.hitTarget instanceof PlayerTank) {
                    this.stats.lives--;
                    if (this.stats.lives <= 0) this.endGame(false);
                    this.updateUI();
                }
            }
        }
    }
  }

  destroyEntity(entity) {
      this.scene.remove(entity.mesh);
      this.entities = this.entities.filter(e => e !== entity);
      if (entity instanceof EnemyTank) {
          this.stats.enemiesLeft--;
          this.updateUI();
          if (this.stats.enemiesLeft === 0) setTimeout(() => this.endGame(true), 1000);
      }
  }

  endGame(won) {
      this.isRunning = false;
      this.onEvent({ type: 'GAME_OVER', data: { won } });
  }

  updateUI() {
      this.onEvent({ type: 'STATS_UPDATE', data: { ...this.stats } });
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  onMouseMove(e) {
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersect = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.mousePlane, intersect);
    this.mouseWorldPos = intersect;
  }

  onMouseDown(e) {
    if (this.isRunning && this.player) this.player.tryShoot();
  }

  onResize() {
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 65;
    this.camera.left = frustumSize * aspect / -2;
    this.camera.right = frustumSize * aspect / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = frustumSize / -2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  dispose() { }
}