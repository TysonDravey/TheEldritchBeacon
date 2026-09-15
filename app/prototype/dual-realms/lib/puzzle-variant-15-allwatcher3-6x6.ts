import type { DualRealmsPuzzle } from './types';

// 6x6 / 3-Rift, all watcher-type (batch generated alongside Puzzle 13 to
// playtest whether the 6x6/3-Rift scale is fun at all). Same generator and
// same hard guarantees as Puzzle 13: every Rift reduces its own face to
// ZERO valid solutions when wrong alone (verified), and the fully-combined
// home-state territories are confirmed contiguous (no multi-tile fracture).
export const DUAL_REALMS_PUZZLE_15: DualRealmsPuzzle = {
  size: 6,

  baseTerritoryMapA: [
    [2, 0, 3, 1, 1, 1],
    [2, 2, 3, 1, 1, 1],
    [2, 2, 3, 3, 3, 4],
    [3, 3, 3, 3, 3, 4],
    [3, 3, 3, 5, 3, 4],
    [3, 3, 3, 5, 3, 4],
  ],

  baseTerritoryMapB: [
    [0, 0, 0, 0, 0, 1],
    [2, 2, 2, 2, 1, 1],
    [2, 2, 2, 2, 2, 1],
    [3, 3, 2, 2, 2, 1],
    [5, 3, 2, 2, 4, 4],
    [5, 3, 2, 2, 4, 4],
  ],

  reversibleTiles: [
    { row: 1, col: 4, colorOnA: 1, colorOnB: 0 },
    { row: 2, col: 0, colorOnA: 2, colorOnB: 3 },
    { row: 2, col: 3, colorOnA: 3, colorOnB: 2 },
  ],

  solutionFlips: [false, false, false],

  solutionA: [[0, 1], [1, 4], [2, 0], [3, 2], [4, 5], [5, 3]],
  solutionB: [[0, 2], [1, 5], [2, 3], [3, 1], [4, 4], [5, 0]],
};
