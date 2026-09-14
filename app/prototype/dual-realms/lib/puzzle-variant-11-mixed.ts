import type { DualRealmsPuzzle } from './types';

// Another 2-tile mixed-type puzzle, same recipe as puzzle-variant-8-mixed.ts.
export const DUAL_REALMS_PUZZLE_11: DualRealmsPuzzle = {
  size: 5,

  baseTerritoryMapA: [
    [1, 1, 0, 0, 0],
    [1, 1, 1, 0, 0],
    [2, 4, 3, 3, 0],
    [2, 4, 3, 3, 3],
    [2, 4, 3, 3, 3],
  ],

  baseTerritoryMapB: [
    [1, 1, 0, 0, 0],
    [1, 1, 0, 3, 3],
    [1, 2, 2, 2, 3],
    [1, 1, 3, 3, 3],
    [4, 4, 4, 4, 3],
  ],

  reversibleTiles: [
    { row: 1, col: 2, colorOnA: 1, colorOnB: 0 },
    { row: 1, col: 3, colorOnA: 0, colorOnB: 3 },
  ],

  solutionFlips: [false, false],

  solutionA: [[0, 4], [1, 2], [2, 0], [3, 3], [4, 1]],
  solutionB: [[0, 3], [1, 0], [2, 2], [3, 4], [4, 1]],
};
