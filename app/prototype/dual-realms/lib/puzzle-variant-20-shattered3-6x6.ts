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
export const DUAL_REALMS_PUZZLE_20: DualRealmsPuzzle = {
  size: 6,

  baseTerritoryMapA: [
    [3, 2, 0, 2, 2, 2],
    [1, 2, 4, 2, 1, 1],
    [1, 5, 4, 2, 2, 1],
    [3, 3, 4, 4, 4, 4],
    [5, 0, 4, 4, 4, 4],
    [5, 4, 4, 4, 4, 4],
  ],

  baseTerritoryMapB: [
    [5, 3, 1, 2, 2, 0],
    [3, 3, 3, 1, 4, 0],
    [2, 3, 3, 4, 4, 4],
    [2, 4, 3, 5, 5, 3],
    [4, 4, 2, 4, 4, 4],
    [5, 5, 5, 0, 4, 4],
  ],

  reversibleTiles: [
    { row: 2, col: 3, colorOnA: 2, colorOnB: 4 },
    { row: 1, col: 5, colorOnA: 1, colorOnB: 0 },
    { row: 0, col: 5, colorOnA: 2, colorOnB: 0 },
  ],

  solutionFlips: [false, false, false],

  solutionA: [[0, 2], [1, 5], [2, 3], [3, 1], [4, 4], [5, 0]],
  solutionB: [[0, 5], [1, 3], [2, 0], [3, 2], [4, 4], [5, 1]],
};
