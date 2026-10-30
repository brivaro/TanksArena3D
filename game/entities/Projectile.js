import * as THREE from 'three';

// Pre-allocated shared geometries and materials (Zero GPU buffer/shader allocations per shot!)
const _coreGeoNormal = new THREE.CapsuleGeometry(0.35 * 0.85, 0.72, 6, 10);
const _coreGeoBoss = new THREE.CapsuleGeometry(0.35 * 1.15, 0.72, 6, 10);
const _auraGeoNormal = new THREE.CapsuleGeometry(0.35 * 1.35, 0.85, 6, 8);
const _auraGeoBoss = new THREE.CapsuleGeometry(0.35 * 1.65, 0.85, 6, 8);
const _glowDiscGeo = new THREE.CircleGeometry(1.6, 12);
_glowDiscGeo.rotateX(-Math.PI / 2);

const _matCorePlayer = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: 0x00e5ff,
  emissiveIntensity: 1.8,
  roughness: 0.15,
  metalness: 0.2
});
const _matCoreEnemy = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: 0xff3d00,
  emissiveIntensity: 1.8,
  roughness: 0.15,
  metalness: 0.2
});
const _matCoreBoss = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: 0xff1744,
  emissiveIntensity: 1.9,
  roughness: 0.15,
  metalness: 0.2
});

const _matAuraPlayer = new THREE.MeshBasicMaterial({
  color: 0x00e5ff,
  transparent: true,
  opacity: 0.38,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});
const _matAuraEnemy = new THREE.MeshBasicMaterial({
  color: 0xff6d00,
  transparent: true,
  opacity: 0.38,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});
const _matAuraBoss = new THREE.MeshBasicMaterial({
  color: 0xff1744,
  transparent: true,
  opacity: 0.42,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});

const _matGlowDiscPlayer = new THREE.MeshBasicMaterial({
  color: 0x00e5ff,
  transparent: true,
  opacity: 0.18,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});
const _matGlowDiscEnemy = new THREE.MeshBasicMaterial({
  color: 0xff5722,
  transparent: true,
  opacity: 0.18,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});

// Reusable scratch math objects (Zero GC inside update loop)
const _upAxis = new THREE.Vector3(0, 1, 0);
const _moveDir = new THREE.Vector3();
const _normalVec = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _nearbyObstacles = [];

export class Projectile {
  constructor(scene, startPos, rotationY, owner, angleOffset = 0) {
    this.scene = scene;
    this.owner = owner;
    this.speed = 25;
    this.radius = 0.35;
    this.bounces = 0;
    this.maxBounces = (owner && owner.bonusBounces) ? 2 + owner.bonusBounces : 2; 
    this.hitTarget = null;
    this.hitDestructible = null;
    this.hitMine = null;
    this.isDead = false;
    this.trailTimer = 0;
    this.warpCooldown = 0;

    this.isPlayerBullet = (owner && owner.constructor && owner.constructor.name === 'PlayerTank');
    const isBossBullet = Boolean(owner && owner.isBoss);

    // Composite Glowing Tracer Shell Group using shared geometries/materials
    this.mesh = new THREE.Group();

    const coreGeo = isBossBullet ? _coreGeoBoss : _coreGeoNormal;
    const coreMat = this.isPlayerBullet ? _matCorePlayer : (isBossBullet ? _matCoreBoss : _matCoreEnemy);
    const core = new THREE.Mesh(coreGeo, coreMat);
    this.mesh.add(core);

    // Outer Plasma Aura Halo
    const auraGeo = isBossBullet ? _auraGeoBoss : _auraGeoNormal;
    const auraMat = this.isPlayerBullet ? _matAuraPlayer : (isBossBullet ? _matAuraBoss : _matAuraEnemy);
    const aura = new THREE.Mesh(auraGeo, auraMat);
    this.mesh.add(aura);

    // Zero-cost ground glow halo (replaces dynamic PointLight so shaders NEVER recompile when shooting!)
    this.groundGlow = new THREE.Mesh(_glowDiscGeo, this.isPlayerBullet ? _matGlowDiscPlayer : _matGlowDiscEnemy);

    // Align with turret barrel height
    const barrelOffset = new THREE.Vector3(0, 1.3, isBossBullet ? 2.6 : 1.6);
    const totalRotation = owner.mesh.rotation.y + rotationY + angleOffset;
    
    barrelOffset.applyAxisAngle(_upAxis, totalRotation);
    this.mesh.position.copy(startPos).add(barrelOffset);

    // Orient capsule along Z-forward
    this.mesh.rotation.order = 'YXZ';
    this.mesh.rotation.x = Math.PI / 2; 
    this.mesh.rotation.y = totalRotation;

    if (owner && owner.bulletSpeedMultiplier) {
        this.speed *= owner.bulletSpeedMultiplier;
    }

    this.velocity = new THREE.Vector3(0, 0, 1)
        .applyAxisAngle(_upAxis, totalRotation)
        .multiplyScalar(this.speed);

    this.scene.add(this.mesh);
  }

