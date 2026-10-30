
import * as THREE from 'three';
import { Tank } from './Tank.js';

export const PLAYER_SKINS = {
  classic: {
    bodyColor: 0x0088ff,
    trimColor: 0x0055cc,
    stripeColor: 0xffffff,
    roughness: 0.2,
    metalness: 0.18
  },
  gold: {
    bodyColor: 0xffd600,
    trimColor: 0x1e293b,
    stripeColor: 0xfffde7,
    roughness: 0.15,
    metalness: 0.85,
    trimMetalness: 0.7
  },
  camo: {
    bodyColor: 0x4caf50,
    trimColor: 0x1b5e20,
    stripeColor: 0xffca28,
    roughness: 0.45,
    metalness: 0.12
  },
  cyber: {
    bodyColor: 0x0f172a,
    trimColor: 0x00f0ff,
    stripeColor: 0x00f0ff,
    roughness: 0.16,
    metalness: 0.75,
    trimEmissive: 0x00f0ff,
    trimEmissiveIntensity: 0.75
  },
  crimson: {
    bodyColor: 0xff1744,
    trimColor: 0x212121,
    stripeColor: 0xffea00,
    roughness: 0.22,
    metalness: 0.4,
    emissive: 0x6a0000,
    emissiveIntensity: 0.4
  }
};

export class PlayerTank extends Tank {
  constructor(scene, x, z, inputManager, skinId = 'classic', perkId = 'ricochet') {
    const skinCfg = PLAYER_SKINS[skinId] || PLAYER_SKINS.classic;
    super(scene, x, z, skinCfg.bodyColor, skinCfg);
    this.input = inputManager;
    this.skinId = skinId;
    this.perkId = perkId;

    // Apply Tactical Module (Perk) stats
    this.speed = perkId === 'overdrive' ? 18.6 : 15.5;
    this.rotationSpeed = perkId === 'overdrive' ? 3.65 : 3.0;
    this.needsMine = false;
    this.mineCooldown = 0;
    this.maxMineCooldown = perkId === 'ordnance' ? 1.05 : 1.8;
    this.needsBazooka = false;
    this.bazookaCooldown = 0;
    this.maxBazookaCooldown = perkId === 'ordnance' ? 2.6 : 4.0;
    this.bonusBounces = perkId === 'ricochet' ? 1 : 0;
    this.bulletSpeedMultiplier = perkId === 'ricochet' ? 1.18 : 1.0;

    this.invulnerableTimer = 0;
    this.bufferedMineTime = 0;
    this.bufferedBazookaTime = 0;

    // Power-Up States
    this.shieldActive = false;
    this.rapidFireTimer = 0;
    this.speedBoostTimer = 0;
    this.boostVelocity = new THREE.Vector3();

    // Heroic Racing Stripes on Turret & Hull
    const stripeMat = new THREE.MeshBasicMaterial({ color: skinCfg.stripeColor || 0xffffff });
    const hullStripeGeo = new THREE.BoxGeometry(0.45, 0.97, 3.44);
    const hullStripe = new THREE.Mesh(hullStripeGeo, stripeMat);
    hullStripe.position.set(0, 0.9, 0);
    if (this.chassis) this.chassis.add(hullStripe);

    const turretStripeGeo = new THREE.BoxGeometry(0.35, 0.8, 2.18);
    const turretStripe = new THREE.Mesh(turretStripeGeo, stripeMat);
    if (this.turret) this.turret.add(turretStripe);

    // Visual Shield Bubble (Hexagonal energy dome + inner glow)
    const shieldGeo = new THREE.IcosahedronGeometry(2.65, 2);
    const shieldMat = new THREE.MeshPhysicalMaterial({
        color: 0x00E5FF,
        emissive: 0x00B0FF,
        emissiveIntensity: 0.7,
        transparent: true,
        opacity: 0.38,
        roughness: 0.08,
        metalness: 0.1,
        clearcoat: 1.0,
        wireframe: false,
        depthWrite: false
    });
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.position.y = 1.25;
    this.shieldMesh.visible = false;

    // Outer Wireframe Energy Lattice on Shield
    const wireMat = new THREE.MeshBasicMaterial({
        color: 0x80d8ff,
        wireframe: true,
        transparent: true,
        opacity: 0.45
    });
    const wireMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(2.68, 1), wireMat);
    this.shieldMesh.add(wireMesh);

