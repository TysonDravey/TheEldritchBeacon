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
  mutualExclusion: number;
  hiddenSet: number;
  contradictionTest: number;      // hypothetical, chain ≤ 2 forced steps
  contradictionTestDeep: number;  // hypothetical, chain 3+ forced steps
}

function classifyDeduction(d: DeductionResult): keyof TechniqueRecord {
  if (d.type === 'watcher') return 'naked';
  if (d.reasonType === 'hypothetical') return 'contradictionTest';
  if (d.reasonType === 'dual-confinement') return 'dualConfinement';
  if (d.reasonType === 'territory-dead-end') return 'territoryDeadEnd';
  if (d.reasonType === 'mutual-exclusion') return 'mutualExclusion';
  if (d.reasonType === 'hidden-set-row' || d.reasonType === 'hidden-set-col') return 'hiddenSet';
  if (d.reasonType === 'row-confinement') return 'rowConfinement';
  if (d.reasonType === 'col-confinement') return 'columnConfinement';
  if (d.reasonType === 'pair-row' || d.reasonType === 'pair-col') return 'pairElimination';
  return 'naked';
}

/**
 * Revamped 2026-10-08: the old formula was a raw, unbounded additive sum
 * over every solve step. That made it track solve LENGTH more than real
 * difficulty — a bigger board mechanically needs more naked-singles and
 * confinement passes just from having more cells/territories, regardless of
 * whether it ever requires real structural reasoning. Confirmed in practice:
 * several 9x9 puzzles using zero mutual-exclusion/contradiction-testing
 * outscored 8x8 puzzles that used mutual-exclusion 5 times and
 * contradiction-testing 5 times, purely from step-count volume, badly
 * scrambling campaign difficulty ordering (data/samplePuzzles.ts sorts each
 * region by this score).
 *
 * Fix: split techniques into two groups.
 *   "Mechanical" (naked, row/col confinement, pair elimination, territory
 *   dead-end, dual confinement) — their COUNT scales with board size on its
 *   own, confirmed by this session's own technique-distribution profiling
 *   (territory-dead-end 3.20->4.85/puzzle, pair-row 1.67->3.30/puzzle just
 *   from 6x6->7x7). Dampened with sqrt so volume alone can't dominate.
 *   "Real" (mutual-exclusion, hidden-set, contradiction-test, its deep
 *   variant) — rare, structural, NOT a mechanical byproduct of board size;
 *   a 9x9 board doesn't need more mutual-exclusion events than a 7x7 one
 *   just for being bigger. Kept linear, weighted far higher, so a handful
 *   of real techniques dominates any amount of mechanical volume.
 */
function computeScore(record: TechniqueRecord): number {
  const mechanical =
    Math.sqrt(record.naked) * 1 +
    Math.sqrt(record.rowConfinement + record.columnConfinement) * 2 +
    Math.sqrt(record.pairElimination) * 3 +
    Math.sqrt(record.territoryDeadEnd) * 4 +
    Math.sqrt(record.dualConfinement) * 3;

  const real =
    record.mutualExclusion * 10 +
    record.hiddenSet * 10 +
    record.contradictionTest * 15 +
    record.contradictionTestDeep * 30;

  return Math.round((mechanical + real) * 10) / 10;
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
    mutualExclusion: 0,
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

// Recalibrated 2026-10-08 for the revamped computeScore (see its own comment)
// against the actual resulting distribution: puzzles using zero "real"
// technique (mutual-exclusion/hidden-set/contradiction-test) cluster roughly
// 2-40 by board size/step volume alone (p25=12.5, p50=21.7, p75=31.1,
// p90=39.7 across the existing non-technique puzzle pool); puzzles using
// real technique at all start around 23.5 and mostly land 40+. These
// thresholds keep that separation — Eldritch is now reachable by volume
// alone only at the extreme tail, and is reliably where real technique use
// lands.
function scoreTodifficulty(score: number): Difficulty {
  if (score <= 10) return 'Initiate';
  if (score <= 20) return 'Scholar';
  if (score <= 32) return 'Occultist';
  if (score <= 42) return 'High Priest';
  return 'Eldritch';
}

/**
 * Twin-watcher mode only: true if any territory has exactly one valid
 * non-adjacent pair of cells within it — meaning that territory's 2 watchers
 * are fully forced the instant you look at its shape, no row/column
 * reasoning or contradiction-testing required. engine/generator-twin.ts's
 * findLineTerritory deliberately engineers this (a straight 3-cell line, or
 * that plus one forced-Ward cell off the middle), but this checks the shape
 * directly rather than assuming every puzzle was built that way, so it also
 * credits any older puzzle that happens to have the same property by chance.
 *
 * A 9x9 twin board still needs contradiction-testing somewhere else almost
 * always, so this doesn't change a puzzle's overall difficulty label — it
 * only flags whether the puzzle has a guaranteed easy opening move, which is
 * what actually determines whether the first hint a player sees feels fair.
 */
export function hasForcedOpening(puzzle: Puzzle): boolean {
  const n = puzzle.size;
  const cellsByTerritory = new Map<number, [number, number][]>();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const t = puzzle.territoryMap[r][c];
      let cells = cellsByTerritory.get(t);
      if (!cells) { cells = []; cellsByTerritory.set(t, cells); }
      cells.push([r, c]);
    }
  }
  for (const cells of cellsByTerritory.values()) {
    let validPairs = 0;
    for (let i = 0; i < cells.length && validPairs <= 1; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const [r1, c1] = cells[i];
        const [r2, c2] = cells[j];
        if (Math.abs(r1 - r2) > 1 || Math.abs(c1 - c2) > 1) validPairs++;
      }
    }
    if (validPairs === 1) return true;
  }
  return false;
}
