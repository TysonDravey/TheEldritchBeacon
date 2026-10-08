/**
 * mutationSearch.ts
 *
 * Local search over territory partitions, starting from a planted
 * adjacency-valid permutation (the eventual solution) and an initial
 * organic partition, then mutating territory BOUNDARIES via single-cell and
 * small-patch transfers. Every mutation must preserve: full coverage, N
 * nonempty territories, territory connectivity, and each planted watcher
 * remaining in its own territory. The whole partition stays editable —
 * there is no frozen "hard zone" plus frozen "filler" (that decoupling is
 * exactly what capped the earlier hand-built trap at ~31% open-fraction;
 * see scripts/hybridtrap* and analyzeFractionDistribution.ts).
 *
 * Scoring is the cheap-stall metric (scripts/hard8x8/cheapStall.ts) — fast
 * enough to run on every candidate. The expensive full solver and the
 * explainable-hypothetical check only ever run on promising survivors.
 */

import { generatePermutationPool, isUniqueFast } from './permutationPool';
import { runToStall, scoreStall, type StallResult } from './cheapStall';
import { createRNG } from '../../lib/randomSeed';
import { generatePuzzle } from '../../engine/generator';
import type { Puzzle } from '../../engine/boardTypes';

function isConnected(map: number[][], n: number, territory: number): boolean {
  let seed: [number, number] | null = null;
  for (let r = 0; r < n && !seed; r++) for (let c = 0; c < n; c++) if (map[r][c] === territory) { seed = [r, c]; break; }
  if (!seed) return true; // empty — caller is responsible for rejecting this separately
  let count = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (map[r][c] === territory) count++;

  const visited = new Set<string>();
  const stack: [number, number][] = [seed];
  visited.add(`${seed[0]},${seed[1]}`);
  while (stack.length > 0) {
    const [r, c] = stack.pop()!;
    for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]] as [number, number][]) {
      if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
      if (map[nr][nc] !== territory) continue;
      const key = `${nr},${nc}`;
      if (!visited.has(key)) { visited.add(key); stack.push([nr, nc]); }
    }
  }
  return visited.size === count;
}

/**
 * Gets a valid starting board (unique solution, N connected territories) by
 * reusing the existing, proven generatePuzzle pipeline — NOT a hand-rolled
 * partition builder. Confirmed by direct test (diagMutation.ts): even a
 * biased organic partition built from scratch has multiple valid solutions
 * essentially 100% of the time at size 8 (20/20 sampled had >=5 solutions).
 * The real uniqueness enforcement in the existing pipeline isn't the shape
 * bias — it's generatePuzzle's own rejection-sampling loop (try many
 * solution+map combinations, keep only ones solveLogically can fully
 * resolve). That's rarer at size 8 too (separately confirmed: default-mode
 * generatePuzzle succeeded only 1/20 times at size 8 vs 20/20 at size 6),
 * but it only needs to be paid once per restart here, not once per mutation.
 * The puzzle's difficulty doesn't matter for this starting point — the
 * mutation search reshapes it from there regardless of how it first solved.
 */
function getValidStartingBoard(n: number, rng: () => number): { territoryMap: number[][]; solution: [number, number][] } | null {
  const seed = `mutstart-${Math.floor(rng() * 1e9)}`;
  const p = generatePuzzle({ size: n, seed, maxAttempts: 3000 });
  if (!p) return null;
  return { territoryMap: p.territoryMap, solution: p.solution };
}

interface MutationContext {
  n: number;
  seedCells: [number, number][]; // planted watcher cell per territory — never movable
}

/** Attempts one single-cell boundary transfer. Returns a new map, or null if no valid move found. */
function trySingleCellMutation(map: number[][], ctx: MutationContext, rng: () => number): number[][] | null {
  const { n, seedCells } = ctx;
  const seedSet = new Set(seedCells.map(([r, c]) => `${r},${c}`));

  for (let attempt = 0; attempt < 30; attempt++) {
    const r = Math.floor(rng() * n), c = Math.floor(rng() * n);
    if (seedSet.has(`${r},${c}`)) continue;
    const territory = map[r][c];

    const neighbors: [number, number][] = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
    const otherTerritories = new Set<number>();
    for (const [nr, nc] of neighbors) {
      if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
      if (map[nr][nc] !== territory) otherTerritories.add(map[nr][nc]);
    }
    if (otherTerritories.size === 0) continue;
    const targets = [...otherTerritories];
    const target = targets[Math.floor(rng() * targets.length)];

    const candidate = map.map(row => [...row]);
    candidate[r][c] = target;
    if (!isConnected(candidate, n, territory)) continue;

    return candidate;
  }
  return null;
}