    this.mesh.add(this.shieldMesh);
  }

  applyPowerUp(type) {
    if (type === 'shield') {
      this.shieldActive = true;
      this.shieldMesh.visible = true;
    } else if (type === 'rapid') {
      this.rapidFireTimer = 8.0; // 8 seconds of rapid-fire
    } else if (type === 'speed') {
      this.speedBoostTimer = 6.5; // 6.5 seconds of super speed
    }
  }

  applyBoost(dirX, dirZ, force = 30) {
    this.boostVelocity.set(dirX, 0, dirZ).normalize().multiplyScalar(force);
  }

  triggerHit() {
    if (this.invulnerableTimer > 0) return false;
    
    // Shield absorbs the blow!
    if (this.shieldActive) {
      this.shieldActive = false;
      this.shieldMesh.visible = false;
      this.invulnerableTimer = 0.9; // Grace period
      return 'shield_absorbed';
    }

    this.invulnerableTimer = 1.8; // 1.8 seconds invulnerability
    return true;
  }

  isInvulnerable() {
    return this.invulnerableTimer > 0;
  }

  update(dt, collisionObstacles, visionObstacles, entities) {
    this.updateCooldown(dt);
    if (this.mineCooldown > 0) this.mineCooldown -= dt;
    if (this.bazookaCooldown > 0) this.bazookaCooldown -= dt;
    if (this.warpCooldown > 0) this.warpCooldown -= dt;

    // Handle Power-Up Timers
    if (this.rapidFireTimer > 0) {
      this.rapidFireTimer -= dt;
      if (this.rapidFireTimer < 0) this.rapidFireTimer = 0;
    }
    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer -= dt;
      if (this.speedBoostTimer < 0) this.speedBoostTimer = 0;
    }

    // Shield Animation
    if (this.shieldActive && this.shieldMesh) {
      this.shieldMesh.rotation.y += dt * 1.8;
      this.shieldMesh.rotation.x += dt * 0.9;
    }

    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
      const flash = Math.floor(this.invulnerableTimer * 12) % 2 === 0;
      this.mesh.visible = flash;
      if (this.invulnerableTimer <= 0) {
        this.mesh.visible = true;
      }
    } else {
      this.mesh.visible = true;
    }

    // 1. Movement & Speed calculation
    const currentBaseSpeed = this.speedBoostTimer > 0 ? this.speed * 1.45 : this.speed;
    const move = this.input.getMovementVector();
    const prevPos = this.mesh.position.clone();
    let activeForwardSpeed = 0;
    let activeTurnSpeed = 0;

    if (move.hasDirectInput) {
      // Direct directional steering (virtual touch joystick)
      const targetAngle = Math.atan2(move.directX, move.directZ);
      let angleDiff = targetAngle - this.mesh.rotation.y;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      
      const rotStep = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), this.rotationSpeed * 2.8 * dt);
      this.mesh.rotation.y += rotStep;
      activeTurnSpeed = rotStep / Math.max(dt, 0.001);

      const moveMag = Math.min(1, Math.hypot(move.directX, move.directZ));
      activeForwardSpeed = currentBaseSpeed * moveMag;
      const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
      const newPos = this.mesh.position.clone().add(forward.multiplyScalar(activeForwardSpeed * dt));

      this.tryMoveWithSlide(newPos, collisionObstacles, entities);
    } else {
      // Classic tank controls (WASD / Arrow Keys)
      const moveSpeed = move.forward * currentBaseSpeed;
      const turnSpeed = move.turn * this.rotationSpeed;
      activeForwardSpeed = moveSpeed;
      activeTurnSpeed = turnSpeed;

      this.mesh.rotation.y += turnSpeed * dt;

      if (moveSpeed !== 0) {
        const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
        const newPos = this.mesh.position.clone().add(forward.multiplyScalar(moveSpeed * dt));

        this.tryMoveWithSlide(newPos, collisionObstacles, entities);
      }
    }

    // Apply Speed Booster Impulse (if active)
    if (this.boostVelocity.lengthSq() > 0.05) {
      const boostDelta = this.boostVelocity.clone().multiplyScalar(dt);
      const boostedPos = this.mesh.position.clone().add(boostDelta);
      if (!this.checkCollision(boostedPos, collisionObstacles, entities)) {
        this.mesh.position.copy(boostedPos);
      }
      this.boostVelocity.multiplyScalar(Math.max(0, 1 - dt * 3.5));
    }

    // Update true velocity vector so tread marks and exhaust smoke spawn accurately!
    if (dt > 0) {
      this.velocity.subVectors(this.mesh.position, prevPos).divideScalar(dt);
    }

    // Animate road wheels & suspension pitch/roll
    this.animateSuspension(dt, activeForwardSpeed, activeTurnSpeed);

    // 2. Aiming
    const mousePos = this.input.getAimPosition();
    if (mousePos) {
        const dx = mousePos.x - this.mesh.position.x;
        const dz = mousePos.z - this.mesh.position.z;
        const angle = Math.atan2(dx, dz);
        this.turret.rotation.y = angle - this.mesh.rotation.y; 
    }

    // 3. Heavy Bazooka Demolition Rocket (Q / F / Shift or Shift+Click or HUD button)
    if (this.input.checkBazooka()) {
        this.bufferedBazookaTime = 0.5;
    }

    if (this.bufferedBazookaTime > 0) {
        this.bufferedBazookaTime -= dt;
        if (this.bazookaCooldown <= 0) {
            this.fireBazooka();
        }
    }

    // 4. Standard Shooting (or Bazooka if holding modifier key and Bazooka is ready)
    if (this.input.checkShoot()) {
        if (this.input.isHoldingBazookaModifier && this.input.isHoldingBazookaModifier() && this.bazookaCooldown <= 0) {
            this.fireBazooka();
        } else {
            this.tryShoot();
        }
    }

    // 5. Mines (with input buffering so taps are never ignored)
    if (this.input.checkMine()) {
        this.bufferedMineTime = 0.5;
    }

    if (this.bufferedMineTime > 0) {
        this.bufferedMineTime -= dt;
        if (this.mineCooldown <= 0) {
            this.needsMine = true;
            this.mineCooldown = this.maxMineCooldown;
            this.bufferedMineTime = 0;
        }
    }
  }

  tryShoot() {
    if (this.cooldown <= 0) {
      this.needsShoot = true;
      this.cooldown = this.rapidFireTimer > 0 ? 0.12 : this.maxCooldown;
      this.recoilImpulse = 1.0;
      if (this.barrel) {
        this.barrel.position.z = 0.82;
      }
      return true;
    }
    return false;
  }

  fireBazooka() {
    if (this.bazookaCooldown <= 0) {
      this.needsBazooka = true;
      this.bazookaCooldown = this.maxBazookaCooldown;
      this.bufferedBazookaTime = 0;
      this.recoilImpulse = 1.65;
      if (this.barrel) {
        this.barrel.position.z = 0.65;
      }
      return true;
    } else {
      this.bufferedBazookaTime = 0.55;
      return false;
    }
  }

  dropMine() {
    if (this.mineCooldown <= 0) {
      this.needsMine = true;
      this.mineCooldown = this.maxMineCooldown;
      this.bufferedMineTime = 0;
      return true;
    } else {
      this.bufferedMineTime = 0.6;
      return false;
    }
  }
}
