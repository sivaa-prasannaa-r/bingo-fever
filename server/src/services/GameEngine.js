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

  // Smart bot: pick the uncalled number on `board` that scores highest.
  // Score(num) = Σ over lines containing num: 2^(already_called_in_that_line)
  // Exponential weighting strongly prefers finishing near-complete lines.
  getBotMove(board) {
    const n = this.boardSize;
    const calledSet = new Set(this.calledNumbers);
    const uncalled = board.filter((num) => !calledSet.has(num));
    if (uncalled.length === 0) return null;

    const lines = [];
    for (let r = 0; r < n; r++) lines.push(board.slice(r * n, (r + 1) * n));
    for (let c = 0; c < n; c++) lines.push(Array.from({ length: n }, (_, r) => board[r * n + c]));
    lines.push(Array.from({ length: n }, (_, i) => board[i * n + i]));
    lines.push(Array.from({ length: n }, (_, i) => board[i * n + (n - 1 - i)]));

    const scores = new Map(uncalled.map((num) => [num, 0]));
    for (const line of lines) {
      const calledCount = line.filter((x) => calledSet.has(x)).length;
      const weight = 1 << calledCount; // 1, 2, 4, 8, 16 — near-done lines dominate
      for (const num of line) {
        if (scores.has(num)) scores.set(num, scores.get(num) + weight);
      }
    }

    let best = uncalled[0], bestScore = -1;
    for (const [num, score] of scores) {
      if (score > bestScore) { bestScore = score; best = num; }
    }
    return best;
  }

  stop() {
    // No auto-timer in turn-based mode — nothing to stop
  }
}
