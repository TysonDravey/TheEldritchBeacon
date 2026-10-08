/**
 * generateMixedShapeGrind.ts
 *
 * Third track ("side quest"). New observation from fresh reference-game
 * screenshots: their puzzles mix wildly different territory SHAPES within
 * the same board — a near-straight 9-cell stripe next to a huge irregular
 * blob next to a bare 1-2 cell sliver, all in one puzzle. Our generator
 * (engine/generator.ts's generateTerritoryMap) applies ONE biasStrength to
 * every territory in a puzzle — the whole board is uniformly stripe-like
 * or blob-like, never mixed. That's a real, previously-untested gap.
 *
 * Uses the new engine/generator.ts exports (generateSolution,
 * generateVariedTerritoryMap) to assign each territory its OWN bias
 * (randomly stripe-like ~0.85-0.95 or blob-like ~0.15-0.35) and, for a
 * fraction of territories, a hard small-size cap (1-3 cells) to force
 * genuine slivers like the reference puzzles have — not just low bias,
 * which still lets a territory grow large.
 *
 * Does NOT apply the confinement pre-filter or requireContradict —
 * this is a fundamentally different, directly-constructed approach rather
 * than blind generation + rejection sampling, so that filter doesn't
 * apply. Still requires the puzzle to be solvable via pure logic (same
 * baseline requirement as the real generator), and uses the SAME proven
 * keep bar as the other two tracks: trivial% < 45% AND
 * (hypothetical + mutualExclusion) >= 2, for direct comparability.
 *
 * Usage: npx tsx scripts/generateMixedShapeGrind.ts
 * Watch:  tail -f /tmp/mixed-shape-grind.log
 */

import { generateSolution, generateVariedTerritoryMap } from '../engine/generator';
import { solveLogically } from '../engine/solver';
import { rateDifficulty, scorePuzzle } from '../engine/difficulty';
import { getNextDeduction } from '../engine/solver';
import { createRNG } from '../lib/randomSeed';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle, CellState } from '../engine/boardTypes';
import { nextUnusedTitle, existingTitles } from './titlePool';

const SIZES = [6, 7, 8];
const MAX_SEEDS_PER_SIZE = 100000;
const BASE = 'mixedshape-v1';
const FILE = join(process.cwd(), 'data', 'experimentalPuzzles.ts');
const TRIVIAL_THRESHOLD = 0.45;
const MIN_DEEP_COUNT = 2;
// Fraction of territories forced into a small hard size cap (sliver territories).
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

function buildMixedPuzzle(size: number, seed: string): Puzzle | null {
  const rng = createRNG(seed);
  const solution = generateSolution(size, rng);
  if (!solution) return null;

  const territoryBias: number[] = [];
  const territoryMaxSize: (number | undefined)[] = [];
  for (let t = 0; t < size; t++) {
    const isSliver = rng() < SLIVER_CHANCE;
    if (isSliver) {
      const [lo, hi] = SLIVER_MAX_SIZE_RANGE;
      territoryMaxSize.push(lo + Math.floor(rng() * (hi - lo + 1)));
      territoryBias.push(0.75); // bias barely matters once capped this small
    } else {
      const isStripe = rng() < 0.5;
      territoryBias.push(isStripe ? 0.85 + rng() * 0.1 : 0.15 + rng() * 0.2);
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

async function main() {
  console.log(`[${ts()}] Starting mixed-shape grind. Sizes: ${SIZES.join(', ')}. Per-territory bias + ${(SLIVER_CHANCE * 100).toFixed(0)}% sliver chance. Keep rule: trivial<${TRIVIAL_THRESHOLD * 100}% AND deep>=${MIN_DEEP_COUNT}.`);

  for (const size of SIZES) {
    console.log(`\n[${ts()}] === ${size}x${size} ===`);
    let tried = 0, generated = 0, kept = 0;

    for (let i = 0; i < MAX_SEEDS_PER_SIZE; i++) {
      tried++;
      const seed = `${BASE}-${size}-${i}`;
      const p = buildMixedPuzzle(size, seed);

      if (p) {
        generated++;
        const a = analyze(p);
        const ratio = a.total > 0 ? a.trivial / a.total : 1;
        const deepCount = a.hypothetical + a.me;

        if (ratio < TRIVIAL_THRESHOLD && deepCount >= MIN_DEEP_COUNT) {
          const content = readFileSync(FILE, 'utf-8');
          const usedTitles = existingTitles(content);
          const diff = rateDifficulty(p);
          const { difficulty: _d, score: _s, ...rest } = p;
          const id = `mixedshape-${size}x${size}-${String(kept + 1).padStart(2, '0')}`;
          const title = nextUnusedTitle(usedTitles, diff);
          const entry: Puzzle = {
            ...rest, id, title, difficulty: diff, score: scorePuzzle(p),
            generatorCmd: `generateMixedShapeGrind --base ${BASE} --sizes ${size}`,
          };
          appendPuzzle(entry);
          kept++;
          console.log(`[${ts()}] KEPT ${id} "${title}" — ${diff}, steps=${a.total}, trivial=${(ratio * 100).toFixed(0)}%, hypothetical=${a.hypothetical}, mutualExclusion=${a.me}`);
        }
      }

      if (tried % 500 === 0) {
        console.log(`[${ts()}] [${size}x${size}] tried=${tried} generated=${generated} kept=${kept}`);
      }
    }

    console.log(`[${ts()}] === ${size}x${size} done: tried=${tried} generated=${generated} kept=${kept} ===`);
  }

  console.log(`\n[${ts()}] Grind complete.`);
}

main();
