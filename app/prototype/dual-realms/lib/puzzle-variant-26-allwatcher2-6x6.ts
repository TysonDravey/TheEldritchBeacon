import type { DualRealmsPuzzle } from './types';

// Best 6x6 / 2-Rift, all watcher-type candidate found so far (visualRisk 2,
// vs 4 and 3 for puzzle-variant-22/24) — the search ran its full budget
// (12000 seeds) hunting for a perfect (visualRisk 0) candidate and didn't
// find one, but kept the lowest-risk fully-clean result throughout. Same
// verification as 22/24: every one of the 3 non-intended flip combinations
// (01, 10, 11) keeps every territory contiguous on both faces, confirmed by
// independent exhaustive flood-fill, and each Rift reduces its own face to
// ZERO valid solutions when wrong alone.
export const DUAL_REALMS_PUZZLE_26: DualRealmsPuzzle = {
  size: 6,

  baseTerritoryMapA: [
    [1, 0, 0, 0, 0, 0],
    [1, 2, 2, 2, 2, 2],
    [1, 3, 3, 2, 2, 2],
    [3, 3, 3, 3, 2, 2],
    [3, 3, 3, 4, 2, 2],
    [3, 3, 4, 4, 5, 5],
  ],

  baseTerritoryMapB: [
    [0, 0, 0, 0, 0, 0],
    [0, 2, 0, 1, 0, 0],
    [0, 2, 0, 1, 0, 0],
    [0, 2, 3, 3, 3, 3],
    [4, 4, 4, 4, 4, 5],
    [4, 4, 4, 4, 4, 5],
  ],

  reversibleTiles: [
    { row: 4, col: 3, colorOnA: 4, colorOnB: 3 },
    { row: 4, col: 2, colorOnA: 3, colorOnB: 4 },
  ],

  solutionFlips: [false, false],

  solutionA: [[0, 2], [1, 0], [2, 4], [3, 1], [4, 3], [5, 5]],
  solutionB: [[0, 0], [1, 3], [2, 1], [3, 4], [4, 2], [5, 5]],
};
