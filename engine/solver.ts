import type { Puzzle, CellState, DeductionResult, ContradictionResult } from './boardTypes';
import { isAdjacent, getWatcherPositions, isSolved } from './rules';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deepCopy(cells: CellState[][]): CellState[][] {
  return cells.map(row => [...row]);
}

function applyDeduction(cells: CellState[][], d: DeductionResult): void {
  cells[d.row][d.col] = d.type === 'watcher' ? 'watcher' : 'ward';
  if (d.type === 'watcher') {
    // Mark all 8 surrounding cells as wards
    const n = cells.length;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = d.row + dr;
        const nc = d.col + dc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < cells[nr].length) {
          if (cells[nr][nc] === 'empty') {
            cells[nr][nc] = 'ward';
          }
        }
      }
    }
    // Ward out rest of row and column
    for (let c = 0; c < cells[d.row].length; c++) {
      if (c !== d.col && cells[d.row][c] === 'empty') {
        cells[d.row][c] = 'ward';
      }
    }
    for (let r = 0; r < cells.length; r++) {
      if (r !== d.row && cells[r][d.col] === 'empty') {
        cells[r][d.col] = 'ward';
      }
    }
  }
}

// ---------------------------------------------------------------------------
// getCandidates
// ---------------------------------------------------------------------------

/**
 * Returns candidate cells (non-ward, non-watcher) for each territory,
 * filtered to only cells that don't conflict with existing watchers
 * (same row, col, territory, or adjacent).
 */
