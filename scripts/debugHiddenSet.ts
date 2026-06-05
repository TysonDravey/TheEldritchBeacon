/**
 * debugHiddenSet.ts
 *
 * Diagnoses why hiddenSetElimination never fires. At each board state during
 * a solve (right before the hidden-set check would run), we replicate the
 * logic and count outcomes:
 *
 *   (a) checked    — hidden set was consulted this step
 *   (b) match      — found k rows with exactly k territories (k×k condition met)
 *   (c) deducible  — the match had at least one outside candidate to eliminate
 *
 * If (b) is always 0 → our board shapes never create the topology.
 * If (b) > 0 but (c) = 0 → matches arise but are always already resolved.
 * If (c) > 0 → there's a real opportunity that somehow isn't being reported.
 *
 * Usage:
 *   npx tsx scripts/debugHiddenSet.ts
 *   npx tsx scripts/debugHiddenSet.ts --size 5
 */

import { SAMPLE_PUZZLES } from '../data/samplePuzzles';
import { getCandidates, findContradictions, getNextDeduction } from '../engine/solver';
import { getWatcherPositions, isSolved } from '../engine/rules';
import type { Puzzle, CellState, DeductionResult } from '../engine/boardTypes';

const sizeFilter = (() => {
  const idx = process.argv.indexOf('--size');
  return idx !== -1 ? parseInt(process.argv[idx + 1]) : null;
})();

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function deepCopy(cells: CellState[][]): CellState[][] {
  return cells.map(row => [...row]);
}

