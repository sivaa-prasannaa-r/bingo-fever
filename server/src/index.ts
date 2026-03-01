import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { RoomService } from './services/RoomService.js';
import type { Room, Player } from './services/RoomService.js';

const PORT = Number(process.env.PORT) || 3001;
const TURN_SECS_DEFAULT = 15;
const roomService = new RoomService();

// playerId -> WebSocket
const clients = new Map<string, WebSocket>();

const wss = new WebSocketServer({ port: PORT });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function send(ws: WebSocket, type: string, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN)
    ws.send(JSON.stringify({ type, payload }));
}

function broadcast(room: Room, type: string, payload: unknown, excludeId: string | null = null): void {
  for (const player of room.players) {
    if (player.id === excludeId) continue;
    const ws = clients.get(player.id);
    if (ws) send(ws, type, payload);
  }
}

function broadcastRoom(room: Room): void {
  broadcast(room, 'ROOM_UPDATED', roomService.serialize(room));
}

function buildPlayerLines(room: Room) {
  return room.players.map((p) => ({
    playerId: p.id,
    lineCount: room.engine ? room.engine.countCompletedLines(p.board).length : 0,
    lines: room.engine ? room.engine.countCompletedLines(p.board) : [],
  }));
}

// ─── Connection ───────────────────────────────────────────────────────────────