export function getCandidates(
  puzzle: Puzzle,
  playerCells: CellState[][]
): Map<number, [number, number][]> {
  const n = puzzle.size;
  const watchers = getWatcherPositions(playerCells);

  // Pre-compute blocked rows, cols, territories from existing watchers
  const blockedRows = new Set<number>();
  const blockedCols = new Set<number>();
  const blockedTerritories = new Set<number>();

  for (const [wr, wc] of watchers) {
    blockedRows.add(wr);
    blockedCols.add(wc);
    blockedTerritories.add(puzzle.territoryMap[wr][wc]);
  }

  const result = new Map<number, [number, number][]>();

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (playerCells[r][c] !== 'empty') continue;

      const territory = puzzle.territoryMap[r][c];

      // Skip cells conflicting with existing watchers
      if (blockedRows.has(r)) continue;
      if (blockedCols.has(c)) continue;
      if (blockedTerritories.has(territory)) continue;

      // Check adjacency with any existing watcher
      let adjacent = false;
      for (const [wr, wc] of watchers) {
        if (isAdjacent(r, c, wr, wc)) {
          adjacent = true;
          break;
        }
      }
      if (adjacent) continue;

      if (!result.has(territory)) {
        result.set(territory, []);
      }
      result.get(territory)!.push([r, c]);
    }
  }

  // Territories that have a watcher placed get an empty array (they're satisfied)
  for (let t = 0; t < puzzle.size; t++) {
    if (blockedTerritories.has(t)) {
      result.set(t, []);
    } else if (!result.has(t)) {
      result.set(t, []);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// validateBoard
// ---------------------------------------------------------------------------

/**
 * Returns:
 *   true  — board is fully and correctly solved
 *   false — board has a contradiction (impossible to solve from this state)
 *   null  — board is in progress (no contradiction, not yet complete)
 */
export function validateBoard(puzzle: Puzzle, playerCells: CellState[][]): boolean | null {
  if (isSolved(puzzle, playerCells)) return true;

  const contradiction = findContradictions(puzzle, playerCells);
  if (contradiction.found) return false;

  return null;
}

// ---------------------------------------------------------------------------
// findContradictions
// ---------------------------------------------------------------------------

/**
 * Detects whether the current board state is impossible to complete.
 *
 * Checks:
 * 1. Any territory has zero candidates remaining (and no watcher placed).
 * 2. Any unfilled row has no candidate cells across all territories.
 * 3. Any unfilled column has no candidate cells across all territories.
 * 4. Two watchers in the same row, column, territory, or adjacent.
 */
export function findContradictions(
  puzzle: Puzzle,
  playerCells: CellState[][]
): ContradictionResult {
  const n = puzzle.size;
  const watchers = getWatcherPositions(playerCells);

  // Check watcher placement conflicts
  const watcherRows = new Set<number>();
  const watcherCols = new Set<number>();
  const watcherTerritories = new Set<number>();

  for (let i = 0; i < watchers.length; i++) {
    const [r, c] = watchers[i];
    const territory = puzzle.territoryMap[r][c];

    if (watcherRows.has(r)) {
      return {
        found: true,
        message: `Row ${r + 1} contains more than one Watcher.`,
        affectedCells: watchers.filter(([wr]) => wr === r),
      };
    }
    if (watcherCols.has(c)) {
      return {
        found: true,
        message: `Column ${c + 1} contains more than one Watcher.`,
        affectedCells: watchers.filter(([, wc]) => wc === c),
      };
    }
    if (watcherTerritories.has(territory)) {
      return {
        found: true,
        message: `A territory contains more than one Watcher.`,
        affectedTerritories: [territory],
        affectedCells: watchers.filter(([wr, wc]) => puzzle.territoryMap[wr][wc] === territory),
      };
    }

    for (let j = 0; j < i; j++) {
      if (isAdjacent(r, c, watchers[j][0], watchers[j][1])) {
        return {
          found: true,
          message: `Two Watchers are adjacent to each other.`,
          affectedCells: [[r, c], watchers[j]],
        };
      }
    }

    watcherRows.add(r);
    watcherCols.add(c);
    watcherTerritories.add(territory);
  }

  const candidates = getCandidates(puzzle, playerCells);

  // Check territories with no watcher and no candidates
  for (let t = 0; t < puzzle.size; t++) {
    if (watcherTerritories.has(t)) continue; // already has watcher
    const cands = candidates.get(t) ?? [];
    if (cands.length === 0) {
      // Collect all cells of this territory to highlight
      const territoryCells: [number, number][] = [];
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (puzzle.territoryMap[r][c] === t) {
            territoryCells.push([r, c]);
          }
        }
      }
      return {
        found: true,
        message: `Territory ${t + 1} has no valid cells remaining for a Watcher.`,
        affectedTerritories: [t],
        affectedCells: territoryCells,
      };
    }
  }

  // Check rows with no candidates (unfilled)
  for (let r = 0; r < n; r++) {
    if (watcherRows.has(r)) continue;
    let hasCandidate = false;
    for (const cands of candidates.values()) {
      if (cands.some(([cr]) => cr === r)) {
        hasCandidate = true;
        break;
      }
    }
    if (!hasCandidate) {
      return {
        found: true,
        message: `Row ${r + 1} has no valid cells remaining for a Watcher.`,
        affectedCells: Array.from({ length: n }, (_, c) => [r, c] as [number, number]),
      };
    }
  }

  // Check columns with no candidates (unfilled)
  for (let c = 0; c < n; c++) {
    if (watcherCols.has(c)) continue;
    let hasCandidate = false;
    for (const cands of candidates.values()) {
      if (cands.some(([, cc]) => cc === c)) {
        hasCandidate = true;
        break;
      }
    }
    if (!hasCandidate) {
      return {
        found: true,
        message: `Column ${c + 1} has no valid cells remaining for a Watcher.`,
        affectedCells: Array.from({ length: n }, (_, r) => [r, c] as [number, number]),
      };
    }
  }

  return { found: false };
}

// ---------------------------------------------------------------------------
// Deduction techniques
// ---------------------------------------------------------------------------

/**
 * Technique 1: Naked single in territory/row/col.
 * If any territory has exactly one candidate cell, place a Watcher there.
 * If any row (or column) has exactly one candidate cell across all territories,
 * place a Watcher there.
 */
