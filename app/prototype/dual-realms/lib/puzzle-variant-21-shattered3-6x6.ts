import type { DualRealmsPuzzle } from './types';

// 6x6 / 3-Rift, all watcher-type, SHATTERED-REALMS territories (2-3
// islands per color, capped) instead of contiguous blobs. Built to sidestep
// a structural problem found with contiguous 6x6/3-Rift puzzles (13-18):
// flipping a watcher-type Rift away from home reliably disconnects a
// territory, which is a dead giveaway on a normally-contiguous board. On a
// shattered board every color ALREADY has a few separate islands, so a
// Rift's flip doesn't stand out as obviously wrong the way it would on a
// solid blob. Same hard math guarantees as 13-18 (every Rift reduces its
// own face to zero solutions when wrong); island count is capped so flips
// don't push any color into "popcorn" territory (5-6+ islands).
export const DUAL_REALMS_PUZZLE_21: DualRealmsPuzzle = {
  size: 6,

  baseTerritoryMapA: [
    [4, 4, 0, 5, 5, 3],
    [4, 4, 4, 1, 1, 3],
    [2, 2, 5, 3, 1, 1],
    [2, 2, 2, 3, 3, 1],
    [1, 4, 2, 2, 2, 5],
    [1, 0, 2, 2, 5, 5],
  ],

  baseTerritoryMapB: [
    [0, 0, 1, 0, 2, 2],
    [3, 3, 1, 0, 2, 2],
    [3, 3, 1, 2, 2, 2],
    [4, 3, 3, 2, 2, 4],
    [5, 5, 5, 5, 4, 4],
    [1, 1, 1, 5, 5, 5],
  ],

  reversibleTiles: [
    { row: 3, col: 3, colorOnA: 3, colorOnB: 2 },
    { row: 1, col: 4, colorOnA: 1, colorOnB: 2 },
    { row: 5, col: 3, colorOnA: 2, colorOnB: 5 },
  ],

  solutionFlips: [false, false, false],

  solutionA: [[0, 2], [1, 4], [2, 0], [3, 3], [4, 1], [5, 5]],
  solutionB: [[0, 0], [1, 2], [2, 4], [3, 1], [4, 5], [5, 3]],
};
