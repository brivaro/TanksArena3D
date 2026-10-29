import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GameEngine } from './game/core/GameEngine.js';
import { LevelLoader } from './game/world/LevelLoader.js';

// --- Virtual Touch Controls for Mobile ---

interface VirtualJoystickProps {
  onMove: (x: number, y: number, active: boolean) => void;
}

const VirtualJoystick: React.FC<VirtualJoystickProps> = ({ onMove }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const activeTouchId = useRef<number | null>(null);

  const maxRadius = 45; // Max drag radius in px
  const deadZone = 12;  // Deadzone in px to prevent unintentional phantom movement

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
    // Normalize to [-1, 1]
    const normX = posX / maxRadius;
    const normY = posY / maxRadius;
    onMove(normX, normY, true);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (activeTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    activeTouchId.current = touch.identifier;
    setIsActive(true);
    // When placing finger down, do NOT move yet! Wait for deliberate drag
    setStickPos({ x: 0, y: 0 });
    onMove(0, 0, false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
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
    activeTouchId.current = null;
    setIsActive(false);
    setStickPos({ x: 0, y: 0 });
    onMove(0, 0, false);
  };

  const handleTouchCancel = (e: React.TouchEvent) => {
    e.stopPropagation();
    activeTouchId.current = null;
    setIsActive(false);
    setStickPos({ x: 0, y: 0 });
    onMove(0, 0, false);
  };

  // Guarantee stopping on unmount
  useEffect(() => {
    return () => {
      onMove(0, 0, false);
    };
  }, [onMove]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          backgroundColor: 'rgba(25, 20, 15, 0.55)',
          border: '3px solid rgba(255, 255, 255, 0.65)',
          backdropFilter: 'blur(6px)',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'none',
          pointerEvents: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          userSelect: 'none'
        }}
      >
        {/* Subtle cross axes */}
        <div style={{ position: 'absolute', width: '70%', height: '1px', backgroundColor: 'rgba(255,255,255,0.2)' }} />
        <div style={{ position: 'absolute', height: '70%', width: '1px', backgroundColor: 'rgba(255,255,255,0.2)' }} />
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            backgroundColor: isActive ? '#ffca28' : 'rgba(255, 255, 255, 0.9)',
            border: '3px solid #8d6e63',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            transform: `translate(${stickPos.x}px, ${stickPos.y}px)`,
            transition: isActive ? 'none' : 'transform 0.15s ease-out',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            userSelect: 'none'
          }}
        >
          🕹️
        </div>
      </div>
      <div style={{
        marginTop: '6px',
        backgroundColor: 'rgba(30, 20, 10, 0.7)',
        color: '#fff',
        fontSize: '10px',
        fontWeight: '900',
        padding: '2px 8px',
        borderRadius: '10px',
        letterSpacing: '1px',
        userSelect: 'none'
      }}>
        MOVER
      </div>
    </div>
  );
};

// --- Brawl Stars Style Aim & Shoot Virtual Crosshair Joystick ---
interface VirtualAimJoystickProps {
  onAim: (x: number, y: number, active: boolean) => void;
  onQuickShoot?: () => void;
}

const VirtualAimJoystick: React.FC<VirtualAimJoystickProps> = ({ onAim }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const [isFiring, setIsFiring] = useState(false);
  const activeTouchId = useRef<number | null>(null);

  const maxRadius = 45; // Max drag radius in px
  const deadZone = 14;  // Deadzone in px: Must deliberately move crosshair to shoot!

  const updatePosition = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist < deadZone) {
      // Inside deadzone: Move handle slightly to follow finger, but DO NOT SHOOT
      setStickPos({ x: dx, y: dy });
      setIsFiring(false);
      onAim(0, 0, false);
      return;
    }

    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const posX = Math.cos(angle) * clampedDist;
    const posY = Math.sin(angle) * clampedDist;

    setStickPos({ x: posX, y: posY });
    setIsFiring(true);

    // Normalize to [-1, 1]
    const normX = posX / maxRadius;
    const normY = posY / maxRadius;
    onAim(normX, normY, true);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (activeTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    activeTouchId.current = touch.identifier;
    setIsActive(true);
    setIsFiring(false);
    // When placing finger down, do NOT fire yet! Keep stick centered until dragged
    setStickPos({ x: 0, y: 0 });
    onAim(0, 0, false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
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
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeTouchId.current) {
        activeTouchId.current = null;
        setIsActive(false);
        setIsFiring(false);
        setStickPos({ x: 0, y: 0 });
        onAim(0, 0, false); // Immediately ceases all shooting
        break;
      }
    }
  };

  const handleTouchCancel = (e: React.TouchEvent) => {
    e.stopPropagation();
    activeTouchId.current = null;
    setIsActive(false);
    setIsFiring(false);
    setStickPos({ x: 0, y: 0 });
    onAim(0, 0, false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          backgroundColor: isFiring ? 'rgba(216, 67, 21, 0.45)' : isActive ? 'rgba(255, 112, 67, 0.25)' : 'rgba(40, 15, 10, 0.55)',
          border: isFiring ? '3px solid #ff5722' : isActive ? '3px solid #ff9800' : '3px solid rgba(255, 112, 67, 0.75)',
          backdropFilter: 'blur(6px)',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'none',
          pointerEvents: 'auto',
          boxShadow: isFiring ? '0 0 24px rgba(255,87,34,0.7)' : '0 8px 24px rgba(0,0,0,0.5)',
          userSelect: 'none',
          transition: 'box-shadow 0.2s, background-color 0.2s, border-color 0.2s'
        }}
      >
        {/* Aim Crosshair Reticle Markers */}
        <div style={{ position: 'absolute', top: '6px', width: '2px', height: '10px', backgroundColor: isFiring ? '#ff3d00' : '#ff7043', borderRadius: '1px' }} />
        <div style={{ position: 'absolute', bottom: '6px', width: '2px', height: '10px', backgroundColor: isFiring ? '#ff3d00' : '#ff7043', borderRadius: '1px' }} />
        <div style={{ position: 'absolute', left: '6px', height: '2px', width: '10px', backgroundColor: isFiring ? '#ff3d00' : '#ff7043', borderRadius: '1px' }} />
        <div style={{ position: 'absolute', right: '6px', height: '2px', width: '10px', backgroundColor: isFiring ? '#ff3d00' : '#ff7043', borderRadius: '1px' }} />

        {/* Joystick Handle */}
        <div
          style={{
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            backgroundColor: isFiring ? '#ff5722' : isActive ? '#ff9800' : '#ffca28',
            border: '3px solid #ffffff',
            boxShadow: isFiring
              ? '0 0 16px rgba(255,87,34,0.9), inset 0 2px 4px rgba(255,255,255,0.8)'
              : '0 4px 12px rgba(0,0,0,0.4)',
            transform: `translate(${stickPos.x}px, ${stickPos.y}px)`,
            transition: isActive ? 'none' : 'transform 0.15s ease-out',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            userSelect: 'none'
          }}
        >
          🎯
        </div>
      </div>
      <div style={{
        marginTop: '6px',
        backgroundColor: isFiring ? 'rgba(216, 67, 21, 0.9)' : isActive ? 'rgba(230, 81, 0, 0.85)' : 'rgba(40, 15, 10, 0.7)',
        color: '#fff',
        fontSize: '10px',
        fontWeight: '900',
        padding: '2px 8px',
        borderRadius: '10px',
        letterSpacing: '0.5px',
        userSelect: 'none'
      }}>
        {isFiring ? '🔥 DISPARANDO...' : isActive ? '🎯 APUNTA MOVIENDO LA MIRA' : 'CRUCETA: MUEVE PARA DISPARAR'}
      </div>
    </div>
  );
};

