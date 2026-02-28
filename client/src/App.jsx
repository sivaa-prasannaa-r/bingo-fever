import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { audioEngine } from './audio/audioEngine';
import { useWebSocket } from './hooks/useWebSocket';
import useGameStore from './store/gameStore';

import LobbyScreen   from './screens/LobbyScreen';
import RoomScreen     from './screens/RoomScreen';
import SetupScreen    from './screens/SetupScreen';
import GameScreen     from './screens/GameScreen';
import VictoryScreen  from './screens/VictoryScreen';

import VolumeControl    from './components/VolumeControl';
import ConnectionStatus from './components/ConnectionStatus';

const SCREENS = {
  LOBBY:   LobbyScreen,
  ROOM:    RoomScreen,
  SETUP:   SetupScreen,
  GAME:    GameScreen,
  VICTORY: VictoryScreen,
};

// CSS transitions handle gradient interpolation — Framer Motion cannot interpolate gradients
// All gradients use rich/saturated mid-tones — light pastels avoided so white text stays readable
const GRADIENTS = {
  LOBBY:   'linear-gradient(135deg,#C1185A 0%,#7B1FA2 40%,#00796B 100%)',
  ROOM:    'linear-gradient(135deg,#E64A19 0%,#F9A825 50%,#00838F 100%)',
  SETUP:   'linear-gradient(135deg,#00695C 0%,#6A1B9A 55%,#AD1457 100%)',
  GAME:    'linear-gradient(135deg,#283593 0%,#6A1B9A 45%,#00838F 100%)',
  VICTORY: 'linear-gradient(135deg,#F57F17 0%,#AD1457 40%,#4527A0 75%,#006064 100%)',
};

const INTENSITY = { LOBBY: 1, ROOM: 1.1, SETUP: 1.3, GAME: 1.6, VICTORY: 2.8 };

export default function App() {
  const screen     = useGameStore((s) => s.screen);
  const canvasRef  = useRef(null);
  const psRef      = useRef(null);
  const audioReady = useRef(false);

  const { send } = useWebSocket();

  // ── Particle system (optional — does not block render) ────────────────────
  useEffect(() => {
    let ps;
    let cancelled = false;

    async function start() {
      try {
        const { ParticleSystem } = await import('./pixi/ParticleSystem');
        if (cancelled || !canvasRef.current) return;
        ps = new ParticleSystem(canvasRef.current);
        await ps.init();
        if (cancelled) { ps.destroy(); return; }
        psRef.current = ps;
      } catch (err) {
        console.warn('[Particles] PixiJS init failed (continuing without particles):', err);
      }
    }

    start();
    return () => {
      cancelled = true;
      ps?.destroy();
      psRef.current = null;
    };
  }, []);

  // ── Particle intensity per screen ─────────────────────────────────────────
  useEffect(() => {
    psRef.current?.setIntensity(INTENSITY[screen] ?? 1);
    if (screen === 'VICTORY') {
      setTimeout(() => psRef.current?.spawnConfetti(220), 300);
    }
  }, [screen]);

  // ── Audio — init on first user gesture ───────────────────────────────────
  const initAudio = () => {
    if (audioReady.current) return;
    audioReady.current = true;
    audioEngine.init().catch(() => {});
  };

  const CurrentScreen = SCREENS[screen] ?? LobbyScreen;

  return (
    <div className="app" onClick={initAudio} onTouchStart={initAudio}>
      {/* PixiJS WebGL canvas */}
      <canvas ref={canvasRef} className="particle-canvas" />

      {/* Gradient background — CSS transition, not Framer Motion (gradients can't be interpolated) */}
      <div
        className="bg-gradient"
        style={{ backgroundImage: GRADIENTS[screen] }}
      />

      {/* Screen crossfade + scale transition */}
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          className="screen-wrapper"
          initial={{ opacity: 0, scale: 0.95, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.04, y: -18 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          <CurrentScreen send={send} />
        </motion.div>
      </AnimatePresence>

      <ConnectionStatus />
      <VolumeControl />
    </div>
  );
}
