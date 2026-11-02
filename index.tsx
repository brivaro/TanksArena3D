import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GameEngine } from './game/core/GameEngine.js';
import { LevelLoader } from './game/world/LevelLoader.js';
import {
  TANK_SKINS_LIST,
  TANK_HATS_LIST,
  BULLET_TRAILS_LIST,
  BATTLE_PASS_TIERS,
  STRIPE_PACKS_LIST,
  StripePack,
  PurchaseReceipt,
  BackupPayload,
  StoreModal,
  StripeCheckoutModal,
  ModalCloseButton
} from './game/store/MonetizationCatalog';

// --- Virtual Touch Controls for Mobile (Strict Multi-Touch Isolated + Smart Aim & Bazooka System) ---

interface VirtualJoystickProps {
  onMove: (x: number, y: number, active: boolean) => void;
}

const VirtualJoystick: React.FC<VirtualJoystickProps> = ({ onMove }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const activeTouchId = useRef<number | null>(null);

  const maxRadius = 46; // Max drag radius in px
  const deadZone = 10;  // Deadzone in px to prevent unintentional phantom movement

  const updatePosition = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist < deadZone) {
      setStickPos({ x: dx, y: dy });
      onMove(0, 0, false);
      return;
    }

    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const posX = Math.cos(angle) * clampedDist;
    const posY = Math.sin(angle) * clampedDist;

    setStickPos({ x: posX, y: posY });
    const normX = posX / maxRadius;
    const normY = posY / maxRadius;
    onMove(normX, normY, true);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (activeTouchId.current !== null) return;
    const touch = e.targetTouches[0] || e.changedTouches[0];
    if (!touch) return;
    activeTouchId.current = touch.identifier;
    setIsActive(true);
    updatePosition(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (activeTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeTouchId.current) {
        updatePosition(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleTouchEndOrCancel = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (activeTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeTouchId.current) {
        activeTouchId.current = null;
        setIsActive(false);
        setStickPos({ x: 0, y: 0 });
        onMove(0, 0, false);
        break;
      }
    }
  };

  useEffect(() => {
    return () => {
      onMove(0, 0, false);
    };
  }, [onMove]);

  return (
    <div
      data-ui-element="true"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}
    >
      <div
        ref={containerRef}
        data-ui-element="true"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEndOrCancel}
        onTouchCancel={handleTouchEndOrCancel}
        style={{
          width: '122px',
          height: '122px',
          borderRadius: '50%',
          backgroundColor: isActive ? 'rgba(15, 23, 42, 0.85)' : 'rgba(15, 23, 42, 0.68)',
          border: isActive ? '3px solid #38bdf8' : '2.5px solid rgba(148, 163, 184, 0.55)',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'none',
          pointerEvents: 'auto',
          boxShadow: isActive ? '0 0 22px rgba(56, 189, 248, 0.45)' : '0 8px 24px rgba(0,0,0,0.5)',
          userSelect: 'none'
        }}
      >
        <div style={{ position: 'absolute', width: '70%', height: '1px', backgroundColor: 'rgba(255,255,255,0.16)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', height: '70%', width: '1px', backgroundColor: 'rgba(255,255,255,0.16)', pointerEvents: 'none' }} />
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            backgroundColor: isActive ? '#38bdf8' : 'rgba(248, 250, 252, 0.92)',
            border: '3px solid #0f172a',
            boxShadow: '0 4px 12px rgba(0,0,0,0.45)',
            transform: `translate3d(${stickPos.x}px, ${stickPos.y}px, 0)`,
            transition: isActive ? 'none' : 'transform 0.14s ease-out',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            userSelect: 'none',
            pointerEvents: 'none'
          }}
        >
          🕹️
        </div>
      </div>
      <div style={{
        marginTop: '5px',
        backgroundColor: 'rgba(15, 23, 42, 0.82)',
        border: '1px solid rgba(148, 163, 184, 0.25)',
        color: '#cbd5e1',
        fontSize: '9.5px',
        fontWeight: 900,
        padding: '2px 9px',
        borderRadius: '8px',
        letterSpacing: '0.8px',
        userSelect: 'none',
        pointerEvents: 'none'
      }}>
        MOVER
      </div>
    </div>
  );
};

// --- Smart Dual-Stage Aim & Fire Virtual Crosshair Joystick ---
// Modes:
// - 'smart' (Default): Dragging aims the laser sight WITHOUT spraying bullets. Releasing fires 1 precise shot (or armed Bazooka)! Pushing to the outer rim (>85%) triggers continuous burst fire!
// - 'auto': Dragging aims and continuously auto-fires cannon rounds.
interface VirtualAimJoystickProps {
  onAim: (x: number, y: number, active: boolean, shouldAutoFire?: boolean) => void;
  onQuickShoot?: () => void;
  onFireBazooka?: () => void;
  bazookaArmed: boolean;
  onClearBazookaArmed: () => void;
  fireMode: 'smart' | 'auto';
}

const VirtualAimJoystick: React.FC<VirtualAimJoystickProps> = ({
  onAim,
  onQuickShoot,
  onFireBazooka,
  bazookaArmed,
  onClearBazookaArmed,
  fireMode
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const [isAimingOut, setIsAimingOut] = useState(false);
  const [isRimBurst, setIsRimBurst] = useState(false);
  const activeTouchId = useRef<number | null>(null);
  const touchStartTimeRef = useRef<number>(0);
  const maxDragDistRef = useRef<number>(0);
  const currentNormRef = useRef<{ x: number; y: number; dist: number }>({ x: 0, y: 0, dist: 0 });

  const maxRadius = 48; // Max drag radius in px
  const deadZone = 11;  // Deadzone in px: Inside this zone = cancel / quick tap

  const updatePosition = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);
    if (dist > maxDragDistRef.current) {
      maxDragDistRef.current = dist;
    }

    if (dist < deadZone) {
      setStickPos({ x: dx, y: dy });
      setIsAimingOut(false);
      setIsRimBurst(false);
      currentNormRef.current = { x: 0, y: 0, dist: 0 };
      onAim(0, 0, false, false);
      return;
    }

    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const posX = Math.cos(angle) * clampedDist;
    const posY = Math.sin(angle) * clampedDist;

    setStickPos({ x: posX, y: posY });
    setIsAimingOut(true);

    const normX = posX / maxRadius;
    const normY = posY / maxRadius;
    const normDist = clampedDist / maxRadius;
    currentNormRef.current = { x: normX, y: normY, dist: normDist };

    // If Bazooka is armed on the main stick, never auto-fire normal bullets while aiming!
    const rimAuto = !bazookaArmed && (fireMode === 'auto' || normDist >= 0.88);
    setIsRimBurst(rimAuto);
    onAim(normX, normY, true, rimAuto);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (activeTouchId.current !== null) return;
    const touch = e.targetTouches[0] || e.changedTouches[0];
    if (!touch) return;
    activeTouchId.current = touch.identifier;
    touchStartTimeRef.current = Date.now();
    maxDragDistRef.current = 0;
    currentNormRef.current = { x: 0, y: 0, dist: 0 };
    setIsActive(true);
    setIsAimingOut(false);
    setIsRimBurst(false);
    setStickPos({ x: 0, y: 0 });
    onAim(0, 0, false, false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (activeTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeTouchId.current) {
        updatePosition(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (activeTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeTouchId.current) {
        const finalDist = currentNormRef.current.dist;
        const wasQuickTap = maxDragDistRef.current < deadZone && (Date.now() - touchStartTimeRef.current) < 320;

        activeTouchId.current = null;
        setIsActive(false);
        setIsAimingOut(false);
        setIsRimBurst(false);
        setStickPos({ x: 0, y: 0 });
        onAim(0, 0, false, false);

        if (finalDist >= 0.22) {
          // Released while aiming outside deadzone -> Fire!
          if (bazookaArmed) {
            onFireBazooka?.();
            onClearBazookaArmed();
          } else if (fireMode === 'smart') {
            onQuickShoot?.();
          }
        } else if (wasQuickTap) {
          // Quick tap on center -> Auto-aim shot or Bazooka shot
          if (bazookaArmed) {
            onFireBazooka?.();
            onClearBazookaArmed();
          } else {
            onQuickShoot?.();
          }
        }
        break;
      }
    }
  };

  const handleTouchCancel = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (activeTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeTouchId.current) {
        activeTouchId.current = null;
        setIsActive(false);
        setIsAimingOut(false);
        setIsRimBurst(false);
        setStickPos({ x: 0, y: 0 });
        onAim(0, 0, false, false);
        break;
      }
    }
  };

  const borderColor = bazookaArmed
    ? '#fb923c'
    : isRimBurst
    ? '#ef4444'
    : isAimingOut
    ? '#fbbf24'
    : 'rgba(251, 146, 60, 0.72)';

  return (
    <div
      data-ui-element="true"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}
    >
      <div
        ref={containerRef}
        data-ui-element="true"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        style={{
          width: '124px',
          height: '124px',
          borderRadius: '50%',
          backgroundColor: bazookaArmed
            ? 'rgba(154, 52, 18, 0.68)'
            : isRimBurst
            ? 'rgba(185, 28, 28, 0.55)'
            : isAimingOut
            ? 'rgba(30, 41, 59, 0.85)'
            : 'rgba(15, 23, 42, 0.72)',
          border: `3px solid ${borderColor}`,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'none',
          pointerEvents: 'auto',
          boxShadow: bazookaArmed
            ? '0 0 26px rgba(251, 146, 60, 0.8)'
            : isAimingOut
            ? '0 0 22px rgba(251, 191, 36, 0.5)'
            : '0 8px 24px rgba(0,0,0,0.5)',
          userSelect: 'none'
        }}
      >
        {/* Inner Precision Aim Ring Indicator */}
        <div style={{
          position: 'absolute',
          width: '78%',
          height: '78%',
          borderRadius: '50%',
          border: '1px dashed rgba(255, 255, 255, 0.22)',
          pointerEvents: 'none'
        }} />

        {/* Aim Crosshair Reticle Markers */}
        <div style={{ position: 'absolute', top: '6px', width: '2px', height: '9px', backgroundColor: borderColor, borderRadius: '1px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '6px', width: '2px', height: '9px', backgroundColor: borderColor, borderRadius: '1px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: '6px', height: '2px', width: '9px', backgroundColor: borderColor, borderRadius: '1px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: '6px', height: '2px', width: '9px', backgroundColor: borderColor, borderRadius: '1px', pointerEvents: 'none' }} />

        {/* Joystick Handle */}
        <div
          style={{
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            backgroundColor: bazookaArmed
              ? '#ea580c'
              : isRimBurst
              ? '#ef4444'
              : isAimingOut
              ? '#fbbf24'
              : '#f59e0b',
            border: '3px solid #ffffff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.45)',
            transform: `translate3d(${stickPos.x}px, ${stickPos.y}px, 0)`,
            transition: isActive ? 'none' : 'transform 0.14s ease-out',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '21px',
            userSelect: 'none',
            pointerEvents: 'none'
          }}
        >
          {bazookaArmed ? '🚀' : isRimBurst ? '🔥' : '🎯'}
        </div>
      </div>
      <div style={{
        marginTop: '5px',
        backgroundColor: bazookaArmed ? 'rgba(194, 65, 12, 0.95)' : 'rgba(15, 23, 42, 0.85)',
        border: `1px solid ${bazookaArmed ? '#fdba74' : 'rgba(148, 163, 184, 0.25)'}`,
        color: '#fff',
        fontSize: '9.5px',
        fontWeight: 900,
        padding: '2px 9px',
        borderRadius: '8px',
        letterSpacing: '0.5px',
        userSelect: 'none',
        pointerEvents: 'none',
        whiteSpace: 'nowrap'
      }}>
        {bazookaArmed
          ? '🚀 APUNTA Y SUELTA BAZOCA'
          : isRimBurst
          ? '🔥 RÁFAGA CONTINUA'
          : isAimingOut
          ? '🎯 SUELTA PARA DISPARAR'
          : fireMode === 'smart'
          ? 'MIRA: APUNTA Y SUELTA'
          : 'MIRA: AUTO-FUEGO'}
      </div>
    </div>
  );
};

// --- Dedicated Bazooka Smart Button / Drag-to-Aim Mini Stick ---
// Tap = Arm Bazooka on main stick (or fire immediately if already aiming/armed)
// Drag = Aim Bazooka trajectory directly without shooting bullets & release to launch rocket!
interface BazookaSmartStickButtonProps {
  bazookaUnlocked?: boolean;
  bazookaReady: boolean;
  bazookaCooldownProgress: number;
  bazookaArmed: boolean;
  onTapBazooka: () => void;
  onBazookaStick: (x: number, y: number, active: boolean, fireOnRelease: boolean) => void;
}

const BazookaSmartStickButton: React.FC<BazookaSmartStickButtonProps> = ({
  bazookaUnlocked = true,
  bazookaReady,
  bazookaCooldownProgress,
  bazookaArmed,
  onTapBazooka,
  onBazookaStick
}) => {
  const btnRef = useRef<HTMLDivElement | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const activeTouchId = useRef<number | null>(null);
  const maxDistRef = useRef(0);
  const currentNormRef = useRef({ x: 0, y: 0, dist: 0 });

  const maxRadius = 36;
  const dragThreshold = 10;

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!bazookaUnlocked) {
      onTapBazooka();
      return;
    }
    if (activeTouchId.current !== null) return;
    const touch = e.targetTouches[0] || e.changedTouches[0];
    if (!touch) return;
    activeTouchId.current = touch.identifier;
    maxDistRef.current = 0;
    currentNormRef.current = { x: 0, y: 0, dist: 0 };
    setIsDragging(true);
    setDragOffset({ x: 0, y: 0 });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (activeTouchId.current === null || !btnRef.current) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeTouchId.current) {
        const rect = btnRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = touch.clientX - cx;
        const dy = touch.clientY - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > maxDistRef.current) maxDistRef.current = dist;

        const clamped = Math.min(dist, maxRadius);
        const angle = Math.atan2(dy, dx);
        const px = Math.cos(angle) * clamped;
        const py = Math.sin(angle) * clamped;
        setDragOffset({ x: px, y: py });

        const nx = px / maxRadius;
        const ny = py / maxRadius;
        const nd = clamped / maxRadius;
        currentNormRef.current = { x: nx, y: ny, dist: nd };

        if (dist >= dragThreshold) {
          onBazookaStick(nx, ny, true, false);
        } else {
          onBazookaStick(0, 0, false, false);
        }
        break;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (activeTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeTouchId.current) {
        const wasDragged = maxDistRef.current >= dragThreshold;
        const finalDist = currentNormRef.current.dist;
        const nx = currentNormRef.current.x;
        const ny = currentNormRef.current.y;

        activeTouchId.current = null;
        setIsDragging(false);
        setDragOffset({ x: 0, y: 0 });

        if ('vibrate' in navigator) {
          try { navigator.vibrate(35); } catch (_) {}
        }

        if (wasDragged) {
          // If dragged and released outside deadzone -> fire Bazooka in that exact dragged angle!
          // If returned to center before release -> cancel without wasting rocket!
          onBazookaStick(nx, ny, false, finalDist >= 0.28);
        } else {
          onBazookaStick(0, 0, false, false);
          onTapBazooka();
        }
        break;
      }
    }
  };

  const handleTouchCancel = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (activeTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeTouchId.current) {
        activeTouchId.current = null;
        setIsDragging(false);
        setDragOffset({ x: 0, y: 0 });
        onBazookaStick(0, 0, false, false);
        break;
      }
    }
  };

  return (
    <div
      ref={btnRef}
      data-ui-element="true"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      style={{
        width: '66px',
        height: '66px',
        borderRadius: '50%',
        backgroundColor: !bazookaUnlocked
          ? 'rgba(15, 23, 42, 0.78)'
          : bazookaReady
          ? (bazookaArmed || isDragging ? '#c2410c' : '#ea580c')
          : 'rgba(30, 41, 59, 0.88)',
        border: !bazookaUnlocked
          ? '2px dashed rgba(148, 163, 184, 0.45)'
          : bazookaArmed || isDragging
          ? '3px solid #fde047'
          : bazookaReady
          ? '2.5px solid rgba(255, 255, 255, 0.92)'
          : '2px solid rgba(148, 163, 184, 0.4)',
        boxShadow: !bazookaUnlocked
          ? '0 4px 10px rgba(0,0,0,0.35)'
          : bazookaArmed || isDragging
          ? '0 0 24px rgba(251, 191, 36, 0.85)'
          : bazookaReady
          ? '0 6px 18px rgba(234, 88, 12, 0.7)'
          : '0 4px 10px rgba(0,0,0,0.4)',
        color: '#fff',
        cursor: 'pointer',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none',
        pointerEvents: 'auto',
        userSelect: 'none',
        opacity: bazookaUnlocked ? 1 : 0.72
      }}
      title={bazookaUnlocked ? 'Toca para armar/disparar Bazoca o arrastra este botón para apuntar el cohete' : 'Se desbloquea en el Nivel 6'}
    >
      <div
        style={{
          transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)`,
          transition: isDragging ? 'none' : 'transform 0.14s ease-out',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none'
        }}
      >
        <span style={{ fontSize: '21px', lineHeight: 1 }}>{bazookaUnlocked ? '🚀' : '🔒'}</span>
        <span style={{ fontSize: '8px', fontWeight: 900, marginTop: '2px', letterSpacing: '0.3px', color: !bazookaUnlocked ? '#94a3b8' : bazookaReady ? '#fff' : '#94a3b8' }}>
          {!bazookaUnlocked ? 'NV.6' : bazookaArmed ? 'ARMADO' : bazookaReady ? 'BAZOCA' : `${Math.round(bazookaCooldownProgress * 100)}%`}
        </span>
      </div>
    </div>
  );
};

interface MobileControlsClusterProps {
  onAim: (x: number, y: number, active: boolean, shouldAutoFire?: boolean) => void;
  onBazookaStick: (x: number, y: number, active: boolean, fireOnRelease: boolean) => void;
  onQuickShoot?: () => void;
  onMine: () => void;
  onBazooka: () => void;
  onEmp: () => void;
  onToggleCamera: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  cameraMode?: 'overview' | 'follow';
  mineUnlocked?: boolean;
  mineReady: boolean;
  mineCooldownProgress?: number;
  bazookaUnlocked?: boolean;
  bazookaReady: boolean;
  bazookaCooldownProgress?: number;
  empUnlocked?: boolean;
  empReady?: boolean;
  empCooldownProgress?: number;
}

const MobileControlsCluster: React.FC<MobileControlsClusterProps> = ({
  onAim,
  onBazookaStick,
  onQuickShoot,
  onMine,
  onBazooka,
  onEmp,
  onToggleCamera,
  cameraMode,
  mineUnlocked = true,
  mineReady,
  mineCooldownProgress = 1,
  bazookaUnlocked = true,
  bazookaReady,
  bazookaCooldownProgress = 1,
  empUnlocked = false,
  empReady = true,
  empCooldownProgress = 1
}) => {
  const [minePressed, setMinePressed] = useState(false);
  const [empPressed, setEmpPressed] = useState(false);
  const [bazookaArmed, setBazookaArmed] = useState(false);
  const [fireMode, setFireMode] = useState<'smart' | 'auto'>(() => {
    try {
      return (localStorage.getItem('tanks_mobile_aim_mode') as 'smart' | 'auto') || 'smart';
    } catch {
      return 'smart';
    }
  });
  const lastMineTapRef = useRef(0);
  const lastCamTapRef = useRef(0);

  // Automatically disarm if bazooka goes on cooldown
  useEffect(() => {
    if (!bazookaReady && bazookaArmed) {
      setBazookaArmed(false);
    }
  }, [bazookaReady, bazookaArmed]);

  const toggleFireMode = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = fireMode === 'smart' ? 'auto' : 'smart';
    setFireMode(next);
    try { localStorage.setItem('tanks_mobile_aim_mode', next); } catch (_) {}
  };

  const handleCameraTrigger = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    if (now - lastCamTapRef.current < 320) return;
    lastCamTapRef.current = now;
    if ('vibrate' in navigator) {
      try { navigator.vibrate(20); } catch (_) {}
    }
    onToggleCamera();
  };

  const handleMineTrigger = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    if (now - lastMineTapRef.current < 260) return;
    lastMineTapRef.current = now;

    setMinePressed(true);
    setTimeout(() => setMinePressed(false), 180);
    if ('vibrate' in navigator) {
      try { navigator.vibrate(30); } catch (_) {}
    }
    onMine();
  };

  const handleTapBazooka = () => {
    if (!bazookaUnlocked || !bazookaReady) {
      onBazooka();
      return;
    }
    // If Bazooka is already armed on the main stick, tapping again fires immediately!
    // Otherwise, arm Bazooka on the main stick so the player can calmly aim with the big stick and release to fire!
    if (bazookaArmed) {
      setBazookaArmed(false);
      onBazooka();
    } else {
      setBazookaArmed(true);
    }
  };

  const handleEmpTrigger = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEmpPressed(true);
    setTimeout(() => setEmpPressed(false), 180);
    if ('vibrate' in navigator) {
      try { navigator.vibrate(35); } catch (_) {}
    }
    onEmp();
  };

  return (
    <div
      data-ui-element="true"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      style={{
        position: 'relative',
        width: '236px',
        height: '204px',
        pointerEvents: 'none',
        userSelect: 'none'
      }}
    >
      {/* Top Tactical Mode Pills: Fire Mode Toggle & Camera View Toggle */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          display: 'flex',
          gap: '6px',
          alignItems: 'center',
          pointerEvents: 'auto'
        }}
      >
        <button
          type="button"
          data-ui-element="true"
          onTouchStart={toggleFireMode}
          onClick={toggleFireMode}
          style={{
            backgroundColor: fireMode === 'smart' ? 'rgba(14, 116, 144, 0.9)' : 'rgba(185, 28, 28, 0.9)',
            border: fireMode === 'smart' ? '1.5px solid #38bdf8' : '1.5px solid #f87171',
            color: '#f8fafc',
            borderRadius: '10px',
            padding: '5px 9px',
            fontSize: '9.5px',
            fontWeight: 900,
            cursor: 'pointer',
            touchAction: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
          }}
          title="Alternar entre Apuntar y Soltar (Precisión) o Auto-Disparo continuo"
        >
          {fireMode === 'smart' ? '🎯 TIRO: AL SOLTAR' : '🔥 TIRO: AUTO'}
        </button>

        <button
          type="button"
          data-ui-element="true"
          onTouchStart={handleCameraTrigger}
          onClick={handleCameraTrigger}
          style={{
            backgroundColor: cameraMode === 'follow' ? 'rgba(14, 116, 144, 0.92)' : 'rgba(15, 23, 42, 0.9)',
            border: cameraMode === 'follow' ? '1.5px solid #38bdf8' : '1.5px solid rgba(251, 191, 36, 0.6)',
            color: cameraMode === 'follow' ? '#7dd3fc' : '#fbbf24',
            borderRadius: '10px',
            padding: '5px 9px',
            fontSize: '9.5px',
            fontWeight: 900,
            cursor: 'pointer',
            touchAction: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
          }}
        >
          {cameraMode === 'overview' ? '🎯 TANQUE' : '🗺️ MAPA'}
        </button>
      </div>

      {/* Upper-Right Arc: ⚡ Orbital EMP Pulse Button (Unlocks at Lv.18) */}
      <div
        data-ui-element="true"
        onTouchStart={handleEmpTrigger}
        onClick={handleEmpTrigger}
        style={{
          position: 'absolute',
          left: '82px',
          top: '34px',
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: !empUnlocked
            ? 'rgba(15, 23, 42, 0.75)'
            : empReady
            ? '#0284c7'
            : 'rgba(30, 41, 59, 0.88)',
          border: !empUnlocked
            ? '1.5px dashed rgba(148, 163, 184, 0.4)'
            : empReady
            ? '2.5px solid #38bdf8'
            : '2px solid rgba(148, 163, 184, 0.4)',
          boxShadow: empUnlocked && empReady ? '0 0 18px rgba(56, 189, 248, 0.7)' : '0 4px 10px rgba(0,0,0,0.4)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'none',
          pointerEvents: 'auto',
          userSelect: 'none',
          opacity: empUnlocked ? 1 : 0.7,
          transform: empPressed ? 'scale(0.88)' : 'scale(1)',
          transition: 'transform 0.1s ease-out'
        }}
        title={empUnlocked ? 'Pulso EMP Orbital: Destruye balas enemigas y congela tanques' : 'Pulso EMP: Se desbloquea en el Nivel 18'}
      >
        <span style={{ fontSize: '15px', lineHeight: 1, pointerEvents: 'none' }}>{empUnlocked ? '⚡' : '🔒'}</span>
        <span style={{ fontSize: '7.5px', fontWeight: 900, marginTop: '1px', color: !empUnlocked ? '#94a3b8' : empReady ? '#e0f2fe' : '#94a3b8', pointerEvents: 'none' }}>
          {!empUnlocked ? 'NV.18' : empReady ? 'EMP' : `${Math.round(empCooldownProgress * 100)}%`}
        </span>
      </div>

      {/* Upper-Left Radial Arc: 🚀 Bazooka Smart Button (Tap to Arm/Fire OR Drag to Aim & Release!) */}
      <div
        style={{
          position: 'absolute',
          left: '8px',
          top: '44px',
          pointerEvents: 'auto'
        }}
      >
        <BazookaSmartStickButton
          bazookaUnlocked={bazookaUnlocked}
          bazookaReady={bazookaReady}
          bazookaCooldownProgress={bazookaCooldownProgress}
          bazookaArmed={bazookaArmed}
          onTapBazooka={handleTapBazooka}
          onBazookaStick={(x, y, active, fireOnRelease) => {
            if (active && bazookaArmed) setBazookaArmed(false);
            onBazookaStick(x, y, active, fireOnRelease);
          }}
        />
      </div>

      {/* Lower-Left Radial Arc: 💣 Instant Mine Button (Well separated from Aim Stick!) */}
      <div
        data-ui-element="true"
        onTouchStart={handleMineTrigger}
        style={{
          position: 'absolute',
          left: '4px',
          bottom: '16px',
          width: '62px',
          height: '62px',
          borderRadius: '50%',
          backgroundColor: !mineUnlocked
            ? 'rgba(15, 23, 42, 0.78)'
            : mineReady
            ? '#15803d'
            : 'rgba(30, 41, 59, 0.88)',
          border: !mineUnlocked
            ? '2px dashed rgba(148, 163, 184, 0.45)'
            : mineReady
            ? '2.5px solid #4ade80'
            : '2px solid rgba(148, 163, 184, 0.4)',
          boxShadow: !mineUnlocked
            ? '0 4px 10px rgba(0,0,0,0.35)'
            : mineReady
            ? '0 6px 18px rgba(22, 163, 74, 0.65)'
            : '0 4px 10px rgba(0,0,0,0.4)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'none',
          pointerEvents: 'auto',
          userSelect: 'none',
          opacity: mineUnlocked ? 1 : 0.72,
          transform: minePressed ? 'scale(0.88)' : 'scale(1)',
          transition: 'transform 0.1s ease-out'
        }}
      >
        <span style={{ fontSize: '20px', lineHeight: 1, pointerEvents: 'none' }}>{mineUnlocked ? '💣' : '🔒'}</span>
        <span style={{ fontSize: '8px', fontWeight: 900, marginTop: '2px', letterSpacing: '0.3px', color: !mineUnlocked ? '#94a3b8' : mineReady ? '#bbf7d0' : '#94a3b8', pointerEvents: 'none' }}>
          {!mineUnlocked ? 'NV.3' : mineReady ? 'MINA' : `${Math.round(mineCooldownProgress * 100)}%`}
        </span>
      </div>

      {/* Bottom-Right Anchor: Main 🎯 Aim & Fire Crosshair Stick */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          pointerEvents: 'auto'
        }}
      >
        <VirtualAimJoystick
          onAim={onAim}
          onQuickShoot={onQuickShoot}
          onFireBazooka={onBazooka}
          bazookaArmed={bazookaArmed}
          onClearBazookaArmed={() => setBazookaArmed(false)}
          fireMode={fireMode}
        />
      </div>
    </div>
  );
};

// --- Professional Tactical UI Components ---

const BIOMES_LIST = [
  { id: 'all', label: 'TODAS (160)', icon: '🗺️', color: '#38bdf8', accent: 'rgba(56, 189, 248, 0.18)' },
  { id: 'workshop', label: 'Taller (1-8)', icon: '🌲', range: [1, 8], color: '#fbbf24', accent: 'rgba(251, 191, 36, 0.16)' },
  { id: 'desert', label: 'Desierto (9-16)', icon: '🏜️', range: [9, 16], color: '#fb923c', accent: 'rgba(251, 146, 60, 0.16)' },
  { id: 'cyber', label: 'Cyber & EMP', icon: '⚡', range: [17, 24], color: '#22d3ee', accent: 'rgba(34, 211, 238, 0.18)' },
  { id: 'arctic', label: 'Ártico Criogénico', icon: '❄️', range: [25, 32], color: '#38bdf8', accent: 'rgba(56, 189, 248, 0.18)' },
  { id: 'volcano', label: 'Volcán & Pirotecnia', icon: '🌋', range: [33, 40], color: '#f87171', accent: 'rgba(248, 113, 113, 0.18)' },
  { id: 'jungle', label: 'Selva & Médico', icon: '🌴', range: [41, 48], color: '#4ade80', accent: 'rgba(74, 222, 128, 0.18)' },
  { id: 'sunset_city', label: 'Ciudad Atardecer', icon: '🌇', range: [49, 56], color: '#ff8a65', accent: 'rgba(255, 138, 101, 0.2)' },
  { id: 'matsuri', label: 'Festival Hanabi', icon: '🏮', range: [57, 64], color: '#f472b6', accent: 'rgba(244, 114, 182, 0.2)' },
  { id: 'tropical_island', label: 'Isla Tropical', icon: '🏝️', range: [65, 72], color: '#2dd4bf', accent: 'rgba(45, 212, 191, 0.2)' },
  { id: 'night_stealth', label: 'Sigilo Nocturno', icon: '🌙', range: [73, 80], color: '#818cf8', accent: 'rgba(129, 140, 248, 0.22)' }
];

// TANK_SKINS_LIST, TANK_HATS_LIST, BULLET_TRAILS_LIST imported from ./game/store/MonetizationCatalog

const TACTICAL_PERKS_LIST = [
  { id: 'ricochet', icon: '🎯', name: 'Cañón de Rebote +1', desc: '+1 rebote adicional en muros y +18% velocidad de proyectil', color: '#38bdf8' },
  { id: 'ordnance', icon: '💣', name: 'Ingeniero de Minas', desc: 'Recarga de minas 42% más rápida y +30% radio de explosión', color: '#f87171' },
  { id: 'overdrive', icon: '🚀', name: 'Turbina Overdrive', desc: '+20% velocidad punta del chasis y giro de orugas acelerado', color: '#4ade80' },
  { id: 'heavy_armor', icon: '🛡️', name: 'Blindaje Reactivo', desc: 'Inicia todas las misiones con 4 corazones de blindaje (❤️x4)', color: '#fbbf24' }
];

const AI_DIFFICULTIES_LIST = [
  { id: 'easy', label: 'FÁCIL', rank: 'Cadete', icon: '🟢', color: '#4ade80', desc: 'IA más pausada, proyectiles lentos y menor cadencia' },
  { id: 'normal', label: 'NORMAL', rank: 'Comandante', icon: '🔵', color: '#38bdf8', desc: 'Equilibrio táctico estándar de velocidad y puntería' },
  { id: 'hard', label: 'DIFÍCIL', rank: 'Élite', icon: '🟠', color: '#fbbf24', desc: 'Tanques más rápidos, reflejos agudos y mayor cadencia' },
  { id: 'extreme', label: 'EXTREMO', rank: 'Pesadilla', icon: '🔴', color: '#f87171', desc: 'IA implacable, recarga ultrarrápida y jefes reforzados' }
];

// --- Toy Story Style 3D Wooden Alphabet Block Components ---

const WOOD_BLOCK_PALETTE = [
  { border: '#e53935', shadow: '#8e0000', letter: '#d32f2f' }, // Classic Toy Red
  { border: '#1e88e5', shadow: '#0d47a1', letter: '#1565c0' }, // Bright Cobalt Blue
  { border: '#43a047', shadow: '#1b5e20', letter: '#2e7d32' }, // Playroom Emerald Green
  { border: '#fdd835', shadow: '#c68400', letter: '#e65100' }, // Sunny Amber Yellow
  { border: '#fb8c00', shadow: '#bf360c', letter: '#d84315' }, // Vibrant Toy Orange
  { border: '#8e24aa', shadow: '#4a148c', letter: '#6a1b9a' }  // Royal Toy Purple
];

interface WoodenBlockRowProps {
  word: string;
  startIndex: number;
  animateDrop?: boolean;
  dropCycleKey?: number;
}

const WOOD_LOGO_BASE_WIDTH = 476;
const WOOD_LOGO_BASE_HEIGHT = 124;

const WoodenBlockRow: React.FC<WoodenBlockRowProps> = ({
  word,
  startIndex,
  animateDrop = false,
  dropCycleKey = 0
}) => {
  const blockSize = 56;
  const fontSize = 30;
  const borderWidth = 4.5;
  const depthBottom = 7;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'nowrap' }}>
      {word.split('').map((ch, idx) => {
        if (ch === ' ') {
          return <div key={idx} style={{ width: '12px' }} />;
        }
        const globalIdx = startIndex + idx;
        const pal = WOOD_BLOCK_PALETTE[globalIdx % WOOD_BLOCK_PALETTE.length];
        const rotDeg = ((globalIdx % 2 === 0 ? 1 : -1) * (1.5 + (globalIdx % 3) * 0.7)).toFixed(1);
        const startRotDeg = ((globalIdx % 2 === 0 ? -1 : 1) * 20).toFixed(1);
        const delaySec = (globalIdx * 0.075).toFixed(3);

        return (
          <div
            key={`${dropCycleKey}-${idx}`}
            style={{
              width: `${blockSize}px`,
              height: `${blockSize}px`,
              borderRadius: '12px',
              background: 'linear-gradient(145deg, #fff3d6 0%, #f5d399 55%, #e2b46d 100%)',
              border: `${borderWidth}px solid ${pal.border}`,
              boxShadow: `0 ${depthBottom}px 0 ${pal.shadow}, 0 ${depthBottom + 7}px 16px rgba(0,0,0,0.48), inset 0 2px 3px rgba(255,255,255,0.85), inset 0 -2px 5px rgba(139, 90, 43, 0.35)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              userSelect: 'none',
              flexShrink: 0,
              ['--block-rot' as any]: `${rotDeg}deg`,
              ['--block-rot-start' as any]: `${startRotDeg}deg`,
              transform: `rotate(${rotDeg}deg)`,
              animation: animateDrop
                ? `toyBlockDrop 0.62s cubic-bezier(0.22, 1, 0.36, 1) ${delaySec}s both`
                : `toyBlockHeaderFloat 3.6s ease-in-out ${delaySec}s infinite`
            }}
          >
            <div style={{
              position: 'absolute',
              inset: '3.5px',
              borderRadius: '6px',
              border: '1px solid rgba(160, 105, 50, 0.28)',
              pointerEvents: 'none'
            }} />
            <span style={{
              fontFamily: '"Chakra Petch", "Arial Black", Impact, sans-serif',
              fontSize: `${fontSize}px`,
              fontWeight: 900,
              color: pal.letter,
              textShadow: '0 2px 0 rgba(255,255,255,0.75), 0 -1px 1px rgba(0,0,0,0.28)',
              lineHeight: 1
            }}>
              {ch}
            </span>
          </div>
        );
      })}
    </div>
  );
};

