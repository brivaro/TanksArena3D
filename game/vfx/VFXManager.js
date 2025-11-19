
import * as THREE from 'three';

export class VFXManager {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.tracks = [];
    this.shockwaves = [];
    this.markers = []; // For the X markers
    
    // Reusable geometries/materials
    this.cubeGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    
    // Track Decal - Smaller individual tread mark
    this.trackGeo = new THREE.PlaneGeometry(0.6, 0.7);
    
    // FIXED TRACK VISIBILITY:
    // Increased opacity and removed polygonOffset to prevent z-fighting issues 
    // by relying purely on Y-positioning.
    this.trackMat = new THREE.MeshBasicMaterial({ 
        color: 0x1a0f00, // Very dark brown
        transparent: true, 
        opacity: 0.6,
        side: THREE.DoubleSide,
        depthWrite: false,
    });

    // Shockwave Geometry (Ring)
    this.shockwaveGeo = new THREE.RingGeometry(0.5, 1.0, 32);
  }

  spawnExplosion(pos, color, count, scale) {
    // Use the specific color passed in (Cork color, Tank color, etc.)
    const mat = new THREE.MeshBasicMaterial({ color: color });
    
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.cubeGeo, mat);
      mesh.position.copy(pos);
      
      // Random spread
      mesh.position.x += (Math.random() - 0.5) * scale;
      mesh.position.z += (Math.random() - 0.5) * scale;
      mesh.position.y += Math.random() * scale;

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 12, // Wider spread
        Math.random() * 10 + 5,     // Upward pop
        (Math.random() - 0.5) * 12
      );

      this.scene.add(mesh);
      this.particles.push({ mesh, velocity, life: 0.8 + Math.random() * 0.4, type: 'cube' });
    }
  }

  spawnMuzzleEffect(pos, rotationY) {
      // 1. Smoke Puff (Humito)
      const count = 6;
      const mat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.6 });
      const geo = new THREE.BoxGeometry(0.25, 0.25, 0.25);

      const dir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);

      for(let i=0; i<count; i++) {
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.copy(pos);
          // Slightly randomize start pos around muzzle
          mesh.position.add(new THREE.Vector3((Math.random()-0.5)*0.3, (Math.random()-0.5)*0.3, (Math.random()-0.5)*0.3));

          // Shoot forward + float up
          const velocity = dir.clone().multiplyScalar(4 + Math.random() * 4); 
          velocity.x += (Math.random() - 0.5) * 1.0;
          velocity.y += (Math.random() * 2.0); // Float up
          velocity.z += (Math.random() - 0.5) * 1.0;

          this.scene.add(mesh);
          this.particles.push({ mesh, velocity, life: 0.4 + Math.random() * 0.3, type: 'smoke' });
      }

      // 2. Small Flash
      const flashGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
      const flashMat = new THREE.MeshBasicMaterial({ color: 0xFFFFCC, transparent: true, opacity: 0.9 });
      const flash = new THREE.Mesh(flashGeo, flashMat);
      flash.position.copy(pos);
      flash.rotation.y = Math.random() * Math.PI;
      this.scene.add(flash);
      // Very short lived static particle
      this.particles.push({ mesh: flash, velocity: new THREE.Vector3(), life: 0.05, type: 'flash' });
  }

  spawnShockwave(pos, color, maxRadius) {
      const mat = new THREE.MeshBasicMaterial({ 
          color: color, 
          transparent: true, 
          opacity: 0.8, 
          side: THREE.DoubleSide,
          depthWrite: false 
      });
      
      const mesh = new THREE.Mesh(this.shockwaveGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.copy(pos);
      mesh.position.y = 0.1; // Just above floor
      
      this.scene.add(mesh);
      this.shockwaves.push({ mesh, speed: 15, maxRadius, age: 0 });
  }

  spawnTrack(pos, rotationY) {
      // Ensure we don't spawn too close to the last one to avoid shimmering
      if (this.lastTrackPos && this.lastTrackPos.distanceTo(pos) < 0.5) return;

      // We limit active tracks to keep performance high
      if (this.tracks.length > 300) {
          const old = this.tracks.shift();
          this.scene.remove(old.mesh);
      }

      // Calculate offsets for Left and Right treads
      const offset = 0.8; // Distance from center
      const rightVec = new THREE.Vector3(1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0), rotationY);
      
      // Helper to create one tread
      const createTread = (sideOffset) => {
          const mesh = new THREE.Mesh(this.trackGeo, this.trackMat.clone());
          // Position: Center + RightVector * Offset
          const treadPos = pos.clone().add(rightVec.clone().multiplyScalar(sideOffset));
          
          mesh.position.copy(treadPos);
          mesh.position.y = 0.04; // Raise slightly higher to prevent flickering
          mesh.rotation.x = -Math.PI / 2;
          mesh.rotation.z = rotationY; // Rotate to match tank

          this.scene.add(mesh);
          this.tracks.push({ mesh, age: 0, maxAge: 8.0 }); 
      };

      createTread(-offset); // Left Track
      createTread(offset);  // Right Track

      this.lastTrackPos = pos.clone();
  }

  spawnDeathMark(pos) {
      // Creates a white "X" on the floor
      const group = new THREE.Group();
      group.position.copy(pos);
      group.position.y = 0.05; // On floor

      const barGeo = new THREE.BoxGeometry(3, 0.1, 0.6);
      const mat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 1.0 });

      const bar1 = new THREE.Mesh(barGeo, mat);
      bar1.rotation.y = Math.PI / 4; // 45 degrees
      
      const bar2 = new THREE.Mesh(barGeo, mat);
      bar2.rotation.y = -Math.PI / 4; // -45 degrees

      group.add(bar1);
      group.add(bar2);

      this.scene.add(group);
      this.markers.push({ mesh: group, age: 0, maxAge: 5.0, mats: [mat] });
  }

  update(dt) {
      // 1. Particles Physics
      for (let i = this.particles.length - 1; i >= 0; i--) {
          const p = this.particles[i];
          p.life -= dt;
          
          if (p.life <= 0) {
              this.scene.remove(p.mesh);
              this.particles.splice(i, 1);
          } else {
              // Apply Physics based on type
              if (p.type === 'cube') {
                  p.velocity.y -= 35 * dt; // Heavy Gravity
                  p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
                  p.mesh.rotation.x += dt * 5;
                  p.mesh.rotation.z += dt * 5;
                  
                  // Floor bounce
                  if (p.mesh.position.y < 0.15) {
                      p.mesh.position.y = 0.15;
                      p.velocity.y *= -0.5;
                      p.velocity.x *= 0.8; // Friction
                      p.velocity.z *= 0.8;
                  }
                  
                  if (p.life < 0.3) p.mesh.scale.setScalar(p.life / 0.3);
              
              } else if (p.type === 'smoke') {
                  p.velocity.multiplyScalar(0.92); // Slow down drag
                  p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
                  // Expand
                  p.mesh.scale.addScalar(dt * 4);
                  // Fade
                  p.mesh.material.opacity = Math.max(0, p.life * 1.5);
              } else if (p.type === 'flash') {
                   // Static, just wait to die
              }
          }
      }

      // 2. Shockwaves Expansion
      for (let i = this.shockwaves.length - 1; i >= 0; i--) {
          const s = this.shockwaves[i];
          s.age += dt;
          
          const currentScale = 1 + (s.speed * s.age);
          s.mesh.scale.setScalar(currentScale);
          
          // Fade out as it gets larger
          const progress = currentScale / s.maxRadius;
          
          if (currentScale >= s.maxRadius) { 
              this.scene.remove(s.mesh);
              this.shockwaves.splice(i, 1);
          } else {
               s.mesh.material.opacity = 0.8 * (1 - progress);
          }
      }

      // 3. Tracks Fade Out
      for (let i = this.tracks.length - 1; i >= 0; i--) {
          const t = this.tracks[i];
          t.age += dt;
          
          if (t.age > t.maxAge) {
              this.scene.remove(t.mesh);
              this.tracks.splice(i, 1);
          } else if (t.age > t.maxAge - 2.0) {
              // Fade out in the last 2 seconds
              const fade = (t.maxAge - t.age) / 2.0;
              t.mesh.material.opacity = 0.6 * fade;
          }
      }

      // 4. Markers Fade Out
      for (let i = this.markers.length - 1; i >= 0; i--) {
          const m = this.markers[i];
          m.age += dt;
          if (m.age > m.maxAge) {
              this.scene.remove(m.mesh);
              this.markers.splice(i, 1);
          } else if (m.age > m.maxAge - 1.0) {
              const fade = m.maxAge - m.age;
              m.mats.forEach(mat => mat.opacity = fade);
          }
      }
  }

  clear() {
      this.particles.forEach(p => this.scene.remove(p.mesh));
      this.particles = [];
      this.tracks.forEach(t => this.scene.remove(t.mesh));
      this.tracks = [];
      this.shockwaves.forEach(s => this.scene.remove(s.mesh));
      this.shockwaves = [];
      this.markers.forEach(m => this.scene.remove(m.mesh));
      this.markers = [];
      this.lastTrackPos = null;
  }
}
