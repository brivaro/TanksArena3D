
import * as THREE from 'three';
import { Tank } from './Tank.js';
import { PlayerTank } from './PlayerTank.js';

// Configuration for different enemy ranks
const ENEMY_TYPES = {
    'static': { 
        color: 0x66BB6A, // Green (Easy/Toy Soldier)
        speed: 0, 
        rotSpeed: 1.0,
        shootCooldown: 2.5, // Slow fire rate
        reactionTime: 3.0,  // Slow to notice player
        bulletSpeed: 15,
        behavior: 'STATIC' 
    },
    'basic': { 
        color: 0xD32F2F, // Red (Standard)
        speed: 5, 
        rotSpeed: 3.0,
        shootCooldown: 1.5,
        reactionTime: 1.5,
        bulletSpeed: 22,
        behavior: 'WANDER' 
    },
    'fast': { 
        color: 0x26C6DA, // Cyan (Scout)
        speed: 9, 
        rotSpeed: 4.5,
        shootCooldown: 1.0, // Spammy
        reactionTime: 0.5,  // Quick reactions
        bulletSpeed: 25,
        behavior: 'AGGRESSIVE' 
    },
    'heavy': { 
        color: 0x3E2723, // Dark Brown/Black (Sniper/Heavy)
        speed: 3, 
        rotSpeed: 2.0,
        shootCooldown: 2.0,
        reactionTime: 1.0,
        bulletSpeed: 35, // Fast bullets
        behavior: 'TACTICAL' 
    }
};

export class EnemyTank extends Tank {
  constructor(scene, x, z, typeKey = 'basic') {
    const config = ENEMY_TYPES[typeKey] || ENEMY_TYPES['basic'];
    super(scene, x, z, config.color);
    
    this.typeKey = typeKey;
    this.config = config;
    
    // Apply stats
    this.speed = config.speed;
    this.rotationSpeed = config.rotSpeed;
    this.maxCooldown = config.shootCooldown;
    
    this.raycaster = new THREE.Raycaster();
    
    // AI State
    this.moveDir = new THREE.Vector3(0,0,1);
    this.changeDirTimer = 0;
    this.targetAngle = 0;
    
    // Initial spawn delay
    this.spawnTimer = config.reactionTime; 
  }

  // New Signature: differentiates between things I bump into (walls+holes) and things I can't see through (walls only)
  update(dt, collisionObstacles, visionObstacles, entities) {
    // Warmup period
    if (this.spawnTimer > 0) {
        this.spawnTimer -= dt;
        return;
    }

    this.updateCooldown(dt);

    const player = entities.find(e => e instanceof PlayerTank);
    if (!player || !player.mesh) return;

    // Vector to player
    const vecToPlayer = new THREE.Vector3().subVectors(player.mesh.position, this.mesh.position);
    const distToPlayer = vecToPlayer.length();
    vecToPlayer.normalize();

    // -- 1. Turret Logic (Aiming) --
    // Always try to look at player, but only shoot if line of sight is clear
    const turretTargetAngle = Math.atan2(vecToPlayer.x, vecToPlayer.z);
    
    // Smooth turret rotation
    let turretDiff = turretTargetAngle - (this.mesh.rotation.y + this.turret.rotation.y);
    while (turretDiff > Math.PI) turretDiff -= Math.PI * 2;
    while (turretDiff < -Math.PI) turretDiff += Math.PI * 2;
    
    // Rotate turret towards player slowly
    this.turret.rotation.y += Math.sign(turretDiff) * Math.min(Math.abs(turretDiff), 5.0 * dt);

    // Check Line of Sight using visionObstacles (Walls Only, NO HOLES)
    let canSeePlayer = false;
    if (distToPlayer < 60) {
        // Cast ray from turret position
        const start = this.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
        this.raycaster.set(start, vecToPlayer);
        
        // Use the specific list that DOES NOT contain holes
        const hits = this.raycaster.intersectObjects(visionObstacles);
        
        if (hits.length === 0 || hits[0].distance > distToPlayer) {
            canSeePlayer = true;
        }
    }

    // Shoot if we see player and aim is roughly correct
    if (canSeePlayer && this.cooldown <= 0 && Math.abs(turretDiff) < 0.5) {
        this.tryShoot();
    }

    // -- 2. Movement Logic (AI) --
    
    if (this.config.behavior === 'STATIC') {
        // Just rotate body slowly to look alive, don't move
        this.mesh.rotation.y += Math.sin(Date.now() * 0.001) * 0.5 * dt;
        return; 
    }

    this.changeDirTimer -= dt;

    // Decide new move
    if (this.changeDirTimer <= 0) {
        this.pickNewDirection(vecToPlayer, canSeePlayer, distToPlayer);
    }

    // Rotate Body towards movement direction
    let angleDiff = this.targetAngle - this.mesh.rotation.y;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    if (Math.abs(angleDiff) > 0.1) {
        this.mesh.rotation.y += Math.sign(angleDiff) * this.rotationSpeed * dt;
    } else {
        // Move forward
        const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
        const newPos = this.mesh.position.clone().add(forward.multiplyScalar(this.speed * dt));
        
        // Use collisionObstacles (Walls + Holes) to stop falling into pits or hitting walls
        if (!this.checkCollision(newPos, collisionObstacles, entities)) {
            this.mesh.position.copy(newPos);
        } else {
            // Hit wall, change direction immediately
            this.changeDirTimer = 0;
        }
    }
  }

  pickNewDirection(vecToPlayer, canSeePlayer, distToPlayer) {
      const behavior = this.config.behavior;
      this.changeDirTimer = Math.random() * 2 + 1;

      if (behavior === 'AGGRESSIVE') {
          // Fast tanks rush effectively
          if (canSeePlayer) {
              const angle = Math.atan2(vecToPlayer.x, vecToPlayer.z);
              // Zig-zag towards player
              this.targetAngle = angle + (Math.random() - 0.5) * 1.0; 
              this.changeDirTimer = 0.5; // Change often
          } else {
               this.targetAngle = (Math.random() * Math.PI * 2);
          }
      } 
      else if (behavior === 'TACTICAL') {
          // Heavy tanks try to stay at range or find LoS
          if (canSeePlayer && distToPlayer < 20) {
               // Back up
               this.targetAngle = Math.atan2(-vecToPlayer.x, -vecToPlayer.z);
          } else if (!canSeePlayer) {
               // Search
               this.targetAngle = (Math.random() * Math.PI * 2);
          } else {
               // Stop and shoot
               this.changeDirTimer = 0.5; 
               // Just minor adjustment
               this.targetAngle = this.mesh.rotation.y + (Math.random()-0.5);
          }
      }
      else {
          // BASIC Behavior
          if (canSeePlayer) {
              // Strafe
              if (Math.random() > 0.4) {
                  const perp = new THREE.Vector3(-vecToPlayer.z, 0, vecToPlayer.x);
                  if (Math.random() > 0.5) perp.negate();
                  this.targetAngle = Math.atan2(perp.x, perp.z);
              } else {
                   const angle = Math.atan2(vecToPlayer.x, vecToPlayer.z) + (Math.random() - 0.5);
                   this.targetAngle = angle;
              }
          } else {
              this.targetAngle = (Math.random() * Math.PI * 2);
          }
      }
  }
}
