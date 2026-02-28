import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassPanel from '../components/ui/GlassPanel';
import Button from '../components/ui/Button';
import NumberDeck from '../components/NumberDeck';
import useGameStore from '../store/gameStore';
import { createPRNG, shuffleArray } from '../utils/prng';
import { audioEngine } from '../audio/audioEngine';

const SETUP_SECS = 60;

export default function SetupScreen({ send }) {
  const {
    room, playerId,
    setupMode, setSetupMode,
    setupDeadlineMs,
    boardArrangement, setBoardArrangement,
    isSetupComplete, setIsSetupComplete,
  } = useGameStore();

  const n     = room?.boardSize ?? 5;
  const total = n * n;

  // ── Timer ──────────────────────────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = useState(SETUP_SECS);
  useEffect(() => {
    if (!setupDeadlineMs) return;
    const tick = () => setTimeLeft(Math.max(0, Math.ceil((setupDeadlineMs - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [setupDeadlineMs]);

  // ── Auto-Assign ──────────────────────────────────────────────────────────
  const [animPhase, setAnimPhase] = useState('idle'); // 'scatter' | 'fly' | 'done'
  const [scattered, setScattered] = useState([]);     // random offsets per card

  const handleAutoAssign = useCallback(() => {
    audioEngine.playClick();
    const prng    = createPRNG(Date.now());
    const arr     = shuffleArray(Array.from({ length: total }, (_, i) => i + 1), prng);
    const offsets = arr.map(() => ({
      x: (Math.random() - 0.5) * 220,
      y: (Math.random() - 0.5) * 180,
      r: (Math.random() - 0.5) * 55,
    }));
    setBoardArrangement(arr);
    setScattered(offsets);
    setSetupMode('auto');
    setAnimPhase('scatter');

    setTimeout(() => setAnimPhase('fly'), 380);
    setTimeout(() => {
      setAnimPhase('done');
      setIsSetupComplete(true);
    }, 380 + total * 45 + 700);
  }, [total, setBoardArrangement, setSetupMode, setIsSetupComplete]);

  // ── Manual Placement ──────────────────────────────────────────────────────
  const [placed, setPlaced] = useState({});  // cellIndex -> number
  const allNumbers = Array.from({ length: total }, (_, i) => i + 1);
  const deck       = allNumbers.filter((n) => !Object.values(placed).includes(n));
  const manualDone = Object.keys(placed).length === total;

  const handlePlace = useCallback((number, cellIdx) => {
    setPlaced((prev) => {
      const next = { ...prev };
      // If cell already occupied, send displaced number back to deck
      // (just overwrite — displaced card returns automatically since it's missing from placed)
      next[cellIdx] = number;
      return next;
    });
  }, []);

  const handleManualReady = () => {
    const arr = Array.from({ length: total }, (_, i) => placed[i] ?? 0);
    if (arr.some((v) => v === 0)) return;
    setBoardArrangement(arr);
    setIsSetupComplete(true);
    send('SUBMIT_BOARD', { arrangement: arr });
    audioEngine.playClick();
  };

  // ── Auto-submit when auto done ─────────────────────────────────────────────
  useEffect(() => {
    if (setupMode === 'auto' && isSetupComplete && boardArrangement) {
      send('SUBMIT_BOARD', { arrangement: boardArrangement });
    }
  }, [isSetupComplete, setupMode, boardArrangement, send]);

  const urgentTimer = timeLeft <= 10 && timeLeft > 0;

  // ── Board cell component for setup ───────────────────────────────────────
  const renderSetupBoard = () => {
    if (setupMode === 'auto' && boardArrangement) {
      return (
        <div className="bingo-board" style={{ '--board-n': n }}>
          {boardArrangement.map((num, i) => {
            const offset = scattered[i] ?? { x: 0, y: 0, r: 0 };
            const isFlying = animPhase === 'fly' || animPhase === 'done';
            return (
              <motion.div
                key={i}
                className="bingo-tile bingo-tile--setup"
                initial={false}
                animate={
                  animPhase === 'scatter'
                    ? { x: offset.x, y: offset.y, rotate: offset.r, opacity: 1, scale: 0.85 }
                    : { x: 0, y: 0, rotate: 0, opacity: 1, scale: 1 }
                }
                transition={{
                  delay: isFlying ? i * 0.042 : 0,
                  type: 'spring',
                  stiffness: 200,
                  damping: 20,
                }}
              >
                {num}
              </motion.div>
            );
          })}
        </div>
      );
    }

    if (setupMode === 'manual') {
      return (
        <div className="bingo-board" style={{ '--board-n': n }}>
          {Array.from({ length: total }, (_, i) => (
            <motion.div
              key={i}
              className={`bingo-tile bingo-tile--setup bingo-tile--drop-zone ${
                placed[i] ? 'bingo-tile--placed' : ''
              }`}
              data-cell-index={i}
              whileHover={{ scale: 1.04 }}
            >
              {placed[i] ?? ''}
            </motion.div>
          ))}
        </div>
      );
    }

    return (
      <div className="bingo-board bingo-board--empty" style={{ '--board-n': n }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className="bingo-tile bingo-tile--empty" />
        ))}
      </div>
    );
  };

  return (
    <div className="screen setup-screen">
      <GlassPanel className="setup-panel">
        {/* Header */}
        <div className="setup-header">
          <h2 className="setup-title">Set Up Your Board</h2>
          <motion.div
            className={`setup-timer ${urgentTimer ? 'setup-timer--urgent' : ''}`}
            animate={urgentTimer ? { scale: [1, 1.12, 1] } : {}}
            transition={{ repeat: Infinity, duration: 0.7 }}
          >
            ⏱ {timeLeft}s
          </motion.div>
        </div>

        {/* Mode selection */}
        <AnimatePresence>
          {!setupMode && (
            <motion.div
              className="mode-choices"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
            >
              <motion.button
                className="mode-card"
                onClick={handleAutoAssign}
                whileHover={{ scale: 1.04, y: -4 }}
                whileTap={{ scale: 0.96 }}
              >
                <span className="mode-icon">🎲</span>
                <span className="mode-name">Auto-Assign</span>
                <span className="mode-desc">Shuffle & place for me</span>
              </motion.button>

              <motion.button
                className="mode-card"
                onClick={() => { audioEngine.playClick(); setSetupMode('manual'); }}
                whileHover={{ scale: 1.04, y: -4 }}
                whileTap={{ scale: 0.96 }}
              >
                <span className="mode-icon">✋</span>
                <span className="mode-name">Manual Placement</span>
                <span className="mode-desc">Drag & drop your numbers</span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Board */}
        <div className="setup-board-wrap">{renderSetupBoard()}</div>

        {/* Manual deck */}
        {setupMode === 'manual' && !isSetupComplete && (
          <NumberDeck deck={deck} onPlace={handlePlace} />
        )}

        {/* Ready button */}
        <AnimatePresence>
          {isSetupComplete && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <p className="ready-msg">✨ Board ready! Waiting for others…</p>
            </motion.div>
          )}
          {setupMode === 'manual' && !isSetupComplete && manualDone && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Button variant="primary" style={{ width: '100%' }} onClick={handleManualReady}>
                ✅ I'm Ready!
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Player readiness */}
        <div className="setup-players">
          {room?.players.map((p) => (
            <div key={p.id} className={`setup-player ${p.ready ? 'setup-player--ready' : ''}`}>
              <span>{p.name}</span>
              <span>{p.ready ? '✅' : '⏳'}</span>
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}
