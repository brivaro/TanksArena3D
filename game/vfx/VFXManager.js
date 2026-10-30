import * as THREE from 'three';

const _upAxis = new THREE.Vector3(0, 1, 0);
const _tempDir = new THREE.Vector3();
const _tempRight = new THREE.Vector3();

export class VFXManager {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.tracks = [];
    this.trackPool = [];
    this.shockwaves = [];
    this.markers = [];
    this.bulletTrails = [];
    this.trailPool = [];
    this.floatingTexts = [];

    // Material caches (prevents creating/compiling new materials during combat!)
    this.explosionMatCache = new Map();

    // Reusable geometries
    this.cubeGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
    this.smallSparkGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    this.muzzleBoxGeo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
    this.muzzleFlashGeo = new THREE.SphereGeometry(0.48, 8, 8);
    this.trailGeo = new THREE.SphereGeometry(0.18, 6, 6);
    // Pre-orient track plane flat on XZ ground so mesh.rotation.y = rotationY aligns 1:1 with tank heading
    this.trackGeo = new THREE.PlaneGeometry(0.54, 0.58);
    this.trackGeo.rotateX(-Math.PI / 2);
    this.scorchGeo = new THREE.CircleGeometry(2.2, 16);
    this.starGeo = new THREE.BoxGeometry(0.26, 0.26, 0.26);
    this.shockwaveGeo = new THREE.RingGeometry(0.5, 1.05, 28);

