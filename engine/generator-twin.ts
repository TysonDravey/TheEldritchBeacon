/**
 * generator-twin.ts
 *
 * Generates twin-watcher puzzles: n×n grid, n territories, 2 watchers per
 * territory/row/column, no two watchers adjacent (including diagonally).
 */

import type { Puzzle, CellState } from './boardTypes';
import { isAdjacent, canPlaceWatcher } from './rules';
import { createRNG } from '../lib/randomSeed';

// ---------------------------------------------------------------------------
// Solution generation — place 2 non-touching watchers per row and column
// ---------------------------------------------------------------------------

function generateTwinSolution(n: number, rng: () => number): [number, number][] | null {
  // colCounts[c] = how many watchers are in column c so far (max 2)
  const colCounts = new Array<number>(n).fill(0);
  // All placed watchers across all rows
  const placed: [number, number][] = [];

  // Generate all valid (a, b) column pairs for a given row where:
  // - a < b, |a - b| >= 2 (not horizontally adjacent)
  // - colCounts[a] < 2, colCounts[b] < 2
  // - neither a nor b is diagonally adjacent to any watcher in the previous row
  function validPairs(row: number): [number, number][] {
    const prevRowWatchers = placed.filter(([r]) => r === row - 1).map(([, c]) => c);
    const pairs: [number, number][] = [];
    for (let a = 0; a < n - 2; a++) {
      if (colCounts[a] >= 2) continue;
      if (prevRowWatchers.some(c => Math.abs(c - a) <= 1)) continue;
      for (let b = a + 2; b < n; b++) {
        if (colCounts[b] >= 2) continue;
        if (prevRowWatchers.some(c => Math.abs(c - b) <= 1)) continue;
        // Also ensure a and b are not adjacent to each other (|a-b|>=2 already enforced by b=a+2)
        pairs.push([a, b]);
      }
    }
    return pairs;
  }

  function backtrack(row: number): boolean {
    if (row === n) {
      // Verify every column has exactly 2 watchers
      return colCounts.every(c => c === 2);
    }

    const pairs = validPairs(row);
    // Shuffle for variety
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
    }

    for (const [a, b] of pairs) {
      placed.push([row, a], [row, b]);
      colCounts[a]++;
      colCounts[b]++;
      if (backtrack(row + 1)) return true;
      placed.pop();
      placed.pop();
      colCounts[a]--;
      colCounts[b]--;
    }
    return false;
  }

  if (!backtrack(0)) return null;
  return placed;
}

// ---------------------------------------------------------------------------
// Pair the 2n solution positions into n territory pairs
// ---------------------------------------------------------------------------

function pairIntoTerritories(
  positions: [number, number][],
  n: number,
  rng: () => number,
): [number, number][][] {
  // Shuffle positions, then greedily pair each position with a nearby unpaired one.
  // Goal: territories whose 2 seeds are "near" each other yield more organic shapes.
  const shuffled = [...positions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const used = new Set<number>();
  const pairs: [number, number][][] = [];

  for (let i = 0; i < shuffled.length; i++) {
    if (used.has(i)) continue;
    // Find closest unused position to pair with
    let bestJ = -1;
    let bestDist = Infinity;
    for (let j = i + 1; j < shuffled.length; j++) {
      if (used.has(j)) continue;
      const dist = Math.abs(shuffled[i][0] - shuffled[j][0]) + Math.abs(shuffled[i][1] - shuffled[j][1]);
      if (dist < bestDist) {
        bestDist = dist;
        bestJ = j;
      }
    }
    if (bestJ === -1) break; // shouldn't happen with even count
    used.add(i);
    used.add(bestJ);
    pairs.push([shuffled[i], shuffled[bestJ]]);
  }

  return pairs;
}

// ---------------------------------------------------------------------------
// Territory map — grow organic regions from 2 seeds per territory
// ---------------------------------------------------------------------------

function generateTwinTerritoryMap(
  n: number,
  pairs: [number, number][][],
  rng: () => number,
): number[][] {
  const map: number[][] = Array.from({ length: n }, () => Array(n).fill(-1));
  const pending: Array<{ row: number; col: number; territory: number }> = [];

  // Seed each territory from both watcher positions
  for (let t = 0; t < pairs.length; t++) {
    for (const [r, c] of pairs[t]) {
      map[r][c] = t;
      pending.push({ row: r, col: c, territory: t });
    }
  }

  // Shuffle initial queue
  for (let i = pending.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pending[i], pending[j]] = [pending[j], pending[i]];
  }

  // BFS flood-fill with mild bias toward horizontal expansion (keeps territories legible)
  while (pending.length > 0) {
    const idx = Math.floor(rng() * Math.min(pending.length, 4));
    const { row, col, territory } = pending.splice(idx, 1)[0];

    const preferred: [number, number][] = [[row, col - 1], [row, col + 1]];
    const secondary: [number, number][] = [[row - 1, col], [row + 1, col]];

    for (const [nr, nc] of preferred) {
      if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
      if (map[nr][nc] !== -1) continue;
      map[nr][nc] = territory;
      pending.push({ row: nr, col: nc, territory });
    }
    if (rng() >= 0.6) {
      for (const [nr, nc] of secondary) {
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
        if (map[nr][nc] !== -1) continue;
        map[nr][nc] = territory;
        pending.push({ row: nr, col: nc, territory });
      }
    }
  }

  // Fill any cells left unassigned (can happen with strong bias at borders)
  let hasUnfilled = true;
  while (hasUnfilled) {
    hasUnfilled = false;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (map[r][c] !== -1) continue;
        hasUnfilled = true;
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < n && nc >= 0 && nc < n && map[nr][nc] !== -1) {
            map[r][c] = map[nr][nc];
            break;
          }
        }
      }
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// Contiguity check — every territory must be a single connected region
// ---------------------------------------------------------------------------

