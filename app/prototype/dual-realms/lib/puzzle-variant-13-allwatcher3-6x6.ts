import type { DualRealmsPuzzle } from './types';

// Second 6x6 / 3-Rift experiment, with ALL THREE Rifts as watcher-type
// (two tied to Face A's win-check, one to Face B's) — no "ordinary,
// forced-by-B" Rift at all. Built to fix a confirmed bug in
// puzzle-variant-12: the ordinary-type Rift only ever produced ambiguity
// when wrong (multiple valid placements still satisfy isSolved), which let
// a player fully solve the puzzle without ever flipping anything, whenever
// the random start happened to land with the ordinary Rift wrong but both
// watcher Rifts already correct. Every Rift here is verified to reduce its
// own face to ZERO valid solutions when wrong alone (a real dead end, not
// just "the intended solution fails") — see the `watcherTileHolds` check in
// check/route.ts's tryBuildAllWatcherThreeTilePuzzle.
//
// Regenerated once already: the first version placed two Rifts adjacent to
// each other, and one Rift's insertion silently cut off the other's only
// remaining same-color neighbor, splitting that color's territory into two
// disconnected islands (a fracture invisible to any single-tile check,
// caught during playtesting — non-contiguous Ochre at (5,5) on Face B).
// This version's territory connectivity is verified against the fully
// combined map (all Rifts inserted at once), not tile-by-tile in isolation.
export const DUAL_REALMS_PUZZLE_13: DualRealmsPuzzle = {
  size: 6,

  baseTerritoryMapA: [
    [0, 0, 3, 3, 3, 3],
    [0, 0, 3, 3, 3, 1],
    [0, 2, 2, 2, 3, 3],
    [0, 4, 4, 5, 3, 3],
    [0, 4, 4, 5, 3, 3],
    [0, 4, 4, 5, 3, 3],
  ],

  baseTerritoryMapB: [
    [1, 1, 1, 0, 0, 2],
    [1, 1, 1, 0, 0, 2],
    [3, 3, 3, 3, 3, 2],
    [3, 3, 3, 3, 3, 3],
    [4, 4, 5, 3, 3, 3],
    [4, 4, 5, 3, 3, 3],
  ],

  reversibleTiles: [
    { row: 4, col: 1, colorOnA: 4, colorOnB: 3 },
    { row: 0, col: 0, colorOnA: 0, colorOnB: 1 },
    { row: 1, col: 1, colorOnA: 0, colorOnB: 1 },
  ],

  solutionFlips: [false, false, false],

  solutionA: [[0, 0], [1, 5], [2, 2], [3, 4], [4, 1], [5, 3]],
  solutionB: [[0, 4], [1, 1], [2, 5], [3, 3], [4, 0], [5, 2]],
};
