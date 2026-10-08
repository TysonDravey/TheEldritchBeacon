/**
 * analyzeFractionDistribution.ts
 *
 * Stop guessing at a threshold. Use the FAST construction method (no-anchor
 * hybrid trap, hundreds of valid puzzles per minute) to actually measure
 * what first-event-open-fraction values are achievable at 8x8, instead of
 * hoping a >=50% hit eventually turns up from a slow blind search. Prints a
 * histogram so we know the real ceiling in minutes, not hours.
 *
 * Usage: npx tsx scripts/analyzeFractionDistribution.ts
 */

import { generateSolution } from '../engine/generator';
import { solveLogically, getNextDeduction } from '../engine/solver';
import { createRNG } from '../lib/randomSeed';
import type { Puzzle, CellState } from '../engine/boardTypes';

const SIZE = 8;
const TARGET_VALID = 300;
const BEND_CHANCE = 0.12;

function isConnected(map: number[][], n: number, territory: number): boolean {
  const cells: [number, number][] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (map[r][c] === territory) cells.push([r, c]);
  if (cells.length === 0) return true;
  const visited = new Set<string>();
  const stack = [cells[0]];
  visited.add(`${cells[0][0]},${cells[0][1]}`);
  while (stack.length > 0) {
    const [r, c] = stack.pop()!;
    for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]] as [number, number][]) {
      if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
      if (map[nr][nc] !== territory) continue;
      const key = `${nr},${nc}`;
      if (!visited.has(key)) { visited.add(key); stack.push([nr, nc]); }
    }
  }
  return visited.size === cells.length;
}

function buildHybridTrapMap(n: number, solution: [number, number][], rng: () => number): number[][] | null {
  const map: number[][] = Array.from({ length: n }, () => Array(n).fill(-1));
  const s0c = solution[0][1];
  const s1c = solution[1][1];
  const s3c = solution[3][1];

  map[0][s0c] = 0;
  const t0Neighbor = (s0c - 1 >= 0 && s0c - 1 !== s1c) ? s0c - 1
    : (s0c + 1 < n && s0c + 1 !== s1c) ? s0c + 1 : -1;
  if (t0Neighbor === -1) return null;
  if (map[0][t0Neighbor] === -1) map[0][t0Neighbor] = 0;

  for (const r of [0, 1, 2]) if (map[r][s1c] === -1) map[r][s1c] = 1;

  let lo = s3c - 1, hi = s3c + 1;
  if (lo < 0) { hi += -lo; lo = 0; }
  if (hi > n - 1) { lo -= (hi - (n - 1)); hi = n - 1; }
  lo = Math.max(0, lo);
  for (let c = lo; c <= hi; c++) if (map[3][c] === -1) map[3][c] = 3;

  for (let r = 0; r <= 3; r++) for (let c = 0; c < n; c++) if (map[r][c] === -1) map[r][c] = 2;

  const remaining = solution.slice(4);
  const axes: ('row' | 'col')[] = remaining.map(() => rng() < 0.5 ? 'row' : 'col');
  const pending: Array<{ row: number; col: number; territory: number }> = [];
  for (let i = 0; i < remaining.length; i++) {
    const territory = i + 4;
    const [r, c] = remaining[i];
    if (map[r][c] !== -1) return null;
    map[r][c] = territory;
    pending.push({ row: r, col: c, territory });
  }
  for (let i = pending.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pending[i], pending[j]] = [pending[j], pending[i]];
  }
  const biasStrength = 0.75;
  while (pending.length > 0) {
    const idx = Math.floor(rng() * Math.min(pending.length, 4));
    const { row, col, territory } = pending.splice(idx, 1)[0];
    if (rng() < BEND_CHANCE) axes[territory - 4] = axes[territory - 4] === 'row' ? 'col' : 'row';
    const axis = axes[territory - 4];
    const preferred: [number, number][] = axis === 'row' ? [[row, col - 1], [row, col + 1]] : [[row - 1, col], [row + 1, col]];
    const secondary: [number, number][] = axis === 'row' ? [[row - 1, col], [row + 1, col]] : [[row, col - 1], [row, col + 1]];
    for (const [nr, nc] of preferred) {
      if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
      if (map[nr][nc] !== -1) continue;
      map[nr][nc] = territory;
      pending.push({ row: nr, col: nc, territory });
    }
    if (rng() >= biasStrength) {
      for (const [nr, nc] of secondary) {
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
        if (map[nr][nc] !== -1) continue;
        map[nr][nc] = territory;
        pending.push({ row: nr, col: nc, territory });
      }
    }
  }
  let hasUnfilled = true;
  while (hasUnfilled) {
    hasUnfilled = false;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (map[r][c] !== -1) continue;
      hasUnfilled = true;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as [number, number][]) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n && map[nr][nc] !== -1) { map[r][c] = map[nr][nc]; break; }
      }
    }
  }
  for (let t = 0; t < n; t++) if (!isConnected(map, n, t)) return null;
  return map;
}

