import type { DualRealmsPuzzle } from './types';

// Replacement for the original Puzzle 10: playtesting found Face B's tile0
// sitting in the middle of a solid run of one color (an obvious "notch"
// giveaway the moment it showed its other color). This version's tile1
// happens to match its face's base color exactly at the home orientation on
// BOTH faces (no visible change from the underlying generated territory at
// all when unflipped), and tile0 only touches a short edge run — neither
// sits in a long straight line of one color.
export const DUAL_REALMS_PUZZLE_10: DualRealmsPuzzle = {
  size: 5,

  baseTerritoryMapA: [
    [1, 1, 1, 0, 0],
    [1, 1, 1, 0, 0],
    [1, 2, 2, 2, 2],
    [1, 4, 3, 3, 3],
    [1, 4, 3, 3, 3],
  ],

  baseTerritoryMapB: [
    [2, 2, 1, 0, 0],
    [2, 2, 1, 2, 2],
    [2, 2, 2, 2, 2],
    [2, 4, 3, 3, 3],
    [2, 4, 3, 3, 3],
  ],

  reversibleTiles: [
    { row: 3, col: 4, colorOnA: 3, colorOnB: 2 },
    { row: 1, col: 4, colorOnA: 0, colorOnB: 2 },
  ],

  solutionFlips: [false, false],

  solutionA: [[0, 3], [1, 0], [2, 2], [3, 4], [4, 1]],
  solutionB: [[0, 4], [1, 2], [2, 0], [3, 3], [4, 1]],
};
