import { randomUUID } from 'crypto';
import { GameEngine } from './GameEngine.js';
import { createPRNG, shuffleArray } from '../utils/prng.js';

// Random 6-char alphanumeric code (no confusable chars)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genRoomId() {
  return Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
}

export class RoomService {
  constructor() {
    this.rooms = new Map();       // roomId -> room
    this.playerRoom = new Map();  // playerId -> roomId
  }

  createRoom(player, boardSize = 5, turnWaitSecs = 15) {
    const id = genRoomId();
    const room = {
      id,
      boardSize: clamp(boardSize, 5, 10),
      turnWaitSecs: clampTurnSecs(turnWaitSecs),
      state: 'LOBBY',
      host: player.id,
      players: [player],
      engine: null,
      setupDeadlineMs: null,
      setupTimer: null,
      gameSeed: null,
      currentTurn: null,
    };
    this.rooms.set(id, room);
    this.playerRoom.set(player.id, id);
    return room;
  }

  joinRoom(roomId, player) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');
    if (room.state !== 'LOBBY') throw new Error('Game already in progress');
    if (room.players.length >= 4) throw new Error('Room is full (max 4 players)');
    if (room.players.find((p) => p.id === player.id)) return room;
    room.players.push(player);
    this.playerRoom.set(player.id, room.id);
    return room;
  }

  startSetup(roomId, boardSize, onAutoFill) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');
    room.boardSize = clamp(boardSize, 5, 10);
    room.state = 'SETUP';
    room.setupDeadlineMs = Date.now() + 60_000;
    room.players.forEach((p) => {
      if (p.isBot) {
        // Bot always has a board ready immediately
        p.board = autoBoard(room.boardSize);
        p.ready = true;
      } else {
        p.board = null;
        p.ready = false;
      }
    });

    room.setupTimer = setTimeout(() => {
      if (room.state !== 'SETUP') return;
      room.players.forEach((p) => {
        if (!p.ready) {
          p.board = autoBoard(room.boardSize);
          p.ready = true;
        }
      });
      onAutoFill(room);
    }, 60_000);

    return room;
  }

  submitBoard(playerId, arrangement) {
    const room = this._roomOf(playerId);
    const player = room.players.find((p) => p.id === playerId);
    if (!player) throw new Error('Player not in room');
    const expected = room.boardSize ** 2;
    if (!Array.isArray(arrangement) || arrangement.length !== expected)
      throw new Error('Invalid board arrangement');
    player.board = arrangement;
    player.ready = true;
    return room;
  }

  addBot(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');
    if (room.state !== 'LOBBY') throw new Error('Cannot add bot after game has started');
    if (room.players.length >= 4) throw new Error('Room is full (max 4 players)');
    if (room.players.some((p) => p.isBot)) throw new Error('A bot is already in the room');
    const bot = {
      id: `bot-${randomUUID()}`,
      name: 'Computer',
      isBot: true,
      connected: true,
      board: null,
      ready: false,
    };
    room.players.push(bot);
    this.playerRoom.set(bot.id, room.id);
    return room;
  }

  allReady(room) {
    return room.players.length > 0 && room.players.every((p) => p.ready);
  }

  startGame(room) {
    if (room.setupTimer) {
      clearTimeout(room.setupTimer);
      room.setupTimer = null;
    }
    room.state = 'GAME';
    room.gameSeed = Date.now();
    room.engine = new GameEngine(room.boardSize, room.gameSeed);
    room.engine.generateSequence();
    // First turn goes to host
    room.currentTurn = room.host;
    return room;
  }

  claimWin(playerId) {
    const room = this._roomOf(playerId);
    if (room.state !== 'GAME') throw new Error('No active game');
    const player = room.players.find((p) => p.id === playerId);
    if (!player?.board) throw new Error('No board for player');
    return { room, player, result: room.engine.validateWin(player.board) };
  }

  endGame(room) {
    room.engine?.stop();
    room.state = 'ENDED';
  }

  // Reset room to LOBBY for a new round (keep same players)
  playAgain(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');
    room.state = 'LOBBY';
    room.engine = null;
    room.currentTurn = null;
    room.setupDeadlineMs = null;
    if (room.setupTimer) {
      clearTimeout(room.setupTimer);
      room.setupTimer = null;
    }
    room.players.forEach((p) => {
      p.board = null;
      p.ready = false;
    });
    return room;
  }

  removePlayer(playerId) {
    const room = this._roomOf(playerId);
    if (!room) return null;
    room.players = room.players.filter((p) => p.id !== playerId);
    this.playerRoom.delete(playerId);
    if (room.players.length === 0) {
      room.engine?.stop();
      clearTimeout(room.setupTimer);
      this.rooms.delete(room.id);
      return null;
    }
    if (room.host === playerId) room.host = room.players[0].id;
    // If it was this player's turn, advance turn
    if (room.currentTurn === playerId && room.state === 'GAME') {
      const connected = room.players.filter((p) => p.connected);
      room.currentTurn = connected.length > 0 ? connected[0].id : null;
    }
    return room;
  }

  getRoom(id) {
    return this.rooms.get(id) ?? null;
  }

  getRoomOf(playerId) {
    return this._roomOf(playerId);
  }

  reconnect(oldPlayerId, ws, newWs) {
    const room = this._roomOf(oldPlayerId);
    if (!room) return null;
    const player = room.players.find((p) => p.id === oldPlayerId);
    if (!player) return null;
    player.connected = true;
    return { room, player };
  }

  serialize(room) {
    return {
      id: room.id,
      boardSize: room.boardSize,
      turnWaitSecs: room.turnWaitSecs ?? 15,
      state: room.state,
      host: room.host,
      setupDeadlineMs: room.setupDeadlineMs,
      currentTurn: room.currentTurn,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        ready: !!p.ready,
        connected: p.connected !== false,
        isBot: !!p.isBot,
      })),
    };
  }

  _roomOf(playerId) {
    const id = this.playerRoom.get(playerId);
    return id ? this.rooms.get(id) : null;
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, Number(v) || min));
}

function clampTurnSecs(v) {
  const valid = [5, 10, 15, 20, 25];
  const n = Number(v);
  return valid.includes(n) ? n : 15;
}

function autoBoard(n) {
  const arr = Array.from({ length: n * n }, (_, i) => i + 1);
  const prng = createPRNG(Date.now() ^ Math.random() * 0xffffffff);
  return shuffleArray(arr, prng);
}
