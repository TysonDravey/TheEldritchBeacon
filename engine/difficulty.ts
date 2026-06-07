import type { Puzzle, Difficulty, CellState, DeductionResult } from './boardTypes';
import {
  getCandidates,
  findContradictions,
  getNextDeduction,
  computeCascadeSteps,
} from './solver';
import { isSolved } from './rules';

// ---------------------------------------------------------------------------
// Internal scoring
// ---------------------------------------------------------------------------

interface TechniqueRecord {
  naked: number;
  rowConfinement: number;
  columnConfinement: number;
  dualConfinement: number;
  pairElimination: number;
  territoryDeadEnd: number;
  hiddenSet: number;
  contradictionTest: number;      // hypothetical, chain ≤ 2 forced steps
  contradictionTestDeep: number;  // hypothetical, chain 3+ forced steps
}

function classifyDeduction(d: DeductionResult): keyof TechniqueRecord {
  if (d.type === 'watcher') return 'naked';
  if (d.reasonType === 'hypothetical') return 'contradictionTest';
  if (d.reasonType === 'dual-confinement') return 'dualConfinement';
  if (d.reasonType === 'territory-dead-end') return 'territoryDeadEnd';
  if (d.reasonType === 'hidden-set-row' || d.reasonType === 'hidden-set-col') return 'hiddenSet';
  if (d.reasonType === 'row-confinement') return 'rowConfinement';
  if (d.reasonType === 'col-confinement') return 'columnConfinement';
  if (d.reasonType === 'pair-row' || d.reasonType === 'pair-col') return 'pairElimination';
  return 'naked';
}

function computeScore(record: TechniqueRecord): number {
  return (
    record.naked * 1 +
    record.rowConfinement * 2 +
    record.columnConfinement * 2 +
    record.dualConfinement * 3 +
    record.pairElimination * 3 +
    record.territoryDeadEnd * 4 +
    record.hiddenSet * 4 +
    record.contradictionTest * 5 +
    record.contradictionTestDeep * 12
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
function buildRecord(puzzle: Puzzle): TechniqueRecord {
  const n = puzzle.size;
  const cells: CellState[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, (): CellState => 'empty')
  );

  const record: TechniqueRecord = {
    naked: 0,
    rowConfinement: 0,
    columnConfinement: 0,
    dualConfinement: 0,
    pairElimination: 0,
    territoryDeadEnd: 0,
    hiddenSet: 0,
    contradictionTest: 0,
    contradictionTestDeep: 0,
  };

  let progress = true;
  while (progress) {
    progress = false;
    if (isSolved(puzzle, cells)) break;
    const contradiction = findContradictions(puzzle, cells);
    if (contradiction.found) break;
    const d = getNextDeduction(puzzle, cells);
    if (!d) break;
    if (d.reasonType === 'hypothetical') {
      const chain = computeCascadeSteps(puzzle, cells, d.row, d.col);
      if (chain.length >= 3) record.contradictionTestDeep++;
      else record.contradictionTest++;
    } else {
      record[classifyDeduction(d)]++;
    }
    progress = true;
    applyDeductionToBoard(cells, d, n);
  }

  return record;
}

export function rateDifficulty(puzzle: Puzzle): Difficulty {
  const record = buildRecord(puzzle);
  if (record.contradictionTestDeep > 0) return 'Unbound';
  if (record.contradictionTest > 0) return 'Archon';
  if (record.hiddenSet > 0) return 'Harbinger';
  return scoreTodifficulty(computeScore(record));
}

/** Returns the raw numeric difficulty score for use in the UI. */
export function scorePuzzle(puzzle: Puzzle): number {
  return computeScore(buildRecord(puzzle));
}

function scoreTodifficulty(score: number): Difficulty {
  if (score <= 8)  return 'Initiate';
  if (score <= 22) return 'Scholar';
  if (score <= 45) return 'Occultist';
  if (score <= 85) return 'High Priest';
  return 'Eldritch';
}
