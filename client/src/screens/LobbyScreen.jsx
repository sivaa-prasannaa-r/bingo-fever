import { useState } from 'react';
import { motion } from 'framer-motion';
import GlassPanel from '../components/ui/GlassPanel';
import Button from '../components/ui/Button';
import useGameStore from '../store/gameStore';

export default function LobbyScreen({ send }) {
  const { playerName, setPlayerName } = useGameStore();
  const [tab, setTab]         = useState('home');   // 'home' | 'create' | 'join'
  const [boardSize, setSize]  = useState(5);
  const [roomCode, setCode]   = useState('');
  const [error, setError]     = useState('');

  const handleCreate = () => {
    if (!playerName.trim()) { setError('Enter your name first'); return; }
    setError('');
    send('CREATE_ROOM', { playerName: playerName.trim(), boardSize });
  };

  const handleJoin = () => {
    if (!playerName.trim()) { setError('Enter your name first'); return; }
    if (!roomCode.trim())   { setError('Enter a room code');      return; }
    setError('');
    send('JOIN_ROOM', { playerName: playerName.trim(), roomId: roomCode.toUpperCase().trim() });
  };

  return (
    <div className="screen lobby-screen">
      {/* ── Title ── */}
      <motion.div
        className="lobby-title"
        initial={{ opacity: 0, y: -40, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.1 }}
      >
        <h1 className="game-logo">BINGO<br />FEVER</h1>
        <p className="game-tagline">🎉 Play Together • Win Together 🎉</p>
      </motion.div>

      {/* ── Name input ── */}
      <GlassPanel className="lobby-panel">
        <label className="input-label">Your Name</label>
        <input
          className="text-input"
          placeholder="Enter your name…"
          maxLength={20}
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setTab('home')}
        />

        {tab === 'home' && (
          <div className="btn-row">
            <Button variant="primary" onClick={() => setTab('create')}>🎲 Create Room</Button>
            <Button variant="secondary" onClick={() => setTab('join')}>🚀 Join Room</Button>
          </div>
        )}

        {tab === 'create' && (
          <motion.div
            className="sub-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
          >
            <label className="input-label">Board Size  ({boardSize}×{boardSize})</label>
            <input
              type="range"
              min={5}
              max={10}
              value={boardSize}
              onChange={(e) => setSize(Number(e.target.value))}
              className="range-input"
            />
            <p className="size-hint">{boardSize * boardSize} numbers · {boardSize}×{boardSize} grid</p>
            <div className="btn-row">
              <Button variant="ghost" onClick={() => setTab('home')}>← Back</Button>
              <Button variant="primary" onClick={handleCreate}>Create 🎯</Button>
            </div>
          </motion.div>
        )}

        {tab === 'join' && (
          <motion.div
            className="sub-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
          >
            <label className="input-label">Room Code</label>
            <input
              className="text-input code-input"
              placeholder="e.g. ABC123"
              maxLength={6}
              value={roomCode}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
            <div className="btn-row">
              <Button variant="ghost" onClick={() => setTab('home')}>← Back</Button>
              <Button variant="primary" onClick={handleJoin}>Join 🚀</Button>
            </div>
          </motion.div>
        )}

        {error && (
          <motion.p
            className="error-msg"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            ⚠️ {error}
          </motion.p>
        )}
      </GlassPanel>
    </div>
  );
}
