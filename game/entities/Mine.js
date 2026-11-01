
import * as THREE from 'three';

export class Mine {
  constructor(scene, position) {
    this.scene = scene;
    this.timer = 0;
    this.armed = false;
    this.armTime = 0.65; // Arms after 0.65s so owner can drive away safely
    this.fuseDuration = 3.8; // Auto-detonates after 3.8s so mines can demolish walls & obstacles on their own
    this.barrelFuseDuration = 1.45; // Accelerates fuse when placed next to an Explosive Barrel ('B')!
    this.nearBarrel = false;
    this.shouldExplode = false;
    this.blastRadius = 12.0;
    this.proximityRadius = 3.6; // Auto-detonates if an enemy tank drives within 3.6 units!
    
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);
    this.mesh.position.y = 0.15;
    
    // 1. Metallic Octagonal Mine Casing
    const baseGeo = new THREE.CylinderGeometry(1.35, 1.55, 0.38, 8);
    const baseMat = new THREE.MeshStandardMaterial({ 
        color: 0x37474f, 
        roughness: 0.4, 
        metalness: 0.75 
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.castShadow = true;
    base.receiveShadow = true;
    this.mesh.add(base);

    // 2. Yellow/Black Hazard Rim Collar
    const rimGeo = new THREE.CylinderGeometry(1.1, 1.2, 0.44, 12);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xffb300, roughness: 0.5 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    this.mesh.add(rim);

    // 3. Pulsing Core Beacon Dome
    const lightGeo = new THREE.SphereGeometry(0.55, 12, 10);
    this.lightMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
    this.light = new THREE.Mesh(lightGeo, this.lightMat);
    this.light.position.y = 0.35;
    this.mesh.add(this.light);

    // 4. Holographic Danger Proximity Ring on Floor
    const ringGeo = new THREE.RingGeometry(2.7, 3.0, 24);
    this.ringMat = new THREE.MeshBasicMaterial({
        color: 0xff1744,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45,
        depthWrite: false
    });
    this.ring = new THREE.Mesh(ringGeo, this.ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.02;
    this.mesh.add(this.ring);

    // --- HITBOX for Projectiles ---
    const hitGeo = new THREE.CylinderGeometry(1.5, 1.5, 4.0, 8);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitbox = new THREE.Mesh(hitGeo, hitMat);
    hitbox.position.y = 2.0;
    this.mesh.add(hitbox);

    this.scene.add(this.mesh);
  }

  update(dt) {
    this.timer += dt;
    if (!this.armed && this.timer >= this.armTime) {
      this.armed = true;
    }

    const effectiveFuse = this.nearBarrel ? this.barrelFuseDuration : this.fuseDuration;
    if (this.armed && this.timer >= effectiveFuse) {
      this.shouldExplode = true;
    }

    const timeRemaining = Math.max(0, effectiveFuse - this.timer);
    // Accelerate blink rate as the mine approaches detonation
    let blinkSpeed = 3.0;
    if (this.armed) {
      if (timeRemaining < 1.1 || this.nearBarrel) {
        blinkSpeed = 24.0;
      } else if (timeRemaining < 2.0) {
        blinkSpeed = 15.0;
      } else {
        blinkSpeed = 9.0;
      }
    }

    const val = Math.sin(this.timer * blinkSpeed);
    const activeColor = this.nearBarrel ? 0xff6d00 : 0xff1744;
    this.lightMat.color.setHex(val > 0 ? activeColor : 0x4a0000);

    if (this.ring) {
      const pulse = 1.0 + Math.sin(this.timer * (this.nearBarrel ? 10.0 : 4.0)) * (this.nearBarrel ? 0.12 : 0.06);
      this.ring.scale.set(pulse, pulse, 1);
      this.ringMat.color.setHex(activeColor);
      this.ringMat.opacity = this.armed ? (0.38 + (val + 1) * 0.18) : 0.18;
    }
  }
}
