
import * as THREE from 'three';

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
    this.raycaster = new THREE.Raycaster();
    this.trailTimer = 0;
    this.warpCooldown = 0;

    this.isPlayerBullet = (owner && owner.constructor && owner.constructor.name === 'PlayerTank');
    const isBossBullet = (owner && owner.isBoss);

    // Composite Glowing Tracer Shell Group
    this.mesh = new THREE.Group();

    const coreGeo = new THREE.CapsuleGeometry(this.radius * (isBossBullet ? 1.15 : 0.85), 0.72, 6, 12);
    const coreMat = new THREE.MeshPhysicalMaterial({ 
        color: 0xFFFFFF, 
        emissive: this.isPlayerBullet ? 0x00E5FF : (isBossBullet ? 0xFF1744 : 0xFF3D00),
        emissiveIntensity: 1.8,
        roughness: 0.1,
        metalness: 0.2
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    this.mesh.add(core);

    // Outer Plasma Aura Halo
    const auraGeo = new THREE.CapsuleGeometry(this.radius * (isBossBullet ? 1.65 : 1.35), 0.85, 6, 10);
    const auraMat = new THREE.MeshBasicMaterial({
        color: this.isPlayerBullet ? 0x00E5FF : (isBossBullet ? 0xFF1744 : 0xFF6D00),
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const aura = new THREE.Mesh(auraGeo, auraMat);
    this.mesh.add(aura);

    // Dynamic PointLight on Projectile to illuminate ground & walls as it flies
    const lightColor = this.isPlayerBullet ? 0x00e5ff : (isBossBullet ? 0xff1744 : 0xff5722);
    this.light = new THREE.PointLight(lightColor, 1.2, 8.5, 2.0);
    this.mesh.add(this.light);

    // Align with turret barrel height
    const barrelOffset = new THREE.Vector3(0, 1.3, isBossBullet ? 2.6 : 1.6);
    const totalRotation = owner.mesh.rotation.y + rotationY + angleOffset;
    
    barrelOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), totalRotation);
    this.mesh.position.copy(startPos).add(barrelOffset);

    // Orient capsule along Z-forward
    this.mesh.rotation.order = 'YXZ';
    this.mesh.rotation.x = Math.PI / 2; 
    this.mesh.rotation.y = totalRotation;

    if (owner && owner.bulletSpeedMultiplier) {
        this.speed *= owner.bulletSpeedMultiplier;
    }

    this.velocity = new THREE.Vector3(0, 0, 1)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), totalRotation)
        .multiplyScalar(this.speed);

    this.scene.add(this.mesh);
  }

  update(dt, walls, destructibles, entities, mines = [], onBounce = null) {
    if (this.isDead) return false;
    if (this.warpCooldown > 0) this.warpCooldown -= dt;

    const moveDist = this.speed * dt;
    const moveDir = this.velocity.clone().normalize();
    
    // 1. Check collision with Raycaster
    this.raycaster.set(this.mesh.position, moveDir);
    this.raycaster.far = Math.max(moveDist, 0.25); 

    const validEntities = entities
        .filter(e => e.mesh && (e !== this.owner || this.bounces > 0))
        .map(e => e.mesh);

    const mineMeshes = mines.map(m => m.mesh);
    const obstacles = [...walls, ...destructibles, ...validEntities, ...mineMeshes];
    
    const hits = this.raycaster.intersectObjects(obstacles, true);

    if (hits.length > 0) {
        const hit = hits[0];
        const hitObj = hit.object;

        this.mesh.position.copy(hit.point);

        // 1. Is it a Mine?
        const mineHit = mines.find(m => {
            if (!m.mesh) return false;
            return m.mesh === hitObj || m.mesh === hitObj.parent || m.mesh.children.includes(hitObj);
        });
        if (mineHit) {
            this.hitMine = mineHit;
            return false;
        }

        // 2. Is it a Tank?
        let hitTank = entities.find(e => {
            if (!e.mesh) return false;
            return e.mesh === hitObj || e.mesh === hitObj.parent;
        });
        if (!hitTank) {
            hitObj.traverseAncestors((ancestor) => {
                const t = entities.find(e => e.mesh === ancestor);
                if (t) hitTank = t;
            });
        }

        if (hitTank && (hitTank !== this.owner || this.bounces > 0)) {
            this.hitTarget = hitTank;
            return false;
        }

        // 3. Is it a Destructible (Cork / Barrel / Crate)?
        let isCork = destructibles.includes(hitObj);
        if (!isCork && hitObj.parent) {
            isCork = destructibles.includes(hitObj.parent);
        }
        if (isCork) {
            this.hitDestructible = destructibles.includes(hitObj) ? hitObj : hitObj.parent;
            return false;
        }

        // 4. Indestructible Wall / Obstacle Bounce
        this.hitObstacle = hitObj;
        if (this.bounces < this.maxBounces) {
            this.bounces++;

            if (hit.face) {
                const n = hit.face.normal.clone().transformDirection(hitObj.matrixWorld).normalize();
                this.velocity.reflect(n);
                
                this.velocity.y = 0;
                this.velocity.normalize().multiplyScalar(this.speed);

                const angle = Math.atan2(this.velocity.x, this.velocity.z);
                this.mesh.rotation.y = angle;
                
                this.mesh.position.add(n.multiplyScalar(0.16));
                
                if (onBounce) onBounce(hitObj, hit.point);
            } else {
                this.velocity.negate();
                this.velocity.y = 0;
                this.mesh.rotation.y += Math.PI;
                if (onBounce) onBounce(hitObj, hit.point);
            }
            return true;
        } else {
            if (onBounce) onBounce(hitObj, hit.point);
            return false;
        }
    } else {
        this.mesh.position.add(this.velocity.clone().multiplyScalar(dt));
    }

    this.mesh.position.y = 1.3;

    if (this.mesh.position.length() > 220) return false;
    return true;
  }
}
