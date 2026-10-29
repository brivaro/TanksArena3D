
import * as THREE from 'three';

export class VFXManager {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.tracks = [];
    this.shockwaves = [];
    this.markers = [];
    this.bulletTrails = [];
    this.floatingTexts = [];
    this.flashLights = [];

    // Reusable geometries
    this.cubeGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
    this.smallSparkGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    this.trailGeo = new THREE.SphereGeometry(0.18, 6, 6);
    this.trackGeo = new THREE.PlaneGeometry(0.5, 0.42);
    this.scorchGeo = new THREE.CircleGeometry(2.2, 20);

    // Soft, subtle tread decal texture (fades at edges)
    this.trackTex = this.createSoftTrackTexture();

    this.shockwaveGeo = new THREE.RingGeometry(0.5, 1.05, 32);
  }

  createSoftTrackTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 64, 64);
      const grad = ctx.createRadialGradient(32, 32, 6, 32, 32, 28);
      grad.addColorStop(0, 'rgba(70, 58, 48, 0.75)');
      grad.addColorStop(0.65, 'rgba(85, 72, 60, 0.38)');
      grad.addColorStop(1, 'rgba(85, 72, 60, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(4, 12, 56, 40);
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

  // Spawn a brief dynamic point light flash for explosions and cannon fire
  spawnLightFlash(pos, color, intensity = 5.0, distance = 18, duration = 0.18) {
    const light = new THREE.PointLight(color, intensity, distance, 1.8);
    light.position.copy(pos);
    light.position.y = Math.max(1.2, pos.y + 0.8);
    this.scene.add(light);
    this.flashLights.push({
      light,
      maxIntensity: intensity,
      age: 0,
      duration
    });
  }

  // Spawn glowing plasma tracer trail behind moving bullets
  spawnBulletTrail(pos, isPlayerBullet = true) {
    const mat = new THREE.MeshBasicMaterial({
      color: isPlayerBullet ? 0x00e5ff : 0xff5722,
      transparent: true,
      opacity: 0.65,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(this.trailGeo, mat);
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.bulletTrails.push({ mesh, mat, age: 0, maxAge: 0.18 });
  }

  // Spawn engine exhaust puff behind moving tank
  spawnExhaustPuff(pos, rotationY, isBoosted = false) {
    const backDir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
    const sideOffset = (Math.random() > 0.5 ? 0.65 : -0.65);
    const rightDir = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);

    const puffPos = pos.clone()
      .add(backDir.clone().multiplyScalar(1.65))
      .add(rightDir.multiplyScalar(sideOffset));
    puffPos.y = 1.4;

    const mat = new THREE.MeshBasicMaterial({
      color: isBoosted ? 0x00e5ff : 0xfff8e7,
      transparent: true,
      opacity: 0.32,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(this.smallSparkGeo, mat);
    mesh.position.copy(puffPos);

    const velocity = backDir.multiplyScalar(2.0 + Math.random() * 1.4);
    velocity.y = 1.2 + Math.random() * 0.9;

    this.scene.add(mesh);
    this.particles.push({ mesh, velocity, life: 0.3, type: 'smoke' });
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
    const mat = new THREE.MeshStandardMaterial({ 
      color: color, 
      emissive: color, 
      emissiveIntensity: 0.65,
      roughness: 0.25 
    });
    
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.cubeGeo, mat);
      mesh.position.copy(pos);
      
      mesh.position.x += (Math.random() - 0.5) * scale;
      mesh.position.z += (Math.random() - 0.5) * scale;
      mesh.position.y += Math.random() * scale;

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
    const mat = new THREE.MeshBasicMaterial({ color: 0xFFE082 });
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(this.smallSparkGeo, mat);
      mesh.position.copy(pos);
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 11,
        Math.random() * 7 + 2.5,
        (Math.random() - 0.5) * 11
      );
      this.scene.add(mesh);
      this.particles.push({ mesh, velocity, life: 0.28, type: 'spark' });
    }
    this.spawnShockwave(pos, 0xFFE082, 2.6);
  }

  spawnMuzzleEffect(pos, rotationY) {
      const count = 6;
      const mat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.7 });
      const geo = new THREE.BoxGeometry(0.25, 0.25, 0.25);

      const dir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);

      for (let i = 0; i < count; i++) {
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.copy(pos);
          mesh.position.add(new THREE.Vector3((Math.random()-0.5)*0.25, (Math.random()-0.5)*0.25, (Math.random()-0.5)*0.25));

          const velocity = dir.clone().multiplyScalar(5 + Math.random() * 3.5); 
          velocity.x += (Math.random() - 0.5) * 1.2;
          velocity.y += (Math.random() * 1.6);
          velocity.z += (Math.random() - 0.5) * 1.2;

          this.scene.add(mesh);
          this.particles.push({ mesh, velocity, life: 0.35, type: 'smoke' });
      }

      const flashGeo = new THREE.SphereGeometry(0.48, 8, 8);
      const flashMat = new THREE.MeshBasicMaterial({ color: 0xFFF59D, transparent: true, opacity: 0.95 });
      const flash = new THREE.Mesh(flashGeo, flashMat);
      flash.position.copy(pos);
      this.scene.add(flash);
      this.particles.push({ mesh: flash, velocity: new THREE.Vector3(), life: 0.06, type: 'flash' });

      this.spawnLightFlash(pos, 0xFFE082, 3.5, 14, 0.1);
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
      this.shockwaves.push({ mesh, speed: 18, maxRadius, age: 0 });
  }

  // Soft, subtle tank tread marks that fade out smoothly and quickly (~2.1s)
  spawnTrack(pos, rotationY, entity = null) {
      if (entity) {
          if (entity._lastTrackPos && entity._lastTrackPos.distanceTo(pos) < 0.95) return;
          entity._lastTrackPos = pos.clone();
      } else if (this.tracks.length > 0) {
          const recent = this.tracks[this.tracks.length - 1];
          if (recent && recent.mesh.position.distanceTo(pos) < 0.95) return;
      }

      if (this.tracks.length > 140) {
          const old = this.tracks.shift();
          this.scene.remove(old.mesh);
          if (old.mat) old.mat.dispose();
      }

      const offset = 1.45;
      const rightVec = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
      const maxAge = 2.1; // Short, clean lifetime
      const baseOpacity = 0.22; // Very subtle & soft

      const createTread = (sideOffset) => {
          const mat = new THREE.MeshBasicMaterial({
              map: this.trackTex,
              transparent: true,
              opacity: baseOpacity,
              side: THREE.DoubleSide,
              depthWrite: false
          });
          const mesh = new THREE.Mesh(this.trackGeo, mat);
          const treadPos = pos.clone().add(rightVec.clone().multiplyScalar(sideOffset));
          
          mesh.position.copy(treadPos);
          mesh.position.y = 0.03;
          mesh.rotation.x = -Math.PI / 2;
          mesh.rotation.z = rotationY;

          this.scene.add(mesh);
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
      const count = 26;
      const mat = new THREE.MeshBasicMaterial({ color: color });
      const starGeo = new THREE.BoxGeometry(0.26, 0.26, 0.26);

      for (let i = 0; i < count; i++) {
          const mesh = new THREE.Mesh(starGeo, mat);
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
      // 1. Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
          const p = this.particles[i];
          p.life -= dt;
          
          if (p.life <= 0) {
              this.scene.remove(p.mesh);
              this.particles.splice(i, 1);
          } else {
              if (p.type === 'cube' || p.type === 'spark') {
                  p.velocity.y -= 32 * dt;
                  p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
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
                  p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
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
              } else if (p.type === 'smoke') {
                  p.velocity.multiplyScalar(0.95);
                  p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
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
              this.shockwaves.splice(i, 1);
          } else {
              s.mesh.material.opacity = 0.88 * (1 - progress);
          }
      }

      // 3. Bullet Tracer Trails
      for (let i = this.bulletTrails.length - 1; i >= 0; i--) {
          const bt = this.bulletTrails[i];
          bt.age += dt;
          if (bt.age >= bt.maxAge) {
              this.scene.remove(bt.mesh);
              bt.mat.dispose();
              this.bulletTrails.splice(i, 1);
          } else {
              const ratio = 1 - (bt.age / bt.maxAge);
              bt.mesh.scale.setScalar(ratio);
              bt.mat.opacity = 0.65 * ratio;
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

      // 5. Dynamic PointLight Flashes
      for (let i = this.flashLights.length - 1; i >= 0; i--) {
          const fl = this.flashLights[i];
          fl.age += dt;
          if (fl.age >= fl.duration) {
              this.scene.remove(fl.light);
              this.flashLights.splice(i, 1);
          } else {
              fl.light.intensity = fl.maxIntensity * (1 - fl.age / fl.duration);
          }
      }

      // 6. Tracks (Smooth linear/quadratic fade out!)
      for (let i = this.tracks.length - 1; i >= 0; i--) {
          const t = this.tracks[i];
          t.age += dt;
          if (t.age >= t.maxAge) {
              this.scene.remove(t.mesh);
              if (t.mat) t.mat.dispose();
              this.tracks.splice(i, 1);
          } else {
              const lifeRatio = 1 - (t.age / t.maxAge);
              if (t.mat) {
                  t.mat.opacity = t.baseOpacity * (lifeRatio * lifeRatio);
              }
          }
      }

      // 7. Death Markers & Scorch Craters
      for (let i = this.markers.length - 1; i >= 0; i--) {
          const m = this.markers[i];
          m.age += dt;
          if (m.age >= m.maxAge) {
              this.scene.remove(m.mesh);
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
          this.scene.remove(t.mesh);
          if (t.mat) t.mat.dispose();
      });
      this.shockwaves.forEach(s => this.scene.remove(s.mesh));
      this.markers.forEach(m => this.scene.remove(m.mesh));
      this.bulletTrails.forEach(bt => {
          this.scene.remove(bt.mesh);
          bt.mat.dispose();
      });
      this.floatingTexts.forEach(ft => {
          this.scene.remove(ft.sprite);
          ft.tex.dispose();
          ft.mat.dispose();
      });
      this.flashLights.forEach(fl => this.scene.remove(fl.light));

      this.particles = [];
      this.tracks = [];
      this.shockwaves = [];
      this.markers = [];
      this.bulletTrails = [];
      this.floatingTexts = [];
      this.flashLights = [];
  }
}
