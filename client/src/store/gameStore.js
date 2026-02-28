import { create } from 'zustand';

const useGameStore = create((set, get) => ({
  // ── Connection ──────────────────────────────────────────────────────────────
  playerId: localStorage.getItem('bingo_pid') || null,
  connectionState: 'disconnected',

  // ── Screen ──────────────────────────────────────────────────────────────────
  screen: 'LOBBY',

  // ── Identity ─────────────────────────────────────────────────────────────────
  playerName: localStorage.getItem('bingo_name') || '',

  // ── Room ────────────────────────────────────────────────────────────────────
  room: null,

  // ── Setup ───────────────────────────────────────────────────────────────────
  setupMode: null,
  boardArrangement: null,
  setupDeadlineMs: null,
  isSetupComplete: false,

  // ── Game ────────────────────────────────────────────────────────────────────
  calledNumbers: [],
  lastCalledNumber: null,
  markedNumbers: new Set(),
  autoMark: false,
  completedLines: [],
  pendingWin: false,

  // ── Victory ─────────────────────────────────────────────────────────────────
  winner: null,
  gameEndReason: null,

  // ── Audio ───────────────────────────────────────────────────────────────────
  masterVolume: 0.8,
  musicVolume: 0.5,
  sfxVolume: 0.9,

  // ── Countdown overlay ───────────────────────────────────────────────────────
  countdownValue: null,

  // ── Actions ─────────────────────────────────────────────────────────────────
  setScreen: (screen) => set({ screen }),

  setPlayerName: (playerName) => {
    localStorage.setItem('bingo_name', playerName);
    set({ playerName });
  },

  setPlayerId: (playerId) => {
    localStorage.setItem('bingo_pid', playerId);
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

  setCountdownValue: (countdownValue) => set({ countdownValue }),

  setVolumes: (patch) => set(patch),

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
      markedNumbers: new Set(),
      autoMark: false,
      completedLines: [],
      pendingWin: false,
      winner: null,
      gameEndReason: null,
      countdownValue: null,
    }),
}));

export default useGameStore;
