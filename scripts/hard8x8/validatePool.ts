/**
 * validatePool.ts — sanity-check the fast permutation-pool uniqueness
 * checker against the existing exact solver (hasUniqueSolution) before
 * trusting it to drive the search.
 *
 * Usage: npx tsx scripts/hard8x8/validatePool.ts
 */

import { generatePermutationPool, isUniqueFast, countSolutionsForMap } from './permutationPool';
import { hasUniqueSolution } from '../../engine/solver';
import { generatePuzzle, generateSolution, generateVariedTerritoryMap } from '../../engine/generator';
import { createRNG } from '../../lib/randomSeed';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle } from '../../engine/boardTypes';

function getPuzzle(id: string, content: string): Puzzle {
  const idx = content.indexOf(`"id":"${id}"`);
  const start = content.lastIndexOf('{', idx);
  let depth = 0, end = start;
  for (let i = start; i < content.length; i++) {
    if (content[i] === '{') depth++;
    if (content[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return JSON.parse(content.slice(start, end));
}

function ts() { return new Date().toISOString().slice(11, 19); }

async function main() {
  console.log(`[${ts()}] Validating permutation-pool uniqueness checker against hasUniqueSolution...`);

  const poolCache = new Map<number, number[][]>();
  function pool(n: number): number[][] {
    if (!poolCache.has(n)) {
      const t0 = Date.now();
      const p = generatePermutationPool(n);
      console.log(`[${ts()}] pool(${n}) = ${p.length} adjacency-valid permutations (${Date.now() - t0}ms)`);
      poolCache.set(n, p);
    }
    return poolCache.get(n)!;
  }

  let mismatches = 0, checked = 0;

  // 1. Known boards from experimentalPuzzles.ts
  const content = readFileSync(join(process.cwd(), 'data', 'experimentalPuzzles.ts'), 'utf-8');
  const knownIds = ['mutualtest-6x6-01', 'contighard-7x7-01', 'hybridtrap-8x8-01', 'chainheavy-8x8-01'];
  for (const id of knownIds) {
    try {
      const p = getPuzzle(id, content);
      const fast = isUniqueFast(p.territoryMap, pool(p.size));
      const exact = hasUniqueSolution(p);
      checked++;
      const match = fast === exact;
      if (!match) mismatches++;
      console.log(`[${ts()}] ${id}: fast=${fast} exact=${exact} ${match ? 'OK' : 'MISMATCH!!'}`);
    } catch (e) {
      console.log(`[${ts()}] ${id}: not found or error, skipping`);
    }
  }

  // 2. Fresh random generations at size 6, 7, 8 (should all be unique — generator guarantees it)
  for (const size of [6, 7, 8]) {
    for (let i = 0; i < 15; i++) {
      const seed = `poolvalidate-${size}-${i}`;
      const p = generatePuzzle({ size, seed, maxAttempts: 50 });
      if (!p) continue;
      const fast = isUniqueFast(p.territoryMap, pool(size));
      const exact = hasUniqueSolution(p);
      checked++;
      const match = fast === exact;
      if (!match) {
        mismatches++;
        console.log(`[${ts()}] seed=${seed} size=${size}: fast=${fast} exact=${exact} MISMATCH!!`);
      }
    }
  }

  // 3. Deliberately NON-unique boards (random territory maps, not generator-validated)
  // to confirm the fast checker correctly detects multi-solution cases too.
  for (let i = 0; i < 15; i++) {
    const size = 7;
    const rng = createRNG(`poolvalidate-nonunique-${i}`);
    const solution = generateSolution(size, rng);
    if (!solution) continue;
    // Deliberately blobby/loose bias to maximize chance of multiple solutions
    const territoryBias = solution.map(() => 0.2);
    const territoryMaxSize = solution.map(() => undefined);
    const map = generateVariedTerritoryMap(size, solution, rng, territoryBias, territoryMaxSize);
    const dummyPuzzle: Puzzle = {
      id: 'tmp', title: 'tmp', mode: 'initiate', size,
      territoryMap: map, solution, difficulty: 'Initiate', score: 0,
      seed: `nonunique-${i}`, createdAt: new Date().toISOString(),
    };
    const fast = isUniqueFast(map, pool(size));
    const exact = hasUniqueSolution(dummyPuzzle);
    checked++;
    const match = fast === exact;
    if (!match) {
      mismatches++;
      console.log(`[${ts()}] non-unique-test ${i}: fast=${fast} exact=${exact} MISMATCH!!`);
    }
  }

  console.log(`\n[${ts()}] Done. ${checked} boards checked, ${mismatches} mismatches.`);
  if (mismatches === 0) {
    console.log('Fast permutation-pool checker agrees with the exact solver on every test. Safe to use for search.');
  } else {
    console.log('MISMATCHES FOUND — do not trust the fast checker until this is fixed.');
  }
}

main();
