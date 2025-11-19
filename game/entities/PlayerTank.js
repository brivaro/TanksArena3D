
import * as THREE from 'three';
import { Tank } from './Tank.js';

export class PlayerTank extends Tank {
  constructor(scene, x, z, inputManager) {
    super(scene, x, z, 0x0074D9); // Deep Vibrant Blue
    this.input = inputManager;
    this.speed = 15;
    this.needsMine = false;
    this.mineCooldown = 0;
  }

  // New Signature: accepts collisionObstacles (Walls+Holes) and visionObstacles (unused by player input logic currently)
  update(dt, collisionObstacles, visionObstacles, entities) {
    this.updateCooldown(dt);
    if (this.mineCooldown > 0) this.mineCooldown -= dt;

    // 1. Movement
    const move = this.input.getMovementVector();
    const moveSpeed = move.forward * this.speed;
    const turnSpeed = move.turn * this.rotationSpeed;

    this.mesh.rotation.y += turnSpeed * dt;

    if (moveSpeed !== 0) {
        const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
        const newPos = this.mesh.position.clone().add(forward.multiplyScalar(moveSpeed * dt));

        // Use full collision list to prevent walking into walls OR falling in holes
        if (!this.checkCollision(newPos, collisionObstacles, entities)) {
            this.mesh.position.copy(newPos);
        }
    }

    // 2. Aiming
    const mousePos = this.input.getAimPosition();
    if (mousePos) {
        const dx = mousePos.x - this.mesh.position.x;
        const dz = mousePos.z - this.mesh.position.z;
        const angle = Math.atan2(dx, dz);
        this.turret.rotation.y = angle - this.mesh.rotation.y; 
    }

    // 3. Shooting
    if (this.input.checkShoot()) {
        this.tryShoot();
    }

    // 4. Mines
    if (this.input.checkMine() && this.mineCooldown <= 0) {
        this.needsMine = true;
        this.mineCooldown = 2.0; // 2 seconds cooldown
    }
  }
}
