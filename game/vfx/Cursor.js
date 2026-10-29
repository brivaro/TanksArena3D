import * as THREE from 'three';

export class Cursor {
  constructor(scene) {
    this.scene = scene;
    this.visible = true;
    this.raycaster = new THREE.Raycaster();

    // High Contrast Neon Material (Always visible on top)
    this.mat = new THREE.MeshBasicMaterial({ 
        color: 0x00E5FF, // Neon Cyan
        side: THREE.DoubleSide,
        depthTest: false,
        transparent: true,
        opacity: 0.95
    });

    // Outer Target Ring
    const ringGeo = new THREE.RingGeometry(1.4, 1.8, 32);
    this.mesh = new THREE.Mesh(ringGeo, this.mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.5;
    this.mesh.renderOrder = 999;

    // Center Dot
    const dotGeo = new THREE.CircleGeometry(0.35, 16);
    const dot = new THREE.Mesh(dotGeo, this.mat);
    dot.position.z = 0.01;
    this.mesh.add(dot);

    // Crosshair ticks
    const tickGeo = new THREE.PlaneGeometry(0.25, 0.9);
    for (let i = 0; i < 4; i++) {
      const tick = new THREE.Mesh(tickGeo, this.mat);
      const angle = (i * Math.PI) / 2;
      tick.position.set(Math.cos(angle) * 2.3, Math.sin(angle) * 2.3, 0.01);
      tick.rotation.z = angle;
      this.mesh.add(tick);
    }

    // Primary Laser Aim Dashed Line
    const lineMat = new THREE.LineDashedMaterial({
      color: 0x00E5FF,
      dashSize: 1.1,
      gapSize: 0.65,
      depthTest: false,
      transparent: true,
      opacity: 0.72
    });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.5, 0),
      new THREE.Vector3(0, 0.5, 0)
    ]);
    this.aimLine = new THREE.Line(lineGeo, lineMat);
    this.aimLine.renderOrder = 998;
    this.scene.add(this.aimLine);

    // Secondary Ricochet Bounce Prediction Line (Golden Amber / Cyan)
    const bounceMat = new THREE.LineDashedMaterial({
      color: 0xFFD54F,
      dashSize: 0.85,
      gapSize: 0.55,
      depthTest: false,
      transparent: true,
      opacity: 0.65
    });
    const bounceGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.5, 0),
      new THREE.Vector3(0, 0.5, 0)
    ]);
    this.bounceLine = new THREE.Line(bounceGeo, bounceMat);
    this.bounceLine.renderOrder = 998;
    this.bounceLine.visible = false;
    this.scene.add(this.bounceLine);

    // Ricochet Node Ring at Wall Impact Point
    const nodeGeo = new THREE.RingGeometry(0.45, 0.72, 20);
    const nodeMat = new THREE.MeshBasicMaterial({
      color: 0xFFD54F,
      side: THREE.DoubleSide,
      depthTest: false,
      transparent: true,
      opacity: 0.85
    });
    this.bounceNode = new THREE.Mesh(nodeGeo, nodeMat);
    this.bounceNode.rotation.x = -Math.PI / 2;
    this.bounceNode.renderOrder = 999;
    this.bounceNode.visible = false;
    this.scene.add(this.bounceNode);

    this.scene.add(this.mesh);
  }

  setVisible(visible) {
    this.visible = visible;
    this.mesh.visible = visible;
    if (this.aimLine) this.aimLine.visible = visible;
    if (!visible) {
      if (this.bounceLine) this.bounceLine.visible = false;
      if (this.bounceNode) this.bounceNode.visible = false;
    }
  }

  update(mousePos, playerPos, walls = [], destructibles = []) {
    if (!this.visible || !mousePos) {
      this.mesh.visible = false;
      if (this.aimLine) this.aimLine.visible = false;
      if (this.bounceLine) this.bounceLine.visible = false;
      if (this.bounceNode) this.bounceNode.visible = false;
      return;
    }

    this.mesh.visible = true;
    const time = performance.now() * 0.005;

    this.mesh.position.x = mousePos.x;
    this.mesh.position.z = mousePos.z;

    // Predictive Laser & 1-Bounce Ricochet Trajectory Calculation
    if (playerPos && this.aimLine) {
      const start = new THREE.Vector3(playerPos.x, 1.3, playerPos.z);
      const target = new THREE.Vector3(mousePos.x, 1.3, mousePos.z);
      const dir = new THREE.Vector3().subVectors(target, start);
      const maxDist = Math.max(dir.length(), 42);
      dir.normalize();

      this.raycaster.set(start, dir);
      this.raycaster.far = maxDist;

      const allObstacles = [...walls, ...destructibles];
      const hits = allObstacles.length > 0 ? this.raycaster.intersectObjects(allObstacles, true) : [];

      if (hits.length > 0) {
        const firstHit = hits[0];
        const hitPoint = new THREE.Vector3(firstHit.point.x, 0.9, firstHit.point.z);
        this.aimLine.visible = true;
        this.aimLine.geometry.setFromPoints([
          new THREE.Vector3(start.x, 0.9, start.z),
          hitPoint
        ]);
        this.aimLine.computeLineDistances();

        // Check if it hits an indestructible bounce wall (not destructible cork/barrel)
        const hitObj = firstHit.object;
        const isDestructible = destructibles.includes(hitObj) || (hitObj.parent && destructibles.includes(hitObj.parent));

        if (!isDestructible && firstHit.face) {
          const normal = firstHit.face.normal.clone().transformDirection(hitObj.matrixWorld).normalize();
          normal.y = 0;
          normal.normalize();

          const reflectDir = dir.clone().reflect(normal);
          reflectDir.y = 0;
          reflectDir.normalize();

          const bounceEnd = hitPoint.clone().add(reflectDir.multiplyScalar(18));
          this.bounceLine.visible = true;
          this.bounceLine.geometry.setFromPoints([hitPoint, bounceEnd]);
          this.bounceLine.computeLineDistances();

          this.bounceNode.visible = true;
          this.bounceNode.position.set(hitPoint.x, 0.55, hitPoint.z);
          this.bounceNode.rotation.z = -time * 1.5;
        } else {
          this.bounceLine.visible = false;
          this.bounceNode.visible = false;
        }
      } else {
        this.aimLine.visible = true;
        this.aimLine.geometry.setFromPoints([
          new THREE.Vector3(start.x, 0.9, start.z),
          new THREE.Vector3(mousePos.x, 0.5, mousePos.z)
        ]);
        this.aimLine.computeLineDistances();
        this.bounceLine.visible = false;
        this.bounceNode.visible = false;
      }
    } else if (this.aimLine) {
      this.aimLine.visible = false;
      this.bounceLine.visible = false;
      this.bounceNode.visible = false;
    }

    // Constant slow rotation for arcade feel
    this.mesh.rotation.z += 0.035;

    // Pulsing breathing effect
    const scale = 1.0 + Math.sin(time) * 0.12;
    this.mesh.scale.set(scale, scale, 1);
  }

  dispose() {
    this.scene.remove(this.mesh);
    if (this.aimLine) this.scene.remove(this.aimLine);
    if (this.bounceLine) this.scene.remove(this.bounceLine);
    if (this.bounceNode) this.scene.remove(this.bounceNode);
  }
}
