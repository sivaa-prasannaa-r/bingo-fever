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
  lastCalledBy: null,       // { id, name } — who called the last number
  markedNumbers: new Set(),
  autoMark: true,           // enabled by default
  completedLines: [],       // current player's completed lines (for tile highlighting)
  pendingWin: false,

  // ── Turn-based ──────────────────────────────────────────────────────────────
  currentTurn: null,        // playerId whose turn it is to call a number
  turnDeadlineMs: null,     // Unix timestamp when current turn expires
  playerLines: {},          // { [playerId]: { lineCount, lines: [{type, index}] } }

  // ── Victory ─────────────────────────────────────────────────────────────────
  winner: null,
  gameEndReason: null,
  winnerBoard: null,

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

  setWinnerBoard: (winnerBoard) => set({ winnerBoard }),

  setCountdownValue: (countdownValue) => set({ countdownValue }),

  setCurrentTurn: (currentTurn) => set({ currentTurn }),

  setTurnDeadlineMs: (turnDeadlineMs) => set({ turnDeadlineMs }),

  setPlayerLines: (playerLines) => set({ playerLines }),

  setLastCalledBy: (lastCalledBy) => set({ lastCalledBy }),

  setVolumes: (patch) => set(patch),

  // Reset mid-game data when a new game starts (keeps boardArrangement)
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
