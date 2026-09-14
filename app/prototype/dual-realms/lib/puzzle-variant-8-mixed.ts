import type { DualRealmsPuzzle } from './types';

// Experiment: 2 reversible tiles of DIFFERENT kinds, mixed in one puzzle.
//
// Tile 1 at (3,1) is a real watcher position in Face A's solution — getting
// it wrong means the watcher that belongs there is literally missing, so
// Face A's own win-check depends on it directly. Face B stays fully
// indifferent to this tile.
//
// Tile 2 at (3,4) is an ordinary cell (not a watcher position on either
// face) — ward-only, forced by Face B's logic instead. Face A stays
// indifferent to this one.
//
// Regenerated after catching a real problem with the first version: both
// tiles here now sit on a genuinely BALANCED corner between their two
// colors (at least 2 of the 8 surrounding cells matching each color) on
// BOTH faces — a cell bordered mostly by one color with just one poke of
// the other still reads as an obvious visual outlier, letting a player
// solve orientation by eyeballing the shape instead of Watcher logic. See
// isBalancedCorner in the check/ route.
//
// Verified via the check/ route: unique combined solution only at the
// all-home combo, solvable by pure logic on both faces (no guessing).
export const DUAL_REALMS_PUZZLE_MIXED: DualRealmsPuzzle = {
  size: 5,

  baseTerritoryMapA: [
    [0, 0, 0, 0, 0],
    [0, 3, 1, 2, 2],
    [0, 3, 2, 2, 2],
    [0, 3, 2, 2, 4],
    [0, 3, 4, 4, 4],
  ],

  baseTerritoryMapB: [
    [0, 0, 0, 1, 1],
    [0, 2, 2, 1, 1],
    [0, 2, 2, 2, 2],
    [3, 3, 2, 2, 2],
    [3, 3, 2, 4, 4],
  ],

  reversibleTiles: [
    { row: 3, col: 1, colorOnA: 3, colorOnB: 2 },
    { row: 3, col: 4, colorOnA: 4, colorOnB: 2 },
  ],

  solutionFlips: [false, false],

  solutionA: [[0, 0], [1, 2], [2, 4], [3, 1], [4, 3]],
  solutionB: [[0, 1], [1, 4], [2, 2], [3, 0], [4, 3]],
};
