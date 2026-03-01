import { randomUUID } from 'crypto';
import { GameEngine } from './GameEngine.js';
import { createPRNG, shuffleArray } from '../utils/prng.js';
import type { Difficulty, RoomState, SerializedRoom, WinResult } from '../types.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genRoomId(): string {
  return Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
}

export interface Player {
  id: string;
  name: string;
  isBot: boolean;
  connected: boolean;
  board: number[] | null;
  ready: boolean;
  difficulty?: Difficulty;
  botTurnCount?: number;
}

export interface Room {
  id: string;
  boardSize: number;
  turnWaitSecs: number;
  state: RoomState;
  host: string;
  players: Player[];
  engine: GameEngine | null;
  setupDeadlineMs: number | null;
  setupTimer: ReturnType<typeof setTimeout> | null;
  gameSeed: number | null;
  currentTurn: string | null;
  turnTimer: ReturnType<typeof setTimeout> | null;
  turnDeadlineMs: number | null;
}

export class RoomService {
  private rooms = new Map<string, Room>();
  private playerRoom = new Map<string, string>();

  createRoom(player: Player, boardSize = 5, turnWaitSecs = 15): Room {
    const id = genRoomId();
    const room: Room = {
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
      turnTimer: null,
      turnDeadlineMs: null,
    };
    this.rooms.set(id, room);
    this.playerRoom.set(player.id, id);
    return room;
  }

  joinRoom(roomId: string, player: Player): Room {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');
    if (room.state !== 'LOBBY') throw new Error('Game already in progress');
    if (room.players.length >= 4) throw new Error('Room is full (max 4 players)');
    if (room.players.find((p) => p.id === player.id)) return room;
    room.players.push(player);
    this.playerRoom.set(player.id, room.id);
    return room;
  }

  startSetup(roomId: string, boardSize: number, onAutoFill: (room: Room) => void): Room {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');
    room.boardSize = clamp(boardSize, 5, 10);
    room.state = 'SETUP';
    room.setupDeadlineMs = Date.now() + 60_000;
    room.players.forEach((p) => {
      if (p.isBot) {
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

  submitBoard(playerId: string, arrangement: number[]): Room {
    const room = this._roomOf(playerId);
    if (!room) throw new Error('Not in a room');
    const player = room.players.find((p) => p.id === playerId);
    if (!player) throw new Error('Player not in room');
    const expected = room.boardSize ** 2;
    if (!Array.isArray(arrangement) || arrangement.length !== expected)
      throw new Error('Invalid board arrangement');
    player.board = arrangement;
    player.ready = true;
    return room;
  }

  addBot(roomId: string): Room {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');
    if (room.state !== 'LOBBY') throw new Error('Cannot add bot after game has started');
    if (room.players.length >= 4) throw new Error('Room is full (max 4 players)');
    if (room.players.some((p) => p.isBot)) throw new Error('A bot is already in the room');
    const bot: Player = {
      id: `bot-${randomUUID()}`,
      name: 'Computer',
      isBot: true,
      connected: true,
      board: null,
      ready: false,
      difficulty: 'hard',
      botTurnCount: 0,
    };
    room.players.push(bot);
    this.playerRoom.set(bot.id, room.id);
    return room;
  }

  allReady(room: Room): boolean {
    return room.players.length > 0 && room.players.every((p) => p.ready);
  }

  startGame(room: Room): Room {
    if (room.setupTimer) {
      clearTimeout(room.setupTimer);
      room.setupTimer = null;
    }
    room.state = 'GAME';
    room.gameSeed = Date.now();
    room.engine = new GameEngine(room.boardSize, room.gameSeed);
    room.engine.generateSequence();
    room.currentTurn = room.host;
    return room;
  }

  claimWin(playerId: string): { room: Room; player: Player; result: WinResult } {
    const room = this._roomOf(playerId);
    if (!room) throw new Error('Not in a room');
    if (room.state !== 'GAME') throw new Error('No active game');
    const player = room.players.find((p) => p.id === playerId);
    if (!player?.board) throw new Error('No board for player');
    if (!room.engine) throw new Error('No game engine');
    return { room, player, result: room.engine.validateWin(player.board) };
  }

  endGame(room: Room): void {
    room.engine?.stop();
    room.state = 'ENDED';
  }

  playAgain(roomId: string): Room {
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
      if (p.isBot) p.botTurnCount = 0;
    });
    return room;
  }

  removePlayer(playerId: string): Room | null {
    const room = this._roomOf(playerId);
    if (!room) return null;
    room.players = room.players.filter((p) => p.id !== playerId);
    this.playerRoom.delete(playerId);
    if (room.players.length === 0) {
      room.engine?.stop();
      if (room.setupTimer) clearTimeout(room.setupTimer);
      this.rooms.delete(room.id);
      return null;
    }
    if (room.host === playerId) room.host = room.players[0].id;
    if (room.currentTurn === playerId && room.state === 'GAME') {
      const connected = room.players.filter((p) => p.connected);
      room.currentTurn = connected.length > 0 ? connected[0].id : null;
    }
    return room;
  }

  getRoom(id: string): Room | null {
    return this.rooms.get(id) ?? null;
  }

  getRoomOf(playerId: string): Room | null {
    return this._roomOf(playerId);
  }

  reconnect(oldPlayerId: string): { room: Room; player: Player } | null {
    const room = this._roomOf(oldPlayerId);
    if (!room) return null;
    const player = room.players.find((p) => p.id === oldPlayerId);
    if (!player) return null;
    player.connected = true;
    return { room, player };
  }

  serialize(room: Room): SerializedRoom {
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
        difficulty: p.isBot ? (p.difficulty ?? 'hard') : undefined,
      })),
    };
  }

  _roomOf(playerId: string): Room | null {
    const id = this.playerRoom.get(playerId);
    return id ? (this.rooms.get(id) ?? null) : null;
  }
}

function clamp(v: unknown, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number(v) || min));
}

function clampTurnSecs(v: unknown): number {
  const valid = [5, 10, 15, 20, 25];
  const n = Number(v);
  return valid.includes(n) ? n : 15;
}

function autoBoard(n: number): number[] {
  const arr = Array.from({ length: n * n }, (_, i) => i + 1);
  const prng = createPRNG(Date.now() ^ (Math.random() * 0xffffffff));
  return shuffleArray(arr, prng);
}
