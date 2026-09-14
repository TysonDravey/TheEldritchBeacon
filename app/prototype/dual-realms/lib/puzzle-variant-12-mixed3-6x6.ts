import type { DualRealmsPuzzle } from './types';

// First 6x6 / 3-Facet experiment. Facet0 and Facet2 are both watcher-type
// (Facet0 tied to Face A's win-check, Facet2 tied to Face B's) — the first
// puzzle where BOTH faces have a hard, contradiction-backed Facet instead
// of just one. Facet1 stays the "ordinary, forced by B" type from the
// 2-Facet puzzles (8-11), including that design's known residual weakness:
// a wrong Facet1 only guarantees Face B becomes ambiguous, not unsolvable
// (see puzzle-variant-9-mixed.ts for the full writeup — this is structural
// to that Facet type, not specific to this puzzle).
export const DUAL_REALMS_PUZZLE_12: DualRealmsPuzzle = {
  size: 6,

  baseTerritoryMapA: [
    [1, 1, 0, 0, 2, 2],
    [1, 1, 1, 1, 2, 2],
    [1, 1, 1, 1, 2, 2],
    [3, 3, 3, 3, 4, 4],
    [4, 4, 4, 4, 4, 4],
    [4, 4, 4, 5, 4, 4],
  ],

  baseTerritoryMapB: [
    [2, 0, 2, 1, 1, 1],
    [2, 2, 2, 2, 1, 1],
    [2, 2, 2, 2, 1, 1],
    [2, 2, 3, 3, 3, 3],
    [2, 2, 5, 4, 4, 4],
    [2, 2, 5, 4, 4, 4],
  ],

  reversibleTiles: [
    { row: 2, col: 4, colorOnA: 2, colorOnB: 1 },
    { row: 1, col: 3, colorOnA: 1, colorOnB: 2 },
    { row: 1, col: 4, colorOnA: 2, colorOnB: 1 },
  ],

  solutionFlips: [false, false, false],

  solutionA: [[0, 2], [1, 0], [2, 4], [3, 1], [4, 5], [5, 3]],
  solutionB: [[0, 1], [1, 4], [2, 0], [3, 3], [4, 5], [5, 2]],
};
