import type { DualRealmsPuzzle } from './types';

// 6x6 / 3-Rift, all watcher-type (batch generated alongside Puzzle 13 to
// playtest whether the 6x6/3-Rift scale is fun at all). Same generator and
// same hard guarantees as Puzzle 13: every Rift reduces its own face to
// ZERO valid solutions when wrong alone (verified), and the fully-combined
// home-state territories are confirmed contiguous (no multi-tile fracture).
export const DUAL_REALMS_PUZZLE_16: DualRealmsPuzzle = {
  size: 6,

  baseTerritoryMapA: [
    [3, 3, 0, 1, 1, 1],
    [3, 3, 0, 1, 1, 1],
    [3, 3, 2, 2, 1, 1],
    [3, 3, 5, 4, 1, 4],
    [3, 5, 5, 4, 4, 4],
    [3, 5, 5, 4, 4, 4],
  ],

  baseTerritoryMapB: [
    [4, 1, 2, 2, 2, 0],
    [4, 1, 2, 2, 2, 2],
    [4, 1, 2, 2, 2, 2],
    [4, 3, 3, 3, 2, 2],
    [4, 3, 5, 5, 2, 2],
    [4, 3, 5, 5, 2, 2],
  ],

  reversibleTiles: [
    { row: 5, col: 1, colorOnA: 5, colorOnB: 3 },
    { row: 4, col: 4, colorOnA: 4, colorOnB: 2 },
    { row: 5, col: 3, colorOnA: 4, colorOnB: 5 },
  ],

  solutionFlips: [false, false, false],

  solutionA: [[0, 2], [1, 5], [2, 3], [3, 0], [4, 4], [5, 1]],
  solutionB: [[0, 5], [1, 1], [2, 4], [3, 2], [4, 0], [5, 3]],
};
