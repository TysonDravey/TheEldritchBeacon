import type { DualRealmsPuzzle } from './types';

// 6x6 / 2-Rift, all watcher-type (one tied to Face A's win-check, one to
// Face B's) — no third A-tied Rift like the 3-Rift design. Built after the
// 3-Rift search consistently found 0-of-3-fully-clean candidates (0/38+ in
// large batches): with only 2 independent "stay clean when flipped" events
// needing to align instead of 3, this is a meaningfully easier bar, and it
// paid off — this is the first fully-clean candidate the 2-Rift search
// found: BOTH Rifts stay visually contiguous in every flip state, not just
// the intended one, confirmed via exhaustive flood-fill checking. Same hard
// math guarantee as the 3-Rift puzzles: each Rift reduces its own face to
// ZERO valid solutions when wrong alone (verified, not assumed).
export const DUAL_REALMS_PUZZLE_22: DualRealmsPuzzle = {
  size: 6,

  baseTerritoryMapA: [
    [1, 1, 1, 0, 0, 0],
    [1, 1, 1, 0, 0, 0],
    [1, 1, 2, 0, 0, 0],
    [1, 1, 3, 3, 3, 3],
    [4, 4, 4, 4, 4, 5],
    [4, 4, 4, 4, 4, 5],
  ],

  baseTerritoryMapB: [
    [0, 0, 0, 1, 1, 1],
    [0, 0, 0, 1, 1, 1],
    [2, 0, 0, 1, 1, 1],
    [2, 0, 0, 1, 3, 3],
    [4, 4, 4, 4, 5, 3],
    [4, 4, 4, 4, 5, 3],
  ],

  reversibleTiles: [
    { row: 0, col: 3, colorOnA: 0, colorOnB: 1 },
    { row: 1, col: 3, colorOnA: 0, colorOnB: 1 },
  ],

  solutionFlips: [false, false],

  solutionA: [[0, 3], [1, 0], [2, 2], [3, 4], [4, 1], [5, 5]],
  solutionB: [[0, 1], [1, 3], [2, 0], [3, 5], [4, 2], [5, 4]],
};
