
import * as THREE from 'three';

export class Tank {
  constructor(scene, x, z, color, skinConfig = null) {
    this.scene = scene;
    this.color = (skinConfig && skinConfig.bodyColor) ? skinConfig.bodyColor : color;
    this.skinConfig = skinConfig;
    this.mesh = new THREE.Group();
    this.mesh.position.set(x, 0, z);
    
    this.radius = 1.85;
    this.velocity = new THREE.Vector3();
    this.speed = 8;
    this.rotationSpeed = 3.0;
    this.cooldown = 0;
    this.maxCooldown = 0.5;
    this.needsShoot = false;
    this.warpCooldown = 0;

    // Suspension & physics tilt states
    this.chassisPitch = 0;
    this.chassisRoll = 0;
    this.recoilImpulse = 0;
    this.wheels = [];
    this.isMoving = false;
    this.exhaustTimer = 0;

    this.createModel(this.color);
    this.scene.add(this.mesh);
  }

  createModel(color) {
    // 1. Primary Chassis Group (Allows pitch/roll suspension tilt!)
    this.chassis = new THREE.Group();
    this.mesh.add(this.chassis);

    const sc = this.skinConfig || {};
    // High-gloss PBR Toy Enamel / Metallic Material
    const matBody = new THREE.MeshPhysicalMaterial({ 
        color: color, 
        roughness: sc.roughness !== undefined ? sc.roughness : 0.22, 
        metalness: sc.metalness !== undefined ? sc.metalness : 0.15,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
        emissive: sc.emissive || 0x000000,
        emissiveIntensity: sc.emissiveIntensity || 0
    });
    this.matBody = matBody;

    // Secondary Accent Trim Material
    const accentColor = sc.trimColor !== undefined ? new THREE.Color(sc.trimColor) : new THREE.Color(color).multiplyScalar(0.72);
    const matTrim = new THREE.MeshStandardMaterial({
        color: accentColor,
        roughness: sc.trimRoughness !== undefined ? sc.trimRoughness : 0.45,
        metalness: sc.trimMetalness !== undefined ? sc.trimMetalness : 0.4,
        emissive: sc.trimEmissive || 0x000000,
        emissiveIntensity: sc.trimEmissiveIntensity || 0
    });

    // Dark Rubber & Gunmetal
    const matRubber = new THREE.MeshStandardMaterial({ color: 0x1e1e22, roughness: 0.85, metalness: 0.1 });
    const matSteel = new THREE.MeshStandardMaterial({ color: 0x454a54, roughness: 0.35, metalness: 0.8 });
    const matChrome = new THREE.MeshStandardMaterial({ color: 0xd0d7de, roughness: 0.2, metalness: 0.9 });
    const matHeadlight = new THREE.MeshBasicMaterial({ color: 0xfff9c4 });

    // --- A. LOWER HULL & BEVELED ARMOR ---
    const hullGeo = new THREE.BoxGeometry(2.6, 0.95, 3.4);
    const hull = new THREE.Mesh(hullGeo, matBody);
    hull.position.y = 0.9;
    hull.castShadow = true;
    hull.receiveShadow = true;
    this.chassis.add(hull);

    // Front Glacis Sloped Armor Plate
    const glacisGeo = new THREE.BoxGeometry(2.4, 0.55, 0.9);
    const glacis = new THREE.Mesh(glacisGeo, matTrim);
    glacis.position.set(0, 1.05, 1.45);
    glacis.rotation.x = 0.35;
    glacis.castShadow = true;
    glacis.receiveShadow = true;
    this.chassis.add(glacis);

    // Rear Engine Deck Grille
    const deckGeo = new THREE.BoxGeometry(2.0, 0.18, 1.0);
    const deck = new THREE.Mesh(deckGeo, matSteel);
    deck.position.set(0, 1.4, -1.0);
    deck.castShadow = true;
    this.chassis.add(deck);

    // Twin Rear Exhaust Pipes (Brass/Steel)
    const pipeGeo = new THREE.CylinderGeometry(0.16, 0.18, 0.75, 10);
    const pipeL = new THREE.Mesh(pipeGeo, matSteel);
    pipeL.position.set(-0.7, 1.55, -1.55);
    pipeL.rotation.x = -0.25;
    this.chassis.add(pipeL);

    const pipeR = new THREE.Mesh(pipeGeo, matSteel);
    pipeR.position.set(0.7, 1.55, -1.55);
    pipeR.rotation.x = -0.25;
    this.chassis.add(pipeR);

    // Dual Front Headlights
    const lightHousingGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.15, 12);
    lightHousingGeo.rotateX(Math.PI / 2);
    [-0.85, 0.85].forEach(lx => {
      const lamp = new THREE.Mesh(lightHousingGeo, matHeadlight);
      lamp.position.set(lx, 1.15, 1.72);
      this.chassis.add(lamp);
    });

