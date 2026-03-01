import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useGameStore from '../store/gameStore';
import { createPRNG, shuffleArray } from '../utils/prng';

// Tiles lock randomly across LOCK_SPAN_MS; last one gets SETTLE_MS to finish.
// Total visible animation = exactly 10 seconds.
const LOCK_SPAN_MS = 8800;
const SETTLE_MS    = 1200;
const TOTAL_MS     = LOCK_SPAN_MS + SETTLE_MS; // 10 000 ms

export default function SetupScreen({ send }) {
  const {
    room, playerId,
    isSetupComplete, setIsSetupComplete,
    boardArrangement, setBoardArrangement,
  } = useGameStore();

  const n     = room?.boardSize ?? 5;
  const total = n * n;

  const [displayNums, setDisplayNums] = useState(() =>
    Array.from({ length: total }, (_, i) => i + 1)
  );
  const [lockedTiles, setLockedTiles] = useState(() => new Array(total).fill(false));

  // Refs so the setInterval callback never has a stale closure
  const lockedRef  = useRef([]);
  const boardRef   = useRef(null);

  // ── Generate board + run shuffle animation ─────────────────────────────────
  // Empty dep array: runs once on mount (Strict Mode double-invoke is safe —
  // cleanup cancels the first run and the second run starts fresh).
  useEffect(() => {
    if (isSetupComplete) return; // already done (e.g. after reconnect)

    // 1. Shuffle numbers 1..n²
    const prng = createPRNG(Date.now());
    const arr  = shuffleArray(Array.from({ length: total }, (_, i) => i + 1), prng);
    boardRef.current = arr;
    setBoardArrangement(arr);

    // 2. Reset lock state
    const locked = new Array(total).fill(false);
    lockedRef.current = locked;
    setLockedTiles([...locked]);

    // 3. Tiles lock in a random order so the reveal looks like a real shuffle
    const lockOrder = shuffleArray(
      [...Array(total).keys()],
      createPRNG(Date.now() ^ 0xBEEF)
    );
    const timeouts = lockOrder.map((tileIdx, order) => {
      const lockTime = (order / Math.max(total - 1, 1)) * LOCK_SPAN_MS;
      return setTimeout(() => {
        locked[tileIdx] = true;
        setLockedTiles(prev => {
          const next = [...prev];
          next[tileIdx] = true;
          return next;
        });
      }, lockTime);
    });

    // 4. Cycle random numbers on every unlocked tile at 60 ms intervals
    const interval = setInterval(() => {
      const finalArr = boardRef.current;
      setDisplayNums(
        Array.from({ length: total }, (_, i) =>
          locked[i] ? finalArr[i] : Math.floor(Math.random() * total) + 1
        )
      );
    }, 60);

    // 5. Mark complete after the full 10 s animation
    const doneTimer = setTimeout(() => {
      clearInterval(interval);
      setIsSetupComplete(true);
    }, TOTAL_MS);

    return () => {
      timeouts.forEach(clearTimeout);
      clearInterval(interval);
      clearTimeout(doneTimer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submit once animation is done ─────────────────────────────────────────
  useEffect(() => {
    if (isSetupComplete && boardArrangement) {
      send('SUBMIT_BOARD', { arrangement: boardArrangement });
    }
  }, [isSetupComplete, boardArrangement, send]);

  return (
    <div className="screen setup-screen">
      {/* Status label */}
      <AnimatePresence mode="wait">
        {!isSetupComplete ? (
          <motion.p
            key="shuffling"
            className="setup-shuffling-label"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            🎲 Shuffling your board…
          </motion.p>
        ) : (
          <motion.p
            key="ready"
            className="ready-msg"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            ✨ Board ready! Waiting for others…
          </motion.p>
        )}
      </AnimatePresence>

      {/* Board with cycling numbers */}
      <div className="setup-board-wrap">
        <div className="bingo-board" style={{ '--board-n': n }}>
          {displayNums.slice(0, total).map((num, i) => (
            <motion.div
              key={i}
              className={`bingo-tile bingo-tile--setup${lockedTiles[i] ? ' bingo-tile--setup-locked' : ''}`}
              animate={lockedTiles[i] ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              {num}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Player readiness */}
      <div className="setup-players">
        {room?.players.map((p) => (
          <div key={p.id} className={`setup-player${p.ready ? ' setup-player--ready' : ''}`}>
            <span>{p.name}{p.id === playerId ? ' (you)' : ''}</span>
            <span>{p.ready ? '✅ Ready' : '⏳ Shuffling'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
