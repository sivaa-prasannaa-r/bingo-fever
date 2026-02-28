import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BingoBoard from '../components/board/BingoBoard';
import CalledNumbers from '../components/CalledNumbers';
import Button from '../components/ui/Button';
import useGameStore from '../store/gameStore';
import { checkWin } from '../utils/boardUtils';
import { audioEngine } from '../audio/audioEngine';

export default function GameScreen({ send }) {
  const {
    room, playerId,
    lastCalledNumber,
    calledNumbers,
    markedNumbers,
    boardArrangement,
    autoMark, setAutoMark,
    completedLines,
    pendingWin, setPendingWin,
    countdownValue,
    addCompletedLine,
  } = useGameStore();

  const n = room?.boardSize ?? 5;

  // Detect newly completed lines client-side
  useEffect(() => {
    if (!boardArrangement || !room) return;
    const win = checkWin(boardArrangement, markedNumbers, n);
    if (win) {
      const alreadyLogged = completedLines.some(
        (l) => l.type === win.type && l.index === win.index && l.playerId === playerId,
      );
      if (!alreadyLogged) {
        addCompletedLine({ ...win, playerId });
      }
    }
  }, [markedNumbers, boardArrangement, n, completedLines, addCompletedLine, playerId, room]);

  const handleBingo = () => {
    send('CLAIM_WIN', {});
    setPendingWin(false);
  };

  const myLines    = completedLines.filter((l) => l.playerId === playerId);
  const lineCount  = myLines.length;

  return (
    <div className="screen game-screen">
      {/* ── Countdown overlay ── */}
      <AnimatePresence>
        {countdownValue !== null && (
          <motion.div
            className="countdown-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.span
              key={countdownValue}
              className="countdown-num"
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            >
              {countdownValue === 0 ? 'GO!' : countdownValue}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Called number reveal ── */}
      <div className="number-reveal-area">
        <AnimatePresence mode="wait">
          {lastCalledNumber && (
            <motion.div
              key={lastCalledNumber}
              className="number-reveal"
              initial={{ scale: 0.3, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.6, opacity: 0, y: -20 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            >
              <div className="reveal-label">Called</div>
              <div className="reveal-num">{lastCalledNumber}</div>
              <motion.div
                className="reveal-glow"
                animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Called history ── */}
      <CalledNumbers />

      {/* ── Board ── */}
      <div className="board-wrap">
        <BingoBoard send={send} />
      </div>

      {/* ── Controls ── */}
      <div className="game-controls">
        <label className="auto-mark-toggle">
          <input
            type="checkbox"
            checked={autoMark}
            onChange={(e) => setAutoMark(e.target.checked)}
          />
          <span className="toggle-track">
            <span className="toggle-thumb" />
          </span>
          <span className="toggle-label">Auto-Mark</span>
        </label>

        {lineCount > 0 && (
          <div className="line-count-badge">
            🔥 {lineCount} Line{lineCount > 1 ? 's' : ''}!
          </div>
        )}
      </div>

      {/* ── BINGO button ── */}
      <AnimatePresence>
        {pendingWin && (
          <motion.div
            className="bingo-claim-wrap"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 18 }}
          >
            <motion.button
              className="bingo-btn"
              onClick={handleBingo}
              animate={{
                boxShadow: [
                  '0 0 16px #ffe66d',
                  '0 0 40px #ff6b9d',
                  '0 0 16px #ffe66d',
                ],
              }}
              transition={{ repeat: Infinity, duration: 0.9 }}
              whileTap={{ scale: 0.92 }}
            >
              🎉 BINGO!
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Players sidebar ── */}
      <div className="players-strip">
        {room?.players.map((p) => (
          <div key={p.id} className={`strip-player ${p.id === playerId ? 'strip-player--me' : ''}`}>
            <span className="strip-avatar">{p.name[0]?.toUpperCase()}</span>
            <span className="strip-name">{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