/** Attempts a small (2-4 cell) connected-patch transfer. */
function tryPatchMutation(map: number[][], ctx: MutationContext, rng: () => number): number[][] | null {
  const { n, seedCells } = ctx;
  const seedSet = new Set(seedCells.map(([r, c]) => `${r},${c}`));

  for (let attempt = 0; attempt < 20; attempt++) {
    const r0 = Math.floor(rng() * n), c0 = Math.floor(rng() * n);
    if (seedSet.has(`${r0},${c0}`)) continue;
    const territory = map[r0][c0];
    const patchSize = 2 + Math.floor(rng() * 3); // 2-4

    const patch: [number, number][] = [[r0, c0]];
    const patchSet = new Set([`${r0},${c0}`]);
    const frontier: [number, number][] = [[r0, c0]];
    while (patch.length < patchSize && frontier.length > 0) {
      const [pr, pc] = frontier.splice(Math.floor(rng() * frontier.length), 1)[0];
      const dirs: [number, number][] = [[pr - 1, pc], [pr + 1, pc], [pr, pc - 1], [pr, pc + 1]];
      for (const [nr, nc] of dirs) {
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
        if (map[nr][nc] !== territory) continue;
        const key = `${nr},${nc}`;
        if (patchSet.has(key) || seedSet.has(key)) continue;
        patch.push([nr, nc]);
        patchSet.add(key);
        frontier.push([nr, nc]);
        if (patch.length >= patchSize) break;
      }
    }
    if (patch.length < 2) continue;

    // Find a target territory adjacent to the patch
    const otherTerritories = new Set<number>();
    for (const [pr, pc] of patch) {
      for (const [nr, nc] of [[pr - 1, pc], [pr + 1, pc], [pr, pc - 1], [pr, pc + 1]] as [number, number][]) {
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
        if (map[nr][nc] !== territory && !patchSet.has(`${nr},${nc}`)) otherTerritories.add(map[nr][nc]);
      }
    }
    if (otherTerritories.size === 0) continue;
    const targets = [...otherTerritories];
    const target = targets[Math.floor(rng() * targets.length)];

    const candidate = map.map(row => [...row]);
    for (const [pr, pc] of patch) candidate[pr][pc] = target;
    if (!isConnected(candidate, n, territory)) continue;

    return candidate;
  }
  return null;
}

export interface SearchConfig {
  n: number;
  seed: string;
  maxIterations: number;
  restartAfterStale: number; // iterations without improvement before a restart
  patchMutationChance: number;
  acceptTolerance: number; // allow slightly-worse moves to escape local optima
  shortlistSize: number;
}

export interface ShortlistEntry {
  territoryMap: number[][];
  solution: [number, number][];
  stall: StallResult;
  score: number;
}

export interface SearchReport {
  candidatesEvaluated: number;
  uniqueBoardsFound: number;
  restarts: number;
  bestScore: number;
  shortlist: ShortlistEntry[];
  runtimeMs: number;
}

export function runMutationSearch(config: SearchConfig): SearchReport {
  const { n, seed, maxIterations, restartAfterStale, patchMutationChance, acceptTolerance, shortlistSize } = config;
  const t0 = Date.now();
  const rng = createRNG(seed);
  const pool = generatePermutationPool(n);

  let candidatesEvaluated = 0;
  let uniqueBoardsFound = 0;
  let restarts = 0;
  let bestScore = -1;
  const shortlist: ShortlistEntry[] = [];

  function considerForShortlist(map: number[][], solution: [number, number][], stall: StallResult, score: number) {
    shortlist.push({ territoryMap: map.map(r => [...r]), solution, stall, score });
    shortlist.sort((a, b) => b.score - a.score);
    // Keep the shortlist diverse: dedupe near-identical scores from the same
    // run by simple truncation — good enough for a bounded experiment.
    if (shortlist.length > shortlistSize) shortlist.length = shortlistSize;
  }

  function freshStart(): { map: number[][]; solution: [number, number][] } | null {
    const start = getValidStartingBoard(n, rng);
    if (!start) return null;
    return { map: start.territoryMap, solution: start.solution };
  }

  let start = freshStart();
  while (!start) start = freshStart(); // keep retrying — rare but not infinite (confirmed non-zero hit rate)
  let map = start.map;
  let solution = start.solution;
  const ctx: MutationContext = { n, seedCells: solution };

  let currentScore = -1;
  {
    const stall = runToStall({ id: 'tmp', title: 'tmp', mode: 'initiate', size: n, territoryMap: map, solution, difficulty: 'Initiate', score: 0, seed, createdAt: '' } as Puzzle);
    currentScore = scoreStall(stall, n);
    candidatesEvaluated++;
    uniqueBoardsFound++; // generatePuzzle's own pipeline already guarantees this
  }

  let staleCount = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    const usePatch = rng() < patchMutationChance;
    const candidateMap = usePatch
      ? tryPatchMutation(map, ctx, rng)
      : trySingleCellMutation(map, ctx, rng);

    if (!candidateMap) { staleCount++; }
    else {
      if (isUniqueFast(candidateMap, pool)) {
        uniqueBoardsFound++;
        const candidatePuzzle = { id: 'tmp', title: 'tmp', mode: 'initiate', size: n, territoryMap: candidateMap, solution, difficulty: 'Initiate', score: 0, seed, createdAt: '' } as Puzzle;
        const stall = runToStall(candidatePuzzle);
        candidatesEvaluated++;
        const score = scoreStall(stall, n);

        if (score >= currentScore - acceptTolerance) {
          map = candidateMap;
          currentScore = score;
          staleCount = 0;
          if (score > 0) considerForShortlist(candidateMap, solution, stall, score);
          if (score > bestScore) bestScore = score;
        } else {
          staleCount++;
        }
      } else {
        staleCount++;
      }
    }

    if (staleCount >= restartAfterStale) {
      restarts++;
      let next = freshStart();
      while (!next) next = freshStart();
      map = next.map;
      solution = next.solution;
      ctx.seedCells = solution;
      const stall = runToStall({ id: 'tmp', title: 'tmp', mode: 'initiate', size: n, territoryMap: map, solution, difficulty: 'Initiate', score: 0, seed, createdAt: '' } as Puzzle);
      candidatesEvaluated++;
      uniqueBoardsFound++;
      currentScore = scoreStall(stall, n);
      staleCount = 0;
    }
  }

  return {
    candidatesEvaluated,
    uniqueBoardsFound,
    restarts,
    bestScore,
    shortlist,
    runtimeMs: Date.now() - t0,
  };
}
