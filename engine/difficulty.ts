import type { Puzzle, Difficulty, CellState, DeductionResult } from './boardTypes';
import {
  getCandidates,
  findContradictions,
  getNextDeduction,
} from './solver';
import { isSolved } from './rules';

// ---------------------------------------------------------------------------
// Internal scoring
// ---------------------------------------------------------------------------

interface TechniqueRecord {
  naked: number;
  rowConfinement: number;
  columnConfinement: number;
  pairElimination: number;
  hiddenSet: number;
  contradictionTest: number;
}

function classifyDeduction(d: DeductionResult): keyof TechniqueRecord {
  if (d.type === 'watcher') return 'naked';
  if (d.reasonType === 'hypothetical') return 'contradictionTest';
  if (d.reasonType === 'hidden-set-row' || d.reasonType === 'hidden-set-col') return 'hiddenSet';
  if (d.reason.includes('confined to row') || d.reason.includes('only place its Watcher in row')) {
    return 'rowConfinement';
  }
  if (d.reason.includes('confined to column') || d.reason.includes('only place its Watcher in column')) {
    return 'columnConfinement';
  }
  if (d.reason.includes('confined to rows') || d.reason.includes('confined to columns')) {
    return 'pairElimination';
  }
  return 'naked';
}

function computeScore(record: TechniqueRecord): number {
  return (
    record.naked * 1 +
    record.rowConfinement * 2 +
    record.columnConfinement * 2 +
    record.pairElimination * 3 +
    record.contradictionTest * 5
  );
}

function applyDeductionToBoard(cells: CellState[][], d: DeductionResult, n: number): void {
  cells[d.row][d.col] = d.type === 'watcher' ? 'watcher' : 'ward';
  if (d.type === 'watcher') {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = d.row + dr;
        const nc = d.col + dc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < cells[nr].length) {
          if (cells[nr][nc] === 'empty') cells[nr][nc] = 'ward';
        }
      }
    }
    for (let c = 0; c < n; c++) {
      if (c !== d.col && cells[d.row][c] === 'empty') cells[d.row][c] = 'ward';
    }
    for (let r = 0; r < n; r++) {
      if (r !== d.row && cells[r][d.col] === 'empty') cells[r][d.col] = 'ward';
    }
  }
}

// ---------------------------------------------------------------------------
// rateDifficulty
// ---------------------------------------------------------------------------

/**
 * Simulates a logical solve, records which techniques were used, and maps
 * the resulting score to a Difficulty label.
 *
 * Scoring weights:
 *   naked (watcher placement)  × 1
 *   row/col confinement        × 2
 *   pair elimination           × 3
 *   contradiction test         × 5
 *
 * Thresholds are calibrated so:
 *   Initiate  — naked singles only (or trivial confinement)
 *   Scholar   — moderate row/col confinement
 *   Occultist — significant confinement + light pair/contradiction
 *   High Priest — pair elimination and/or several contradictions
 *   Eldritch  — heavy pair elimination and/or many contradictions
 */
export function rateDifficulty(puzzle: Puzzle): Difficulty {
  const n = puzzle.size;
  const cells: CellState[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, (): CellState => 'empty')
  );

  const record: TechniqueRecord = {
    naked: 0,
    rowConfinement: 0,
    columnConfinement: 0,
    pairElimination: 0,
    hiddenSet: 0,
    contradictionTest: 0,
  };

  let progress = true;
  while (progress) {
    progress = false;

    if (isSolved(puzzle, cells)) break;
    const contradiction = findContradictions(puzzle, cells);
    if (contradiction.found) break;

    const d = getNextDeduction(puzzle, cells);
    if (!d) break;

    record[classifyDeduction(d)]++;
    progress = true;
    applyDeductionToBoard(cells, d, n);
  }

  // Any puzzle requiring hypothesis-based contradiction testing is Archon —
  // qualitatively harder than forward-reasoning alone.
  if (record.contradictionTest > 0) return 'Archon';
  if (record.hiddenSet > 0) return 'Harbinger';
  return scoreTodifficulty(computeScore(record));
}

function scoreTodifficulty(score: number): Difficulty {
  if (score <= 8)  return 'Initiate';
  if (score <= 22) return 'Scholar';
  if (score <= 45) return 'Occultist';
  if (score <= 85) return 'High Priest';
  return 'Eldritch';
}