interface MobileControlsClusterProps {
  onAim: (x: number, y: number, active: boolean) => void;
  onQuickShoot?: () => void;
  onMine: () => void;
  onToggleCamera: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  cameraMode?: 'overview' | 'follow';
  mineReady: boolean;
}

const MobileControlsCluster: React.FC<MobileControlsClusterProps> = ({
  onAim,
  onQuickShoot,
  onMine,
  onToggleCamera,
  onZoomIn,
  onZoomOut,
  cameraMode,
  mineReady
}) => {
  const [minePressed, setMinePressed] = useState(false);
  const [camPressed, setCamPressed] = useState(false);
  const lastCameraTapRef = useRef(0);
  const lastMineTapRef = useRef(0);

  // Bulletproof anti-duplicate camera toggle
  const handleCameraTrigger = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    if (now - lastCameraTapRef.current < 350) return;
    lastCameraTapRef.current = now;

    setCamPressed(true);
    setTimeout(() => setCamPressed(false), 200);

    if ('vibrate' in navigator) {
      try { navigator.vibrate(25); } catch (_) {}
    }
    onToggleCamera();
  };

  const handleMineTrigger = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    if (now - lastMineTapRef.current < 300) return;
    lastMineTapRef.current = now;

    setMinePressed(true);
    setTimeout(() => setMinePressed(false), 200);
    if ('vibrate' in navigator) {
      try { navigator.vibrate(30); } catch (_) {}
    }
    onMine();
  };

  return (
    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-end', pointerEvents: 'auto' }}>
      {/* Side Utility Controls (Camera Mode & Mine Button) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
        {/* Dynamic Camera Quick Toggle with Anti-Double-Fire and Active Visual Glow */}
        <button
          type="button"
          onTouchStart={handleCameraTrigger}
          onClick={handleCameraTrigger}
          style={{
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            backgroundColor: cameraMode === 'follow' ? '#e1f5fe' : 'rgba(255, 255, 255, 0.95)',
            border: cameraMode === 'follow' ? '3px solid #0288d1' : '3px solid #8d6e63',
            boxShadow: cameraMode === 'follow'
              ? '0 0 16px rgba(2, 136, 209, 0.8), inset 0 2px 4px rgba(255,255,255,0.9)'
              : '0 4px 12px rgba(0,0,0,0.3)',
            color: cameraMode === 'follow' ? '#01579b' : '#3e2723',
            fontSize: '19px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'none',
            userSelect: 'none',
            outline: 'none',
            transform: camPressed ? 'scale(0.88)' : 'scale(1)',
            transition: 'transform 0.1s ease-out, background-color 0.2s, border-color 0.2s'
          }}
          title={cameraMode === 'overview' ? 'Vista de cerca: Seguir al tanque' : 'Vista general: Ver todo el mapa'}
        >
          {cameraMode === 'overview' ? '🎯' : '🗺️'}
          <span style={{ fontSize: '8px', fontWeight: '900', marginTop: '1px', letterSpacing: '0.5px' }}>
            {cameraMode === 'overview' ? 'TANQUE' : 'MAPA'}
          </span>
        </button>

        {/* Instant Responsive Mine Button (NO disabled attribute so taps are never ignored) */}
        <div
          data-ui-element="true"
          onTouchStart={handleMineTrigger}
          onMouseDown={handleMineTrigger}
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: mineReady ? '#d32f2f' : '#616161',
            border: '3px solid rgba(255, 255, 255, 0.9)',
            boxShadow: mineReady
              ? '0 6px 18px rgba(211,47,47,0.7), inset 0 2px 4px rgba(255,255,255,0.4)'
              : '0 2px 6px rgba(0,0,0,0.4)',
            color: '#fff',
            fontSize: '24px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'none',
            userSelect: 'none',
            transform: minePressed ? 'scale(0.88)' : 'scale(1)',
            transition: 'transform 0.1s ease-out, background-color 0.2s',
            opacity: mineReady ? 1.0 : 0.7
          }}
        >
          💣
          <span style={{ fontSize: '9px', fontWeight: '900', marginTop: '2px', letterSpacing: '0.5px' }}>
            {mineReady ? 'MINA' : 'RECARGA'}
          </span>
        </div>
      </div>

      {/* Aim & Shoot Virtual Crosshair Joystick (Only shoots when actively moving mira) */}
      <VirtualAimJoystick onAim={onAim} />
    </div>
  );
};

// --- Professional Tactical UI Components ---

const BIOMES_LIST = [
  { id: 'all', label: 'TODAS (48)', icon: '🗺️', color: '#38bdf8', accent: 'rgba(56, 189, 248, 0.18)' },
  { id: 'workshop', label: 'Taller (1-8)', icon: '🌲', range: [1, 8], color: '#fbbf24', accent: 'rgba(251, 191, 36, 0.16)' },
  { id: 'desert', label: 'Desierto (9-16)', icon: '🏜️', range: [9, 16], color: '#fb923c', accent: 'rgba(251, 146, 60, 0.16)' },
  { id: 'cyber', label: 'Cyber Matrix (17-24)', icon: '⚡', range: [17, 24], color: '#22d3ee', accent: 'rgba(34, 211, 238, 0.18)' },
  { id: 'arctic', label: 'Ártico (25-32)', icon: '❄️', range: [25, 32], color: '#38bdf8', accent: 'rgba(56, 189, 248, 0.18)' },
  { id: 'volcano', label: 'Volcán (33-40)', icon: '🌋', range: [33, 40], color: '#f87171', accent: 'rgba(248, 113, 113, 0.18)' },
  { id: 'jungle', label: 'Selva (41-48)', icon: '🌴', range: [41, 48], color: '#4ade80', accent: 'rgba(74, 222, 128, 0.18)' }
];

