import type { DualRealmsPuzzle } from './types';

// SAVED VARIANT — not wired into the UI. This is the v1 puzzle before the
// territory layout was redone with contiguous (blob-shaped) regions, in
// response to feedback that it looked like a Shattered Realms board rather
// than a normal one. Keeping it around as a candidate "Nightmare/Unbound"
// difficulty tier later — fully scattered, non-contiguous territories are a
// legitimate harder variant, just not what v1 should default to.
//
// Verified structurally sound via the check/ route at the time it was built:
// unique combined solution, solvable by pure logic on both faces, and the
// same asymmetric-blindness property (tile0 forced only by Face A, tile1
// only by Face B, tile2 by either) as the current default puzzle.
//
// To use: swap the import in DualRealmsClient.tsx from './lib/puzzle' to
// './lib/puzzle-variant-scattered', or add a mode toggle.
export const DUAL_REALMS_PUZZLE_SCATTERED: DualRealmsPuzzle = {
  size: 5,

  baseTerritoryMapA: [
    [0, 0, 2, 3, 3],
    [1, 0, 1, 3, 0],
    [0, 2, 3, 4, 2],
    [0, 3, 1, 2, 2],
    [3, 1, 0, 4, 4],
  ],

  baseTerritoryMapB: [
    [1, 2, 4, 1, 0],
    [0, 1, 1, 1, 3],
    [0, 2, 1, 2, 1],
    [3, 1, 3, 0, 2],
    [2, 4, 4, 1, 0],
  ],

  reversibleTiles: [
    { row: 0, col: 1, colorOnA: 0, colorOnB: 2 },
    { row: 2, col: 2, colorOnA: 3, colorOnB: 1 },
    { row: 4, col: 4, colorOnA: 4, colorOnB: 0 },
  ],

  solutionFlips: [false, false, false],

  solutionA: [[0, 0], [1, 2], [2, 4], [3, 1], [4, 3]],
  solutionB: [[0, 4], [1, 1], [2, 3], [3, 0], [4, 2]],
};
