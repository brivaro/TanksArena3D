
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GameEngine } from './game/core/GameEngine.js';
import { LevelLoader } from './game/world/LevelLoader.js';

// --- CONFIGURATION ---
// CHANGE THIS TO TRUE TO UNLOCK ALL LEVELS INSTANTLY
const UNLOCK_ALL_LEVELS = true; 

// --- UI Components ---

const MainMenu = ({ onStart, onLevelSelect }) => (
  <div style={styles.overlay}>
    <div style={styles.menuBox}>
      <h1 style={styles.title}>TANKS ARENA 3D</h1>
      <p style={styles.subtitle}>Toy Box Edition</p>
      <button style={styles.button} onClick={onStart}>PLAY CAMPAIGN</button>
      <div style={{height: '15px'}}></div>
      <button style={{...styles.button, backgroundColor: '#8d6e63', color: '#fff'}} onClick={onLevelSelect}>SELECT LEVEL</button>
      <div style={styles.controls}>
        <p>WASD to Move • MOUSE to Aim • CLICK to Fire</p>
        <p>SPACE to Drop Mine</p>
      </div>
    </div>
  </div>
);

const LevelSelect = ({ unlocked, onSelectLevel, onBack }) => {
  const totalLevels = LevelLoader.getLevelCount();
  const levels = Array.from({ length: totalLevels }, (_, i) => i + 1);

  return (
    <div style={styles.overlay}>
      <div style={{...styles.menuBox, maxWidth: '600px'}}>
        <h2 style={styles.title}>SELECT MISSION</h2>
        <div style={styles.levelGrid}>
            {levels.map(lvl => {
                // Logic: If UNLOCK_ALL_LEVELS is true, everything is clickable.
                // Otherwise, check unlocked progress.
                const isUnlocked = UNLOCK_ALL_LEVELS || lvl <= unlocked;
                const isCompleted = !UNLOCK_ALL_LEVELS && lvl < unlocked;
                
                return (
                    <button 
                        key={lvl}
                        disabled={!isUnlocked}
                        onClick={() => onSelectLevel(lvl)}
                        style={{
                            ...styles.levelBtn,
                            backgroundColor: isCompleted ? '#4CAF50' : (isUnlocked ? '#ffca28' : '#ccc'),
                            color: isUnlocked ? '#3e2723' : '#888',
                            cursor: isUnlocked ? 'pointer' : 'not-allowed',
                            boxShadow: isUnlocked ? '0 4px 0 rgba(0,0,0,0.2)' : 'none',
                            transform: isUnlocked ? 'translateY(0)' : 'translateY(2px)'
                        }}
                    >
                        {lvl}
                    </button>
                );
            })}
        </div>
        <button style={{...styles.button, marginTop: '20px', fontSize: '14px'}} onClick={onBack}>BACK TO MENU</button>
      </div>
    </div>
  );
};

const HeartIcon = () => (
  <span style={{ color: '#e53935', fontSize: '24px', margin: '0 2px' }}>
    ❤️
  </span>
);

const HUD = ({ score, lives, enemiesLeft, mission, onMenu }) => {
  const hearts = Array.from({ length: Math.max(0, lives) }, (_, i) => <HeartIcon key={i} />);

  return (
    <div style={styles.hudContainer}>
      <div style={styles.hudTop}>
        <div style={{...styles.hudPanel, padding: '5px 15px'}}>
            <button onClick={onMenu} style={styles.smallBtn}>☰ MENU</button>
        </div>
        <div style={styles.hudPanel}>MISSION <span style={styles.highlight}>{mission}</span></div>
        <div style={styles.hudPanel}>ENEMIES <span style={styles.highlight}>{enemiesLeft}</span></div>
      </div>
      <div style={styles.hudBottom}>
        <div style={styles.hudPanel}>
          {hearts}
        </div>
        <div style={styles.hudPanel}>SCORE <span style={styles.highlight}>{score}</span></div>
      </div>
    </div>
  );
};

const GameOverScreen = ({ won, onNext, onRestart, onMenu, mission }) => (
  <div style={styles.overlay}>
    <div style={styles.menuBox}>
      <h1 style={{...styles.title, color: won ? '#4CAF50' : '#F44336'}}>
        {won ? 'MISSION COMPLETE!' : 'GAME OVER'}
      </h1>
      {won ? (
         <button style={styles.button} onClick={onNext}>NEXT MISSION</button>
      ) : (
         <button style={styles.button} onClick={onRestart}>TRY AGAIN</button>
      )}
      <div style={{height: '10px'}}></div>
      <button style={{...styles.button, backgroundColor: '#d7ccc8', fontSize: '14px'}} onClick={onMenu}>MAIN MENU</button>
    </div>
  </div>
);

// --- Main Application ---

