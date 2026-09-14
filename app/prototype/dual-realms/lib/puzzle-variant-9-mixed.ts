import type { DualRealmsPuzzle } from './types';

// Replacement for the original Puzzle 9: that version had a real bug found
// during playtesting — Face B's tile1 (the "ordinary, forced by B" tile)
// only made B non-unique when wrong, not unsolvable, so a player could
// "solve" Face B with tile1 still in the wrong orientation. This version's
// wrong-tile1 state is ALSO only non-unique rather than a hard contradiction
// (this turned out to be true of nearly every generated candidate for this
// tile-type combination at 5x5 — a structural weakness of "ordinary,
// forced-by-B" tiles, not a one-off fluke). What IS fixed here: the visual
// giveaway — neither tile sits in a long straight run of one color, so
// there's no "obviously carved out of a solid line" tell like the original
// had.
export const DUAL_REALMS_PUZZLE_9: DualRealmsPuzzle = {
  size: 5,

  baseTerritoryMapA: [
    [1, 1, 1, 1, 0],
    [1, 1, 1, 1, 0],
    [3, 1, 4, 2, 2],
    [3, 3, 4, 4, 2],
    [3, 3, 4, 4, 2],
  ],

  baseTerritoryMapB: [
    [0, 0, 0, 0, 0],
    [1, 1, 1, 1, 2],
    [3, 3, 3, 2, 2],
    [3, 3, 3, 3, 2],
    [4, 3, 3, 3, 2],
  ],

  reversibleTiles: [
    { row: 2, col: 3, colorOnA: 2, colorOnB: 1 },
    { row: 2, col: 1, colorOnA: 1, colorOnB: 3 },
  ],

  solutionFlips: [false, false],

  solutionA: [[0, 4], [1, 1], [2, 3], [3, 0], [4, 2]],
  solutionB: [[0, 3], [1, 1], [2, 4], [3, 2], [4, 0]],
};