const TANK_SKINS_LIST = [
  { id: 'classic', name: 'Azul Comando', desc: 'Esmalte azul táctico clásico con franja blanca', color: '#0074D9', accent: '#38bdf8' },
  { id: 'gold', name: 'Oro Imperial', desc: 'Chasis bañado en oro de 24k de alto brillo', color: '#ffca28', accent: '#fde047' },
  { id: 'camo', name: 'Camuflaje Ranger', desc: 'Pintura militar verde oliva mate de operaciones', color: '#4b6043', accent: '#86efac' },
  { id: 'cyber', name: 'Cyber Matrix', desc: 'Aleación obsidiana con circuitos de neón cian', color: '#00e5ff', accent: '#22d3ee' },
  { id: 'crimson', name: 'Guardia Carmesí', desc: 'Blindaje pesado rojo imperial con núcleo ígneo', color: '#ef4444', accent: '#f87171' }
];

const TACTICAL_PERKS_LIST = [
  { id: 'ricochet', icon: '🎯', name: 'Cañón de Rebote +1', desc: '+1 rebote adicional en muros y +18% velocidad de proyectil', color: '#38bdf8' },
  { id: 'ordnance', icon: '💣', name: 'Ingeniero de Minas', desc: 'Recarga de minas 42% más rápida y +30% radio de explosión', color: '#f87171' },
  { id: 'overdrive', icon: '🚀', name: 'Turbina Overdrive', desc: '+20% velocidad punta del chasis y giro de orugas acelerado', color: '#4ade80' },
  { id: 'heavy_armor', icon: '🛡️', name: 'Blindaje Reactivo', desc: 'Inicia todas las misiones con 4 corazones de blindaje (❤️x4)', color: '#fbbf24' }
];

interface MainMenuProps {
  onStart: () => void;
  onLevelSelect: () => void;
  onOpenIntel: () => void;
  onOpenHangar: () => void;
  unlockedLevel: number;
  totalLevels: number;
  totalStars: number;
}

