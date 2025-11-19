
import * as THREE from 'three';

export class Mine {
  constructor(scene, position) {
    this.scene = scene;
    this.timer = 0;
    
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);
    this.mesh.position.y = 0.2; // On floor
    
    // Base
    const baseGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.4, 16);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.castShadow = true;
    base.receiveShadow = true;
    this.mesh.add(base);

    // Blinking Light
    const lightGeo = new THREE.SphereGeometry(0.6, 8, 8);
    this.lightMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    this.light = new THREE.Mesh(lightGeo, this.lightMat);
    this.light.position.y = 0.4;
    this.mesh.add(this.light);

    // --- HITBOX ---
    // Invisible cylinder that extends upwards to catch projectiles flying at y=1.5
    // Height 4 ensures it covers the bullet path easily.
    const hitGeo = new THREE.CylinderGeometry(1.5, 1.5, 4.0, 8);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitbox = new THREE.Mesh(hitGeo, hitMat);
    hitbox.position.y = 2.0; // Center it so it reaches up from the floor
    this.mesh.add(hitbox);

    this.scene.add(this.mesh);
  }

  update(dt) {
    this.timer += dt * 5; // Blink speed
    const val = Math.sin(this.timer);
    this.lightMat.color.setHex(val > 0 ? 0xff0000 : 0x550000);
  }
}
