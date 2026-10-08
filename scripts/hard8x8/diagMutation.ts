import { generatePermutationPool, isUniqueFast, countSolutionsForMap } from './permutationPool';
import { createRNG } from '../../lib/randomSeed';
import { generateVariedTerritoryMap } from '../../engine/generator';

const n = 8;
const pool = generatePermutationPool(n);
console.log(`pool size: ${pool.length}`);

function buildInitialPartition(n: number, solution: number[], rng: () => number): number[][] {
  const solutionPairs: [number, number][] = solution.map((col, row) => [row, col]);
  const territoryBias = solution.map(() => 0.75);
  const territoryMaxSize = solution.map(() => undefined);
  return generateVariedTerritoryMap(n, solutionPairs, rng, territoryBias, territoryMaxSize);
}

let uniqueInitial = 0, total = 20;
for (let i = 0; i < total; i++) {
  const rng = createRNG(`diag-${i}`);
  const perm = pool[Math.floor(rng() * pool.length)];
  const map = buildInitialPartition(n, perm, rng);
  const solCount = countSolutionsForMap(map, pool, 5);
  console.log(`initial partition ${i}: solCount(capped at 5)=${solCount}`);
  if (solCount === 1) uniqueInitial++;
}
console.log(`\n${uniqueInitial}/${total} initial partitions were unique`);