function nakedSingle(
  puzzle: Puzzle,
  playerCells: CellState[][],
  candidates: Map<number, [number, number][]>
): DeductionResult | null {
  // Territory naked single
  for (const [territory, cands] of candidates) {
    if (cands.length === 1) {
      const [r, c] = cands[0];
      return {
        type: 'watcher', row: r, col: c,
        reason: `Territory ${territory + 1} has only one possible cell for a Watcher.`,
        reasonType: 'naked-single-territory',
        affectedTerritories: [territory],
      };
    }
  }

  const watchers = getWatcherPositions(playerCells);
  const watcherRows = new Set(watchers.map(([r]) => r));
  const watcherCols = new Set(watchers.map(([, c]) => c));

  // Row naked single
  const rowCandidates = new Map<number, [number, number, number][]>();
  for (const [territory, cands] of candidates) {
    for (const [r, c] of cands) {
      if (!rowCandidates.has(r)) rowCandidates.set(r, []);
      rowCandidates.get(r)!.push([r, c, territory]);
    }
  }
  for (const [r, cells] of rowCandidates) {
    if (watcherRows.has(r)) continue;
    if (cells.length === 1) {
      const [, c, territory] = cells[0];
      return {
        type: 'watcher', row: r, col: c,
        reason: `Row ${r + 1} has only one possible cell for a Watcher.`,
        reasonType: 'naked-single-row',
        affectedTerritories: [territory],
      };
    }
  }

  // Column naked single
  const colCandidates = new Map<number, [number, number, number][]>();
  for (const [territory, cands] of candidates) {
    for (const [r, c] of cands) {
      if (!colCandidates.has(c)) colCandidates.set(c, []);
      colCandidates.get(c)!.push([r, c, territory]);
    }
  }
  for (const [c, cells] of colCandidates) {
    if (watcherCols.has(c)) continue;
    if (cells.length === 1) {
      const [r, , territory] = cells[0];
      return {
        type: 'watcher', row: r, col: c,
        reason: `Column ${c + 1} has only one possible cell for a Watcher.`,
        reasonType: 'naked-single-col',
        affectedTerritories: [territory],
      };
    }
  }

  return null;
}

/**
 * Technique 2: Row confinement.
 * If all candidates for a territory lie in a single row, no other territory
 * can place a Watcher in that row → eliminate those cells.
 * Returns the first ward deduction found.
 */
function rowConfinement(
  puzzle: Puzzle,
  playerCells: CellState[][],
  candidates: Map<number, [number, number][]>
): DeductionResult | null {
  for (const [territory, cands] of candidates) {
    if (cands.length === 0) continue;

    const rows = new Set(cands.map(([r]) => r));
    if (rows.size !== 1) continue;

    // This territory is confined to one row
    const confinedRow = cands[0][0];

    // Find cells in that row that belong to OTHER territories and are still empty
    for (let c = 0; c < puzzle.size; c++) {
      if (playerCells[confinedRow][c] !== 'empty') continue;
      const cellTerritory = puzzle.territoryMap[confinedRow][c];
      if (cellTerritory === territory) continue;

      // Check this cell is actually a candidate for its territory
      const territoryCands = candidates.get(cellTerritory) ?? [];
      const isCandidate = territoryCands.some(([r2, c2]) => r2 === confinedRow && c2 === c);
      if (!isCandidate) continue;

      return {
        type: 'ward', row: confinedRow, col: c,
        reason: `Territory ${territory + 1} can only place its Watcher in row ${confinedRow + 1}, so other territories cannot use that row.`,
        reasonType: 'row-confinement',
        confinedTerritory: territory,
        affectedTerritories: [territory, cellTerritory],
      };
    }
  }

  return null;
}

/**
 * Technique 3: Column confinement.
 * If all candidates for a territory lie in a single column, no other territory
 * can place a Watcher in that column → eliminate those cells.
 */
function columnConfinement(
  puzzle: Puzzle,
  playerCells: CellState[][],
  candidates: Map<number, [number, number][]>
): DeductionResult | null {
  for (const [territory, cands] of candidates) {
    if (cands.length === 0) continue;

    const cols = new Set(cands.map(([, c]) => c));
    if (cols.size !== 1) continue;

    // This territory is confined to one column
    const confinedCol = cands[0][1];

    for (let r = 0; r < puzzle.size; r++) {
      if (playerCells[r][confinedCol] !== 'empty') continue;
      const cellTerritory = puzzle.territoryMap[r][confinedCol];
      if (cellTerritory === territory) continue;

      const territoryCands = candidates.get(cellTerritory) ?? [];
      const isCandidate = territoryCands.some(([r2, c2]) => r2 === r && c2 === confinedCol);
      if (!isCandidate) continue;

      return {
        type: 'ward', row: r, col: confinedCol,
        reason: `Territory ${territory + 1} can only place its Watcher in column ${confinedCol + 1}, so other territories cannot use that column.`,
        reasonType: 'col-confinement',
        confinedTerritory: territory,
        affectedTerritories: [territory, cellTerritory],
      };
    }
  }

  return null;
}

