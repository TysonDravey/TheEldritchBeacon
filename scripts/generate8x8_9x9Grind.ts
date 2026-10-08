/**
 * generate8x8_9x9Grind.ts
 *
 * Dedicated grind for 8x8 and 9x9 only — both prior grinds found plenty at
 * 6x6/7x7 (confirmed good, multiple times) but came up essentially empty
 * at 8x8 (0/100000 under requireContradict, 0/1241-generated under mixed-
 * shape), and 9x9 was never seriously attempted. A quick diagnostic found
 * no single clean cause in a 3000-sample probe — the rejection rates for
 * 7x7 vs 8x8 looked similar; the real gap only shows up at rare-event
 * scale, which needs more volume to resolve, not more analysis. So: more
 * volume. This interleaves BOTH proven approaches per seed (requireContradict
 * at default bias, then mixed per-territory bias/slivers) rather than
 * picking one, to maximize the chance of hitting the keep bar from
 * whichever direction works. Same proven keep rule throughout:
 * trivial% < 45% AND (hypothetical + mutualExclusion) >= 2.
 *
 * Usage: npx tsx scripts/generate8x8_9x9Grind.ts
 * Watch:  tail -f /tmp/8x8-9x9-grind.log
 */

import { generatePuzzle, generateSolution, generateVariedTerritoryMap } from '../engine/generator';
import { solveLogically, getNextDeduction } from '../engine/solver';
import { rateDifficulty, scorePuzzle } from '../engine/difficulty';
import { createRNG } from '../lib/randomSeed';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle, CellState } from '../engine/boardTypes';
import { nextUnusedTitle, existingTitles } from './titlePool';

const SIZES = [8, 9];
const MAX_SEEDS_PER_SIZE = 500000;
const BASE = 'bignum-v1';
const FILE = join(process.cwd(), 'data', 'experimentalPuzzles.ts');
const TRIVIAL_THRESHOLD = 0.45;
const MIN_DEEP_COUNT = 2;
const SLIVER_CHANCE = 0.3;
const SLIVER_MAX_SIZE_RANGE: [number, number] = [1, 3];

function analyze(p: Puzzle): { total: number; trivial: number; hypothetical: number; me: number } {
  const TRIVIAL = new Set([
    'adjacency', 'row-occupied', 'col-occupied', 'territory-occupied',
    'naked-single-territory', 'naked-single-row', 'naked-single-col',
    'row-confinement', 'col-confinement',
  ]);
  const n = p.size;
  const cells: CellState[][] = Array.from({ length: n }, () => Array(n).fill('empty'));
  let total = 0, trivial = 0, hypothetical = 0, me = 0;
  let guard = 0;
  while (guard++ < 1000) {
    const d = getNextDeduction(p, cells, 0);
    if (!d) break;
    total++;
    if (TRIVIAL.has(d.reasonType ?? '')) trivial++;
    if (d.reasonType === 'hypothetical') hypothetical++;
    if (d.reasonType === 'mutual-exclusion') me++;
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

function buildMixedPuzzle(size: number, seed: string): Puzzle | null {
  const rng = createRNG(seed);
  const solution = generateSolution(size, rng);
  if (!solution) return null;
  const territoryBias: number[] = [];
  const territoryMaxSize: (number | undefined)[] = [];
  for (let t = 0; t < size; t++) {
    if (rng() < SLIVER_CHANCE) {
      const [lo, hi] = SLIVER_MAX_SIZE_RANGE;
      territoryMaxSize.push(lo + Math.floor(rng() * (hi - lo + 1)));
      territoryBias.push(0.75);
    } else {
      territoryBias.push(rng() < 0.5 ? 0.85 + rng() * 0.1 : 0.15 + rng() * 0.2);
      territoryMaxSize.push(undefined);
    }
  }
  const territoryMap = generateVariedTerritoryMap(size, solution, rng, territoryBias, territoryMaxSize);
  const puzzle: Puzzle = {
    id: 'tmp', title: 'tmp', mode: 'initiate', size,
    territoryMap, solution, difficulty: 'Initiate', score: 0,
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

function tryKeep(p: Puzzle, size: number, method: string, keptSoFar: number): boolean {
  const a = analyze(p);
  const ratio = a.total > 0 ? a.trivial / a.total : 1;
  const deepCount = a.hypothetical + a.me;
  if (ratio < TRIVIAL_THRESHOLD && deepCount >= MIN_DEEP_COUNT) {
    const content = readFileSync(FILE, 'utf-8');
    const usedTitles = existingTitles(content);
    const diff = rateDifficulty(p);
    const { difficulty: _d, score: _s, ...rest } = p;
    const id = `bignum-${size}x${size}-${String(keptSoFar + 1).padStart(2, '0')}`;
    const title = nextUnusedTitle(usedTitles, diff);
    const entry: Puzzle = {
      ...rest, id, title, difficulty: diff, score: scorePuzzle(p),
      generatorCmd: `generate8x8_9x9Grind --method ${method} --sizes ${size}`,
    };
    appendPuzzle(entry);
    console.log(`[${ts()}] KEPT ${id} "${title}" [${method}] — ${diff}, steps=${a.total}, trivial=${(ratio * 100).toFixed(0)}%, hypothetical=${a.hypothetical}, mutualExclusion=${a.me}`);
    return true;
  }
  return false;
}

async function main() {
  console.log(`[${ts()}] Starting dedicated 8x8/9x9 grind. Interleaving requireContradict + mixed-shape per seed. Keep rule: trivial<${TRIVIAL_THRESHOLD * 100}% AND deep>=${MIN_DEEP_COUNT}.`);

  for (const size of SIZES) {
    console.log(`\n[${ts()}] === ${size}x${size} ===`);
    let tried = 0, generated = 0, kept = 0;

    for (let i = 0; i < MAX_SEEDS_PER_SIZE; i++) {
      tried++;

      // Method A: requireContradict, default bias
      const seedA = `${BASE}-rc-${size}-${i}`;
      const pA = generatePuzzle({ size, seed: seedA, maxAttempts: 300, requireContradict: true });
      if (pA) {
        generated++;
        if (tryKeep(pA, size, 'requireContradict', kept)) kept++;
      }

      // Method B: mixed per-territory shape/size
      const seedB = `${BASE}-mx-${size}-${i}`;
      const pB = buildMixedPuzzle(size, seedB);
      if (pB) {
        generated++;
        if (tryKeep(pB, size, 'mixedShape', kept)) kept++;
      }

      if (tried % 1000 === 0) {
        console.log(`[${ts()}] [${size}x${size}] tried=${tried} (x2 methods) generated=${generated} kept=${kept}`);
      }
    }

    console.log(`[${ts()}] === ${size}x${size} done: tried=${tried} (x2 methods) generated=${generated} kept=${kept} ===`);
  }

  console.log(`\n[${ts()}] Grind complete.`);
}

main();
