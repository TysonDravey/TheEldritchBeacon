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
  nakedSinglesSinceLastChain: number;
  chainBonus: number;
}

function classifyDeduction(d: DeductionResult): keyof Omit<TechniqueRecord, 'nakedSinglesSinceLastChain' | 'chainBonus'> {
  if (d.type === 'watcher') return 'naked';
  if (d.reason.includes('confined to row') || d.reason.includes('only place its Watcher in row')) {
    return 'rowConfinement';
  }
  if (d.reason.includes('confined to column') || d.reason.includes('only place its Watcher in column')) {
    return 'columnConfinement';
  }
  if (d.reason.includes('confined to rows') || d.reason.includes('confined to columns')) {
    return 'pairElimination';
  }
  // adjacency / warden-style ward deductions count as naked
  return 'naked';
}

function computeScore(record: TechniqueRecord): number {
  return (
    record.naked * 1 +
    record.rowConfinement * 2 +
    record.columnConfinement * 2 +
    record.pairElimination * 3 +
    record.chainBonus * 5
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
    nakedSinglesSinceLastChain: 0,
    chainBonus: 0,
  };

  let stepsSinceNakedSingle = 0;

  let progress = true;
  while (progress) {
    progress = false;

    if (isSolved(puzzle, cells)) break;
    const contradiction = findContradictions(puzzle, cells);
    if (contradiction.found) break;

    const d = getNextDeduction(puzzle, cells);
    if (!d) break;

    const technique = classifyDeduction(d);
    record[technique]++;
    progress = true;

    if (technique === 'naked') {
      // Check if we've gone more than 4 non-naked steps before this naked single
      if (stepsSinceNakedSingle > 4) {
        record.chainBonus++;
      }
      stepsSinceNakedSingle = 0;
    } else {
      stepsSinceNakedSingle++;
    }

    applyDeductionToBoard(cells, d, n);
  }

  const score = computeScore(record);
  return scoreTodifficulty(score);
}

function scoreTodifficulty(score: number): Difficulty {
  if (score <= 5) return 'Initiate';
  if (score <= 12) return 'Scholar';
  if (score <= 20) return 'Occultist';
  if (score <= 30) return 'High Priest';
  return 'Eldritch';
}