  update(dt, walls, destructibles, entities, mines = [], onBounce = null) {
    if (this.isDead) return false;
    if (this.warpCooldown > 0) this.warpCooldown -= dt;

    const moveDist = this.speed * dt;
    const pos = this.mesh.position;
    const px = pos.x;
    const pz = pos.z;

    // 1. Fast Analytical Hit Check against Mines & Tanks (Avoids raycasting 40+ child meshes per tank!)
    const stepX = this.velocity.x * dt;
    const stepZ = this.velocity.z * dt;
    const nextX = px + stepX;
    const nextZ = pz + stepZ;
    const segLenSq = stepX * stepX + stepZ * stepZ;

    // Check Mines first
    for (let i = 0; i < mines.length; i++) {
      const m = mines[i];
      if (!m.mesh) continue;
      const mx = m.mesh.position.x;
      const mz = m.mesh.position.z;
      let t = segLenSq > 0.00001 ? ((mx - px) * stepX + (mz - pz) * stepZ) / segLenSq : 0;
      t = Math.max(0, Math.min(1, t));
      const cx = px + t * stepX - mx;
      const cz = pz + t * stepZ - mz;
      if (cx * cx + cz * cz <= 2.35) { // ~1.53 hit radius
        pos.x = px + t * stepX;
        pos.z = pz + t * stepZ;
        this.hitMine = m;
        return false;
      }
    }

    // Check Tanks (Player & Enemies)
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (!e.mesh || (e === this.owner && this.bounces === 0)) continue;
      const ex = e.mesh.position.x;
      const ez = e.mesh.position.z;
      const hitRad = (e.radius || 1.85) * 0.92 + this.radius;
      let t = segLenSq > 0.00001 ? ((ex - px) * stepX + (ez - pz) * stepZ) / segLenSq : 0;
      t = Math.max(0, Math.min(1, t));
      const cx = px + t * stepX - ex;
      const cz = pz + t * stepZ - ez;
      if (cx * cx + cz * cz <= hitRad * hitRad) {
        pos.x = px + t * stepX;
        pos.z = pz + t * stepZ;
        this.hitTarget = e;
        return false;
      }
    }

    // 2. Fast Broadphase Filtering for Walls & Destructibles (Only raycast objects right in front of the bullet!)
    _nearbyObstacles.length = 0;
    const reach = Math.max(moveDist, 0.35) + 0.85;
    const minX = Math.min(px, nextX) - reach;
    const maxX = Math.max(px, nextX) + reach;
    const minZ = Math.min(pz, nextZ) - reach;
    const maxZ = Math.max(pz, nextZ) + reach;

    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      const b = w.userData && w.userData.bounds;
      if (b) {
        if (b.max.x >= minX && b.min.x <= maxX && b.max.z >= minZ && b.min.z <= maxZ) {
          _nearbyObstacles.push(w);
        }
      } else {
        _nearbyObstacles.push(w);
      }
    }

    for (let i = 0; i < destructibles.length; i++) {
      const d = destructibles[i];
      if (_nearbyObstacles.includes(d)) continue;
      const b = d.userData && d.userData.bounds;
      if (b) {
        if (b.max.x >= minX && b.min.x <= maxX && b.max.z >= minZ && b.min.z <= maxZ) {
          _nearbyObstacles.push(d);
        }
      } else {
        _nearbyObstacles.push(d);
      }
    }

    if (_nearbyObstacles.length > 0) {
      _moveDir.copy(this.velocity).normalize();
      _raycaster.set(pos, _moveDir);
      _raycaster.far = Math.max(moveDist, 0.25);

      const hits = _raycaster.intersectObjects(_nearbyObstacles, true);

      // Ignore non-solid visual effects (like lighthouse light beams)
      let hit = null;
      for (let i = 0; i < hits.length; i++) {
        if (!hits[i].object.userData || !hits[i].object.userData.isEffect) {
          hit = hits[i];
          break;
        }
      }

      if (hit) {
        const hitObj = hit.object;
        pos.copy(hit.point);

        // Is it a Destructible (Cork / Barrel / Crate)?
        let isCork = destructibles.includes(hitObj);
        if (!isCork && hitObj.parent) {
          isCork = destructibles.includes(hitObj.parent);
        }
        if (isCork) {
          this.hitDestructible = destructibles.includes(hitObj) ? hitObj : hitObj.parent;
          return false;
        }

        // Indestructible Wall / Obstacle Bounce
        this.hitObstacle = hitObj;
        if (this.bounces < this.maxBounces) {
          this.bounces++;

          if (hit.face) {
            _normalVec.copy(hit.face.normal).transformDirection(hitObj.matrixWorld).normalize();
            this.velocity.reflect(_normalVec);
            this.velocity.y = 0;
            this.velocity.normalize().multiplyScalar(this.speed);

            this.mesh.rotation.y = Math.atan2(this.velocity.x, this.velocity.z);
            pos.addScaledVector(_normalVec, 0.16);

            if (onBounce) onBounce(hitObj, hit.point);
          } else {
            this.velocity.negate();
            this.velocity.y = 0;
            this.mesh.rotation.y += Math.PI;
            if (onBounce) onBounce(hitObj, hit.point);
          }
          pos.y = 1.3;
          return true;
        } else {
          if (onBounce) onBounce(hitObj, hit.point);
          return false;
        }
      }
    }

    pos.x = nextX;
    pos.z = nextZ;
    pos.y = 1.3;

    if (pos.x * pos.x + pos.z * pos.z > 48400) return false;
    return true;
  }
}

