import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import BingoTile from './BingoTile';
import { isInLine } from '../../utils/boardUtils';
import useGameStore from '../../store/gameStore';

const LINE_GRADIENT_H = 'linear-gradient(90deg, transparent 0%, #ffe66d 25%, #ff6b9d 50%, #ffe66d 75%, transparent 100%)';
const LINE_GRADIENT_V = 'linear-gradient(180deg, transparent 0%, #ffe66d 25%, #ff6b9d 50%, #ffe66d 75%, transparent 100%)';
const LINE_GLOW = '0 0 10px rgba(255,230,109,0.9)';

function LineMarker({ line, n }) {
  if (line.type === 'row') {
    const topPct = (line.index / n + 1 / (2 * n)) * 100;
    return (
      <motion.div
        style={{
          position: 'absolute',
          top: `${topPct}%`,
          left: '1%',
          right: '1%',
          height: 3,
          background: LINE_GRADIENT_H,
          boxShadow: LINE_GLOW,
          borderRadius: 4,
          transformOrigin: 'left center',
          zIndex: 5,
          pointerEvents: 'none',
        }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
      />
    );
  }

  if (line.type === 'col') {
    const leftPct = (line.index / n + 1 / (2 * n)) * 100;
    return (
      <motion.div
        style={{
          position: 'absolute',
          left: `${leftPct}%`,
          top: '1%',
          bottom: '1%',
          width: 3,
          background: LINE_GRADIENT_V,
          boxShadow: LINE_GLOW,
          borderRadius: 4,
          transformOrigin: 'top center',
          zIndex: 5,
          pointerEvents: 'none',
        }}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
      />
    );
  }

  if (line.type === 'diag') {
    const angle = line.index === 0 ? 45 : -45;
    return (
      <motion.div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '141.4%',
          height: 3,
          background: LINE_GRADIENT_H,
          boxShadow: LINE_GLOW,
          borderRadius: 4,
          marginLeft: '-70.7%',
          marginTop: -1.5,
          transformOrigin: 'center center',
          zIndex: 5,
          pointerEvents: 'none',
        }}
        initial={{ scaleX: 0, rotate: angle }}
        animate={{ scaleX: 1, rotate: angle }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      />
    );
  }

  return null;
}

export default function BingoBoard({ send }) {
  const {
    room,
    boardArrangement,
    markedNumbers,
    calledNumbers,
    completedLines,
    autoMark,
    playerId,
    currentTurn,
    lastCalledNumber,
    markNumber,
  } = useGameStore();

  const n = room?.boardSize ?? 5;
  const isMyTurn = currentTurn === playerId;

  // Track the just-called number with a 2-second highlight
  const [justCalledNumber, setJustCalledNumber] = useState(null);
  useEffect(() => {
    if (lastCalledNumber == null) return;
    setJustCalledNumber(lastCalledNumber);
    const t = setTimeout(() => setJustCalledNumber(null), 3000);
    return () => clearTimeout(t);
  }, [lastCalledNumber]);

  if (!boardArrangement) {
    return (
      <div className="board-placeholder">
        <p>Waiting for board…</p>
      </div>
    );
  }

  const calledSet = new Set(calledNumbers);
  const myLines = completedLines.filter((l) => l.playerId === playerId);

  const handleTap = (number) => {
    // On your turn: tap any uncalled tile to call it
    if (isMyTurn && !calledSet.has(number)) {
      send('CALL_NUMBER', { number });
      return;
    }
    // Manual mark when autoMark is off
    if (!autoMark && calledSet.has(number) && !markedNumbers.has(number)) {
      markNumber(number);
      send('MARK_TILE', { number });
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 'min(92vw, 400px)', aspectRatio: '1', overflow: 'hidden' }}>
      <div
        className="bingo-board"
        style={{ '--board-n': n, position: 'absolute', inset: 0, maxWidth: 'none', aspectRatio: 'unset' }}
      >
        {boardArrangement.map((num, i) => (
          <BingoTile
            key={i}
            number={num}
            isMarked={markedNumbers.has(num)}
            isCalled={calledSet.has(num)}
            isInLine={isInLine(i, myLines, n)}
            isPickable={isMyTurn && !calledSet.has(num)}
            isJustCalled={num === justCalledNumber}
            onTap={handleTap}
            data-cell-index={i}
          />
        ))}
      </div>

      {/* Animated strikethrough lines */}
      {myLines.map((line) => (
        <LineMarker key={`${line.type}-${line.index}`} line={line} n={n} />
      ))}
    </div>
  );
}
