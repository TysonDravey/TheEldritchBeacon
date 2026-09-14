import type { DualRealmsPuzzle } from './types';

// Third Dual Realms puzzle, generated the same way as the default and
// variant-2. Verified: unique combined solution, solvable by pure logic on
// both faces, tile0 forced only by Face A, tile1 only by Face B, tile2 by
// either.
export const DUAL_REALMS_PUZZLE_3: DualRealmsPuzzle = {
  size: 5,

  baseTerritoryMapA: [
    [1, 1, 2, 0, 3],
    [1, 1, 2, 2, 3],
    [2, 2, 2, 2, 4],
    [1, 4, 2, 0, 3],
    [4, 4, 4, 0, 1],
  ],

  baseTerritoryMapB: [
    [0, 0, 1, 1, 1],
    [1, 0, 1, 1, 1],
    [2, 0, 0, 0, 3],
    [4, 0, 3, 3, 3],
    [2, 3, 3, 4, 4],
  ],

  reversibleTiles: [
    { row: 1, col: 2, colorOnA: 2, colorOnB: 1 },
    { row: 4, col: 2, colorOnA: 4, colorOnB: 3 },
    { row: 2, col: 4, colorOnA: 4, colorOnB: 3 },
  ],

  solutionFlips: [false, false, false],

  solutionA: [[0, 3], [1, 0], [2, 2], [3, 4], [4, 1]],
  solutionB: [[0, 1], [1, 3], [2, 0], [3, 2], [4, 4]],
};