/**
 * Technique 4: Row/col pair elimination.
 * If two (or more) territories are collectively confined to the same N rows,
 * those rows cannot be used by any other territory.
 * Similarly for columns.
 */
function pairElimination(
  puzzle: Puzzle,
  playerCells: CellState[][],
  candidates: Map<number, [number, number][]>
): DeductionResult | null {
  // Collect the set of rows each territory can use
  const territoryRows = new Map<number, Set<number>>();
  const territoryCols = new Map<number, Set<number>>();

  for (const [territory, cands] of candidates) {
    if (cands.length === 0) continue;
    territoryRows.set(territory, new Set(cands.map(([r]) => r)));
    territoryCols.set(territory, new Set(cands.map(([, c]) => c)));
  }

  const territories = Array.from(territoryRows.keys());

  // Check all subsets of territories of size k, see if their combined rows = k rows
  for (let k = 2; k <= Math.min(territories.length, puzzle.size - 1); k++) {
    const result = checkPairElimination(
      puzzle,
      playerCells,
      candidates,
      territories,
      territoryRows,
      k,
      'row'
    );
    if (result) return result;

    const resultCol = checkPairElimination(
      puzzle,
      playerCells,
      candidates,
      territories,
      territoryCols,
      k,
      'col'
    );
    if (resultCol) return resultCol;
  }

  return null;
}

function checkPairElimination(
  puzzle: Puzzle,
  playerCells: CellState[][],
  candidates: Map<number, [number, number][]>,
  territories: number[],
  territoryDimension: Map<number, Set<number>>,
  k: number,
  dimension: 'row' | 'col'
): DeductionResult | null {
  // Generate all combinations of size k from territories
  const combos = combinations(territories, k);

  for (const combo of combos) {
    // Union of rows/cols for this combo
    const unionSet = new Set<number>();
    for (const t of combo) {
      for (const v of (territoryDimension.get(t) ?? [])) {
        unionSet.add(v);
      }
    }

    if (unionSet.size !== k) continue;

    // These k territories are confined to exactly k rows/cols.
    // Any other territory that has candidates in those rows/cols can be eliminated.
    const comboSet = new Set(combo);

    for (const [otherTerritory, cands] of candidates) {
      if (comboSet.has(otherTerritory)) continue;

      for (const [r, c] of cands) {
        const val = dimension === 'row' ? r : c;
        if (!unionSet.has(val)) continue;

        return {
          type: 'ward', row: r, col: c,
          reason: dimension === 'row'
            ? `Territories ${combo.map(t => t + 1).join(', ')} are confined to rows ${Array.from(unionSet).map(v => v + 1).join(', ')}, so other territories cannot use those rows.`
            : `Territories ${combo.map(t => t + 1).join(', ')} are confined to columns ${Array.from(unionSet).map(v => v + 1).join(', ')}, so other territories cannot use those columns.`,
          reasonType: dimension === 'row' ? 'pair-row' : 'pair-col',
          pairedTerritories: combo,
          affectedTerritories: [...combo, otherTerritory],
        };
      }
    }
  }

  return null;
}

/**
 * Technique 5: Adjacency elimination.
 * After placing a Watcher, the 8 surrounding cells become wards.
 * This is already applied in applyDeduction, but this technique also handles
 * the case where a candidate cell is adjacent to ALL possible positions of
 * an already-placed watcher's "zone" — i.e., purely from existing watchers.
 *
 * In practice, adjacency is already eliminated from getCandidates.
 * This technique is mainly a sweep: for every empty cell adjacent to an
 * existing watcher, mark it as a ward.
 */
