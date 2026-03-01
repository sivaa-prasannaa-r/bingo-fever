import { create } from 'zustand';
import type { Screen, ConnectionState, SerializedRoom, CompletedLine, Winner, PlayerLineInfo } from '../types';

interface VolumeState {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
}

export interface GameState extends VolumeState {
  // Connection
  playerId: string | null;
  connectionState: ConnectionState;

  // Screen
  screen: Screen;

  // Identity
  playerName: string;

  // Room
  room: SerializedRoom | null;

  // Setup
  setupMode: string | null;
  boardArrangement: number[] | null;
  setupDeadlineMs: number | null;
  isSetupComplete: boolean;

  // Game
  calledNumbers: number[];
  lastCalledNumber: number | null;
  lastCalledBy: { id: string; name: string } | null;
  markedNumbers: Set<number>;
  autoMark: boolean;
  completedLines: CompletedLine[];
  pendingWin: boolean;

  // Turn-based
  currentTurn: string | null;
  turnDeadlineMs: number | null;
  playerLines: Record<string, PlayerLineInfo>;

  // Victory
  winner: Winner | null;
  gameEndReason: string | null;
  winnerBoard: number[] | null;

  // Countdown
  countdownValue: number | null;

  // Actions
  setScreen: (screen: Screen) => void;
  setPlayerName: (name: string) => void;
  setPlayerId: (id: string | null) => void;
  setConnectionState: (state: ConnectionState) => void;
  setRoom: (room: SerializedRoom | null) => void;
  setSetupMode: (mode: string | null) => void;
  setBoardArrangement: (arr: number[] | null) => void;
  setSetupDeadlineMs: (ms: number | null) => void;
  setIsSetupComplete: (v: boolean) => void;
  addCalledNumber: (number: number) => void;
  setCalledNumbers: (numbers: number[]) => void;
  markNumber: (number: number) => void;
  setAutoMark: (v: boolean) => void;
  addCompletedLine: (line: CompletedLine) => void;
  setCompletedLines: (lines: CompletedLine[]) => void;
  setPendingWin: (v: boolean) => void;
  setWinner: (winner: Winner | null) => void;
  setGameEndReason: (reason: string | null) => void;
  setWinnerBoard: (board: number[] | null) => void;
  setCountdownValue: (v: number | null) => void;
  setCurrentTurn: (id: string | null) => void;
  setTurnDeadlineMs: (ms: number | null) => void;
  setPlayerLines: (lines: Record<string, PlayerLineInfo>) => void;
  setLastCalledBy: (caller: { id: string; name: string } | null) => void;
  setVolumes: (patch: Partial<VolumeState>) => void;
  resetGameData: () => void;
  resetForNewGame: () => void;
}

const useGameStore = create<GameState>()((set) => ({
  // Connection
  playerId: localStorage.getItem('bingo_pid') || null,
  connectionState: 'disconnected',

  // Screen
  screen: 'LOBBY',

  // Identity
  playerName: localStorage.getItem('bingo_name') || '',

  // Room
  room: null,

  // Setup
  setupMode: null,
  boardArrangement: null,
  setupDeadlineMs: null,
  isSetupComplete: false,

  // Game
  calledNumbers: [],
  lastCalledNumber: null,
  lastCalledBy: null,
  markedNumbers: new Set(),
  autoMark: true,
  completedLines: [],
  pendingWin: false,

  // Turn-based
  currentTurn: null,
  turnDeadlineMs: null,
  playerLines: {},

  // Victory
  winner: null,
  gameEndReason: null,
  winnerBoard: null,

  // Audio
  masterVolume: 0.8,
  musicVolume: 0.5,
  sfxVolume: 0.9,

  // Countdown
  countdownValue: null,

  // Actions
  setScreen: (screen) => set({ screen }),

  setPlayerName: (playerName) => {
    localStorage.setItem('bingo_name', playerName);
    set({ playerName });
  },

  setPlayerId: (playerId) => {
    if (playerId !== null) localStorage.setItem('bingo_pid', playerId);
    else localStorage.removeItem('bingo_pid');
    set({ playerId });
  },

  setConnectionState: (connectionState) => set({ connectionState }),

  setRoom: (room) => set({ room }),

  setSetupMode: (setupMode) => set({ setupMode }),

  setBoardArrangement: (boardArrangement) => set({ boardArrangement }),

  setSetupDeadlineMs: (setupDeadlineMs) => set({ setupDeadlineMs }),

  setIsSetupComplete: (isSetupComplete) => set({ isSetupComplete }),

  addCalledNumber: (number) =>
    set((state) => {
      const newMarked = state.autoMark
        ? new Set([...state.markedNumbers, number])
        : state.markedNumbers;
      return {
        calledNumbers: [...state.calledNumbers, number],
        lastCalledNumber: number,
        markedNumbers: newMarked,
      };
    }),

  setCalledNumbers: (calledNumbers) =>
    set({ calledNumbers, lastCalledNumber: calledNumbers[calledNumbers.length - 1] ?? null }),

  markNumber: (number) =>
    set((state) => ({ markedNumbers: new Set([...state.markedNumbers, number]) })),

  setAutoMark: (autoMark) => set({ autoMark }),

  addCompletedLine: (line) =>
    set((state) => ({ completedLines: [...state.completedLines, line] })),

  setCompletedLines: (completedLines) => set({ completedLines }),

  setPendingWin: (pendingWin) => set({ pendingWin }),

  setWinner: (winner) => set({ winner }),

  setGameEndReason: (gameEndReason) => set({ gameEndReason }),

  setWinnerBoard: (winnerBoard) => set({ winnerBoard }),

  setCountdownValue: (countdownValue) => set({ countdownValue }),

  setCurrentTurn: (currentTurn) => set({ currentTurn }),

  setTurnDeadlineMs: (turnDeadlineMs) => set({ turnDeadlineMs }),

  setPlayerLines: (playerLines) => set({ playerLines }),

  setLastCalledBy: (lastCalledBy) => set({ lastCalledBy }),

  setVolumes: (patch) => set(patch),

  resetGameData: () =>
    set({
      calledNumbers: [],
      lastCalledNumber: null,
      lastCalledBy: null,
      markedNumbers: new Set(),
      completedLines: [],
      pendingWin: false,
      currentTurn: null,
      turnDeadlineMs: null,
      playerLines: {},
      countdownValue: null,
    }),

  resetForNewGame: () =>
    set({
      room: null,
      screen: 'LOBBY',
      setupMode: null,
      boardArrangement: null,
      setupDeadlineMs: null,
      isSetupComplete: false,
      calledNumbers: [],
      lastCalledNumber: null,
      lastCalledBy: null,
      markedNumbers: new Set(),
      autoMark: true,
      completedLines: [],
      pendingWin: false,
      winner: null,
      gameEndReason: null,
      winnerBoard: null,
      countdownValue: null,
      currentTurn: null,
      turnDeadlineMs: null,
      playerLines: {},
    }),
}));

export default useGameStore;
