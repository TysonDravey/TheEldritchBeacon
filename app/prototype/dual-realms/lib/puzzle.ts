import type { DualRealmsPuzzle } from './types';

// Hand-authored v1 Dual Realms puzzle. 5x5, 3 reversible tiles.
//
// Each face's territory map comes straight from the real game's own
// generatePuzzle() (engine/generator.ts) — contiguous, blob-shaped regions,
// the same as any normal Beacon board, not the scattered "Shattered Realms"
// look the very first version of this puzzle accidentally had. Reversible
// tile positions and colors were then chosen so each tile's color is
// naturally already what that face's own generator assigned there (no
// forcing) — see the check/ route (GET /prototype/dual-realms/check?full=1)
// for the search that produced this, and puzzle-variant-scattered.ts for
// the earlier scattered version (saved as a possible future "Nightmare"
// difficulty tier).
//
// Verified via the check/ route: exactly one flip combination (all
// unflipped) makes BOTH faces uniquely solvable at once, both solvable by
// the real pure-logic solver, and the asymmetric-blindness property holds —
// tile 0 is forced only by Face A's own logic, tile 1 only by Face B's,
// tile 2 by either (redundant safety net).
//
// Solution A (territory -> watcher cell): 1->(1,0) 0->(0,3) 2->(2,2) 3->(3,4) 4->(4,1)
// Solution B (territory -> watcher cell): 2->(2,0) 1->(1,2) 0->(0,4) 3->(3,3) 4->(4,1)
export const DUAL_REALMS_PUZZLE: DualRealmsPuzzle = {
  size: 5,

  baseTerritoryMapA: [
    [1, 1, 0, 0, 0],
    [1, 1, 1, 0, 3],
    [1, 1, 2, 0, 3],
    [1, 4, 2, 0, 3],
    [1, 4, 2, 0, 3],
  ],

  baseTerritoryMapB: [
    [2, 2, 2, 2, 0],
    [2, 1, 1, 1, 1],
    [2, 3, 3, 3, 3],
    [4, 3, 3, 3, 3],
    [4, 4, 4, 4, 4],
  ],

  reversibleTiles: [
    { row: 4, col: 0, colorOnA: 1, colorOnB: 4 },
    { row: 4, col: 3, colorOnA: 0, colorOnB: 4 },
    { row: 0, col: 2, colorOnA: 0, colorOnB: 2 },
  ],

  solutionFlips: [false, false, false],

  solutionA: [[0, 3], [1, 0], [2, 2], [3, 4], [4, 1]],
  solutionB: [[0, 4], [1, 2], [2, 0], [3, 3], [4, 1]],
};
