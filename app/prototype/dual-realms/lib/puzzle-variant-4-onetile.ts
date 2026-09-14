import type { DualRealmsPuzzle } from './types';

// Scaled-down experiment: ONE reversible tile instead of three, on
// contiguous (blob-shaped) territories like a normal Beacon board — not
// scattered. This is the combination that failed entirely at 3 tiles (0/1200
// search attempts) but succeeds readily at 1 tile.
//
// Regenerated after catching a real problem: the tile's position must sit on
// a genuinely BALANCED corner between its two colors (at least 2 of the 8
// surrounding cells matching each color), not just "borders one same-colored
// neighbor somewhere" — a cell with 3 same-colored neighbors and one lone
// poke of the other color still reads as an obvious visual outlier, letting
// a player solve orientation by eyeballing the shape rather than by Watcher
// logic. See isBalancedCorner in the check/ route.
//
// Verified via the check/ route: unique combined solution, the ONE tile is
// forced by Face A's own logic (Face B's logic alone accepts either color),
// both faces solvable by the real pure-logic solver (no guessing/backtracking
// required), and the tile sits on a balanced corner on BOTH faces.
export const DUAL_REALMS_PUZZLE_ONE_TILE: DualRealmsPuzzle = {
  size: 5,

  baseTerritoryMapA: [
    [0, 1, 1, 1, 2],
    [1, 1, 1, 1, 2],
    [1, 1, 1, 1, 2],
    [3, 3, 3, 4, 2],
    [4, 4, 4, 4, 4],
  ],

  baseTerritoryMapB: [
    [1, 1, 1, 0, 0],
    [1, 1, 1, 0, 0],
    [1, 1, 2, 3, 3],
    [1, 3, 3, 3, 3],
    [4, 4, 4, 3, 3],
  ],

  reversibleTiles: [
    { row: 2, col: 1, colorOnA: 1, colorOnB: 3 },
  ],

  solutionFlips: [false],

  solutionA: [[0, 0], [1, 2], [2, 4], [3, 1], [4, 3]],
  solutionB: [[0, 3], [1, 0], [2, 2], [3, 4], [4, 1]],
};
