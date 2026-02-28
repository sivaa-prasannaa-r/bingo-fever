import { GameEngine } from './GameEngine.js';
import { createPRNG, shuffleArray } from '../utils/prng.js';

let roomCounter = 1000;

function genRoomId() {
  return (roomCounter++).toString(36).toUpperCase().padStart(4, '0');
}

export class RoomService {
  constructor() {
    this.rooms = new Map();       // roomId -> room
    this.playerRoom = new Map();  // playerId -> roomId
  }

  createRoom(player, boardSize = 5) {
    const id = genRoomId();
    const room = {
      id,
      boardSize: clamp(boardSize, 5, 10),
      state: 'LOBBY',
      host: player.id,
      players: [player],
      engine: null,
      setupDeadlineMs: null,
      setupTimer: null,
      gameSeed: null,
    };
    this.rooms.set(id, room);
    this.playerRoom.set(player.id, id);
    return room;
  }

  joinRoom(roomId, player) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');
    if (room.state !== 'LOBBY') throw new Error('Game already in progress');
    if (room.players.length >= 8) throw new Error('Room is full');
    if (room.players.find((p) => p.id === player.id)) return room; // already in
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
      p.board = null;
      p.ready = false;
    });

    // Auto-fill remaining players after 60 s
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
      state: room.state,
      host: room.host,
      setupDeadlineMs: room.setupDeadlineMs,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        ready: !!p.ready,
        connected: p.connected !== false,
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

function autoBoard(n) {
  const arr = Array.from({ length: n * n }, (_, i) => i + 1);
  const prng = createPRNG(Date.now() ^ Math.random() * 0xffffffff);
  return shuffleArray(arr, prng);
}