const MainMenu: React.FC<MainMenuProps> = ({
  onStart,
  onLevelSelect,
  onOpenIntel,
  onOpenHangar,
  unlockedLevel,
  totalLevels,
  totalStars
}) => {
  const currentMission = Math.min(unlockedLevel, totalLevels);
  const currentBiomeId = LevelLoader.getBiome(currentMission);
  const currentBiome = BIOMES_LIST.find(b => b.id === currentBiomeId) || BIOMES_LIST[1];
  const progressPct = Math.min(100, Math.round(((unlockedLevel - 1) / totalLevels) * 100));

  return (
    <div style={styles.overlay}>
      <div style={styles.menuBox}>
        {/* Top Tactical Header Badge */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
          <span style={styles.toyBadge}>EDICIÓN COMANDO TÁCTICO 3D</span>
          <span style={{
            backgroundColor: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid rgba(56, 189, 248, 0.45)',
            color: '#38bdf8',
            fontSize: '10px',
            fontWeight: 800,
            padding: '4px 10px',
            borderRadius: '6px',
            letterSpacing: '1px'
          }}>
            6 BIOMAS • 48 MISIONES
          </span>
          <span style={{
            backgroundColor: 'rgba(251, 191, 36, 0.16)',
            border: '1px solid rgba(251, 191, 36, 0.45)',
            color: '#fbbf24',
            fontSize: '10px',
            fontWeight: 900,
            padding: '4px 10px',
            borderRadius: '6px',
            letterSpacing: '0.8px'
          }}>
            ★ {totalStars} / {totalLevels * 3}
          </span>
        </div>

        <h1 style={styles.title}>TANKS ARENA 3D</h1>
        <p style={styles.subtitle}>
          Combate táctico de blindados con balística de rebote, demolición y física reactiva
        </p>

        {/* Active Operation Telemetry Card */}
        <div style={{
          backgroundColor: 'rgba(15, 23, 42, 0.78)',
          border: '1px solid rgba(148, 163, 184, 0.22)',
          borderRadius: '12px',
          padding: '14px 18px',
          marginBottom: '18px',
          textAlign: 'left'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1.2px' }}>
                OPERACIÓN ACTIVA EN CURSO
              </div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#f8fafc', marginTop: '2px', fontFamily: '"Chakra Petch", sans-serif' }}>
                MISIÓN #{currentMission}: {LevelLoader.getLevelName(currentMission).toUpperCase()}
              </div>
            </div>
            <div style={{
              backgroundColor: currentBiome.accent,
              border: `1px solid ${currentBiome.color}66`,
              color: currentBiome.color,
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 800
            }}>
              {currentBiome.icon} {currentBiome.label.split(' ')[0].toUpperCase()}
            </div>
          </div>

          {/* Campaign Progress Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
            <div style={{ flex: 1, height: '6px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.max(4, progressPct)}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)',
                borderRadius: '3px'
              }} />
            </div>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#fbbf24', fontVariantNumeric: 'tabular-nums' }}>
              {Math.min(unlockedLevel - 1, totalLevels)}/{totalLevels} COMPLETADAS
            </span>
          </div>
        </div>

        {/* Main CTA Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
          <button className="tactical-btn-primary" style={styles.primaryButton} onClick={onStart}>
            ▶ DESPLEGAR EN CAMPAÑA • MISIÓN #{currentMission}
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <button className="tactical-btn-secondary" style={styles.secondaryButton} onClick={onLevelSelect}>
              🗺️ MISIONES ({totalLevels})
            </button>
            <button
              className="tactical-btn-secondary"
              style={{
                ...styles.secondaryButton,
                borderColor: 'rgba(56, 189, 248, 0.45)',
                color: '#38bdf8'
              }}
              onClick={onOpenHangar}
            >
              🔧 HANGAR 3D
            </button>
            <button className="tactical-btn-secondary" style={styles.secondaryButton} onClick={onOpenIntel}>
              📖 MANUAL
            </button>
          </div>
        </div>

        {/* Sleek Control Briefing Footer */}
        <div style={styles.controlsInfoBox}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 800, color: '#fbbf24', fontSize: '11px', letterSpacing: '1px' }}>
              ⚡ ESQUEMA DE CONTROL RÁPIDO
            </span>
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>PC & TÁCTIL</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4px', fontSize: '11.5px', color: '#cbd5e1' }}>
            <div>💻 <strong style={{ color: '#f8fafc' }}>PC</strong>: <kbd style={styles.kbd}>WASD</kbd> Mover • <kbd style={styles.kbd}>Clic Izq</kbd> Fuego • <kbd style={styles.kbd}>Espacio</kbd> / <kbd style={styles.kbd}>E</kbd> / <kbd style={styles.kbd}>Clic Der</kbd> o botón HUD 💣 Mina</div>
            <div>🔍 <strong style={{ color: '#f8fafc' }}>Cámara 3D</strong>: Rueda del ratón o <kbd style={styles.kbd}>Z</kbd> / <kbd style={styles.kbd}>X</kbd> Zoom • <kbd style={styles.kbd}>C</kbd> Vista Cenital / Tanque</div>
            <div>📱 <strong style={{ color: '#f8fafc' }}>Móvil</strong>: Doble Joystick Táctico (Mover + Cruceta de Tiro Deliberado) • Botón Mina 💣</div>
          </div>
        </div>
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
    <div style={styles.overlay}>
      <div style={{
        ...styles.menuBox,
        maxWidth: '920px',
        maxHeight: 'calc(100vh - 36px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: '22px 26px'
      }}>
        {/* Header Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '14px',
          flexWrap: 'wrap',
          gap: '10px',
          flexShrink: 0
        }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: '#fbbf24', letterSpacing: '1.5px' }}>
              CENTRO DE OPERACIONES TÁCTICAS • ★ {totalStars}/{totalLevels * 3} ESTRELLAS
            </div>
            <h2 style={{ ...styles.title, fontSize: '23px', margin: '2px 0 0 0' }}>SELECCIONAR MISIÓN</h2>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
            <button
              onClick={onOpenHangar}
              style={{
                backgroundColor: 'rgba(56, 189, 248, 0.16)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.5)',
                height: '34px',
                padding: '0 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              🔧 HANGAR Y MEJORAS
            </button>
            <button
              onClick={onToggleUnlockAll}
              style={{
                backgroundColor: unlockAll ? 'rgba(34, 197, 94, 0.18)' : 'rgba(148, 163, 184, 0.14)',
                color: unlockAll ? '#4ade80' : '#cbd5e1',
                border: unlockAll ? '1px solid rgba(74, 222, 128, 0.5)' : '1px solid rgba(148, 163, 184, 0.3)',
                height: '34px',
                padding: '0 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {unlockAll ? '🔓 ACCESO TOTAL (48/48)' : '🔒 MODO PROGRESIÓN'}
            </button>
            <button
              className="tactical-btn-secondary"
              onClick={onBack}
              style={{
                ...styles.secondaryButton,
                width: 'auto',
                height: '34px',
                padding: '0 14px',
                fontSize: '11px',
                display: 'inline-flex',
                alignItems: 'center'
              }}
            >
              ✕ CERRAR
            </button>
          </div>
        </div>

        {/* Biome Filter Tabs (Wrapped cleanly with fixed height and flexShrink: 0) */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '7px',
          flexShrink: 0,
          paddingBottom: '12px',
          marginBottom: '12px',
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
                  gap: '6px',
                  height: '34px',
                  padding: '0 13px',
                  border: active ? `1.5px solid ${b.color}` : '1px solid rgba(148, 163, 184, 0.24)',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  lineHeight: 1,
                  cursor: 'pointer',
                  backgroundColor: active ? b.accent : 'rgba(15, 23, 42, 0.75)',
                  color: active ? b.color : '#cbd5e1',
                  boxShadow: active ? `0 0 14px ${b.accent}` : 'none',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{b.icon}</span>
                <span>{b.label}</span>
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

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '8px' }}>
                    <div style={{
                      fontSize: '9px',
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: '4px',
                      backgroundColor: isUnlocked ? biomeMeta.accent : 'rgba(255,255,255,0.03)',
                      color: isUnlocked ? biomeMeta.color : '#475569',
                      letterSpacing: '0.4px'
                    }}>
                      {biomeMeta.label.split(' ')[0].toUpperCase()}
                    </div>
                    {isBossLevel && (
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
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <button className="tactical-btn-secondary" style={{ ...styles.secondaryButton, marginTop: '14px', flexShrink: 0 }} onClick={onBack}>
          ← VOLVER AL CENTRO DE MANDO
        </button>
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
  mineReady?: boolean;
  mineCooldownProgress?: number;
  combo?: number;
  isMuted?: boolean;
  cameraMode?: 'overview' | 'follow';
  zoomLevel?: number;
  touchControlsEnabled?: boolean;
  isDying?: boolean;
  onMenu: () => void;
  onToggleMute: () => void;
  onPause: () => void;
  onToggleCamera: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleTouchControls: () => void;
  onMine: () => void;
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
  mineReady = true,
  mineCooldownProgress = 1.0,
  combo = 0,
  isMuted = false,
  cameraMode = 'overview',
  touchControlsEnabled = true,
  isDying = false,
  onMenu,
  onToggleMute,
  onPause,
  onToggleCamera,
  onZoomIn,
  onZoomOut,
  onToggleTouchControls,
  onMine
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

  return (
    <div style={{
      ...styles.hudContainer,
      opacity: isDying ? 0 : 1,
      transition: 'opacity 0.45s ease-out'
    }}>
      <div style={styles.hudTop}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={styles.hudPanel}>
            <button onClick={onPause} style={styles.hudButton} title="Pausar juego [Esc / P]">
              ⏸️
            </button>
          </div>
          <div style={styles.hudPanel}>
            <button onClick={onToggleMute} style={styles.hudButton} title="Silenciar / Activar sonido [M]">
              {isMuted ? '🔇' : '🔊'}
            </button>
          </div>

          {/* Dynamic Camera Mode & Zoom Controls */}
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

          {/* Touch Controls Toggle */}
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

          <div style={styles.hudPanel}>
            <button onClick={onMenu} style={styles.hudButton} title="Selector de Misiones">
              🗺️ MISIONES
            </button>
          </div>
        </div>

        {/* Central Level and Biome Badge (+ Boss Health Bar when active) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
          <div style={{ ...styles.hudPanel, flexDirection: 'column', alignItems: 'center', padding: '5px 18px' }}>
            <div style={{
              fontSize: '9.5px',
              color: biomeMeta?.color || '#fbbf24',
              letterSpacing: '1.2px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              {biomeMeta?.icon} {biomeMeta?.label.split(' ')[0].toUpperCase()}
            </div>
            <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#f8fafc', fontFamily: '"Chakra Petch", sans-serif' }}>
              MISIÓN <span style={styles.highlight}>#{mission}</span>
              {missionName ? ` • ${missionName.toUpperCase()}` : ''}
            </div>
          </div>

          {/* Punto 1: Boss Dreadnought Health Bar */}
          {bossInfo && bossInfo.hp > 0 && (
            <div style={{
              ...styles.hudPanel,
              flexDirection: 'column',
              alignItems: 'stretch',
              minWidth: '280px',
              padding: '7px 14px',
              borderColor: bossInfo.enraged ? '#ef4444' : '#f59e0b',
              backgroundColor: 'rgba(15, 23, 42, 0.92)',
              boxShadow: bossInfo.enraged ? '0 0 22px rgba(239, 68, 68, 0.5)' : '0 6px 18px rgba(0,0,0,0.45)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
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

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {combo >= 2 && (
            <div style={{
              ...styles.hudPanel,
              backgroundColor: 'rgba(234, 88, 12, 0.25)',
              borderColor: '#fb923c',
              color: '#fdba74',
              fontWeight: 900,
              fontSize: '13px',
              boxShadow: '0 0 16px rgba(249, 115, 22, 0.45)'
            }}>
              🔥 RACHA x{combo}
            </div>
          )}
          <div style={styles.hudPanel}>
            <span style={{ marginRight: '6px', fontSize: '11px', color: '#94a3b8', fontWeight: 800 }}>HOSTILES:</span>
            <span style={{ ...styles.highlight, fontSize: '18px', fontVariantNumeric: 'tabular-nums' }}>{enemiesLeft}</span>
            <span style={{ marginLeft: '5px', fontSize: '16px' }}>🎯</span>
          </div>
        </div>
      </div>

      <div style={styles.hudBottom}>
        <div style={styles.hudPanel}>
          <span style={{ marginRight: '8px', fontSize: '11px', color: '#94a3b8', fontWeight: 800 }}>BLINDAJE:</span>
          {hearts}
        </div>

        {/* Active Power-up Status Pill */}
        {activePowerup && (
          <div style={{
            ...styles.hudPanel,
            backgroundColor: 'rgba(245, 158, 11, 0.2)',
            borderColor: '#fbbf24',
            color: '#fde68a',
            fontSize: '12px',
            fontWeight: 800
          }}>
            {activePowerup}
          </div>
        )}

        {/* Clickable Mine Button for PC & Touch (Also triggered via Space / E / Right-Click) */}
        <button
          type="button"
          data-ui-element="true"
          onClick={(e) => {
            e.stopPropagation();
            onMine();
            e.currentTarget.blur();
          }}
          title="Desplegar Mina Terrestre [Espacio / Tecla E / Clic Derecho]"
          style={{
            ...styles.hudPanel,
            borderColor: mineReady ? 'rgba(74, 222, 128, 0.65)' : 'rgba(248, 113, 113, 0.45)',
            backgroundColor: mineReady ? 'rgba(20, 83, 45, 0.72)' : 'rgba(15, 23, 42, 0.86)',
            flexDirection: 'column',
            gap: '4px',
            minWidth: '175px',
            cursor: 'pointer',
            outline: 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', marginRight: '6px' }}>💣</span>
              <span style={{ fontSize: '11px', fontWeight: 900, color: mineReady ? '#4ade80' : '#f87171' }}>
                {mineReady ? 'PONER MINA' : 'RECARGANDO'}
              </span>
            </div>
            <span style={{
              fontSize: '9px',
              fontWeight: 800,
              padding: '1px 5px',
              borderRadius: '4px',
              backgroundColor: 'rgba(15, 23, 42, 0.8)',
              color: '#cbd5e1',
              border: '1px solid rgba(148, 163, 184, 0.3)'
            }}>
              ESPACIO / E
            </span>
          </div>
          <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.round((mineReady ? 1 : mineCooldownProgress) * 100)}%`,
              height: '100%',
              backgroundColor: mineReady ? '#4ade80' : '#f87171',
              transition: 'width 0.1s linear'
            }} />
          </div>
        </button>

        <div style={{ ...styles.hudPanel, fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 800 }}>PUNTOS</span>
          <span style={styles.highlight}>{score}</span>
        </div>
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
  onToggleCamera,
  cameraMode,
  touchControlsEnabled,
  onToggleTouchControls,
  mission,
  missionName
}) => (
  <div style={styles.overlay}>
    <div style={{ ...styles.menuBox, maxWidth: '460px' }}>
      <div style={styles.toyBadge}>SISTEMA EN PAUSA TÁCTICA</div>
      <h2 style={{ ...styles.title, fontSize: '26px' }}>OPERACIÓN DETENIDA</h2>
      <p style={styles.subtitle}>Misión #{mission} • {missionName || 'En curso'}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', width: '100%', marginTop: '14px' }}>
        <button className="tactical-btn-primary" style={styles.primaryButton} onClick={onResume}>
          ▶ REANUDAR COMBATE
        </button>
        <button className="tactical-btn-secondary" style={styles.secondaryButton} onClick={onRestart}>
          🔄 REINICIAR MISIÓN ACTUAL
        </button>
        <button className="tactical-btn-secondary" style={styles.secondaryButton} onClick={onToggleCamera}>
          🔍 CÁMARA: {cameraMode === 'overview' ? 'CAMBIAR A SEGUIR TANQUE' : 'CAMBIAR A VISTA GLOBAL'}
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px' }}>
          <button className="tactical-btn-secondary" style={styles.secondaryButton} onClick={onToggleTouchControls}>
            📱 TÁCTIL: {touchControlsEnabled ? 'ON' : 'OFF'}
          </button>
          <button className="tactical-btn-secondary" style={styles.secondaryButton} onClick={onToggleMute}>
            {isMuted ? '🔇 SONIDO: OFF' : '🔊 SONIDO: ON'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px', marginTop: '4px' }}>
          <button className="tactical-btn-secondary" style={styles.tertiaryButton} onClick={onSelectLevel}>
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
        maxWidth: '490px',
        borderColor: won ? 'rgba(74, 222, 128, 0.45)' : 'rgba(248, 113, 113, 0.45)',
        boxShadow: won
          ? '0 24px 60px rgba(0, 0, 0, 0.75), 0 0 40px rgba(34, 197, 94, 0.2)'
          : '0 24px 60px rgba(0, 0, 0, 0.85), 0 0 45px rgba(239, 68, 68, 0.25)',
        animation: 'defeatCardBlend 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards'
      }}>
        {/* Status Emblem */}
        <div style={{
          width: '68px',
          height: '68px',
          borderRadius: '50%',
          margin: '0 auto 12px auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '34px',
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
          fontSize: '28px',
          color: won ? '#4ade80' : '#f87171',
          marginTop: '6px'
        }}>
          {isCampaignComplete ? '¡CAMPAÑA CONQUISTADA!' : won ? '¡MISIÓN CUMPLIDA!' : 'TANQUE DESTRUIDO'}
        </h1>

        <p style={{ ...styles.subtitle, marginBottom: '12px' }}>
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

        {/* Battle Telemetry Report Card */}
        <div style={{
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '12px',
          padding: '14px 18px',
          marginBottom: '18px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          textAlign: 'left'
        }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', letterSpacing: '1px' }}>PUNTUACIÓN TÁCTICA</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#fbbf24', fontFamily: '"Chakra Petch", sans-serif', fontVariantNumeric: 'tabular-nums' }}>
              {score} PTS
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', letterSpacing: '1px' }}>SECTOR / BIOMA</div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: biomeMeta.color, marginTop: '4px' }}>
              {biomeMeta.icon} {biomeMeta.label.split(' ')[0].toUpperCase()}
            </div>
          </div>
        </div>

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
              🔄 REINTENTAR OPERACIÓN INMEDIATAMENTE
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
  onSelectSkin: (skinId: string) => void;
  onSelectPerk: (perkId: string) => void;
  onClose: () => void;
}

const HangarModal: React.FC<HangarModalProps> = ({
  selectedSkin,
  selectedPerk,
  onSelectSkin,
  onSelectPerk,
  onClose
}) => (
  <div style={styles.overlay}>
    <div style={{ ...styles.menuBox, maxWidth: '720px', maxHeight: '88vh', overflowY: 'auto', textAlign: 'left', padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(148, 163, 184, 0.22)', paddingBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 800, color: '#38bdf8', letterSpacing: '1.5px' }}>INGENIERÍA Y ARMAMENTO</div>
          <h2 style={{ ...styles.title, fontSize: '22px', margin: 0 }}>🔧 HANGAR DE PERSONALIZACIÓN 3D</h2>
        </div>
        <button className="tactical-btn-secondary" onClick={onClose} style={{ ...styles.secondaryButton, width: 'auto', padding: '6px 14px' }}>✕</button>
      </div>

      {/* Section 1: 3D Tank Chassis Skins */}
      <div style={{ marginTop: '14px' }}>
        <div style={{ fontSize: '12px', fontWeight: 800, color: '#fbbf24', letterSpacing: '0.8px', marginBottom: '8px' }}>
          🎨 1. PINTURA Y BLINDAJE DEL CHASIS 3D
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))', gap: '9px' }}>
          {TANK_SKINS_LIST.map(s => {
            const active = selectedSkin === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onSelectSkin(s.id)}
                style={{
                  backgroundColor: active ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.75)',
                  border: active ? `2px solid ${s.accent}` : '1px solid rgba(148, 163, 184, 0.22)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  boxShadow: active ? `0 0 16px ${s.accent}33` : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      backgroundColor: s.color,
                      border: '2px solid #fff',
                      display: 'inline-block'
                    }} />
                    <span style={{ fontSize: '12.5px', fontWeight: 800, color: active ? '#f8fafc' : '#cbd5e1' }}>
                      {s.name}
                    </span>
                  </div>
                  {active && <span style={{ fontSize: '10px', fontWeight: 900, color: s.accent }}>ACTIVO</span>}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.35 }}>{s.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 2: Tactical Combat Modules */}
      <div style={{ marginTop: '18px', marginBottom: '16px' }}>
        <div style={{ fontSize: '12px', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.8px', marginBottom: '8px' }}>
          ⚡ 2. MÓDULO TÁCTICO DE COMBATE (MEJORA ACTIVA)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '9px' }}>
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
      </div>

      <button className="tactical-btn-primary" style={styles.primaryButton} onClick={onClose}>
        ✓ GUARDAR EQUIPAMIENTO Y VOLVER
      </button>
    </div>
  </div>
);

interface IntelModalProps {
  onClose: () => void;
}

const IntelModal: React.FC<IntelModalProps> = ({ onClose }) => (
  <div style={styles.overlay}>
    <div style={{ ...styles.menuBox, maxWidth: '780px', maxHeight: '88vh', overflowY: 'auto', textAlign: 'left', padding: '26px 30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(148, 163, 184, 0.22)', paddingBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 800, color: '#fbbf24', letterSpacing: '1.5px' }}>DOSSIER DE INTELIGENCIA</div>
          <h2 style={{ ...styles.title, fontSize: '22px', margin: 0 }}>MANUAL TÁCTICO Y CONTROLES</h2>
        </div>
        <button className="tactical-btn-secondary" onClick={onClose} style={{ ...styles.secondaryButton, width: 'auto', padding: '6px 14px' }}>✕</button>
      </div>

      <div style={{ marginTop: '14px' }}>
        <h3 style={{ color: '#fbbf24', margin: '10px 0 6px 0', fontSize: '14px', letterSpacing: '0.8px' }}>📱 CONTROLES TÁCTILES EN MÓVIL ( ESTILO BRAWL STARS )</h3>
        <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(251, 191, 36, 0.35)', marginBottom: '14px' }}>
          <ul style={{ margin: '0 0 0 18px', padding: 0, color: '#cbd5e1', lineHeight: '1.6', fontSize: '12.5px' }}>
            <li><strong style={{ color: '#f8fafc' }}>Cruceta Derecha de Apuntado y Tiro</strong>: desliza la cruceta en 360° para orientar el láser; dispara únicamente cuando arrastras la mira fuera de la zona central.</li>
            <li><strong style={{ color: '#f8fafc' }}>Botón MINA 💣</strong>: despliega una mina terrestre con sensor de proximidad y temporizador de armado.</li>
            <li><strong style={{ color: '#f8fafc' }}>Cámara Dinámica</strong>: pulsa <code>MAPA / TANQUE</code> o pellizca con 2 dedos para hacer zoom entre la vista global y el seguimiento cercano.</li>
          </ul>
        </div>

        <h3 style={{ color: '#38bdf8', margin: '14px 0 6px 0', fontSize: '14px', letterSpacing: '0.8px' }}>💥 ELEMENTOS TÁCTICOS INTERACTIVOS</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', marginBottom: '14px' }}>
          <div style={{ ...styles.intelCard, borderLeft: '3px solid #ef4444' }}>
            <div style={{ fontWeight: 800, color: '#f87171', fontSize: '13px' }}>💥 Barril Explosivo TNT (B)</div>
            <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
              Detonación en área que pulveriza tanques y cajas de corcho y provoca reacciones en cadena.
            </div>
          </div>
          <div style={{ ...styles.intelCard, borderLeft: '3px solid #fbbf24' }}>
            <div style={{ fontWeight: 800, color: '#fbbf24', fontSize: '13px' }}>📦 Caja de Suministros (U)</div>
            <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
              Otorga Escudo de Plasma 🛡️, Ráfaga Rápida ⚡, Motor Turbo 🚀 o Blindaje Extra ❤️.
            </div>
          </div>
          <div style={{ ...styles.intelCard, borderLeft: '3px solid #4ade80' }}>
            <div style={{ fontWeight: 800, color: '#4ade80', fontSize: '13px' }}>🚀 Plataforma Aceleradora (A)</div>
            <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
              Impulsa el tanque a velocidad supersónica al pasar sobre sus chevrons luminosos.
            </div>
          </div>
          <div style={{ ...styles.intelCard, borderLeft: '3px solid #22d3ee' }}>
            <div style={{ fontWeight: 800, color: '#22d3ee', fontSize: '13px' }}>💎 Pilar Luminoso Reflector (M)</div>
            <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
              Refracta proyectiles e ilumina todo el escenario al ser impactado o tocado.
            </div>
          </div>
          <div style={{ ...styles.intelCard, borderLeft: '3px solid #e040fb' }}>
            <div style={{ fontWeight: 800, color: '#e040fb', fontSize: '13px' }}>🌀 Portal de Teletransporte (O)</div>
            <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
              Conecta dos puntos del mapa: teletransporta tanto tanques como proyectiles en pleno vuelo.
            </div>
          </div>
          <div style={{ ...styles.intelCard, borderLeft: '3px solid #ff1744' }}>
            <div style={{ fontWeight: 800, color: '#ff5252', fontSize: '13px' }}>⚡ Barrera e Interruptor Láser (G/K)</div>
            <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
              Dispara al cristal interruptor para desactivar o activar los campos de fuerza láser.
            </div>
          </div>
        </div>

        <h3 style={{ color: '#4ade80', margin: '14px 0 6px 0', fontSize: '14px', letterSpacing: '0.8px' }}>🌍 6 BIOMAS DE CAMPAÑA (48 MISIONES)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '8px', marginBottom: '14px' }}>
          <div style={styles.intelCard}>
            <span style={{ fontWeight: 800, color: '#fbbf24', fontSize: '12px' }}>🌲 1. Taller de Juguetes (M1-M8)</span>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Parqué de roble, puentes de piedra y estanque con peces Koi.</div>
          </div>
          <div style={styles.intelCard}>
            <span style={{ fontWeight: 800, color: '#fb923c', fontSize: '12px' }}>🏜️ 2. Desierto & Ruinas (M9-M16)</span>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Dunas doradas, sillares de terracota y oasis cristalinos.</div>
          </div>
          <div style={styles.intelCard}>
            <span style={{ fontWeight: 800, color: '#22d3ee', fontSize: '12px' }}>⚡ 3. Cyber Matrix Neón (M17-M24)</span>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Obsidiana digital, canales de datos cian y nodos láser.</div>
          </div>
          <div style={styles.intelCard}>
            <span style={{ fontWeight: 800, color: '#38bdf8', fontSize: '12px' }}>❄️ 4. Glaciar Ártico (M25-M32)</span>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Hielo alpino, fortalezas de zafiro glaciar y aguas árticas.</div>
          </div>
          <div style={styles.intelCard}>
            <span style={{ fontWeight: 800, color: '#f87171', fontSize: '12px' }}>🌋 5. Fundición Volcánica (M33-M40)</span>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Ríos de magma incandescente y bastiones de basalto.</div>
          </div>
          <div style={styles.intelCard}>
            <span style={{ fontWeight: 800, color: '#4ade80', fontSize: '12px' }}>🌴 6. Selva Esmeralda (M41-M48)</span>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Templos de jade y oro de El Dorado en la jungla amazónica.</div>
          </div>
        </div>
      </div>

      <button className="tactical-btn-primary" style={{ ...styles.primaryButton, marginTop: '10px' }} onClick={onClose}>
        ENTENDIDO • VOLVER AL MANDO
      </button>
    </div>
  </div>
);

// --- Main Application ---

export const App = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<'MENU' | 'LEVEL_SELECT' | 'PLAYING' | 'GAMEOVER' | 'PAUSED'>('MENU');
  const [showIntel, setShowIntel] = useState(false);
  const [showHangar, setShowHangar] = useState(false);
  const [unlockAll, setUnlockAll] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [cameraMode, setCameraMode] = useState<'overview' | 'follow'>('overview');
  const [isPlayerDying, setIsPlayerDying] = useState(false);

  // Player Hangar Loadout State
  const [playerSkin, setPlayerSkin] = useState<string>(() => {
    try { return localStorage.getItem('tanks_player_skin') || 'classic'; } catch { return 'classic'; }
  });
  const [playerPerk, setPlayerPerk] = useState<string>(() => {
    try { return localStorage.getItem('tanks_player_perk') || 'ricochet'; } catch { return 'ricochet'; }
  });

  // 3-Star Rating per mission persisted in localStorage
  const [missionStars, setMissionStars] = useState<Record<number, number>>(() => {
    try {
      const saved = localStorage.getItem('tanks_mission_stars');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [lastResultMeta, setLastResultMeta] = useState<{ starsEarned: number; elapsedSec: number; damageTaken: number }>({
    starsEarned: 0,
    elapsedSec: 0,
    damageTaken: 0
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
    won: false,
    mineReady: true,
    mineCooldownProgress: 1.0,
    combo: 0,
    isPaused: false,
    cameraMode: 'overview' as 'overview' | 'follow',
    zoomLevel: 0.9
  });

  const [powerupToast, setPowerupToast] = useState<{ text: string; color: string; id: number } | null>(null);
  const [damageFlash, setDamageFlash] = useState(false);
  const [hitMarker, setHitMarker] = useState<{ label: string; color: string; id: number } | null>(null);
  const [missionBanner, setMissionBanner] = useState<{ mission: number; name: string; biome: string } | null>(null);
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

  const handleGameEvent = useCallback((event: { type: string; data?: any }) => {
    if (event.type === 'STATS_UPDATE' && event.data) {
      setGameStats(prev => ({ ...prev, ...event.data }));
      if (event.data.cameraMode) {
        setCameraMode(event.data.cameraMode);
      }
    } else if (event.type === 'POWERUP_COLLECTED' && event.data) {
      const toastId = Date.now();
      const color = event.data.type === 'shield' ? '#00e5ff' : event.data.type === 'rapid' ? '#ffeb3b' : event.data.type === 'speed' ? '#00e676' : '#ff4081';
      setPowerupToast({ text: event.data.label || '¡MEJORA OBTENIDA!', color, id: toastId });
      setTimeout(() => {
        setPowerupToast(cur => cur?.id === toastId ? null : cur);
      }, 2600);
    } else if (event.type === 'SHIELD_BROKEN') {
      const toastId = Date.now();
      setPowerupToast({ text: '⚠️ ¡ESCUDO ROTO! (Absorbió el impacto)', color: '#ff5252', id: toastId });
      setTimeout(() => {
        setPowerupToast(cur => cur?.id === toastId ? null : cur);
      }, 2400);
    } else if (event.type === 'PLAYER_DAMAGED') {
      setDamageFlash(true);
      if ('vibrate' in navigator) {
        try { navigator.vibrate([50, 30, 60]); } catch (_) {}
      }
      setTimeout(() => setDamageFlash(false), 380);
    } else if (event.type === 'PLAYER_DYING') {
      // Begin spectacular death cinematic overlay that smoothly cross-fades into the Game Over menu
      setIsPlayerDying(true);
      setDamageFlash(true);
      if ('vibrate' in navigator) {
        try { navigator.vibrate([120, 40, 180, 40, 260]); } catch (_) {}
      }
      setTimeout(() => setDamageFlash(false), 550);
    } else if (event.type === 'ENEMY_DESTROYED' && event.data) {
      const hmId = Date.now();
      const { combo, points, method } = event.data;
      let label = `💥 ¡BLANCO ELIMINADO! +${points}`;
      let color = '#ffeb3b';
      if (method === 'RICOCHET') {
        label = `🎯 ¡TIRO DE REBOTE! +${points}`;
        color = '#00e5ff';
      } else if (combo >= 2) {
        label = `🔥 ¡RACHA x${combo}! +${points}`;
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
    } else if (event.type === 'GAME_OVER' && event.data) {
      setIsPlayerDying(false);
      setGameState('GAMEOVER');
      setGameStats(prev => ({ ...prev, won: event.data.won }));
      setLastResultMeta({
        starsEarned: event.data.starsEarned || 0,
        elapsedSec: event.data.elapsedSec || 0,
        damageTaken: event.data.damageTaken || 0
      });

      if (event.data.won) {
        const completedMission = event.data.mission || 1;
        const earned = event.data.starsEarned || 1;
        setUnlockedLevel(prev => Math.max(prev, completedMission + 1));
        setMissionStars(prev => {
          const updated = { ...prev, [completedMission]: Math.max(prev[completedMission] || 0, earned) };
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

  const handleSelectSkin = (skinId: string) => {
    setPlayerSkin(skinId);
    engineRef.current?.setPlayerLoadout(skinId, playerPerk);
  };

  const handleSelectPerk = (perkId: string) => {
    setPlayerPerk(perkId);
    engineRef.current?.setPlayerLoadout(playerSkin, perkId);
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
        if (gameState === 'PLAYING' && !isPlayerDying) {
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
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, toggleCamera, isPlayerDying]);

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
      setIsPlayerDying(false);
      engineRef.current.setJoystickInput(0, 0, false);
      engineRef.current.setAimStickInput(0, 0, false);
      engineRef.current.startAudio();
      engineRef.current.setPause(false);
      const biome = LevelLoader.getBiome(levelIndex);
      const missionName = LevelLoader.getLevelName(levelIndex);
      setGameStats(prev => ({
        ...prev,
        mission: levelIndex,
        missionName,
        biome,
        combo: 0,
        activePowerup: null
      }));
      engineRef.current.loadLevel(levelIndex);
      setGameState('PLAYING');
      setMissionBanner({ mission: levelIndex, name: missionName, biome });
      setTimeout(() => {
        setMissionBanner(cur => cur?.mission === levelIndex ? null : cur);
      }, 2100);
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
    setIsPlayerDying(false);
    if (engineRef.current) {
      engineRef.current.setPause(false);
      engineRef.current.cleanup();
      engineRef.current.decorateTable('workshop', 80, 80);
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
          onLevelSelect={() => setGameState('LEVEL_SELECT')}
          onOpenIntel={() => setShowIntel(true)}
          onOpenHangar={() => setShowHangar(true)}
          unlockedLevel={unlockedLevel}
          totalLevels={totalLevels}
          totalStars={totalStarsEarned}
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

          {/* Mission Start Tactical Banner */}
          {missionBanner && !isPlayerDying && (
            <div style={{
              position: 'absolute',
              top: '28%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 32,
              backgroundColor: 'rgba(15, 23, 42, 0.92)',
              border: '1px solid rgba(251, 191, 36, 0.6)',
              borderRadius: '14px',
              padding: '14px 34px',
              textAlign: 'center',
              pointerEvents: 'none',
              boxShadow: '0 18px 42px rgba(0,0,0,0.6), 0 0 24px rgba(251, 191, 36, 0.2)',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ color: '#fbbf24', fontSize: '10.5px', fontWeight: 800, letterSpacing: '2px' }}>
                DESPLIEGUE TÁCTICO • MISIÓN #{missionBanner.mission}
              </div>
              <div style={{ color: '#f8fafc', fontSize: '24px', fontWeight: 900, marginTop: '4px', fontFamily: '"Chakra Petch", sans-serif' }}>
                {missionBanner.name.toUpperCase()}
              </div>
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
            touchControlsEnabled={touchControlsEnabled}
            isDying={isPlayerDying}
            onMenu={() => setGameState('LEVEL_SELECT')}
            onToggleMute={toggleMute}
            onPause={pauseGame}
            onToggleCamera={toggleCamera}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onToggleTouchControls={() => setTouchControlsEnabled(prev => !prev)}
            onMine={() => engineRef.current?.triggerMine()}
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
              <div style={{ pointerEvents: 'auto' }}>
                <VirtualJoystick
                  onMove={(x, y, active) => {
                    if (engineRef.current) {
                      engineRef.current.setJoystickInput(x, y, active);
                    }
                  }}
                />
              </div>

              <div style={{ pointerEvents: 'auto' }}>
                <MobileControlsCluster
                  onAim={(x, y, active) => {
                    engineRef.current?.setAimStickInput(x, y, active);
                  }}
                  onQuickShoot={() => {
                    engineRef.current?.triggerAutoAimShoot();
                  }}
                  onMine={() => {
                    engineRef.current?.triggerMine();
                  }}
                  onToggleCamera={toggleCamera}
                  onZoomIn={zoomIn}
                  onZoomOut={zoomOut}
                  cameraMode={cameraMode}
                  mineReady={gameStats.mineReady}
                />
              </div>
            </div>
          )}
        </>
      )}

      {gameState === 'PAUSED' && (
        <PauseMenu
          onResume={resumeGame}
          onRestart={restartLevel}
          onSelectLevel={() => setGameState('LEVEL_SELECT')}
          onMenu={returnToMenu}
          isMuted={isMuted}
          onToggleMute={toggleMute}
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
          onNext={nextLevel}
          onRestart={restartLevel}
          onLevelSelect={() => setGameState('LEVEL_SELECT')}
          onMenu={returnToMenu}
        />
      )}

      {showIntel && <IntelModal onClose={() => setShowIntel(false)} />}
      {showHangar && (
        <HangarModal
          selectedSkin={playerSkin}
          selectedPerk={playerPerk}
          onSelectSkin={handleSelectSkin}
          onSelectPerk={handleSelectPerk}
          onClose={() => setShowHangar(false)}
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
    backgroundColor: 'rgba(15, 23, 42, 0.86)',
    backdropFilter: 'blur(8px)',
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
