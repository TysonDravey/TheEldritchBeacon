import type { Puzzle, CellState, PuzzleMode, Difficulty } from './boardTypes';
import { solveLogically, hasUniqueSolution } from './solver';
import { isAdjacent } from './rules';
import { createRNG } from '../lib/randomSeed';

// ---------------------------------------------------------------------------
// Solution generation — place N non-touching watchers, one per row/col
// ---------------------------------------------------------------------------

function generateSolution(n: number, rng: () => number): [number, number][] | null {
  const solution: [number, number][] = [];

  function backtrack(row: number): boolean {
    if (row === n) return true;

    // Shuffle column order for variety
    const cols = Array.from({ length: n }, (_, i) => i);
    for (let i = cols.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [cols[i], cols[j]] = [cols[j], cols[i]];
    }

    for (const col of cols) {
      // Check column not used
      if (solution.some(([, c]) => c === col)) continue;
      // Check not adjacent to any placed watcher
      if (solution.some(([r, c]) => isAdjacent(row, col, r, c))) continue;

      solution.push([row, col]);
      if (backtrack(row + 1)) return true;
      solution.pop();
    }
    return false;
  }

  return backtrack(0) ? solution : null;
}

// ---------------------------------------------------------------------------
// Territory map generation — grow organic connected regions from solution seeds
// ---------------------------------------------------------------------------

function generateTerritoryMap(
  n: number,
  solution: [number, number][],
  rng: () => number
): number[][] {
  const map: number[][] = Array.from({ length: n }, () => Array(n).fill(-1));

  // Each territory grows biased toward a primary axis (row-stripe or col-stripe).
  // This makes territories column- or row-confined, which the logical solver needs.
  // A biasStrength of 1.0 → only grow along the preferred axis initially.
  // A biasStrength of 0.0 → pure random BFS (original behaviour).
  const biasStrength = 0.75;
  const axes: ('row' | 'col')[] = solution.map(() => rng() < 0.5 ? 'row' : 'col');

  // Seed each territory with its watcher position
  const pending: Array<{ row: number; col: number; territory: number }> = [];
  for (let t = 0; t < solution.length; t++) {
    const [r, c] = solution[t];
    map[r][c] = t;
    pending.push({ row: r, col: c, territory: t });
  }

  // Shuffle initial queue
  for (let i = pending.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pending[i], pending[j]] = [pending[j], pending[i]];
  }

  while (pending.length > 0) {
    const idx = Math.floor(rng() * Math.min(pending.length, 4));
    const { row, col, territory } = pending.splice(idx, 1)[0];

    // Build neighbor list ordered by axis preference
    const axis = axes[territory];
    const preferred: [number, number][] = axis === 'row'
      ? [[row, col - 1], [row, col + 1]]
      : [[row - 1, col], [row + 1, col]];
    const secondary: [number, number][] = axis === 'row'
      ? [[row - 1, col], [row + 1, col]]
      : [[row, col - 1], [row, col + 1]];

    for (const [nr, nc] of preferred) {
      if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
      if (map[nr][nc] !== -1) continue;
      map[nr][nc] = territory;
      pending.push({ row: nr, col: nc, territory });
    }
    // Add cross-axis neighbours only with reduced probability
    if (rng() >= biasStrength) {
      for (const [nr, nc] of secondary) {
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
        if (map[nr][nc] !== -1) continue;
        map[nr][nc] = territory;
        pending.push({ row: nr, col: nc, territory });
      }
    }
  }

  // Any cells left as -1 (isolated by strong bias) — fill with multi-pass BFS
  // so that every cell gets a valid territory assignment.
  let hasUnfilled = true;
  while (hasUnfilled) {
    hasUnfilled = false;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (map[r][c] !== -1) continue;
        hasUnfilled = true;
        for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
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
// Shattered Realms territory map — multiple seeds per territory, non-contiguous
// ---------------------------------------------------------------------------

function generateShatteredTerritoryMap(
  n: number,
  solution: [number, number][],
  rng: () => number
): number[][] {
  const map: number[][] = Array.from({ length: n }, () => Array(n).fill(-1));
  const pending: Array<{ row: number; col: number; territory: number }> = [];

  // Seed each territory with its watcher position first
  for (let t = 0; t < solution.length; t++) {
    const [r, c] = solution[t];
    map[r][c] = t;
    pending.push({ row: r, col: c, territory: t });
  }

  // Add 1–2 extra scattered seeds per territory, placed far from existing seeds
  const minDist = Math.max(2, Math.floor(n / 3));
  for (let t = 0; t < solution.length; t++) {
    const extraCount = rng() < 0.4 ? 2 : 1;
    for (let s = 0; s < extraCount; s++) {
      let placed = false;
      for (let attempt = 0; attempt < 30 && !placed; attempt++) {
        const r = Math.floor(rng() * n);
        const c = Math.floor(rng() * n);
        if (map[r][c] !== -1) continue;
        // Must be far enough from all existing seeds of this territory
        const tooClose = pending
          .filter(p => p.territory === t)
          .some(p => Math.abs(p.row - r) + Math.abs(p.col - c) < minDist);
        if (tooClose) continue;
        map[r][c] = t;
        pending.push({ row: r, col: c, territory: t });
        placed = true;
      }
    }
  }

  // Shuffle then BFS-fill from all seeds simultaneously (no axis bias)
  for (let i = pending.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pending[i], pending[j]] = [pending[j], pending[i]];
  }

  while (pending.length > 0) {
    const idx = Math.floor(rng() * Math.min(pending.length, 6));
    const { row, col, territory } = pending.splice(idx, 1)[0];
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]] as [number,number][]) {
      const nr = row + dr, nc = col + dc;
      if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
      if (map[nr][nc] !== -1) continue;
      map[nr][nc] = territory;
      pending.push({ row: nr, col: nc, territory });
    }
  }

  // Fill any stragglers
  let hasUnfilled = true;
  while (hasUnfilled) {
    hasUnfilled = false;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (map[r][c] !== -1) continue;
        hasUnfilled = true;
        for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]] as [number,number][]) {
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
// Connectivity check — each territory must be one connected blob
// ---------------------------------------------------------------------------

function isConnected(map: number[][], n: number, territory: number): boolean {
  const cells: [number, number][] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (map[r][c] === territory) cells.push([r, c]);

  if (cells.length === 0) return true;

  const visited = new Set<string>();
  const stack = [cells[0]];
  visited.add(`${cells[0][0]},${cells[0][1]}`);

  while (stack.length > 0) {
    const [r, c] = stack.pop()!;
    for (const [nr, nc] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]] as [number,number][]) {
      if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
      if (map[nr][nc] !== territory) continue;
      const key = `${nr},${nc}`;
      if (!visited.has(key)) { visited.add(key); stack.push([nr, nc]); }
    }
  }

  return visited.size === cells.length;
}

