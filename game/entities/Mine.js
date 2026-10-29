
import * as THREE from 'three';

export class Mine {
  constructor(scene, position) {
    this.scene = scene;
    this.timer = 0;
    this.armed = false;
    this.armTime = 0.65; // Arms after 0.65s so owner can drive away safely
    this.blastRadius = 9.8;
    this.proximityRadius = 3.2; // Auto-detonates if an enemy tank drives within 3.2 units!
    
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

    const blinkSpeed = this.armed ? 9.0 : 3.0;
    const val = Math.sin(this.timer * blinkSpeed);
    this.lightMat.color.setHex(val > 0 ? 0xff1744 : 0x4a0000);

    if (this.ring) {
      const pulse = 1.0 + Math.sin(this.timer * 4.0) * 0.06;
      this.ring.scale.set(pulse, pulse, 1);
      this.ringMat.opacity = this.armed ? (0.35 + (val + 1) * 0.15) : 0.18;
    }
  }
}
