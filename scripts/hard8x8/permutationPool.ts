/**
 * permutationPool.ts
 *
 * Fast, solver-independent uniqueness checking for NxN territory maps.
 *
 * A puzzle's solution is always an adjacency-valid column permutation: one
 * watcher per row, all columns distinct, and (since watchers only ever
 * CONFLICT via adjacency when they're in the same or a neighbouring row —
 * same-row is impossible with one-per-row, same-column impossible with a
 * permutation) the only adjacency constraint that can ever bite is between
 * CONSECUTIVE rows: |p[row+1] - p[row]| > 1.
 *
 * Precomputing every such permutation once per board size turns "is this
 * territory map uniquely solvable" into an O(poolSize * n) scan — no
 * propagation, no deduction chain, no recursion. This is what the search
 * loop uses on every mutation; the real logical solver is reserved for
 * final verification only.
 */

export function generatePermutationPool(n: number): number[][] {
  const results: number[][] = [];
  const used = new Array(n).fill(false);
  const perm: number[] = [];

  function backtrack(row: number) {
    if (row === n) {
      results.push([...perm]);
      return;
    }
    for (let col = 0; col < n; col++) {
      if (used[col]) continue;
      if (row > 0 && Math.abs(col - perm[row - 1]) <= 1) continue;
      used[col] = true;
      perm.push(col);
      backtrack(row + 1);
      perm.pop();
      used[col] = false;
    }
  }

  backtrack(0);
  return results;
}

/**
 * Counts how many permutations in the pool solve this territory map
 * (their N watcher cells land in N distinct territories), stopping early
 * once `limit` is reached — callers that only need "unique or not" should
 * pass limit=2.
 */
export function countSolutionsForMap(
  territoryMap: number[][],
  pool: number[][],
  limit: number = 2,
): number {
  let count = 0;
  const n = territoryMap.length;
  for (const p of pool) {
    const seen = new Set<number>();
    let ok = true;
    for (let row = 0; row < n; row++) {
      const t = territoryMap[row][p[row]];
      if (seen.has(t)) { ok = false; break; }
      seen.add(t);
    }
    if (ok) {
      count++;
      if (count >= limit) return count;
    }
  }
  return count;
}

export function isUniqueFast(territoryMap: number[][], pool: number[][]): boolean {
  return countSolutionsForMap(territoryMap, pool, 2) === 1;
}

/** Returns the first (and, for a unique map, only) solving permutation, or null. */
export function findSolutionFast(territoryMap: number[][], pool: number[][]): number[] | null {
  const n = territoryMap.length;
  for (const p of pool) {
    const seen = new Set<number>();
    let ok = true;
    for (let row = 0; row < n; row++) {
      const t = territoryMap[row][p[row]];
      if (seen.has(t)) { ok = false; break; }
      seen.add(t);
    }
    if (ok) return p;
  }
  return null;
}