// ---------------------------------------------------------------------------
// Difficulty labelling based on how solver cracked it
// (rough heuristic — proper scoring lives in difficulty.ts)
// ---------------------------------------------------------------------------

function labelDifficulty(n: number): Difficulty {
  if (n <= 5) return 'Initiate';
  if (n <= 6) return 'Scholar';
  if (n <= 7) return 'Occultist';
  return 'High Priest';
}

// ---------------------------------------------------------------------------
// generatePuzzle — main export
// ---------------------------------------------------------------------------

export interface GenerateOptions {
  size: number;
  seed: string;
  maxAttempts?: number;
  maxDepth?: number;
  mode?: PuzzleMode;
  id?: string;
  title?: string;
}

export function generatePuzzle(opts: GenerateOptions): Puzzle | null {
  const { size: n, seed, maxAttempts = 500, maxDepth = 0, mode = 'initiate' } = opts;
  const rng = createRNG(seed);

  const isShattered = mode === 'shattered-realms';

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // 1. Generate a valid solution
    const solution = generateSolution(n, rng);
    if (!solution) continue;

    // 2. Build territory map
    const map = isShattered
      ? generateShatteredTerritoryMap(n, solution, rng)
      : generateTerritoryMap(n, solution, rng);

    // 3. Verify no unassigned cells
    let mapValid = true;
    for (let r = 0; r < n && mapValid; r++)
      for (let c = 0; c < n && mapValid; c++)
        if (map[r][c] < 0) mapValid = false;
    if (!mapValid) continue;

    if (!isShattered) {
      // Connectivity required for standard mode
      let connected = true;
      for (let t = 0; t < n; t++) {
        if (!isConnected(map, n, t)) { connected = false; break; }
      }
      if (!connected) continue;

      // Confinement pre-filter (not meaningful for shattered territories)
      let confinedCount = 0;
      for (let t = 0; t < n; t++) {
        const rows = new Set<number>(), cols = new Set<number>();
        for (let r = 0; r < n; r++)
          for (let c = 0; c < n; c++)
            if (map[r][c] === t) { rows.add(r); cols.add(c); }
        if (rows.size <= 2 || cols.size <= 2) confinedCount++;
      }
      if (confinedCount < Math.ceil(n / 2)) continue;
    }

    // 4. Build a candidate puzzle
    const puzzle: Puzzle = {
      id:           opts.id ?? `gen-${n}x${n}-${seed}-${attempt}`,
      title:        opts.title ?? `Puzzle ${n}×${n}`,
      mode,
      size:         n,
      territoryMap: map,
      solution,
      difficulty:   labelDifficulty(n),
      seed,
      createdAt:    new Date().toISOString(),
    };

    // 5. Gate: logical solver must crack it at the requested depth.
    // depth=0 (default): fast generation, works for most puzzles.
    // depth=1: slow (2% hit rate for 8x8) but produces harder puzzles requiring
    //          contradiction chains. Use the generateHard script for batch depth-1 runs.
    const solverResult = solveLogically(puzzle, maxDepth);
    if (!solverResult) continue;

    return puzzle;
  }

  return null;
}

// ---------------------------------------------------------------------------
// generatePuzzleBatch — generate N puzzles with consecutive seeds
// ---------------------------------------------------------------------------

export function generatePuzzleBatch(
  sizes: number[],
  baseSeed: string,
  titlesFor: (id: string, size: number, idx: number) => string = (id) => id,
): Puzzle[] {
  const puzzles: Puzzle[] = [];
  let idx = 0;

  for (const size of sizes) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const seed = `${baseSeed}-${size}-${idx}`;
      const p = generatePuzzle({ size, seed, id: `gen-${size}x${size}-${String(idx).padStart(3,'0')}`, title: titlesFor(`gen-${size}x${size}-${String(idx).padStart(3,'0')}`, size, idx) });
      if (p) {
        puzzles.push(p);
        idx++;
        break;
      }
    }
  }

  return puzzles;
}
