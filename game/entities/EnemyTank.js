
import * as THREE from 'three';
import { Tank } from './Tank.js';
import { PlayerTank } from './PlayerTank.js';

// Configuration for different enemy ranks
const ENEMY_TYPES = {
    'static': { 
        color: 0x00E676, // Vivid Emerald Green (Sentry Turret)
        speed: 0, 
        rotSpeed: 1.0,
        shootCooldown: 2.4,
        reactionTime: 2.2,
        bulletSpeed: 16,
        behavior: 'STATIC' 
    },
    'basic': { 
        color: 0xFF1744, // Vivid Crimson Red (Patrol)
        speed: 5.5, 
        rotSpeed: 3.0,
        shootCooldown: 1.5,
        reactionTime: 1.4,
        bulletSpeed: 22,
        behavior: 'WANDER' 
    },
    'fast': { 
        color: 0x00E5FF, // Electric Cyan (Scout Interceptor)
        speed: 9.5, 
        rotSpeed: 4.5,
        shootCooldown: 1.0,
        reactionTime: 0.6,
        bulletSpeed: 26,
        behavior: 'AGGRESSIVE' 
    },
    'heavy': { 
        color: 0xFF6D00, // Vivid Blazing Amber-Bronze (Sniper Juggernaut)
        speed: 3.5, 
        rotSpeed: 2.2,
        shootCooldown: 2.0,
        reactionTime: 0.9,
        bulletSpeed: 35,
        behavior: 'TACTICAL' 
    },
    'boss': {
        color: 0xD500F9, // Imperial Dreadnought Neon Magenta-Crimson
        speed: 4.8,
        rotSpeed: 2.8,
        shootCooldown: 1.35,
        reactionTime: 1.0,
        bulletSpeed: 27,
        behavior: 'AGGRESSIVE'
    }
};

// AI Difficulty Multipliers
export const AI_DIFFICULTY_PROFILES = {
    'easy': {
        speedMult: 0.72,
        rotMult: 0.70,
        cooldownMult: 1.50,
        reactionMult: 1.55,
        bulletSpeedMult: 0.80,
        turretAimSpeed: 3.2,
        aimTolerance: 0.26,
        bossHpMult: 0.75
    },
    'normal': {
        speedMult: 1.0,
        rotMult: 1.0,
        cooldownMult: 1.0,
        reactionMult: 1.0,
        bulletSpeedMult: 1.0,
        turretAimSpeed: 5.0,
        aimTolerance: 0.38,
        bossHpMult: 1.0
    },
    'hard': {
        speedMult: 1.22,
        rotMult: 1.28,
        cooldownMult: 0.75,
        reactionMult: 0.68,
        bulletSpeedMult: 1.18,
        turretAimSpeed: 6.8,
        aimTolerance: 0.44,
        bossHpMult: 1.25
    },
    'extreme': {
        speedMult: 1.42,
        rotMult: 1.58,
        cooldownMult: 0.56,
        reactionMult: 0.42,
        bulletSpeedMult: 1.34,
        turretAimSpeed: 9.0,
        aimTolerance: 0.52,
        bossHpMult: 1.5
    }
};

export class EnemyTank extends Tank {
  constructor(scene, x, z, typeKey = 'basic', bossConfig = null, difficulty = 'normal') {
    const baseConfig = ENEMY_TYPES[typeKey] || ENEMY_TYPES['basic'];
    const bossColor = (bossConfig && bossConfig.color) ? bossConfig.color : baseConfig.color;
    super(scene, x, z, bossColor, typeKey === 'boss' ? {
      bodyColor: bossColor,
      trimColor: 0xffca28,
      roughness: 0.2,
      metalness: 0.65,
      trimMetalness: 0.85
    } : null);
    
    this.typeKey = typeKey;
    this.baseConfig = baseConfig;
    this.config = { ...baseConfig };
    this.isBoss = (typeKey === 'boss');
    this.bossName = (bossConfig && bossConfig.name) ? bossConfig.name : 'COLOSO BLINDADO';
    this.baseBossMaxHp = this.isBoss ? ((bossConfig && bossConfig.maxHp) || 10) : 1;
    this.maxHp = this.baseBossMaxHp;
    this.hp = this.maxHp;
    this.enraged = false;
    this.hitFlashTimer = 0;

    if (this.isBoss) {
      this.mesh.scale.setScalar(1.52);
      this.radius = 2.65;
    }
    
    this.raycaster = new THREE.Raycaster();
    this.losTimer = Math.random() * 0.12;
    this.cachedCanSeePlayer = false;
    
    this.moveDir = new THREE.Vector3(0,0,1);
    this.changeDirTimer = 0;
    this.targetAngle = 0;

    this.applyDifficulty(difficulty, true);
    this.addRankInsignia(typeKey);
  }

