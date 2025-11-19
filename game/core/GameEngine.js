
import * as THREE from 'three';
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
    
    this.stats = { score: 0, lives: 3, enemiesLeft: 0, mission: 1 };
    this.isRunning = false;
    this.screenShake = 0;

    this.init();
  }

  init() {
    // 1. Scene & VFX
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x222222); // Darker background to make the table pop
    this.vfx = new VFXManager(this.scene);
    this.cursor = new Cursor(this.scene);
    this.audio = new AudioManager();

    // 2. Camera
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 1, 1000);
    // Adjusted camera position for larger map scale (Zoomed out)
    this.camera.position.set(0, 90, 60); 
    this.camera.lookAt(0, 0, 5);
    this.baseCameraPos = this.camera.position.clone();

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    // 4. Input
    this.input = new InputManager(this.camera, this.canvas);

    // 5. Lighting
    const ambientLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    ambientLight.userData.isEnvironment = true;
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(-30, 80, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.left = -80;
    dirLight.shadow.camera.right = 80;
    dirLight.shadow.camera.top = 80;
    dirLight.shadow.camera.bottom = -80;
    dirLight.userData.isEnvironment = true;
    this.scene.add(dirLight);

    // 6. Environment (The Desk)
    this.createTableEnvironment();

    // 7. Listeners
    window.addEventListener('resize', this.onResize.bind(this));
    this.clock = new THREE.Clock();
    this.animate();
  }
  
  startAudio() {
      this.audio.resume();
  }

  createTableEnvironment() {
    // -- The Table Surface (Kept for holes/pits background) --
    const tableGeo = new THREE.PlaneGeometry(600, 600);
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.rotation.x = -Math.PI / 2;
    table.position.y = -4; // Below the game floor
    table.receiveShadow = true;
    table.userData.isEnvironment = true;
    this.scene.add(table);
  }

  createFloorTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    // Lighter wood for floor tiles
    ctx.fillStyle = '#eedcb3'; ctx.fillRect(0,0,256,256);
    // Subtle grain
    ctx.fillStyle = '#e3cea3';
    for(let i=0; i<500; i++) ctx.fillRect(Math.random()*256, Math.random()*256, 4, 1);
    // Inner bezel look
    ctx.strokeStyle = '#dcc090'; ctx.lineWidth = 4;
    ctx.strokeRect(0,0,256,256);

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

  loadLevel(levelIndex) {
    this.cleanup();

    // CRITICAL FIX: Update the internal mission number to match the requested level
    this.stats.mission = levelIndex;

    const levelData = LevelLoader.getLevel(levelIndex);
    const map = levelData.map;
    
    // INCREASED CELL SIZE FOR MORE SPACIOUS GAMEPLAY
    const cellSize = 8; 
    
    const mapW = map[0].length * cellSize;
    const mapH = map.length * cellSize;
    const offX = mapW / 2;
    const offZ = mapH / 2;

    // Shared Materials & Geometries
    this.floorTex = this.createFloorTexture();
    const floorMat = new THREE.MeshStandardMaterial({ map: this.floorTex, roughness: 0.8 });
    const floorGeo = new THREE.BoxGeometry(cellSize, 1, cellSize); 
    
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.5 });
    
    const corkTex = this.createCorkTexture();
    const corkMat = new THREE.MeshStandardMaterial({ map: corkTex, roughness: 1.0 });
    
    const geomMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.5 }); 
    
    const brickTex = this.createBrickTexture();
    const brickMat = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.7 });
    const brickGeo = new THREE.BoxGeometry(cellSize, 4, cellSize);
    brickGeo.scale(0.96, 1, 0.96);

    const blockGeo = new THREE.BoxGeometry(cellSize, 4, cellSize);
    blockGeo.scale(0.96, 1, 0.96);
    
    const cylGeo = new THREE.CylinderGeometry(cellSize/2.5, cellSize/2.5, 3, 24);
    
    // Triangle (Prism) Geometry
    const triShape = new THREE.Shape();
    triShape.moveTo(-cellSize/2 + 0.5, -cellSize/2 + 0.5);
    triShape.lineTo(cellSize/2 - 0.5, -cellSize/2 + 0.5);
    triShape.lineTo(-cellSize/2 + 0.5, cellSize/2 - 0.5);
    triShape.lineTo(-cellSize/2 + 0.5, -cellSize/2 + 0.5);
    const triGeo = new THREE.ExtrudeGeometry(triShape, { depth: 4, bevelEnabled: false });
    
    // Lighthouse Geometry (Composite)
    const lhBaseGeo = new THREE.CylinderGeometry(2.5, 3, 6, 16);
    const lhTopGeo = new THREE.CylinderGeometry(2, 2.5, 2, 16);
    const lhRoofGeo = new THREE.ConeGeometry(2.5, 2, 16);
    const lhWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const lhRedMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });

    // Tree Geometry ('R')
    const treeTrunkGeo = new THREE.CylinderGeometry(1.0, 1.2, 2.5, 8);
    const treeFoliageGeo = new THREE.ConeGeometry(3.5, 5.5, 8);
    const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1.0 }); // Dark Brown
    const treeFoliageMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.8 }); // Forest Green

    // Borders (The Box Walls)
    const addBorder = (w, d, x, z) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 6, d), woodMat);
        m.position.set(x, 2, z);
        m.castShadow = true; m.receiveShadow = true;
        m.userData = { bounds: new THREE.Box3().setFromObject(m) };
        this.scene.add(m);
        this.walls.push(m); 
    };
    addBorder(mapW+2, 2, 0, -mapH/2 - 1);
    addBorder(mapW+2, 2, 0, mapH/2 + 1);
    addBorder(2, mapH, -mapW/2 - 1, 0);
    addBorder(2, mapH, mapW/2 + 1, 0);

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
            // Hole Logic
            const blocker = new THREE.Mesh(new THREE.BoxGeometry(cellSize, 5, cellSize), new THREE.MeshBasicMaterial({ visible: false }));
            blocker.position.set(x, 2.5, z);
            blocker.userData = { bounds: new THREE.Box3().setFromObject(blocker) };
            this.scene.add(blocker);
            this.tankBlockers.push(blocker);
            continue; 
        }

        // 2. Object Spawning
        if (type === 'P') {
           this.player = new PlayerTank(this.scene, x, z, this.input);
           this.player.mesh.rotation.y = Math.PI;
           this.entities.push(this.player);
        } else if (type === 'W') {
            const m = new THREE.Mesh(blockGeo, woodMat);
            m.position.set(x, 2, z);
            m.castShadow = true; m.receiveShadow = true;
            m.userData = { bounds: new THREE.Box3().setFromObject(m), type: 'wall' };
            this.scene.add(m);
            this.walls.push(m);
        } else if (type === 'C') {
            const m = new THREE.Mesh(blockGeo, corkMat);
            m.position.set(x, 2, z);
            m.castShadow = true; m.receiveShadow = true;
            m.userData = { bounds: new THREE.Box3().setFromObject(m), type: 'cork' };
            this.scene.add(m);
            this.destructibles.push(m);
        } else if (type === 'Y') {
            const m = new THREE.Mesh(cylGeo, geomMat);
            m.position.set(x, 1.5, z);
            m.castShadow = true; m.receiveShadow = true;
            m.userData = { bounds: new THREE.Box3().setFromObject(m), type: 'cyl' };
            this.scene.add(m);
            this.walls.push(m);
        } else if (type === 'S') { // Stone
            const m = new THREE.Mesh(brickGeo, brickMat);
            m.position.set(x, 2, z);
            m.castShadow = true; m.receiveShadow = true;
            m.userData = { bounds: new THREE.Box3().setFromObject(m), type: 'stone' };
            this.scene.add(m);
            this.walls.push(m);
        } else if (type === 'T') { // Triangle Prism
            const m = new THREE.Mesh(triGeo, woodMat);
            // Rotate extrusion to stand upright and face a corner
            m.rotation.x = -Math.PI / 2; 
            m.rotation.z = -Math.PI / 2;
            m.position.set(x + cellSize/2 - 0.5, 0, z - cellSize/2 + 0.5); // Adjust anchor
            m.castShadow = true; m.receiveShadow = true;
            m.userData = { bounds: new THREE.Box3().setFromObject(m), type: 'tri' };
            this.scene.add(m);
            this.walls.push(m);
        } else if (type === 'L') { // Lighthouse
            const grp = new THREE.Group();
            grp.position.set(x, 0, z);
            
            const base = new THREE.Mesh(lhBaseGeo, lhWhiteMat);
            base.position.y = 3;
            base.castShadow = true; base.receiveShadow = true;
            grp.add(base);
            
            const mid = new THREE.Mesh(lhTopGeo, lhRedMat);
            mid.position.y = 7;
            mid.castShadow = true;
            grp.add(mid);

            const roof = new THREE.Mesh(lhRoofGeo, lhRedMat);
            roof.position.y = 9;
            roof.castShadow = true;
            grp.add(roof);

            // -- LIGHTHOUSE EFFECT --
            const lightPivot = new THREE.Group();
            lightPivot.position.y = 8; 
            grp.add(lightPivot);

            const spotLight = new THREE.SpotLight(0xffeeb1, 600, 70, 0.7, 0.5, 1.2); 
            spotLight.position.set(0, 0, 0);
            spotLight.target.position.set(0, -20, 30); // Point down and out
            spotLight.castShadow = true;
            spotLight.shadow.bias = -0.0001;
            lightPivot.add(spotLight);
            lightPivot.add(spotLight.target);

            // Volumetric Beam Fake
            const beamGeo = new THREE.CylinderGeometry(0.5, 8, 35, 32, 1, true);
            beamGeo.rotateX(-Math.PI / 2);
            beamGeo.translate(0, 0, 17.5);
            const beamMat = new THREE.MeshBasicMaterial({
                color: 0xffd700, 
                transparent: true,
                opacity: 0.12,
                side: THREE.DoubleSide,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });
            const beam = new THREE.Mesh(beamGeo, beamMat);
            beam.rotation.x = 0.3; 
            beam.position.z = 1.0; 
            beam.userData = { isEffect: true };
            lightPivot.add(beam);

            const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.8), new THREE.MeshBasicMaterial({ color: 0xffffaa }));
            bulb.userData = { isEffect: true };
            lightPivot.add(bulb);

            this.scene.add(grp);
            this.lighthouses.push({ pivot: lightPivot, speed: 1.2 });

            grp.userData = { bounds: new THREE.Box3().setFromObject(base), type: 'lighthouse' };
            this.walls.push(grp);

        } else if (type === 'R') { // Tree
            const grp = new THREE.Group();
            grp.position.set(x, 0, z);

            const trunk = new THREE.Mesh(treeTrunkGeo, treeTrunkMat);
            trunk.position.y = 1.25;
            trunk.castShadow = true; trunk.receiveShadow = true;
            grp.add(trunk);

            const leaves = new THREE.Mesh(treeFoliageGeo, treeFoliageMat);
            leaves.position.y = 4.5; // Sit on top
            leaves.castShadow = true; leaves.receiveShadow = true;
            grp.add(leaves);

            this.scene.add(grp);
            // Tree collisions are solid (Wall)
            grp.userData = { bounds: new THREE.Box3().setFromObject(trunk), type: 'tree' };
            this.walls.push(grp);
        }
        // -- ENEMIES --
        else if (['E', '1', '2', '3', '4'].includes(type)) {
           let enemyType = 'basic';
           if (type === '1') enemyType = 'static';
           if (type === '2') enemyType = 'basic';
           if (type === '3') enemyType = 'fast';
           if (type === '4') enemyType = 'heavy';
           if (type === 'E') enemyType = 'basic';

           this.entities.push(new EnemyTank(this.scene, x, z, enemyType));
        }
      }
    }

    this.stats.enemiesLeft = this.entities.filter(e => e instanceof EnemyTank).length;
    this.stats.lives = 3;
    this.isRunning = true;
    this.updateUI();
  }

  cleanup() {
    this.entities.forEach(e => this.scene.remove(e.mesh));
    this.walls.forEach(w => this.scene.remove(w));
    this.destructibles.forEach(d => this.scene.remove(d));
    this.tankBlockers.forEach(t => this.scene.remove(t));
    this.floorTiles.forEach(f => this.scene.remove(f));
    this.projectiles.forEach(p => this.scene.remove(p.mesh));
    this.mines.forEach(m => this.scene.remove(m.mesh));
    this.vfx.clear();
    
    this.entities = []; this.walls = []; this.destructibles = []; 
    this.tankBlockers = []; this.floorTiles = []; this.projectiles = [];
    this.mines = [];
    this.lighthouses = [];
    
    for(let i = this.scene.children.length - 1; i >= 0; i--) {
        const obj = this.scene.children[i];
        if (!obj.userData.isEnvironment && obj !== this.cursor.mesh && obj !== this.cursor.dots) {
            this.scene.remove(obj);
        }
    }
  }

  spawnProjectile(sourceTank) {
    if (!sourceTank || !sourceTank.mesh) return;
    const p = new Projectile(this.scene, sourceTank.mesh.position, sourceTank.turret.rotation.y, sourceTank);
    
    // Update projectile speed if it comes from an enemy config
    if (sourceTank.config && sourceTank.config.bulletSpeed) {
        p.speed = sourceTank.config.bulletSpeed;
        p.velocity.normalize().multiplyScalar(p.speed);
    }

    this.projectiles.push(p);
    
    // Play sound
    this.audio.play('shoot');

    // --- Muzzle Flash & Screen Shake ---
    const barrelOffset = new THREE.Vector3(0, 1.3, 2.8); 
    const totalRotation = sourceTank.mesh.rotation.y + sourceTank.turret.rotation.y;
    barrelOffset.applyAxisAngle(new THREE.Vector3(0,1,0), totalRotation);
    const tipPos = sourceTank.mesh.position.clone().add(barrelOffset);
    
    // Spawn smoke/flash at tip
    this.vfx.spawnMuzzleEffect(tipPos, totalRotation);
    
    // Subtle screen shake on shoot for player
    if (sourceTank instanceof PlayerTank) {
        this.screenShake = 0.3; 
    }
  }

  spawnMine(owner) {
      const m = new Mine(this.scene, owner.mesh.position);
      this.mines.push(m);
  }

  triggerMineExplosion(mine) {
      const pos = mine.mesh.position.clone();
      const radius = 10.0; 
      
      this.audio.play('big_explosion');

      this.vfx.spawnExplosion(pos, 0xff3300, 50, 3.0); 
      this.vfx.spawnShockwave(pos, 0xff8800, radius); 
      this.screenShake = 1.0; 
      
      this.scene.remove(mine.mesh);
      this.mines = this.mines.filter(m => m !== mine);

      [...this.entities].forEach(entity => {
          if (entity.mesh && entity.mesh.position.distanceTo(pos) < radius) {
              if (entity instanceof PlayerTank) {
                  this.stats.lives--;
                  if (this.stats.lives <= 0) this.endGame(false);
                  this.updateUI();
              } else {
                  this.destroyEntity(entity);
                  this.stats.score += 50;
              }
          }
      });

      [...this.destructibles].forEach(block => {
           const box = new THREE.Box3().setFromObject(block);
           const center = new THREE.Vector3();
           box.getCenter(center);
           if (center.distanceTo(pos) < radius) {
               this.destroyBlock(block);
           }
      });

      [...this.mines].forEach(otherMine => {
          if (otherMine.mesh.position.distanceTo(pos) < radius * 0.8) {
              this.triggerMineExplosion(otherMine);
          }
      });
  }

  update(dt) {
    if (!this.isRunning) return;

    this.vfx.update(dt);
    
    // Camera Shake Update
    if (this.screenShake > 0) {
        this.screenShake -= dt * 4.0; 
        if (this.screenShake < 0) this.screenShake = 0;
        const intensity = this.screenShake * 1.5;
        this.camera.position.copy(this.baseCameraPos).add(new THREE.Vector3(
            (Math.random() - 0.5) * intensity,
            (Math.random() - 0.5) * intensity,
            (Math.random() - 0.5) * intensity
        ));
    } else {
        this.camera.position.copy(this.baseCameraPos);
    }
    
    if (this.player && this.player.mesh) {
        this.cursor.update(this.input.getAimPosition(), this.player.mesh.position);
    } else {
        this.cursor.update(this.input.getAimPosition(), null);
    }

    this.lighthouses.forEach(lh => {
        lh.pivot.rotation.y -= lh.speed * dt;
    });

    const collisionObstacles = [...this.walls, ...this.destructibles, ...this.tankBlockers];
    const visionObstacles = [...this.walls, ...this.destructibles];

    this.entities.forEach(entity => {
        if (!entity.mesh) return;
        
        entity.update(dt, collisionObstacles, visionObstacles, this.entities); 
        
        if(entity.velocity && entity.velocity.length() > 0.1) {
            this.vfx.spawnTrack(entity.mesh.position, entity.mesh.rotation.y);
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

    this.mines.forEach(m => m.update(dt));

    // Bullet vs Bullet
    for (let i = 0; i < this.projectiles.length; i++) {
        if (this.projectiles[i].isDead) continue;
        
        for (let j = i + 1; j < this.projectiles.length; j++) {
            if (this.projectiles[j].isDead) continue;

            const p1 = this.projectiles[i];
            const p2 = this.projectiles[j];
            const dist = p1.mesh.position.distanceTo(p2.mesh.position);
            
            if (dist < 0.8) { 
                p1.isDead = true;
                p2.isDead = true;
                const mid = p1.mesh.position.clone().add(p2.mesh.position).multiplyScalar(0.5);
                this.vfx.spawnExplosion(mid, 0xffaa00, 12, 0.5);
            }
        }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];

        if (p.isDead) {
            this.scene.remove(p.mesh);
            this.projectiles.splice(i, 1);
            continue;
        }

        // Pass audio bounce callback
        const alive = p.update(dt, this.walls, this.destructibles, this.entities, this.mines, () => this.audio.play('impact'));
        
        if (!alive) {
            this.scene.remove(p.mesh);
            this.projectiles.splice(i, 1);
            
            if (p.hitTarget && p.hitTarget.mesh) {
                // Hit Tank
                if (p.hitTarget instanceof EnemyTank) {
                   this.destroyEntity(p.hitTarget);
                   this.stats.score += 100;
                } else if (p.hitTarget instanceof PlayerTank) {
                    this.stats.lives--;
                    if (this.stats.lives <= 0) this.endGame(false);
                    this.updateUI();
                }
                // Bullet impact flare
                this.vfx.spawnExplosion(p.mesh.position, 0xffff00, 5, 0.3);
            } else if (p.hitDestructible) {
                this.destroyBlock(p.hitDestructible);
            } else if (p.hitMine) {
                this.triggerMineExplosion(p.hitMine);
            } else {
                this.vfx.spawnExplosion(p.mesh.position, 0xffaa00, 3, 0.1);
            }
        }
    }
  }

  destroyBlock(block) {
      const pos = block.position.clone();
      
      // DETERMINE PROPER PARTICLE COLOR
      let color = 0xd7a876; // Default wood/cork color
      if (block.userData.type === 'cork') color = 0xd7a876; 
      else if (block.userData.type === 'stone') color = 0x888888;
      else if (block.userData.type === 'wall') color = 0x8d6e63;
      
      this.audio.play('explosion');
      this.vfx.spawnExplosion(pos, color, 15, 1.0); // More particles
      this.scene.remove(block);
      this.destructibles = this.destructibles.filter(b => b !== block);
  }

  destroyEntity(entity) {
      if (!entity.mesh) return;
      
      // USE TANK COLOR FOR EXPLOSION PARTICLES
      const color = entity.color || 0xff0000;
      this.audio.play('big_explosion');
      this.vfx.spawnExplosion(entity.mesh.position, color, 30, 1.5);
      
      this.vfx.spawnDeathMark(entity.mesh.position);

      this.scene.remove(entity.mesh);
      this.entities = this.entities.filter(e => e !== entity);
      if (entity instanceof EnemyTank) {
          this.stats.enemiesLeft--;
          this.updateUI();
          if (this.stats.enemiesLeft === 0) setTimeout(() => this.endGame(true), 1500);
      }
  }

  endGame(won) {
      this.isRunning = false;
      this.onEvent({ type: 'GAME_OVER', data: { won, mission: this.stats.mission } });
  }

  updateUI() {
      this.onEvent({ type: 'STATS_UPDATE', data: { ...this.stats } });
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.update(dt);
    this.renderer.render(this.scene, this.camera)
  }

  onResize() {
    const aspect = window.innerWidth / window.innerHeight;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  dispose() { 
    window.removeEventListener('resize', this.onResize);
  }
}
