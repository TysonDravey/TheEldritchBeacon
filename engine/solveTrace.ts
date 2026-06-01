import type { Puzzle, CellState, DeductionResult, DeductionReasonType } from './boardTypes';
import { getNextDeduction, getCandidates, findContradictions } from './solver';
import { isSolved } from './rules';

// ---------------------------------------------------------------------------
// Solve trace types
// ---------------------------------------------------------------------------

export type TechniqueLabel =
  | 'Adjacency / Row / Col / Territory Cleanup'
  | 'Naked Single'
  | 'Row Confinement'
  | 'Column Confinement'
  | 'Group Elimination'
  | 'Contradiction Test';

export interface TraceStep {
  deduction: DeductionResult;
  technique: TechniqueLabel;
  cellsAfter: CellState[][];
  // Cells placed in this specific step (for board animation)
  newCells: [number, number][];
  // Board highlight metadata for the generate page
  highlightRows?: number[];
  highlightCols?: number[];
  highlightTerritories?: number[];
  secondaryCells?: [number, number][];   // brass-outlined cause cells
  // For cleanup batch steps: all cells warded in one sweep
  batchCells?: [number, number][];
}

export interface TraceWave {
  waveIndex: number;
  steps: TraceStep[];
  /** All steps in this wave can be done independently (same starting state). */
  parallel: boolean;
}

