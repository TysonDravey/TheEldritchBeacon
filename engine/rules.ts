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
 * Validity checks:
 * 1. The cell must currently be empty (not already a watcher or ward).
 * 2. No existing Watcher in the same row.
 * 3. No existing Watcher in the same column.
 * 4. No existing Watcher in the same territory.
 * 5. No existing Watcher is adjacent (including diagonally).
 */
export function canPlaceWatcher(
  puzzle: Puzzle,
  playerCells: CellState[][],
  row: number,
  col: number
): boolean {
  // Must be an empty cell
  if (playerCells[row][col] !== 'empty') {
    return false;
  }

  const watchers = getWatcherPositions(playerCells);
  const targetTerritory = puzzle.territoryMap[row][col];

  for (const [wr, wc] of watchers) {
    // Same row
    if (wr === row) return false;
    // Same column
    if (wc === col) return false;
    // Same territory
    if (puzzle.territoryMap[wr][wc] === targetTerritory) return false;
    // Adjacent (including diagonal)
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

  const watchers = getWatcherPositions(playerCells);
  const targetTerritory = puzzle.territoryMap[row][col];

  for (const [wr, wc] of watchers) {
    if (wr === row) return `Row ${row + 1} already harbours a Watcher.`;
    if (wc === col) return `Column ${col + 1} already harbours a Watcher.`;
    if (puzzle.territoryMap[wr][wc] === targetTerritory) return 'This territory already has a Watcher standing watch.';
    if (isAdjacent(row, col, wr, wc)) return 'A Watcher already looms too close — they must not touch.';
  }

  return 'A Watcher cannot rise here.';
}

/**
 * Returns true if the current full board state is a valid complete solution.
 *
 * Checks:
 * 1. Exactly one Watcher per territory.
 * 2. Exactly one Watcher per row.
 * 3. Exactly one Watcher per column.
 * 4. No two Watchers are adjacent (including diagonally).
 */
export function isSolved(puzzle: Puzzle, playerCells: CellState[][]): boolean {
  const n = puzzle.size;
  const watchers = getWatcherPositions(playerCells);

  // Must have exactly one Watcher per territory (= n watchers total for an NxN board)
  if (watchers.length !== n) return false;

  const rowsSeen = new Set<number>();
  const colsSeen = new Set<number>();
  const territoriesSeen = new Set<number>();

  for (const [r, c] of watchers) {
    if (rowsSeen.has(r)) return false;
    if (colsSeen.has(c)) return false;
    const territory = puzzle.territoryMap[r][c];
    if (territoriesSeen.has(territory)) return false;
    rowsSeen.add(r);
    colsSeen.add(c);
    territoriesSeen.add(territory);
  }

  // Check no two watchers are adjacent
  for (let i = 0; i < watchers.length; i++) {
    for (let j = i + 1; j < watchers.length; j++) {
      if (isAdjacent(watchers[i][0], watchers[i][1], watchers[j][0], watchers[j][1])) {
        return false;
      }
    }
  }

  return true;
}
