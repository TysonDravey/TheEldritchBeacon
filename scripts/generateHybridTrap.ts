/**
 * generateHybridTrap.ts
 *
 * Fix for generateTemplatedTrap.ts's total failure (0/20000 at every size).
 * Root cause: making every filler row a literal full-width rectangle is too
 * symmetric — with 2 interchangeable "any column in this row" territories
 * (the working 6x6 case) adjacency happened to still pin a unique solution;
 * with 4+ of them (8x8+) the puzzle almost always has multiple valid
 * solutions, so solveLogically correctly rejects it every time. That's a
 * structural certainty, not rarity — matches the clean 0/20000.
 *
 * Fix: keep the deliberately-constructed trap skeleton for rows 0-3 exactly
 * as proven (T0 single-cell anchor, T1 vertical 3-cell stripe, T3 horizontal
 * 3-cell stripe, T2 blob absorbing the rest of rows 0-3, full board width) —
 * but grow the FILLER territories (rows 4..n-1's seeds) organically via the
 * same flood-fill bias-growth the real generator already uses successfully,
 * instead of plain rectangles. Organic shapes break the symmetry that killed
 * the templated version, while the deliberate trap skeleton is preserved
 * unchanged so the known ME-producing interaction has a chance to recur.
 *
 * Usage: npx tsx scripts/generateHybridTrap.ts
 */

import { generateSolution } from '../engine/generator';
import { solveLogically, getNextDeduction } from '../engine/solver';
import { rateDifficulty, scorePuzzle } from '../engine/difficulty';
import { createRNG } from '../lib/randomSeed';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle, CellState } from '../engine/boardTypes';
import { nextUnusedTitle, existingTitles } from './titlePool';

const SIZES = [9, 10];
const TRIES_PER_SIZE = 1000000;
const BASE = 'hybridtrap-v2';
const FILE = join(process.cwd(), 'data', 'experimentalPuzzles.ts');
const TRIVIAL_THRESHOLD = 0.75;
const MIN_DEEP_COUNT = 2;

const TRIVIAL = new Set([
  'adjacency', 'row-occupied', 'col-occupied', 'territory-occupied',
  'naked-single-territory', 'naked-single-row', 'naked-single-col',
  'row-confinement', 'col-confinement',
]);

function analyze(p: Puzzle) {
  const n = p.size;
  const cells: CellState[][] = Array.from({ length: n }, () => Array(n).fill('empty'));
  let total = 0, trivial = 0, hypothetical = 0, me = 0;
  let guard = 0;
  while (guard++ < 1000) {
    const d = getNextDeduction(p, cells, 0);
    if (!d) break;
    total++;
    const key = d.reasonType ?? 'unknown';
    if (TRIVIAL.has(key)) trivial++;
    if (key === 'hypothetical') hypothetical++;
    if (key === 'mutual-exclusion') me++;
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
  return { total, trivial, hypothetical, me };
}

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

  map[0][s0c] = 0; // T0 anchor

  for (const r of [0, 1, 2]) { // T1 vertical stripe
    if (map[r][s1c] === -1) map[r][s1c] = 1;
  }

  let lo = s3c - 1, hi = s3c + 1; // T3 horizontal stripe, clamped
  if (lo < 0) { hi += -lo; lo = 0; }
  if (hi > n - 1) { lo -= (hi - (n - 1)); hi = n - 1; }
  lo = Math.max(0, lo);
  for (let c = lo; c <= hi; c++) {
    if (map[3][c] === -1) map[3][c] = 3;
  }

  for (let r = 0; r <= 3; r++) { // T2 blob — rest of rows 0-3
    for (let c = 0; c < n; c++) {
      if (map[r][c] === -1) map[r][c] = 2;
    }
  }

  // Organic growth for remaining territories (rows 4..n-1's seeds), same
  // bias-growth algorithm as the real generator — NOT plain rectangles.
  const remaining = solution.slice(4); // territories 4..n-1
  const axes: ('row' | 'col')[] = remaining.map(() => rng() < 0.5 ? 'row' : 'col');
  const pending: Array<{ row: number; col: number; territory: number }> = [];
  for (let i = 0; i < remaining.length; i++) {
    const territory = i + 4;
    const [r, c] = remaining[i];
    if (map[r][c] !== -1) return null; // seed collided with trap (shouldn't happen, rows 4+ untouched)
    map[r][c] = territory;
    pending.push({ row: r, col: c, territory });
  }

  for (let i = pending.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pending[i], pending[j]] = [pending[j], pending[i]];
  }

  const biasStrength = 0.75;
  const BEND_CHANCE = 0.12;
  while (pending.length > 0) {
    const idx = Math.floor(rng() * Math.min(pending.length, 4));
    const { row, col, territory } = pending.splice(idx, 1)[0];
    if (rng() < BEND_CHANCE) {
      axes[territory - 4] = axes[territory - 4] === 'row' ? 'col' : 'row';
    }
    const axis = axes[territory - 4];
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
    if (rng() >= biasStrength) {
      for (const [nr, nc] of secondary) {
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
        if (map[nr][nc] !== -1) continue;
        map[nr][nc] = territory;
        pending.push({ row: nr, col: nc, territory });
      }
    }
  }

  // Fallback fill for any stragglers (shouldn't be many — rows 0-3 are
  // already fully claimed by the trap, this only mops up rows 4+ edges)
  let hasUnfilled = true;
  while (hasUnfilled) {
    hasUnfilled = false;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (map[r][c] !== -1) continue;
        hasUnfilled = true;
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as [number, number][]) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < n && nc >= 0 && nc < n && map[nr][nc] !== -1) {
            map[r][c] = map[nr][nc];
            break;
          }
        }
      }
    }
  }

  for (let t = 0; t < n; t++) {
    if (!isConnected(map, n, t)) return null;
  }

  return map;
}

