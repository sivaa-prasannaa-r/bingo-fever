import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import GlassPanel from '../components/ui/GlassPanel';
import Button from '../components/ui/Button';
import useGameStore from '../store/gameStore';

const LETTER_DELAY = 0.08;
const BINGO_LETTERS = ['B', 'I', 'N', 'G', 'O'];
const REPLAY_INTERVAL = 750;

function getCompletedLines(board, calledSet, n) {
  const lines = [];
  for (let r = 0; r < n; r++) {
    if (board.slice(r * n, (r + 1) * n).every((x) => calledSet.has(x)))
      lines.push({ type: 'row', index: r });
  }
  for (let c = 0; c < n; c++) {
    if (Array.from({ length: n }, (_, r) => board[r * n + c]).every((x) => calledSet.has(x)))
      lines.push({ type: 'col', index: c });
  }
  const d1 = Array.from({ length: n }, (_, i) => board[i * n + i]);
  if (d1.every((x) => calledSet.has(x))) lines.push({ type: 'diag', index: 0 });
  const d2 = Array.from({ length: n }, (_, i) => board[i * n + (n - 1 - i)]);
  if (d2.every((x) => calledSet.has(x))) lines.push({ type: 'diag', index: 1 });
  return lines;
}

function tileInLines(pos, lines, n) {
  const r = Math.floor(pos / n), c = pos % n;
  return lines.some((l) => {
    if (l.type === 'row') return l.index === r;
    if (l.type === 'col') return l.index === c;
    if (l.type === 'diag') return l.index === 0 ? r === c : r + c === n - 1;
    return false;
  });
}

export default function VictoryScreen({ send }) {
  const { winner, gameEndReason, playerId, resetForNewGame, room, winnerBoard, calledNumbers } =
    useGameStore();
  const isWinner = winner?.id === playerId;
  const isHost = room?.host === playerId;

  const [showReplay, setShowReplay] = useState(false);
  const [replayIdx, setReplayIdx] = useState(0);

  const n = winnerBoard ? Math.round(Math.sqrt(winnerBoard.length)) : 5;

  // Auto-advance replay one number every 750 ms
  useEffect(() => {
    if (!showReplay || replayIdx >= calledNumbers.length) return;
    const t = setTimeout(() => setReplayIdx((i) => i + 1), REPLAY_INTERVAL);
    return () => clearTimeout(t);
  }, [showReplay, replayIdx, calledNumbers.length]);

  const handleShowReplay = () => {
    setReplayIdx(0);
    setShowReplay(true);
  };

  const handlePlayAgain = () => send('PLAY_AGAIN', {});

  // ── Replay view ────────────────────────────────────────────────────────────
  if (showReplay && winnerBoard) {
    const revealedSet = new Set(calledNumbers.slice(0, replayIdx));
    const currentNum = calledNumbers[replayIdx - 1];
    const completedLines = getCompletedLines(winnerBoard, revealedSet, n);
    const isDone = replayIdx >= calledNumbers.length;
    const winnerPlayer = room?.players.find((p) => p.id === winner?.id);

    return (
      <div className="screen victory-screen">
        <div className="replay-screen">
          <div className="replay-title">
            {winnerPlayer?.isBot ? '🤖' : '🏆'} {winner?.name}'s Winning Board
          </div>

          <div className="replay-progress">
            {isDone ? '✅ Replay complete' : `Replaying: ${replayIdx} / ${calledNumbers.length}`}
          </div>

          <div className="replay-board" style={{ '--replay-n': n }}>
            {winnerBoard.map((num, idx) => {
              const isMarked = revealedSet.has(num);
              const isCurrent = num === currentNum;
              const inLine = isMarked && tileInLines(idx, completedLines, n);
              return (
                <motion.div
                  key={idx}
                  className={[
                    'replay-tile',
                    isMarked ? 'replay-tile--marked' : '',
                    inLine ? 'replay-tile--in-line' : '',
                    isCurrent ? 'replay-tile--current' : '',
                  ].join(' ')}
                  animate={isCurrent ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  {num}
                </motion.div>
              );
            })}
          </div>

          <Button
            variant="ghost"
            style={{ width: 'min(88vw, 380px)', marginTop: 8 }}
            onClick={() => setShowReplay(false)}
          >
            ← Go Back
          </Button>
        </div>
      </div>
    );
  }

  // ── Main victory panel ─────────────────────────────────────────────────────
  return (
    <div className="screen victory-screen">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="victory-ring"
          initial={{ scale: 0, opacity: 0.8 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ delay: i * 0.4, duration: 2, repeat: Infinity, repeatDelay: 1 }}
        />
      ))}

      <GlassPanel className="victory-panel">
        <div className="bingo-letters">
          {BINGO_LETTERS.map((ch, i) => (
            <motion.span
              key={ch}
              className="bingo-letter"
              initial={{ y: -60, opacity: 0, rotate: -15 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              transition={{ delay: i * LETTER_DELAY, type: 'spring', stiffness: 280, damping: 16 }}
            >
              {ch}
            </motion.span>
          ))}
        </div>

        <motion.div
          className="winner-block"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 200, damping: 18 }}
        >
          {winner ? (
            <>
              <div className="winner-crown">👑</div>
              <div className="winner-label">
                {isWinner ? 'You Won!' : `${winner.name} Won!`}
              </div>
              {isWinner && (
                <motion.p
                  className="winner-sub"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.9 }}
                >
                  🎉 Congratulations! 🎉
                </motion.p>
              )}
            </>
          ) : (
            <>
              <div className="winner-crown">🎲</div>
              <div className="winner-label">
                {gameEndReason === 'exhausted' ? 'All numbers called — no winner!' : 'Game Over'}
              </div>
            </>
          )}
        </motion.div>

        {room?.players && room.players.length > 1 && (
          <div className="final-players">
            {room.players.map((p, i) => (
              <motion.div
                key={p.id}
                className={`final-player ${p.id === winner?.id ? 'final-player--winner' : ''}`}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + i * 0.1 }}
              >
                <span className="final-rank">{p.id === winner?.id ? '🥇' : '🎮'}</span>
                <span>{p.isBot ? '🤖 ' : ''}{p.name}{p.id === playerId ? ' (you)' : ''}</span>
              </motion.div>
            ))}
          </div>
        )}

        <div className="victory-actions">
          {winner && winnerBoard && (
            <Button
              variant="secondary"
              style={{ width: '100%', fontSize: '1.05rem', marginBottom: 10 }}
              onClick={handleShowReplay}
            >
              🎬 Show Winning Board
            </Button>
          )}

          {isHost && (
            <Button
              variant="secondary"
              style={{ width: '100%', fontSize: '1.05rem', marginBottom: 10 }}
              onClick={handlePlayAgain}
            >
              🔄 Play Again
            </Button>
          )}
          {!isHost && (
            <p className="waiting-msg" style={{ marginBottom: 10 }}>
              Waiting for host to start a new game…
            </p>
          )}

          <Button
            variant="ghost"
            style={{ width: '100%', fontSize: '1.05rem' }}
            onClick={resetForNewGame}
          >
            🏠 Back to Lobby
          </Button>
        </div>
      </GlassPanel>
    </div>
  );
}
