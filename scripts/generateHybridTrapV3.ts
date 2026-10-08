/**
 * generateHybridTrapV3.ts
 *
 * Two fixes on top of generateHybridTrap.ts, both found via live playtesting
 * and step-tracing real puzzles:
 *
 * 1. T0 was a literal single-cell territory — a free, zero-reasoning giveaway
 *    move that let the solver (and the player) blow through it instantly,
 *    which then let the rest of the "easy" filler rows cascade fast too.
 *    contighard-7x7-01 (the one puzzle in this whole investigation confirmed
 *    as genuinely good) has NO territory smaller than 2 cells anywhere. Fix:
 *    T0 is now a 2-cell territory (still requires one real elimination step,
 *    not a freebie).
 *
 * 2. The keep criterion was wrong. Every hybrid-trap puzzle from tonight hit
 *    "hypothetical+me >= 2" yet played as trivial-to-mild in practice
 *    (confirmed live: 42s/51s, "size was the only issue"). Tracing WHEN the
 *    deep technique fires showed why: ours fired at 82-91% through the solve
 *    with only 14-25% of cells still open — a last-minute mop-up, not a real
 *    puzzle. contighard-7x7-01's hypothetical event fires at 39% through the
 *    solve with 73% of cells still open. Mutual-exclusion is structurally a
 *    late-game technique (it needs two OTHER territories already narrowed to
 *    exactly one candidate as a precondition); hypothetical has no such
 *    precondition and can fire early IF nothing hands the solver a free
 *    early out. Fix: keep rule is now "first hypothetical/ME event fires
 *    with >=50% of cells still open", not a raw count.
 *
 * Usage: npx tsx scripts/generateHybridTrapV3.ts
 */

import { generateSolution } from '../engine/generator';
import { solveLogically, getNextDeduction } from '../engine/solver';
import { rateDifficulty, scorePuzzle } from '../engine/difficulty';
import { createRNG } from '../lib/randomSeed';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle, CellState } from '../engine/boardTypes';
import { nextUnusedTitle, existingTitles } from './titlePool';

const SIZES = [8, 9, 10];
const TRIES_PER_SIZE = 150000;
const BASE = 'hybridtrap-v3';
const FILE = join(process.cwd(), 'data', 'experimentalPuzzles.ts');
const MIN_OPEN_FRACTION_AT_FIRST_EVENT = 0.5;
const BEND_CHANCE = 0.12;

function analyzeTiming(p: Puzzle) {
  const n = p.size;
  const totalCells = n * n;
  const cells: CellState[][] = Array.from({ length: n }, () => Array(n).fill('empty'));
  let total = 0;
  let firstEventStep = -1;
  let firstEventOpenFraction = -1;
  let firstEventType = '';
  let deepCount = 0;
  let guard = 0;
  while (guard++ < 1000) {
    const d = getNextDeduction(p, cells, 0);
    if (!d) break;
    total++;
    if (d.reasonType === 'hypothetical' || d.reasonType === 'mutual-exclusion') {
      deepCount++;
      if (firstEventStep === -1) {
        firstEventStep = total;
        const openCount = cells.flat().filter(c => c === 'empty').length;
        firstEventOpenFraction = openCount / totalCells;
        firstEventType = d.reasonType;
      }
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
  return { total, firstEventStep, firstEventOpenFraction, firstEventType, deepCount };
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

  // T0: 2-cell territory (not a single-cell giveaway) — anchor plus one
  // adjacent row-0 cell, whichever neighbor is free and not already s1c.
  map[0][s0c] = 0;
  const t0Neighbor = (s0c - 1 >= 0 && s0c - 1 !== s1c) ? s0c - 1
    : (s0c + 1 < n && s0c + 1 !== s1c) ? s0c + 1
    : -1;
  if (t0Neighbor === -1) return null; // can't build a valid 2-cell anchor here, skip this seed
  if (map[0][t0Neighbor] === -1) map[0][t0Neighbor] = 0;

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

  // Organic (bendable) growth for remaining territories (rows 4..n-1's seeds)
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
  console.log(`[${ts()}] Hybrid trap v3 (no giveaway anchor, timing-based keep). Sizes: ${SIZES.join(', ')}. Keep rule: first deep event fires with >=${MIN_OPEN_FRACTION_AT_FIRST_EVENT * 100}% of cells still open.`);

  for (const size of SIZES) {
    console.log(`\n[${ts()}] === ${size}x${size} ===`);
    let tried = 0, generated = 0, kept = 0;
    let bestFrac = -1, bestInfo = '';

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
      const a = analyzeTiming(puzzle);
      if (a.firstEventOpenFraction > bestFrac) {
        bestFrac = a.firstEventOpenFraction;
        bestInfo = `frac=${(a.firstEventOpenFraction * 100).toFixed(0)}% type=${a.firstEventType} deepCount=${a.deepCount} total=${a.total}`;
      }

      if (a.firstEventOpenFraction >= MIN_OPEN_FRACTION_AT_FIRST_EVENT) {
        const content = readFileSync(FILE, 'utf-8');
        const usedTitles = existingTitles(content);
        const diff = rateDifficulty(puzzle);
        const { difficulty: _d, score: _s, ...rest } = puzzle;
        const id = `hybridtrapv3-${size}x${size}-${String(kept + 1).padStart(2, '0')}`;
        const title = nextUnusedTitle(usedTitles, diff);
        const entry: Puzzle = {
          ...rest, id, title, difficulty: diff, score: scorePuzzle(puzzle),
          generatorCmd: `generateHybridTrapV3 --base ${BASE} --sizes ${size}`,
        };
        appendPuzzle(entry);
        kept++;
        console.log(`[${ts()}] KEPT ${id} "${title}" — ${diff}, steps=${a.total}, first-event-step=${a.firstEventStep} (${(a.firstEventOpenFraction * 100).toFixed(0)}% cells open), type=${a.firstEventType}, deepCount=${a.deepCount}`);
      }

      if (tried % 2000 === 0) {
        console.log(`[${ts()}] [${size}x${size}] tried=${tried} generated=${generated} kept=${kept} best-so-far: ${bestInfo}`);
      }
    }

    console.log(`[${ts()}] === ${size}x${size} done: tried=${tried} generated=${generated} kept=${kept} best: ${bestInfo} ===`);
  }

  console.log(`\n[${ts()}] Hybrid trap v3 sweep complete.`);
}

main();