const App = () => {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [gameState, setGameState] = useState('MENU'); // MENU, LEVEL_SELECT, PLAYING, GAMEOVER
  const [gameStats, setGameStats] = useState({ score: 0, lives: 3, enemiesLeft: 0, mission: 1, won: false });
  
  // Load unlocked level from localStorage
  const [unlockedLevel, setUnlockedLevel] = useState(() => {
      try {
          const saved = localStorage.getItem('tanks_unlocked_level');
          return saved ? parseInt(saved, 10) : 1;
      } catch (e) { return 1; }
  });

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
  }, []);

  // Persist unlocked level
  useEffect(() => {
      localStorage.setItem('tanks_unlocked_level', unlockedLevel.toString());
  }, [unlockedLevel]);

  const handleGameEvent = (event) => {
    if (event.type === 'STATS_UPDATE') {
      setGameStats(prev => ({ ...prev, ...event.data }));
    } else if (event.type === 'GAME_OVER') {
      setGameState('GAMEOVER');
      setGameStats(prev => ({ ...prev, won: event.data.won }));
      
      if (event.data.won) {
          // Retrieve the mission number directly from the event data to be safe
          const completedMission = event.data.mission || gameStats.mission;
          setUnlockedLevel(prev => Math.max(prev, completedMission + 1));
      }
    }
  };

  const startCampaign = () => {
    // Resume from highest unlocked or 1
    startGame(unlockedLevel);
  };

  const startGame = (levelIndex) => {
    if (engineRef.current) {
      // Init Audio Context on user interaction
      engineRef.current.startAudio();

      setGameStats(prev => ({...prev, mission: levelIndex}));
      engineRef.current.loadLevel(levelIndex);
      setGameState('PLAYING');
    }
  };

  const nextLevel = () => {
      if (engineRef.current) {
          const nextMission = gameStats.mission + 1;
          setGameStats(prev => ({...prev, mission: nextMission}));
          engineRef.current.loadLevel(nextMission);
          setGameState('PLAYING');
      }
  }

  const restartLevel = () => {
      if (engineRef.current) {
          engineRef.current.loadLevel(gameStats.mission);
          setGameState('PLAYING');
      }
  }

  const returnToMenu = () => {
      setGameState('LEVEL_SELECT');
  }

  return (
    <>
      <canvas ref={canvasRef} style={{ width: '100vw', height: '100vh', cursor: 'none' }} />

      {gameState === 'MENU' && (
          <MainMenu 
            onStart={startCampaign} 
            onLevelSelect={() => setGameState('LEVEL_SELECT')} 
          />
      )}
      
      {gameState === 'LEVEL_SELECT' && (
          <LevelSelect 
            unlocked={unlockedLevel} 
            onSelectLevel={startGame}
            onBack={() => setGameState('MENU')}
          />
      )}

      {gameState === 'PLAYING' && (
          <HUD 
            {...gameStats} 
            onMenu={returnToMenu} 
          />
      )}
      
      {gameState === 'GAMEOVER' && (
          <GameOverScreen 
            won={gameStats.won} 
            mission={gameStats.mission}
            onNext={nextLevel} 
            onRestart={restartLevel}
            onMenu={() => setGameState('MENU')} 
          />
      )}
    </>
  );
};

// --- Styles ---

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', pointerEvents: 'auto',
    cursor: 'default'
  },
  menuBox: {
    backgroundColor: '#f0e6d2', padding: '40px', borderRadius: '10px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.3)', textAlign: 'center',
    border: '4px solid #8d6e63', minWidth: '300px'
  },
  title: {
    fontFamily: 'Arial Black, sans-serif', fontSize: '32px', color: '#3e2723',
    margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '-1px'
  },
  subtitle: {
    color: '#795548', margin: '0 0 30px 0', fontWeight: 'bold'
  },
  button: {
    backgroundColor: '#ffca28', border: 'none', padding: '15px 30px',
    fontSize: '18px', fontWeight: 'bold', color: '#3e2723', borderRadius: '5px',
    cursor: 'pointer', boxShadow: '0 4px 0 rgba(0,0,0,0.2)', transition: 'transform 0.1s',
    outline: 'none', width: '100%'
  },
  smallBtn: {
    backgroundColor: 'transparent', border: 'none',
    fontSize: '16px', fontWeight: 'bold', color: '#5d4037',
    cursor: 'pointer', outline: 'none'
  },
  levelGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: '10px',
      marginBottom: '20px'
  },
  levelBtn: {
      padding: '15px',
      border: 'none',
      borderRadius: '5px',
      fontWeight: 'bold',
      fontSize: '16px',
      outline: 'none'
  },
  controls: {
    marginTop: '20px', fontSize: '12px', color: '#8d6e63'
  },
  hudContainer: {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
    pointerEvents: 'none', padding: '20px', boxSizing: 'border-box',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
  },
  hudTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  hudBottom: { display: 'flex', justifyContent: 'space-between' },
  hudPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)', padding: '10px 20px',
    borderRadius: '20px', border: '2px solid #8d6e63',
    fontWeight: 'bold', color: '#5d4037', fontFamily: 'monospace', fontSize: '16px',
    display: 'flex', alignItems: 'center', pointerEvents: 'auto'
  },
  highlight: { color: '#d84315', fontSize: '18px', marginLeft: '5px' }
};

const root = createRoot(document.getElementById('root'));
root.render(<App />);
