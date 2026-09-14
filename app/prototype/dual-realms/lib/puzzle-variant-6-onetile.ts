import type { DualRealmsPuzzle } from './types';

// Same size/rules as puzzle-variant-4-onetile.ts, regenerated with the
// balanced-corner fix.
export const DUAL_REALMS_PUZZLE_6: DualRealmsPuzzle = {
  size: 5,

  baseTerritoryMapA: [
    [0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
    [2, 2, 2, 3, 1],
    [2, 4, 2, 3, 1],
    [2, 4, 2, 3, 1],
  ],

  baseTerritoryMapB: [
    [1, 1, 0, 2, 2],
    [1, 1, 0, 2, 2],
    [1, 1, 0, 2, 2],
    [3, 3, 3, 2, 2],
    [3, 3, 3, 2, 4],
  ],

  reversibleTiles: [
    { row: 1, col: 2, colorOnA: 1, colorOnB: 0 },
  ],

  solutionFlips: [false],

  solutionA: [[0, 2], [1, 4], [2, 0], [3, 3], [4, 1]],
  solutionB: [[0, 2], [1, 0], [2, 3], [3, 1], [4, 4]],
};
