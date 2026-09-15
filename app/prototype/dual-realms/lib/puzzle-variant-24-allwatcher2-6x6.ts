import type { DualRealmsPuzzle } from './types';

// Second fully-clean 6x6 / 2-Rift, all watcher-type candidate, and the
// first one verified under the CORRECTED check: every non-intended flip
// combination (all 3 of them — 01, 10, 11 — not just the 2 single-Rift-
// alone ones) keeps every territory contiguous on both faces. The earlier
// puzzle-variant-23 looked clean under the old single-tile-only check but
// fractured when BOTH Rifts were flipped together; this one was found by a
// generator that sweeps all flip combinations before accepting a
// candidate, so that failure mode is ruled out by construction, not luck.
// Same hard math guarantee as Puzzle 22: each Rift reduces its own face to
// ZERO valid solutions when wrong alone.
export const DUAL_REALMS_PUZZLE_24: DualRealmsPuzzle = {
  size: 6,

  baseTerritoryMapA: [
    [1, 1, 0, 0, 0, 0],
    [1, 1, 0, 0, 0, 0],
    [1, 1, 0, 5, 2, 0],
    [3, 3, 3, 5, 2, 0],
    [4, 4, 4, 5, 5, 0],
    [4, 4, 5, 5, 5, 0],
  ],

  baseTerritoryMapB: [
    [0, 0, 1, 1, 1, 1],
    [0, 0, 1, 1, 1, 1],
    [2, 3, 3, 3, 3, 3],
    [3, 3, 3, 3, 3, 3],
    [3, 3, 3, 5, 4, 4],
    [3, 3, 3, 5, 4, 4],
  ],

  reversibleTiles: [
    { row: 1, col: 1, colorOnA: 1, colorOnB: 0 },
    { row: 0, col: 1, colorOnA: 1, colorOnB: 0 },
  ],

  solutionFlips: [false, false],

  solutionA: [[0, 5], [1, 1], [2, 4], [3, 2], [4, 0], [5, 3]],
  solutionB: [[0, 1], [1, 4], [2, 0], [3, 2], [4, 5], [5, 3]],
};
