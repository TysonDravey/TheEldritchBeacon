import type { DualRealmsPuzzle } from './types';

// Same size/rules as puzzle-variant-4-onetile.ts, regenerated with the
// balanced-corner fix (see that file's comment for why).
export const DUAL_REALMS_PUZZLE_5: DualRealmsPuzzle = {
  size: 5,

  baseTerritoryMapA: [
    [0, 0, 2, 1, 1],
    [0, 0, 2, 1, 1],
    [3, 3, 2, 3, 3],
    [3, 3, 3, 3, 3],
    [3, 3, 4, 4, 4],
  ],

  baseTerritoryMapB: [
    [0, 2, 2, 1, 1],
    [2, 2, 2, 1, 1],
    [2, 2, 2, 1, 1],
    [2, 2, 3, 3, 3],
    [2, 2, 4, 4, 4],
  ],

  reversibleTiles: [
    { row: 2, col: 4, colorOnA: 3, colorOnB: 1 },
  ],

  solutionFlips: [false],

  solutionA: [[0, 1], [1, 4], [2, 2], [3, 0], [4, 3]],
  solutionB: [[0, 0], [1, 3], [2, 1], [3, 4], [4, 2]],
};
