
import * as THREE from 'three';

export class InputManager {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;

    this.keys = {};
    this.mouse = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.mousePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Ground plane
    this.mouseWorldPos = new THREE.Vector3(0, 0, 0);

    // Mobile / Touch Virtual Controls State
    this.isTouchDevice = false;
    this.virtualJoystick = { x: 0, y: 0, active: false }; // Normalized [-1, 1]
    this.virtualAimStick = { x: 0, y: 0, active: false, distance: 0 }; // Brawl Stars aim & fire joystick
    this.virtualAim = { active: false, worldPos: new THREE.Vector3() };
    this.controlMode = 'twinStick'; // 'twinStick' or 'classic'

    this.isMouseDown = false;
    this.shouldShoot = false;
    this.shouldMine = false;
    this.shouldBazooka = false;
    this.autoShootHold = false; // Hold fire button to shoot continuously when cooldown allows

    this.boundListeners = [];
    this.initListeners();
  }

  addListener(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.boundListeners.push({ target, type, handler });
  }

  initListeners() {
    // Detect touch capability
    this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    // Keyboard
    const onKeyDown = (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space' || e.code === 'KeyE') {
        if (e.code === 'Space') {
          e.preventDefault();
          if (document.activeElement && document.activeElement instanceof HTMLElement && document.activeElement !== this.canvas) {
            document.activeElement.blur();
          }
        }
        this.shouldMine = true;
      } else if (e.code === 'KeyQ' || e.code === 'KeyF' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.shouldBazooka = true;
      }
    };
    const onKeyUp = (e) => {
      this.keys[e.code] = false;
    };
    this.addListener(window, 'keydown', onKeyDown);
    this.addListener(window, 'keyup', onKeyUp);

    // Prevent context menu on right-click so right-click can deploy mines on PC
    const onContextMenu = (e) => {
      e.preventDefault();
    };
    this.addListener(window, 'contextmenu', onContextMenu);

    // Mouse / Pointer Move
    const onPointerMove = (e) => {
      // If event came from mouse or active pen
      if (e.pointerType === 'mouse' || !this.virtualAim.active) {
        this.updateMouseCoords(e.clientX, e.clientY);
      }
    };
    this.addListener(window, 'pointermove', onPointerMove);

    // Pointer Down (Left click = Fire or Bazooka if holding Shift/Q/F, Right click = Mine on PC)
    const onPointerDown = (e) => {
      if (e.pointerType === 'mouse') {
        const target = e.target;
        if (target && target.tagName === 'BUTTON') return;
        if (target && target.closest && (target.closest('button') || target.closest('[data-ui-element]'))) return;

        // Right-click (button 2) or Middle-click (button 1) deploys a mine on PC!
        if (e.button === 2 || e.button === 1) {
          e.preventDefault();
          this.shouldMine = true;
          return;
        }

        this.updateMouseCoords(e.clientX, e.clientY);

        // If holding Shift, Q, or F while clicking Left Mouse Button, fire Bazooka!
        if (e.shiftKey || this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.keys['KeyQ'] || this.keys['KeyF']) {
          this.shouldBazooka = true;
          return;
        }

        this.isMouseDown = true;
        this.shouldShoot = true;
      }
      // On mobile/touch devices, all firing is exclusively governed by the aim stick!
    };

    const onPointerUp = (e) => {
      if (e.pointerType === 'mouse') {
        if (e.button === 0) {
          this.isMouseDown = false;
          this.shouldShoot = false;
        }
      }
    };

    const onTouchEndOrCancel = (e) => {
      // Safety: When all touches are released or cancelled, ensure no shooting or joystick remains active
      if (!e.touches || e.touches.length === 0) {
        this.resetInputs();
      }
    };

    this.addListener(window, 'pointerdown', onPointerDown);
    this.addListener(window, 'pointerup', onPointerUp);
    this.addListener(window, 'touchend', onTouchEndOrCancel);
    this.addListener(window, 'touchcancel', onTouchEndOrCancel);
    this.addListener(window, 'blur', () => this.resetInputs());
    this.addListener(document, 'visibilitychange', () => {
      if (document.hidden) this.resetInputs();
    });
  }

  resetInputs() {
    this.keys = {};
    this.virtualJoystick.x = 0;
    this.virtualJoystick.y = 0;
    this.virtualJoystick.active = false;
    this.virtualAimStick.x = 0;
    this.virtualAimStick.y = 0;
    this.virtualAimStick.active = false;
    this.virtualAimStick.distance = 0;
    this.virtualAim.active = false;
    this.isMouseDown = false;
    this.shouldShoot = false;
    this.shouldMine = false;
    this.shouldBazooka = false;
    this.autoShootHold = false;
  }

  updateMouseCoords(clientX, clientY) {
    this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;
    this.updateRaycaster();
  }

  updateRaycaster() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.mousePlane, this.mouseWorldPos);
    if (!hit) {
      this.mouseWorldPos.set(0, 0, 0);
    }
  }

  // Set virtual joystick from UI component (x, y between -1 and 1)
  setJoystickInput(x, y, active) {
    this.virtualJoystick.x = x;
    this.virtualJoystick.y = y;
    this.virtualJoystick.active = active;
  }

  // Set aim position directly (e.g. from touch drag or right virtual stick)
  setAimDirection(angleRad) {
    this.virtualAim.active = true;
    this.virtualAim.angle = angleRad;
  }

  // Brawl Stars Twin-Stick: Move aim stick beyond deadzone to aim and auto-shoot
  setAimStickInput(x, y, active, playerPosition = null) {
    this.virtualAimStick.x = x;
    this.virtualAimStick.y = y;
    this.virtualAimStick.active = active;
    this.virtualAimStick.distance = Math.hypot(x, y);

    // Deadzone: Only aim and shoot if actively dragged beyond 28% from center!
    // If the user merely touches the stick without moving it, it WILL NOT shoot.
    if (active && this.virtualAimStick.distance >= 0.28) {
      this.virtualAim.active = true;
      const aimDistance = 28;
      const basePos = playerPosition || new THREE.Vector3(0, 0, 0);

      // x is horizontal (-1 left, 1 right), y is vertical (-1 up/North, 1 down/South)
      this.mouseWorldPos.set(
        basePos.x + (x * aimDistance),
        0.5,
        basePos.z + (y * aimDistance)
      );

      // Auto-fire while deliberately moving/aiming the stick
      this.autoShootHold = true;
    } else {
      // In deadzone or released: Immediately cease shooting!
      this.autoShootHold = false;
      this.shouldShoot = false;
      if (!active) {
        this.virtualAim.active = false;
        this.virtualAimStick.distance = 0;
      }
    }
  }

  setTouchAimPosition(clientX, clientY) {
    this.updateMouseCoords(clientX, clientY);
    this.virtualAim.active = true;
  }

  clearTouchAim() {
    this.virtualAim.active = false;
  }

  triggerShoot() {
    this.shouldShoot = true;
  }

  setShootHold(holding) {
    this.autoShootHold = holding;
    if (holding) this.shouldShoot = true;
  }

  triggerMine() {
    this.shouldMine = true;
  }

  triggerBazooka() {
    this.shouldBazooka = true;
  }

  getMovementVector() {
    const move = { forward: 0, turn: 0, directX: 0, directZ: 0, hasDirectInput: false };

    // Keyboard inputs
    let keyX = 0;
    let keyZ = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) { move.forward += 1; keyZ -= 1; }
    if (this.keys['KeyS'] || this.keys['ArrowDown']) { move.forward -= 1; keyZ += 1; }
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) { move.turn += 1; keyX -= 1; }
    if (this.keys['KeyD'] || this.keys['ArrowRight']) { move.turn -= 1; keyX += 1; }

    // Touch joystick input
    if (this.virtualJoystick.active) {
      const joyX = this.virtualJoystick.x;
      const joyY = this.virtualJoystick.y; // -1 is up/forward, 1 is down/backward

      if (this.controlMode === 'classic') {
        move.forward = -joyY;
        move.turn = -joyX;
      } else {
        // Twin-stick direct direction
        move.directX = joyX;
        move.directZ = joyY;
        move.hasDirectInput = Math.hypot(joyX, joyY) > 0.15;
      }
    } else if (keyX !== 0 || keyZ !== 0) {
      if (this.controlMode === 'twinStick') {
        move.directX = keyX;
        move.directZ = keyZ;
        move.hasDirectInput = true;
      }
    }

    return move;
  }

  getAimPosition() {
    return this.mouseWorldPos;
  }

  checkShoot() {
    // If holding Shift/Q/F while mouse is down, prefer Bazooka if ready
    if (this.shouldShoot || this.autoShootHold || this.isMouseDown) {
      this.shouldShoot = false;
      return true;
    }
    return false;
  }

  isHoldingBazookaModifier() {
    return Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.keys['KeyQ'] || this.keys['KeyF']);
  }

  checkMine() {
    if (this.shouldMine) {
      this.shouldMine = false;
      return true;
    }
    return false;
  }

  checkBazooka() {
    if (this.shouldBazooka) {
      this.shouldBazooka = false;
      return true;
    }
    return false;
  }

  dispose() {
    for (const { target, type, handler } of this.boundListeners) {
      target.removeEventListener(type, handler);
    }
    this.boundListeners = [];
  }
}