  applyDifficulty(difficulty = 'normal', isInitial = false) {
    const diffProfile = AI_DIFFICULTY_PROFILES[difficulty] || AI_DIFFICULTY_PROFILES['normal'];
    this.difficulty = difficulty;
    this.diffProfile = diffProfile;

    this.config = {
      ...this.baseConfig,
      speed: this.baseConfig.speed * diffProfile.speedMult,
      rotSpeed: this.baseConfig.rotSpeed * diffProfile.rotMult,
      shootCooldown: this.baseConfig.shootCooldown * diffProfile.cooldownMult,
      reactionTime: this.baseConfig.reactionTime * diffProfile.reactionMult,
      bulletSpeed: this.baseConfig.bulletSpeed * diffProfile.bulletSpeedMult
    };

    this.speed = this.enraged ? this.config.speed * 1.28 : this.config.speed;
    this.rotationSpeed = this.config.rotSpeed;
    this.maxCooldown = this.enraged ? Math.min(1.05, this.config.shootCooldown * 0.78) : this.config.shootCooldown;

    if (this.isBoss && isInitial) {
      this.maxHp = Math.max(4, Math.round(this.baseBossMaxHp * diffProfile.bossHpMult));
      this.hp = this.maxHp;
    }

    if (isInitial) {
      this.spawnTimer = this.config.reactionTime;
    }
  }