wss.on('connection', (ws: WebSocket) => {
  const playerId = randomUUID();
  let player: Player = { id: playerId, name: 'Player', connected: true, board: null, ready: false, isBot: false };
  clients.set(playerId, ws);

  send(ws, 'CONNECTED', { playerId });

  ws.on('message', (raw: Buffer) => {
    let msg: { type: string; payload?: Record<string, unknown> };
    try { msg = JSON.parse(raw.toString()); }
    catch { return; }
    try { dispatch(ws, player, msg.type, msg.payload ?? {}); }
    catch (err) { send(ws, 'ERROR', { message: (err as Error).message }); }
  });

  ws.on('close', () => {
    player.connected = false;
    clients.delete(playerId);
    const room = roomService.getRoomOf(playerId);
    if (room) {
      broadcastRoom(room);
      if (room.state === 'GAME' && room.currentTurn === playerId) {
        const connected = room.players.filter((p) => p.connected && p.id !== playerId);
        if (connected.length > 0) {
          room.currentTurn = connected[0].id;
          const deadline = Date.now() + roomSecs(room) * 1000;
          broadcast(room, 'TURN_CHANGED', { nextTurn: room.currentTurn, turnDeadlineMs: deadline });
          startTurnTimer(room);
        }
      }
      setTimeout(() => {
        if (!clients.has(playerId)) {
          const updated = roomService.removePlayer(playerId);
          if (updated) broadcastRoom(updated);
        }
      }, 30_000);
    }
  });

  // ─── Message dispatcher ─────────────────────────────────────────────────────

  function dispatch(ws: WebSocket, player: Player, type: string, payload: Record<string, unknown>): void {
    switch (type) {

      // ── Lobby / Room ──────────────────────────────────────────────────────
      case 'CREATE_ROOM': {
        player.name = sanitizeName(payload.playerName);
        const size = clampSize(payload.boardSize);
        const room = roomService.createRoom(player, size, payload.turnWaitSecs as number | undefined);
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

      case 'SET_BOT_DIFFICULTY': {
        const room = requireRoom(playerId);
        if (room.host !== playerId) throw new Error('Only the host can change bot difficulty');
        const bot = room.players.find((p) => p.isBot);
        if (!bot) throw new Error('No bot in room');
        const { difficulty } = payload;
        if (!['easy', 'medium', 'hard'].includes(difficulty as string)) throw new Error('Invalid difficulty');
        bot.difficulty = difficulty as 'easy' | 'medium' | 'hard';
        bot.botTurnCount = 0;
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
        const size = clampSize((payload.boardSize as number | undefined) ?? room.boardSize);
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
        const room = roomService.submitBoard(playerId, payload.arrangement as number[]);
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
        room.engine!.callNumber(number);

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

        if (room.engine!.isExhausted()) {
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
        if (!room.engine!.calledNumbers.includes(number as number)) return;
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
            winnerBoard: p.board,
          });
        } else {
          send(ws, 'WIN_REJECTED', { message: 'Need 5 complete lines for BINGO!' });
        }
        break;
      }

      // ── Play Again ────────────────────────────────────────────────────────
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
        clients.set(savedPlayerId as string, ws);
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

function roomSecs(room: Room): number {
  return room.turnWaitSecs ?? TURN_SECS_DEFAULT;
}

function startTurnTimer(room: Room): void {
  clearTimeout(room.turnTimer ?? undefined);
  const currentPlayer = room.players.find((p) => p.id === room.currentTurn);
  if (currentPlayer?.isBot) {
    const delay = 1000 + Math.random() * 800;
    room.turnDeadlineMs = Date.now() + delay;
    room.turnTimer = setTimeout(() => botTakeTurn(room), delay);
    return;
  }
  const secs = roomSecs(room);
  room.turnDeadlineMs = Date.now() + secs * 1000;
  room.turnTimer = setTimeout(() => autoCallNumber(room), secs * 1000);
}

function clearTurnTimer(room: Room): void {
  clearTimeout(room.turnTimer ?? undefined);
  room.turnTimer = null;
  room.turnDeadlineMs = null;
}

function autoCallNumber(room: Room): void {
  if (room.state !== 'GAME') return;
  const pool = room.engine!.numberPool;
  if (pool.length === 0) return;

  const number = pool[Math.floor(Math.random() * pool.length)];
  room.engine!.callNumber(number);

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
    calledBy: null,
    nextTurn: room.currentTurn,
    playerLines,
    turnDeadlineMs: nextDeadline,
  });

  if (room.engine!.isExhausted()) {
    clearTurnTimer(room);
    roomService.endGame(room);
    broadcast(room, 'GAME_ENDED', { winner: null, reason: 'exhausted' });
    return;
  }

  startTurnTimer(room);
}

function pickBotNumber(room: Room, bot: Player): number | null {
  const calledSet = new Set(room.engine!.calledNumbers);
  const uncalledOnBoard = bot.board!.filter((num) => !calledSet.has(num));
  if (uncalledOnBoard.length === 0) return null;

  const difficulty = bot.difficulty ?? 'hard';

  if (difficulty === 'easy') {
    return uncalledOnBoard[Math.floor(Math.random() * uncalledOnBoard.length)];
  }
  if (difficulty === 'hard') {
    return room.engine!.getBotMove(bot.board!);
  }
  // medium: odd turns = smart, even turns = random
  bot.botTurnCount = (bot.botTurnCount ?? 0) + 1;
  return bot.botTurnCount % 2 === 1
    ? room.engine!.getBotMove(bot.board!)
    : uncalledOnBoard[Math.floor(Math.random() * uncalledOnBoard.length)];
}

function botTakeTurn(room: Room): void {
  if (room.state !== 'GAME') return;
  const bot = room.players.find((p) => p.isBot && p.id === room.currentTurn);
  if (!bot) return;

  const best = pickBotNumber(room, bot);
  if (best == null) return;

  clearTurnTimer(room);
  room.engine!.callNumber(best);

  const botResult = room.engine!.validateWin(bot.board!);

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
      winnerBoard: bot.board,
    });
    return;
  }

  if (room.engine!.isExhausted()) {
    roomService.endGame(room);
    broadcast(room, 'GAME_ENDED', { winner: null, reason: 'exhausted' });
    return;
  }

  startTurnTimer(room);
}

// ─── Game flow helpers ────────────────────────────────────────────────────────

function beginCountdown(room: Room): void {
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

function startGame(room: Room): void {
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

function requireRoom(playerId: string): Room {
  const room = roomService.getRoomOf(playerId);
  if (!room) throw new Error('Not in a room');
  return room;
}

function sanitizeName(raw: unknown): string {
  return String(raw ?? 'Player').trim().slice(0, 20) || 'Player';
}

function clampSize(v: unknown): number {
  return Math.max(5, Math.min(10, Number(v) || 5));
}

console.log(`🎱 Bingo server listening on ws://localhost:${PORT}`);