function adjacencyElimination(
  puzzle: Puzzle,
  playerCells: CellState[][],
  _candidates: Map<number, [number, number][]>
): DeductionResult | null {
  const n = puzzle.size;
  const watchers = getWatcherPositions(playerCells);

  for (const [wr, wc] of watchers) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = wr + dr;
        const nc = wc + dc;
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
        if (playerCells[nr][nc] === 'empty') {
          return {
            type: 'ward', row: nr, col: nc,
            reason: `This cell is adjacent to the Watcher at (${wr + 1}, ${wc + 1}).`,
            reasonType: 'adjacency',
            blockedBy: [wr, wc],
            affectedCells: [[wr, wc]],
          };
        }
      }
    }
    for (let c = 0; c < n; c++) {
      if (c !== wc && playerCells[wr][c] === 'empty') {
        return {
          type: 'ward', row: wr, col: c,
          reason: `Row ${wr + 1} already has a Watcher.`,
          reasonType: 'row-occupied',
          blockedBy: [wr, wc],
          affectedCells: [[wr, wc]],
        };
      }
    }
    for (let r = 0; r < n; r++) {
      if (r !== wr && playerCells[r][wc] === 'empty') {
        return {
          type: 'ward', row: r, col: wc,
          reason: `Column ${wc + 1} already has a Watcher.`,
          reasonType: 'col-occupied',
          blockedBy: [wr, wc],
          affectedCells: [[wr, wc]],
        };
      }
    }
    const watcherTerritory = puzzle.territoryMap[wr][wc];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (puzzle.territoryMap[r][c] === watcherTerritory && playerCells[r][c] === 'empty') {
          return {
            type: 'ward', row: r, col: c,
            reason: `This territory already has a Watcher.`,
            reasonType: 'territory-occupied',
            blockedBy: [wr, wc],
            affectedCells: [[wr, wc]],
            affectedTerritories: [watcherTerritory],
          };
        }
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// getNextDeduction
// ---------------------------------------------------------------------------

/**
 * Returns the single best next logical deduction, or null if stuck.
 * Tries techniques in order of increasing complexity.
 */
export function getNextDeduction(
  puzzle: Puzzle,
  playerCells: CellState[][],
  maxDepth: number = 1,
): DeductionResult | null {
  const candidates = getCandidates(puzzle, playerCells);

  // Technique 0 (cheapest): adjacency/row/col/territory elimination from placed watchers
  const adj = adjacencyElimination(puzzle, playerCells, candidates);
  if (adj) return adj;

  // Recompute candidates after considering adjacency (candidates already exclude adjacents)
  // Technique 1: Naked single
  const ns = nakedSingle(puzzle, playerCells, candidates);
  if (ns) return ns;

  // Technique 2: Row confinement
  const rc = rowConfinement(puzzle, playerCells, candidates);
  if (rc) return rc;

  // Technique 3: Column confinement
  const cc = columnConfinement(puzzle, playerCells, candidates);
  if (cc) return cc;

  // Technique 4: Pair elimination
  const pe = pairElimination(puzzle, playerCells, candidates);
  if (pe) return pe;

  // Technique 5: Hidden set elimination
  const hs = hiddenSetElimination(puzzle, playerCells, candidates);
  if (hs) return hs;

  // Technique 6: Contradiction test (depth controlled by maxDepth)
  const ct = contradictionTest(puzzle, playerCells, candidates, maxDepth);
  if (ct) return ct;

  return null;
}

/**
 * Technique 5: Hidden set elimination (dual of pair elimination).
 * If N rows (or columns) collectively contain candidates for only N territories,
 * those N territories must go in those N rows → eliminate their candidates elsewhere.
 */