  addRankInsignia(typeKey) {
    if (!this.turret) return;

    // 1. Tactical Target Acquisition Visor Laser Eye on Front of Turret
    const visorGeo = new THREE.BoxGeometry(0.95, 0.16, 0.12);
    this.visorMat = new THREE.MeshBasicMaterial({ color: 0xffab00 });
    const visor = new THREE.Mesh(visorGeo, this.visorMat);
    visor.position.set(0, 0.25, 1.08);
    this.turret.add(visor);

    // 2. Rank-specific 3D silhouette enhancements
    if (typeKey === 'fast') {
      // Aerodynamic rear spoiler fin
      const wingMat = new THREE.MeshStandardMaterial({ color: 0x006064, roughness: 0.3, metalness: 0.5 });
      const wing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.45), wingMat);
      wing.position.set(0, 0.58, -1.05);
      wing.rotation.x = 0.22;
      this.turret.add(wing);
    } else if (typeKey === 'heavy') {
      // Heavy reinforced side reactive armor plates & gold trim
      const armorMat = new THREE.MeshStandardMaterial({ color: 0xffb300, roughness: 0.35, metalness: 0.7 });
      const plateGeo = new THREE.BoxGeometry(0.22, 0.65, 1.85);
      [-1.02, 1.02].forEach(px => {
        const plate = new THREE.Mesh(plateGeo, armorMat);
        plate.position.set(px, 0, 0);
        this.turret.add(plate);
      });
    } else if (typeKey === 'static') {
      // Rotating radar dish on top of turret
      const dishMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.6, roughness: 0.3 });
      this.radarDish = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.25, 10), dishMat);
      this.radarDish.position.set(0.35, 0.65, -0.35);
      this.radarDish.rotation.x = Math.PI / 3;
      this.turret.add(this.radarDish);
    } else if (typeKey === 'boss') {
      // Dreadnought Twin Auxiliary Barrels + Armored Shoulder Pods + Rotating Energy Crown
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xffca28, metalness: 0.85, roughness: 0.2 });
      const podMat = new THREE.MeshStandardMaterial({ color: 0x263238, metalness: 0.7, roughness: 0.3 });
      const auxTubeGeo = new THREE.CylinderGeometry(0.16, 0.19, 2.1, 12);
      auxTubeGeo.rotateX(Math.PI / 2);

      [-0.45, 0.45].forEach(bx => {
        const auxBarrel = new THREE.Mesh(auxTubeGeo, goldMat);
        auxBarrel.position.set(bx, 0, 0.05);
        if (this.barrel) this.barrel.add(auxBarrel);
      });

      const podGeo = new THREE.BoxGeometry(0.48, 0.68, 1.75);
      [-1.18, 1.18].forEach(px => {
        const pod = new THREE.Mesh(podGeo, podMat);
        pod.position.set(px, 0.15, -0.1);
        this.turret.add(pod);
      });

      // Glowing Rotating Command Reactor Crown atop Turret
      this.bossCore = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.52, 0),
        new THREE.MeshBasicMaterial({ color: 0xffea00 })
      );
      this.bossCore.position.set(0, 0.95, -0.1);
      this.turret.add(this.bossCore);

      // Ground Command Aura Ring beneath the Boss Tank
      const auraGeo = new THREE.RingGeometry(2.1, 2.55, 28);
      auraGeo.rotateX(-Math.PI / 2);
      this.bossAuraMat = new THREE.MeshBasicMaterial({
        color: 0xffca28,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide
      });
      this.bossAuraRing = new THREE.Mesh(auraGeo, this.bossAuraMat);
      this.bossAuraRing.position.y = 0.08;
      this.mesh.add(this.bossAuraRing);
    }
  }

  takeBossDamage(dmg = 1) {
    if (!this.isBoss) return true;
    this.hp = Math.max(0, this.hp - dmg);
    this.hitFlashTimer = 0.22;
    if (this.hp > 0 && this.hp <= this.maxHp * 0.5 && !this.enraged) {
      this.enraged = true;
      this.speed = this.config.speed * 1.28;
      this.maxCooldown = 1.05;
      if (this.bossAuraMat) this.bossAuraMat.color.setHex(0xff1744);
      if (this.bossCore && this.bossCore.material) this.bossCore.material.color.setHex(0xff1744);
    }
    return this.hp <= 0;
  }

  update(dt, collisionObstacles, visionObstacles, entities, stealthContext = null) {
    this.updateCooldown(dt);
    if (this.warpCooldown > 0) this.warpCooldown -= dt;

    if (this.radarDish) {
      this.radarDish.rotation.z += dt * 4.0;
    }
    if (this.bossCore) {
      this.bossCore.rotation.y += dt * (this.enraged ? 5.5 : 2.5);
      this.bossCore.rotation.x += dt * 1.5;
    }
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
      if (this.matBody) {
        this.matBody.emissive.setHex(this.hitFlashTimer > 0 ? 0xffffff : (this.enraged ? 0x660000 : 0x000000));
        this.matBody.emissiveIntensity = this.hitFlashTimer > 0 ? 0.85 : (this.enraged ? 0.45 : 0);
      }
    }

    // Warmup period
    if (this.spawnTimer > 0) {
        this.spawnTimer -= dt;
        this.animateSuspension(dt, 0, 0);
        return;
    }

    const player = entities.find(e => e instanceof PlayerTank);
    if (!player || !player.mesh) return;

    const prevPos = this.mesh.position.clone();

    // Vector to player
    const vecToPlayer = new THREE.Vector3().subVectors(player.mesh.position, this.mesh.position);
    const distToPlayer = vecToPlayer.length();
    vecToPlayer.normalize();

    const isNightStealth = Boolean(stealthContext && stealthContext.isNightStealth);
    const isPlayerStealthed = Boolean(stealthContext && stealthContext.isPlayerStealthed);
    const isSpottedByLighthouse = Boolean(stealthContext && stealthContext.isSpottedByLighthouse);

    // Effective vision distance:
    // - If illuminated by a Lighthouse searchlight: enemies across the entire arena (98u) spot your position!
    // - If hidden in Night Stealth shadows: enemies can only detect you at very close proximity (14.5u)!
    // - Standard visibility: 75u.
    const maxSightDist = isSpottedByLighthouse ? 98.0 : (isPlayerStealthed ? 14.5 : 75.0);

    // Throttled Line of Sight check with Box3 broadphase (10x faster than per-frame full-scene raycast!)
    this.losTimer -= dt;
    if (this.losTimer <= 0 || (isSpottedByLighthouse && !this.cachedCanSeePlayer)) {
        this.losTimer = isSpottedByLighthouse ? 0.06 : 0.11;
        this.cachedCanSeePlayer = false;
        if (distToPlayer < maxSightDist) {
            const start = new THREE.Vector3(this.mesh.position.x, 1.5, this.mesh.position.z);
            this.raycaster.set(start, vecToPlayer);
            this.raycaster.far = distToPlayer;

            const losCandidates = [];
            const ray = this.raycaster.ray;
            const hitBoxPt = new THREE.Vector3();
            let blockedByBox = false;

            for (let i = 0; i < visionObstacles.length; i++) {
                const obs = visionObstacles[i];
                if (!obs || !obs.userData) continue;

                // Analytical 2D Line-of-Sight check for circular obstacles (Lighthouses 'L', Trees 'R', Columns 'Y')
                if (obs.userData.collisionRadius) {
                    const ox = obs.position.x - start.x;
                    const oz = obs.position.z - start.z;
                    const proj = ox * vecToPlayer.x + oz * vecToPlayer.z;
                    if (proj > 0 && proj < distToPlayer) {
                        const perpSq = (ox * ox + oz * oz) - proj * proj;
                        const blockRad = obs.userData.collisionRadius * 0.92;
                        if (perpSq < blockRad * blockRad) {
                            blockedByBox = true;
                            break;
                        }
                    }
                    continue;
                }

                const b = obs.userData.bounds;
                if (b) {
                    if (ray.intersectBox(b, hitBoxPt)) {
                        if (start.distanceToSquared(hitBoxPt) < distToPlayer * distToPlayer) {
                            const t = obs.userData.type;
                            if (t === 'wall' || t === 'stone' || t === 'cork') {
                                blockedByBox = true;
                                break;
                            }
                            losCandidates.push(obs);
                        }
                    }
                } else {
                    losCandidates.push(obs);
                }
            }

            if (!blockedByBox) {
                if (losCandidates.length === 0) {
                    this.cachedCanSeePlayer = true;
                } else {
                    const hits = this.raycaster.intersectObjects(losCandidates, true);
                    let validHit = null;
                    for (let h = 0; h < hits.length; h++) {
                        if (!hits[h].object.userData || !hits[h].object.userData.isEffect) {
                            validHit = hits[h];
                            break;
                        }
                    }
                    if (!validHit || validHit.distance > distToPlayer) {
                        this.cachedCanSeePlayer = true;
                    }
                }
            }
        }
    }
    const canSeePlayer = this.cachedCanSeePlayer;
    this.wasAlertedToPlayer = canSeePlayer || isSpottedByLighthouse;

    // -- 1. Turret Logic (Aiming vs Blind Night Patrol Scanning) --
    let turretDiff = Math.PI;
    const baseAimSpeed = (this.diffProfile && this.diffProfile.turretAimSpeed) ? this.diffProfile.turretAimSpeed : 5.0;
    const aimSpeed = isSpottedByLighthouse ? baseAimSpeed * 1.45 : baseAimSpeed;

    if (isNightStealth && isPlayerStealthed && !canSeePlayer && !isSpottedByLighthouse) {
      // Player is hidden in the night shadows! Enemy does NOT know player position and scans forward along its hull
      const patrolScanOffset = Math.sin(performance.now() * 0.002 + this.mesh.position.x * 0.5) * 0.42;
      let scanDiff = patrolScanOffset - this.turret.rotation.y;
      while (scanDiff > Math.PI) scanDiff -= Math.PI * 2;
      while (scanDiff < -Math.PI) scanDiff += Math.PI * 2;
      this.turret.rotation.y += Math.sign(scanDiff) * Math.min(Math.abs(scanDiff), aimSpeed * 0.55 * dt);
    } else {
      // Enemy knows player position (either direct LOS, daytime, or revealed by Lighthouse beam!)
      const turretTargetAngle = Math.atan2(vecToPlayer.x, vecToPlayer.z);
      turretDiff = turretTargetAngle - (this.mesh.rotation.y + this.turret.rotation.y);
      while (turretDiff > Math.PI) turretDiff -= Math.PI * 2;
      while (turretDiff < -Math.PI) turretDiff += Math.PI * 2;
      this.turret.rotation.y += Math.sign(turretDiff) * Math.min(Math.abs(turretDiff), aimSpeed * dt);
    }

    // Update visor glow color:
    // - Bright flashing red/white when about to shoot
    // - Crimson red when locked onto player or alerted by Lighthouse searchlight
    // - Cool cyan-blue when patrolling blindly in Night Stealth
    if (this.visorMat) {
      if (canSeePlayer && this.cooldown < 0.35) {
        const flash = Math.floor(performance.now() * 0.02) % 2 === 0;
        this.visorMat.color.setHex(flash ? 0xffffff : 0xff1744);
      } else if (canSeePlayer || isSpottedByLighthouse) {
        this.visorMat.color.setHex(0xff1744);
      } else if (isNightStealth && isPlayerStealthed) {
        this.visorMat.color.setHex(0x38bdf8);
      } else {
        this.visorMat.color.setHex(0xffab00);
      }
    }

    // When spotted by a Lighthouse searchlight, enemies recharge 35% faster to punish breaking stealth!
    if (isSpottedByLighthouse && this.cooldown > 0) {
      this.cooldown = Math.max(0, this.cooldown - dt * 0.35);
    }

    // Shoot if we see player and aim is roughly correct
    const aimTol = (this.diffProfile && this.diffProfile.aimTolerance) ? this.diffProfile.aimTolerance : 0.38;
    if (canSeePlayer && this.cooldown <= 0 && Math.abs(turretDiff) < aimTol) {
        this.tryShoot();
    }

    // -- 2. Movement Logic (AI) --
    if (this.config.behavior === 'STATIC') {
        this.mesh.rotation.y += Math.sin(Date.now() * 0.001) * 0.5 * dt;
        this.velocity.set(0, 0, 0);
        this.animateSuspension(dt, 0, 0);
        return; 
    }

    this.changeDirTimer -= dt;
    if (this.changeDirTimer <= 0 || (isSpottedByLighthouse && !this._wasSpottedLastFrame)) {
        this.pickNewDirection(vecToPlayer, canSeePlayer || isSpottedByLighthouse, distToPlayer);
    }
    this._wasSpottedLastFrame = isSpottedByLighthouse;

    let angleDiff = this.targetAngle - this.mesh.rotation.y;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    let forwardSpeed = 0;
    let turnRate = 0;

    if (Math.abs(angleDiff) > 0.1) {
        turnRate = Math.sign(angleDiff) * this.rotationSpeed;
        this.mesh.rotation.y += turnRate * dt;
    }
    if (Math.abs(angleDiff) < 0.65) {
        forwardSpeed = this.speed * (Math.abs(angleDiff) > 0.15 ? 0.72 : 1.0);
        const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
        const newPos = this.mesh.position.clone().add(forward.multiplyScalar(forwardSpeed * dt));
        
        if (!this.tryMoveWithSlide(newPos, collisionObstacles, entities)) {
            this.targetAngle = this.mesh.rotation.y + Math.PI * (0.8 + Math.random() * 0.4);
            this.changeDirTimer = 1.0;
            forwardSpeed = 0;
        }
    }

    if (dt > 0) {
      this.velocity.subVectors(this.mesh.position, prevPos).divideScalar(dt);
    }
    this.animateSuspension(dt, forwardSpeed, turnRate);
  }

  pickNewDirection(vecToPlayer, canSeePlayer, distToPlayer) {
      const behavior = this.config.behavior;
      this.changeDirTimer = Math.random() * 2 + 1;

      if (behavior === 'AGGRESSIVE') {
          if (canSeePlayer) {
              const angle = Math.atan2(vecToPlayer.x, vecToPlayer.z);
              this.targetAngle = angle + (Math.random() - 0.5) * 0.85; 
              this.changeDirTimer = 0.5;
          } else {
               this.targetAngle = (Math.random() * Math.PI * 2);
          }
      } 
      else if (behavior === 'TACTICAL') {
          if (canSeePlayer && distToPlayer < 20) {
               this.targetAngle = Math.atan2(-vecToPlayer.x, -vecToPlayer.z);
          } else if (!canSeePlayer) {
               this.targetAngle = (Math.random() * Math.PI * 2);
          } else {
               this.changeDirTimer = 0.5; 
               this.targetAngle = Math.atan2(vecToPlayer.x, vecToPlayer.z) + (Math.random() - 0.5) * 0.6;
          }
      }
      else {
          if (canSeePlayer) {
              if (Math.random() > 0.45) {
                  const perp = new THREE.Vector3(-vecToPlayer.z, 0, vecToPlayer.x);
                  if (Math.random() > 0.5) perp.negate();
                  this.targetAngle = Math.atan2(perp.x, perp.z);
              } else {
                   const angle = Math.atan2(vecToPlayer.x, vecToPlayer.z) + (Math.random() - 0.5) * 0.7;
                   this.targetAngle = angle;
              }
          } else {
              this.targetAngle = (Math.random() * Math.PI * 2);
          }
      }
  }
}
