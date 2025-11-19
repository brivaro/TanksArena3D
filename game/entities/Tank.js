
import * as THREE from 'three';

export class Tank {
  constructor(scene, x, z, color) {
    this.scene = scene;
    this.color = color;
    this.mesh = new THREE.Group();
    this.mesh.position.set(x, 0, z);
    
    this.radius = 1.8; // Adjusted for slightly bulkier model
    this.velocity = new THREE.Vector3();
    this.speed = 8;
    this.rotationSpeed = 3.0;
    this.cooldown = 0;
    this.maxCooldown = 0.5;
    this.needsShoot = false;

    this.createModel(color);
    this.scene.add(this.mesh);
  }

  createModel(color) {
    // Shiny Plastic Material
    const matBody = new THREE.MeshPhysicalMaterial({ 
        color: color, 
        roughness: 0.2, 
        metalness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1
    });
    
    const matDark = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });

    // Main Body (Chunky Box)
    const bodyGeo = new THREE.BoxGeometry(2.8, 1.2, 3.4);
    const body = new THREE.Mesh(bodyGeo, matBody);
    body.position.y = 1.0; 
    body.castShadow = true;
    body.receiveShadow = true;
    this.mesh.add(body);

    // Tracks (Simple visual representation)
    const trackGeo = new THREE.BoxGeometry(0.5, 0.8, 3.2);
    const trackL = new THREE.Mesh(trackGeo, matDark);
    trackL.position.set(-1.6, 0.4, 0);
    trackL.castShadow = true;
    trackL.receiveShadow = true;
    this.mesh.add(trackL);

    const trackR = new THREE.Mesh(trackGeo, matDark);
    trackR.position.set(1.6, 0.4, 0);
    trackR.castShadow = true;
    trackR.receiveShadow = true;
    this.mesh.add(trackR);

    // Turret Pivot
    this.turret = new THREE.Group();
    this.turret.position.set(0, 1.6, 0);
    this.mesh.add(this.turret);

    // Turret Head (Rounded look using cylinder + box or just a smaller box)
    const headGeo = new THREE.BoxGeometry(1.8, 0.8, 2.2);
    const head = new THREE.Mesh(headGeo, matBody);
    head.castShadow = true;
    this.turret.add(head);

    // Barrel (Cylinder)
    const barrelGeo = new THREE.CylinderGeometry(0.3, 0.3, 2.5, 16);
    const barrel = new THREE.Mesh(barrelGeo, matDark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, 1.5); 
    barrel.castShadow = true;
    this.turret.add(barrel);
  }

  checkCollision(newPos, walls, entities) {
      // Check static walls/obstacles
      for (const wall of walls) {
          if (!wall.userData.bounds) continue; // Safety check
          
          const box = wall.userData.bounds;
          const x = Math.max(box.min.x, Math.min(newPos.x, box.max.x));
          const z = Math.max(box.min.z, Math.min(newPos.z, box.max.z));
          const distance = Math.sqrt((x - newPos.x) * (x - newPos.x) + (z - newPos.z) * (z - newPos.z));
          
          if (distance < this.radius) return true;
      }

      // Check other tanks
      for (const entity of entities) {
          if (entity === this) continue;
          // Safety check: ensure entity has a mesh and it's valid
          if (!entity.mesh) continue; 

          const dist = newPos.distanceTo(entity.mesh.position);
          if (dist < this.radius + entity.radius) return true;
      }
      return false;
  }

  updateCooldown(dt) {
      if (this.cooldown > 0) this.cooldown -= dt;
  }

  tryShoot() {
      if (this.cooldown <= 0) {
          this.needsShoot = true;
          this.cooldown = this.maxCooldown;
      }
  }
}
