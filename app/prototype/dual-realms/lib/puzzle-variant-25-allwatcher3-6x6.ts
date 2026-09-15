import type { DualRealmsPuzzle } from './types';

// First 6x6 / 3-Rift, all watcher-type puzzle verified under the CORRECTED
// check: every one of the 2^3-1 = 7 non-intended flip combinations (not
// just the 3 single-Rift-alone ones) keeps every territory contiguous on
// both faces. The earlier Puzzles 13-18 all looked clean under the old
// single-tile-only check but fractured on most/all multi-Rift flip
// combinations (5-7 of 7) — this one was found by a generator that sweeps
// all flip combinations before accepting a candidate, ruling that failure
// mode out by construction. Same hard math guarantee as the earlier
// batch: each Rift reduces its own face to ZERO valid solutions when wrong
// alone (verified via exhaustive enumeration, not assumed).
export const DUAL_REALMS_PUZZLE_25: DualRealmsPuzzle = {
  size: 6,

  baseTerritoryMapA: [
    [2, 0, 2, 2, 1, 1],
    [2, 2, 2, 2, 1, 1],
    [2, 2, 2, 2, 1, 1],
    [2, 2, 2, 3, 3, 3],
    [2, 4, 4, 4, 4, 4],
    [5, 5, 4, 4, 4, 4],
  ],

  baseTerritoryMapB: [
    [2, 0, 2, 2, 1, 1],
    [2, 2, 2, 2, 2, 1],
    [2, 2, 2, 2, 3, 1],
    [2, 2, 2, 2, 3, 1],
    [4, 4, 4, 5, 3, 3],
    [4, 4, 4, 5, 3, 3],
  ],

  reversibleTiles: [
    { row: 1, col: 4, colorOnA: 1, colorOnB: 2 },
    { row: 3, col: 5, colorOnA: 3, colorOnB: 1 },
    { row: 4, col: 0, colorOnA: 2, colorOnB: 4 },
  ],

  solutionFlips: [false, false, false],

  solutionA: [[0, 1], [1, 4], [2, 2], [3, 5], [4, 3], [5, 0]],
  solutionB: [[0, 1], [1, 5], [2, 2], [3, 4], [4, 0], [5, 3]],
};
