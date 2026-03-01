import { motion } from 'framer-motion';
import GlassPanel from '../components/ui/GlassPanel';
import Button from '../components/ui/Button';
import useGameStore from '../store/gameStore';

const LETTER_DELAY = 0.08;
const BINGO_LETTERS = ['B', 'I', 'N', 'G', 'O'];

export default function VictoryScreen({ send }) {
  const { winner, gameEndReason, playerId, resetForNewGame, room } = useGameStore();
  const isWinner = winner?.id === playerId;
  const isHost = room?.host === playerId;

  const handlePlayAgain = () => {
    send('PLAY_AGAIN', {});
  };

  return (
    <div className="screen victory-screen">
      {/* Ripple rings */}
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
        {/* BINGO letters */}
        <div className="bingo-letters">
          {BINGO_LETTERS.map((ch, i) => (
            <motion.span
              key={ch}
              className="bingo-letter"
              initial={{ y: -60, opacity: 0, rotate: -15 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              transition={{
                delay: i * LETTER_DELAY,
                type: 'spring',
                stiffness: 280,
                damping: 16,
              }}
            >
              {ch}
            </motion.span>
          ))}
        </div>

        {/* Winner announcement */}
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

        {/* Player final standings */}
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
                <span>{p.name}{p.id === playerId ? ' (you)' : ''}</span>
              </motion.div>
            ))}
          </div>
        )}

        <div className="victory-actions">
          {/* Play Again — host only */}
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
