import type { DualRealmsPuzzle } from './types';

// Same size/rules as puzzle-variant-4-onetile.ts, regenerated with the
// balanced-corner fix.
export const DUAL_REALMS_PUZZLE_7: DualRealmsPuzzle = {
  size: 5,

  baseTerritoryMapA: [
    [0, 0, 1, 1, 1],
    [0, 0, 1, 1, 1],
    [0, 2, 3, 3, 3],
    [3, 3, 3, 3, 3],
    [4, 4, 4, 4, 4],
  ],

  baseTerritoryMapB: [
    [0, 0, 0, 1, 3],
    [2, 0, 0, 1, 3],
    [2, 3, 3, 3, 3],
    [2, 3, 3, 3, 3],
    [2, 3, 3, 4, 4],
  ],

  reversibleTiles: [
    { row: 0, col: 2, colorOnA: 1, colorOnB: 0 },
  ],

  solutionFlips: [false],

  solutionA: [[0, 0], [1, 3], [2, 1], [3, 4], [4, 2]],
  solutionB: [[0, 1], [1, 3], [2, 0], [3, 2], [4, 4]],
};