function isContiguous(map: number[][], n: number): boolean {
  // For each territory, BFS from its first cell and verify all cells are reachable
  const territoryCells = new Map<number, [number, number][]>();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const t = map[r][c];
      if (!territoryCells.has(t)) territoryCells.set(t, []);
      territoryCells.get(t)!.push([r, c]);
    }
  }

  for (const [, cells] of territoryCells) {
    if (cells.length <= 1) continue;
    const visited = new Set<string>();
    const queue: [number, number][] = [cells[0]];
    visited.add(`${cells[0][0]},${cells[0][1]}`);
    while (queue.length > 0) {
      const [r, c] = queue.shift()!;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
        if (map[nr][nc] !== map[r][c]) continue;
        const key = `${nr},${nc}`;
        if (visited.has(key)) continue;
        visited.add(key);
        queue.push([nr, nc]);
      }
    }
    if (visited.size !== cells.length) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Uniqueness check — backtrack territory by territory, count solutions (cap 2)
// ---------------------------------------------------------------------------

function countTwinSolutions(puzzle: Puzzle): number {
  const n = puzzle.size;

  // Pre-build cell list per territory
  const territoryCells: [number, number][][] = Array.from({ length: n }, () => []);
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      territoryCells[puzzle.territoryMap[r][c]].push([r, c]);

  // We track only watcher positions — no ward propagation needed for counting.
  // canPlaceWatcher checks row/col/territory/adjacency from watcher positions directly.
  const cells: CellState[][] = Array.from({ length: n }, () => Array(n).fill('empty' as CellState));

  let count = 0;

  function backtrack(t: number): void {
    if (count > 1) return;
    if (t === n) { count++; return; }

    const tCells = territoryCells[t];
    for (let i = 0; i < tCells.length && count <= 1; i++) {
      const [r1, c1] = tCells[i];
      if (cells[r1][c1] !== 'empty') continue;
      if (!canPlaceWatcher(puzzle, cells, r1, c1)) continue;
      cells[r1][c1] = 'watcher';

      for (let j = i + 1; j < tCells.length && count <= 1; j++) {
        const [r2, c2] = tCells[j];
        if (cells[r2][c2] !== 'empty') continue;
        if (!canPlaceWatcher(puzzle, cells, r2, c2)) continue;
        cells[r2][c2] = 'watcher';
        backtrack(t + 1);
        cells[r2][c2] = 'empty';
      }

      cells[r1][c1] = 'empty';
    }
  }

  backtrack(0);
  return count;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface TwinPuzzleOptions {
  size?: number;        // grid size, default 8
  seed: string;
  maxAttempts?: number;
}

export function generateTwinPuzzle(opts: TwinPuzzleOptions): Puzzle | null {
  const n = opts.size ?? 8;
  const maxAttempts = opts.maxAttempts ?? 200;
  const rng = createRNG(opts.seed);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const positions = generateTwinSolution(n, rng);
    if (!positions) continue;

    const pairs = pairIntoTerritories(positions, n, rng);
    if (pairs.length !== n) continue;

    const territoryMap = generateTwinTerritoryMap(n, pairs, rng);

    // Reject if any territory is non-contiguous (looks like Shattered Realms)
    if (!isContiguous(territoryMap, n)) continue;

    // Build the solution array: for each territory, the 2 watcher positions
    const solution: [number, number][] = pairs.flat();

    const puzzle: Puzzle = {
      id:           `twin-${n}x${n}-${opts.seed}-${attempt}`,
      title:        '',
      mode:         'twin-watchers',
      size:         n,
      territoryMap,
      solution,
      seed:         opts.seed,
      difficulty:   'Initiate', // placeholder — difficulty rating not yet wired for twin mode
      createdAt:    new Date().toISOString(),
    };

    // Verify uniqueness
    if (countTwinSolutions(puzzle) === 1) {
      return puzzle;
    }
  }

  return null;
}
