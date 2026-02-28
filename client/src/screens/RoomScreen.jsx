import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassPanel from '../components/ui/GlassPanel';
import Button from '../components/ui/Button';
import useGameStore from '../store/gameStore';

export default function RoomScreen({ send }) {
  const { room, playerId, resetForNewGame } = useGameStore();
  const [boardSize, setSize] = useState(room?.boardSize ?? 5);
  const [copied, setCopied] = useState(false);

  if (!room) return null;

  const isHost = room.host === playerId;

  const copyCode = () => {
    navigator.clipboard.writeText(room.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleStart = () => {
    send('START_SETUP', { boardSize });
  };

  const handleSizeChange = (v) => {
    setSize(v);
    send('UPDATE_BOARD_SIZE', { boardSize: v });
  };

  return (
    <div className="screen room-screen">
      <GlassPanel className="room-panel">
        {/* Room code */}
        <div className="room-code-block">
          <p className="room-code-label">Room Code</p>
          <motion.div
            className="room-code"
            onClick={copyCode}
            whileTap={{ scale: 0.95 }}
          >
            {room.id}
            <span className="copy-hint">{copied ? '✅ Copied!' : '📋 Tap to copy'}</span>
          </motion.div>
        </div>

        {/* Board size (host only) */}
        {isHost && (
          <div className="size-selector">
            <label className="input-label">Board Size ({boardSize}×{boardSize})</label>
            <input
              type="range"
              min={5}
              max={10}
              value={boardSize}
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
          <p className="input-label">Players ({room.players.length}/8)</p>
          {room.players.map((p) => (
            <motion.div
              key={p.id}
              className={`player-row ${p.id === playerId ? 'player-row--me' : ''}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            >
              <span className="player-avatar">{p.name[0]?.toUpperCase()}</span>
              <span className="player-name">{p.name}{p.id === playerId ? ' (you)' : ''}</span>
              {room.host === p.id && <span className="host-badge">👑 Host</span>}
              {!p.connected && <span className="dc-badge">💤</span>}
            </motion.div>
          ))}
        </div>

        {/* Actions */}
        {isHost ? (
          <Button
            variant="primary"
            style={{ width: '100%', fontSize: '1.1rem' }}
            onClick={handleStart}
            disabled={room.players.length < 1}
          >
            🎮 Start Game
          </Button>
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
