import { createPRNG, shuffleArray } from '../utils/prng.js';

export class GameEngine {
  constructor(boardSize, seed) {
    this.boardSize = boardSize;
    this.seed = seed ?? Date.now();
    this.prng = createPRNG(this.seed);
    this.numberPool = [];
    this.calledNumbers = [];
    this.timer = null;
    this.callIntervalMs = 2000;
    this.running = false;
  }

  generateSequence() {
    const max = this.boardSize * this.boardSize;
    const numbers = Array.from({ length: max }, (_, i) => i + 1);
    this.numberPool = shuffleArray(numbers, this.prng);
    return [...this.numberPool];
  }

  start(onNumber, onExhausted) {
    this.running = true;
    this._callNext(onNumber, onExhausted);
  }

  _callNext(onNumber, onExhausted) {
    if (!this.running) return;
    if (this.numberPool.length === 0) {
      onExhausted();
      return;
    }
    const number = this.numberPool.shift();
    this.calledNumbers.push(number);
    onNumber(number, [...this.calledNumbers]);
    this.timer = setTimeout(() => this._callNext(onNumber, onExhausted), this.callIntervalMs);
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  validateWin(board) {
    const n = this.boardSize;
    const called = new Set(this.calledNumbers);

    for (let r = 0; r < n; r++) {
      const row = board.slice(r * n, (r + 1) * n);
      if (row.every((num) => called.has(num)))
        return { valid: true, type: 'row', index: r };
    }

    for (let c = 0; c < n; c++) {
      const col = Array.from({ length: n }, (_, r) => board[r * n + c]);
      if (col.every((num) => called.has(num)))
        return { valid: true, type: 'col', index: c };
    }

    const diag1 = Array.from({ length: n }, (_, i) => board[i * n + i]);
    if (diag1.every((num) => called.has(num)))
      return { valid: true, type: 'diag', index: 0 };

    const diag2 = Array.from({ length: n }, (_, i) => board[i * n + (n - 1 - i)]);
    if (diag2.every((num) => called.has(num)))
      return { valid: true, type: 'diag', index: 1 };

    return { valid: false };
  }

  isFullBoard(board) {
    const called = new Set(this.calledNumbers);
    return board.every((num) => called.has(num));
  }
}
