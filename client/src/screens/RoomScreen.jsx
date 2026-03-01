import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassPanel from '../components/ui/GlassPanel';
import Button from '../components/ui/Button';
import useGameStore from '../store/gameStore';

const DIFFICULTIES = [
  { key: 'easy',   label: 'Easy',   icon: '😊', desc: 'Picks random numbers' },
  { key: 'medium', label: 'Medium', icon: '🎯', desc: 'Alternates smart & random' },
  { key: 'hard',   label: 'Hard',   icon: '🔥', desc: 'Always plays to win' },
];

export default function RoomScreen({ send }) {
  const { room, playerId, resetForNewGame } = useGameStore();
  const [boardSize, setSize] = useState(room?.boardSize ?? 5);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showDiffMenu, setShowDiffMenu] = useState(false);

  if (!room) return null;

  const isHost = room.host === playerId;
  const bot = room.players.find((p) => p.isBot);
  const currentDiff = bot?.difficulty ?? 'hard';

  const copyCode = () => {
    navigator.clipboard.writeText(room.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?join=${room.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    });
  };

  const handleStart = () => send('START_SETUP', { boardSize });

  const handleSizeChange = (v) => {
    setSize(v);
    send('UPDATE_BOARD_SIZE', { boardSize: v });
  };

  const handleDifficulty = (d) => {
    send('SET_BOT_DIFFICULTY', { difficulty: d });
    setShowDiffMenu(false);
  };

  return (
    <div className="screen room-screen">
      <GlassPanel className="room-panel">
        {/* Room code */}
        <div className="room-code-block">
          <p className="room-code-label">Room Code</p>
          <motion.div className="room-code" onClick={copyCode} whileTap={{ scale: 0.95 }}>
            {room.id}
            <span className="copy-hint">{copied ? '✅ Copied!' : '📋 Tap to copy'}</span>
          </motion.div>
          <motion.button
            className="invite-link-btn"
            onClick={copyInviteLink}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
          >
            {linkCopied ? '✅ Link copied!' : '🔗 Copy Invite Link'}
          </motion.button>
        </div>

        {/* Board size (host only) */}
        {isHost && (
          <div className="size-selector">
            <label className="input-label">Board Size ({boardSize}×{boardSize})</label>
            <input
              type="range" min={5} max={10} value={boardSize}
              onChange={(e) => handleSizeChange(Number(e.target.value))}
              className="range-input"
            />
          </div>
        )}
        {!isHost && (
          <p className="input-label" style={{ textAlign: 'center' }}>
            Board: {room.boardSize}×{room.boardSize}
          </p>
        )}

        {/* Player list */}
        <div className="player-list">
          <p className="input-label">Players ({room.players.length}/4)</p>
          {room.players.map((p) => (
            <div key={p.id}>
              <motion.div
                className={`player-row ${p.id === playerId ? 'player-row--me' : ''}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              >
                <span className="player-avatar">{p.isBot ? '🤖' : p.name[0]?.toUpperCase()}</span>
                <span className="player-name">{p.name}{p.id === playerId ? ' (you)' : ''}</span>

                {/* Difficulty badge (always visible for bot) */}
                {p.isBot && (
                  <span className={`diff-badge diff-badge--${currentDiff}`}>
                    {DIFFICULTIES.find((d) => d.key === currentDiff)?.icon} {DIFFICULTIES.find((d) => d.key === currentDiff)?.label}
                  </span>
                )}

                {room.host === p.id && <span className="host-badge">👑 Host</span>}
                {!p.connected && <span className="dc-badge">💤</span>}

                {/* Gear icon — host only, bot row only */}
                {p.isBot && isHost && (
                  <motion.button
                    className="diff-gear-btn"
                    onClick={() => setShowDiffMenu((v) => !v)}
                    whileTap={{ scale: 0.88 }}
                    animate={{ rotate: showDiffMenu ? 60 : 0 }}
                    transition={{ duration: 0.25 }}
                    title="Set difficulty"
                  >
                    ⚙️
                  </motion.button>
                )}
              </motion.div>

              {/* Difficulty picker — expands below bot row */}
              {p.isBot && isHost && (
                <AnimatePresence>
                  {showDiffMenu && (
                    <motion.div
                      className="diff-menu"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                    >
                      {DIFFICULTIES.map((d) => (
                        <button
                          key={d.key}
                          className={`diff-option${currentDiff === d.key ? ' diff-option--active' : ''}`}
                          onClick={() => handleDifficulty(d.key)}
                        >
                          <span className="diff-option-icon">{d.icon}</span>
                          <span className="diff-option-label">{d.label}</span>
                          <span className="diff-option-desc">{d.desc}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        {isHost ? (
          <>
            {!bot && room.players.length < 4 && (
              <Button
                variant="ghost"
                style={{ width: '100%', marginBottom: 8 }}
                onClick={() => send('ADD_BOT', {})}
              >
                🤖 Add Computer
              </Button>
            )}
            <Button
              variant="primary"
              style={{ width: '100%', fontSize: '1.1rem' }}
              onClick={handleStart}
              disabled={room.players.length < 2}
            >
              🎮 Start Game
            </Button>
            {room.players.length < 2 && (
              <p className="waiting-msg" style={{ marginTop: 6, fontSize: '0.82rem' }}>
                Need at least 2 players to start
              </p>
            )}
          </>
        ) : (
          <p className="waiting-msg">Waiting for host to start…</p>
        )}

        <Button
          variant="ghost"
          style={{ width: '100%', marginTop: 8 }}
          onClick={resetForNewGame}
        >
          ← Leave Room
        </Button>
      </GlassPanel>
    </div>
  );
}
