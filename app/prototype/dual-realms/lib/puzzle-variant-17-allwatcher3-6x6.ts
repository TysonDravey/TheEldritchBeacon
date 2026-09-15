import type { DualRealmsPuzzle } from './types';

// 6x6 / 3-Rift, all watcher-type (batch generated alongside Puzzle 13 to
// playtest whether the 6x6/3-Rift scale is fun at all). Same generator and
// same hard guarantees as Puzzle 13: every Rift reduces its own face to
// ZERO valid solutions when wrong alone (verified), and the fully-combined
// home-state territories are confirmed contiguous (no multi-tile fracture).
export const DUAL_REALMS_PUZZLE_17: DualRealmsPuzzle = {
  size: 6,

  baseTerritoryMapA: [
    [1, 1, 0, 2, 2, 2],
    [1, 1, 0, 2, 2, 2],
    [2, 2, 2, 2, 2, 2],
    [2, 4, 2, 2, 3, 3],
    [2, 4, 2, 5, 5, 5],
    [2, 4, 2, 5, 5, 5],
  ],

  baseTerritoryMapB: [
    [0, 0, 0, 2, 1, 1],
    [0, 0, 0, 2, 1, 1],
    [0, 0, 2, 2, 2, 1],
    [3, 3, 2, 2, 4, 4],
    [3, 5, 2, 2, 4, 4],
    [3, 5, 2, 2, 4, 4],
  ],

  reversibleTiles: [
    { row: 1, col: 0, colorOnA: 1, colorOnB: 0 },
    { row: 5, col: 4, colorOnA: 5, colorOnB: 4 },
    { row: 4, col: 4, colorOnA: 5, colorOnB: 4 },
  ],

  solutionFlips: [false, false, false],

  solutionA: [[0, 2], [1, 0], [2, 3], [3, 5], [4, 1], [5, 4]],
  solutionB: [[0, 2], [1, 5], [2, 3], [3, 0], [4, 4], [5, 1]],
};
