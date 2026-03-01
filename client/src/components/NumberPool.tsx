import { motion } from 'framer-motion';
import useGameStore from '../store/gameStore';
import { audioEngine } from '../audio/audioEngine';
import type { SendFn } from '../types';

export default function NumberPool({ send }: { send: SendFn }) {
  const { room, playerId, currentTurn, calledNumbers } = useGameStore();
  const n = room?.boardSize ?? 5;
  const total = n * n;
  const allNumbers = Array.from({ length: total }, (_, i) => i + 1);
  const calledSet = new Set(calledNumbers);
  const isMyTurn = currentTurn === playerId;
  const currentPlayer = room?.players?.find((p) => p.id === currentTurn);

  const handlePick = (number: number) => {
    if (!isMyTurn || calledSet.has(number)) return;
    audioEngine.playClick();
    send('CALL_NUMBER', { number });
  };

  return (
    <div className="number-pool-wrap">
      <motion.div
        className={`turn-banner ${isMyTurn ? 'turn-banner--mine' : ''}`}
        animate={isMyTurn ? { scale: [1, 1.03, 1] } : {}}
        transition={{ repeat: isMyTurn ? Infinity : 0, duration: 1.6, ease: 'easeInOut' }}
      >
        {isMyTurn
          ? '🎯 Your turn — pick a number!'
          : `⏳ ${currentPlayer?.name ?? '...'}'s turn`}
      </motion.div>

      <div
        className="number-pool"
        style={{ '--pool-cols': Math.min(total, n * 2 <= 15 ? n * 2 : 15) } as React.CSSProperties}
      >
        {allNumbers.map((num) => {
          const isCalled = calledSet.has(num);
          const pickable = isMyTurn && !isCalled;
          return (
            <motion.button
              key={num}
              className={`pool-num${isCalled ? ' pool-num--called' : ''}${pickable ? ' pool-num--pickable' : ''}`}
              onClick={() => handlePick(num)}
              disabled={isCalled || !isMyTurn}
              whileHover={pickable ? { scale: 1.18, y: -3 } : {}}
              whileTap={pickable ? { scale: 0.88 } : {}}
              animate={isCalled ? { opacity: 0.28, scale: 0.82 } : { opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            >
              {num}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
