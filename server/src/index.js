import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { RoomService } from './services/RoomService.js';

const PORT = process.env.PORT || 3001;
const TURN_SECS_DEFAULT = 15;   // fallback if room.turnWaitSecs is missing
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

// Build playerLines summary for NUMBER_CALLED broadcasts
function buildPlayerLines(room) {
  return room.players.map((p) => ({
    playerId: p.id,
    lineCount: room.engine ? room.engine.countCompletedLines(p.board).length : 0,
    lines: room.engine ? room.engine.countCompletedLines(p.board) : [],
  }));
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
      // If it was this player's turn and game is active, advance turn
      if (room.state === 'GAME' && room.currentTurn === playerId) {
        const connected = room.players.filter((p) => p.connected && p.id !== playerId);
        if (connected.length > 0) {
          room.currentTurn = connected[0].id;
          const deadline = Date.now() + roomSecs(room) * 1000;
          broadcast(room, 'TURN_CHANGED', { nextTurn: room.currentTurn, turnDeadlineMs: deadline });
          startTurnTimer(room);
        }
      }
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
        const room = roomService.createRoom(player, size, payload.turnWaitSecs);
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

      case 'ADD_BOT': {
        const room = requireRoom(playerId);
        if (room.host !== playerId) throw new Error('Only the host can add a bot');
        if (room.state !== 'LOBBY') throw new Error('Cannot add bot after game has started');
        roomService.addBot(room.id);
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

      // ── Gameplay: turn-based number calling ───────────────────────────────
      case 'CALL_NUMBER': {
        const room = requireRoom(playerId);
        if (room.state !== 'GAME') return;
        if (room.currentTurn !== playerId) {
          send(ws, 'ERROR', { message: "It's not your turn!" });
          return;
        }
        const { number } = payload;
        if (typeof number !== 'number' || !Number.isInteger(number)) {
          throw new Error('Invalid number');
        }

        clearTurnTimer(room);
        room.engine.callNumber(number);

        // Advance turn to next connected player
        const connected = room.players.filter((p) => p.connected);
        const curIdx = connected.findIndex((p) => p.id === playerId);
        const nextIdx = (curIdx + 1) % connected.length;
        room.currentTurn = connected[nextIdx]?.id ?? connected[0]?.id ?? null;

        const callerPlayer = room.players.find((p) => p.id === playerId);
        const playerLines = buildPlayerLines(room);
        const nextDeadline = Date.now() + roomSecs(room) * 1000;

        broadcast(room, 'NUMBER_CALLED', {
          number,
          calledBy: { id: playerId, name: callerPlayer?.name ?? 'Unknown' },
          nextTurn: room.currentTurn,
          playerLines,
          turnDeadlineMs: nextDeadline,
        });

        // All numbers exhausted — game over
        if (room.engine.isExhausted()) {
          roomService.endGame(room);
          broadcast(room, 'GAME_ENDED', { winner: null, reason: 'exhausted' });
          break;
        }

        startTurnTimer(room);
        break;
      }

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
          clearTurnTimer(room);
          roomService.endGame(room);
          broadcast(room, 'GAME_ENDED', {
            winner: { id: p.id, name: p.name },
            lineInfo: result,
            reason: 'bingo',
          });
        } else {
          send(ws, 'WIN_REJECTED', { message: 'Need 5 complete lines for BINGO!' });
        }
        break;
      }

      // ── Play Again — reset to LOBBY (host only) ───────────────────────────
      case 'PLAY_AGAIN': {
        const room = requireRoom(playerId);
        if (room.host !== playerId) {
          send(ws, 'ERROR', { message: 'Only the host can start a new game' });
          return;
        }
        clearTurnTimer(room);
        const updated = roomService.playAgain(room.id);
        broadcast(updated, 'GAME_RESET', { room: roomService.serialize(updated) });
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

        clients.delete(playerId);
        existing.connected = true;
        clients.set(savedPlayerId, ws);
        Object.assign(player, existing);

        send(ws, 'RECONNECTED', {
          playerId: savedPlayerId,
          room: roomService.serialize(room),
          calledNumbers: room.engine?.calledNumbers ?? [],
          board: existing.board,
          currentTurn: room.currentTurn,
        });
        broadcastRoom(room);
        break;
      }

      default:
        break;
    }
  }
});

