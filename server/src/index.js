import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { RoomService } from './services/RoomService.js';

const PORT = process.env.PORT || 3001;
const roomService = new RoomService();

// playerId -> WebSocket
const clients = new Map();

const wss = new WebSocketServer({ port: PORT });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function send(ws, type, payload) {
  if (ws.readyState === WebSocket.OPEN)
    ws.send(JSON.stringify({ type, payload }));
}

function broadcast(room, type, payload, excludeId = null) {
  for (const player of room.players) {
    if (player.id === excludeId) continue;
    const ws = clients.get(player.id);
    if (ws) send(ws, type, payload);
  }
}

function broadcastRoom(room) {
  broadcast(room, 'ROOM_UPDATED', roomService.serialize(room));
}

// ─── Connection ───────────────────────────────────────────────────────────────

wss.on('connection', (ws) => {
  const playerId = randomUUID();
  let player = { id: playerId, name: 'Player', connected: true, board: null, ready: false };
  clients.set(playerId, ws);

  send(ws, 'CONNECTED', { playerId });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); }
    catch { return; }
    try { dispatch(ws, player, msg.type, msg.payload ?? {}); }
    catch (err) { send(ws, 'ERROR', { message: err.message }); }
  });

  ws.on('close', () => {
    player.connected = false;
    clients.delete(playerId);
    const room = roomService.getRoomOf(playerId);
    if (room) {
      broadcastRoom(room);
      // Allow 30 s to reconnect before evicting
      setTimeout(() => {
        if (!clients.has(playerId)) {
          const updated = roomService.removePlayer(playerId);
          if (updated) broadcastRoom(updated);
        }
      }, 30_000);
    }
  });

  // ─── Message dispatcher ─────────────────────────────────────────────────────

  function dispatch(ws, player, type, payload) {
    switch (type) {
      // ── Lobby / Room ──────────────────────────────────────────────────────
      case 'CREATE_ROOM': {
        player.name = sanitizeName(payload.playerName);
        const size = clampSize(payload.boardSize);
        const room = roomService.createRoom(player, size);
        send(ws, 'ROOM_CREATED', { room: roomService.serialize(room) });
        break;
      }

      case 'JOIN_ROOM': {
        player.name = sanitizeName(payload.playerName);
        const code = String(payload.roomId ?? '').toUpperCase().trim();
        const room = roomService.joinRoom(code, player);
        send(ws, 'ROOM_JOINED', { room: roomService.serialize(room) });
        broadcastRoom(room);
        break;
      }

      case 'UPDATE_BOARD_SIZE': {
        const room = requireRoom(playerId);
        if (room.host !== playerId) throw new Error('Only host can change board size');
        if (room.state !== 'LOBBY') throw new Error('Cannot change size now');
        room.boardSize = clampSize(payload.boardSize);
        broadcastRoom(room);
        break;
      }

      // ── Setup ─────────────────────────────────────────────────────────────
      case 'START_SETUP': {
        const room = requireRoom(playerId);
        if (room.host !== playerId) throw new Error('Only host can start setup');
        if (room.state !== 'LOBBY') throw new Error('Already started');
        const size = clampSize(payload.boardSize ?? room.boardSize);
        roomService.startSetup(room.id, size, (r) => {
          // Auto-fill callback: notify each player of their board then check readiness
          for (const p of r.players) {
            const pw = clients.get(p.id);
            if (pw) send(pw, 'BOARD_AUTO_FILLED', { arrangement: p.board });
          }
          broadcastRoom(r);
          if (roomService.allReady(r)) beginCountdown(r);
        });
        broadcast(room, 'SETUP_STARTED', {
          boardSize: room.boardSize,
          deadlineMs: room.setupDeadlineMs,
          room: roomService.serialize(room),
        });
        break;
      }

      case 'SUBMIT_BOARD': {
        const room = roomService.submitBoard(playerId, payload.arrangement);
        broadcastRoom(room);
        if (roomService.allReady(room)) beginCountdown(room);
        break;
      }

      // ── Gameplay ──────────────────────────────────────────────────────────
      case 'MARK_TILE': {
        const room = requireRoom(playerId);
        if (room.state !== 'GAME') return;
        const { number } = payload;
        if (!room.engine.calledNumbers.includes(number)) return;
        broadcast(room, 'TILE_MARKED', { playerId, number });
        break;
      }

      case 'CLAIM_WIN': {
        const { room, player: p, result } = roomService.claimWin(playerId);
        if (result.valid) {
          roomService.endGame(room);
          broadcast(room, 'GAME_ENDED', {
            winner: { id: p.id, name: p.name },
            lineInfo: result,
            reason: 'bingo',
          });
        } else {
          send(ws, 'WIN_REJECTED', { message: 'Not a valid win — keep playing!' });
        }
        break;
      }

      // ── Reconnect ─────────────────────────────────────────────────────────
      case 'RECONNECT': {
        const { savedPlayerId, roomId } = payload;
        if (!savedPlayerId || !roomId) break;
        const room = roomService.getRoom(String(roomId).toUpperCase());
        if (!room) { send(ws, 'RECONNECT_FAILED', {}); break; }
        const existing = room.players.find((p) => p.id === savedPlayerId);
        if (!existing) { send(ws, 'RECONNECT_FAILED', {}); break; }

        // Transfer socket mapping
        clients.delete(playerId);
        existing.connected = true;
        clients.set(savedPlayerId, ws);
        // Update local player ref for this connection
        Object.assign(player, existing);

        send(ws, 'RECONNECTED', {
          playerId: savedPlayerId,
          room: roomService.serialize(room),
          calledNumbers: room.engine?.calledNumbers ?? [],
          board: existing.board,
        });
        broadcastRoom(room);
        break;
      }

      default:
        break;
    }
  }
});

// ─── Game flow helpers ────────────────────────────────────────────────────────

function beginCountdown(room) {
  room.state = 'COUNTDOWN';
  let count = 3;
  const tick = () => {
    broadcast(room, 'GAME_COUNTDOWN', { count });
    if (count === 0) {
      startGame(room);
    } else {
      count--;
      setTimeout(tick, 1000);
    }
  };
  tick();
}

function startGame(room) {
  roomService.startGame(room);
  broadcast(room, 'GAME_STARTED', { room: roomService.serialize(room) });

  room.engine.start(
    (number, sequence) => broadcast(room, 'NUMBER_CALLED', { number, sequence }),
    () => {
      room.state = 'ENDED';
      broadcast(room, 'GAME_ENDED', { winner: null, reason: 'exhausted' });
    },
  );
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function requireRoom(playerId) {
  const room = roomService.getRoomOf(playerId);
  if (!room) throw new Error('Not in a room');
  return room;
}

function sanitizeName(raw) {
  return String(raw ?? 'Player').trim().slice(0, 20) || 'Player';
}

function clampSize(v) {
  return Math.max(5, Math.min(10, Number(v) || 5));
}

console.log(`🎱 Bingo server listening on ws://localhost:${PORT}`);
