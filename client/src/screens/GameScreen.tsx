import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BingoBoard from '../components/board/BingoBoard';
import useGameStore from '../store/gameStore';
import type { SendFn } from '../types';

const BINGO_CHARS = ['B', 'I', 'N', 'G', 'O'];

export default function GameScreen({ send }: { send: SendFn }) {
  const {
    room, playerId,
    lastCalledNumber,
    lastCalledBy,
    pendingWin, setPendingWin,
    playerLines,
    currentTurn,
    turnDeadlineMs,
  } = useGameStore();

  const myLineData   = playerLines[playerId ?? ''];
  const myLineCount  = myLineData?.lineCount ?? 0;
  const isMyTurn     = currentTurn === playerId;
  const currentPlayer = room?.players?.find((p) => p.id === currentTurn);
  const turnWaitSecs = room?.turnWaitSecs ?? 15;

  const [timeLeft, setTimeLeft] = useState(turnWaitSecs);
  useEffect(() => {
    if (!turnDeadlineMs) { setTimeLeft(turnWaitSecs); return; }
    const update = () => setTimeLeft(Math.max(0, Math.ceil((turnDeadlineMs - Date.now()) / 1000)));
    update();
    const id = setInterval(update, 500);
    return () => clearInterval(id);
  }, [turnDeadlineMs, turnWaitSecs]);

  const urgentTimer = timeLeft <= 5 && timeLeft > 0;

  const handleBingo = () => {
    send('CLAIM_WIN', {});
    setPendingWin(false);
  };

  return (
    <div className="screen game-screen">
      <div className="bingo-progress">
        {BINGO_CHARS.map((ch, i) => {
          const done = i < myLineCount;
          return (
            <motion.span
              key={ch}
              className={`bingo-prog-letter${done ? ' bingo-prog-letter--done' : ''}`}
              animate={done ? { scale: [1, 1.35, 1], rotate: [0, -8, 8, 0] } : {}}
              transition={{ duration: 0.5 }}
            >
              {ch}
              {done && <span className="bingo-prog-strike" />}
            </motion.span>
          );
        })}
        <span className="bingo-prog-count">{myLineCount}/5</span>
      </div>

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
              <div className="reveal-caller">
                {lastCalledBy ? `${lastCalledBy.name} called` : 'Auto-called'}
              </div>
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

      <div className={`turn-banner${isMyTurn ? ' turn-banner--mine' : ''}`}>
        <div className="turn-banner-text">
          {isMyTurn
            ? '🎯 Your turn — tap any number on your board!'
            : `⏳ ${currentPlayer?.name ?? '...'}'s turn`}
        </div>
        <div className="turn-timer-row">
          <div className={`turn-progress-bar${urgentTimer ? ' turn-progress-bar--urgent' : ''}`}>
            <motion.div
              className="turn-progress-fill"
              animate={{ width: `${(timeLeft / turnWaitSecs) * 100}%` }}
              transition={{ duration: 0.5, ease: 'linear' }}
            />
          </div>
          <span className={`turn-timer-num${urgentTimer ? ' turn-timer-num--urgent' : ''}`}>
            {timeLeft}s
          </span>
        </div>
      </div>

      <div className="board-wrap">
        <BingoBoard send={send} />
      </div>

      <AnimatePresence>
        {pendingWin && myLineCount >= 5 && (
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
                boxShadow: ['0 0 16px #ffe66d', '0 0 40px #ff6b9d', '0 0 16px #ffe66d'],
              }}
              transition={{ repeat: Infinity, duration: 0.9 }}
              whileTap={{ scale: 0.92 }}
            >
              🎉 BINGO!
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="players-strip">
        {room?.players.map((p) => {
          const pLineCount = playerLines[p.id]?.lineCount ?? 0;
          const isActive   = p.id === currentTurn;
          const isMe       = p.id === playerId;
          return (
            <div
              key={p.id}
              className={`strip-player${isMe ? ' strip-player--me' : ''}${isActive ? ' strip-player--active' : ' strip-player--inactive'}`}
            >
              <span className="strip-avatar">{p.isBot ? '🤖' : p.name[0]?.toUpperCase()}</span>
              <span className="strip-name">{p.name}{isMe ? ' (you)' : ''}</span>
              <div className="strip-bingo-letters">
                {BINGO_CHARS.map((ch, i) => (
                  <span key={ch} className={`strip-bl${i < pLineCount ? ' strip-bl--done' : ''}`}>
                    {ch}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