export interface SolveTrace {
  puzzle: Puzzle;
  waves: TraceWave[];
  solved: boolean;
  stuck: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function techniqueLabel(rt: DeductionReasonType | undefined): TechniqueLabel {
  switch (rt) {
    case 'adjacency':
    case 'row-occupied':
    case 'col-occupied':
    case 'territory-occupied':
      return 'Adjacency / Row / Col / Territory Cleanup';
    case 'naked-single-territory':
    case 'naked-single-row':
    case 'naked-single-col':
      return 'Naked Single';
    case 'row-confinement':
      return 'Row Confinement';
    case 'col-confinement':
      return 'Column Confinement';
    case 'pair-row':
    case 'pair-col':
      return 'Group Elimination';
    case 'hypothetical':
      return 'Contradiction Test';
    default:
      return 'Naked Single';
  }
}

function deepCopy(cells: CellState[][]): CellState[][] {
  return cells.map(row => [...row]);
}

function cellsEqual(a: CellState[][], b: CellState[][]): boolean {
  for (let r = 0; r < a.length; r++)
    for (let c = 0; c < a[r].length; c++)
      if (a[r][c] !== b[r][c]) return false;
  return true;
}

// ---------------------------------------------------------------------------
// computeStepHighlight — derive board highlight metadata from a deduction
// ---------------------------------------------------------------------------

function computeStepHighlight(
  d: DeductionResult,
  puzzle: Puzzle,
): Pick<TraceStep, 'highlightRows' | 'highlightCols' | 'highlightTerritories' | 'secondaryCells'> {
  switch (d.reasonType) {
    case 'naked-single-territory':
      return { highlightTerritories: [puzzle.territoryMap[d.row][d.col]] };
    case 'naked-single-row':
      return { highlightRows: [d.row], highlightTerritories: d.affectedTerritories?.slice(0, 1) };
    case 'naked-single-col':
      return { highlightCols: [d.col], highlightTerritories: d.affectedTerritories?.slice(0, 1) };
    case 'row-confinement':
      return {
        highlightRows: [d.row],
        highlightTerritories: d.confinedTerritory !== undefined ? [d.confinedTerritory] : undefined,
      };
    case 'col-confinement':
      return {
        highlightCols: [d.col],
        highlightTerritories: d.confinedTerritory !== undefined ? [d.confinedTerritory] : undefined,
      };
    case 'pair-row':
      return { highlightRows: [d.row], highlightTerritories: d.pairedTerritories };
    case 'pair-col':
      return { highlightCols: [d.col], highlightTerritories: d.pairedTerritories };
    case 'row-occupied':
      return { highlightRows: [d.row], secondaryCells: d.blockedBy ? [d.blockedBy] : undefined };
    case 'col-occupied':
      return { highlightCols: [d.col], secondaryCells: d.blockedBy ? [d.blockedBy] : undefined };
    case 'territory-occupied':
      return {
        highlightTerritories: [puzzle.territoryMap[d.row][d.col]],
        secondaryCells: d.blockedBy ? [d.blockedBy] : undefined,
      };
    case 'adjacency':
      return { secondaryCells: d.blockedBy ? [d.blockedBy] : undefined };
    case 'hypothetical':
      return { highlightTerritories: d.affectedTerritories };
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// buildSolveTrace
// ---------------------------------------------------------------------------

/**
 * Runs the solver step by step and groups deductions into waves.
 *
 * A wave is a set of deductions that all flow from the same board state —
 * i.e. they could theoretically be spotted in parallel by a human.
 * Once any deduction in a wave is applied, a new wave begins.
 *
 * We group consecutive deductions of the SAME technique made from the SAME
 * board snapshot into one wave.
 */
export function buildSolveTrace(puzzle: Puzzle): SolveTrace {
  const n = puzzle.size;
  let cells: CellState[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, (): CellState => 'empty')
  );

  const waves: TraceWave[] = [];
  let waveIndex = 0;

  while (true) {
    if (isSolved(puzzle, cells)) break;

    const contradiction = findContradictions(puzzle, cells);
    if (contradiction.found) break;

    // Collect ALL deductions available from THIS board state
    // by running the solver repeatedly on a clone until it gets stuck or loops
    const snapshotCells = deepCopy(cells);
    const waveSteps: TraceStep[] = [];
    const waveTest = deepCopy(snapshotCells);
    const seenCells = new Set<string>();

    let waveProgress = true;
    while (waveProgress) {
      waveProgress = false;
      const d = getNextDeduction(puzzle, waveTest);
      if (!d) break;

      const key = `${d.type}:${d.row},${d.col}`;
      if (seenCells.has(key)) break;
      seenCells.add(key);

      waveTest[d.row][d.col] = d.type === 'watcher' ? 'watcher' : 'ward';

      if (d.type === 'watcher') {
        // Push watcher step (board = just the watcher, before cleanup wards)
        waveSteps.push({
          deduction: d,
          technique: techniqueLabel(d.reasonType),
          cellsAfter: deepCopy(waveTest),
          newCells: [[d.row, d.col]],
          highlightRows: [d.row],
          highlightCols: [d.col],
          highlightTerritories: [puzzle.territoryMap[d.row][d.col]],
        });

        // Apply propagation and record affected cells for the cleanup step
        const nr = waveTest.length;
        const nc = waveTest[0].length;
        const propagated: [number, number][] = [];

        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const r2 = d.row + dr, c2 = d.col + dc;
            if (r2 >= 0 && r2 < nr && c2 >= 0 && c2 < nc && waveTest[r2][c2] === 'empty') {
              waveTest[r2][c2] = 'ward';
              propagated.push([r2, c2]);
            }
          }
        }
        for (let c2 = 0; c2 < nc; c2++)
          if (c2 !== d.col && waveTest[d.row][c2] === 'empty') {
            waveTest[d.row][c2] = 'ward';
            propagated.push([d.row, c2]);
          }
        for (let r2 = 0; r2 < nr; r2++)
          if (r2 !== d.row && waveTest[r2][d.col] === 'empty') {
            waveTest[r2][d.col] = 'ward';
            propagated.push([r2, d.col]);
          }
        const wt = puzzle.territoryMap[d.row][d.col];
        for (let r2 = 0; r2 < nr; r2++)
          for (let c2 = 0; c2 < nc; c2++)
            if (puzzle.territoryMap[r2][c2] === wt && waveTest[r2][c2] === 'empty') {
              waveTest[r2][c2] = 'ward';
              propagated.push([r2, c2]);
            }

        if (propagated.length > 0) {
          waveSteps.push({
            deduction: {
              type: 'ward',
              row: d.row,
              col: d.col,
              reason: `Row ${d.row + 1}, column ${d.col + 1}, adjacent cells, and the watcher's territory are all warded off.`,
              reasonType: 'adjacency',
              blockedBy: [d.row, d.col],
              affectedCells: propagated,
            },
            technique: 'Adjacency / Row / Col / Territory Cleanup',
            cellsAfter: deepCopy(waveTest),
            newCells: propagated,
            batchCells: propagated,
            highlightRows: [d.row],
            highlightCols: [d.col],
            highlightTerritories: [wt],
            secondaryCells: [[d.row, d.col]],
          });
        }
      } else {
        const highlight = computeStepHighlight(d, puzzle);
        waveSteps.push({
          deduction: d,
          technique: techniqueLabel(d.reasonType),
          cellsAfter: deepCopy(waveTest),
          newCells: [[d.row, d.col]],
          ...highlight,
        });
      }

      waveProgress = true;
    }

    if (waveSteps.length === 0) break;

    // Group steps by technique into sub-waves
    // Steps that share a technique and were available from the same snapshot go together
    const grouped = groupByTechnique(waveSteps);
    for (const group of grouped) {
      waves.push({
        waveIndex: waveIndex++,
        steps: group,
        parallel: group.length > 1,
      });
    }

    // Advance main cells to end of this wave
    cells = deepCopy(waveTest);

    if (cellsEqual(cells, snapshotCells)) break; // no progress
  }

  return {
    puzzle,
    waves,
    solved: isSolved(puzzle, cells),
    stuck: !isSolved(puzzle, cells),
  };
}

function groupByTechnique(steps: TraceStep[]): TraceStep[][] {
  if (steps.length === 0) return [];
  const groups: TraceStep[][] = [];
  let current: TraceStep[] = [steps[0]];

  for (let i = 1; i < steps.length; i++) {
    if (steps[i].technique === current[0].technique) {
      current.push(steps[i]);
    } else {
      groups.push(current);
      current = [steps[i]];
    }
  }
  groups.push(current);
  return groups;
}
