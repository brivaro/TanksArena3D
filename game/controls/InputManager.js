
import * as THREE from 'three';

export class InputManager {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    
    this.keys = {};
    this.mouse = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.mousePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Ground plane
    this.mouseWorldPos = new THREE.Vector3();
    
    this.isMouseDown = false;
    this.shouldShoot = false;
    this.shouldMine = false;

    this.initListeners();
  }

  initListeners() {
    window.addEventListener('keydown', (e) => {
        this.keys[e.code] = true;
        if (e.code === 'Space') this.shouldMine = true;
    });
    window.addEventListener('keyup', (e) => this.keys[e.code] = false);
    
    window.addEventListener('mousemove', (e) => {
      // Normalize mouse coordinates
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      
      // Update raycaster immediately for responsiveness
      this.updateRaycaster();
    });

    window.addEventListener('mousedown', () => {
      this.isMouseDown = true;
      this.shouldShoot = true;
    });
    
    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
      this.shouldShoot = false;
    });
  }

  updateRaycaster() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    this.raycaster.ray.intersectPlane(this.mousePlane, this.mouseWorldPos);
  }

  getMovementVector() {
    const move = { forward: 0, turn: 0 };
    
    if (this.keys['KeyW'] || this.keys['ArrowUp']) move.forward += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) move.forward -= 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) move.turn += 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) move.turn -= 1;
    
    return move;
  }

  getAimPosition() {
    return this.mouseWorldPos;
  }

  checkShoot() {
    if (this.shouldShoot) {
      this.shouldShoot = false; // Consume the click
      return true;
    }
    return false;
  }

  checkMine() {
      if (this.shouldMine) {
          this.shouldMine = false;
          return true;
      }
      return false;
  }
}