function applyDeduction(cells: CellState[][], d: DeductionResult): void {
  cells[d.row][d.col] = d.type === 'watcher' ? 'watcher' : 'ward';
  if (d.type === 'watcher') {
    const n = cells.length;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = d.row + dr, nc = d.col + dc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n && cells[nr][nc] === 'empty')
          cells[nr][nc] = 'ward';
      }
    }
    for (let c = 0; c < n; c++) if (c !== d.col && cells[d.row][c] === 'empty') cells[d.row][c] = 'ward';
    for (let r = 0; r < n; r++) if (r !== d.row && cells[r][d.col] === 'empty') cells[r][d.col] = 'ward';
  }
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const result: T[][] = [];
  for (let i = 0; i <= arr.length - k; i++) {
    for (const combo of combinations(arr.slice(i + 1), k - 1))
      result.push([arr[i], ...combo]);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Hidden set check with counters
// ---------------------------------------------------------------------------

type HiddenSetStats = {
  checked: number;   // times consulted
  matchRow: number;  // k×k row match found
  matchCol: number;  // k×k col match found
  deducibleRow: number; // match with outside candidates (row)
  deducibleCol: number; // match with outside candidates (col)
  // Details about deducible cases for inspection
  examples: { k: number; dim: 'row'|'col'; territories: number[]; dimensions: number[]; puzzleId: string }[];
};

function checkHiddenSet(
  puzzle: Puzzle,
  playerCells: CellState[][],
  stats: HiddenSetStats,
  puzzleId: string,
): DeductionResult | null {
  const n = puzzle.size;
  const candidates = getCandidates(puzzle, playerCells);
  const watchers = getWatcherPositions(playerCells);
  const watcherRows = new Set(watchers.map(([r]) => r));
  const watcherCols = new Set(watchers.map(([, c]) => c));

  const unfilledRows = Array.from({ length: n }, (_, i) => i).filter(r => !watcherRows.has(r));
  const unfilledCols = Array.from({ length: n }, (_, i) => i).filter(c => !watcherCols.has(c));

  stats.checked++;

  // Row hidden sets
  for (let k = 2; k <= unfilledRows.length - 1; k++) {
    for (const rowSet of combinations(unfilledRows, k)) {
      const rowSetSet = new Set(rowSet);
      const territoriesInRows = new Set<number>();
      for (const [t, cands] of candidates) {
        if (cands.length === 0) continue;
        if (cands.some(([r]) => rowSetSet.has(r))) territoriesInRows.add(t);
      }
      if (territoriesInRows.size !== k) continue;
      stats.matchRow++;

      for (const t of territoriesInRows) {
        for (const [r, c] of (candidates.get(t) ?? [])) {
          if (!rowSetSet.has(r)) {
            stats.deducibleRow++;
            if (stats.examples.length < 10) {
              stats.examples.push({ k, dim: 'row', territories: [...territoriesInRows], dimensions: rowSet, puzzleId });
            }
            return { type: 'ward', row: r, col: c,
              reason: `Rows ${rowSet.map(v => v+1).join(',')} can only hold territories ${[...territoriesInRows].map(v => v+1).join(',')}.`,
              reasonType: 'hidden-set-row',
              pairedTerritories: [...territoriesInRows],
              affectedTerritories: [t],
            };
          }
        }
      }
    }
  }

  // Column hidden sets
  for (let k = 2; k <= unfilledCols.length - 1; k++) {
    for (const colSet of combinations(unfilledCols, k)) {
      const colSetSet = new Set(colSet);
      const territoriesInCols = new Set<number>();
      for (const [t, cands] of candidates) {
        if (cands.length === 0) continue;
        if (cands.some(([, c]) => colSetSet.has(c))) territoriesInCols.add(t);
      }
      if (territoriesInCols.size !== k) continue;
      stats.matchCol++;

      for (const t of territoriesInCols) {
        for (const [r, c] of (candidates.get(t) ?? [])) {
          if (!colSetSet.has(c)) {
            stats.deducibleCol++;
            if (stats.examples.length < 10) {
              stats.examples.push({ k, dim: 'col', territories: [...territoriesInCols], dimensions: colSet, puzzleId });
            }
            return { type: 'ward', row: r, col: c,
              reason: `Cols ${colSet.map(v => v+1).join(',')} can only hold territories ${[...territoriesInCols].map(v => v+1).join(',')}.`,
              reasonType: 'hidden-set-col',
              pairedTerritories: [...territoriesInCols],
              affectedTerritories: [t],
            };
          }
        }
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Replicated cheap-technique pass (mirrors solver.ts order, pre-hidden-set)
// ---------------------------------------------------------------------------
// We need to know when cheaper techniques are exhausted so we only check
// hidden set at the exact point the real solver would.

import { getCandidates as _getCandidates } from '../engine/solver';

function cheapPass(puzzle: Puzzle, cells: CellState[][]): DeductionResult | null {
  // Mirrors getNextDeduction up to (but not including) hiddenSetElimination.
  // We use getNextDeduction with maxDepth=0 which skips contradiction test,
  // but it INCLUDES hidden set — so we can't use it directly.
  //
  // Instead, detect "cheaper techniques exhausted" by checking:
  //   adj + naked + confine + pair all return null.
  // We do this by running the solver at maxDepth=0 but checking its output:
  // if the reasonType is hidden-set-*, cheaper techniques were already exhausted.
  // That's circular. Simplest: replicate the logic here.
  const candidates = getCandidates(puzzle, cells);
  const n = puzzle.size;
  const watchers = getWatcherPositions(cells);
  const watcherRows = new Set(watchers.map(([r]) => r));
  const watcherCols = new Set(watchers.map(([, c]) => c));

  // Adjacency / row-occupied / col-occupied / territory-occupied sweep
  for (const [wr, wc] of watchers) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = wr + dr, nc = wc + dc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n && cells[nr][nc] === 'empty')
          return { type: 'ward', row: nr, col: nc, reason: 'adj', reasonType: 'adjacency' };
      }
    }
    for (let c = 0; c < n; c++)
      if (c !== wc && cells[wr][c] === 'empty')
        return { type: 'ward', row: wr, col: c, reason: 'row-occ', reasonType: 'row-occupied' };
    for (let r = 0; r < n; r++)
      if (r !== wr && cells[r][wc] === 'empty')
        return { type: 'ward', row: r, col: wc, reason: 'col-occ', reasonType: 'col-occupied' };
    const wt = puzzle.territoryMap[wr][wc];
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        if (puzzle.territoryMap[r][c] === wt && cells[r][c] === 'empty')
          return { type: 'ward', row: r, col: c, reason: 'ter-occ', reasonType: 'territory-occupied' };
  }

  // Naked single (territory / row / col)
  for (const [t, cands] of candidates) {
    if (cands.length === 1) {
      const [r, c] = cands[0];
      return { type: 'watcher', row: r, col: c, reason: 'ns-ter', reasonType: 'naked-single-territory' };
    }
  }
  const rowCands = new Map<number, [number,number,number][]>();
  for (const [t, cands] of candidates)
    for (const [r,c] of cands) { if (!rowCands.has(r)) rowCands.set(r,[]); rowCands.get(r)!.push([r,c,t]); }
  for (const [r, cells2] of rowCands)
    if (!watcherRows.has(r) && cells2.length === 1) {
      const [,c,] = cells2[0];
      return { type: 'watcher', row: r, col: c, reason: 'ns-row', reasonType: 'naked-single-row' };
    }
  const colCands = new Map<number, [number,number,number][]>();
  for (const [t, cands] of candidates)
    for (const [r,c] of cands) { if (!colCands.has(c)) colCands.set(c,[]); colCands.get(c)!.push([r,c,t]); }
  for (const [c, cells2] of colCands)
    if (!watcherCols.has(c) && cells2.length === 1) {
      const [r,,] = cells2[0];
      return { type: 'watcher', row: r, col: c, reason: 'ns-col', reasonType: 'naked-single-col' };
    }

  // Row / col confinement
  for (const [t, cands] of candidates) {
    if (cands.length === 0) continue;
    const rows = new Set(cands.map(([r]) => r));
    if (rows.size === 1) {
      const confinedRow = cands[0][0];
      for (let c = 0; c < n; c++) {
        if (cells[confinedRow][c] !== 'empty') continue;
        const ct = puzzle.territoryMap[confinedRow][c];
        if (ct === t) continue;
        if ((candidates.get(ct)??[]).some(([r2,c2]) => r2 === confinedRow && c2 === c))
          return { type: 'ward', row: confinedRow, col: c, reason: 'row-cnf', reasonType: 'row-confinement' };
      }
    }
    const cols = new Set(cands.map(([,c]) => c));
    if (cols.size === 1) {
      const confinedCol = cands[0][1];
      for (let r = 0; r < n; r++) {
        if (cells[r][confinedCol] !== 'empty') continue;
        const ct = puzzle.territoryMap[r][confinedCol];
        if (ct === t) continue;
        if ((candidates.get(ct)??[]).some(([r2,c2]) => r2 === r && c2 === confinedCol))
          return { type: 'ward', row: r, col: confinedCol, reason: 'col-cnf', reasonType: 'col-confinement' };
      }
    }
  }

  // Pair / group elimination
  const tRows = new Map<number,Set<number>>();
  const tCols = new Map<number,Set<number>>();
  for (const [t, cands] of candidates) {
    if (cands.length === 0) continue;
    tRows.set(t, new Set(cands.map(([r]) => r)));
    tCols.set(t, new Set(cands.map(([,c]) => c)));
  }
  const ts = [...tRows.keys()];
  for (let k = 2; k <= Math.min(ts.length, n-1); k++) {
    for (const combo of combinations(ts, k)) {
      const uRow = new Set<number>(); for (const t of combo) for (const r of (tRows.get(t)??[])) uRow.add(r);
      if (uRow.size === k) {
        const cs = new Set(combo);
        for (const [ot, cands] of candidates) {
          if (cs.has(ot)) continue;
          for (const [r,c] of cands) if (uRow.has(r))
            return { type: 'ward', row: r, col: c, reason: 'pair-r', reasonType: 'pair-row' };
        }
      }
      const uCol = new Set<number>(); for (const t of combo) for (const c of (tCols.get(t)??[])) uCol.add(c);
      if (uCol.size === k) {
        const cs = new Set(combo);
        for (const [ot, cands] of candidates) {
          if (cs.has(ot)) continue;
          for (const [r,c] of cands) if (uCol.has(c))
            return { type: 'ward', row: r, col: c, reason: 'pair-c', reasonType: 'pair-col' };
        }
      }
    }
  }

  return null; // cheaper techniques exhausted — hidden set slot reached
}

// ---------------------------------------------------------------------------
// Per-puzzle solve loop that injects the diagnostic hidden set check
// ---------------------------------------------------------------------------

function solveWithHiddenSetDiag(puzzle: Puzzle, stats: HiddenSetStats): void {
  const n = puzzle.size;
  const cells: CellState[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, (): CellState => 'empty')
  );

  let progress = true;
  while (progress) {
    progress = false;
    if (isSolved(puzzle, cells)) break;
    if (findContradictions(puzzle, cells).found) break;

    // Try cheaper techniques first
    const cheap = cheapPass(puzzle, cells);
    if (cheap) {
      applyDeduction(cells, cheap);
      progress = true;
      continue;
    }

    // Cheaper techniques exhausted — this is exactly where hidden set fires in the real solver.
    // Check it with our instrumented version.
    const hs = checkHiddenSet(puzzle, cells, stats, puzzle.id);
    if (hs) {
      applyDeduction(cells, hs);
      progress = true;
      continue;
    }

    // Fall through to contradiction test
    const d = getNextDeduction(puzzle, cells, 1);
    if (d) {
      applyDeduction(cells, d);
      progress = true;
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const totalStats: HiddenSetStats = { checked: 0, matchRow: 0, matchCol: 0, deducibleRow: 0, deducibleCol: 0, examples: [] };

const puzzles = SAMPLE_PUZZLES.filter(p => sizeFilter === null || p.size === sizeFilter);
for (const puzzle of puzzles) {
  solveWithHiddenSetDiag(puzzle, totalStats);
}

console.log(`\nPuzzles analysed: ${puzzles.length}`);
console.log(`Hidden set consulted (board states visited): ${totalStats.checked}`);
console.log(`k×k row matches found:    ${totalStats.matchRow}`);
console.log(`k×k col matches found:    ${totalStats.matchCol}`);
console.log(`Deducible row matches:    ${totalStats.deducibleRow}`);
console.log(`Deducible col matches:    ${totalStats.deducibleCol}`);

if (totalStats.examples.length > 0) {
  console.log('\nDeducible examples:');
  for (const ex of totalStats.examples) {
    const dim = ex.dim === 'row' ? `rows [${ex.dimensions.map(v=>v+1).join(',')}]` : `cols [${ex.dimensions.map(v=>v+1).join(',')}]`;
    console.log(`  ${ex.puzzleId}  k=${ex.k}  ${dim}  territories=[${ex.territories.map(v=>v+1).join(',')}]`);
  }
}
console.log();
