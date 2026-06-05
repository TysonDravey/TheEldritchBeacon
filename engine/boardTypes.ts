export type CellState = 'empty' | 'watcher' | 'ward';

export interface Cell {
  row: number;
  col: number;
  territory: number;  // 0-indexed territory ID
  state: CellState;
}

export interface Board {
  size: number;            // N for NxN
  cells: Cell[][];         // [row][col]
  territories: number;     // how many territories
}

export type PuzzleMode = 'initiate' | 'cult-master' | 'twin-watchers' | 'shattered-realms';

export type Difficulty = 'Initiate' | 'Scholar' | 'Occultist' | 'High Priest' | 'Eldritch' | 'Harbinger' | 'Archon';

export interface Puzzle {
  id: string;
  title: string;
  mode: PuzzleMode;
  size: number;
  territoryMap: number[][];   // [row][col] = territory ID
  solution: [number, number][]; // [row, col] of each Watcher in solution order
  difficulty: Difficulty;
  seed: string;
  createdAt: string;
  generatorCmd?: string;  // exact CLI invocation that produced this puzzle
}

export interface PlayerState {
  puzzleId: string;
  cells: CellState[][];    // [row][col]
  undoStack: CellState[][][];
  hintsUsed: number;
  mistakes: number;
  startTime: number;
  elapsedTime: number;
  completed: boolean;
}

export type DeductionReasonType =
  | 'adjacency'
  | 'row-occupied'
  | 'col-occupied'
  | 'territory-occupied'
  | 'row-confinement'
  | 'col-confinement'
  | 'pair-row'
  | 'pair-col'
  | 'hidden-set-row'
  | 'hidden-set-col'
  | 'naked-single-territory'
  | 'naked-single-row'
  | 'naked-single-col'
  | 'dual-confinement'
  | 'territory-dead-end'
  | 'hypothetical';

export interface DeductionResult {
  type: 'ward' | 'watcher';
  row: number;
  col: number;
  reason: string;
  reasonType?: DeductionReasonType;
  /** For confinement: the territory whose confinement caused this elimination */
  confinedTerritory?: number;
  /** For pair: the group of territories that share the rows/cols */
  pairedTerritories?: number[];
  /** For row/col occupied: the watcher position that blocks this */
  blockedBy?: [number, number];
  affectedCells?: [number, number][];
  affectedTerritories?: number[];
}

export interface HintResult {
  level: 1 | 2 | 3 | 4;
  message: string;
  primaryCell?: [number, number];       // single cell that gets the spinner marker
  highlightCells?: [number, number][];  // red outline
  secondaryHighlightCells?: [number, number][];  // brass outline (cause cells)
  highlightTerritories?: number[];      // red outline — the affected territory
  secondaryHighlightTerritories?: number[];      // brass outline — the cause territory
  highlightRows?: number[];
  highlightCols?: number[];
  deduction?: DeductionResult;
  cascadeSteps?: [number, number][];             // Level III hypothetical: forced watcher chain
  cascadeConstraintWaves?: [number, number][][][]; // Level III hypothetical: per-watcher waves [watcherIdx][waveIdx] = cells
  cascadeVictimCells?: [number, number][];       // Level III hypothetical: victim cells NOT covered by constraint waves
}

export interface ContradictionResult {
  found: boolean;
  message?: string;
  affectedCells?: [number, number][];
  affectedTerritories?: number[];
}