interface TankAnatomyBlueprintProps {
  skin: typeof TANK_SKINS_LIST[0];
  hat: typeof TANK_HATS_LIST[0];
  trail: typeof BULLET_TRAILS_LIST[0];
  perk: typeof TACTICAL_PERKS_LIST[0];
  onOpenHangar: () => void;
}

const TankAnatomyBlueprint: React.FC<TankAnatomyBlueprintProps> = ({
  skin,
  hat,
  trail,
  perk,
  onOpenHangar
}) => {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        background: 'radial-gradient(circle at 50% 48%, rgba(15, 23, 42, 0.62) 0%, rgba(9, 14, 26, 0.36) 72%, rgba(9, 14, 26, 0.15) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: '20px',
        padding: '18px 20px',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.38), inset 0 0 40px rgba(56, 189, 248, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden'
      }}
    >
      {/* Blueprint Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', zIndex: 2 }}>
        <div>
          <div style={{ fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', letterSpacing: '1.8px' }}>
            ESQUEMA TÉCNICO TÁCTICO • ESCALA 1:12
          </div>
          <div style={{ fontSize: '16px', fontWeight: 900, color: '#f8fafc', fontFamily: '"Chakra Petch", sans-serif' }}>
            ANATOMÍA DEL TANQUE: <span style={{ color: skin.accent }}>{skin.name.toUpperCase()}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenHangar}
          style={{
            backgroundColor: 'rgba(56, 189, 248, 0.16)',
            border: '1px solid rgba(56, 189, 248, 0.5)',
            color: '#38bdf8',
            borderRadius: '9px',
            padding: '6px 12px',
            fontSize: '10.5px',
            fontWeight: 900,
            cursor: 'pointer',
            fontFamily: '"Chakra Petch", sans-serif',
            letterSpacing: '0.6px'
          }}
        >
          🔧 PERSONALIZAR →
        </button>
      </div>

      {/* Minimalist Technical SVG Blueprint + Interactive Callouts */}
      <div style={{ position: 'relative', width: '100%', padding: '6px 0' }}>
        <svg
          viewBox="0 0 560 280"
          style={{ width: '100%', height: 'auto', maxHeight: '250px', display: 'block', filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.45))' }}
        >
          <defs>
            <pattern id="blueprintGrid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(56, 189, 248, 0.08)" strokeWidth="1" />
            </pattern>
            <linearGradient id="hullGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={skin.color} stopOpacity="0.9" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0.95" />
            </linearGradient>
          </defs>

          {/* Subtle Technical Grid Background */}
          <rect x="8" y="8" width="544" height="264" rx="14" fill="url(#blueprintGrid)" />

          {/* Crosshair & Radar Rings */}
          <circle cx="245" cy="155" r="98" fill="none" stroke="rgba(56, 189, 248, 0.14)" strokeWidth="1" strokeDasharray="5 5" />
          <circle cx="245" cy="155" r="126" fill="none" stroke="rgba(56, 189, 248, 0.08)" strokeWidth="1" />
          <line x1="90" y1="155" x2="430" y2="155" stroke="rgba(56, 189, 248, 0.12)" strokeWidth="1" />
          <line x1="245" y1="25" x2="245" y2="260" stroke="rgba(56, 189, 248, 0.12)" strokeWidth="1" />

          {/* Tank Tracks / Caterpillar Treads */}
          <rect x="128" y="192" width="234" height="44" rx="22" fill="#0f172a" stroke={skin.accent} strokeWidth="2.5" />
          <rect x="136" y="198" width="218" height="32" rx="16" fill="rgba(15, 23, 42, 0.9)" stroke="rgba(148, 163, 184, 0.35)" strokeWidth="1.2" strokeDasharray="8 4" />
          {[156, 192, 228, 264, 300, 334].map((cx, i) => (
            <g key={i}>
              <circle cx={cx} cy="214" r="12" fill="#1e293b" stroke={skin.accent} strokeWidth="2" />
              <circle cx={cx} cy="214" r="4" fill={skin.accent} />
            </g>
          ))}

          {/* Armored Hull / Toy Wooden-Alloy Chassis */}
          <polygon
            points="118,192 146,144 344,144 372,192"
            fill="url(#hullGrad)"
            stroke={skin.accent}
            strokeWidth="2.5"
          />
          <line x1="154" y1="168" x2="336" y2="168" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" strokeDasharray="10 5" />

          {/* Main Cannon Barrel + Muzzle Brake */}
          <rect x="304" y="110" width="128" height="16" rx="4" fill="#1e293b" stroke={trail.color} strokeWidth="2.2" />
          <rect x="424" y="106" width="20" height="24" rx="4" fill={trail.color} opacity="0.9" />
          {/* Laser Trajectory Line */}
          <line x1="446" y1="118" x2="532" y2="118" stroke={trail.color} strokeWidth="2.5" strokeDasharray="6 6" />
          <circle cx="536" cy="118" r="5" fill={trail.color} />

          {/* 360° Rotating Turret Dome */}
          <path
            d="M 182 144 C 186 94, 304 94, 308 144 Z"
            fill="url(#hullGrad)"
            stroke={skin.accent}
            strokeWidth="2.5"
          />
          <circle cx="245" cy="124" r="10" fill="rgba(15,23,42,0.8)" stroke={skin.accent} strokeWidth="1.8" />

          {/* Turret Topper / Hat Blueprint Node */}
          <rect x="215" y="56" width="60" height="34" rx="9" fill="rgba(15, 23, 42, 0.88)" stroke={hat.color || '#38bdf8'} strokeWidth="1.8" strokeDasharray="4 2" />
          <text x="245" y="79" textAnchor="middle" fontSize="20">
            {hat.id === 'none' ? '🎯' : hat.icon}
          </text>

          {/* Technical Callout Lines & Dots */}
          {/* 1. Top-Left: Turret Hat */}
          <circle cx="215" cy="73" r="4" fill={hat.color || '#e879f9'} />
          <polyline points="215,73 165,46 115,46" fill="none" stroke={hat.color || '#e879f9'} strokeWidth="1.5" />

          {/* 2. Top-Right: Cannon & Tracer */}
          <circle cx="385" cy="110" r="4" fill={trail.color} />
          <polyline points="385,110 420,62 465,62" fill="none" stroke={trail.color} strokeWidth="1.5" />

          {/* 3. Bottom-Left: Chassis & Skin */}
          <circle cx="152" cy="172" r="4" fill={skin.accent} />
          <polyline points="152,172 112,235 72,235" fill="none" stroke={skin.accent} strokeWidth="1.5" />

          {/* 4. Bottom-Right: Tactical Module & Treads */}
          <circle cx="334" cy="214" r="4" fill={perk.color} />
          <polyline points="334,214 390,242 448,242" fill="none" stroke={perk.color} strokeWidth="1.5" />
        </svg>

        {/* Interactive Callout Pills Overlaid on Corners */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            marginTop: '6px'
          }}
        >
          <button
            type="button"
            onClick={onOpenHangar}
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.78)',
              border: `1px solid ${skin.accent}66`,
              borderLeft: `3px solid ${skin.accent}`,
              borderRadius: '9px',
              padding: '7px 10px',
              textAlign: 'left',
              cursor: 'pointer',
              color: '#f8fafc'
            }}
          >
            <div style={{ fontSize: '9px', fontWeight: 900, color: skin.accent, letterSpacing: '0.8px' }}>
              01 • BLINDAJE Y CHASIS 3D
            </div>
            <div style={{ fontSize: '11.5px', fontWeight: 800, marginTop: '1px' }}>
              {skin.badge} {skin.name}
            </div>
          </button>

          <button
            type="button"
            onClick={onOpenHangar}
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.78)',
              border: `1px solid ${trail.color}66`,
              borderLeft: `3px solid ${trail.color}`,
              borderRadius: '9px',
              padding: '7px 10px',
              textAlign: 'left',
              cursor: 'pointer',
              color: '#f8fafc'
            }}
          >
            <div style={{ fontSize: '9px', fontWeight: 900, color: trail.color, letterSpacing: '0.8px' }}>
              02 • CAÑÓN Y TRAZADORA
            </div>
            <div style={{ fontSize: '11.5px', fontWeight: 800, marginTop: '1px' }}>
              {trail.icon} {trail.name}
            </div>
          </button>

          <button
            type="button"
            onClick={onOpenHangar}
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.78)',
              border: `1px solid ${hat.color || '#e879f9'}66`,
              borderLeft: `3px solid ${hat.color || '#e879f9'}`,
              borderRadius: '9px',
              padding: '7px 10px',
              textAlign: 'left',
              cursor: 'pointer',
              color: '#f8fafc'
            }}
          >
            <div style={{ fontSize: '9px', fontWeight: 900, color: hat.color || '#e879f9', letterSpacing: '0.8px' }}>
              03 • TORRETA 360° (CASCO)
            </div>
            <div style={{ fontSize: '11.5px', fontWeight: 800, marginTop: '1px' }}>
              {hat.icon} {hat.name}
            </div>
          </button>

          <button
            type="button"
            onClick={onOpenHangar}
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.78)',
              border: `1px solid ${perk.color}66`,
              borderLeft: `3px solid ${perk.color}`,
              borderRadius: '9px',
              padding: '7px 10px',
              textAlign: 'left',
              cursor: 'pointer',
              color: '#f8fafc'
            }}
          >
            <div style={{ fontSize: '9px', fontWeight: 900, color: perk.color, letterSpacing: '0.8px' }}>
              04 • MÓDULO TÁCTICO
            </div>
            <div style={{ fontSize: '11.5px', fontWeight: 800, marginTop: '1px' }}>
              {perk.icon} {perk.name}
            </div>
          </button>
        </div>
      </div>

      {/* Minimalist Keybind Strip */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '6px',
        paddingTop: '10px',
        marginTop: '8px',
        borderTop: '1px solid rgba(148, 163, 184, 0.16)',
        fontSize: '10.5px',
        color: '#cbd5e1'
      }}>
        <span>🕹️ <kbd style={styles.kbd}>WASD</kbd> + <kbd style={styles.kbd}>Clic</kbd></span>
        <span>🚀 Bazoca <kbd style={styles.kbd}>Q</kbd>/<kbd style={styles.kbd}>Shift</kbd></span>
        <span>💣 Mina <kbd style={styles.kbd}>Espacio</kbd></span>
        <span>🔍 Cámara <kbd style={styles.kbd}>C</kbd> • <kbd style={styles.kbd}>Z/X</kbd></span>
      </div>
    </div>
  );
};

interface MainMenuProps {
  onStart: () => void;
  onQuickStartLevel: (lvl: number) => void;
  onLevelSelect: () => void;
  onOpenIntel: () => void;
  onOpenHangar: () => void;
  onOpenStore: (initialTab?: 'featured' | 'battlepass' | 'crate' | 'gems') => void;
  onQuickBuyStarterPack: () => void;
  onOpenSettings: () => void;
  onReplayIntro?: () => void;
  unlockedLevel: number;
  totalLevels: number;
  totalStars: number;
  aiDifficulty: string;
  onSelectDifficulty: (diffId: string) => void;
  isMusicMuted: boolean;
  onToggleMusic: () => void;
  selectedSkin: string;
  selectedPerk: string;
  selectedHat: string;
  selectedTrail?: string;
  coins: number;
  gems: number;
  bpXp: number;
  vipPassActive: boolean;
  supporterBadge: boolean;
  starterPackOwned: boolean;
  showIntroSplash?: boolean;
  onFinishIntro?: () => void;
  onPlayBlockSound?: (index: number) => void;
}

