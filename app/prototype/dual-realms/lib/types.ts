import type { CellState } from '@/engine/boardTypes';

export type FaceId = 'A' | 'B';

/**
 * One physical reversible tile, shared between Face A and Face B at the same
 * (row, col) on both boards. `colorOnA`/`colorOnB` are the territory IDs it
 * counts toward on each face WHEN UNFLIPPED. Flipping swaps which face gets
 * which — i.e. when flipped, Face A shows `colorOnB` and Face B shows
 * `colorOnA` at this position.
 */
export interface ReversibleTile {
  row: number;
  col: number;
  colorOnA: number;
  colorOnB: number;
}

/**
 * A hand-authored Dual Realms puzzle: two ordinary Beacon territory maps
 * (used wherever a cell isn't a reversible tile) plus the shared reversible
 * tiles, and the intended solution for each face (for the debug/check route
 * only — never shown to the player).
 */
export interface DualRealmsPuzzle {
  size: number;
  baseTerritoryMapA: number[][];
  baseTerritoryMapB: number[][];
  reversibleTiles: ReversibleTile[];
  /** true = tile shows colorOnB on Face A / colorOnA on Face B (flipped from its "home" state) */
  solutionFlips: boolean[];
  solutionA: [number, number][];
  solutionB: [number, number][];
}

export interface FaceRuntimeState {
  cells: CellState[][];
}