// ─── Turn timer ───────────────────────────────────────────────────────────────

function roomSecs(room) {
  return room.turnWaitSecs ?? TURN_SECS_DEFAULT;
}

function startTurnTimer(room) {
  clearTimeout(room.turnTimer);
  const currentPlayer = room.players.find((p) => p.id === room.currentTurn);
  if (currentPlayer?.isBot) {
    // Bot "thinks" for 1.0–1.8 s then auto-calls the smart move
    const delay = 1000 + Math.random() * 800;
    room.turnDeadlineMs = Date.now() + delay;
    room.turnTimer = setTimeout(() => botTakeTurn(room), delay);
    return;
  }
  const secs = roomSecs(room);
  room.turnDeadlineMs = Date.now() + secs * 1000;
  room.turnTimer = setTimeout(() => autoCallNumber(room), secs * 1000);
}

function clearTurnTimer(room) {
  clearTimeout(room.turnTimer);
  room.turnTimer = null;
  room.turnDeadlineMs = null;
}

function autoCallNumber(room) {
  if (room.state !== 'GAME') return;
  const pool = room.engine.numberPool;
  if (pool.length === 0) return;

  const number = pool[Math.floor(Math.random() * pool.length)];
  room.engine.callNumber(number);

  const connected = room.players.filter((p) => p.connected);
  if (connected.length === 0) return;
  const curIdx = connected.findIndex((p) => p.id === room.currentTurn);
  const nextIdx = (curIdx + 1) % connected.length;
  room.currentTurn = connected[nextIdx]?.id ?? connected[0]?.id ?? null;

  const playerLines = buildPlayerLines(room);
  const secs = roomSecs(room);
  const nextDeadline = Date.now() + secs * 1000;

  broadcast(room, 'NUMBER_CALLED', {
    number,
    calledBy: null,  // null = auto-called (timer expired)
    nextTurn: room.currentTurn,
    playerLines,
    turnDeadlineMs: nextDeadline,
  });

  if (room.engine.isExhausted()) {
    clearTurnTimer(room);
    roomService.endGame(room);
    broadcast(room, 'GAME_ENDED', { winner: null, reason: 'exhausted' });
    return;
  }

  startTurnTimer(room);
}

function botTakeTurn(room) {
  if (room.state !== 'GAME') return;
  const bot = room.players.find((p) => p.isBot && p.id === room.currentTurn);
  if (!bot) return;

  const best = room.engine.getBotMove(bot.board);
  if (best == null) return;

  clearTurnTimer(room);
  room.engine.callNumber(best);

  // Check if bot has won
  const botResult = room.engine.validateWin(bot.board);

  // Advance turn to next connected player
  const connected = room.players.filter((p) => p.connected);
  const curIdx = connected.findIndex((p) => p.id === bot.id);
  const nextIdx = (curIdx + 1) % connected.length;
  room.currentTurn = botResult.valid ? null : (connected[nextIdx]?.id ?? null);

  const playerLines = buildPlayerLines(room);
  const nextDeadline = room.currentTurn ? Date.now() + roomSecs(room) * 1000 : null;

  broadcast(room, 'NUMBER_CALLED', {
    number: best,
    calledBy: { id: bot.id, name: bot.name },
    nextTurn: room.currentTurn,
    playerLines,
    turnDeadlineMs: nextDeadline,
  });

  if (botResult.valid) {
    roomService.endGame(room);
    broadcast(room, 'GAME_ENDED', {
      winner: { id: bot.id, name: bot.name },
      lineInfo: botResult,
      reason: 'bingo',
    });
    return;
  }

  if (room.engine.isExhausted()) {
    roomService.endGame(room);
    broadcast(room, 'GAME_ENDED', { winner: null, reason: 'exhausted' });
    return;
  }

  startTurnTimer(room);
}

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
  const deadline = Date.now() + roomSecs(room) * 1000;
  broadcast(room, 'GAME_STARTED', {
    room: roomService.serialize(room),
    currentTurn: room.currentTurn,
    turnDeadlineMs: deadline,
  });
  startTurnTimer(room);
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
