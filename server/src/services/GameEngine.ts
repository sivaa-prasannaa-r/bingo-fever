import { createPRNG } from '../utils/prng.js';
import type { Line, WinResult } from '../types.js';

export class GameEngine {
  boardSize: number;
  seed: number;
  private prng: () => number;
  numberPool: number[];
  calledNumbers: number[];

  constructor(boardSize: number, seed?: number) {
    this.boardSize = boardSize;
    this.seed = seed ?? Date.now();
    this.prng = createPRNG(this.seed);
    this.numberPool = [];
    this.calledNumbers = [];
  }

  generateSequence(): number[] {
    const max = this.boardSize * this.boardSize;
    this.numberPool = Array.from({ length: max }, (_, i) => i + 1);
    return [...this.numberPool];
  }

  callNumber(number: number): number[] {
    const idx = this.numberPool.indexOf(number);
    if (idx === -1) throw new Error('Number already called or invalid');
    this.numberPool.splice(idx, 1);
    this.calledNumbers.push(number);
    return [...this.calledNumbers];
  }

  isExhausted(): boolean {
    return this.numberPool.length === 0;
  }

  countCompletedLines(board: number[] | null): Line[] {
    if (!board) return [];
    const n = this.boardSize;
    const called = new Set(this.calledNumbers);
    const lines: Line[] = [];

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

  validateWin(board: number[]): WinResult {
    const lines = this.countCompletedLines(board);
    if (lines.length >= 5) return { valid: true, lines };
    return { valid: false };
  }

  getBotMove(board: number[]): number | null {
    const n = this.boardSize;
    const calledSet = new Set(this.calledNumbers);
    const uncalled = board.filter((num) => !calledSet.has(num));
    if (uncalled.length === 0) return null;

    const lines: number[][] = [];
    for (let r = 0; r < n; r++) lines.push(board.slice(r * n, (r + 1) * n));
    for (let c = 0; c < n; c++) lines.push(Array.from({ length: n }, (_, r) => board[r * n + c]));
    lines.push(Array.from({ length: n }, (_, i) => board[i * n + i]));
    lines.push(Array.from({ length: n }, (_, i) => board[i * n + (n - 1 - i)]));

    const scores = new Map<number, number>(uncalled.map((num) => [num, 0]));
    for (const line of lines) {
      const calledCount = line.filter((x) => calledSet.has(x)).length;
      const weight = 1 << calledCount;
      for (const num of line) {
        if (scores.has(num)) scores.set(num, scores.get(num)! + weight);
      }
    }

    let best = uncalled[0];
    let bestScore = -1;
    for (const [num, score] of scores) {
      if (score > bestScore) { bestScore = score; best = num; }
    }
    return best;
  }

  stop(): void {
    // No auto-timer in turn-based mode
  }
}