function hiddenSetElimination(
  puzzle: Puzzle,
  playerCells: CellState[][],
  candidates: Map<number, [number, number][]>
): DeductionResult | null {
  const n = puzzle.size;
  const watchers = getWatcherPositions(playerCells);
  const watcherRows = new Set(watchers.map(([r]) => r));
  const watcherCols = new Set(watchers.map(([, c]) => c));

  const unfilledRows = Array.from({ length: n }, (_, i) => i).filter(r => !watcherRows.has(r));
  const unfilledCols = Array.from({ length: n }, (_, i) => i).filter(c => !watcherCols.has(c));

  // Hidden sets by row
  for (let k = 2; k <= unfilledRows.length - 1; k++) {
    for (const rowSet of combinations(unfilledRows, k)) {
      const rowSetSet = new Set(rowSet);

      const territoriesInRows = new Set<number>();
      for (const [t, cands] of candidates) {
        if (cands.length === 0) continue;
        if (cands.some(([r]) => rowSetSet.has(r))) territoriesInRows.add(t);
      }
      if (territoriesInRows.size !== k) continue;

      for (const t of territoriesInRows) {
        for (const [r, c] of (candidates.get(t) ?? [])) {
          if (!rowSetSet.has(r)) {
            return {
              type: 'ward', row: r, col: c,
              reason: `Rows ${rowSet.map(v => v + 1).join(', ')} can only hold territories ${Array.from(territoriesInRows).map(v => v + 1).join(', ')}, so those territories are locked to those rows.`,
              reasonType: 'hidden-set-row',
              pairedTerritories: Array.from(territoriesInRows),
              affectedTerritories: [t],
            };
          }
        }
      }
    }
  }

  // Hidden sets by column
  for (let k = 2; k <= unfilledCols.length - 1; k++) {
    for (const colSet of combinations(unfilledCols, k)) {
      const colSetSet = new Set(colSet);

      const territoriesInCols = new Set<number>();
      for (const [t, cands] of candidates) {
        if (cands.length === 0) continue;
        if (cands.some(([, c]) => colSetSet.has(c))) territoriesInCols.add(t);
      }
      if (territoriesInCols.size !== k) continue;

      for (const t of territoriesInCols) {
        for (const [r, c] of (candidates.get(t) ?? [])) {
          if (!colSetSet.has(c)) {
            return {
              type: 'ward', row: r, col: c,
              reason: `Columns ${colSet.map(v => v + 1).join(', ')} can only hold territories ${Array.from(territoriesInCols).map(v => v + 1).join(', ')}, so those territories are locked to those columns.`,
              reasonType: 'hidden-set-col',
              pairedTerritories: Array.from(territoriesInCols),
              affectedTerritories: [t],
            };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Technique 6: Contradiction test (hypothetical elimination).
 * For each candidate cell (r,c), try placing a watcher there and propagating.
 * If any territory ends up with 0 candidates, (r,c) must be a ward.
 *
 * depth=0: propagate with basic techniques only (fast, original behaviour).
 * depth=1: after basic propagation stalls, run a sub-contradiction pass (depth=0)
 *          on the hypothesis board. Any ward it finds is applied and basic
 *          propagation restarts. This unlocks chains like:
 *          "placing A forces B which eliminates C's last refuge → A is impossible."
 */
function contradictionTest(
  puzzle: Puzzle,
  playerCells: CellState[][],
  candidates: Map<number, [number, number][]>,
  depth: number = 1,
): DeductionResult | null {
  // Collect all candidate cells across all territories
  const seen = new Set<string>();
  const allCands: [number, number, number][] = []; // [row, col, territory]
  for (const [t, cands] of candidates) {
    for (const [r, c] of cands) {
      const key = `${r},${c}`;
      if (!seen.has(key)) { seen.add(key); allCands.push([r, c, t]); }
    }
  }

  for (const [r, c, territory] of allCands) {
    const test = deepCopy(playerCells);
    applyDeduction(test, { type: 'watcher', row: r, col: c, reason: 'test' });

    let outerChanged = true;
    while (outerChanged) {
      outerChanged = false;

      // --- Inner loop: basic propagation until stable ---
      let innerChanged = true;
      while (innerChanged) {
        innerChanged = false;
        const testCands = getCandidates(puzzle, test);
        // getCandidates returns [] for both satisfied AND stuck territories;
        // use testOccupied to avoid false positives on satisfied territories.
        const testOccupied = new Set(
          getWatcherPositions(test).map(([wr, wc]) => puzzle.territoryMap[wr][wc])
        );
        for (const [t2, tc] of testCands) {
          if (tc.length === 0 && !testOccupied.has(t2)) {
            return {
              type: 'ward', row: r, col: c,
              reason: `Placing a Watcher here would leave the ${t2 + 1} territory with no valid cells.`,
              reasonType: 'hypothetical',
              confinedTerritory: t2,
              affectedTerritories: [territory, t2],
            };
          }
        }
        const propagate =
          adjacencyElimination(puzzle, test, testCands) ??
          nakedSingle(puzzle, test, testCands) ??
          rowConfinement(puzzle, test, testCands) ??
          columnConfinement(puzzle, test, testCands);
        if (propagate && test[propagate.row][propagate.col] === 'empty') {
          applyDeduction(test, propagate);
          innerChanged = true;
        }
      }

      // --- After basic propagation stalls, try a sub-contradiction pass ---
      if (depth > 0) {
        const testCands = getCandidates(puzzle, test);
        const sub = contradictionTest(puzzle, test, testCands, depth - 1);
        if (sub && test[sub.row][sub.col] === 'empty') {
          applyDeduction(test, sub);
          outerChanged = true; // re-run basic propagation with the new ward applied
        }
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// solveLogically
// ---------------------------------------------------------------------------

/**
 * Runs the full logical solver.
 * Returns the final CellState[][] if the puzzle is solved by pure logic,
 * or null if stuck before completion.
 */
export function solveLogically(
  puzzle: Puzzle,
  maxDepth: number = 1,
): CellState[][] | null {
  const n = puzzle.size;
  const cells: CellState[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, (): CellState => 'empty')
  );

  let progress = true;
  while (progress) {
    progress = false;

    if (isSolved(puzzle, cells)) return cells;

    const contradiction = findContradictions(puzzle, cells);
    if (contradiction.found) return null;

    const deduction = getNextDeduction(puzzle, cells, maxDepth);
    if (deduction) {
      applyDeduction(cells, deduction);
      progress = true;
    }
  }

  return isSolved(puzzle, cells) ? cells : null;
}

// ---------------------------------------------------------------------------
// hasUniqueSolution
// ---------------------------------------------------------------------------

/**
 * Returns true only if the puzzle has exactly one valid solution.
 * Uses constraint backtracking; stops as soon as a second solution is found.
 */
export function hasUniqueSolution(puzzle: Puzzle): boolean {
  const n = puzzle.size;
  let solutionCount = 0;

  function backtrack(
    cells: CellState[][],
    territory: number
  ): void {
    if (solutionCount >= 2) return;

    if (territory === puzzle.size) {
      if (isSolved(puzzle, cells)) {
        solutionCount++;
      }
      return;
    }

    // Skip territories that already have a watcher
    const watchers = getWatcherPositions(cells);
    const occupiedTerritories = new Set(
      watchers.map(([r, c]) => puzzle.territoryMap[r][c])
    );

    if (occupiedTerritories.has(territory)) {
      backtrack(cells, territory + 1);
      return;
    }

    // Try each cell in the territory
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (puzzle.territoryMap[r][c] !== territory) continue;
        if (cells[r][c] !== 'empty') continue;

        // Check if placing a watcher here is valid
        const testCells = deepCopy(cells);
        const deduction: DeductionResult = {
          type: 'watcher',
          row: r,
          col: c,
          reason: 'backtrack',
        };

        // Check validity before applying
        const watchers2 = getWatcherPositions(testCells);
        let valid = true;
        const blockedRows = new Set(watchers2.map(([wr]) => wr));
        const blockedCols = new Set(watchers2.map(([, wc]) => wc));
        const blockedTerritories = new Set(
          watchers2.map(([wr, wc]) => puzzle.territoryMap[wr][wc])
        );

        if (blockedRows.has(r) || blockedCols.has(c) || blockedTerritories.has(territory)) {
          valid = false;
        }
        if (valid) {
          for (const [wr, wc] of watchers2) {
            if (isAdjacent(r, c, wr, wc)) {
              valid = false;
              break;
            }
          }
        }

        if (!valid) continue;

        applyDeduction(testCells, deduction);

        // Apply logical deductions to prune
        let logicProgress = true;
        while (logicProgress) {
          logicProgress = false;
          const nextD = getNextDeduction(puzzle, testCells);
          if (nextD) {
            applyDeduction(testCells, nextD);
            logicProgress = true;
          }
        }

        const contradiction = findContradictions(puzzle, testCells);
        if (!contradiction.found) {
          backtrack(testCells, territory + 1);
        }

        if (solutionCount >= 2) return;
      }
    }
  }

  const initialCells: CellState[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, (): CellState => 'empty')
  );

  backtrack(initialCells, 0);
  return solutionCount === 1;
}

// ---------------------------------------------------------------------------
// Utility: combinations
// ---------------------------------------------------------------------------

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];

  const result: T[][] = [];
  for (let i = 0; i <= arr.length - k; i++) {
    const rest = combinations(arr.slice(i + 1), k - 1);
    for (const combo of rest) {
      result.push([arr[i], ...combo]);
    }
  }
  return result;
}