function analyzeTiming(p: Puzzle) {
  const n = p.size;
  const totalCells = n * n;
  const cells: CellState[][] = Array.from({ length: n }, () => Array(n).fill('empty'));
  let total = 0;
  let firstEventOpenFraction = -1;
  let guard = 0;
  while (guard++ < 1000) {
    const d = getNextDeduction(p, cells, 0);
    if (!d) break;
    total++;
    if ((d.reasonType === 'hypothetical' || d.reasonType === 'mutual-exclusion') && firstEventOpenFraction === -1) {
      const openCount = cells.flat().filter(c => c === 'empty').length;
      firstEventOpenFraction = openCount / totalCells;
    }
    cells[d.row][d.col] = d.type === 'watcher' ? 'watcher' : 'ward';
    if (d.type === 'watcher') {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = d.row + dr, nc = d.col + dc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n && cells[nr][nc] === 'empty') cells[nr][nc] = 'ward';
      }
      for (let c = 0; c < n; c++) if (c !== d.col && cells[d.row][c] === 'empty') cells[d.row][c] = 'ward';
      for (let r = 0; r < n; r++) if (r !== d.row && cells[r][d.col] === 'empty') cells[r][d.col] = 'ward';
    }
  }
  return { total, firstEventOpenFraction };
}

function ts() { return new Date().toISOString().slice(11, 19); }

async function main() {
  console.log(`[${ts()}] Measuring first-event-open-fraction distribution over ${TARGET_VALID} valid 8x8 puzzles (fast construction)...`);
  const buckets = new Map<string, number>(); // 10%-wide buckets
  let validCount = 0, noDeepEventCount = 0, tried = 0;
  let best = -1;

  while (validCount < TARGET_VALID) {
    tried++;
    const seed = `fracdist-${tried}`;
    const rng = createRNG(seed);
    const solution = generateSolution(SIZE, rng);
    if (!solution) continue;
    const map = buildHybridTrapMap(SIZE, solution, rng);
    if (!map) continue;
    const puzzle: Puzzle = {
      id: 'tmp', title: 'tmp', mode: 'initiate', size: SIZE,
      territoryMap: map, solution, difficulty: 'Initiate', score: 0,
      seed, createdAt: new Date().toISOString(),
    };
    if (!solveLogically(puzzle, 0)) continue;
    validCount++;

    const a = analyzeTiming(puzzle);
    if (a.firstEventOpenFraction === -1) {
      noDeepEventCount++;
      continue;
    }
    if (a.firstEventOpenFraction > best) best = a.firstEventOpenFraction;
    const bucket = `${Math.floor(a.firstEventOpenFraction * 10) * 10}-${Math.floor(a.firstEventOpenFraction * 10) * 10 + 9}%`;
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);

    if (validCount % 500 === 0) console.log(`[${ts()}] ${validCount}/${TARGET_VALID} valid puzzles analyzed (tried=${tried})`);
  }

  console.log(`\n[${ts()}] Done. ${validCount} valid puzzles (${tried} tried), ${noDeepEventCount} had NO hypothetical/ME event at all. Best fraction seen: ${(best * 100).toFixed(0)}%`);
  console.log('Distribution of first-event-open-fraction (among puzzles that had an event):');
  const sortedBuckets = [...buckets.entries()].sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  for (const [bucket, count] of sortedBuckets) {
    console.log(`  ${bucket.padEnd(8)} ${'#'.repeat(Math.ceil(count / 5))} (${count})`);
  }
}

main();
