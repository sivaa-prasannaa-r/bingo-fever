import { createPRNG, shuffleArray } from '../utils/prng.js';

export class GameEngine {
  constructor(boardSize, seed) {
    this.boardSize = boardSize;
    this.seed = seed ?? Date.now();
    this.prng = createPRNG(this.seed);
    this.numberPool = [];   // uncalled numbers (any order — player picks)
    this.calledNumbers = [];
  }

  generateSequence() {
    const max = this.boardSize * this.boardSize;
    // Full pool — players choose which number to call each turn
    this.numberPool = Array.from({ length: max }, (_, i) => i + 1);
    return [...this.numberPool];
  }

  // Player-driven: call a specific number on their turn
  callNumber(number) {
    const idx = this.numberPool.indexOf(number);
    if (idx === -1) throw new Error('Number already called or invalid');
    this.numberPool.splice(idx, 1);
    this.calledNumbers.push(number);
    return [...this.calledNumbers];
  }

  isExhausted() {
    return this.numberPool.length === 0;
  }

  // Returns all completed lines for a board given current calledNumbers
  countCompletedLines(board) {
    if (!board) return [];
    const n = this.boardSize;
    const called = new Set(this.calledNumbers);
    const lines = [];

    for (let r = 0; r < n; r++) {
      const row = board.slice(r * n, (r + 1) * n);
      if (row.every((num) => called.has(num))) lines.push({ type: 'row', index: r });
    }
    for (let c = 0; c < n; c++) {
      const col = Array.from({ length: n }, (_, r) => board[r * n + c]);
      if (col.every((num) => called.has(num))) lines.push({ type: 'col', index: c });
    }
    const d1 = Array.from({ length: n }, (_, i) => board[i * n + i]);
    if (d1.every((num) => called.has(num))) lines.push({ type: 'diag', index: 0 });
    const d2 = Array.from({ length: n }, (_, i) => board[i * n + (n - 1 - i)]);
    if (d2.every((num) => called.has(num))) lines.push({ type: 'diag', index: 1 });

    return lines;
  }

  // Win requires >= 5 completed lines (B-I-N-G-O)
  validateWin(board) {
    const lines = this.countCompletedLines(board);
    if (lines.length >= 5) return { valid: true, lines };
    return { valid: false };
  }

  stop() {
    // No auto-timer in turn-based mode — nothing to stop
  }
}