    // --- B. COMPOSITE TREADS & ROAD WHEELS ---
    const trackBeltGeo = new THREE.BoxGeometry(0.55, 0.78, 3.6);
    const fenderGeo = new THREE.BoxGeometry(0.65, 0.18, 3.75);
    const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.6, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.64, 8);
    hubGeo.rotateZ(Math.PI / 2);

    [-1.52, 1.52].forEach(sideX => {
      // Main rubber track housing
      const track = new THREE.Mesh(trackBeltGeo, matRubber);
      track.position.set(sideX, 0.45, 0);
      track.castShadow = true;
      track.receiveShadow = true;
      this.chassis.add(track);

      // Armored Side Fender Skirt
      const fender = new THREE.Mesh(fenderGeo, matTrim);
      fender.position.set(sideX, 0.9, 0);
      fender.castShadow = true;
      this.chassis.add(fender);

      // 4 Articulated Road Wheels per side
      [-1.25, -0.42, 0.42, 1.25].forEach(wz => {
        const wheelGroup = new THREE.Group();
        wheelGroup.position.set(sideX, 0.36, wz);

        const tire = new THREE.Mesh(wheelGeo, matRubber);
        const hub = new THREE.Mesh(hubGeo, matChrome);
        wheelGroup.add(tire);
        wheelGroup.add(hub);

        this.chassis.add(wheelGroup);
        this.wheels.push(wheelGroup);
      });
    });

    // --- C. TURRET & RECOILING CANNON ASSEMBLY ---
    this.turret = new THREE.Group();
    this.turret.position.set(0, 1.55, 0.05);
    this.chassis.add(this.turret);

    // Main Turret Housing
    const headGeo = new THREE.BoxGeometry(1.85, 0.78, 2.15);
    const head = new THREE.Mesh(headGeo, matBody);
    head.castShadow = true;
    head.receiveShadow = true;
    this.turret.add(head);

    // Turret Cheek Armor Bevel
    const cheekGeo = new THREE.BoxGeometry(2.0, 0.5, 1.3);
    const cheek = new THREE.Mesh(cheekGeo, matTrim);
    cheek.position.set(0, -0.02, -0.1);
    cheek.castShadow = true;
    this.turret.add(cheek);

    // Commander Cupola Hatch
    const cupolaGeo = new THREE.CylinderGeometry(0.45, 0.52, 0.28, 14);
    const cupola = new THREE.Mesh(cupolaGeo, matTrim);
    cupola.position.set(-0.35, 0.48, -0.35);
    cupola.castShadow = true;
    this.turret.add(cupola);

    // Flexible Radio Antenna with glowing tip
    const antennaGeo = new THREE.CylinderGeometry(0.03, 0.05, 1.3, 6);
    const antenna = new THREE.Mesh(antennaGeo, matChrome);
    antenna.position.set(0.65, 0.95, -0.75);
    this.turret.add(antenna);

    const tipGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const tipMat = new THREE.MeshBasicMaterial({ color: color });
    const antTip = new THREE.Mesh(tipGeo, tipMat);
    antTip.position.set(0.65, 1.62, -0.75);
    this.turret.add(antTip);

    // Gun Mantlet Shield
    const mantletGeo = new THREE.BoxGeometry(0.95, 0.58, 0.55);
    const mantlet = new THREE.Mesh(mantletGeo, matSteel);
    mantlet.position.set(0, 0.02, 1.1);
    mantlet.castShadow = true;
    this.turret.add(mantlet);

    // Recoiling Barrel Group (Main Tube + Bore Evacuator + Muzzle Brake)
    this.barrel = new THREE.Group();
    this.barrel.position.set(0, 0.02, 1.5);
    this.turret.add(this.barrel);

    const tubeGeo = new THREE.CylinderGeometry(0.24, 0.28, 2.3, 16);
    tubeGeo.rotateX(Math.PI / 2);
    const tube = new THREE.Mesh(tubeGeo, matSteel);
    tube.castShadow = true;
    this.barrel.add(tube);

    // Bore Evacuator (Fume extractor ring mid-barrel)
    const evacGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.55, 16);
    evacGeo.rotateX(Math.PI / 2);
    const evac = new THREE.Mesh(evacGeo, matTrim);
    evac.position.z = 0.2;
    evac.castShadow = true;
    this.barrel.add(evac);

    // Heavy Muzzle Brake Collar at Tip
    const brakeGeo = new THREE.CylinderGeometry(0.36, 0.32, 0.42, 16);
    brakeGeo.rotateX(Math.PI / 2);
    const brake = new THREE.Mesh(brakeGeo, matRubber);
    brake.position.z = 1.05;
    brake.castShadow = true;
    this.barrel.add(brake);
  }

  // Animate wheels and suspension tilt based on movement & recoil
  animateSuspension(dt, forwardSpeed = 0, turnSpeed = 0) {
    this.isMoving = Math.abs(forwardSpeed) > 0.2 || Math.abs(turnSpeed) > 0.2;

    // Spin road wheels
    const wheelRot = (forwardSpeed * dt * 2.2);
    if (this.wheels && this.wheels.length > 0) {
      this.wheels.forEach((w, idx) => {
        const sideFactor = idx < 4 ? 1 : -1;
        w.rotation.x += wheelRot + (turnSpeed * sideFactor * dt * 0.8);
      });
    }

    // Recover recoil pitch
    if (this.recoilImpulse > 0) {
      this.recoilImpulse = Math.max(0, this.recoilImpulse - dt * 6.0);
    }

    // Pitch forward/back on acceleration + kick back on cannon recoil
    const targetPitch = (-forwardSpeed * 0.006) - (this.recoilImpulse * 0.14);
    const targetRoll = (turnSpeed * 0.025);

    this.chassisPitch += (targetPitch - this.chassisPitch) * Math.min(1, dt * 12);
    this.chassisRoll += (targetRoll - this.chassisRoll) * Math.min(1, dt * 12);

    if (this.chassis) {
      this.chassis.rotation.x = this.chassisPitch;
      this.chassis.rotation.z = this.chassisRoll;
    }
  }

  // Helper: 2D distance squared from point (px, pz) to segment (ax, az)-(bx, bz)
  distToSegmentSq2D(px, pz, ax, az, bx, bz) {
      const abx = bx - ax;
      const abz = bz - az;
      const apx = px - ax;
      const apz = pz - az;
      const lenSq = abx * abx + abz * abz;
      let t = lenSq > 0.0001 ? (apx * abx + apz * abz) / lenSq : 0;
      t = Math.max(0, Math.min(1, t));
      const cx = ax + t * abx;
      const cz = az + t * abz;
      const dx = px - cx;
      const dz = pz - cz;
      return dx * dx + dz * dz;
  }

  // Helper: Check if point (px, pz) is inside 2D triangle (p0, p1, p2)
  pointInTriangle2D(px, pz, p0, p1, p2) {
      const d1 = (px - p1.x) * (p0.z - p1.z) - (p0.x - p1.x) * (pz - p1.z);
      const d2 = (px - p2.x) * (p1.z - p2.z) - (p1.x - p2.x) * (pz - p2.z);
      const d3 = (px - p0.x) * (p2.z - p0.z) - (p2.x - p0.x) * (pz - p0.z);
      const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
      const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
      return !(hasNeg && hasPos);
  }

  checkCollision(newPos, walls, entities) {
      const px = newPos.x;
      const pz = newPos.z;

      for (const wall of walls) {
          if (!wall || !wall.parent || !wall.userData || !wall.userData.bounds) continue;

          // 1. Exact 2D Triangle Prism Collision ('T') — compact inset triangle so tanks pass smoothly between adjacent triangles & along diagonals
          if (wall.userData.triPoints && wall.userData.triPoints.length === 3) {
              const box = wall.userData.bounds;
              if (
                  px + this.radius < box.min.x ||
                  px - this.radius > box.max.x ||
                  pz + this.radius < box.min.z ||
                  pz - this.radius > box.max.z
              ) {
                  continue;
              }
              const [p0, p1, p2] = wall.userData.triPoints;
              if (this.pointInTriangle2D(px, pz, p0, p1, p2)) return true;

              const d0 = this.distToSegmentSq2D(px, pz, p0.x, p0.z, p1.x, p1.z);
              const d1 = this.distToSegmentSq2D(px, pz, p1.x, p1.z, p2.x, p2.z);
              const d2 = this.distToSegmentSq2D(px, pz, p2.x, p2.z, p0.x, p0.z);
              const minDistSq = Math.min(d0, d1, d2);
              const effRadius = this.radius * 0.46;
              if (minDistSq < effRadius * effRadius) return true;
              continue;
          }

          // 2. Exact 2D Circular Collision for round obstacles (Trees, Cylinders, Barrels, Lighthouses, Prisms)
          if (wall.userData.collisionRadius) {
              const dx = px - wall.position.x;
              const dz = pz - wall.position.z;
              const minSum = this.radius * 0.85 + wall.userData.collisionRadius;
              if (dx * dx + dz * dz < minSum * minSum) return true;
              continue;
          }

          // 3. Standard Box AABB Collision (slightly beveled corners so tanks never snag when turning)
          const box = wall.userData.bounds;
          const inset = (wall.userData.type === 'wall' || wall.userData.type === 'stone' || wall.userData.type === 'cork') ? 0.22 : 0;
          const minX = box.min.x + inset;
          const maxX = box.max.x - inset;
          const minZ = box.min.z + inset;
          const maxZ = box.max.z - inset;
          const x = Math.max(minX, Math.min(px, maxX));
          const z = Math.max(minZ, Math.min(pz, maxZ));
          const distance = Math.sqrt((x - px) * (x - px) + (z - pz) * (z - pz));
          
          if (distance < this.radius * 0.90) return true;
      }

      for (const entity of entities) {
          if (!entity || entity === this || entity.isDead) continue;
          if (!entity.mesh || !entity.mesh.parent) continue;
          if (entity.hp !== undefined && entity.hp <= 0) continue;

          const dx = px - entity.mesh.position.x;
          const dz = pz - entity.mesh.position.z;
          const minDist = (this.radius + entity.radius) * 0.92;
          if (dx * dx + dz * dz < minDist * minDist) return true;
      }
      return false;
  }

  // Smooth multi-angle & diagonal wall-sliding so tanks glide past angled triangle prisms and narrow gaps without snagging
  tryMoveWithSlide(newPos, collisionObstacles, entities) {
      if (!this.checkCollision(newPos, collisionObstacles, entities)) {
          this.mesh.position.copy(newPos);
          return true;
      }

      const curX = this.mesh.position.x;
      const curZ = this.mesh.position.z;
      const dx = newPos.x - curX;
      const dz = newPos.z - curZ;

      // Try axis-aligned slides first if nearly axis-aligned, or multi-angle deflections (25°, 45°, 65°, 80°) for diagonal prisms
      const candidateAngles = [0.42, -0.42, 0.78, -0.78, 1.12, -1.12, 1.42, -1.42];
      const testPos = newPos.clone();

      for (let i = 0; i < candidateAngles.length; i++) {
          const ang = candidateAngles[i];
          const c = Math.cos(ang);
          const s = Math.sin(ang);
          const scale = Math.max(0.45, Math.abs(c));
          testPos.x = curX + (dx * c - dz * s) * scale;
          testPos.z = curZ + (dx * s + dz * c) * scale;
          if (!this.checkCollision(testPos, collisionObstacles, entities)) {
              this.mesh.position.copy(testPos);
              return true;
          }
      }

      const slideX = this.mesh.position.clone();
      slideX.x = newPos.x;
      if (!this.checkCollision(slideX, collisionObstacles, entities)) {
          this.mesh.position.copy(slideX);
          return true;
      }

      const slideZ = this.mesh.position.clone();
      slideZ.z = newPos.z;
      if (!this.checkCollision(slideZ, collisionObstacles, entities)) {
          this.mesh.position.copy(slideZ);
          return true;
      }

      return false;
  }

  updateCooldown(dt) {
      if (this.cooldown > 0) this.cooldown -= dt;
      if (this.barrel && this.barrel.position.z < 1.5) {
          this.barrel.position.z += dt * 4.5;
          if (this.barrel.position.z > 1.5) this.barrel.position.z = 1.5;
      }
  }

  tryShoot() {
      if (this.cooldown <= 0) {
          this.needsShoot = true;
          this.cooldown = this.maxCooldown;
          this.recoilImpulse = 1.0;
          if (this.barrel) {
              this.barrel.position.z = 0.85; // Strong mechanical recoil kickback
          }
          return true;
      }
      return false;
  }
}