function appendPuzzle(entry: Puzzle) {
  const content = readFileSync(FILE, 'utf-8');
  const insertPoint = content.lastIndexOf('\n];');
  const newContent =
    content.slice(0, insertPoint).replace(/,(\s*)$/, '$1') +
    ',\n' + JSON.stringify(entry) +
    content.slice(insertPoint);
  writeFileSync(FILE, newContent, 'utf-8');
}

function ts() {
  return new Date().toISOString().slice(11, 19);
}

async function main() {
  console.log(`[${ts()}] Hybrid trap sweep. Sizes: ${SIZES.join(', ')}. Keep rule: trivial<${TRIVIAL_THRESHOLD * 100}% AND (hypothetical+me)>=${MIN_DEEP_COUNT}.`);

  for (const size of SIZES) {
    console.log(`\n[${ts()}] === ${size}x${size} ===`);
    let tried = 0, generated = 0, kept = 0;
    let bestDeep = -1, bestInfo = '';

    for (let i = 0; i < TRIES_PER_SIZE; i++) {
      tried++;
      const seed = `${BASE}-${size}-${i}`;
      const rng = createRNG(seed);
      const solution = generateSolution(size, rng);
      if (!solution) continue;
      const map = buildHybridTrapMap(size, solution, rng);
      if (!map) continue;

      const puzzle: Puzzle = {
        id: 'tmp', title: 'tmp', mode: 'initiate', size,
        territoryMap: map, solution, difficulty: 'Initiate', score: 0,
        seed, createdAt: new Date().toISOString(),
      };
      if (!solveLogically(puzzle, 0)) continue;

      generated++;
      const a = analyze(puzzle);
      const ratio = a.total > 0 ? a.trivial / a.total : 1;
      const deepCount = a.hypothetical + a.me;
      if (deepCount > bestDeep) {
        bestDeep = deepCount;
        bestInfo = `trivial=${(ratio * 100).toFixed(0)}% hyp=${a.hypothetical} me=${a.me} total=${a.total}`;
      }

      if (ratio < TRIVIAL_THRESHOLD && deepCount >= MIN_DEEP_COUNT) {
        const content = readFileSync(FILE, 'utf-8');
        const usedTitles = existingTitles(content);
        const diff = rateDifficulty(puzzle);
        const { difficulty: _d, score: _s, ...rest } = puzzle;
        const id = `hybridtrapv2-${size}x${size}-${String(kept + 1).padStart(2, '0')}`;
        const title = nextUnusedTitle(usedTitles, diff);
        const entry: Puzzle = {
          ...rest, id, title, difficulty: diff, score: scorePuzzle(puzzle),
          generatorCmd: `generateHybridTrap --base ${BASE} --sizes ${size}`,
        };
        appendPuzzle(entry);
        kept++;
        console.log(`[${ts()}] KEPT ${id} "${title}" — ${diff}, steps=${a.total}, trivial=${(ratio * 100).toFixed(0)}%, hypothetical=${a.hypothetical}, me=${a.me}`);
      }

      if (tried % 2000 === 0) {
        console.log(`[${ts()}] [${size}x${size}] tried=${tried} generated=${generated} kept=${kept} best-so-far: ${bestInfo}`);
      }
    }

    console.log(`[${ts()}] === ${size}x${size} done: tried=${tried} generated=${generated} kept=${kept} best: ${bestInfo} ===`);
  }

  console.log(`\n[${ts()}] Hybrid sweep complete.`);
}

main();
