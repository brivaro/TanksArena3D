
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
    this.usingTouchControls = false;
    this.virtualJoystick = { x: 0, y: 0, active: false }; // Normalized [-1, 1]
    this.virtualAimStick = { x: 0, y: 0, active: false, distance: 0 }; // Cannon aim & fire joystick
    this.bazookaAimStick = { x: 0, y: 0, active: false, distance: 0 }; // Bazooka drag-to-aim joystick
    this.virtualAim = { active: false, worldPos: new THREE.Vector3() };
    this.lastAimDir = { x: 0, z: -1, hasCustomAim: false }; // Persistent compass aim vector on mobile
    this.controlMode = 'twinStick'; // 'twinStick' or 'classic'

    this.isMouseDown = false;
    this.shouldShoot = false;
    this.shouldMine = false;
    this.shouldBazooka = false;
    this.shouldEmp = false;
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
    if (this.isTouchDevice) {
      this.usingTouchControls = true;
    }

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
      } else if (e.code === 'KeyR') {
        this.shouldEmp = true;
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

    // Mouse Move (Strictly physical mouse only — NEVER touch events on joysticks or buttons!)
    const onPointerMove = (e) => {
      if (e.pointerType !== 'mouse') return;
      if (this.virtualJoystick.active || this.virtualAimStick.active || this.bazookaAimStick.active) return;
      const target = e.target;
      if (target && target.closest && (target.closest('button') || target.closest('[data-ui-element]'))) return;
      this.usingTouchControls = false;
      this.updateMouseCoords(e.clientX, e.clientY);
    };
    this.addListener(window, 'pointermove', onPointerMove);

    // Pointer Down (Left click = Fire or Bazooka if holding Shift/Q/F, Right click = Mine on PC)
    const onPointerDown = (e) => {
      if (e.pointerType !== 'mouse') return;
      if (this.virtualJoystick.active || this.virtualAimStick.active || this.bazookaAimStick.active) return;
      const target = e.target;
      if (target && target.tagName === 'BUTTON') return;
      if (target && target.closest && (target.closest('button') || target.closest('[data-ui-element]'))) return;

      this.usingTouchControls = false;

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
    this.bazookaAimStick.x = 0;
    this.bazookaAimStick.y = 0;
    this.bazookaAimStick.active = false;
    this.bazookaAimStick.distance = 0;
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
    if (active) this.usingTouchControls = true;
    this.virtualJoystick.x = x;
    this.virtualJoystick.y = y;
    this.virtualJoystick.active = active;

    // If the player hasn't manually aimed with the right stick yet, point the default aim ahead in movement direction
    if (active && !this.lastAimDir.hasCustomAim && !this.virtualAimStick.active && !this.bazookaAimStick.active) {
      const mag = Math.hypot(x, y);
      if (mag > 0.25) {
        this.lastAimDir.x = x / mag;
        this.lastAimDir.z = y / mag;
      }
    }
  }

  // Set aim position directly (e.g. from touch drag or right virtual stick)
  setAimDirection(angleRad) {
    this.virtualAim.active = true;
    this.virtualAim.angle = angleRad;
  }

  // Twin-Stick Cannon Aim & Fire:
  // Supports both continuous auto-fire ('auto') and precision aim-then-release / rim-burst ('smart')
  setAimStickInput(x, y, active, playerPosition = null, shouldAutoFire = true) {
    if (active) this.usingTouchControls = true;
    this.virtualAimStick.x = x;
    this.virtualAimStick.y = y;
    this.virtualAimStick.active = active;
    const dist = Math.hypot(x, y);
    this.virtualAimStick.distance = dist;

    // If Bazooka drag-aim stick is currently being held, let Bazooka stick control the turret aim
    if (this.bazookaAimStick.active) {
      this.autoShootHold = false;
      this.shouldShoot = false;
      return;
    }

    if (active && dist >= 0.18) {
      this.virtualAim.active = true;
      this.lastAimDir.x = x / dist;
      this.lastAimDir.z = y / dist;
      this.lastAimDir.hasCustomAim = true;

      const aimDistance = 28;
      const basePos = playerPosition || new THREE.Vector3(0, 0, 0);
      this.mouseWorldPos.set(
        basePos.x + (this.lastAimDir.x * aimDistance),
        0.5,
        basePos.z + (this.lastAimDir.z * aimDistance)
      );

      this.autoShootHold = Boolean(shouldAutoFire && dist >= 0.28);
    } else {
      this.autoShootHold = false;
      this.shouldShoot = false;
      if (!active) {
        this.virtualAim.active = false;
        this.virtualAimStick.distance = 0;
      }
    }
  }

  // Dedicated Bazooka Drag-to-Aim Stick:
  // Dragging the 🚀 Bazooka button aims the turret & laser sight WITHOUT firing normal cannon bullets,
  // and releasing fires the Bazooka rocket in that exact direction!
  setBazookaStickInput(x, y, active, playerPosition = null, fireOnRelease = false) {
    if (active || fireOnRelease) this.usingTouchControls = true;
    this.bazookaAimStick.x = x;
    this.bazookaAimStick.y = y;
    this.bazookaAimStick.active = active;
    const dist = Math.hypot(x, y);
    this.bazookaAimStick.distance = dist;

    // Always pause normal cannon auto-fire while aiming/firing Bazooka
    this.autoShootHold = false;
    this.shouldShoot = false;

    if (active && dist >= 0.18) {
      this.virtualAim.active = true;
      this.lastAimDir.x = x / dist;
      this.lastAimDir.z = y / dist;
      this.lastAimDir.hasCustomAim = true;

      const aimDistance = 28;
      const basePos = playerPosition || new THREE.Vector3(0, 0, 0);
      this.mouseWorldPos.set(
        basePos.x + (this.lastAimDir.x * aimDistance),
        0.5,
        basePos.z + (this.lastAimDir.z * aimDistance)
      );
    } else if (!active) {
      if (!this.virtualAimStick.active) {
        this.virtualAim.active = false;
      }
      this.bazookaAimStick.distance = 0;
      if (fireOnRelease) {
        this.shouldBazooka = true;
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
    this.autoShootHold = false;
    this.shouldShoot = false;
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

  triggerEmp() {
    this.shouldEmp = true;
  }

  checkEmp() {
    if (this.shouldEmp) {
      this.shouldEmp = false;
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
