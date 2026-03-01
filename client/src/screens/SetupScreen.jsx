import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useGameStore from '../store/gameStore';
import { createPRNG, shuffleArray } from '../utils/prng';

// Tiles lock randomly across LOCK_SPAN_MS then settle for SETTLE_MS.
// Total animation = exactly 10 seconds.
const LOCK_SPAN_MS = 13000;
const SETTLE_MS    = 2000;
const TOTAL_MS     = LOCK_SPAN_MS + SETTLE_MS; // 15 000 ms

export default function SetupScreen({ send }) {
  const {
    room, playerId,
    isSetupComplete, setIsSetupComplete,
    boardArrangement, setBoardArrangement,
  } = useGameStore();

  const n     = room?.boardSize ?? 5;
  const total = n * n;

  // displayOrder[gridPos] = tileIdx — which tile occupies each grid cell
  const [displayOrder, setDisplayOrder] = useState(() => [...Array(total).keys()]);
  // displayNums[tileIdx] = number currently shown by that tile (cycling or locked)
  const [displayNums,  setDisplayNums]  = useState(() => Array.from({ length: total }, (_, i) => i + 1));
  // lockedTiles[tileIdx] = true when the tile has settled to its final number & position
  const [lockedTiles,  setLockedTiles]  = useState(() => new Array(total).fill(false));

  const lockedRef = useRef([]);   // shared with setInterval — avoids stale closure
  const boardRef  = useRef(null); // final arrangement, shared with setInterval
  const orderRef  = useRef([]);   // mutable copy of displayOrder shared across timers

  // ── Single effect: generate board + run both animations ────────────────────
  // Empty dep array → runs once on mount; Strict Mode double-invoke is safe
  // because cleanup cancels all timers before the second run.
  useEffect(() => {
    if (isSetupComplete) return; // reconnect guard

    // 1. Generate the shuffled board arrangement
    const prng = createPRNG(Date.now());
    const arr  = shuffleArray(Array.from({ length: total }, (_, i) => i + 1), prng);
    boardRef.current = arr;
    setBoardArrangement(arr);

    // 2. Start tiles in a randomly shuffled grid order
    const initOrder = shuffleArray([...Array(total).keys()], createPRNG(Date.now() ^ 0x1234));
    orderRef.current = [...initOrder];
    setDisplayOrder([...initOrder]);

    // 3. Reset lock state
    const locked = new Array(total).fill(false);
    lockedRef.current = locked;
    setLockedTiles([...locked]);

    // ── Physical tile swaps (tiles move between grid cells) ─────────────────
    const swapInterval = setInterval(() => {
      const order = orderRef.current;
      // Collect positions of unlocked tiles
      const freePositions = order.reduce((acc, tileIdx, pos) => {
        if (!locked[tileIdx]) acc.push(pos);
        return acc;
      }, []);
      if (freePositions.length < 2) return;

      // Swap one pair per tick for a calmer shuffle
      const ai = Math.floor(Math.random() * freePositions.length);
      let   bi = Math.floor(Math.random() * (freePositions.length - 1));
      if (bi >= ai) bi++;
      const posA = freePositions[ai];
      const posB = freePositions[bi];
      [order[posA], order[posB]] = [order[posB], order[posA]];
      setDisplayOrder([...order]);
    }, 1000);

    // ── Number cycling (random values flicker in each unlocked tile) ─────────
    const cycleInterval = setInterval(() => {
      const finalArr = boardRef.current;
      setDisplayNums(
        Array.from({ length: total }, (_, tileIdx) =>
          locked[tileIdx]
            ? finalArr[tileIdx]
            : Math.floor(Math.random() * total) + 1
        )
      );
    }, 60);

    // ── Tiles lock in random order, each snapping to its final grid position ─
    const lockOrder = shuffleArray([...Array(total).keys()], createPRNG(Date.now() ^ 0xBEEF));
    const lockTimeouts = lockOrder.map((tileIdx, lockSeq) => {
      const lockTime = (lockSeq / Math.max(total - 1, 1)) * LOCK_SPAN_MS;
      return setTimeout(() => {
        const order = orderRef.current;
        // Move tileIdx to its natural final position (index === tileIdx)
        const currentPos  = order.indexOf(tileIdx);
        const occupierIdx = order[tileIdx]; // tile currently sitting at the target slot
        if (currentPos !== tileIdx) {
          order[currentPos] = occupierIdx;
          order[tileIdx]    = tileIdx;
          setDisplayOrder([...order]);
        }
        locked[tileIdx] = true;
        setLockedTiles(prev => {
          const next = [...prev];
          next[tileIdx] = true;
          return next;
        });
      }, lockTime);
    });

    // ── Mark complete after full 10 s ────────────────────────────────────────
    const doneTimer = setTimeout(() => {
      clearInterval(swapInterval);
      clearInterval(cycleInterval);
      setIsSetupComplete(true);
    }, TOTAL_MS);

    return () => {
      clearInterval(swapInterval);
      clearInterval(cycleInterval);
      lockTimeouts.forEach(clearTimeout);
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

      {/* Board — tiles physically move between cells via Framer Motion layout */}
      <div className="setup-board-wrap">
        <div className="bingo-board" style={{ '--board-n': n }}>
          {displayOrder.map((tileIdx) => (
            <motion.div
              key={tileIdx}
              layout
              className={`bingo-tile bingo-tile--setup${lockedTiles[tileIdx] ? ' bingo-tile--setup-locked' : ''}`}
              animate={lockedTiles[tileIdx] ? { scale: [1, 1.2, 1] } : {}}
              transition={{
                layout: { type: 'spring', stiffness: 110, damping: 20 },
                scale:  { duration: 0.28, ease: 'easeOut' },
              }}
            >
              {displayNums[tileIdx]}
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
