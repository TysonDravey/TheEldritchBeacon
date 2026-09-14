import type { DualRealmsPuzzle } from './types';

// Second Dual Realms puzzle, generated the same way as the default (real
// game's shattered-realms generator per face + asymmetric-blindness search
// via the check/ route) so you have more than one hand to judge the
// mechanic by. Verified: unique combined solution, solvable by pure logic
// on both faces, tile0 forced only by Face A, tile1 only by Face B, tile2
// by either.
export const DUAL_REALMS_PUZZLE_2: DualRealmsPuzzle = {
  size: 5,

  baseTerritoryMapA: [
    [0, 0, 0, 0, 3],
    [2, 2, 1, 0, 4],
    [2, 2, 2, 2, 2],
    [4, 3, 1, 1, 1],
    [4, 4, 4, 4, 1],
  ],

  baseTerritoryMapB: [
    [0, 0, 0, 0, 4],
    [1, 0, 0, 3, 3],
    [2, 3, 3, 4, 2],
    [3, 3, 3, 4, 4],
    [1, 3, 4, 4, 4],
  ],

  reversibleTiles: [
    { row: 4, col: 1, colorOnA: 4, colorOnB: 3 },
    { row: 3, col: 4, colorOnA: 1, colorOnB: 4 },
    { row: 2, col: 3, colorOnA: 2, colorOnB: 4 },
  ],

  solutionFlips: [false, false, false],

  solutionA: [[0, 0], [1, 2], [2, 4], [3, 1], [4, 3]],
  solutionB: [[0, 2], [1, 0], [2, 4], [3, 1], [4, 3]],
};
