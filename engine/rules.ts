import type { Puzzle, CellState } from './boardTypes';

/**
 * Returns whether two cells are diagonally or orthogonally adjacent (8-connected).
 */
export function isAdjacent(r1: number, c1: number, r2: number, c2: number): boolean {
  return Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1 && !(r1 === r2 && c1 === c2);
}

/**
 * Returns all [row, col] pairs that currently have a Watcher placed.
 */
export function getWatcherPositions(playerCells: CellState[][]): [number, number][] {
  const positions: [number, number][] = [];
  for (let r = 0; r < playerCells.length; r++) {
    for (let c = 0; c < playerCells[r].length; c++) {
      if (playerCells[r][c] === 'watcher') {
        positions.push([r, c]);
      }
    }
  }
  return positions;
}

/**
 * Returns true if placing a Watcher at (row, col) is currently valid given playerCells.
 *
 * Standard mode: 1 watcher per row / col / territory, no adjacency.
 * Twin-watchers:  2 per row / col / territory, no adjacency.
 */
export function canPlaceWatcher(
  puzzle: Puzzle,
  playerCells: CellState[][],
  row: number,
  col: number
): boolean {
  if (playerCells[row][col] !== 'empty') return false;

  const limit = puzzle.mode === 'twin-watchers' ? 2 : 1;
  const watchers = getWatcherPositions(playerCells);
  const targetTerritory = puzzle.territoryMap[row][col];

  let rowCount = 0, colCount = 0, territoryCount = 0;
  for (const [wr, wc] of watchers) {
    if (wr === row)                                        { rowCount++;       if (rowCount       >= limit) return false; }
    if (wc === col)                                        { colCount++;       if (colCount       >= limit) return false; }
    if (puzzle.territoryMap[wr][wc] === targetTerritory)  { territoryCount++; if (territoryCount >= limit) return false; }
    if (isAdjacent(row, col, wr, wc)) return false;
  }

  return true;
}

/**
 * Returns a human-readable reason why a Watcher cannot be placed at (row, col).
 * Assumes canPlaceWatcher already returned false.
 */
export function watcherRejectionReason(
  puzzle: Puzzle,
  playerCells: CellState[][],
  row: number,
  col: number
): string {
  const state = playerCells[row][col];
  if (state === 'ward') return 'A Ward already stands here.';

  const limit = puzzle.mode === 'twin-watchers' ? 2 : 1;
  const watchers = getWatcherPositions(playerCells);
  const targetTerritory = puzzle.territoryMap[row][col];

  let rowCount = 0, colCount = 0, territoryCount = 0;
  for (const [wr, wc] of watchers) {
    if (wr === row) rowCount++;
    if (wc === col) colCount++;
    if (puzzle.territoryMap[wr][wc] === targetTerritory) territoryCount++;
    if (isAdjacent(row, col, wr, wc)) return 'A Watcher already looms too close — they must not touch.';
  }
  if (rowCount >= limit)       return limit === 2 ? `Row ${row + 1} already holds two Watchers.`       : `Row ${row + 1} already harbours a Watcher.`;
  if (colCount >= limit)       return limit === 2 ? `Column ${col + 1} already holds two Watchers.`    : `Column ${col + 1} already harbours a Watcher.`;
  if (territoryCount >= limit) return limit === 2 ? 'This territory already holds two Watchers.'       : 'This territory already has a Watcher standing watch.';

  return 'A Watcher cannot rise here.';
}

/**
 * Returns true if the current full board state is a valid complete solution.
 *
 * Standard:       1 watcher per territory / row / col, no adjacency.
 * Twin-watchers:  2 per territory / row / col, no adjacency.
 */
export function isSolved(puzzle: Puzzle, playerCells: CellState[][]): boolean {
  const n = puzzle.size;
  const limit = puzzle.mode === 'twin-watchers' ? 2 : 1;
  const watchers = getWatcherPositions(playerCells);

  if (watchers.length !== n * limit) return false;

  const rowCounts       = new Map<number, number>();
  const colCounts       = new Map<number, number>();
  const territoryCounts = new Map<number, number>();

  for (const [r, c] of watchers) {
    const rc = (rowCounts.get(r)       ?? 0) + 1;
    const cc = (colCounts.get(c)       ?? 0) + 1;
    const territory = puzzle.territoryMap[r][c];
    const tc = (territoryCounts.get(territory) ?? 0) + 1;
    if (rc > limit || cc > limit || tc > limit) return false;
    rowCounts.set(r, rc);
    colCounts.set(c, cc);
    territoryCounts.set(territory, tc);
  }

  for (let i = 0; i < watchers.length; i++) {
    for (let j = i + 1; j < watchers.length; j++) {
      if (isAdjacent(watchers[i][0], watchers[i][1], watchers[j][0], watchers[j][1])) return false;
    }
  }

  return true;
}
