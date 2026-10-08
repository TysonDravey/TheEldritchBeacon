/**
 * cheapStall.ts
 *
 * Runs the existing solver's deduction ladder to a fixed point with
 * hypothetical/contradiction-testing disabled (via getNextDeduction's new
 * `skipContradiction` option — same ladder, same cheapest-first ordering,
 * just missing its last and most expensive rung). Reports a precise picture
 * of how much genuine ambiguity is left at that stall point, which is cheap
 * enough to run on every mutation candidate during search.
 */

import { getNextDeduction, getCandidates } from '../../engine/solver';
import { getWatcherPositions } from '../../engine/rules';
import type { Puzzle, CellState, DeductionResult } from '../../engine/boardTypes';

export interface StallResult {
  watchersPlaced: number;
  watchersUnplaced: number;
  unsolvedTerritories: number[];
  /** Cells still 'empty' (not watcher, not ward) — the existing "open cells" metric. */
  rawOpenCells: number;
  /** Cells that are genuinely still a candidate for SOME territory — a subset
   *  of rawOpenCells at a true fixed point (the two should be equal there;
   *  kept distinct so a mismatch is visible rather than silently assumed). */
  activeCandidateCells: number;
  rawOpenFraction: number;
  activeCandidateFraction: number;
  candidateCountByTerritory: Map<number, number>;
  rowsWithCandidates: Set<number>;
  colsWithCandidates: Set<number>;
  cells: CellState[][];
}

export function runToStall(puzzle: Puzzle): StallResult {
  const n = puzzle.size;
  const cells: CellState[][] = Array.from({ length: n }, () => Array(n).fill('empty'));

  let progress = true;
  while (progress) {
    progress = false;
    const d = getNextDeduction(puzzle, cells, 0, { skipContradiction: true });
    if (d) {
      applyDeductionLocal(cells, d, n);
      progress = true;
    }
  }

  const watchers = getWatcherPositions(cells);
  const watchersPlaced = watchers.length;
  const candidates = getCandidates(puzzle, cells);

  const unsolvedTerritories: number[] = [];
  const candidateCountByTerritory = new Map<number, number>();
  const rowsWithCandidates = new Set<number>();
  const colsWithCandidates = new Set<number>();
  let activeCandidateCells = 0;

  for (const [t, cands] of candidates) {
    candidateCountByTerritory.set(t, cands.length);
    if (cands.length > 0) {
      unsolvedTerritories.push(t);
      activeCandidateCells += cands.length;
      for (const [r, c] of cands) {
        rowsWithCandidates.add(r);
        colsWithCandidates.add(c);
      }
    }
  }

  let rawOpenCells = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (cells[r][c] === 'empty') rawOpenCells++;

  const totalCells = n * n;
  return {
    watchersPlaced,
    watchersUnplaced: n - watchersPlaced,
    unsolvedTerritories,
    rawOpenCells,
    activeCandidateCells,
    rawOpenFraction: rawOpenCells / totalCells,
    activeCandidateFraction: activeCandidateCells / totalCells,
    candidateCountByTerritory,
    rowsWithCandidates,
    colsWithCandidates,
    cells,
  };
}

// Local copy of applyDeduction's logic (not exported from solver.ts) — single
// mode only (limit=1), matches the experimental scope of this module.
function applyDeductionLocal(cells: CellState[][], d: DeductionResult, n: number): void {
  cells[d.row][d.col] = d.type === 'watcher' ? 'watcher' : 'ward';
  if (d.type === 'watcher') {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = d.row + dr, nc = d.col + dc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n && cells[nr][nc] === 'empty') cells[nr][nc] = 'ward';
      }
    }
    for (let c = 0; c < n; c++) if (c !== d.col && cells[d.row][c] === 'empty') cells[d.row][c] = 'ward';
    for (let r = 0; r < n; r++) if (r !== d.row && cells[r][d.col] === 'empty') cells[r][d.col] = 'ward';
  }
}

/**
 * Scores a stall result for how promising it is as a hard-puzzle candidate.
 * Hard gate: reject (score 0) unless at least half the watchers are still
 * unplaced — a stall that's nearly done, no matter how many "irrelevant"
 * cells remain unmarked, is not what we're after. Otherwise reward spread:
 * more unsolved territories, more rows/cols still represented, more active
 * candidate cells relative to board size.
 */
export function scoreStall(stall: StallResult, n: number): number {
  const unplacedFraction = stall.watchersUnplaced / n;
  if (unplacedFraction < 0.5) return 0;

  const territorySpread = stall.unsolvedTerritories.length / Math.max(1, stall.watchersUnplaced);
  const rowSpread = stall.rowsWithCandidates.size / Math.max(1, stall.watchersUnplaced);
  const colSpread = stall.colsWithCandidates.size / Math.max(1, stall.watchersUnplaced);

  return (
    unplacedFraction * 0.4 +
    stall.activeCandidateFraction * 0.3 +
    territorySpread * 0.15 +
    rowSpread * 0.075 +
    colSpread * 0.075
  );
}