const MainMenu: React.FC<MainMenuProps> = ({
  onStart,
  onQuickStartLevel,
  onLevelSelect,
  onOpenIntel,
  onOpenHangar,
  onOpenStore,
  onQuickBuyStarterPack,
  onOpenSettings,
  onReplayIntro,
  showIntroSplash = false,
  onFinishIntro,
  onPlayBlockSound,
  unlockedLevel,
  totalLevels,
  totalStars,
  aiDifficulty,
  onSelectDifficulty,
  isMusicMuted,
  onToggleMusic,
  selectedSkin,
  selectedPerk,
  selectedHat,
  selectedTrail = 'standard',
  coins,
  gems,
  bpXp,
  vipPassActive,
  supporterBadge,
  starterPackOwned
}) => {
  const currentMission = Math.min(unlockedLevel, totalLevels);
  const currentBiomeId = LevelLoader.getBiome(currentMission);
  const currentBiome = BIOMES_LIST.find(b => b.id === currentBiomeId) || BIOMES_LIST[1];
  const progressPct = Math.min(100, Math.round(((unlockedLevel - 1) / totalLevels) * 100));
  const activeSkinObj = TANK_SKINS_LIST.find(s => s.id === selectedSkin) || TANK_SKINS_LIST[0];
  const activePerkObj = TACTICAL_PERKS_LIST.find(p => p.id === selectedPerk) || TACTICAL_PERKS_LIST[0];
  const activeHatObj = TANK_HATS_LIST.find(h => h.id === selectedHat) || TANK_HATS_LIST[0];
  const activeTrailObj = BULLET_TRAILS_LIST.find(t => t.id === selectedTrail) || BULLET_TRAILS_LIST[0];
  const bpLevel = Math.min(10, Math.floor(bpXp / 100) + 1);

  // Seamless FLIP Wooden Block Title Intro -> Top-Left Slot State
  // CRITICAL MOBILE FIX: Compute initial centerOffset synchronously from window.innerWidth/innerHeight
  // AND measure inside useLayoutEffect BEFORE first browser paint so the title NEVER flashes in a corner on mobile!
  const logoSlotRef = useRef<HTMLDivElement | null>(null);
  const [introPhase, setIntroPhase] = useState<'center' | 'docking' | 'docked'>(() =>
    showIntroSplash ? 'center' : 'docked'
  );
  const [dropCycleKey, setDropCycleKey] = useState(0);
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 800
  }));
  const [centerOffset, setCenterOffset] = useState(() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const cScale = Math.min(1.06, (vw - 26) / WOOD_LOGO_BASE_WIDTH, (vh * 0.44) / WOOD_LOGO_BASE_HEIGHT);
    const targetCenterX = (vw - WOOD_LOGO_BASE_WIDTH * cScale) / 2;
    const targetCenterY = (vh - WOOD_LOGO_BASE_HEIGHT * cScale) / 2 - 18;
    const approxPadX = Math.min(26, Math.max(14, vw * 0.028));
    const approxPadY = Math.min(20, Math.max(12, vw * 0.022));
    return {
      x: Math.round(targetCenterX - approxPadX),
      y: Math.round(targetCenterY - approxPadY),
      scale: Number(cScale.toFixed(4))
    };
  });

  const isMobileScreen = viewport.w < 680;
  const dockScale = isMobileScreen ? 0.36 : 0.44;
  const slotWidth = Math.round(WOOD_LOGO_BASE_WIDTH * dockScale);
  const slotHeight = Math.round(WOOD_LOGO_BASE_HEIGHT * dockScale);

  const measureCenterOffset = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setViewport({ w: vw, h: vh });

    // Responsive scale so "ARENA 3D" (476px base width) NEVER cuts off on mobile screens
    const cScale = Math.min(1.06, (vw - 26) / WOOD_LOGO_BASE_WIDTH, (vh * 0.44) / WOOD_LOGO_BASE_HEIGHT);
    const targetCenterX = (vw - WOOD_LOGO_BASE_WIDTH * cScale) / 2;
    const targetCenterY = (vh - WOOD_LOGO_BASE_HEIGHT * cScale) / 2 - 18;

    if (logoSlotRef.current) {
      const rect = logoSlotRef.current.getBoundingClientRect();
      setCenterOffset({
        x: Math.round(targetCenterX - rect.left),
        y: Math.round(targetCenterY - rect.top),
        scale: Number(cScale.toFixed(4))
      });
    } else {
      const approxPadX = Math.min(26, Math.max(14, vw * 0.028));
      const approxPadY = Math.min(20, Math.max(12, vw * 0.022));
      setCenterOffset({
        x: Math.round(targetCenterX - approxPadX),
        y: Math.round(targetCenterY - approxPadY),
        scale: Number(cScale.toFixed(4))
      });
    }
  }, []);

  // Measure synchronously before the browser paints the very first frame!
  useLayoutEffect(() => {
    measureCenterOffset();
    window.addEventListener('resize', measureCenterOffset);
    return () => window.removeEventListener('resize', measureCenterOffset);
  }, [measureCenterOffset]);

  // Trigger or replay the center wooden block drop & smooth corner glide
  useLayoutEffect(() => {
    if (!showIntroSplash) return;
    measureCenterOffset();
    setIntroPhase('center');
    setDropCycleKey(k => k + 1);

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < 12; i++) {
      timers.push(
        setTimeout(() => {
          onPlayBlockSound?.(i);
        }, i * 75 + 240)
      );
    }

    // Hold the completed title in the center up to 2.95s so the player can admire it,
    // then glide smoothly over 1.25s directly into its top-left slot with ZERO DOM swap!
    timers.push(
      setTimeout(() => {
        measureCenterOffset();
        setIntroPhase('docking');
      }, 2950)
    );
    timers.push(
      setTimeout(() => {
        setIntroPhase('docked');
        onFinishIntro?.();
      }, 4200)
    );

    return () => timers.forEach(t => clearTimeout(t));
  }, [showIntroSplash, measureCenterOffset, onFinishIntro, onPlayBlockSound]);

  const handleSkipIntro = () => {
    if (introPhase === 'center') {
      measureCenterOffset();
      setIntroPhase('docking');
      setTimeout(() => {
        setIntroPhase('docked');
        onFinishIntro?.();
      }, 1150);
    }
  };

  const effectivePhase = showIntroSplash && introPhase === 'docked' ? 'center' : introPhase;
  const isCenterPhase = effectivePhase === 'center';
  const menuRevealed = effectivePhase !== 'center';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 'clamp(12px, 2.2vw, 20px) clamp(14px, 2.8vw, 26px)',
        boxSizing: 'border-box',
        overflowY: 'auto',
        overflowX: 'hidden',
        background: isCenterPhase
          ? 'radial-gradient(circle at 50% 45%, rgba(30, 41, 59, 0.72) 0%, rgba(7, 11, 20, 0.94) 100%)'
          : 'radial-gradient(circle at 55% 45%, rgba(15, 23, 42, 0.25) 0%, rgba(6, 10, 19, 0.78) 100%)',
        backdropFilter: isCenterPhase ? 'blur(12px)' : 'blur(6px)',
        transition: 'background 0.95s ease, backdrop-filter 0.95s ease',
        pointerEvents: 'auto'
      }}
    >
      {/* Click-Anywhere Overlay during Center Showcase Phase to glide immediately */}
      {isCenterPhase && (
        <div
          onClick={handleSkipIntro}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 250,
            cursor: 'pointer'
          }}
        >
          <div
            style={{
              position: 'absolute',
              bottom: '12%',
              left: '50%',
              transform: 'translateX(-50%)',
              textAlign: 'center',
              width: '90%',
              maxWidth: '380px',
              pointerEvents: 'none'
            }}
          >
            <div style={{
              display: 'inline-block',
              padding: '8px 18px',
              borderRadius: '20px',
              backgroundColor: 'rgba(15, 23, 42, 0.88)',
              border: '1px solid rgba(251, 191, 36, 0.5)',
              color: '#fde047',
              fontSize: 'clamp(10px, 2.8vw, 11.5px)',
              fontWeight: 900,
              letterSpacing: '1.3px',
              boxShadow: '0 10px 28px rgba(0,0,0,0.5)'
            }}>
              ★ TOYBOX TACTICAL STUDIOS • TOCA PARA CONTINUAR ★
            </div>
          </div>
        </div>
      )}

      {/* TOP BAR: Left Docked Wooden Blocks Title + Right Floating Economy Wallet */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          width: '100%',
          maxWidth: '1260px',
          margin: '0 auto',
          position: 'relative',
          zIndex: isCenterPhase ? 260 : 10
        }}
      >
        {/* Top-Left: Persistent 3D Wooden Blocks Logo Slot (Zero-Jerk FLIP Anchor) + Star Count */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          {/* Reserved Slot Box: The Wooden Blocks live inside this exact box and transition from (centerOffset.x, centerOffset.y, centerScale) -> (0, 0, dockScale)! */}
          <div
            ref={logoSlotRef}
            onClick={() => {
              if (introPhase === 'docked' && onReplayIntro) {
                onReplayIntro();
              } else if (isCenterPhase) {
                handleSkipIntro();
              }
            }}
            title="Haz clic para repetir la animación de bloques de madera"
            style={{
              position: 'relative',
              width: `${slotWidth}px`,
              height: `${slotHeight}px`,
              cursor: 'pointer',
              flexShrink: 0,
              zIndex: 260
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${WOOD_LOGO_BASE_WIDTH}px`,
                height: `${WOOD_LOGO_BASE_HEIGHT}px`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transformOrigin: '0 0',
                willChange: 'transform',
                transform: isCenterPhase
                  ? `translate3d(${centerOffset.x}px, ${centerOffset.y}px, 0) scale(${centerOffset.scale})`
                  : `translate3d(0px, 0px, 0) scale(${dockScale})`,
                transition: effectivePhase === 'docking'
                  ? 'transform 1.2s cubic-bezier(0.22, 1, 0.36, 1)'
                  : 'none',
                pointerEvents: 'none'
              }}
            >
              <WoodenBlockRow
                word="TANKS"
                startIndex={0}
                animateDrop={isCenterPhase}
                dropCycleKey={dropCycleKey}
              />
              <WoodenBlockRow
                word="ARENA 3D"
                startIndex={5}
                animateDrop={isCenterPhase}
                dropCycleKey={dropCycleKey}
              />
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '6px',
              alignItems: 'center',
              flexWrap: 'wrap',
              opacity: menuRevealed ? 1 : 0,
              transform: menuRevealed ? 'translateY(0)' : 'translateY(-6px)',
              transition: 'opacity 0.75s ease 0.15s, transform 0.75s ease 0.15s',
              pointerEvents: menuRevealed ? 'auto' : 'none'
            }}
          >
            <span style={{
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(251, 191, 36, 0.5)',
              color: '#fbbf24',
              fontSize: '11px',
              fontWeight: 900,
              padding: '5px 10px',
              borderRadius: '8px',
              fontVariantNumeric: 'tabular-nums'
            }}>
              ★ {totalStars}/{totalLevels * 3}
            </span>
            {vipPassActive && (
              <span style={{
                backgroundColor: 'rgba(168, 85, 247, 0.25)',
                border: '1px solid rgba(192, 132, 252, 0.65)',
                color: '#e879f9',
                fontSize: '10px',
                fontWeight: 900,
                padding: '5px 9px',
                borderRadius: '8px'
              }}>
                👑 VIP
              </span>
            )}
            {supporterBadge && (
              <span style={{
                backgroundColor: 'rgba(74, 222, 128, 0.2)',
                border: '1px solid rgba(74, 222, 128, 0.5)',
                color: '#4ade80',
                fontSize: '10px',
                fontWeight: 900,
                padding: '5px 9px',
                borderRadius: '8px'
              }}>
                ☕ MECENAS
              </span>
            )}
          </div>
        </div>

        {/* Top-Right: Floating Currency Wallet & Audio Pill */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            flexWrap: 'wrap',
            opacity: menuRevealed ? 1 : 0,
            transform: menuRevealed ? 'translateY(0)' : 'translateY(-6px)',
            transition: 'opacity 0.75s ease 0.15s, transform 0.75s ease 0.15s',
            pointerEvents: menuRevealed ? 'auto' : 'none'
          }}
        >
          <button
            type="button"
            onClick={() => onOpenStore('battlepass')}
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.88)',
              border: '1.5px solid rgba(192, 132, 252, 0.6)',
              borderRadius: '10px',
              padding: '7px 11px',
              color: '#e879f9',
              fontSize: '11.5px',
              fontWeight: 900,
              cursor: 'pointer'
            }}
          >
            🎖️ PASE NV.{bpLevel}
          </button>

          <button
            type="button"
            onClick={onOpenHangar}
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.88)',
              border: '1.5px solid rgba(251, 191, 36, 0.6)',
              borderRadius: '10px',
              padding: '7px 11px',
              color: '#fbbf24',
              fontSize: '12px',
              fontWeight: 900,
              cursor: 'pointer',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            🪙 {coins.toLocaleString()}
          </button>

          <button
            type="button"
            onClick={() => onOpenStore('gems')}
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.88)',
              border: '1.5px solid rgba(56, 189, 248, 0.7)',
              borderRadius: '10px',
              padding: '7px 11px',
              color: '#38bdf8',
              fontSize: '12px',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            <span>💎 {gems.toLocaleString()}</span>
            <span style={{
              backgroundColor: '#38bdf8',
              color: '#0f172a',
              borderRadius: '4px',
              padding: '0 5px',
              fontSize: '10px',
              fontWeight: 900
            }}>+</span>
          </button>

          <button
            type="button"
            data-audio-toggle="true"
            onClick={onToggleMusic}
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.88)',
              border: isMusicMuted ? '1px solid rgba(148, 163, 184, 0.35)' : '1px solid rgba(74, 222, 128, 0.55)',
              color: isMusicMuted ? '#94a3b8' : '#4ade80',
              fontSize: '11.5px',
              fontWeight: 800,
              padding: '7px 11px',
              borderRadius: '10px',
              cursor: 'pointer'
            }}
            title="Activar / Silenciar Música"
          >
            {isMusicMuted ? '🔇' : '🎵'}
          </button>
        </div>
      </div>

      {/* CENTER WORKSPACE: Frameless Floating Left Navigation + Right Tank Anatomy Blueprint */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          gap: 'clamp(16px, 2.5vw, 26px)',
          alignItems: 'center',
          width: '100%',
          maxWidth: '1260px',
          margin: 'auto',
          padding: '12px 0',
          opacity: menuRevealed ? 1 : 0,
          transform: menuRevealed ? 'translateY(0)' : 'translateY(14px)',
          transition: 'opacity 0.85s cubic-bezier(0.22, 1, 0.36, 1) 0.18s, transform 0.85s cubic-bezier(0.22, 1, 0.36, 1) 0.18s',
          pointerEvents: menuRevealed ? 'auto' : 'none'
        }}
      >
        {/* LEFT SIDE: Floating Action Menu + Integrated Campaign Expediente */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
          {/* 1. Primary Play Campaign CTA */}
          <button
            className="tactical-btn-primary"
            onClick={onStart}
            style={{
              ...styles.primaryButton,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textAlign: 'left',
              borderRadius: '14px',
              boxShadow: '0 12px 32px rgba(245, 158, 11, 0.38)'
            }}
          >
            <div>
              <div style={{ fontSize: '10px', fontWeight: 900, color: '#451a03', letterSpacing: '1.2px' }}>
                {currentBiome.icon} {currentBiome.label.toUpperCase()} • {LevelLoader.getLevelName(currentMission).toUpperCase()}
              </div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
                ▶ JUGAR MISIÓN #{currentMission}
              </div>
            </div>
            <span style={{
              backgroundColor: 'rgba(15, 23, 42, 0.18)',
              padding: '7px 12px',
              borderRadius: '9px',
              fontSize: '12px',
              fontWeight: 900,
              color: '#0f172a'
            }}>
              DESPLEGAR →
            </span>
          </button>

          {/* 2. Prominent Store & VIP Battle Pass Button */}
          <button
            className="studio-menu-item"
            onClick={() => onOpenStore('featured')}
            style={{
              ...styles.studioMenuBtn,
              padding: '14px 18px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(88, 28, 135, 0.65) 0%, rgba(15, 23, 42, 0.85) 100%)',
              border: '1.5px solid rgba(232, 121, 249, 0.6)',
              borderLeft: '5px solid #e879f9',
              boxShadow: '0 10px 28px rgba(168, 85, 247, 0.25)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ ...styles.studioMenuIcon, backgroundColor: 'rgba(168, 85, 247, 0.3)', borderColor: 'rgba(232, 121, 249, 0.55)' }}>💎</span>
              <div>
                <div style={{ ...styles.studioMenuTitle, color: '#f5d0fe', fontSize: '14.5px' }}>TIENDA, PASE VIP Y COFRES</div>
                <div style={styles.studioMenuSub}>Skins Míticas • Caja Misteriosa • Regalo Diario Gratis</div>
              </div>
            </div>
            <span style={{
              background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)',
              padding: '4px 9px',
              borderRadius: '7px',
              fontSize: '10px',
              fontWeight: 900,
              color: '#fff'
            }}>
              ¡OFERTAS!
            </span>
          </button>

          {/* 3. Hangar 3D & Mission Select in Clean 2-Column Floating Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              className="studio-menu-item"
              onClick={onOpenHangar}
              style={{
                ...styles.studioMenuBtn,
                padding: '13px 14px',
                borderRadius: '13px',
                borderLeft: '4px solid #38bdf8',
                backgroundColor: 'rgba(9, 14, 26, 0.72)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={styles.studioMenuIcon}>🔧</span>
                <div>
                  <div style={styles.studioMenuTitle}>HANGAR 3D</div>
                  <div style={styles.studioMenuSub}>Skins y Prueba Gratis</div>
                </div>
              </div>
            </button>

            <button
              className="studio-menu-item"
              onClick={onLevelSelect}
              style={{
                ...styles.studioMenuBtn,
                padding: '13px 14px',
                borderRadius: '13px',
                borderLeft: '4px solid #fbbf24',
                backgroundColor: 'rgba(9, 14, 26, 0.72)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={styles.studioMenuIcon}>🗺️</span>
                <div>
                  <div style={styles.studioMenuTitle}>160 MISIONES</div>
                  <div style={styles.studioMenuSub}>Desbloqueo Progresivo</div>
                </div>
              </div>
            </button>
          </div>

          {/* 4. Compact Campaign Expediente & Quick Biome / AI Bar */}
          <div style={{
            backgroundColor: 'rgba(9, 14, 26, 0.68)',
            border: '1px solid rgba(148, 163, 184, 0.22)',
            borderRadius: '14px',
            padding: '12px 15px',
            backdropFilter: 'blur(8px)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', letterSpacing: '1px' }}>
                EXPEDIENTE DE CAMPAÑA ({Math.min(unlockedLevel - 1, totalLevels)}/{totalLevels})
              </span>
              <span style={{ fontSize: '10px', fontWeight: 900, color: '#fde047' }}>
                ACCESO RÁPIDO BIOMAS
              </span>
            </div>

            <div style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
              <div style={{
                width: `${Math.max(5, progressPct)}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)',
                borderRadius: '4px'
              }} />
            </div>

            {/* 4 Featured Biomes Direct Launch */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '10px' }}>
              <button
                type="button"
                onClick={() => onQuickStartLevel(49)}
                style={{
                  backgroundColor: 'rgba(255, 138, 101, 0.16)',
                  border: '1px solid rgba(255, 138, 101, 0.45)',
                  color: '#ffab91',
                  borderRadius: '7px',
                  padding: '5px 4px',
                  fontSize: '10px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                🌇 M49
              </button>
              <button
                type="button"
                onClick={() => onQuickStartLevel(57)}
                style={{
                  backgroundColor: 'rgba(244, 114, 182, 0.16)',
                  border: '1px solid rgba(244, 114, 182, 0.45)',
                  color: '#f9a8d4',
                  borderRadius: '7px',
                  padding: '5px 4px',
                  fontSize: '10px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                🏮 M57
              </button>
              <button
                type="button"
                onClick={() => onQuickStartLevel(65)}
                style={{
                  backgroundColor: 'rgba(45, 212, 191, 0.16)',
                  border: '1px solid rgba(45, 212, 191, 0.45)',
                  color: '#5eead4',
                  borderRadius: '7px',
                  padding: '5px 4px',
                  fontSize: '10px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                🏝️ M65
              </button>
              <button
                type="button"
                onClick={() => onQuickStartLevel(73)}
                style={{
                  backgroundColor: 'rgba(129, 140, 248, 0.2)',
                  border: '1px solid rgba(129, 140, 248, 0.55)',
                  color: '#c7d2fe',
                  borderRadius: '7px',
                  padding: '5px 4px',
                  fontSize: '10px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                🌙 M73
              </button>
            </div>

            {/* AI Difficulty Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px' }}>
              {AI_DIFFICULTIES_LIST.map(d => {
                const active = aiDifficulty === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onSelectDifficulty(d.id)}
                    style={{
                      backgroundColor: active ? `${d.color}24` : 'rgba(30, 41, 59, 0.65)',
                      border: active ? `1.5px solid ${d.color}` : '1px solid rgba(148, 163, 184, 0.2)',
                      color: active ? d.color : '#94a3b8',
                      borderRadius: '7px',
                      padding: '5px 4px',
                      fontSize: '10px',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    {d.icon} {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Settings & Tactical Manual Compact Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              className="studio-menu-item"
              onClick={onOpenSettings}
              style={{
                ...styles.studioMenuBtn,
                padding: '10px 14px',
                borderRadius: '12px',
                borderLeft: '3px solid #a855f7',
                backgroundColor: 'rgba(9, 14, 26, 0.68)'
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 900 }}>⚙️ AJUSTES</span>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>Audio / Cámara</span>
            </button>

            <button
              className="studio-menu-item"
              onClick={onOpenIntel}
              style={{
                ...styles.studioMenuBtn,
                padding: '10px 14px',
                borderRadius: '12px',
                borderLeft: '3px solid #4ade80',
                backgroundColor: 'rgba(9, 14, 26, 0.68)'
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 900 }}>📖 MANUAL</span>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>Guía Táctica</span>
            </button>
          </div>
        </div>

        {/* RIGHT SIDE: Minimalist Tank Anatomy Blueprint + Starter Offer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <TankAnatomyBlueprint
            skin={activeSkinObj}
            hat={activeHatObj}
            trail={activeTrailObj}
            perk={activePerkObj}
            onOpenHangar={onOpenHangar}
          />

          {!starterPackOwned && (
            <div
              onClick={onQuickBuyStarterPack}
              style={{
                background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.3) 0%, rgba(15, 23, 42, 0.85) 100%)',
                border: '1.5px solid rgba(251, 191, 36, 0.65)',
                borderRadius: '14px',
                padding: '11px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                backdropFilter: 'blur(8px)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>🐉</span>
                <div>
                  <div style={{ fontSize: '9.5px', fontWeight: 900, color: '#fde047', letterSpacing: '1px' }}>
                    PACK DE INICIO (-70% DTO)
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 900, color: '#f8fafc', fontFamily: '"Chakra Petch", sans-serif' }}>
                    Skin Dragón + 300 💎 + 2.500 🪙
                  </div>
                </div>
              </div>
              <span style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                color: '#0f172a',
                fontWeight: 900,
                fontSize: '12px',
                padding: '7px 12px',
                borderRadius: '8px',
                whiteSpace: 'nowrap'
              }}>
                1,99 € →
              </span>
            </div>
          )}
        </div>
      </div>

      <div style={{ height: '4px' }} />
    </div>
  );
};

interface SettingsModalProps {
  aiDifficulty: string;
  onSelectDifficulty: (diffId: string) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isMusicMuted: boolean;
  onToggleMusic: () => void;
  sfxVolume: number;
  onChangeSfxVolume: (pct: number) => void;
  musicVolume: number;
  onChangeMusicVolume: (pct: number) => void;
  touchControlsEnabled: boolean;
  onToggleTouchControls: () => void;
  cameraMode: 'overview' | 'follow';
  onToggleCamera: () => void;
  onReplayIntro: () => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  aiDifficulty,
  onSelectDifficulty,
  isMuted,
  onToggleMute,
  isMusicMuted,
  onToggleMusic,
  sfxVolume,
  onChangeSfxVolume,
  musicVolume,
  onChangeMusicVolume,
  touchControlsEnabled,
  onToggleTouchControls,
  cameraMode,
  onToggleCamera,
  onReplayIntro,
  onClose
}) => {
  return (
    <div
      style={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={{ ...styles.menuBox, maxWidth: '560px', textAlign: 'left', padding: '22px 26px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(148, 163, 184, 0.2)', paddingBottom: '12px', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 800, color: '#c084fc', letterSpacing: '1.5px' }}>SISTEMA</div>
            <h2 style={{ ...styles.title, fontSize: '21px', margin: 0 }}>⚙️ AJUSTES</h2>
          </div>
          <ModalCloseButton onClick={onClose} />
        </div>

        {/* 1. Audio & Volume Sliders */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#fbbf24', letterSpacing: '0.8px', marginBottom: '8px' }}>
            🔊 MEZCLADOR DE AUDIO (EFECTOS Y MÚSICA)
          </div>

          <div style={{
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {/* SFX Volume Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: isMuted ? '#94a3b8' : '#38bdf8' }}>
                  💥 Efectos (Disparos y Explosiones)
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 900, color: isMuted ? '#64748b' : '#f8fafc', fontVariantNumeric: 'tabular-nums', minWidth: '38px', textAlign: 'right' }}>
                    {isMuted ? '0%' : `${sfxVolume}%`}
                  </span>
                  <button
                    type="button"
                    data-audio-toggle="true"
                    onClick={onToggleMute}
                    style={{
                      backgroundColor: isMuted ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                      border: isMuted ? '1px solid rgba(248, 113, 113, 0.5)' : '1px solid rgba(56, 189, 248, 0.5)',
                      color: isMuted ? '#f87171' : '#38bdf8',
                      borderRadius: '7px',
                      padding: '4px 8px',
                      fontSize: '10px',
                      fontWeight: 900,
                      cursor: 'pointer'
                    }}
                  >
                    {isMuted ? '🔇 OFF' : '🔊 ON'}
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={isMuted ? 0 : sfxVolume}
                onChange={(e) => onChangeSfxVolume(Number(e.target.value))}
                style={{
                  width: '100%',
                  accentColor: '#38bdf8',
                  cursor: 'pointer',
                  height: '6px'
                }}
              />
            </div>

            {/* Music Volume Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: isMusicMuted ? '#94a3b8' : '#4ade80' }}>
                  🎵 Música (Menú y Marchas de Combate)
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 900, color: isMusicMuted ? '#64748b' : '#f8fafc', fontVariantNumeric: 'tabular-nums', minWidth: '38px', textAlign: 'right' }}>
                    {isMusicMuted ? '0%' : `${musicVolume}%`}
                  </span>
                  <button
                    type="button"
                    data-audio-toggle="true"
                    onClick={onToggleMusic}
                    style={{
                      backgroundColor: isMusicMuted ? 'rgba(239, 68, 68, 0.2)' : 'rgba(74, 222, 128, 0.2)',
                      border: isMusicMuted ? '1px solid rgba(248, 113, 113, 0.5)' : '1px solid rgba(74, 222, 128, 0.5)',
                      color: isMusicMuted ? '#f87171' : '#4ade80',
                      borderRadius: '7px',
                      padding: '4px 8px',
                      fontSize: '10px',
                      fontWeight: 900,
                      cursor: 'pointer'
                    }}
                  >
                    {isMusicMuted ? '🔇 OFF' : '🎵 ON'}
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={isMusicMuted ? 0 : musicVolume}
                onChange={(e) => onChangeMusicVolume(Number(e.target.value))}
                style={{
                  width: '100%',
                  accentColor: '#4ade80',
                  cursor: 'pointer',
                  height: '6px'
                }}
              />
            </div>
          </div>
        </div>

        {/* 2. AI Difficulty */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.8px', marginBottom: '7px' }}>
            🤖 DIFICULTAD IA
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '7px' }}>
            {AI_DIFFICULTIES_LIST.map(d => {
              const active = aiDifficulty === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onSelectDifficulty(d.id)}
                  style={{
                    backgroundColor: active ? `${d.color}24` : 'rgba(15, 23, 42, 0.8)',
                    border: active ? `2px solid ${d.color}` : '1px solid rgba(148, 163, 184, 0.25)',
                    color: active ? d.color : '#cbd5e1',
                    borderRadius: '9px',
                    padding: '9px 6px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {d.icon} {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Controls & Intro */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#4ade80', letterSpacing: '0.8px', marginBottom: '7px' }}>
            🎮 CONTROLES Y CÁMARA
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button type="button" onClick={onToggleTouchControls} style={styles.secondaryButton}>
              📱 TÁCTIL: {touchControlsEnabled ? 'ON' : 'OFF'}
            </button>
            <button type="button" onClick={onToggleCamera} style={styles.secondaryButton}>
              🔍 CÁMARA: {cameraMode === 'overview' ? 'MAPA' : 'TANQUE'}
            </button>
          </div>
          <button
            type="button"
            onClick={onReplayIntro}
            style={{
              ...styles.tertiaryButton,
              marginTop: '8px',
              borderColor: 'rgba(251, 191, 36, 0.4)',
              color: '#fde047',
              fontWeight: 800
            }}
          >
            🧱 VER INTRO DE BLOQUES DE MADERA
          </button>
        </div>

        <button className="tactical-btn-primary" style={styles.primaryButton} onClick={onClose}>
          ✓ LISTO
        </button>
      </div>
    </div>
  );
};

interface LevelSelectProps {
  unlocked: number;
  unlockAll: boolean;
  missionStars: Record<number, number>;
  onToggleUnlockAll: () => void;
  onSelectLevel: (lvl: number) => void;
  onOpenHangar: () => void;
  onBack: () => void;
}

const LevelSelect: React.FC<LevelSelectProps> = ({
  unlocked,
  unlockAll,
  missionStars,
  onToggleUnlockAll,
  onSelectLevel,
  onOpenHangar,
  onBack
}) => {
  const [selectedBiomeFilter, setSelectedBiomeFilter] = useState<string>('all');
  const totalLevels = LevelLoader.getLevelCount();
  const allLevels = Array.from({ length: totalLevels }, (_, i) => i + 1);
  const totalStars = (Object.values(missionStars) as number[]).reduce((acc: number, s: number) => acc + (s || 0), 0);

  const filteredLevels = allLevels.filter(lvl => {
    if (selectedBiomeFilter === 'all') return true;
    const biome = LevelLoader.getBiome(lvl);
    return biome === selectedBiomeFilter;
  });

  return (
    <div
      style={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onBack();
      }}
    >
      <div style={{
        ...styles.menuBox,
        maxWidth: '920px',
        maxHeight: 'calc(100vh - 36px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 24px'
      }}>
        {/* Header Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          flexWrap: 'wrap',
          gap: '10px',
          flexShrink: 0
        }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: '#fbbf24', letterSpacing: '1.5px' }}>
              CAMPAÑA • ★ {totalStars}/{totalLevels * 3}
            </div>
            <h2 style={{ ...styles.title, fontSize: '22px', margin: '2px 0 0 0' }}>🗺️ MISIONES</h2>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                const maxPool = unlockAll ? totalLevels : Math.max(1, unlocked);
                const rndLvl = Math.floor(Math.random() * maxPool) + 1;
                onSelectLevel(rndLvl);
              }}
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                color: '#fbbf24',
                border: '1px solid rgba(251, 191, 36, 0.6)',
                height: '36px',
                padding: '0 13px',
                borderRadius: '9px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 900
              }}
              title="Jugar una misión aleatoria al instante"
            >
              🎲 SORPRESA
            </button>
            <button
              onClick={onOpenHangar}
              style={{
                backgroundColor: 'rgba(56, 189, 248, 0.16)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.5)',
                height: '36px',
                padding: '0 13px',
                borderRadius: '9px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 800
              }}
            >
              🔧 HANGAR
            </button>
            <button
              onClick={onToggleUnlockAll}
              style={{
                backgroundColor: unlockAll ? 'rgba(34, 197, 94, 0.18)' : 'rgba(148, 163, 184, 0.14)',
                color: unlockAll ? '#4ade80' : '#cbd5e1',
                border: unlockAll ? '1px solid rgba(74, 222, 128, 0.5)' : '1px solid rgba(148, 163, 184, 0.3)',
                height: '36px',
                padding: '0 13px',
                borderRadius: '9px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 800
              }}
            >
              {unlockAll ? `🔓 TODAS (${totalLevels})` : '🔒 PROGRESIÓN'}
            </button>
            <ModalCloseButton onClick={onBack} />
          </div>
        </div>

        {/* Biome Filter Tabs */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          flexShrink: 0,
          paddingBottom: '10px',
          marginBottom: '10px',
          borderBottom: '1px solid rgba(148, 163, 184, 0.18)'
        }}>
          {BIOMES_LIST.map(b => {
            const active = selectedBiomeFilter === b.id;
            return (
              <button
                key={b.id}
                onClick={() => setSelectedBiomeFilter(b.id)}
                style={{
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  height: '32px',
                  padding: '0 11px',
                  border: active ? `1.5px solid ${b.color}` : '1px solid rgba(148, 163, 184, 0.24)',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  backgroundColor: active ? b.accent : 'rgba(15, 23, 42, 0.75)',
                  color: active ? b.color : '#cbd5e1',
                  whiteSpace: 'nowrap'
                }}
              >
                <span>{b.icon}</span>
                <span>{b.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Mission Grid */}
        <div style={{ overflowY: 'auto', flex: '1 1 auto', minHeight: 0, paddingRight: '4px' }}>
          <div style={styles.levelGrid}>
            {filteredLevels.map(lvl => {
              const isUnlocked = unlockAll || lvl <= unlocked;
              const stars = missionStars[lvl] || 0;
              const isCompleted = stars > 0 || (!unlockAll && lvl < unlocked);
              const isBossLevel = lvl % 8 === 0;
              const name = LevelLoader.getLevelName(lvl);
              const biome = LevelLoader.getBiome(lvl);
              const biomeMeta = BIOMES_LIST.find(b => b.id === biome) || BIOMES_LIST[1];

              return (
                <button
                  key={lvl}
                  className="tactical-level-card"
                  disabled={!isUnlocked}
                  onClick={() => onSelectLevel(lvl)}
                  style={{
                    ...styles.levelCard,
                    backgroundColor: isCompleted
                      ? 'rgba(22, 101, 52, 0.35)'
                      : isBossLevel && isUnlocked
                        ? 'rgba(127, 29, 29, 0.35)'
                        : isUnlocked
                          ? 'rgba(15, 23, 42, 0.85)'
                          : 'rgba(15, 23, 42, 0.35)',
                    border: isCompleted
                      ? '1px solid rgba(74, 222, 128, 0.55)'
                      : isBossLevel && isUnlocked
                        ? '1px solid rgba(248, 113, 113, 0.65)'
                        : isUnlocked
                          ? `1px solid ${biomeMeta.color}55`
                          : '1px solid rgba(148, 163, 184, 0.12)',
                    color: isUnlocked ? '#f8fafc' : '#475569',
                    cursor: isUnlocked ? 'pointer' : 'not-allowed',
                    opacity: isUnlocked ? 1 : 0.5
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '15px',
                      fontWeight: 900,
                      fontFamily: '"Chakra Petch", sans-serif',
                      color: isCompleted ? '#4ade80' : isBossLevel ? '#f87171' : isUnlocked ? '#fbbf24' : '#64748b'
                    }}>
                      M-{lvl < 10 ? `0${lvl}` : lvl}
                    </span>
                    <span style={{ fontSize: '11px', letterSpacing: '1px' }}>
                      {isUnlocked ? (
                        stars > 0 ? (
                          <span style={{ color: '#fbbf24' }}>
                            {'★'.repeat(stars)}
                            <span style={{ color: '#475569' }}>{'★'.repeat(3 - stars)}</span>
                          </span>
                        ) : (
                          isBossLevel ? '👑' : biomeMeta.icon
                        )
                      ) : '🔒'}
                    </span>
                  </div>

                  <div style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    marginTop: '6px',
                    color: isUnlocked ? '#e2e8f0' : '#64748b',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    width: '100%',
                    textAlign: 'left'
                  }}>
                    {name}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '8px', gap: '4px' }}>
                    <div style={{
                      fontSize: '9px',
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: '4px',
                      backgroundColor: isUnlocked ? biomeMeta.accent : 'rgba(255,255,255,0.03)',
                      color: isUnlocked ? biomeMeta.color : '#475569'
                    }}>
                      {biomeMeta.label.split(' ')[0].toUpperCase()}
                    </div>
                    {(() => {
                      const milestone = LevelLoader.getMilestoneUnlockInfo(lvl);
                      if (milestone) {
                        return (
                          <span style={{
                            fontSize: '8.5px',
                            fontWeight: 900,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(56, 189, 248, 0.22)',
                            color: '#7dd3fc',
                            border: '1px solid rgba(56, 189, 248, 0.5)'
                          }}>
                            {milestone.icon} NUEVO
                          </span>
                        );
                      }
                      if (isBossLevel) {
                        return (
                          <span style={{
                            fontSize: '8.5px',
                            fontWeight: 900,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(239, 68, 68, 0.25)',
                            color: '#fca5a5',
                            border: '1px solid rgba(248, 113, 113, 0.45)'
                          }}>
                            👑 JEFE
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

interface HUDProps {
  score: number;
  lives: number;
  enemiesLeft: number;
  mission: number;
  missionName?: string;
  biome?: string;
  activePowerup?: string | null;
  bossInfo?: { name: string; hp: number; maxHp: number; enraged: boolean } | null;
  mineUnlocked?: boolean;
  mineReady?: boolean;
  mineCooldownProgress?: number;
  bazookaUnlocked?: boolean;
  bazookaReady?: boolean;
  bazookaCooldownProgress?: number;
  empUnlocked?: boolean;
  empReady?: boolean;
  empCooldownProgress?: number;
  combo?: number;
  isMuted?: boolean;
  isMusicMuted?: boolean;
  aiDifficulty?: string;
  cameraMode?: 'overview' | 'follow';
  zoomLevel?: number;
  touchControlsEnabled?: boolean;
  isDying?: boolean;
  stealthStatus?: 'STEALTH' | 'SPOTTED' | 'COMBAT' | null;
  isNightMode?: boolean;
  onMenu: () => void;
  onToggleMute: () => void;
  onToggleMusic: () => void;
  onPause: () => void;
  onToggleCamera: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleTouchControls: () => void;
  onToggleNightMode?: () => void;
  onMine: () => void;
  onBazooka: () => void;
  onEmp: () => void;
}

const HUD: React.FC<HUDProps> = ({
  score,
  lives,
  enemiesLeft,
  mission,
  missionName,
  biome = 'workshop',
  activePowerup = null,
  bossInfo = null,
  mineUnlocked = true,
  mineReady = true,
  mineCooldownProgress = 1.0,
  bazookaUnlocked = true,
  bazookaReady = true,
  bazookaCooldownProgress = 1.0,
  empUnlocked = false,
  empReady = true,
  empCooldownProgress = 1.0,
  combo = 0,
  isMuted = false,
  isMusicMuted = false,
  aiDifficulty = 'normal',
  cameraMode = 'overview',
  touchControlsEnabled = true,
  isDying = false,
  stealthStatus = null,
  isNightMode = false,
  onMenu,
  onToggleMute,
  onToggleMusic,
  onPause,
  onToggleCamera,
  onZoomIn,
  onZoomOut,
  onToggleTouchControls,
  onToggleNightMode,
  onMine,
  onBazooka,
  onEmp
}) => {
  const hearts = Array.from({ length: 4 }, (_, i) => {
    if (i === 3 && lives < 4) return null;
    const active = i < lives;
    return (
      <span
        key={i}
        style={{
          fontSize: '18px',
          margin: '0 2px',
          opacity: active ? 1 : 0.2,
          filter: active ? 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.8))' : 'none',
          transition: 'all 0.2s ease'
        }}
      >
        ❤️
      </span>
    );
  });

  const biomeMeta = BIOMES_LIST.find(b => b.id === biome) || BIOMES_LIST[1];
  const diffMeta = AI_DIFFICULTIES_LIST.find(d => d.id === aiDifficulty) || AI_DIFFICULTIES_LIST[1];

  return (
    <div style={{
      ...styles.hudContainer,
      padding: touchControlsEnabled ? '8px 10px' : '14px 18px',
      opacity: isDying ? 0 : 1,
      transition: 'opacity 0.45s ease-out'
    }}>
      {touchControlsEnabled ? (
        /* --- CLEAN MOBILE TOP BAR (Single Non-Overlapping Row + Optional Boss/Stealth Sub-Banner) --- */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '100%', zIndex: 3 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '6px',
            width: '100%',
            flexWrap: 'nowrap'
          }}>
            {/* Left: Menu Button + Armor Hearts */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={onPause}
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.94)',
                  border: '1.5px solid rgba(251, 191, 36, 0.65)',
                  borderRadius: '10px',
                  padding: '6px 10px',
                  color: '#fbbf24',
                  fontSize: '11.5px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.35)'
                }}
              >
                <span>☰</span>
              </button>

              <div style={{
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                borderRadius: '10px',
                padding: '4px 8px',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}>
                {Array.from({ length: 4 }, (_, i) => {
                  if (i === 3 && lives < 4) return null;
                  const active = i < lives;
                  return (
                    <span
                      key={i}
                      style={{
                        fontSize: '13.5px',
                        margin: '0 1px',
                        opacity: active ? 1 : 0.2,
                        filter: active ? 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.8))' : 'none'
                      }}
                    >
                      ❤️
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Center: Compact Mission Pill (Flex-shrinking, never overlaps!) */}
            <div style={{
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              borderRadius: '10px',
              padding: '4px 10px',
              minWidth: 0,
              flex: '0 1 auto',
              textAlign: 'center',
              pointerEvents: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
              <div style={{
                fontSize: '11px',
                fontWeight: 900,
                color: '#f8fafc',
                fontFamily: '"Chakra Petch", sans-serif',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                <span style={{ color: '#fbbf24' }}>M#{mission}</span>
                {missionName ? ` • ${missionName.toUpperCase()}` : ''}
              </div>
            </div>

            {/* Right: Hostiles Left + Score */}
            <div style={{
              backgroundColor: 'rgba(15, 23, 42, 0.92)',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              borderRadius: '10px',
              padding: '5px 9px',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              flexShrink: 0,
              pointerEvents: 'none',
              fontVariantNumeric: 'tabular-nums',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
              <span style={{ fontSize: '12px', fontWeight: 900, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '3px' }}>
                🎯 {enemiesLeft}
              </span>
              <span style={{ color: '#475569', fontSize: '10px' }}>|</span>
              <span style={{ fontSize: '11px', fontWeight: 900, color: '#f8fafc' }}>
                {score} <span style={{ fontSize: '9px', color: '#94a3b8' }}>PTS</span>
              </span>
            </div>
          </div>

          {/* Second Sub-Row (Only visible when Boss, Stealth Alert, Combo, or Active Power-up is active) */}
          {(bossInfo || stealthStatus || combo >= 2 || activePowerup) && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', pointerEvents: 'none' }}>
              {bossInfo && bossInfo.hp > 0 && (
                <div style={{
                  ...styles.hudPanel,
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  width: 'min(92vw, 290px)',
                  padding: '5px 12px',
                  borderColor: bossInfo.enraged ? '#ef4444' : '#f59e0b',
                  backgroundColor: 'rgba(15, 23, 42, 0.94)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 900, color: bossInfo.enraged ? '#fca5a5' : '#fde047' }}>
                      {bossInfo.name} {bossInfo.enraged ? '🔥' : ''}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 900, color: '#f8fafc' }}>
                      {bossInfo.hp}/{bossInfo.maxHp} HP
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.max(0, Math.min(100, (bossInfo.hp / bossInfo.maxHp) * 100))}%`,
                      height: '100%',
                      background: bossInfo.enraged ? '#ef4444' : '#fbbf24'
                    }} />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {combo >= 2 && (
                  <div style={{
                    ...styles.hudPanel,
                    padding: '3px 10px',
                    backgroundColor: 'rgba(234, 88, 12, 0.3)',
                    borderColor: '#fb923c',
                    color: '#fdba74',
                    fontWeight: 900,
                    fontSize: '11px'
                  }}>
                    🔥 RACHA x{combo}
                  </div>
                )}

                {activePowerup && (
                  <div style={{
                    ...styles.hudPanel,
                    padding: '3px 10px',
                    backgroundColor: 'rgba(15, 23, 42, 0.92)',
                    borderColor: '#fbbf24',
                    color: '#fde047',
                    fontSize: '10.5px',
                    fontWeight: 900
                  }}>
                    {activePowerup}
                  </div>
                )}

                {stealthStatus && (
                  <div style={{
                    ...styles.hudPanel,
                    padding: '3px 10px',
                    fontSize: '10px',
                    fontWeight: 900,
                    backgroundColor: stealthStatus === 'SPOTTED' ? 'rgba(127, 29, 29, 0.94)' : 'rgba(12, 74, 110, 0.92)',
                    borderColor: stealthStatus === 'SPOTTED' ? '#ff1744' : '#38bdf8',
                    color: stealthStatus === 'SPOTTED' ? '#fecdd3' : '#7dd3fc'
                  }}>
                    {stealthStatus === 'SPOTTED' ? '🚨 ¡ILUMINADO POR FARO!' : stealthStatus === 'STEALTH' ? '🥷 SIGILO (+150 PTS)' : '💥 DETECTADO'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* --- DESKTOP TOP BAR --- */
        <div style={{ ...styles.hudTop, position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start', zIndex: 3 }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{
                ...styles.hudPanel,
                borderColor: 'rgba(251, 191, 36, 0.55)',
                backgroundColor: 'rgba(15, 23, 42, 0.94)'
              }}>
                <button
                  onClick={onPause}
                  style={{
                    ...styles.hudButton,
                    color: '#fbbf24',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                  title="Abrir menú de pausa o volver al Menú Principal [Esc / P]"
                >
                  <span>☰ MENÚ</span>
                </button>
              </div>
              <div style={styles.hudPanel}>
                <button data-audio-toggle="true" onClick={onToggleMute} style={styles.hudButton} title="Silenciar / Activar efectos de sonido [M]">
                  {isMuted ? '🔇' : '🔊'}
                </button>
              </div>
              <div style={{
                ...styles.hudPanel,
                borderColor: !isMusicMuted ? 'rgba(74, 222, 128, 0.45)' : 'rgba(148, 163, 184, 0.25)'
              }}>
                <button
                  data-audio-toggle="true"
                  onClick={onToggleMusic}
                  style={{
                    ...styles.hudButton,
                    color: !isMusicMuted ? '#4ade80' : '#94a3b8',
                    fontSize: '11px'
                  }}
                  title="Activar / Desactivar banda sonora de fondo"
                >
                  🎵 {!isMusicMuted ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{
                ...styles.hudPanel,
                borderColor: cameraMode === 'follow' ? 'rgba(56, 189, 248, 0.65)' : 'rgba(148, 163, 184, 0.3)'
              }}>
                <button
                  onClick={onToggleCamera}
                  style={{
                    ...styles.hudButton,
                    color: cameraMode === 'overview' ? '#fbbf24' : '#38bdf8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Alternar entre ver todo el mapa o seguir al tanque [C]"
                >
                  {cameraMode === 'overview' ? '🗺️ MAPA' : '🎯 TANQUE'}
                </button>
                <div style={{ display: 'inline-flex', gap: '4px', marginLeft: '6px' }}>
                  <button onClick={onZoomIn} style={styles.miniBtn} title="Acercar cámara [Z / +]">🔍+</button>
                  <button onClick={onZoomOut} style={styles.miniBtn} title="Alejar cámara [X / -]">🔍-</button>
                </div>
              </div>

              <div style={styles.hudPanel}>
                <button
                  onClick={onToggleTouchControls}
                  style={{
                    ...styles.hudButton,
                    color: touchControlsEnabled ? '#4ade80' : '#94a3b8',
                    fontSize: '11px'
                  }}
                  title="Mostrar u ocultar joystick táctil"
                >
                  📱 {touchControlsEnabled ? 'TÁCTIL: ON' : 'TÁCTIL: OFF'}
                </button>
              </div>

              {onToggleNightMode && (
                <div style={{
                  ...styles.hudPanel,
                  borderColor: isNightMode ? 'rgba(129, 140, 248, 0.7)' : 'rgba(148, 163, 184, 0.25)',
                  backgroundColor: isNightMode ? 'rgba(30, 27, 75, 0.92)' : 'rgba(15, 23, 42, 0.92)'
                }}>
                  <button
                    onClick={onToggleNightMode}
                    style={{
                      ...styles.hudButton,
                      color: isNightMode ? '#a5b4fc' : '#94a3b8',
                      fontSize: '11px'
                    }}
                    title="Activar / Desactivar Modo Sigilo Nocturno [Tecla N]"
                  >
                    🌙 {isNightMode ? 'NOCHE: ON' : 'NOCHE: OFF'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            zIndex: 2,
            pointerEvents: 'none'
          }}>
            <div style={{ ...styles.hudPanel, flexDirection: 'column', alignItems: 'center', padding: '5px 18px', pointerEvents: 'auto' }}>
              <div style={{
                fontSize: '9.5px',
                color: biomeMeta?.color || '#fbbf24',
                letterSpacing: '1.2px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span>{biomeMeta?.icon} {biomeMeta?.label.split(' ')[0].toUpperCase()}</span>
                <span style={{ color: '#475569' }}>•</span>
                <span style={{ color: diffMeta.color }}>IA: {diffMeta.label}</span>
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#f8fafc', fontFamily: '"Chakra Petch", sans-serif', whiteSpace: 'nowrap' }}>
                MISIÓN <span style={styles.highlight}>#{mission}</span>
                {missionName ? ` • ${missionName.toUpperCase()}` : ''}
              </div>
            </div>

            {stealthStatus && (
              <div style={{
                ...styles.hudPanel,
                padding: '4px 14px',
                fontSize: '10.5px',
                fontWeight: 900,
                letterSpacing: '0.6px',
                backgroundColor: stealthStatus === 'SPOTTED'
                  ? 'rgba(127, 29, 29, 0.94)'
                  : stealthStatus === 'STEALTH'
                  ? 'rgba(12, 74, 110, 0.92)'
                  : 'rgba(30, 41, 59, 0.92)',
                borderColor: stealthStatus === 'SPOTTED'
                  ? '#ff1744'
                  : stealthStatus === 'STEALTH'
                  ? '#38bdf8'
                  : '#fbbf24',
                color: stealthStatus === 'SPOTTED'
                  ? '#fecdd3'
                  : stealthStatus === 'STEALTH'
                  ? '#7dd3fc'
                  : '#fde047'
              }}>
                {stealthStatus === 'SPOTTED'
                  ? '🚨 ¡ILUMINADO POR EL FARO! POSICIÓN REVELADA'
                  : stealthStatus === 'STEALTH'
                  ? '🥷 OCULTO EN SIGILO NOCTURNO (+150 PTS BONUS)'
                  : '💥 DISPARO DETECTADO • REUBÍCATE EN LA SOMBRA'}
              </div>
            )}

            {bossInfo && bossInfo.hp > 0 && (
              <div style={{
                ...styles.hudPanel,
                flexDirection: 'column',
                alignItems: 'stretch',
                minWidth: '280px',
                padding: '7px 14px',
                borderColor: bossInfo.enraged ? '#ef4444' : '#f59e0b',
                backgroundColor: 'rgba(15, 23, 42, 0.94)',
                pointerEvents: 'auto'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 900, color: bossInfo.enraged ? '#fca5a5' : '#fde047', letterSpacing: '0.6px' }}>
                    {bossInfo.name} {bossInfo.enraged ? '🔥 ENFURECIDO' : ''}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 900, color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>
                    {bossInfo.hp} / {bossInfo.maxHp} HP
                  </span>
                </div>
                <div style={{ width: '100%', height: '7px', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.max(0, Math.min(100, (bossInfo.hp / bossInfo.maxHp) * 100))}%`,
                    height: '100%',
                    background: bossInfo.enraged
                      ? 'linear-gradient(90deg, #dc2626 0%, #f87171 100%)'
                      : 'linear-gradient(90deg, #d97706 0%, #fbbf24 100%)',
                    transition: 'width 0.18s ease-out'
                  }} />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', zIndex: 3, pointerEvents: 'none' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {combo >= 2 && (
                <div style={{
                  ...styles.hudPanel,
                  backgroundColor: 'rgba(234, 88, 12, 0.25)',
                  borderColor: '#fb923c',
                  color: '#fdba74',
                  fontWeight: 900,
                  fontSize: '13px',
                  pointerEvents: 'none'
                }}>
                  🔥 RACHA x{combo}
                </div>
              )}
              <div style={{ ...styles.hudPanel, pointerEvents: 'none' }}>
                <span style={{ marginRight: '6px', fontSize: '11px', color: '#94a3b8', fontWeight: 800 }}>HOSTILES:</span>
                <span style={{ ...styles.highlight, fontSize: '18px', fontVariantNumeric: 'tabular-nums' }}>{enemiesLeft}</span>
                <span style={{ marginLeft: '5px', fontSize: '16px' }}>🎯</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ ...styles.hudBottom, position: 'relative' }}>
        {/* Left: Armor Hearts (Shown at bottom only when Touch Joysticks are OFF) */}
        {!touchControlsEnabled ? (
          <div style={{ ...styles.hudPanel, zIndex: 3, pointerEvents: 'none' }}>
            <span style={{ marginRight: '8px', fontSize: '11px', color: '#94a3b8', fontWeight: 800 }}>BLINDAJE:</span>
            {hearts}
          </div>
        ) : <div />}

        {/* Truly Centered Bottom Action Cluster: Active Power-Up Pill + Mine & Bazooka Buttons (Desktop only) */}
        <div style={{
          position: 'absolute',
          left: '50%',
          bottom: 0,
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          zIndex: 2,
          pointerEvents: 'none'
        }}>
          {/* Active Power-up Status Pill on Desktop */}
          {!touchControlsEnabled && activePowerup && (
            <div style={{
              ...styles.hudPanel,
              backgroundColor: 'rgba(15, 23, 42, 0.92)',
              borderColor: '#fbbf24',
              color: '#fde047',
              fontSize: '11.5px',
              fontWeight: 900,
              padding: '5px 14px',
              pointerEvents: 'none'
            }}>
              {activePowerup}
            </div>
          )}

          {/* Clickable PC Mine + Bazooka + EMP Buttons — Perfectly Centered with Progressive Level Unlocks */}
          {!touchControlsEnabled && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', pointerEvents: 'auto' }}>
              <button
                type="button"
                data-ui-element="true"
                onClick={(e) => {
                  e.stopPropagation();
                  onMine();
                  e.currentTarget.blur();
                }}
                title={mineUnlocked ? 'Desplegar Mina Terrestre [Espacio / Tecla E / Clic Derecho]' : 'Mina Terrestre: Se desbloquea en la Misión 3'}
                style={{
                  ...styles.hudPanel,
                  borderColor: !mineUnlocked
                    ? 'rgba(148, 163, 184, 0.25)'
                    : mineReady
                    ? 'rgba(74, 222, 128, 0.65)'
                    : 'rgba(248, 113, 113, 0.45)',
                  backgroundColor: !mineUnlocked
                    ? 'rgba(15, 23, 42, 0.78)'
                    : mineReady
                    ? 'rgba(20, 83, 45, 0.85)'
                    : 'rgba(15, 23, 42, 0.92)',
                  flexDirection: 'column',
                  gap: '4px',
                  minWidth: '165px',
                  cursor: 'pointer',
                  outline: 'none',
                  opacity: mineUnlocked ? 1 : 0.7
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', marginRight: '6px' }}>{mineUnlocked ? '💣' : '🔒'}</span>
                    <span style={{ fontSize: '11px', fontWeight: 900, color: !mineUnlocked ? '#94a3b8' : mineReady ? '#4ade80' : '#f87171' }}>
                      {!mineUnlocked ? 'MINA (NV.3)' : mineReady ? 'PONER MINA' : 'RECARGANDO'}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 800,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    color: '#cbd5e1',
                    border: '1px solid rgba(148, 163, 184, 0.3)'
                  }}>
                    ESPACIO / E
                  </span>
                </div>
                <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${!mineUnlocked ? 0 : Math.round((mineReady ? 1 : mineCooldownProgress) * 100)}%`,
                    height: '100%',
                    backgroundColor: mineReady ? '#4ade80' : '#f87171',
                    transition: 'width 0.1s linear'
                  }} />
                </div>
              </button>

              <button
                type="button"
                data-ui-element="true"
                onClick={(e) => {
                  e.stopPropagation();
                  onBazooka();
                  e.currentTarget.blur();
                }}
                title={bazookaUnlocked ? 'Disparar Cohete Bazoca Demoledor de Muros [Tecla Q / F / Shift]' : 'Cohete Bazoca: Se desbloquea en la Misión 6'}
                style={{
                  ...styles.hudPanel,
                  borderColor: !bazookaUnlocked
                    ? 'rgba(148, 163, 184, 0.25)'
                    : bazookaReady
                    ? 'rgba(251, 146, 60, 0.75)'
                    : 'rgba(148, 163, 184, 0.35)',
                  backgroundColor: !bazookaUnlocked
                    ? 'rgba(15, 23, 42, 0.78)'
                    : bazookaReady
                    ? 'rgba(154, 52, 18, 0.88)'
                    : 'rgba(15, 23, 42, 0.92)',
                  flexDirection: 'column',
                  gap: '4px',
                  minWidth: '170px',
                  cursor: 'pointer',
                  outline: 'none',
                  opacity: bazookaUnlocked ? 1 : 0.7
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', marginRight: '6px' }}>{bazookaUnlocked ? '🚀' : '🔒'}</span>
                    <span style={{ fontSize: '11px', fontWeight: 900, color: !bazookaUnlocked ? '#94a3b8' : bazookaReady ? '#fdba74' : '#94a3b8' }}>
                      {!bazookaUnlocked ? 'BAZOCA (NV.6)' : bazookaReady ? 'COHETE BAZOCA' : 'RECARGANDO'}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 800,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    color: '#fed7aa',
                    border: '1px solid rgba(251, 146, 60, 0.35)'
                  }}>
                    Q / F
                  </span>
                </div>
                <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${!bazookaUnlocked ? 0 : Math.round((bazookaReady ? 1 : bazookaCooldownProgress) * 100)}%`,
                    height: '100%',
                    backgroundColor: bazookaReady ? '#fb923c' : '#f87171',
                    transition: 'width 0.1s linear'
                  }} />
                </div>
              </button>

              <button
                type="button"
                data-ui-element="true"
                onClick={(e) => {
                  e.stopPropagation();
                  onEmp();
                  e.currentTarget.blur();
                }}
                title={empUnlocked ? 'Activar Pulso EMP Orbital: Destruye balas y congela tanques [Tecla R]' : 'Pulso EMP Orbital: Se desbloquea en la Misión 18'}
                style={{
                  ...styles.hudPanel,
                  borderColor: !empUnlocked
                    ? 'rgba(148, 163, 184, 0.25)'
                    : empReady
                    ? 'rgba(56, 189, 248, 0.78)'
                    : 'rgba(148, 163, 184, 0.35)',
                  backgroundColor: !empUnlocked
                    ? 'rgba(15, 23, 42, 0.78)'
                    : empReady
                    ? 'rgba(12, 74, 110, 0.9)'
                    : 'rgba(15, 23, 42, 0.92)',
                  flexDirection: 'column',
                  gap: '4px',
                  minWidth: '165px',
                  cursor: 'pointer',
                  outline: 'none',
                  opacity: empUnlocked ? 1 : 0.7
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', marginRight: '6px' }}>{empUnlocked ? '⚡' : '🔒'}</span>
                    <span style={{ fontSize: '11px', fontWeight: 900, color: !empUnlocked ? '#94a3b8' : empReady ? '#38bdf8' : '#94a3b8' }}>
                      {!empUnlocked ? 'EMP (NV.18)' : empReady ? 'PULSO EMP' : 'RECARGANDO'}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 800,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    color: '#bae6fd',
                    border: '1px solid rgba(56, 189, 248, 0.35)'
                  }}>
                    TECLA R
                  </span>
                </div>
                <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${!empUnlocked ? 0 : Math.round((empReady ? 1 : empCooldownProgress) * 100)}%`,
                    height: '100%',
                    backgroundColor: empReady ? '#38bdf8' : '#f87171',
                    transition: 'width 0.1s linear'
                  }} />
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Right: Tactical Score (Shown at bottom only when Touch Joysticks are OFF) */}
        {!touchControlsEnabled ? (
          <div style={{ ...styles.hudPanel, fontVariantNumeric: 'tabular-nums', zIndex: 3, pointerEvents: 'none' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 800 }}>PUNTOS</span>
            <span style={styles.highlight}>{score}</span>
          </div>
        ) : <div />}
      </div>
    </div>
  );
};

interface PauseMenuProps {
  onResume: () => void;
  onRestart: () => void;
  onSelectLevel: () => void;
  onMenu: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isMusicMuted: boolean;
  onToggleMusic: () => void;
  sfxVolume: number;
  onChangeSfxVolume: (pct: number) => void;
  musicVolume: number;
  onChangeMusicVolume: (pct: number) => void;
  aiDifficulty: string;
  onSelectDifficulty: (diffId: string) => void;
  onToggleCamera: () => void;
  cameraMode?: 'overview' | 'follow';
  touchControlsEnabled: boolean;
  onToggleTouchControls: () => void;
  mission: number;
  missionName?: string;
}

const PauseMenu: React.FC<PauseMenuProps> = ({
  onResume,
  onRestart,
  onSelectLevel,
  onMenu,
  isMuted,
  onToggleMute,
  isMusicMuted,
  onToggleMusic,
  sfxVolume,
  onChangeSfxVolume,
  musicVolume,
  onChangeMusicVolume,
  aiDifficulty,
  onSelectDifficulty,
  onToggleCamera,
  cameraMode,
  touchControlsEnabled,
  onToggleTouchControls,
  mission,
  missionName
}) => (
  <div
    style={styles.overlay}
    onClick={(e) => {
      if (e.target === e.currentTarget) onResume();
    }}
  >
    <div style={{ ...styles.menuBox, maxWidth: '460px', padding: '20px 24px', textAlign: 'left' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(148, 163, 184, 0.2)', paddingBottom: '10px', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 900, color: '#fbbf24', letterSpacing: '1.2px' }}>
            MISIÓN #{mission} • {missionName || 'EN CURSO'}
          </div>
          <h2 style={{ ...styles.title, fontSize: '22px', margin: 0 }}>⏸️ PAUSA Y AJUSTES</h2>
        </div>
        <ModalCloseButton onClick={onResume} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
        <button className="tactical-btn-primary" style={styles.primaryButton} onClick={onResume}>
          ▶ CONTINUAR MISIÓN
        </button>

        {/* Prominent Return to Professional Main Menu Button */}
        <button
          className="tactical-btn-secondary"
          onClick={onMenu}
          style={{
            ...styles.secondaryButton,
            backgroundColor: 'rgba(56, 189, 248, 0.16)',
            borderColor: 'rgba(56, 189, 248, 0.55)',
            color: '#bae6fd',
            fontWeight: 900
          }}
        >
          🏠 SALIR AL MENÚ PRINCIPAL
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button className="tactical-btn-secondary" style={styles.secondaryButton} onClick={onRestart}>
            🔄 REINICIAR
          </button>
          <button className="tactical-btn-secondary" style={styles.secondaryButton} onClick={onSelectLevel}>
            🗺️ MISIONES
          </button>
        </div>

        {/* Live Audio Mixer Sliders (SFX & Music) inside Pause Menu */}
        <div style={{
          backgroundColor: 'rgba(15, 23, 42, 0.88)',
          border: '1px solid rgba(148, 163, 184, 0.24)',
          borderRadius: '10px',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '9px'
        }}>
          <div style={{ fontSize: '9.5px', fontWeight: 800, color: '#fbbf24', letterSpacing: '1px' }}>
            🔊 VOLUMEN DE AUDIO
          </div>

          {/* SFX Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: isMuted ? '#94a3b8' : '#38bdf8' }}>
                💥 Efectos (Disparos)
              </span>
              <span style={{ fontSize: '11px', fontWeight: 900, color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>
                {isMuted ? '0%' : `${sfxVolume}%`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={isMuted ? 0 : sfxVolume}
              onChange={(e) => onChangeSfxVolume(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer', height: '5px' }}
            />
          </div>

          {/* Music Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: isMusicMuted ? '#94a3b8' : '#4ade80' }}>
                🎵 Música de Fondo
              </span>
              <span style={{ fontSize: '11px', fontWeight: 900, color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>
                {isMusicMuted ? '0%' : `${musicVolume}%`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={isMusicMuted ? 0 : musicVolume}
              onChange={(e) => onChangeMusicVolume(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#4ade80', cursor: 'pointer', height: '5px' }}
            />
          </div>
        </div>

        {/* Compact AI Difficulty */}
        <div style={{
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(148, 163, 184, 0.22)',
          borderRadius: '10px',
          padding: '8px 10px'
        }}>
          <div style={{ fontSize: '9.5px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px', marginBottom: '5px' }}>
            🤖 DIFICULTAD IA
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px' }}>
            {AI_DIFFICULTIES_LIST.map(d => {
              const active = aiDifficulty === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onSelectDifficulty(d.id)}
                  style={{
                    backgroundColor: active ? `${d.color}22` : 'rgba(30, 41, 59, 0.7)',
                    border: active ? `1.5px solid ${d.color}` : '1px solid rgba(148, 163, 184, 0.2)',
                    color: active ? d.color : '#94a3b8',
                    borderRadius: '7px',
                    padding: '6px 4px',
                    fontSize: '10px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {d.icon} {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Toggles Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          <button className="tactical-btn-secondary" style={{ ...styles.secondaryButton, padding: '8px 4px', fontSize: '10px' }} onClick={onToggleCamera}>
            🔍 {cameraMode === 'overview' ? 'MAPA' : 'TANQUE'}
          </button>
          <button className="tactical-btn-secondary" style={{ ...styles.secondaryButton, padding: '8px 4px', fontSize: '10px' }} onClick={onToggleTouchControls}>
            📱 {touchControlsEnabled ? 'ON' : 'OFF'}
          </button>
          <button data-audio-toggle="true" className="tactical-btn-secondary" style={{ ...styles.secondaryButton, padding: '8px 4px', fontSize: '10px' }} onClick={onToggleMute}>
            {isMuted ? '🔇 SFX' : '🔊 SFX'}
          </button>
          <button data-audio-toggle="true" className="tactical-btn-secondary" style={{ ...styles.secondaryButton, padding: '8px 4px', fontSize: '10px' }} onClick={onToggleMusic}>
            {isMusicMuted ? '🔇 BGM' : '🎵 BGM'}
          </button>
        </div>
      </div>
    </div>
  </div>
);

interface GameOverScreenProps {
  won: boolean;
  isCampaignComplete?: boolean;
  score: number;
  mission: number;
  missionName?: string;
  biome?: string;
  starsEarned?: number;
  elapsedSec?: number;
  damageTaken?: number;
  coinsEarned?: number;
  xpEarned?: number;
  gems: number;
  freeReviveAvailable: boolean;
  onRevive: () => void;
  onOpenStoreGems: () => void;
  onNext: () => void;
  onRestart: () => void;
  onLevelSelect: () => void;
  onMenu: () => void;
}

const GameOverScreen: React.FC<GameOverScreenProps> = ({
  won,
  isCampaignComplete,
  score,
  mission,
  missionName,
  biome = 'workshop',
  starsEarned = 0,
  elapsedSec = 0,
  damageTaken = 0,
  coinsEarned = 0,
  xpEarned = 0,
  gems,
  freeReviveAvailable,
  onRevive,
  onOpenStoreGems,
  onNext,
  onRestart,
  onLevelSelect,
  onMenu
}) => {
  const biomeMeta = BIOMES_LIST.find(b => b.id === biome) || BIOMES_LIST[1];

  return (
    <div style={{
      ...styles.overlay,
      background: won
        ? 'radial-gradient(circle at center, rgba(16, 185, 129, 0.18) 0%, rgba(10, 15, 28, 0.88) 70%)'
        : 'radial-gradient(circle at center, rgba(220, 38, 38, 0.24) 0%, rgba(10, 12, 22, 0.92) 72%)',
      animation: 'overlayFadeIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards'
    }}>
      <div style={{
        ...styles.menuBox,
        maxWidth: '510px',
        borderColor: won ? 'rgba(74, 222, 128, 0.45)' : 'rgba(248, 113, 113, 0.45)',
        boxShadow: won
          ? '0 24px 60px rgba(0, 0, 0, 0.75), 0 0 40px rgba(34, 197, 94, 0.2)'
          : '0 24px 60px rgba(0, 0, 0, 0.85), 0 0 45px rgba(239, 68, 68, 0.25)',
        animation: 'defeatCardBlend 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards'
      }}>
        {/* Status Emblem */}
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          margin: '0 auto 10px auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
          backgroundColor: won ? 'rgba(34, 197, 94, 0.16)' : 'rgba(239, 68, 68, 0.18)',
          border: won ? '2px solid rgba(74, 222, 128, 0.55)' : '2px solid rgba(248, 113, 113, 0.55)',
          boxShadow: won ? '0 0 24px rgba(74, 222, 128, 0.35)' : '0 0 24px rgba(239, 68, 68, 0.4)'
        }}>
          {isCampaignComplete ? '🏆' : won ? '🎖️' : '💥'}
        </div>

        <div style={{
          ...styles.toyBadge,
          backgroundColor: won ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.22)',
          color: won ? '#4ade80' : '#f87171',
          border: won ? '1px solid rgba(74, 222, 128, 0.4)' : '1px solid rgba(248, 113, 113, 0.4)'
        }}>
          {isCampaignComplete ? 'CAMPAÑA COMPLETADA AL 100%' : won ? 'VICTORIA TÁCTICA CONFIRMADA' : 'BLINDAJE DESTRUIDO EN COMBATE'}
        </div>

        <h1 style={{
          ...styles.title,
          fontSize: '26px',
          color: won ? '#4ade80' : '#f87171',
          marginTop: '6px'
        }}>
          {isCampaignComplete ? '¡CAMPAÑA CONQUISTADA!' : won ? '¡MISIÓN CUMPLIDA!' : 'TANQUE DESTRUIDO'}
        </h1>

        <p style={{ ...styles.subtitle, marginBottom: '10px' }}>
          Misión #{mission} {missionName ? `• ${missionName}` : ''}
        </p>

        {/* Punto 5: 3-Star Rating Display on Victory */}
        {won && (
          <div style={{
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(251, 191, 36, 0.35)',
            borderRadius: '12px',
            padding: '10px 14px',
            marginBottom: '12px'
          }}>
            <div style={{ fontSize: '24px', letterSpacing: '6px', color: '#fbbf24', marginBottom: '4px' }}>
              {'★'.repeat(starsEarned)}
              <span style={{ color: '#334155' }}>{'★'.repeat(Math.max(0, 3 - starsEarned))}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', fontSize: '10.5px', color: '#cbd5e1', flexWrap: 'wrap' }}>
              <span style={{ color: '#4ade80' }}>✓ Misión Superada</span>
              <span style={{ color: (elapsedSec <= 55 || score >= 350) ? '#4ade80' : '#64748b' }}>
                {(elapsedSec <= 55 || score >= 350) ? '✓' : '○'} Tiempo ({elapsedSec}s) / Puntos
              </span>
              <span style={{ color: damageTaken === 0 ? '#4ade80' : '#64748b' }}>
                {damageTaken === 0 ? '✓' : '○'} Blindaje Intacto
              </span>
            </div>
          </div>
        )}

        {/* Battle Telemetry + Coins & Battle Pass XP Earned */}
        <div style={{
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '14px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          textAlign: 'center'
        }}>
          <div>
            <div style={{ fontSize: '9.5px', fontWeight: 800, color: '#64748b', letterSpacing: '0.8px' }}>PUNTUACIÓN</div>
            <div style={{ fontSize: '16px', fontWeight: 900, color: '#fbbf24', fontFamily: '"Chakra Petch", sans-serif', fontVariantNumeric: 'tabular-nums' }}>
              {score} PTS
            </div>
          </div>
          <div>
            <div style={{ fontSize: '9.5px', fontWeight: 800, color: '#64748b', letterSpacing: '0.8px' }}>RECOMPENSA ORO</div>
            <div style={{ fontSize: '16px', fontWeight: 900, color: '#fde047', fontFamily: '"Chakra Petch", sans-serif', fontVariantNumeric: 'tabular-nums' }}>
              +{coinsEarned} 🪙
            </div>
          </div>
          <div>
            <div style={{ fontSize: '9.5px', fontWeight: 800, color: '#64748b', letterSpacing: '0.8px' }}>PASE BATALLA</div>
            <div style={{ fontSize: '16px', fontWeight: 900, color: '#e879f9', fontFamily: '"Chakra Petch", sans-serif', fontVariantNumeric: 'tabular-nums' }}>
              +{xpEarned} XP
            </div>
          </div>
        </div>

        {/* High-Conversion Second Chance Live Revive Card on Defeat */}
        {!won && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.22) 0%, rgba(30, 41, 59, 0.95) 100%)',
            border: '2px solid #38bdf8',
            borderRadius: '14px',
            padding: '14px 16px',
            marginBottom: '14px',
            boxShadow: '0 0 28px rgba(56, 189, 248, 0.28)',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 900, color: '#38bdf8', letterSpacing: '1px' }}>
                ⚡ SEGUNDA OPORTUNIDAD • NO PIERDAS LA PARTIDA
              </span>
              <span style={{ fontSize: '11px', fontWeight: 900, color: '#cbd5e1', fontVariantNumeric: 'tabular-nums' }}>
                Tienes: {gems} 💎
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#e2e8f0', marginBottom: '10px', lineHeight: 1.4 }}>
              Reanima tu tanque <strong>en este mismo instante</strong> con <strong>100% de Blindaje + Escudo de Plasma 🛡️ + Onda Expansiva</strong> que barre proyectiles enemigos.
            </div>
            {freeReviveAvailable || gems >= 25 ? (
              <button
                onClick={onRevive}
                style={{
                  ...styles.primaryButton,
                  background: 'linear-gradient(135deg, #06b6d4 0%, #38bdf8 100%)',
                  color: '#0f172a',
                  padding: '12px 16px',
                  fontSize: '13.5px'
                }}
              >
                {freeReviveAvailable
                  ? '🛡️ REANIMAR TANQUE AHORA (¡1ª VEZ DEL DÍA GRATIS!)'
                  : '🛡️ REANIMAR TANQUE CON ESCUDO DE PLASMA (25 💎)'}
              </button>
            ) : (
              <button
                onClick={onOpenStoreGems}
                style={{
                  ...styles.primaryButton,
                  background: 'linear-gradient(135deg, #a855f7 0%, #38bdf8 100%)',
                  color: '#fff',
                  padding: '12px 16px',
                  fontSize: '13px'
                }}
              >
                💎 CONSEGUIR GEMAS PARA REANIMAR (NECESITAS 25 💎)
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
          {isCampaignComplete ? (
            <button className="tactical-btn-primary" style={styles.primaryButton} onClick={onLevelSelect}>
              🎯 SELECCIONAR CUALQUIER MISIÓN
            </button>
          ) : won ? (
            <button className="tactical-btn-primary" style={styles.primaryButton} onClick={onNext}>
              ▶ AVANZAR A LA SIGUIENTE MISIÓN (#{mission + 1})
            </button>
          ) : (
            <button className="tactical-btn-primary" style={styles.primaryButton} onClick={onRestart}>
              🔄 REINICIAR MISIÓN DESDE EL PRINCIPIO
            </button>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button className="tactical-btn-secondary" style={styles.secondaryButton} onClick={onLevelSelect}>
              🗺️ MISIONES
            </button>
            <button className="tactical-btn-secondary" style={styles.tertiaryButton} onClick={onMenu}>
              🏠 MENÚ PRINCIPAL
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface HangarModalProps {
  selectedSkin: string;
  selectedPerk: string;
  selectedHat: string;
  selectedTrail: string;
  ownedSkins: string[];
  ownedHats: string[];
  ownedTrails: string[];
  coins: number;
  gems: number;
  trialLoadout: { skin?: string; hat?: string; trail?: string } | null;
  onSelectSkin: (skinId: string) => void;
  onSelectPerk: (perkId: string) => void;
  onSelectHat: (hatId: string) => void;
  onSelectTrail: (trailId: string) => void;
  onUnlockCosmetic: (category: 'skin' | 'hat' | 'trail', id: string, coinCost: number, gemCost: number) => void;
  onTryCosmeticFree: (category: 'skin' | 'hat' | 'trail', id: string, name: string) => void;
  onOpenStore: () => void;
  onClose: () => void;
}

const HangarModal: React.FC<HangarModalProps> = ({
  selectedSkin,
  selectedPerk,
  selectedHat,
  selectedTrail,
  ownedSkins,
  ownedHats,
  ownedTrails,
  coins,
  gems,
  trialLoadout,
  onSelectSkin,
  onSelectPerk,
  onSelectHat,
  onSelectTrail,
  onUnlockCosmetic,
  onTryCosmeticFree,
  onOpenStore,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'skins' | 'hats' | 'trails' | 'perks'>('skins');

  return (
    <div
      style={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={{ ...styles.menuBox, maxWidth: '860px', maxHeight: '90vh', overflowY: 'auto', textAlign: 'left', padding: '20px 24px' }}>
        {/* Header + Currency Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
          paddingBottom: '12px',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 800, color: '#38bdf8', letterSpacing: '1.5px' }}>
              ARMERÍA Y PRUEBA GRATIS
            </div>
            <h2 style={{ ...styles.title, fontSize: '21px', margin: 0 }}>🔧 HANGAR 3D</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid rgba(251, 191, 36, 0.45)',
              borderRadius: '8px',
              padding: '5px 10px',
              fontSize: '12px',
              fontWeight: 900,
              color: '#fbbf24',
              fontVariantNumeric: 'tabular-nums'
            }}>
              🪙 {coins.toLocaleString()}
            </div>
            <div style={{
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid rgba(56, 189, 248, 0.45)',
              borderRadius: '8px',
              padding: '5px 10px',
              fontSize: '12px',
              fontWeight: 900,
              color: '#38bdf8',
              fontVariantNumeric: 'tabular-nums'
            }}>
              💎 {gems.toLocaleString()}
            </div>
            <button
              onClick={onOpenStore}
              style={{
                background: 'linear-gradient(135deg, #a855f7 0%, #38bdf8 100%)',
                border: 'none',
                borderRadius: '9px',
                padding: '7px 12px',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 900,
                cursor: 'pointer'
              }}
            >
              + TIENDA
            </button>
            <ModalCloseButton onClick={onClose} />
          </div>
        </div>

        {/* Free Trial Active Notice */}
        {(trialLoadout?.skin || trialLoadout?.hat || trialLoadout?.trail) && (
          <div style={{
            marginTop: '10px',
            backgroundColor: 'rgba(56, 189, 248, 0.16)',
            border: '1px solid rgba(56, 189, 248, 0.55)',
            borderRadius: '9px',
            padding: '7px 12px',
            fontSize: '11px',
            color: '#bae6fd',
            fontWeight: 700
          }}>
            🎮 <strong>PRUEBA ACTIVA:</strong> Cosmético equipado gratis para tu próxima misión.
          </div>
        )}

        {/* Category Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '7px', marginTop: '12px', marginBottom: '12px' }}>
          {[
            { id: 'skins', label: `🎨 CHASIS (${ownedSkins.length}/${TANK_SKINS_LIST.length})`, color: '#fbbf24' },
            { id: 'hats', label: `👑 CASCOS (${ownedHats.length}/${TANK_HATS_LIST.length})`, color: '#e879f9' },
            { id: 'trails', label: `⚡ LÁSER (${ownedTrails.length}/${BULLET_TRAILS_LIST.length})`, color: '#38bdf8' },
            { id: 'perks', label: '🛡️ MÓDULOS', color: '#4ade80' }
          ].map(t => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                style={{
                  backgroundColor: active ? 'rgba(30, 41, 59, 0.98)' : 'rgba(15, 23, 42, 0.7)',
                  border: active ? `2px solid ${t.color}` : '1px solid rgba(148, 163, 184, 0.22)',
                  color: active ? t.color : '#94a3b8',
                  borderRadius: '10px',
                  padding: '9px 8px',
                  fontSize: '11px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  fontFamily: '"Chakra Petch", sans-serif'
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* TAB 1: 3D Tank Chassis Skins */}
        {activeTab === 'skins' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            {TANK_SKINS_LIST.map(s => {
              const owned = ownedSkins.includes(s.id);
              const active = selectedSkin === s.id;
              const isTrial = trialLoadout?.skin === s.id;
              return (
                <div
                  key={s.id}
                  style={{
                    backgroundColor: active || isTrial ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.78)',
                    border: active ? `2px solid ${s.accent}` : isTrial ? '2px dashed #38bdf8' : '1px solid rgba(148, 163, 184, 0.22)',
                    borderRadius: '12px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          backgroundColor: s.color,
                          border: `2px solid ${s.accent}`,
                          display: 'inline-block'
                        }} />
                        <span style={{ fontSize: '13px', fontWeight: 900, color: '#f8fafc' }}>
                          {s.badge} {s.name}
                        </span>
                      </div>
                      <span style={{ fontSize: '9.5px', fontWeight: 900, color: s.accent }}>
                        {s.rarity}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.35 }}>{s.desc}</div>
                  </div>

                  {owned ? (
                    <button
                      onClick={() => onSelectSkin(s.id)}
                      style={{
                        backgroundColor: active ? 'rgba(74, 222, 128, 0.2)' : 'rgba(56, 189, 248, 0.18)',
                        border: active ? '1px solid #4ade80' : '1px solid #38bdf8',
                        color: active ? '#4ade80' : '#38bdf8',
                        borderRadius: '8px',
                        padding: '7px 10px',
                        fontSize: '11px',
                        fontWeight: 900,
                        cursor: 'pointer'
                      }}
                    >
                      {active ? '✓ EQUIPADO EN TU TANQUE' : 'EQUIPAR CHASIS'}
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: s.coinPrice > 0 ? '1fr 1fr' : '1fr', gap: '5px' }}>
                        {s.coinPrice > 0 && (
                          <button
                            onClick={() => onUnlockCosmetic('skin', s.id, s.coinPrice, 0)}
                            style={{
                              backgroundColor: 'rgba(251, 191, 36, 0.18)',
                              border: '1px solid rgba(251, 191, 36, 0.55)',
                              color: '#fbbf24',
                              borderRadius: '7px',
                              padding: '6px 8px',
                              fontSize: '10.5px',
                              fontWeight: 900,
                              cursor: 'pointer',
                              fontVariantNumeric: 'tabular-nums'
                            }}
                          >
                            🪙 {s.coinPrice}
                          </button>
                        )}
                        <button
                          onClick={() => onUnlockCosmetic('skin', s.id, 0, s.gemPrice)}
                          style={{
                            backgroundColor: 'rgba(56, 189, 248, 0.2)',
                            border: '1px solid rgba(56, 189, 248, 0.6)',
                            color: '#38bdf8',
                            borderRadius: '7px',
                            padding: '6px 8px',
                            fontSize: '10.5px',
                            fontWeight: 900,
                            cursor: 'pointer',
                            fontVariantNumeric: 'tabular-nums'
                          }}
                        >
                          💎 {s.gemPrice} DESBLOQUEAR
                        </button>
                      </div>
                      <button
                        onClick={() => onTryCosmeticFree('skin', s.id, s.name)}
                        style={{
                          backgroundColor: isTrial ? 'rgba(56, 189, 248, 0.25)' : 'rgba(30, 41, 59, 0.8)',
                          border: '1px dashed rgba(148, 163, 184, 0.4)',
                          color: isTrial ? '#38bdf8' : '#cbd5e1',
                          borderRadius: '7px',
                          padding: '5px 8px',
                          fontSize: '10px',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        {isTrial ? '🎮 EN PRUEBA PARA LA PRÓXIMA MISIÓN' : '🎮 PROBAR 1 MISIÓN GRATIS'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: 3D Turret Toppers / Hats */}
        {activeTab === 'hats' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            {TANK_HATS_LIST.map(h => {
              const owned = ownedHats.includes(h.id);
              const active = selectedHat === h.id;
              const isTrial = trialLoadout?.hat === h.id;
              return (
                <div
                  key={h.id}
                  style={{
                    backgroundColor: active || isTrial ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.78)',
                    border: active ? `2px solid ${h.color}` : isTrial ? '2px dashed #38bdf8' : '1px solid rgba(148, 163, 184, 0.22)',
                    borderRadius: '12px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 900, color: '#f8fafc' }}>
                        {h.icon} {h.name}
                      </span>
                      <span style={{ fontSize: '9.5px', fontWeight: 900, color: h.color }}>{h.rarity}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.35 }}>{h.desc}</div>
                  </div>

                  {owned ? (
                    <button
                      onClick={() => onSelectHat(h.id)}
                      style={{
                        backgroundColor: active ? 'rgba(74, 222, 128, 0.2)' : 'rgba(56, 189, 248, 0.18)',
                        border: active ? '1px solid #4ade80' : '1px solid #38bdf8',
                        color: active ? '#4ade80' : '#38bdf8',
                        borderRadius: '8px',
                        padding: '7px 10px',
                        fontSize: '11px',
                        fontWeight: 900,
                        cursor: 'pointer'
                      }}
                    >
                      {active ? '✓ MONTADO EN TORRETA 3D' : 'MONTAR EN TORRETA'}
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: h.coinPrice > 0 ? '1fr 1fr' : '1fr', gap: '5px' }}>
                        {h.coinPrice > 0 && (
                          <button
                            onClick={() => onUnlockCosmetic('hat', h.id, h.coinPrice, 0)}
                            style={{
                              backgroundColor: 'rgba(251, 191, 36, 0.18)',
                              border: '1px solid rgba(251, 191, 36, 0.55)',
                              color: '#fbbf24',
                              borderRadius: '7px',
                              padding: '6px 8px',
                              fontSize: '10.5px',
                              fontWeight: 900,
                              cursor: 'pointer'
                            }}
                          >
                            🪙 {h.coinPrice}
                          </button>
                        )}
                        <button
                          onClick={() => onUnlockCosmetic('hat', h.id, 0, h.gemPrice)}
                          style={{
                            backgroundColor: 'rgba(56, 189, 248, 0.2)',
                            border: '1px solid rgba(56, 189, 248, 0.6)',
                            color: '#38bdf8',
                            borderRadius: '7px',
                            padding: '6px 8px',
                            fontSize: '10.5px',
                            fontWeight: 900,
                            cursor: 'pointer'
                          }}
                        >
                          💎 {h.gemPrice} DESBLOQUEAR
                        </button>
                      </div>
                      <button
                        onClick={() => onTryCosmeticFree('hat', h.id, h.name)}
                        style={{
                          backgroundColor: isTrial ? 'rgba(56, 189, 248, 0.25)' : 'rgba(30, 41, 59, 0.8)',
                          border: '1px dashed rgba(148, 163, 184, 0.4)',
                          color: isTrial ? '#38bdf8' : '#cbd5e1',
                          borderRadius: '7px',
                          padding: '5px 8px',
                          fontSize: '10px',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        {isTrial ? '🎮 EN PRUEBA PARA LA PRÓXIMA MISIÓN' : '🎮 PROBAR 1 MISIÓN GRATIS'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: Bullet Tracer Trails */}
        {activeTab === 'trails' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            {BULLET_TRAILS_LIST.map(tr => {
              const owned = ownedTrails.includes(tr.id);
              const active = selectedTrail === tr.id;
              const isTrial = trialLoadout?.trail === tr.id;
              return (
                <div
                  key={tr.id}
                  style={{
                    backgroundColor: active || isTrial ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.78)',
                    border: active ? `2px solid ${tr.color}` : isTrial ? '2px dashed #38bdf8' : '1px solid rgba(148, 163, 184, 0.22)',
                    borderRadius: '12px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 900, color: tr.color }}>
                        {tr.icon} {tr.name}
                      </span>
                      <span style={{ fontSize: '9.5px', fontWeight: 900, color: tr.color }}>{tr.rarity}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.35 }}>{tr.desc}</div>
                  </div>

                  {owned ? (
                    <button
                      onClick={() => onSelectTrail(tr.id)}
                      style={{
                        backgroundColor: active ? 'rgba(74, 222, 128, 0.2)' : 'rgba(56, 189, 248, 0.18)',
                        border: active ? '1px solid #4ade80' : '1px solid #38bdf8',
                        color: active ? '#4ade80' : '#38bdf8',
                        borderRadius: '8px',
                        padding: '7px 10px',
                        fontSize: '11px',
                        fontWeight: 900,
                        cursor: 'pointer'
                      }}
                    >
                      {active ? '✓ MUNICIÓN EQUIPADA' : 'EQUIPAR TRAZADORA'}
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: tr.coinPrice > 0 ? '1fr 1fr' : '1fr', gap: '5px' }}>
                        {tr.coinPrice > 0 && (
                          <button
                            onClick={() => onUnlockCosmetic('trail', tr.id, tr.coinPrice, 0)}
                            style={{
                              backgroundColor: 'rgba(251, 191, 36, 0.18)',
                              border: '1px solid rgba(251, 191, 36, 0.55)',
                              color: '#fbbf24',
                              borderRadius: '7px',
                              padding: '6px 8px',
                              fontSize: '10.5px',
                              fontWeight: 900,
                              cursor: 'pointer'
                            }}
                          >
                            🪙 {tr.coinPrice}
                          </button>
                        )}
                        <button
                          onClick={() => onUnlockCosmetic('trail', tr.id, 0, tr.gemPrice)}
                          style={{
                            backgroundColor: 'rgba(56, 189, 248, 0.2)',
                            border: '1px solid rgba(56, 189, 248, 0.6)',
                            color: '#38bdf8',
                            borderRadius: '7px',
                            padding: '6px 8px',
                            fontSize: '10.5px',
                            fontWeight: 900,
                            cursor: 'pointer'
                          }}
                        >
                          💎 {tr.gemPrice} DESBLOQUEAR
                        </button>
                      </div>
                      <button
                        onClick={() => onTryCosmeticFree('trail', tr.id, tr.name)}
                        style={{
                          backgroundColor: isTrial ? 'rgba(56, 189, 248, 0.25)' : 'rgba(30, 41, 59, 0.8)',
                          border: '1px dashed rgba(148, 163, 184, 0.4)',
                          color: isTrial ? '#38bdf8' : '#cbd5e1',
                          borderRadius: '7px',
                          padding: '5px 8px',
                          fontSize: '10px',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        {isTrial ? '🎮 EN PRUEBA PARA LA PRÓXIMA MISIÓN' : '🎮 PROBAR 1 MISIÓN GRATIS'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 4: Tactical Combat Modules (100% Free-to-Play, No Pay-to-Win) */}
        {activeTab === 'perks' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            {TACTICAL_PERKS_LIST.map(p => {
              const active = selectedPerk === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => onSelectPerk(p.id)}
                  style={{
                    backgroundColor: active ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.75)',
                    border: active ? `2px solid ${p.color}` : '1px solid rgba(148, 163, 184, 0.22)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    boxShadow: active ? `0 0 16px ${p.color}33` : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: active ? p.color : '#e2e8f0' }}>
                      {p.icon} {p.name}
                    </span>
                    {active && <span style={{ fontSize: '10px', fontWeight: 900, color: p.color }}>EQUIPADO</span>}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.4 }}>{p.desc}</div>
                </button>
              );
            })}
          </div>
        )}

        <button className="tactical-btn-primary" style={styles.primaryButton} onClick={onClose}>
          ✓ LISTO
        </button>
      </div>
    </div>
  );
};

interface IntelModalProps {
  onClose: () => void;
}

const IntelModal: React.FC<IntelModalProps> = ({ onClose }) => (
  <div
    style={styles.overlay}
    onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}
  >
    <div style={{ ...styles.menuBox, maxWidth: '680px', maxHeight: '88vh', overflowY: 'auto', textAlign: 'left', padding: '22px 26px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(148, 163, 184, 0.2)', paddingBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 800, color: '#fbbf24', letterSpacing: '1.5px' }}>GUÍA RÁPIDA</div>
          <h2 style={{ ...styles.title, fontSize: '21px', margin: 0 }}>📖 MANUAL TÁCTICO</h2>
        </div>
        <ModalCloseButton onClick={onClose} />
      </div>

      <div style={{ marginTop: '14px' }}>
        <div style={{ fontSize: '11px', fontWeight: 900, color: '#fbbf24', letterSpacing: '0.8px', marginBottom: '8px' }}>
          🎮 CONTROLES (PC Y MÓVIL)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '8px', marginBottom: '16px' }}>
          <div style={styles.intelCard}>
            <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: '12px' }}>🕹️ Mover y Disparar</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>WASD + Clic Izq o Crucetas Táctiles</div>
          </div>
          <div style={styles.intelCard}>
            <div style={{ fontWeight: 800, color: '#fdba74', fontSize: '12px' }}>🚀 Cohete Bazoca</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>Tecla Q / F / Shift (Demuele muros)</div>
          </div>
          <div style={styles.intelCard}>
            <div style={{ fontWeight: 800, color: '#4ade80', fontSize: '12px' }}>💣 Mina Terrestre</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>Espacio / E / Clic Derecho</div>
          </div>
          <div style={styles.intelCard}>
            <div style={{ fontWeight: 800, color: '#38bdf8', fontSize: '12px' }}>🔍 Cámara y Noche</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>C Vista • Z/X Zoom • N Noche</div>
          </div>
        </div>

        <div style={{ fontSize: '11px', fontWeight: 900, color: '#38bdf8', letterSpacing: '0.8px', marginBottom: '8px' }}>
          🔓 DESBLOQUEO PROGRESIVO POR NIVEL (160 MISIONES)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))', gap: '8px', marginBottom: '14px' }}>
          <div style={{ ...styles.intelCard, borderLeft: '3px solid #4ade80' }}>
            <div style={{ fontWeight: 800, color: '#4ade80', fontSize: '12px' }}>💣 Nv.3: Minas Terrestres</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Explotan por proximidad o junto a barriles.</div>
          </div>
          <div style={{ ...styles.intelCard, borderLeft: '3px solid #ef4444' }}>
            <div style={{ fontWeight: 800, color: '#f87171', fontSize: '12px' }}>💥 Nv.4–5: Barril TNT y Cajas</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Explosiones en cadena, Escudos y Plataformas Turbo.</div>
          </div>
          <div style={{ ...styles.intelCard, borderLeft: '3px solid #fb923c' }}>
            <div style={{ fontWeight: 800, color: '#fdba74', fontSize: '12px' }}>🚀 Nv.6: Cohete Bazoca</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Demuele muros interiores y atraviesa defensas.</div>
          </div>
          <div style={{ ...styles.intelCard, borderLeft: '3px solid #a855f7' }}>
            <div style={{ fontWeight: 800, color: '#e879f9', fontSize: '12px' }}>🌀 Nv.10–12: Portales y Láser</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Teletransporta balas/tanques y abre barreras.</div>
          </div>
          <div style={{ ...styles.intelCard, borderLeft: '3px solid #00e5ff' }}>
            <div style={{ fontWeight: 800, color: '#22d3ee', fontSize: '12px' }}>❄️ Nv.14 y 🩹 Nv.16: Crio y Médico</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Barriles que congelan 5s y bases que curan +1❤️.</div>
          </div>
          <div style={{ ...styles.intelCard, borderLeft: '3px solid #38bdf8' }}>
            <div style={{ fontWeight: 800, color: '#38bdf8', fontSize: '12px' }}>⚡ Nv.18: Pulso EMP [Tecla R]</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Pulso orbital que destruye balas y paraliza enemigos.</div>
          </div>
        </div>
      </div>

      <button className="tactical-btn-primary" style={{ ...styles.primaryButton, marginTop: '6px' }} onClick={onClose}>
        ✓ ENTENDIDO
      </button>
    </div>
  </div>
);

// --- Main Application ---

export const App = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<'MENU' | 'LEVEL_SELECT' | 'PLAYING' | 'GAMEOVER' | 'PAUSED'>('MENU');
  const [showIntroSplash, setShowIntroSplash] = useState(true);
  const [showIntel, setShowIntel] = useState(false);
  const [showHangar, setShowHangar] = useState(false);
  const [showStore, setShowStore] = useState(false);
  const [storeInitialTab, setStoreInitialTab] = useState<'featured' | 'battlepass' | 'crate' | 'gems'>('featured');
  const [activeStripePack, setActiveStripePack] = useState<StripePack | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [unlockAll, setUnlockAll] = useState(true);
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try { return localStorage.getItem('tanks_sfx_muted') === 'true'; } catch { return false; }
  });
  const [isMusicMuted, setIsMusicMuted] = useState<boolean>(() => {
    try { return localStorage.getItem('tanks_music_muted') === 'true'; } catch { return false; }
  });
  const [sfxVolume, setSfxVolume] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('tanks_sfx_volume');
      if (saved !== null) {
        const parsed = parseFloat(saved);
        if (!Number.isNaN(parsed)) return Math.round(Math.max(0, Math.min(1, parsed)) * 100);
      }
      return 85;
    } catch { return 85; }
  });
  const [musicVolume, setMusicVolume] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('tanks_music_volume');
      if (saved !== null) {
        const parsed = parseFloat(saved);
        if (!Number.isNaN(parsed)) return Math.round(Math.max(0, Math.min(1, parsed)) * 100);
      }
      return 35;
    } catch { return 35; }
  });
  const [cameraMode, setCameraMode] = useState<'overview' | 'follow'>('overview');
  const [isPlayerDying, setIsPlayerDying] = useState(false);

  // Player Hangar Loadout & AI Difficulty State
  const [playerSkin, setPlayerSkin] = useState<string>(() => {
    try { return localStorage.getItem('tanks_player_skin') || 'classic'; } catch { return 'classic'; }
  });
  const [playerPerk, setPlayerPerk] = useState<string>(() => {
    try { return localStorage.getItem('tanks_player_perk') || 'ricochet'; } catch { return 'ricochet'; }
  });
  const [playerHat, setPlayerHat] = useState<string>(() => {
    try { return localStorage.getItem('tanks_player_hat') || 'none'; } catch { return 'none'; }
  });
  const [playerTrail, setPlayerTrail] = useState<string>(() => {
    try { return localStorage.getItem('tanks_player_trail') || 'cyan'; } catch { return 'cyan'; }
  });
  const [aiDifficulty, setAiDifficulty] = useState<string>(() => {
    try { return localStorage.getItem('tanks_ai_difficulty') || 'normal'; } catch { return 'normal'; }
  });

  // --- Voluntary Free-to-Play Economy & Cosmetics State ---
  const [coins, setCoins] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('tanks_coins');
      return saved !== null ? parseInt(saved, 10) : 550;
    } catch { return 550; }
  });
  const [gems, setGems] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('tanks_gems');
      return saved !== null ? parseInt(saved, 10) : 90;
    } catch { return 90; }
  });
  const [bpXp, setBpXp] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('tanks_bp_xp');
      return saved !== null ? parseInt(saved, 10) : 140;
    } catch { return 140; }
  });
  const [vipPassActive, setVipPassActive] = useState<boolean>(() => {
    try { return localStorage.getItem('tanks_vip_pass') === 'true'; } catch { return false; }
  });
  const [supporterBadge, setSupporterBadge] = useState<boolean>(() => {
    try { return localStorage.getItem('tanks_supporter_badge') === 'true'; } catch { return false; }
  });
  const [ownedSkins, setOwnedSkins] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tanks_owned_skins');
      return saved ? JSON.parse(saved) : ['classic'];
    } catch { return ['classic']; }
  });
  const [ownedHats, setOwnedHats] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tanks_owned_hats');
      return saved ? JSON.parse(saved) : ['none'];
    } catch { return ['none']; }
  });
  const [ownedTrails, setOwnedTrails] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tanks_owned_trails');
      return saved ? JSON.parse(saved) : ['cyan'];
    } catch { return ['cyan']; }
  });
  const [claimedFreeTiers, setClaimedFreeTiers] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('tanks_claimed_free_tiers');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [claimedVipTiers, setClaimedVipTiers] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('tanks_claimed_vip_tiers');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [pityCounter, setPityCounter] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('tanks_crate_pity');
      return saved !== null ? parseInt(saved, 10) : 1;
    } catch { return 1; }
  });
  const [purchaseReceipts, setPurchaseReceipts] = useState<PurchaseReceipt[]>(() => {
    try {
      const saved = localStorage.getItem('tanks_purchase_receipts');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const todayKey = new Date().toISOString().slice(0, 10);
  const [dailyClaimedToday, setDailyClaimedToday] = useState<boolean>(() => {
    try { return localStorage.getItem('tanks_daily_gift_date') === todayKey; } catch { return false; }
  });
  const [freeReviveUsedToday, setFreeReviveUsedToday] = useState<boolean>(() => {
    try { return localStorage.getItem('tanks_free_revive_date') === todayKey; } catch { return false; }
  });

  // Try-Before-You-Buy 1-Mission Free Trial Loadout
  const [trialLoadout, setTrialLoadout] = useState<{ skin?: string; hat?: string; trail?: string } | null>(null);
  const vipPassRef = useRef(vipPassActive);
  useEffect(() => { vipPassRef.current = vipPassActive; }, [vipPassActive]);

  // Persist economy & inventory changes
  useEffect(() => { try { localStorage.setItem('tanks_coins', coins.toString()); } catch (_) {} }, [coins]);
  useEffect(() => { try { localStorage.setItem('tanks_gems', gems.toString()); } catch (_) {} }, [gems]);
  useEffect(() => { try { localStorage.setItem('tanks_bp_xp', bpXp.toString()); } catch (_) {} }, [bpXp]);
  useEffect(() => { try { localStorage.setItem('tanks_vip_pass', vipPassActive ? 'true' : 'false'); } catch (_) {} }, [vipPassActive]);
  useEffect(() => { try { localStorage.setItem('tanks_supporter_badge', supporterBadge ? 'true' : 'false'); } catch (_) {} }, [supporterBadge]);
  useEffect(() => { try { localStorage.setItem('tanks_owned_skins', JSON.stringify(ownedSkins)); } catch (_) {} }, [ownedSkins]);
  useEffect(() => { try { localStorage.setItem('tanks_owned_hats', JSON.stringify(ownedHats)); } catch (_) {} }, [ownedHats]);
  useEffect(() => { try { localStorage.setItem('tanks_owned_trails', JSON.stringify(ownedTrails)); } catch (_) {} }, [ownedTrails]);
  useEffect(() => { try { localStorage.setItem('tanks_claimed_free_tiers', JSON.stringify(claimedFreeTiers)); } catch (_) {} }, [claimedFreeTiers]);
  useEffect(() => { try { localStorage.setItem('tanks_claimed_vip_tiers', JSON.stringify(claimedVipTiers)); } catch (_) {} }, [claimedVipTiers]);
  useEffect(() => { try { localStorage.setItem('tanks_crate_pity', pityCounter.toString()); } catch (_) {} }, [pityCounter]);
  useEffect(() => { try { localStorage.setItem('tanks_purchase_receipts', JSON.stringify(purchaseReceipts)); } catch (_) {} }, [purchaseReceipts]);

  // 3-Star Rating per mission persisted in localStorage
  const [missionStars, setMissionStars] = useState<Record<number, number>>(() => {
    try {
      const saved = localStorage.getItem('tanks_mission_stars');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [lastResultMeta, setLastResultMeta] = useState<{
    starsEarned: number;
    elapsedSec: number;
    damageTaken: number;
    coinsEarned: number;
    xpEarned: number;
  }>({
    starsEarned: 0,
    elapsedSec: 0,
    damageTaken: 0,
    coinsEarned: 0,
    xpEarned: 0
  });

  // Auto-detect mobile / touch capability, but allow user toggle
  const [touchControlsEnabled, setTouchControlsEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.innerWidth <= 1024);
  });

  const [gameStats, setGameStats] = useState({
    score: 0,
    lives: 3,
    enemiesLeft: 0,
    mission: 1,
    missionName: 'The Basics',
    biome: 'workshop',
    activePowerup: null as string | null,
    bossInfo: null as { name: string; hp: number; maxHp: number; enraged: boolean } | null,
    stealthStatus: null as 'STEALTH' | 'SPOTTED' | 'COMBAT' | null,
    isNightMode: false,
    won: false,
    mineUnlocked: false,
    mineReady: true,
    mineCooldownProgress: 1.0,
    bazookaUnlocked: false,
    bazookaReady: true,
    bazookaCooldownProgress: 1.0,
    empUnlocked: false,
    empReady: true,
    empCooldownProgress: 1.0,
    combo: 0,
    isPaused: false,
    cameraMode: 'overview' as 'overview' | 'follow',
    zoomLevel: 0.9
  });

  const [powerupToast, setPowerupToast] = useState<{ text: string; color: string; id: number } | null>(null);
  const [damageFlash, setDamageFlash] = useState(false);
  const [hitMarker, setHitMarker] = useState<{ label: string; color: string; id: number } | null>(null);
  const [missionBanner, setMissionBanner] = useState<{ mission: number; name: string; biome: string; unlockTitle?: string; unlockDesc?: string } | null>(null);
  const totalLevels = LevelLoader.getLevelCount();

  // Load unlocked level from localStorage
  const [unlockedLevel, setUnlockedLevel] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('tanks_unlocked_level');
      return saved ? parseInt(saved, 10) : 1;
    } catch {
      return 1;
    }
  });

  const showToast = useCallback((text: string, color = '#fbbf24') => {
    const toastId = Date.now();
    setPowerupToast({ text, color, id: toastId });
    setTimeout(() => {
      setPowerupToast(cur => cur?.id === toastId ? null : cur);
    }, 3200);
  }, []);

  const missionEndedRef = useRef<boolean>(false);

  const handleGameEvent = useCallback((event: { type: string; data?: any }) => {
    if (event.type === 'STATS_UPDATE' && event.data) {
      setGameStats(prev => ({ ...prev, ...event.data }));
      if (event.data.cameraMode) {
        setCameraMode(event.data.cameraMode);
      }
    } else if (event.type === 'POWERUP_COLLECTED' && event.data) {
      const toastId = Date.now();
      const color = event.data.isEnemy
        ? '#ff5252'
        : event.data.type === 'shield'
        ? '#00e5ff'
        : event.data.type === 'rapid'
        ? '#ffeb3b'
        : event.data.type === 'speed'
        ? '#00e676'
        : '#ff4081';
      setPowerupToast({ text: event.data.label || '¡MEJORA OBTENIDA!', color, id: toastId });
      setTimeout(() => {
        setPowerupToast(cur => cur?.id === toastId ? null : cur);
      }, 2800);
    } else if (event.type === 'SHIELD_BROKEN') {
      const toastId = Date.now();
      setPowerupToast({ text: '⚠️ ¡ESCUDO ROTO! (Absorbió el impacto)', color: '#ff5252', id: toastId });
      setTimeout(() => {
        setPowerupToast(cur => cur?.id === toastId ? null : cur);
      }, 2400);
    } else if (event.type === 'PLAYER_DAMAGED') {
      if (missionEndedRef.current) return;
      setDamageFlash(true);
      if ('vibrate' in navigator) {
        try { navigator.vibrate([50, 30, 60]); } catch (_) {}
      }
      setTimeout(() => setDamageFlash(false), 380);
    } else if (event.type === 'PLAYER_DYING') {
      if (missionEndedRef.current) return;
      setIsPlayerDying(true);
      setDamageFlash(true);
      if ('vibrate' in navigator) {
        try { navigator.vibrate([120, 40, 180, 40, 260]); } catch (_) {}
      }
      setTimeout(() => setDamageFlash(false), 550);
    } else if (event.type === 'ENEMY_DESTROYED' && event.data) {
      const hmId = Date.now();
      const { combo, points, method } = event.data;
      const mult = vipPassRef.current ? 1.25 : 1.0;
      const killCoins = Math.round((15 + Math.min(30, (combo || 1) * 5)) * mult);
      setCoins(c => c + killCoins);
      setBpXp(x => x + Math.round(12 * mult));

      let label = `💥 ¡BLANCO ELIMINADO! +${points} (+${killCoins}🪙)`;
      let color = '#ffeb3b';
      if (method === 'STEALTH') {
        label = `🥷 ¡GOLPE DE SIGILO! +${points} (+${killCoins}🪙)`;
        color = '#38bdf8';
      } else if (method === 'RICOCHET') {
        label = `🎯 ¡TIRO DE REBOTE! +${points} (+${killCoins}🪙)`;
        color = '#00e5ff';
      } else if (combo >= 2) {
        label = `🔥 ¡RACHA x${combo}! +${points} (+${killCoins}🪙)`;
        color = '#ff9100';
      }
      setHitMarker({ label, color, id: hmId });
      setTimeout(() => {
        setHitMarker(cur => cur?.id === hmId ? null : cur);
      }, 1500);
    } else if (event.type === 'LIGHT_PULSE' && event.data) {
      const toastId = Date.now();
      setPowerupToast({ text: event.data.text || '💡 ¡PILAR LUMINOSO ACTIVADO! ESCENARIO ILUMINADO', color: '#00e5ff', id: toastId });
      setTimeout(() => {
        setPowerupToast(cur => cur?.id === toastId ? null : cur);
      }, 3000);
    } else if (event.type === 'WEAPON_LOCKED' && event.data) {
      const toastId = Date.now();
      const w = event.data.weapon;
      const msg = w === 'mine'
        ? '🔒 MINAS DE PROXIMIDAD: Se desbloquean en la Misión 3'
        : w === 'bazooka'
        ? '🔒 COHETE BAZOCA: Se desbloquea en la Misión 6'
        : '🔒 PULSO EMP ORBITAL: Se desbloquea en la Misión 18';
      setPowerupToast({ text: msg, color: '#fbbf24', id: toastId });
      setTimeout(() => {
        setPowerupToast(cur => cur?.id === toastId ? null : cur);
      }, 2400);
    } else if (event.type === 'GAME_OVER' && event.data) {
      if (missionEndedRef.current) return;
      missionEndedRef.current = true;
      setIsPlayerDying(false);
      setGameState('GAMEOVER');
      setGameStats(prev => ({ ...prev, won: event.data.won }));

      const mult = vipPassRef.current ? 1.25 : 1.0;
      const earnedStars = event.data.starsEarned || 0;
      const missionCoins = event.data.won
        ? Math.round((85 + earnedStars * 35) * mult)
        : Math.round(25 * mult);
      const missionXp = event.data.won
        ? Math.round((65 + earnedStars * 15) * mult)
        : Math.round(20 * mult);

      setCoins(c => c + missionCoins);
      setBpXp(x => x + missionXp);

      setLastResultMeta({
        starsEarned: earnedStars,
        elapsedSec: event.data.elapsedSec || 0,
        damageTaken: event.data.damageTaken || 0,
        coinsEarned: missionCoins,
        xpEarned: missionXp
      });

      if (event.data.won) {
        const completedMission = event.data.mission || 1;
        const earned = event.data.starsEarned || 1;
        setUnlockedLevel(prev => Math.max(prev, completedMission + 1));
        setMissionStars(prev => {
          const prevStars = prev[completedMission] || 0;
          // First time getting 3 stars on a mission awards +10 Gems!
          if (earned === 3 && prevStars < 3) {
            setGems(g => g + 10);
          }
          const updated = { ...prev, [completedMission]: Math.max(prevStars, earned) };
          try { localStorage.setItem('tanks_mission_stars', JSON.stringify(updated)); } catch (_) {}
          return updated;
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!engineRef.current && canvasRef.current) {
      engineRef.current = new GameEngine(canvasRef.current, handleGameEvent);
    }

    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, [handleGameEvent]);

  // Persist unlocked level
  useEffect(() => {
    localStorage.setItem('tanks_unlocked_level', unlockedLevel.toString());
  }, [unlockedLevel]);

  const applyPackRewards = useCallback((pack: StripePack, customerEmail?: string) => {
    const addCoins = pack.coinsReward || pack.RewardCoins || 0;
    const addGems = pack.gemsReward || pack.RewardGems || 0;
    if (addCoins > 0) setCoins(c => c + addCoins);
    if (addGems > 0) setGems(g => g + addGems);

    let nextSkin = playerSkin;
    let nextHat = playerHat;
    let nextTrail = playerTrail;

    const skinsToUnlock = pack.unlockSkins || (pack.UnlockSkin ? [pack.UnlockSkin] : []);
    if (skinsToUnlock.length > 0) {
      setOwnedSkins(prev => Array.from(new Set([...prev, ...skinsToUnlock])));
      nextSkin = skinsToUnlock[0];
      setPlayerSkin(nextSkin);
    }

    const hatsToUnlock = pack.unlockHats || (pack.UnlockHat ? [pack.UnlockHat] : []);
    if (hatsToUnlock.length > 0) {
      setOwnedHats(prev => Array.from(new Set([...prev, ...hatsToUnlock])));
      nextHat = hatsToUnlock[0];
      setPlayerHat(nextHat);
    }

    const trailsToUnlock = pack.unlockTrails || (pack.UnlockTrail ? [pack.UnlockTrail] : []);
    if (trailsToUnlock.length > 0) {
      setOwnedTrails(prev => Array.from(new Set([...prev, ...trailsToUnlock])));
      nextTrail = trailsToUnlock[0];
      setPlayerTrail(nextTrail);
    }

    engineRef.current?.setPlayerLoadout(nextSkin, playerPerk, nextHat, nextTrail);

    if (pack.unlockVipPass || pack.UnlockVipPass) {
      setVipPassActive(true);
      setBpXp(x => x + 150);
    }
    if (pack.unlockSupporterBadge || pack.UnlockSupporterBadge || pack.id === 'coffee_support') {
      setSupporterBadge(true);
    }

    const receipt: PurchaseReceipt = {
      id: `STRP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      packId: pack.id,
      packTitle: pack.title || pack.name,
      priceEur: pack.priceEur,
      dateIso: new Date().toISOString(),
      email: customerEmail
    };
    setPurchaseReceipts(prev => [receipt, ...prev]);

    engineRef.current?.audio?.play('powerup');
    showToast(`🎉 ¡${(pack.title || pack.name).toUpperCase()} ACTIVADO Y GUARDADO EN TU CUENTA!`, '#4ade80');
  }, [playerPerk, playerHat, playerTrail, playerSkin, showToast]);

  const handleRestoreFromPassport = useCallback((payload: BackupPayload) => {
    setCoins(prev => Math.max(prev, payload.c || 0));
    setGems(prev => Math.max(prev, payload.g || 0));
    setBpXp(prev => Math.max(prev, payload.xp || 0));
    if (payload.vip) setVipPassActive(true);
    if (payload.sup) setSupporterBadge(true);
    if (Array.isArray(payload.sk)) {
      setOwnedSkins(prev => Array.from(new Set([...prev, ...payload.sk])));
    }
    if (Array.isArray(payload.ht)) {
      setOwnedHats(prev => Array.from(new Set([...prev, ...payload.ht])));
    }
    if (Array.isArray(payload.tr)) {
      setOwnedTrails(prev => Array.from(new Set([...prev, ...payload.tr])));
    }
    engineRef.current?.audio?.play('powerup');
    showToast('🔐 ¡COMPRAS E INVENTARIO 3D RESTAURADOS CON ÉXITO!', '#4ade80');
  }, [showToast]);

  // Handle return from live Stripe Checkout redirect (?purchase_success=true&product=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('purchase_success') === 'true') {
      const productId = params.get('product');
      const pack = STRIPE_PACKS_LIST.find(p => p.id === productId);
      if (pack) {
        applyPackRewards(pack);
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [applyPackRewards]);

  const handleSelectSkin = (skinId: string) => {
    setPlayerSkin(skinId);
    engineRef.current?.setPlayerLoadout(skinId, playerPerk, playerHat, playerTrail);
  };

  const handleSelectPerk = (perkId: string) => {
    setPlayerPerk(perkId);
    engineRef.current?.setPlayerLoadout(playerSkin, perkId, playerHat, playerTrail);
  };

  const handleSelectHat = (hatId: string) => {
    setPlayerHat(hatId);
    engineRef.current?.setPlayerLoadout(playerSkin, playerPerk, hatId, playerTrail);
  };

  const handleSelectTrail = (trailId: string) => {
    setPlayerTrail(trailId);
    engineRef.current?.setPlayerLoadout(playerSkin, playerPerk, playerHat, trailId);
  };

  const handleUnlockCosmetic = (category: 'skin' | 'hat' | 'trail', id: string, coinCost: number, gemCost: number) => {
    if (coinCost > 0) {
      if (coins < coinCost) {
        showToast('⚠️ No tienes suficientes Monedas de Oro 🪙. ¡Juega misiones o abre cofres!', '#f87171');
        return;
      }
      setCoins(c => c - coinCost);
    } else if (gemCost > 0) {
      if (gems < gemCost) {
        setShowHangar(false);
        setStoreInitialTab('gems');
        setShowStore(true);
        showToast('💎 Consigue Gemas de Plasma en la Tienda o en el Pase de Batalla', '#38bdf8');
        return;
      }
      setGems(g => g - gemCost);
    }

    if (category === 'skin') {
      setOwnedSkins(prev => prev.includes(id) ? prev : [...prev, id]);
      handleSelectSkin(id);
    } else if (category === 'hat') {
      setOwnedHats(prev => prev.includes(id) ? prev : [...prev, id]);
      handleSelectHat(id);
    } else if (category === 'trail') {
      setOwnedTrails(prev => prev.includes(id) ? prev : [...prev, id]);
      handleSelectTrail(id);
    }
    engineRef.current?.audio?.play('powerup');
    showToast('✨ ¡COSMÉTICO 3D DESBLOQUEADO Y EQUIPADO!', '#4ade80');
  };

  const handleTryCosmeticFree = (category: 'skin' | 'hat' | 'trail', id: string, name: string) => {
    setTrialLoadout(prev => ({
      ...(prev || {}),
      [category]: id
    }));
    engineRef.current?.audio?.play('powerup');
    showToast(`🎮 ¡PRUEBA ACTIVA! Jugarás la próxima misión con "${name}" gratis`, '#38bdf8');
  };

  const handleClaimDailyGift = () => {
    if (dailyClaimedToday) return;
    setDailyClaimedToday(true);
    try { localStorage.setItem('tanks_daily_gift_date', todayKey); } catch (_) {}
    setCoins(c => c + 250);
    setGems(g => g + 25);
    engineRef.current?.audio?.play('powerup');
    showToast('🎁 ¡SUMINISTRO DIARIO RECLAMADO! +250 🪙 y +25 💎', '#4ade80');
  };

  const handleClaimBattlePassTier = (tier: number, isVipTrack: boolean) => {
    const tierData = BATTLE_PASS_TIERS.find(t => t.tier === tier);
    if (!tierData) return;

    const reward = isVipTrack ? tierData.vipReward : tierData.freeReward;
    if (isVipTrack) {
      if (claimedVipTiers.includes(tier)) return;
      setClaimedVipTiers(prev => [...prev, tier]);
    } else {
      if (claimedFreeTiers.includes(tier)) return;
      setClaimedFreeTiers(prev => [...prev, tier]);
    }

    if (reward.type === 'coins' && reward.amount) setCoins(c => c + reward.amount!);
    if (reward.type === 'gems' && reward.amount) setGems(g => g + reward.amount!);
    if (reward.type === 'skin' && reward.itemId) {
      setOwnedSkins(prev => prev.includes(reward.itemId!) ? prev : [...prev, reward.itemId!]);
      handleSelectSkin(reward.itemId);
    }
    if (reward.type === 'hat' && reward.itemId) {
      setOwnedHats(prev => prev.includes(reward.itemId!) ? prev : [...prev, reward.itemId!]);
      handleSelectHat(reward.itemId);
    }
    if (reward.type === 'trail' && reward.itemId) {
      setOwnedTrails(prev => prev.includes(reward.itemId!) ? prev : [...prev, reward.itemId!]);
      handleSelectTrail(reward.itemId);
    }
    engineRef.current?.audio?.play('powerup');
    showToast(`🎖️ ¡RECOMPENSA NIVEL ${tier} RECLAMADA: ${reward.label}!`, '#e879f9');
  };

  const handleOpenMysteryCrate = (currency: 'coins' | 'gems'): { title: string; subtitle: string; icon: string; color: string } | null => {
    if (currency === 'coins') {
      if (coins < 400) {
        showToast('⚠️ Necesitas 400 Monedas 🪙 para abrir esta Caja Misteriosa', '#f87171');
        return null;
      }
      setCoins(c => c - 400);
    } else {
      if (gems < 50) {
        showToast('⚠️ Necesitas 50 Gemas 💎 para abrir el Cofre Épico', '#f87171');
        return null;
      }
      setGems(g => g - 50);
    }

    engineRef.current?.audio?.play('powerup');

    // Build pool of unowned cosmetics (No-duplicate protection!)
    const unownedPool: { category: 'skin' | 'hat' | 'trail'; id: string; name: string; rarity: string; icon: string; color: string }[] = [];
    TANK_SKINS_LIST.forEach(s => {
      if (!ownedSkins.includes(s.id)) {
        unownedPool.push({ category: 'skin', id: s.id, name: `Skin 3D: ${s.name}`, rarity: s.rarity, icon: s.badge, color: s.accent });
      }
    });
    TANK_HATS_LIST.forEach(h => {
      if (!ownedHats.includes(h.id)) {
        unownedPool.push({ category: 'hat', id: h.id, name: `Casco 3D: ${h.name}`, rarity: h.rarity, icon: h.icon, color: h.color });
      }
    });
    BULLET_TRAILS_LIST.forEach(tr => {
      if (!ownedTrails.includes(tr.id)) {
        unownedPool.push({ category: 'trail', id: tr.id, name: `Trazadora: ${tr.name}`, rarity: tr.rarity, icon: tr.icon, color: tr.color });
      }
    });

    const guaranteedRare = currency === 'gems' || pityCounter >= 3;
    if (unownedPool.length > 0 && (guaranteedRare || Math.random() < 0.65)) {
      const chosen = unownedPool[Math.floor(Math.random() * unownedPool.length)];
      if (chosen.category === 'skin') {
        setOwnedSkins(prev => [...prev, chosen.id]);
        handleSelectSkin(chosen.id);
      } else if (chosen.category === 'hat') {
        setOwnedHats(prev => [...prev, chosen.id]);
        handleSelectHat(chosen.id);
      } else {
        setOwnedTrails(prev => [...prev, chosen.id]);
        handleSelectTrail(chosen.id);
      }
      setPityCounter(1);
      return {
        title: `¡NUEVO COSMÉTICO: ${chosen.name.toUpperCase()}!`,
        subtitle: `Rareza ${chosen.rarity} • Equipado automáticamente en tu tanque 3D`,
        icon: chosen.icon,
        color: chosen.color
      };
    }

    // Fallback jackpot currency reward if all cosmetics owned or normal roll
    setPityCounter(p => Math.min(3, p + 1));
    const bonusGems = currency === 'gems' ? 75 : 35;
    const bonusCoins = 550;
    setGems(g => g + bonusGems);
    setCoins(c => c + bonusCoins);
    return {
      title: `¡BOTÍN DE GUERRA: +${bonusCoins} 🪙 Y +${bonusGems} 💎!`,
      subtitle: 'Suministros añadidos a tu cuenta • Pity de Cosmético aumentado',
      icon: '💎',
      color: '#38bdf8'
    };
  };

  const handleRevivePlayer = () => {
    if (!engineRef.current) return;
    if (!freeReviveUsedToday) {
      setFreeReviveUsedToday(true);
      try { localStorage.setItem('tanks_free_revive_date', todayKey); } catch (_) {}
    } else if (gems >= 25) {
      setGems(g => g - 25);
    } else {
      setStoreInitialTab('gems');
      setShowStore(true);
      return;
    }

    const revived = engineRef.current.revivePlayer();
    if (revived) {
      missionEndedRef.current = false;
      setIsPlayerDying(false);
      setGameState('PLAYING');
      showToast('⚡ ¡TANQUE REANIMADO CON ESCUDO DE PLASMA Y BLINDAJE AL 100%!', '#38bdf8');
    }
  };

  const handleSelectDifficulty = (diffId: string) => {
    setAiDifficulty(diffId);
    try { localStorage.setItem('tanks_ai_difficulty', diffId); } catch (_) {}
    engineRef.current?.setDifficulty(diffId);
  };

  const totalStarsEarned = (Object.values(missionStars) as number[]).reduce((acc: number, s: number) => acc + (s || 0), 0);

  // Camera toggle timestamp guard
  const lastCameraToggleRef = useRef<number>(0);

  const toggleCamera = useCallback(() => {
    const now = Date.now();
    if (now - lastCameraToggleRef.current < 350) return;
    lastCameraToggleRef.current = now;
    if (engineRef.current) {
      const newMode = engineRef.current.toggleCameraMode();
      setCameraMode(newMode);
    }
  }, []);

  // Mouse wheel zoom on PC
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (gameState === 'PLAYING' && engineRef.current && !isPlayerDying) {
        engineRef.current.adjustZoom(e.deltaY > 0 ? 0.08 : -0.08);
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [gameState, isPlayerDying]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyM') {
        toggleMute();
      } else if (e.code === 'Escape' || e.code === 'KeyP') {
        if (activeStripePack) {
          setActiveStripePack(null);
        } else if (showStore) {
          setShowStore(false);
        } else if (showHangar) {
          setShowHangar(false);
        } else if (showSettings) {
          setShowSettings(false);
        } else if (showIntel) {
          setShowIntel(false);
        } else if (gameState === 'LEVEL_SELECT') {
          setGameState('MENU');
        } else if (gameState === 'PLAYING' && !isPlayerDying) {
          pauseGame();
        } else if (gameState === 'PAUSED') {
          resumeGame();
        }
      } else if (gameState === 'PLAYING' && engineRef.current && !isPlayerDying) {
        if (e.code === 'KeyZ' || e.code === 'Equal' || e.code === 'NumpadAdd') {
          engineRef.current.adjustZoom(-0.15);
        } else if (e.code === 'KeyX' || e.code === 'Minus' || e.code === 'NumpadSubtract') {
          engineRef.current.adjustZoom(0.15);
        } else if (e.code === 'KeyC') {
          toggleCamera();
        } else if (e.code === 'KeyN') {
          engineRef.current.toggleNightMode();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, toggleCamera, isPlayerDying, activeStripePack, showStore, showHangar, showSettings, showIntel]);

  // Two-finger pinch zoom on mobile touch
  const lastTouchDist = useRef<number | null>(null);

  const handleCanvasTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist.current = Math.hypot(dx, dy);
    }
  };

  const handleCanvasTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDist.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const delta = dist - lastTouchDist.current;
      engineRef.current?.adjustZoom(-delta * 0.005);
      lastTouchDist.current = dist;
    }
  };

  const handleCanvasTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      lastTouchDist.current = null;
    }
  };

  const toggleMute = () => {
    if (engineRef.current) {
      const muted = engineRef.current.toggleMute();
      setIsMuted(muted);
      if (!muted && sfxVolume === 0) {
        setSfxVolume(85);
        engineRef.current.setSfxVolume(0.85);
      }
    }
  };

  const toggleMusic = () => {
    if (engineRef.current) {
      const musicMuted = engineRef.current.toggleMusic();
      setIsMusicMuted(musicMuted);
      if (!musicMuted && musicVolume === 0) {
        setMusicVolume(35);
        engineRef.current.setMusicVolume(0.35);
      }
    }
  };

  const handleChangeSfxVolume = (pct: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    setSfxVolume(clamped);
    setIsMuted(clamped === 0);
    if (engineRef.current) {
      engineRef.current.setSfxVolume(clamped / 100);
      if (clamped > 0) {
        engineRef.current.audio?.play('shoot');
      }
    }
  };

  const handleChangeMusicVolume = (pct: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    setMusicVolume(clamped);
    setIsMusicMuted(clamped === 0);
    if (engineRef.current) {
      engineRef.current.setMusicVolume(clamped / 100);
    }
  };

  const zoomIn = () => {
    if (engineRef.current) {
      engineRef.current.adjustZoom(-0.15);
    }
  };

  const zoomOut = () => {
    if (engineRef.current) {
      engineRef.current.adjustZoom(0.15);
    }
  };

  const startCampaign = () => {
    startGame(Math.min(unlockedLevel, totalLevels));
  };

  const startGame = (levelIndex: number) => {
    if (engineRef.current) {
      missionEndedRef.current = false;
      setIsPlayerDying(false);
      // Apply 1-mission Free Trial cosmetic if active, otherwise permanent loadout
      const effectiveSkin = trialLoadout?.skin || playerSkin;
      const effectiveHat = trialLoadout?.hat || playerHat;
      const effectiveTrail = trialLoadout?.trail || playerTrail;
      engineRef.current.setPlayerLoadout(effectiveSkin, playerPerk, effectiveHat, effectiveTrail);
      if (trialLoadout) {
        setTrialLoadout(null);
      }

      engineRef.current.setJoystickInput(0, 0, false);
      engineRef.current.setAimStickInput(0, 0, false);
      engineRef.current.startAudio();
      engineRef.current.setPause(false);
      const biome = LevelLoader.getBiome(levelIndex);
      const missionName = LevelLoader.getLevelName(levelIndex);
      const unlocks = LevelLoader.getUnlockedFeatures(levelIndex);
      const milestone = LevelLoader.getMilestoneUnlockInfo(levelIndex);
      setGameStats(prev => ({
        ...prev,
        mission: levelIndex,
        missionName,
        biome,
        mineUnlocked: unlocks.mineUnlocked,
        bazookaUnlocked: unlocks.bazookaUnlocked,
        empUnlocked: unlocks.empUnlocked,
        combo: 0,
        activePowerup: null
      }));
      engineRef.current.loadLevel(levelIndex);
      setGameState('PLAYING');
      setMissionBanner({
        mission: levelIndex,
        name: missionName,
        biome,
        unlockTitle: milestone ? `${milestone.icon} ${milestone.title}` : undefined,
        unlockDesc: milestone ? milestone.desc : undefined
      });
      setTimeout(() => {
        setMissionBanner(cur => cur?.mission === levelIndex ? null : cur);
      }, milestone ? 3400 : 2100);
    }
  };

  const pauseGame = () => {
    if (engineRef.current && !isPlayerDying) {
      engineRef.current.setPause(true);
      setGameState('PAUSED');
    }
  };

  const resumeGame = () => {
    if (engineRef.current) {
      engineRef.current.setPause(false);
      setGameState('PLAYING');
    }
  };

  const nextLevel = () => {
    if (engineRef.current) {
      const nextMission = gameStats.mission + 1;
      if (nextMission > totalLevels) {
        setGameState('LEVEL_SELECT');
      } else {
        startGame(nextMission);
      }
    }
  };

  const restartLevel = () => {
    if (engineRef.current) {
      startGame(gameStats.mission);
    }
  };

  const returnToMenu = () => {
    missionEndedRef.current = false;
    setIsPlayerDying(false);
    if (engineRef.current) {
      engineRef.current.setPause(false);
      engineRef.current.cleanup();
      engineRef.current.decorateTable('workshop', 80, 80);
      engineRef.current.startMenuMusic?.();
    }
    setGameState('MENU');
  };

  const isCampaignComplete = gameStats.won && gameStats.mission >= totalLevels;

  return (
    <>
      <canvas
        ref={canvasRef}
        onTouchStart={handleCanvasTouchStart}
        onTouchMove={handleCanvasTouchMove}
        onTouchEnd={handleCanvasTouchEnd}
        style={{
          width: '100vw',
          height: '100vh',
          display: 'block',
          touchAction: 'none'
        }}
      />

      {gameState === 'MENU' && (
        <MainMenu
          onStart={startCampaign}
          onQuickStartLevel={(lvl) => startGame(lvl)}
          onLevelSelect={() => setGameState('LEVEL_SELECT')}
          onOpenIntel={() => setShowIntel(true)}
          onOpenHangar={() => setShowHangar(true)}
          onOpenStore={(tab = 'featured') => {
            setStoreInitialTab(tab);
            setShowStore(true);
          }}
          onQuickBuyStarterPack={() => {
            const starter = STRIPE_PACKS_LIST.find(p => p.id === 'starter_pack');
            if (starter) setActiveStripePack(starter);
          }}
          onOpenSettings={() => setShowSettings(true)}
          onReplayIntro={() => {
            setShowIntroSplash(true);
          }}
          showIntroSplash={showIntroSplash}
          onFinishIntro={() => setShowIntroSplash(false)}
          onPlayBlockSound={(idx) => engineRef.current?.audio?.play('wood_pop', idx)}
          unlockedLevel={unlockedLevel}
          totalLevels={totalLevels}
          totalStars={totalStarsEarned}
          aiDifficulty={aiDifficulty}
          onSelectDifficulty={handleSelectDifficulty}
          isMusicMuted={isMusicMuted}
          onToggleMusic={toggleMusic}
          selectedSkin={playerSkin}
          selectedPerk={playerPerk}
          selectedHat={playerHat}
          selectedTrail={playerTrail}
          coins={coins}
          gems={gems}
          bpXp={bpXp}
          vipPassActive={vipPassActive}
          supporterBadge={supporterBadge}
          starterPackOwned={ownedSkins.includes('inferno_dragon')}
        />
      )}

      {gameState === 'LEVEL_SELECT' && (
        <LevelSelect
          unlocked={unlockedLevel}
          unlockAll={unlockAll}
          missionStars={missionStars}
          onToggleUnlockAll={() => setUnlockAll(prev => !prev)}
          onSelectLevel={startGame}
          onOpenHangar={() => setShowHangar(true)}
          onBack={() => setGameState('MENU')}
        />
      )}

      {gameState === 'PLAYING' && (
        <>
          {/* Red Damage Vignette Overlay */}
          {damageFlash && (
            <div style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 25,
              boxShadow: 'inset 0 0 110px 38px rgba(239, 68, 68, 0.82)',
              backgroundColor: 'rgba(220, 38, 38, 0.16)',
              transition: 'opacity 0.25s ease-out'
            }} />
          )}

          {/* Spectacular Death Cinematic Cross-Fade Overlay (Bridges 3D Tank Explosion directly into Game Over Menu) */}
          {isPlayerDying && (
            <div style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 45,
              animation: 'deathVignettePulse 1.65s cubic-bezier(0.22, 1, 0.36, 1) forwards'
            }}>
              {/* Top & Bottom Widescreen Cinema Letterbox Bars */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '11vh',
                background: 'linear-gradient(180deg, rgba(6, 9, 16, 0.96) 0%, rgba(6, 9, 16, 0.0) 100%)',
                animation: 'cinemaBarTop 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards'
              }} />
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '11vh',
                background: 'linear-gradient(0deg, rgba(6, 9, 16, 0.96) 0%, rgba(6, 9, 16, 0.0) 100%)',
                animation: 'cinemaBarBottom 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards'
              }} />

              {/* Dramatic Tactical Critical Failure Alert */}
              <div style={{
                position: 'absolute',
                top: '24%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: 'rgba(15, 23, 42, 0.88)',
                border: '1px solid rgba(248, 113, 113, 0.65)',
                boxShadow: '0 0 36px rgba(239, 68, 68, 0.55)',
                padding: '10px 26px',
                borderRadius: '10px',
                textAlign: 'center',
                animation: 'deathAlertBanner 1.65s cubic-bezier(0.22, 1, 0.36, 1) forwards'
              }}>
                <div style={{ fontSize: '10px', fontWeight: 900, color: '#fca5a5', letterSpacing: '2.5px' }}>
                  ⚠️ ALERTA DE SISTEMA • IMPACTO LETAL
                </div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#f87171', fontFamily: '"Chakra Petch", sans-serif', marginTop: '2px' }}>
                  BLINDAJE DESTRUIDO
                </div>
              </div>
            </div>
          )}

          {/* Mission Start Tactical Banner + Progressive Feature Unlock Celebration */}
          {missionBanner && !isPlayerDying && (
            <div style={{
              position: 'absolute',
              top: '28%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 32,
              backgroundColor: 'rgba(15, 23, 42, 0.94)',
              border: missionBanner.unlockTitle ? '1.5px solid #38bdf8' : '1px solid rgba(251, 191, 36, 0.6)',
              borderRadius: '14px',
              padding: '14px 30px',
              textAlign: 'center',
              pointerEvents: 'none',
              boxShadow: missionBanner.unlockTitle
                ? '0 18px 42px rgba(0,0,0,0.65), 0 0 28px rgba(56, 189, 248, 0.35)'
                : '0 18px 42px rgba(0,0,0,0.6), 0 0 24px rgba(251, 191, 36, 0.2)',
              backdropFilter: 'blur(10px)',
              maxWidth: '90vw'
            }}>
              <div style={{ color: '#fbbf24', fontSize: '10.5px', fontWeight: 800, letterSpacing: '2px' }}>
                DESPLIEGUE TÁCTICO • MISIÓN #{missionBanner.mission}
              </div>
              <div style={{ color: '#f8fafc', fontSize: '23px', fontWeight: 900, marginTop: '3px', fontFamily: '"Chakra Petch", sans-serif' }}>
                {missionBanner.name.toUpperCase()}
              </div>
              {missionBanner.unlockTitle && (
                <div style={{
                  marginTop: '8px',
                  paddingTop: '8px',
                  borderTop: '1px solid rgba(56, 189, 248, 0.35)'
                }}>
                  <div style={{ color: '#38bdf8', fontSize: '12px', fontWeight: 900, letterSpacing: '0.8px' }}>
                    🔓 {missionBanner.unlockTitle}
                  </div>
                  <div style={{ color: '#cbd5e1', fontSize: '11px', fontWeight: 700, marginTop: '2px' }}>
                    {missionBanner.unlockDesc}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Kill / Ricochet / Combo Hit-Marker Banner */}
          {hitMarker && !isPlayerDying && (
            <div style={{
              position: 'absolute',
              top: '112px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 34,
              backgroundColor: 'rgba(15, 23, 42, 0.92)',
              border: `1.5px solid ${hitMarker.color}`,
              color: hitMarker.color,
              padding: '6px 18px',
              borderRadius: '20px',
              fontWeight: 800,
              fontSize: '13px',
              letterSpacing: '0.5px',
              boxShadow: `0 6px 18px rgba(0,0,0,0.4), 0 0 14px ${hitMarker.color}44`,
              pointerEvents: 'none'
            }}>
              {hitMarker.label}
            </div>
          )}

          <HUD
            {...gameStats}
            cameraMode={cameraMode}
            isMuted={isMuted}
            isMusicMuted={isMusicMuted}
            aiDifficulty={aiDifficulty}
            touchControlsEnabled={touchControlsEnabled}
            isDying={isPlayerDying}
            onMenu={() => {
              engineRef.current?.startMenuMusic?.();
              setGameState('LEVEL_SELECT');
            }}
            onToggleMute={toggleMute}
            onToggleMusic={toggleMusic}
            onPause={pauseGame}
            onToggleCamera={toggleCamera}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onToggleTouchControls={() => setTouchControlsEnabled(prev => !prev)}
            onToggleNightMode={() => engineRef.current?.toggleNightMode()}
            onMine={() => engineRef.current?.triggerMine()}
            onBazooka={() => engineRef.current?.triggerBazooka()}
            onEmp={() => engineRef.current?.triggerEmp()}
          />

          {/* Floating Power-up Toast Notification */}
          {powerupToast && !isPlayerDying && (
            <div style={{
              position: 'absolute',
              top: '74px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 35,
              backgroundColor: 'rgba(15, 23, 42, 0.94)',
              border: `1.5px solid ${powerupToast.color}`,
              color: '#f8fafc',
              padding: '9px 22px',
              borderRadius: '24px',
              fontWeight: 800,
              fontSize: '13.5px',
              letterSpacing: '0.5px',
              boxShadow: `0 8px 24px rgba(0,0,0,0.45), 0 0 16px ${powerupToast.color}55`,
              pointerEvents: 'none'
            }}>
              {powerupToast.text}
            </div>
          )}

          {/* Virtual On-Screen Gamepad for Mobile Touch */}
          {touchControlsEnabled && !isPlayerDying && (
            <div style={styles.mobileControlsContainer}>
              <VirtualJoystick
                onMove={(x, y, active) => {
                  if (engineRef.current) {
                    engineRef.current.setJoystickInput(x, y, active);
                  }
                }}
              />

              <MobileControlsCluster
                onAim={(x, y, active, shouldAutoFire = true) => {
                  engineRef.current?.setAimStickInput(x, y, active, shouldAutoFire);
                }}
                onBazookaStick={(x, y, active, fireOnRelease) => {
                  engineRef.current?.setBazookaStickInput(x, y, active, fireOnRelease);
                }}
                onQuickShoot={() => {
                  engineRef.current?.triggerShoot();
                }}
                onMine={() => {
                  engineRef.current?.triggerMine();
                }}
                onBazooka={() => {
                  engineRef.current?.triggerBazooka();
                }}
                onEmp={() => {
                  engineRef.current?.triggerEmp();
                }}
                onToggleCamera={toggleCamera}
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
                cameraMode={cameraMode}
                mineUnlocked={gameStats.mineUnlocked}
                mineReady={gameStats.mineReady}
                mineCooldownProgress={gameStats.mineCooldownProgress}
                bazookaUnlocked={gameStats.bazookaUnlocked}
                bazookaReady={gameStats.bazookaReady}
                bazookaCooldownProgress={gameStats.bazookaCooldownProgress}
                empUnlocked={gameStats.empUnlocked}
                empReady={gameStats.empReady}
                empCooldownProgress={gameStats.empCooldownProgress}
              />
            </div>
          )}
        </>
      )}

      {gameState === 'PAUSED' && (
        <PauseMenu
          onResume={resumeGame}
          onRestart={restartLevel}
          onSelectLevel={() => {
            engineRef.current?.startMenuMusic?.();
            setGameState('LEVEL_SELECT');
          }}
          onMenu={returnToMenu}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          isMusicMuted={isMusicMuted}
          onToggleMusic={toggleMusic}
          sfxVolume={sfxVolume}
          onChangeSfxVolume={handleChangeSfxVolume}
          musicVolume={musicVolume}
          onChangeMusicVolume={handleChangeMusicVolume}
          aiDifficulty={aiDifficulty}
          onSelectDifficulty={handleSelectDifficulty}
          onToggleCamera={toggleCamera}
          cameraMode={cameraMode}
          touchControlsEnabled={touchControlsEnabled}
          onToggleTouchControls={() => setTouchControlsEnabled(prev => !prev)}
          mission={gameStats.mission}
          missionName={gameStats.missionName}
        />
      )}

      {gameState === 'GAMEOVER' && (
        <GameOverScreen
          won={gameStats.won}
          isCampaignComplete={isCampaignComplete}
          score={gameStats.score}
          mission={gameStats.mission}
          missionName={gameStats.missionName}
          biome={gameStats.biome}
          starsEarned={lastResultMeta.starsEarned}
          elapsedSec={lastResultMeta.elapsedSec}
          damageTaken={lastResultMeta.damageTaken}
          coinsEarned={lastResultMeta.coinsEarned}
          xpEarned={lastResultMeta.xpEarned}
          gems={gems}
          freeReviveAvailable={!freeReviveUsedToday}
          onRevive={handleRevivePlayer}
          onOpenStoreGems={() => {
            setStoreInitialTab('gems');
            setShowStore(true);
          }}
          onNext={nextLevel}
          onRestart={restartLevel}
          onLevelSelect={() => {
            engineRef.current?.startMenuMusic?.();
            setGameState('LEVEL_SELECT');
          }}
          onMenu={returnToMenu}
        />
      )}

      {showIntel && <IntelModal onClose={() => setShowIntel(false)} />}
      {showHangar && (
        <HangarModal
          selectedSkin={playerSkin}
          selectedPerk={playerPerk}
          selectedHat={playerHat}
          selectedTrail={playerTrail}
          ownedSkins={ownedSkins}
          ownedHats={ownedHats}
          ownedTrails={ownedTrails}
          coins={coins}
          gems={gems}
          trialLoadout={trialLoadout}
          onSelectSkin={handleSelectSkin}
          onSelectPerk={handleSelectPerk}
          onSelectHat={handleSelectHat}
          onSelectTrail={handleSelectTrail}
          onUnlockCosmetic={handleUnlockCosmetic}
          onTryCosmeticFree={handleTryCosmeticFree}
          onOpenStore={() => {
            setShowHangar(false);
            setStoreInitialTab('featured');
            setShowStore(true);
          }}
          onClose={() => setShowHangar(false)}
        />
      )}
      {showStore && (
        <StoreModal
          coins={coins}
          gems={gems}
          bpXp={bpXp}
          vipPassActive={vipPassActive}
          supporterBadge={supporterBadge}
          ownedSkins={ownedSkins}
          ownedHats={ownedHats}
          ownedTrails={ownedTrails}
          claimedFreeTiers={claimedFreeTiers}
          claimedVipTiers={claimedVipTiers}
          pityCounter={pityCounter}
          dailyClaimedToday={dailyClaimedToday}
          purchaseReceipts={purchaseReceipts}
          onClaimDailyReward={handleClaimDailyGift}
          onClaimDailyGift={handleClaimDailyGift}
          onClaimBattlePassTier={handleClaimBattlePassTier}
          onOpenMysteryChest={handleOpenMysteryCrate}
          onOpenMysteryCrate={handleOpenMysteryCrate}
          onOpenStripeCheckout={(pack) => setActiveStripePack(pack)}
          onInitiateStripeCheckout={(pack) => setActiveStripePack(pack)}
          onRestoreFromPassport={handleRestoreFromPassport}
          onRestoreStripeProducts={(productIds, email) => {
            const uniqueIds = Array.from(new Set(productIds));
            uniqueIds.forEach(pid => {
              const pack = STRIPE_PACKS_LIST.find(p => p.id === pid);
              const alreadyApplied = purchaseReceipts.some(r => r.packId === pid);
              if (pack && !alreadyApplied) {
                applyPackRewards(pack, email);
              }
            });
          }}
          onOpenHangar={() => {
            setShowStore(false);
            setShowHangar(true);
          }}
          onClose={() => setShowStore(false)}
          initialTab={storeInitialTab}
        />
      )}
      {activeStripePack && (
        <StripeCheckoutModal
          pack={activeStripePack}
          onConfirmSuccess={(pack, email) => {
            applyPackRewards(pack, email);
            setActiveStripePack(null);
          }}
          onSuccess={(pack, email) => {
            applyPackRewards(pack, email);
            setActiveStripePack(null);
          }}
          onClose={() => setActiveStripePack(null)}
        />
      )}
      {showSettings && (
        <SettingsModal
          aiDifficulty={aiDifficulty}
          onSelectDifficulty={handleSelectDifficulty}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          isMusicMuted={isMusicMuted}
          onToggleMusic={toggleMusic}
          sfxVolume={sfxVolume}
          onChangeSfxVolume={handleChangeSfxVolume}
          musicVolume={musicVolume}
          onChangeMusicVolume={handleChangeMusicVolume}
          touchControlsEnabled={touchControlsEnabled}
          onToggleTouchControls={() => setTouchControlsEnabled(prev => !prev)}
          cameraMode={cameraMode}
          onToggleCamera={toggleCamera}
          onReplayIntro={() => {
            setShowSettings(false);
            setShowIntroSplash(true);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
};

// --- Styles ---

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflowY: 'auto',
    background: 'radial-gradient(circle at center, rgba(15, 23, 42, 0.58) 0%, rgba(8, 12, 22, 0.86) 100%)',
    backdropFilter: 'blur(12px)',
    pointerEvents: 'auto',
    cursor: 'default',
    padding: '18px',
    boxSizing: 'border-box',
    zIndex: 100,
    animation: 'overlayFadeIn 0.35s ease-out forwards'
  },
  menuBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    padding: '26px 32px',
    borderRadius: '18px',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
    textAlign: 'center',
    border: '1px solid rgba(251, 191, 36, 0.32)',
    minWidth: '320px',
    maxWidth: '550px',
    maxHeight: 'calc(100vh - 36px)',
    overflowY: 'auto',
    margin: 'auto',
    width: '100%',
    color: '#f8fafc',
    animation: 'cardReveal 0.38s cubic-bezier(0.22, 1, 0.36, 1) forwards'
  },
  toyBadge: {
    display: 'inline-block',
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    border: '1px solid rgba(251, 191, 36, 0.45)',
    color: '#fbbf24',
    fontSize: '10px',
    fontWeight: 800,
    padding: '4px 12px',
    borderRadius: '6px',
    letterSpacing: '1.4px'
  },
  title: {
    fontFamily: '"Chakra Petch", Impact, sans-serif',
    fontSize: '34px',
    fontWeight: 700,
    color: '#f8fafc',
    margin: '4px 0 6px 0',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    textShadow: '0 4px 18px rgba(0, 0, 0, 0.5)'
  },
  subtitle: {
    color: '#94a3b8',
    margin: '0 0 18px 0',
    fontWeight: 600,
    fontSize: '13.5px',
    lineHeight: '1.45'
  },
  primaryButton: {
    background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    padding: '14px 22px',
    fontSize: '14.5px',
    fontWeight: 900,
    fontFamily: '"Chakra Petch", sans-serif',
    color: '#0f172a',
    borderRadius: '10px',
    cursor: 'pointer',
    boxShadow: '0 6px 20px rgba(245, 158, 11, 0.32)',
    outline: 'none',
    width: '100%',
    letterSpacing: '0.8px'
  },
  secondaryButton: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    border: '1px solid rgba(148, 163, 184, 0.28)',
    padding: '12px 16px',
    fontSize: '12.5px',
    fontWeight: 800,
    color: '#f1f5f9',
    borderRadius: '10px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
    outline: 'none',
    width: '100%',
    letterSpacing: '0.4px'
  },
  tertiaryButton: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    padding: '11px 16px',
    fontSize: '12px',
    fontWeight: 700,
    color: '#94a3b8',
    borderRadius: '10px',
    cursor: 'pointer',
    outline: 'none',
    width: '100%'
  },
  studioMenuBtn: {
    backgroundColor: 'rgba(9, 14, 26, 0.82)',
    border: '1px solid rgba(148, 163, 184, 0.22)',
    borderRadius: '11px',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    outline: 'none',
    width: '100%',
    textAlign: 'left',
    color: '#f8fafc'
  },
  studioMenuIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '9px',
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    flexShrink: 0
  },
  studioMenuTitle: {
    fontSize: '13.5px',
    fontWeight: 900,
    color: '#f8fafc',
    fontFamily: '"Chakra Petch", sans-serif',
    letterSpacing: '0.5px'
  },
  studioMenuSub: {
    fontSize: '11px',
    color: '#94a3b8',
    marginTop: '2px'
  },
  controlsInfoBox: {
    marginTop: '18px',
    padding: '12px 16px',
    backgroundColor: 'rgba(9, 14, 26, 0.65)',
    borderRadius: '10px',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    fontSize: '12px',
    color: '#94a3b8',
    lineHeight: '1.55',
    textAlign: 'left'
  },
  kbd: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    borderRadius: '4px',
    padding: '1px 6px',
    fontSize: '10.5px',
    fontWeight: 700,
    color: '#e2e8f0',
    fontFamily: 'monospace'
  },
  intelCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1px solid rgba(148, 163, 184, 0.16)'
  },
  levelGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))',
    gap: '10px',
    padding: '4px 2px'
  },
  levelCard: {
    padding: '12px 12px',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    outline: 'none'
  },
  hudContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    padding: '14px 18px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    zIndex: 10
  },
  hudTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '8px'
  },
  hudBottom: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: '8px'
  },
  hudPanel: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    padding: '6px 14px',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    fontWeight: 700,
    color: '#f8fafc',
    fontSize: '12.5px',
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'auto',
    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.3)'
  },
  hudButton: {
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '12px',
    fontWeight: 800,
    color: '#e2e8f0',
    cursor: 'pointer',
    outline: 'none',
    padding: '2px 4px'
  },
  miniBtn: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    borderRadius: '5px',
    fontSize: '11px',
    fontWeight: 800,
    color: '#f8fafc',
    cursor: 'pointer',
    padding: '2px 6px',
    outline: 'none'
  },
  highlight: {
    color: '#fbbf24',
    fontWeight: 900,
    marginLeft: '6px'
  },
  mobileControlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    padding: '18px 24px',
    paddingBottom: 'calc(18px + env(safe-area-inset-bottom, 0px))',
    boxSizing: 'border-box',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    pointerEvents: 'none',
    zIndex: 20
  }
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}
