import type { CompletedLine } from '../types';

/** Returns which completed-line indices a given cell position belongs to */
export function getCellLineIds(position: number, completedLines: CompletedLine[], n: number): CompletedLine[] {
  const row = Math.floor(position / n);
  const col = position % n;
  return completedLines.filter((line) => {
    if (line.type === 'row' && line.index === row) return true;
    if (line.type === 'col' && line.index === col) return true;
    if (line.type === 'diag' && line.index === 0 && row === col) return true;
    if (line.type === 'diag' && line.index === 1 && row + col === n - 1) return true;
    return false;
  });
}

export function isInLine(position: number, completedLines: CompletedLine[], n: number): boolean {
  return getCellLineIds(position, completedLines, n).length > 0;
}

/** Returns all completed lines given a board + marked numbers */
export function getAllCompletedLines(board: number[], markedNumbers: Set<number>, n: number): CompletedLine[] {
  const marked = new Set(markedNumbers);
  const lines: CompletedLine[] = [];

  for (let r = 0; r < n; r++) {
    const row = board.slice(r * n, (r + 1) * n);
    if (row.every((num) => marked.has(num))) lines.push({ type: 'row', index: r });
  }
  for (let c = 0; c < n; c++) {
    const col = Array.from({ length: n }, (_, r) => board[r * n + c]);
    if (col.every((num) => marked.has(num))) lines.push({ type: 'col', index: c });
  }
  const d1 = Array.from({ length: n }, (_, i) => board[i * n + i]);
  if (d1.every((num) => marked.has(num))) lines.push({ type: 'diag', index: 0 });
  const d2 = Array.from({ length: n }, (_, i) => board[i * n + (n - 1 - i)]);
  if (d2.every((num) => marked.has(num))) lines.push({ type: 'diag', index: 1 });

  return lines;
}

/** Client-side win check — returns first completed line or null */
export function checkWin(board: number[], markedNumbers: Set<number>, n: number): CompletedLine | null {
  const lines = getAllCompletedLines(board, markedNumbers, n);
  return lines.length > 0 ? lines[0] : null;
}

/** Count near-wins (lines with exactly 1 cell remaining) */
export function nearWinCount(board: number[], markedNumbers: Set<number>, n: number): number {
  const marked = new Set(markedNumbers);
  let count = 0;

  const checkLine = (cells: number[]) => {
    const unmarked = cells.filter((num) => !marked.has(num));
    if (unmarked.length === 1) count++;
  };

  for (let r = 0; r < n; r++) checkLine(board.slice(r * n, (r + 1) * n));
  for (let c = 0; c < n; c++)
    checkLine(Array.from({ length: n }, (_, r) => board[r * n + c]));
  checkLine(Array.from({ length: n }, (_, i) => board[i * n + i]));
  checkLine(Array.from({ length: n }, (_, i) => board[i * n + (n - 1 - i)]));

  return count;
}