    // Pre-allocated shared materials for frequent effects (Zero shader compilation or GC on shoot!)
    this.sparkMat = new THREE.MeshBasicMaterial({ color: 0xFFE082 });
    this.muzzleSmokeMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.65, depthWrite: false });
    this.muzzleFlashMat = new THREE.MeshBasicMaterial({ color: 0xFFF59D, transparent: true, opacity: 0.95, depthWrite: false });
    this.exhaustNormalMat = new THREE.MeshBasicMaterial({ color: 0xfff8e7, transparent: true, opacity: 0.32, depthWrite: false });
    this.exhaustBoostMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.35, depthWrite: false });
    this.playerTrailMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.62,
      depthWrite: false
    });
    this.enemyTrailMat = new THREE.MeshBasicMaterial({
      color: 0xff5722,
      transparent: true,
      opacity: 0.62,
      depthWrite: false
    });

    // Crisp segmented caterpillar tread texture matching the reference photo
    this.trackTex = this.createSoftTrackTexture();

    // Permanent Pooled PointLight for explosions & cannon flashes
    // Kept in scene permanently (intensity = 0 when idle) so NUM_POINT_LIGHTS never changes and WebGL NEVER recompiles shaders!
    this.pooledFlashLight = new THREE.PointLight(0xffe082, 0, 24, 1.8);
    this.pooledFlashLight.position.set(0, -50, 0);
    this.pooledFlashLight.userData = { isEnvironment: true };
    this.scene.add(this.pooledFlashLight);
    this.activeFlash = null;
  }

  getExplosionMaterial(color) {
    let mat = this.explosionMatCache.get(color);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.65,
        roughness: 0.25
      });
      this.explosionMatCache.set(color, mat);
    }
    return mat;
  }

  createSoftTrackTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 64, 64);

      // Base translucent tread belt imprint
      ctx.fillStyle = 'rgba(28, 38, 18, 0.42)';
      ctx.fillRect(6, 0, 52, 64);

      // Left & right outer tread guide rails
      ctx.fillStyle = 'rgba(18, 26, 10, 0.68)';
      ctx.fillRect(6, 0, 5, 64);
      ctx.fillRect(53, 0, 5, 64);

      // Two crisp transverse caterpillar link cleats per segment
      ctx.fillStyle = 'rgba(18, 26, 10, 0.72)';
      ctx.fillRect(8, 10, 48, 8);
      ctx.fillRect(8, 42, 48, 8);

      // Subtle inner tread block shading
      ctx.fillStyle = 'rgba(35, 48, 22, 0.35)';
      ctx.fillRect(12, 20, 40, 18);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // Spawn floating 3D pop-up score / status text billboard above impacts (Dynamic auto-sizing canvas so text NEVER clips!)
  spawnFloatingText(pos, text, colorHex = '#ffeb3b', scaleSize = 1.0) {
    const canvas = document.createElement('canvas');
    // Wide high-DPI canvas (640x128) so long Spanish phrases like "🎯 ¡REBOTE! +450" or "⚔️ ¡INTERCEPTADO! +25" never clip
    canvas.width = 640;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Auto-fit font size so even the longest string fits with generous horizontal margin
    let fontSize = 46;
    ctx.font = `900 ${fontSize}px "Arial Black", Impact, system-ui, sans-serif`;
    let textMetrics = ctx.measureText(text);
    const maxAllowedWidth = canvas.width - 56;
    if (textMetrics.width > maxAllowedWidth) {
      fontSize = Math.max(26, Math.floor(fontSize * (maxAllowedWidth / textMetrics.width)));
      ctx.font = `900 ${fontSize}px "Arial Black", Impact, system-ui, sans-serif`;
      textMetrics = ctx.measureText(text);
    }

    // Subtle dark pill backdrop behind text for crisp readability on bright snow/sand
    const pillW = Math.min(canvas.width - 16, textMetrics.width + 44);
    const pillH = fontSize + 26;
    const pillX = (canvas.width - pillW) / 2;
    const pillY = (canvas.height - pillH) / 2;

    ctx.fillStyle = 'rgba(15, 20, 30, 0.68)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(pillX, pillY, pillW, pillH, 24);
    } else {
      ctx.rect(pillX, pillY, pillW, pillH);
    }
    ctx.fill();

    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Crisp dark text outline
    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(10, 8, 6, 0.95)';
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2 + 2);

    ctx.fillStyle = colorHex;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const spriteMat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });

    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(pos);
    sprite.position.y += 2.8;
    // Aspect ratio matches 640:128 (5:1)
    const baseW = 8.5 * scaleSize;
    const baseH = 1.7 * scaleSize;
    sprite.scale.set(baseW, baseH, 1);
    sprite.renderOrder = 995;

    this.scene.add(sprite);
    this.floatingTexts.push({
      sprite,
      tex,
      mat: spriteMat,
      age: 0,
      maxAge: 1.25,
      baseScaleX: baseW,
      baseScaleY: baseH
    });
  }

  // Reuses permanent PointLight so scene light count never changes (zero shader recompilation!)
  spawnLightFlash(pos, color, intensity = 5.0, distance = 18, duration = 0.18) {
    if (!this.pooledFlashLight) return;
    // Only override if stronger or current flash is nearly done
    if (this.activeFlash && this.pooledFlashLight.intensity > intensity) return;

    if (!this.pooledFlashLight.parent) {
      this.scene.add(this.pooledFlashLight);
    }
    this.pooledFlashLight.color.setHex(color);
    this.pooledFlashLight.intensity = intensity;
    this.pooledFlashLight.distance = distance;
    this.pooledFlashLight.position.set(pos.x, Math.max(1.2, pos.y + 0.8), pos.z);
    this.activeFlash = {
      maxIntensity: intensity,
      age: 0,
      duration
    };
  }

  // Spawn glowing plasma tracer trail behind moving bullets (Uses object pool & shared materials — zero GC!)
  spawnBulletTrail(pos, isPlayerBullet = true, isBazooka = false) {
    const mat = isBazooka ? this.enemyTrailMat : (isPlayerBullet ? this.playerTrailMat : this.enemyTrailMat);
    let mesh = this.trailPool.pop();
    if (mesh) {
      mesh.material = mat;
      mesh.visible = true;
      if (!mesh.parent) {
        this.scene.add(mesh);
      }
    } else {
      mesh = new THREE.Mesh(this.trailGeo, mat);
      this.scene.add(mesh);
    }
    mesh.position.copy(pos);
    mesh.scale.setScalar(isBazooka ? 1.65 : 1.0);
    this.bulletTrails.push({ mesh, age: 0, maxAge: isBazooka ? 0.24 : 0.16 });
  }

  // Spawn engine exhaust puff behind moving tank
  spawnExhaustPuff(pos, rotationY, isBoosted = false) {
    _tempDir.set(0, 0, -1).applyAxisAngle(_upAxis, rotationY);
    const sideOffset = (Math.random() > 0.5 ? 0.65 : -0.65);
    _tempRight.set(1, 0, 0).applyAxisAngle(_upAxis, rotationY);

    const mat = isBoosted ? this.exhaustBoostMat : this.exhaustNormalMat;
    const mesh = new THREE.Mesh(this.smallSparkGeo, mat);
    mesh.position.set(
      pos.x + _tempDir.x * 1.65 + _tempRight.x * sideOffset,
      1.4,
      pos.z + _tempDir.z * 1.65 + _tempRight.z * sideOffset
    );
    mesh.scale.setScalar(1.0);

    const speed = 2.0 + Math.random() * 1.4;
    const velocity = new THREE.Vector3(
      _tempDir.x * speed,
      1.2 + Math.random() * 0.9,
      _tempDir.z * speed
    );

    this.scene.add(mesh);
    this.particles.push({ mesh, velocity, life: 0.28, type: 'smokeShared' });
  }

  // Spawn scorched blast crater decal on floor
  spawnScorchDecal(pos, scale = 1.0) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x2b2118,
      transparent: true,
      opacity: 0.36,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(this.scorchGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos.x, 0.03, pos.z);
    mesh.scale.setScalar(scale);
    this.scene.add(mesh);
    this.markers.push({ mesh, age: 0, maxAge: 4.5, mat });
  }

  spawnExplosion(pos, color, count, scale) {
    const mat = this.getExplosionMaterial(color);
    
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.cubeGeo, mat);
      mesh.position.set(
        pos.x + (Math.random() - 0.5) * scale,
        pos.y + Math.random() * scale,
        pos.z + (Math.random() - 0.5) * scale
      );
      mesh.scale.setScalar(1.0);

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 16,
        Math.random() * 14 + 4.5,
        (Math.random() - 0.5) * 16
      );

      this.scene.add(mesh);
      this.particles.push({ mesh, velocity, life: 0.75 + Math.random() * 0.45, type: 'cube' });
    }

    if (count >= 12) {
      this.spawnLightFlash(pos, color, 6.0, 24, 0.25);
    }
  }

  spawnRicochetSpark(pos) {
    for (let i = 0; i < 7; i++) {
      const mesh = new THREE.Mesh(this.smallSparkGeo, this.sparkMat);
      mesh.position.copy(pos);
      mesh.scale.setScalar(1.0);
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 11,
        Math.random() * 7 + 2.5,
        (Math.random() - 0.5) * 11
      );
      this.scene.add(mesh);
      this.particles.push({ mesh, velocity, life: 0.26, type: 'spark' });
    }
    this.spawnShockwave(pos, 0xFFE082, 2.6);
  }

  spawnMuzzleEffect(pos, rotationY) {
      const count = 5;
      _tempDir.set(0, 0, 1).applyAxisAngle(_upAxis, rotationY);

      for (let i = 0; i < count; i++) {
          const mesh = new THREE.Mesh(this.muzzleBoxGeo, this.muzzleSmokeMat);
          mesh.position.set(
              pos.x + (Math.random() - 0.5) * 0.25,
              pos.y + (Math.random() - 0.5) * 0.25,
              pos.z + (Math.random() - 0.5) * 0.25
          );
          mesh.scale.setScalar(1.0);

          const spd = 5 + Math.random() * 3.5;
          const velocity = new THREE.Vector3(
              _tempDir.x * spd + (Math.random() - 0.5) * 1.2,
              Math.random() * 1.6,
              _tempDir.z * spd + (Math.random() - 0.5) * 1.2
          );

          this.scene.add(mesh);
          this.particles.push({ mesh, velocity, life: 0.3, type: 'smokeShared' });
      }

      const flash = new THREE.Mesh(this.muzzleFlashGeo, this.muzzleFlashMat);
      flash.position.copy(pos);
      flash.scale.setScalar(1.0);
      this.scene.add(flash);
      this.particles.push({ mesh: flash, velocity: null, life: 0.06, type: 'flash' });

      this.spawnLightFlash(pos, 0xFFE082, 3.2, 14, 0.09);
  }

  spawnShockwave(pos, color, maxRadius) {
      const mat = new THREE.MeshBasicMaterial({ 
          color: color, 
          transparent: true, 
          opacity: 0.88, 
          side: THREE.DoubleSide,
          depthWrite: false 
      });
      
      const mesh = new THREE.Mesh(this.shockwaveGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.copy(pos);
      mesh.position.y = 0.12;
      
      this.scene.add(mesh);
      this.shockwaves.push({ mesh, mat, speed: 18, maxRadius, age: 0 });
  }

  // Crisp parallel caterpillar tread tracks matching the reference photo (Pooled & guaranteed in scene)
  spawnTrack(pos, rotationY, entity = null) {
      if (entity) {
          let angleDiff = 0;
          if (entity._lastTrackRot !== undefined) {
              angleDiff = Math.abs(rotationY - entity._lastTrackRot);
              if (angleDiff > Math.PI) angleDiff = Math.abs(angleDiff - Math.PI * 2);
          }
          if (entity._lastTrackPos && entity._lastTrackPos.distanceTo(pos) < 0.44 && angleDiff < 0.16) return;
          entity._lastTrackPos = pos.clone();
          entity._lastTrackRot = rotationY;
      } else if (this.tracks.length > 0) {
          const recent = this.tracks[this.tracks.length - 1];
          if (recent && recent.mesh.position.distanceTo(pos) < 0.44) return;
      }

      const recycleTrack = (t) => {
          t.mesh.visible = false;
          if (this.trackPool.length < 440) {
              this.trackPool.push(t);
          } else {
              this.scene.remove(t.mesh);
              if (t.mat) t.mat.dispose();
          }
      };

      while (this.tracks.length > 380) {
          const old = this.tracks.shift();
          recycleTrack(old);
      }

      const offset = 1.32;
      _tempRight.set(1, 0, 0).applyAxisAngle(_upAxis, rotationY);
      const maxAge = 6.0;
      const baseOpacity = 0.62;

      const createTread = (sideOffset) => {
          let item = this.trackPool.pop();
          let mesh, mat;
          if (item) {
              mesh = item.mesh;
              mat = item.mat;
              mat.opacity = baseOpacity;
              mesh.visible = true;
              if (!mesh.parent) {
                  this.scene.add(mesh);
              }
          } else {
              mat = new THREE.MeshBasicMaterial({
                  map: this.trackTex,
                  transparent: true,
                  opacity: baseOpacity,
                  side: THREE.DoubleSide,
                  depthWrite: false,
                  polygonOffset: true,
                  polygonOffsetFactor: -2,
                  polygonOffsetUnits: -2
              });
              mesh = new THREE.Mesh(this.trackGeo, mat);
              mesh.renderOrder = 2;
              this.scene.add(mesh);
          }
          mesh.position.set(
              pos.x + _tempRight.x * sideOffset,
              0.06,
              pos.z + _tempRight.z * sideOffset
          );
          mesh.rotation.set(0, rotationY, 0);

          this.tracks.push({ mesh, mat, age: 0, maxAge, baseOpacity });
      };

      createTread(-offset);
      createTread(offset);
  }

  spawnDeathMark(pos) {
      this.spawnScorchDecal(pos, 0.85);

      const group = new THREE.Group();
      group.position.copy(pos);
      group.position.y = 0.06;

      const barGeo = new THREE.BoxGeometry(2.8, 0.08, 0.5);
      const mat = new THREE.MeshBasicMaterial({ color: 0xFF5252, transparent: true, opacity: 0.78 });

      const bar1 = new THREE.Mesh(barGeo, mat);
      bar1.rotation.y = Math.PI / 4;
      
      const bar2 = new THREE.Mesh(barGeo, mat);
      bar2.rotation.y = -Math.PI / 4;

      group.add(bar1);
      group.add(bar2);

      this.scene.add(group);
      this.markers.push({ mesh: group, age: 0, maxAge: 4.5, mat });
  }

  spawnPowerUpBurst(pos, color = 0x00E5FF) {
      const count = 24;
      const mat = this.getExplosionMaterial(color);

      for (let i = 0; i < count; i++) {
          const mesh = new THREE.Mesh(this.starGeo, mat);
          mesh.position.copy(pos);
          mesh.position.y += 0.8;

          const angle = (i / count) * Math.PI * 2;
          const speed = 4.5 + Math.random() * 5.5;
          const velocity = new THREE.Vector3(
              Math.cos(angle) * speed,
              Math.random() * 10 + 6,
              Math.sin(angle) * speed
          );

          this.scene.add(mesh);
          this.particles.push({ mesh, velocity, life: 0.85 + Math.random() * 0.4, type: 'spark' });
      }

      this.spawnShockwave(pos, color, 8.5);
      this.spawnLightFlash(pos, color, 5.0, 20, 0.3);
  }

  spawnBarrelDebris(pos) {
      this.spawnScorchDecal(pos, 1.2);
      this.spawnExplosion(pos, 0xFF3D00, 38, 2.6);
      this.spawnExplosion(pos, 0xFFD600, 22, 2.0);
      this.spawnExplosion(pos, 0x3E2723, 16, 1.8);
      this.spawnShockwave(pos, 0xFF6D00, 13);
      this.spawnLightFlash(pos, 0xFF6D00, 8.5, 32, 0.35);
  }

  // Spectacular multi-stage catastrophic destruction for Player Tank (flying turret, plasma core blast, triple shockwaves & rising smoke)
  spawnCatastrophicTankDestruction(pos, color = 0x0074D9) {
      // 1. Huge scorched blast crater
      this.spawnScorchDecal(pos, 2.1);
      this.spawnDeathMark(pos);

      // 2. Multi-layered fireball & armor shrapnel
      this.spawnExplosion(pos, 0xFF3D00, 52, 3.4); // Molten fire
      this.spawnExplosion(pos, 0xFFD600, 36, 2.8); // Incandescent gold sparks
      this.spawnExplosion(pos, color, 32, 2.6);    // Tank armor fragments
      this.spawnExplosion(pos, 0x00E5FF, 24, 2.2); // Plasma core breach
      this.spawnExplosion(pos, 0x1E293B, 22, 2.5); // Charred hull debris

      // 3. Triple concentric shockwaves
      this.spawnShockwave(pos, 0xFF3D00, 24);
      this.spawnShockwave(pos, 0xFFD600, 16);
      this.spawnShockwave(pos, 0x00E5FF, 11);

      // 4. Intense blinding point-light flash
      this.spawnLightFlash(pos, 0xFF6D00, 16.0, 50, 0.85);

      // 5. Physical 3D Blown-Off Tank Turret & Cannon Barrel flying and tumbling through the air!
      const turretWreck = new THREE.Group();
      turretWreck.position.copy(pos);
      turretWreck.position.y += 1.4;

      const wreckMat = new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          emissive: 0xff3d00,
          emissiveIntensity: 0.45,
          roughness: 0.5,
          metalness: 0.6
      });
      const dome = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.9, 2.3), wreckMat);
      turretWreck.add(dome);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 2.4, 10), wreckMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.1, 1.6);
      turretWreck.add(barrel);

      this.scene.add(turretWreck);
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({
          mesh: turretWreck,
          velocity: new THREE.Vector3(Math.cos(angle) * 7.5, 21.0, Math.sin(angle) * 7.5),
          rotVel: new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 14),
          life: 2.6,
          type: 'wreckage'
      });

      // 6. Thick dark smoke column rising from the burning chassis
      const smokeMat = new THREE.MeshBasicMaterial({
          color: 0x1e293b,
          transparent: true,
          opacity: 0.65,
          depthWrite: false
      });
      const smokeGeo = new THREE.SphereGeometry(0.65, 8, 8);
      for (let i = 0; i < 18; i++) {
          const sm = new THREE.Mesh(smokeGeo, smokeMat.clone());
          sm.position.copy(pos);
          sm.position.x += (Math.random() - 0.5) * 2.4;
          sm.position.z += (Math.random() - 0.5) * 2.4;
          sm.position.y += 0.5 + Math.random() * 1.5;
          const vel = new THREE.Vector3(
              (Math.random() - 0.5) * 3.5,
              3.5 + Math.random() * 5.5,
              (Math.random() - 0.5) * 3.5
          );
          this.scene.add(sm);
          this.particles.push({ mesh: sm, velocity: vel, life: 1.5 + Math.random() * 0.9, type: 'smoke' });
      }
  }

  update(dt) {
      // 1. Particles (Zero Vector3 clone allocations!)
      for (let i = this.particles.length - 1; i >= 0; i--) {
          const p = this.particles[i];
          p.life -= dt;
          
          if (p.life <= 0) {
              this.scene.remove(p.mesh);
              this.particles.splice(i, 1);
          } else {
              if (p.type === 'cube' || p.type === 'spark') {
                  p.velocity.y -= 32 * dt;
                  p.mesh.position.addScaledVector(p.velocity, dt);
                  p.mesh.rotation.x += dt * 4.5;
                  p.mesh.rotation.z += dt * 4.5;
                  
                  if (p.mesh.position.y < 0.16) {
                      p.mesh.position.y = 0.16;
                      p.velocity.y *= -0.45;
                      p.velocity.x *= 0.78;
                      p.velocity.z *= 0.78;
                  }
                  if (p.life < 0.25) p.mesh.scale.setScalar(p.life / 0.25);
              } else if (p.type === 'wreckage') {
                  p.velocity.y -= 28 * dt;
                  p.mesh.position.addScaledVector(p.velocity, dt);
                  if (p.rotVel) {
                      p.mesh.rotation.x += p.rotVel.x * dt;
                      p.mesh.rotation.y += p.rotVel.y * dt;
                      p.mesh.rotation.z += p.rotVel.z * dt;
                  }
                  if (p.mesh.position.y < 0.55) {
                      p.mesh.position.y = 0.55;
                      if (Math.abs(p.velocity.y) > 3.0) {
                          this.spawnRicochetSpark(p.mesh.position);
                      }
                      p.velocity.y *= -0.42;
                      p.velocity.x *= 0.68;
                      p.velocity.z *= 0.68;
                      if (p.rotVel) p.rotVel.multiplyScalar(0.65);
                  }
                  if (p.life < 0.35) p.mesh.scale.setScalar(p.life / 0.35);
              } else if (p.type === 'smokeShared') {
                  p.velocity.multiplyScalar(0.95);
                  p.mesh.position.addScaledVector(p.velocity, dt);
                  p.mesh.scale.setScalar(Math.max(0.05, (p.life / 0.3) * 1.15));
              } else if (p.type === 'smoke') {
                  p.velocity.multiplyScalar(0.95);
                  p.mesh.position.addScaledVector(p.velocity, dt);
                  p.mesh.scale.addScalar(dt * 2.2);
                  p.mesh.material.opacity = Math.max(0, Math.min(0.65, p.life * 0.55));
              }
          }
      }

      // 2. Shockwaves
      for (let i = this.shockwaves.length - 1; i >= 0; i--) {
          const s = this.shockwaves[i];
          s.age += dt;
          
          const currentScale = 1 + (s.speed * s.age);
          s.mesh.scale.setScalar(currentScale);
          const progress = currentScale / s.maxRadius;
          
          if (currentScale >= s.maxRadius) { 
              this.scene.remove(s.mesh);
              if (s.mat) s.mat.dispose();
              this.shockwaves.splice(i, 1);
          } else {
              s.mesh.material.opacity = 0.88 * (1 - progress);
          }
      }

      // 3. Bullet Tracer Trails (Pooled — zero material dispose/alloc!)
      for (let i = this.bulletTrails.length - 1; i >= 0; i--) {
          const bt = this.bulletTrails[i];
          bt.age += dt;
          if (bt.age >= bt.maxAge) {
              bt.mesh.visible = false;
              if (this.trailPool.length < 120) {
                  this.trailPool.push(bt.mesh);
              } else {
                  this.scene.remove(bt.mesh);
              }
              this.bulletTrails.splice(i, 1);
          } else {
              const ratio = 1 - (bt.age / bt.maxAge);
              bt.mesh.scale.setScalar(ratio);
          }
      }

      // 4. Floating 3D Score / Status Texts
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
          const ft = this.floatingTexts[i];
          ft.age += dt;
          if (ft.age >= ft.maxAge) {
              this.scene.remove(ft.sprite);
              ft.tex.dispose();
              ft.mat.dispose();
              this.floatingTexts.splice(i, 1);
          } else {
              const p = ft.age / ft.maxAge;
              ft.sprite.position.y += dt * 3.4 * (1 - p * 0.45);
              const pop = p < 0.14 ? (0.55 + (p / 0.14) * 0.55) : (1.1 - (p - 0.14) * 0.15);
              ft.sprite.scale.set(ft.baseScaleX * pop, ft.baseScaleY * pop, 1);
              if (p > 0.68) {
                  ft.mat.opacity = Math.max(0, 1 - (p - 0.68) / 0.32);
              }
          }
      }

      // 5. Permanent Pooled PointLight Flash Fade
      if (this.activeFlash && this.pooledFlashLight) {
          this.activeFlash.age += dt;
          if (this.activeFlash.age >= this.activeFlash.duration) {
              this.pooledFlashLight.intensity = 0;
              this.activeFlash = null;
          } else {
              this.pooledFlashLight.intensity = this.activeFlash.maxIntensity * (1 - this.activeFlash.age / this.activeFlash.duration);
          }
      }

      // 6. Tracks (Smooth fade out with object pooling!)
      for (let i = this.tracks.length - 1; i >= 0; i--) {
          const t = this.tracks[i];
          t.age += dt;
          if (t.age >= t.maxAge) {
              t.mesh.visible = false;
              if (this.trackPool.length < 400) {
                  this.trackPool.push(t);
              } else {
                  this.scene.remove(t.mesh);
                  if (t.mat) t.mat.dispose();
              }
              this.tracks.splice(i, 1);
          } else {
              const lifeRatio = 1 - (t.age / t.maxAge);
              if (t.mat) {
                  t.mat.opacity = t.baseOpacity * (lifeRatio > 0.35 ? 1.0 : (lifeRatio / 0.35));
              }
          }
      }

      // 7. Death Markers & Scorch Craters
      for (let i = this.markers.length - 1; i >= 0; i--) {
          const m = this.markers[i];
          m.age += dt;
          if (m.age >= m.maxAge) {
              this.scene.remove(m.mesh);
              if (m.mat) m.mat.dispose();
              this.markers.splice(i, 1);
          } else if (m.age > m.maxAge - 1.5) {
              const fade = (m.maxAge - m.age) / 1.5;
              m.mat.opacity = 0.45 * fade;
          }
      }
  }

  clear() {
      this.particles.forEach(p => this.scene.remove(p.mesh));
      this.tracks.forEach(t => {
          t.mesh.visible = false;
          if (this.trackPool.length < 400) {
              this.trackPool.push(t);
          } else {
              this.scene.remove(t.mesh);
              if (t.mat) t.mat.dispose();
          }
      });
      this.shockwaves.forEach(s => {
          this.scene.remove(s.mesh);
          if (s.mat) s.mat.dispose();
      });
      this.markers.forEach(m => {
          this.scene.remove(m.mesh);
          if (m.mat) m.mat.dispose();
      });
      this.bulletTrails.forEach(bt => {
          bt.mesh.visible = false;
          if (this.trailPool.length < 120) {
              this.trailPool.push(bt.mesh);
          } else {
              this.scene.remove(bt.mesh);
          }
      });
      this.floatingTexts.forEach(ft => {
          this.scene.remove(ft.sprite);
          ft.tex.dispose();
          ft.mat.dispose();
      });
      if (this.pooledFlashLight) {
          this.pooledFlashLight.intensity = 0;
          if (!this.pooledFlashLight.parent) {
              this.scene.add(this.pooledFlashLight);
          }
      }
      this.activeFlash = null;

      this.particles = [];
      this.tracks = [];
      this.shockwaves = [];
      this.markers = [];
      this.bulletTrails = [];
      this.floatingTexts = [];
  }
}

