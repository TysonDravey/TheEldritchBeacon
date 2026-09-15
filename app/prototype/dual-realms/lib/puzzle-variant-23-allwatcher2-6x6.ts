import type { DualRealmsPuzzle } from './types';

// Second fully-clean 6x6 / 2-Rift, all watcher-type candidate (see
// puzzle-variant-22 for the design writeup). Lower visualRisk (3 vs 4) than
// Puzzle 22 — a slightly cleaner secondary aesthetic score (balanced-corner
// + notch checks), on top of the same hard guarantees: both Rifts stay
// visually contiguous in every flip state, and each reduces its own face to
// ZERO valid solutions when wrong alone.
export const DUAL_REALMS_PUZZLE_23: DualRealmsPuzzle = {
  size: 6,

  baseTerritoryMapA: [
    [0, 0, 1, 3, 3, 3],
    [4, 4, 1, 3, 3, 3],
    [4, 4, 3, 3, 2, 2],
    [4, 4, 3, 3, 3, 3],
    [4, 4, 3, 3, 5, 3],
    [4, 4, 3, 3, 5, 3],
  ],

  baseTerritoryMapB: [
    [0, 0, 0, 1, 3, 3],
    [0, 2, 3, 1, 3, 3],
    [0, 2, 3, 1, 3, 3],
    [3, 3, 3, 3, 3, 3],
    [4, 4, 4, 3, 3, 5],
    [4, 4, 4, 4, 4, 5],
  ],

  reversibleTiles: [
    { row: 4, col: 1, colorOnA: 4, colorOnB: 3 },
    { row: 4, col: 2, colorOnA: 3, colorOnB: 4 },
  ],

  solutionFlips: [false, false],

  solutionA: [[0, 0], [1, 2], [2, 5], [3, 3], [4, 1], [5, 4]],
  solutionB: [[0, 0], [1, 3], [2, 1], [3, 4], [4, 2], [5, 5]],
};
