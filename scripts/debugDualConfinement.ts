/**
 * debugDualConfinement.ts
 *
 * Checks whether Dual Confinement produces any deductions that the existing
 * sequential row/col confinement techniques don't already handle.
 *
 * Dual Confinement: territory T's candidates fall in exactly ONE row
 * AND exactly ONE column → cell at their intersection is a forced watcher.
 * (This would only fire when |candidates| > 1 but all candidates share
 * both the same row AND the same column — impossible with distinct cells,
 * so the only non-trivial interpretation is the joint-effect version.)
 *
 * We test the "joint effect" interpretation: collect ALL active row and col
 * confinements at each board state, apply their eliminations simultaneously
 * to every territory's candidates, and check if that produces a naked single
 * that the sequential solver hasn't already found.
 */

import { SAMPLE_PUZZLES } from '../data/samplePuzzles';
import { solveWithTrace, getCandidates } from '../engine/solver';
import { getWatcherPositions } from '../engine/rules';
import type { Puzzle, CellState } from '../engine/boardTypes';

function deepCopy(cells: CellState[][]): CellState[][] {
  return cells.map(r => [...r]);
}

function applyDeduction(cells: CellState[][], row: number, col: number, type: 'watcher'|'ward'): void {
  cells[row][col] = type;
  if (type === 'watcher') {
    const n = cells.length;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const nr = row+dr, nc = col+dc;
        if (nr>=0&&nr<n&&nc>=0&&nc<n&&cells[nr][nc]==='empty') cells[nr][nc]='ward';
      }
    for (let c=0;c<n;c++) if (c!==col&&cells[row][c]==='empty') cells[row][c]='ward';
    for (let r=0;r<n;r++) if (r!==row&&cells[r][col]==='empty') cells[r][col]='ward';
  }
}

let dualFired = 0;
let dualNewDeductions = 0;

function checkDualConfinement(puzzle: Puzzle, cells: CellState[][]): boolean {
  const candidates = getCandidates(puzzle, cells);
  const watchers = getWatcherPositions(cells);
  const watcherRows = new Set(watchers.map(([r]) => r));
  const watcherCols = new Set(watchers.map(([, c]) => c));

  // Collect all row-confined territories and their confined rows
  const confinedToRow = new Map<number, number>(); // territory → row
  const confinedToCol = new Map<number, number>(); // territory → col

  for (const [t, cands] of candidates) {
    if (cands.length === 0) continue;
    const rows = new Set(cands.map(([r]) => r));
    const cols = new Set(cands.map(([, c]) => c));
    if (rows.size === 1) confinedToRow.set(t, [...rows][0]);
    if (cols.size === 1) confinedToCol.set(t, [...cols][0]);
  }

  // For each territory T, apply ALL simultaneous row/col confinements from other
  // territories and check if T is reduced to 1 candidate (naked single) that wasn't
  // already a naked single.
  for (const [t, cands] of candidates) {
    if (cands.length <= 1) continue; // already a naked single or stuck; skip

    // Build set of rows blocked by other territories' row-confinements
    const blockedRows = new Set<number>(watcherRows);
    for (const [ot, row] of confinedToRow) {
      if (ot !== t) blockedRows.add(row);
    }
    // Build set of cols blocked by other territories' col-confinements
    const blockedCols = new Set<number>(watcherCols);
    for (const [ot, col] of confinedToCol) {
      if (ot !== t) blockedCols.add(col);
    }

    // Filter T's candidates through all simultaneous row+col blocks
    const remaining = cands.filter(([r, c]) => !blockedRows.has(r) && !blockedCols.has(c));

    if (remaining.length === 1) {
      dualFired++;
      // Check if this is NEW (sequential solver hasn't handled it yet at this state)
      // Sequential solver would find it via: each confinement fires one-at-a-time.
      // At THIS board state, does the sequential solver ALREADY see this as a naked single?
      // It doesn't — cands.length > 1 means T still has multiple candidates in the sequential view.
      // So this IS a new deduction at this board state.
      dualNewDeductions++;
      return true;
    }
  }
  return false;
}

// Run sequential solve, check for dual confinement at each intermediate board state
function analyzeWithDual(puzzle: Puzzle): void {
  const { steps } = solveWithTrace(puzzle);

  // Replay the solve step by step, checking at each state
  const n = puzzle.size;
  const cells: CellState[][] = Array.from({length:n}, () => Array.from({length:n}, (): CellState => 'empty'));

  for (const step of steps) {
    checkDualConfinement(puzzle, cells);
    applyDeduction(cells, step.row, step.col, step.type);
  }
  // Check final state too
  checkDualConfinement(puzzle, cells);
}

for (const puzzle of SAMPLE_PUZZLES) {
  analyzeWithDual(puzzle);
}

console.log(`\nDual confinement opportunities found: ${dualFired}`);
console.log(`Of those, new deductions not yet visible to sequential solver: ${dualNewDeductions}`);
console.log();
