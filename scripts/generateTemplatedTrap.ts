/**
 * generateTemplatedTrap.ts
 *
 * Path B: stop praying over uniform-random territory shapes. mutualtest-6x6-01
 * (found by search, confirmed live) has a specific skeleton, not a random one:
 *   T0: single-cell anchor at row0's solution column
 *   T1: vertical 3-cell stripe at row1's solution column, spanning rows 0-2
 *   T3: horizontal 3-cell stripe at row3's row, centered on row3's solution column
 *   T2: blob absorbing everything else left in rows 0-3
 *   T4..T(n-1): every remaining row (4..n-1) as a full-row filler territory
 *
 * The anchor forces row0 immediately. That leaves T1's stripe genuinely
 * ambiguous (2 cells) and T3's stripe genuinely ambiguous (varies), with the
 * blob as an inert absorber — exactly the setup that forced an ME event at
 * 6x6. This rebuilds that EXACT skeleton at size N, varying only which real
 * solution it's wrapped around, instead of randomizing shape/bias per
 * territory. Much higher expected hit rate than blind search, since we're
 * reproducing a structure already proven to produce the interaction, not
 * hoping one emerges by chance.
 *
 * Usage: npx tsx scripts/generateTemplatedTrap.ts
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
const TRIES_PER_SIZE = 20000;
const BASE = 'templatedtrap-v1';
const FILE = join(process.cwd(), 'data', 'experimentalPuzzles.ts');
const TRIVIAL_THRESHOLD = 0.45;
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
  const counts: Record<string, number> = {};
  let guard = 0;
  while (guard++ < 1000) {
    const d = getNextDeduction(p, cells, 0);
    if (!d) break;
    total++;
    const key = d.reasonType ?? 'unknown';
    counts[key] = (counts[key] ?? 0) + 1;
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
  return { total, trivial, hypothetical, me, counts };
}

function buildTemplatedPuzzle(size: number, seed: string): Puzzle | null {
  const rng = createRNG(seed);
  const solution = generateSolution(size, rng);
  if (!solution) return null;
  if (size < 5) return null;

  const map: number[][] = Array.from({ length: size }, () => Array(size).fill(-1));

  const s0c = solution[0][1];
  const s1c = solution[1][1];
  const s3c = solution[3][1];

  // T0: single-cell anchor
  map[0][s0c] = 0;

  // T1: vertical 3-cell stripe at s1c, rows 0-2
  for (const r of [0, 1, 2]) {
    if (map[r][s1c] === -1) map[r][s1c] = 1;
  }

  // T3: horizontal 3-cell stripe on row 3, centered on s3c (clamped to board)
  let lo = s3c - 1, hi = s3c + 1;
  if (lo < 0) { hi += -lo; lo = 0; }
  if (hi > size - 1) { lo -= (hi - (size - 1)); hi = size - 1; }
  lo = Math.max(0, lo);
  for (let c = lo; c <= hi; c++) {
    if (map[3][c] === -1) map[3][c] = 3;
  }

  // T2: blob — everything else left in rows 0-3
  for (let r = 0; r <= 3; r++) {
    for (let c = 0; c < size; c++) {
      if (map[r][c] === -1) map[r][c] = 2;
    }
  }

  // T4..T(size-1): full-row fillers
  for (let r = 4; r < size; r++) {
    for (let c = 0; c < size; c++) map[r][c] = r;
  }

  const puzzle: Puzzle = {
    id: 'tmp', title: 'tmp', mode: 'initiate', size,
    territoryMap: map, solution, difficulty: 'Initiate', score: 0,
    seed, createdAt: new Date().toISOString(),
  };

  if (!solveLogically(puzzle, 0)) return null;
  return puzzle;
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
  console.log(`[${ts()}] Templated-trap sweep. Sizes: ${SIZES.join(', ')}. Keep rule: trivial<${TRIVIAL_THRESHOLD * 100}% AND (hypothetical+me)>=${MIN_DEEP_COUNT}.`);

  for (const size of SIZES) {
    console.log(`\n[${ts()}] === ${size}x${size} ===`);
    let tried = 0, generated = 0, kept = 0;
    let bestDeep = -1;
    let bestInfo = '';

    for (let i = 0; i < TRIES_PER_SIZE; i++) {
      tried++;
      const seed = `${BASE}-${size}-${i}`;
      const p = buildTemplatedPuzzle(size, seed);
      if (!p) continue;
      generated++;

      const a = analyze(p);
      const ratio = a.total > 0 ? a.trivial / a.total : 1;
      const deepCount = a.hypothetical + a.me;
      if (deepCount > bestDeep) {
        bestDeep = deepCount;
        bestInfo = `trivial=${(ratio * 100).toFixed(0)}% hyp=${a.hypothetical} me=${a.me} total=${a.total}`;
      }

      if (ratio < TRIVIAL_THRESHOLD && deepCount >= MIN_DEEP_COUNT) {
        const content = readFileSync(FILE, 'utf-8');
        const usedTitles = existingTitles(content);
        const diff = rateDifficulty(p);
        const { difficulty: _d, score: _s, ...rest } = p;
        const id = `templatedtrap-${size}x${size}-${String(kept + 1).padStart(2, '0')}`;
        const title = nextUnusedTitle(usedTitles, diff);
        const entry: Puzzle = {
          ...rest, id, title, difficulty: diff, score: scorePuzzle(p),
          generatorCmd: `generateTemplatedTrap --base ${BASE} --sizes ${size}`,
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

  console.log(`\n[${ts()}] Templated sweep complete.`);
}

main();
