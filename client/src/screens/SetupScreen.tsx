import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useGameStore from '../store/gameStore';
import { createPRNG, shuffleArray } from '../utils/prng';
import type { SendFn } from '../types';

const LOCK_SPAN_MS = 13000;
const SETTLE_MS    = 2000;
const TOTAL_MS     = LOCK_SPAN_MS + SETTLE_MS;

export default function SetupScreen({ send }: { send: SendFn }) {
  const {
    room, playerId,
    isSetupComplete, setIsSetupComplete,
    boardArrangement, setBoardArrangement,
  } = useGameStore();

  const n     = room?.boardSize ?? 5;
  const total = n * n;

  const [displayOrder, setDisplayOrder] = useState<number[]>(() => [...Array(total).keys()]);
  const [displayNums,  setDisplayNums]  = useState<number[]>(() => Array.from({ length: total }, (_, i) => i + 1));
  const [lockedTiles,  setLockedTiles]  = useState<boolean[]>(() => Array.from({ length: total }, () => false));

  const lockedRef = useRef<boolean[]>([]);
  const boardRef  = useRef<number[] | null>(null);
  const orderRef  = useRef<number[]>([]);

  useEffect(() => {
    if (isSetupComplete) return;

    const prng = createPRNG(Date.now());
    const arr  = shuffleArray(Array.from({ length: total }, (_, i) => i + 1), prng);
    boardRef.current = arr;
    setBoardArrangement(arr);

    const initOrder = shuffleArray([...Array(total).keys()], createPRNG(Date.now() ^ 0x1234));
    orderRef.current = [...initOrder];
    setDisplayOrder([...initOrder]);

    const locked: boolean[] = Array.from({ length: total }, () => false);
    lockedRef.current = locked;
    setLockedTiles([...locked]);

    const swapInterval = setInterval(() => {
      const order = orderRef.current;
      const freePositions = order.reduce<number[]>((acc, tileIdx, pos) => {
        if (!locked[tileIdx]) acc.push(pos);
        return acc;
      }, []);
      if (freePositions.length < 2) return;

      const ai = Math.floor(Math.random() * freePositions.length);
      let   bi = Math.floor(Math.random() * (freePositions.length - 1));
      if (bi >= ai) bi++;
      const posA = freePositions[ai];
      const posB = freePositions[bi];
      [order[posA], order[posB]] = [order[posB], order[posA]];
      setDisplayOrder([...order]);
    }, 1000);

    const cycleInterval = setInterval(() => {
      const finalArr = boardRef.current!;
      setDisplayNums(
        Array.from({ length: total }, (_, tileIdx) =>
          locked[tileIdx]
            ? finalArr[tileIdx]
            : Math.floor(Math.random() * total) + 1
        )
      );
    }, 60);

    const lockOrder = shuffleArray([...Array(total).keys()], createPRNG(Date.now() ^ 0xBEEF));
    const lockTimeouts = lockOrder.map((tileIdx, lockSeq) => {
      const lockTime = (lockSeq / Math.max(total - 1, 1)) * LOCK_SPAN_MS;
      return setTimeout(() => {
        const order = orderRef.current;
        const currentPos  = order.indexOf(tileIdx);
        const occupierIdx = order[tileIdx];
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

  useEffect(() => {
    if (isSetupComplete && boardArrangement) {
      send('SUBMIT_BOARD', { arrangement: boardArrangement });
    }
  }, [isSetupComplete, boardArrangement, send]);

  return (
    <div className="screen setup-screen">
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

      <div className="setup-board-wrap">
        <div className="bingo-board" style={{ '--board-n': n } as React.CSSProperties}>
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
