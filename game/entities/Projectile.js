
import * as THREE from 'three';
import { EnemyTank } from './EnemyTank.js';
import { PlayerTank } from './PlayerTank.js';

export class Projectile {
  constructor(scene, startPos, rotationY, owner) {
    this.scene = scene;
    this.owner = owner;
    this.speed = 22;
    this.radius = 0.3;
    this.bounces = 0;
    this.maxBounces = 2; 
    this.hitTarget = null;
    this.hitDestructible = null;
    this.hitMine = null;
    this.isDead = false; // Flag for external managers
    this.raycaster = new THREE.Raycaster();

    // Improved Geometry: Glowing Capsule
    // Capsule Geometry (radius, length, capSubdivisions, radialSegments)
    const geo = new THREE.CapsuleGeometry(this.radius, 0.6, 4, 8);
    const mat = new THREE.MeshPhysicalMaterial({ 
        color: 0xFFFFFF, 
        emissive: 0xFFD700, // Gold glow
        emissiveIntensity: 0.8,
        roughness: 0.1,
        metalness: 0.2
    });
    this.mesh = new THREE.Mesh(geo, mat);
    
    // Align with turret barrel height
    const barrelOffset = new THREE.Vector3(0, 1.3, 1.5);
    const totalRotation = owner.mesh.rotation.y + rotationY;
    
    barrelOffset.applyAxisAngle(new THREE.Vector3(0,1,0), totalRotation);
    this.mesh.position.copy(startPos).add(barrelOffset);

    // Rotate the capsule to face forward (Z-axis)
    // Capsule is Y-up by default. Rotate X by 90deg makes it Z-forward.
    // Then apply the Y rotation of the tank.
    this.mesh.rotation.order = 'YXZ';
    this.mesh.rotation.x = Math.PI / 2; 
    this.mesh.rotation.y = totalRotation;

    this.velocity = new THREE.Vector3(0, 0, 1)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), totalRotation)
        .multiplyScalar(this.speed);

    this.scene.add(this.mesh);
  }

  update(dt, walls, destructibles, entities, mines = [], onBounce = null) {
    if (this.isDead) return false;

    const moveDist = this.speed * dt;
    const moveDir = this.velocity.clone().normalize();
    
    // 1. Check collision with Raycaster
    this.raycaster.set(this.mesh.position, moveDir);
    this.raycaster.far = moveDist; 

    // Combine all potential hit objects
    const validEntities = entities
        .filter(e => e.mesh && (e !== this.owner || this.bounces > 0))
        .map(e => e.mesh);

    const mineMeshes = mines.map(m => m.mesh);

    const obstacles = [...walls, ...destructibles, ...validEntities, ...mineMeshes];
    
    const hits = this.raycaster.intersectObjects(obstacles);

    if (hits.length > 0) {
        const hit = hits[0];
        const hitObj = hit.object;

        // Move bullet to the hit point
        this.mesh.position.copy(hit.point);

        // Identify what we hit
        
        // Is it a Mine?
        const mineHit = mines.find(m => m.mesh === hitObj || m.mesh === hitObj.parent);
        if (mineHit) {
            this.hitMine = mineHit;
            return false; // Die and trigger explosion
        }

        // Is it a Tank?
        let hitTank = entities.find(e => e.mesh === hitObj || e.mesh === hitObj.parent);
        if (!hitTank) {
             // traverse up
             hitObj.traverseAncestors((ancestor) => {
                 const t = entities.find(e => e.mesh === ancestor);
                 if(t) hitTank = t;
             });
        }

        if (hitTank) {
            this.hitTarget = hitTank;
            return false; // Die
        }

        // Is it a Destructible (Cork)?
        const isCork = destructibles.includes(hitObj);
        if (isCork) {
            this.hitDestructible = hitObj;
            return false; // Die
        }

        // It must be a Wall/Indestructible
        if (this.bounces < this.maxBounces) {
            this.bounces++;

            // Reflect Velocity using the face normal
            // formula: v = v - 2 * (v . n) * n
            if (hit.face) {
                const n = hit.face.normal.clone().transformDirection(hitObj.matrixWorld).normalize();
                this.velocity.reflect(n);
                
                // Update rotation to face new direction
                const angle = Math.atan2(this.velocity.x, this.velocity.z);
                this.mesh.rotation.y = angle;
                
                // Push slightly out along the normal to prevent sticking
                this.mesh.position.add(n.multiplyScalar(0.1));
                
                if (onBounce) onBounce();
            } else {
                // Fallback
                this.velocity.negate();
                this.mesh.rotation.y += Math.PI;
                if (onBounce) onBounce();
            }
            return true; // Keep alive
        } else {
            return false; // Too many bounces, die
        }
    } else {
        // No hit, move normally
        this.mesh.position.add(this.velocity.clone().multiplyScalar(dt));
    }

    if (this.mesh.position.length() > 150) return false; // Out of bounds safety
    return true;
  }
}
