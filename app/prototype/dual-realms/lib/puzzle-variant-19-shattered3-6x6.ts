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
export const DUAL_REALMS_PUZZLE_19: DualRealmsPuzzle = {
  size: 6,

  baseTerritoryMapA: [
    [2, 2, 2, 1, 1, 0],
    [2, 2, 2, 1, 1, 5],
    [2, 2, 2, 2, 3, 5],
    [4, 5, 2, 0, 3, 4],
    [4, 4, 2, 4, 4, 3],
    [0, 0, 5, 4, 3, 3],
  ],

  baseTerritoryMapB: [
    [5, 3, 3, 0, 2, 0],
    [5, 2, 4, 4, 2, 1],
    [5, 2, 2, 4, 4, 4],
    [1, 2, 4, 3, 3, 3],
    [2, 2, 4, 4, 1, 5],
    [5, 5, 4, 3, 3, 5],
  ],

  reversibleTiles: [
    { row: 5, col: 2, colorOnA: 5, colorOnB: 4 },
    { row: 4, col: 0, colorOnA: 4, colorOnB: 2 },
    { row: 1, col: 5, colorOnA: 5, colorOnB: 1 },
  ],

  solutionFlips: [false, false, false],

  solutionA: [[0, 5], [1, 3], [2, 1], [3, 4], [4, 0], [5, 2]],
  solutionB: [[0, 3], [1, 5], [2, 1], [3, 4], [4, 2], [5, 0]],
};
