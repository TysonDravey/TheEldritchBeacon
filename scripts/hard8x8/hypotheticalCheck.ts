/**
 * hypotheticalCheck.ts
 *
 * An early stall alone isn't a successful puzzle — a unique board that only
 * yields to exhaustive search isn't automatically human-solvable. This tests
 * whether a SHORT, EXPLAINABLE hypothetical deduction can break a stall:
 * one assumed placement, propagated through the solver's existing cheap
 * technique ladder, no nested assumptions (maxDepth=0 — contradictionTest's
 * own recursion is OFF), with a full step-by-step trace recorded.
 *
 * Reuses the solver's own existing machinery rather than reimplementing it:
 * getNextDeduction(..., maxDepth=0) on a stalled board necessarily skips
 * every technique that already returned null during the stall and falls
 * through directly to contradictionTest — so calling it once tells us
 * whether a depth-0 (single-assumption) hypothetical exists. traceWardChain
 * then replays that exact proof (the same propagation contradictionTest
 * itself uses) to recover the full step list for reporting.
 */

import { getNextDeduction, traceWardChain } from '../../engine/solver';
import type { Puzzle, CellState, DeductionResult } from '../../engine/boardTypes';

export interface HypotheticalProof {
  found: boolean;
  cell?: [number, number];
  proofSteps?: DeductionResult[];
  proofLength?: number;
  assumptionDepth?: number; // 0 = single assumption, no nesting
  territoriesInvolved?: number[];
  rowsInvolved?: number[];
  colsInvolved?: number[];
}

/**
 * Tests for a single-assumption (maxDepth=0) hypothetical deduction from the
 * given board state. Does NOT mutate `cells`.
 */
export function checkSingleAssumptionHypothetical(
  puzzle: Puzzle,
  cells: CellState[][],
): HypotheticalProof {
  const d = getNextDeduction(puzzle, cells, 0);
  if (!d || d.reasonType !== 'hypothetical') return { found: false };

  const chain = traceWardChain(puzzle, cells, d.row, d.col, 0);
  const territories = new Set<number>();
  const rows = new Set<number>();
  const cols = new Set<number>();
  for (const step of chain) {
    rows.add(step.row);
    cols.add(step.col);
    for (const t of step.affectedTerritories ?? []) territories.add(t);
  }
  if (d.confinedTerritory !== undefined) territories.add(d.confinedTerritory);

  return {
    found: true,
    cell: [d.row, d.col],
    proofSteps: chain,
    proofLength: chain.length,
    assumptionDepth: 0,
    territoriesInvolved: [...territories],
    rowsInvolved: [...rows],
    colsInvolved: [...cols],
  };
}

/**
 * Same check but with ONE level of nested assumption allowed (maxDepth=1 —
 * the solver's "Forced Territory Chain"). Reported SEPARATELY, never
 * conflated with the single-assumption result — a candidate that only
 * passes at depth=1 is a materially different (harder to explain) claim.
 */
export function checkNestedHypothetical(
  puzzle: Puzzle,
  cells: CellState[][],
): HypotheticalProof {
  const d = getNextDeduction(puzzle, cells, 1);
  if (!d || d.reasonType !== 'hypothetical') return { found: false };

  const chain = traceWardChain(puzzle, cells, d.row, d.col, 1);
  const territories = new Set<number>();
  const rows = new Set<number>();
  const cols = new Set<number>();
  for (const step of chain) {
    rows.add(step.row);
    cols.add(step.col);
    for (const t of step.affectedTerritories ?? []) territories.add(t);
  }
  if (d.confinedTerritory !== undefined) territories.add(d.confinedTerritory);

  return {
    found: true,
    cell: [d.row, d.col],
    proofSteps: chain,
    proofLength: chain.length,
    assumptionDepth: 1,
    territoriesInvolved: [...territories],
    rowsInvolved: [...rows],
    colsInvolved: [...cols],
  };
}
