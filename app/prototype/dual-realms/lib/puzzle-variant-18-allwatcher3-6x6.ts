import type { DualRealmsPuzzle } from './types';

// 6x6 / 3-Rift, all watcher-type (batch generated alongside Puzzle 13 to
// playtest whether the 6x6/3-Rift scale is fun at all). Same generator and
// same hard guarantees as Puzzle 13: every Rift reduces its own face to
// ZERO valid solutions when wrong alone (verified), and the fully-combined
// home-state territories are confirmed contiguous (no multi-tile fracture).
export const DUAL_REALMS_PUZZLE_18: DualRealmsPuzzle = {
  size: 6,

  baseTerritoryMapA: [
    [3, 2, 0, 0, 1, 1],
    [3, 2, 0, 0, 1, 1],
    [3, 2, 2, 0, 1, 1],
    [3, 3, 4, 4, 4, 4],
    [3, 5, 4, 4, 4, 4],
    [3, 5, 4, 4, 4, 4],
  ],

  baseTerritoryMapB: [
    [1, 1, 1, 1, 0, 0],
    [1, 1, 1, 1, 0, 0],
    [3, 3, 4, 4, 0, 2],
    [3, 3, 3, 4, 0, 0],
    [3, 5, 3, 4, 0, 0],
    [3, 5, 3, 4, 0, 0],
  ],

  reversibleTiles: [
    { row: 0, col: 3, colorOnA: 0, colorOnB: 1 },
    { row: 2, col: 2, colorOnA: 2, colorOnB: 4 },
    { row: 0, col: 4, colorOnA: 1, colorOnB: 0 },
  ],

  solutionFlips: [false, false, false],

  solutionA: [[0, 3], [1, 5], [2, 2], [3, 0], [4, 4], [5, 1]],
  solutionB: [[0, 4], [1, 2], [2, 5], [3, 0], [4, 3], [5, 1]],
};
