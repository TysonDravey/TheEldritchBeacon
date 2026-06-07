import type { Puzzle, CellState, HintResult, DeductionResult } from './boardTypes';
import { findContradictions, getNextDeduction, getCandidates, computeCascadeSteps, buildCascadeConstraintWaves } from './solver';
import { getWatcherPositions } from './rules';

// ---------------------------------------------------------------------------
// Territory names
// ---------------------------------------------------------------------------

const TERRITORY_NAMES: string[] = [
  'Crimson', 'Ochre', 'Sea Green', 'Bone', 'Storm Grey',
  'Faded Indigo', 'Emerald', 'Violet', 'Copper', 'Rose',
];

function tname(index: number): string {
  return TERRITORY_NAMES[index] ?? `Territory ${index + 1}`;
}

function tnames(indices: number[]): string {
  if (indices.length === 0) return 'an unknown territory';
  if (indices.length === 1) return `the ${tname(indices[0])} territory`;
  const last = indices[indices.length - 1];
  const rest = indices.slice(0, -1);
  return `the ${rest.map(tname).join(', ')} and ${tname(last)} territories`;
}

// ---------------------------------------------------------------------------
// Build hint messages for each deduction type and depth
// depth 0 → vague (look here)
// depth 1 → explains the consequence ("if you placed here...")
// depth 2+ → direct answer with full reason
// ---------------------------------------------------------------------------

function buildWardHint(
  d: DeductionResult,
  puzzle: Puzzle,
  depth: number,
  playerCells: CellState[][],
): HintResult {
  const { row, col, reasonType, confinedTerritory, pairedTerritories, blockedBy } = d;
  const cellTerritory = puzzle.territoryMap[row][col];

  // ---- Direct post-watcher cleanup (adjacency / row/col/territory occupied) ----
  // These are always obvious once you see them, so depth doesn't matter much.

  if (reasonType === 'adjacency' && blockedBy) {
    const [br, bc] = blockedBy;
    const blockerTerritory = puzzle.territoryMap[br][bc];
    if (depth === 0) {
      return {
        level: 1,
        message: `The ${tname(blockerTerritory)} Watcher casts a shadow over nearby cells.`,
        highlightCells: [[br, bc]],
        highlightTerritories: [blockerTerritory],
      };
    }
    return {
      level: 3,
      message: `No Watcher may stand adjacent to another. The ${tname(blockerTerritory)} Watcher at row ${br + 1}, column ${bc + 1} makes this cell impossible. Mark it with a Ward.`,
      highlightCells: [[row, col], [br, bc]],
      highlightTerritories: [blockerTerritory],
      deduction: d,
    };
  }

  if (reasonType === 'row-occupied' && blockedBy) {
    const [br, bc] = blockedBy;
    const blockerTerritory = puzzle.territoryMap[br][bc];
    if (depth === 0) {
      return {
        level: 1,
        message: `Row ${br + 1} has already received its Watcher.`,
        highlightRows: [br],
        highlightTerritories: [blockerTerritory],
      };
    }
    return {
      level: 3,
      message: `The ${tname(blockerTerritory)} Watcher at column ${bc + 1} claims row ${br + 1}. No other Watcher may share that row. Mark this cell with a Ward.`,
      highlightCells: [[row, col], [br, bc]],
      highlightRows: [br],
      deduction: d,
    };
  }

  if (reasonType === 'col-occupied' && blockedBy) {
    const [br, bc] = blockedBy;
    const blockerTerritory = puzzle.territoryMap[br][bc];
    if (depth === 0) {
      return {
        level: 1,
        message: `Column ${bc + 1} has already received its Watcher.`,
        highlightCols: [bc],
        highlightTerritories: [blockerTerritory],
      };
    }
    return {
      level: 3,
      message: `The ${tname(blockerTerritory)} Watcher at row ${br + 1} claims column ${bc + 1}. No other Watcher may share that column. Mark this cell with a Ward.`,
      highlightCells: [[row, col], [br, bc]],
      highlightCols: [bc],
      deduction: d,
    };
  }

  if (reasonType === 'territory-occupied' && blockedBy) {
    const [br, bc] = blockedBy;
    if (depth === 0) {
      return {
        level: 1,
        message: `The ${tname(cellTerritory)} territory has already been claimed.`,
        highlightTerritories: [cellTerritory],
      };
    }
    return {
      level: 3,
      message: `The ${tname(cellTerritory)} territory already has a Watcher at row ${br + 1}, column ${bc + 1}. This cell must be a Ward.`,
      highlightCells: [[row, col], [br, bc]],
      highlightTerritories: [cellTerritory],
      deduction: d,
    };
  }

  // ---- Row confinement ----
  if (reasonType === 'row-confinement' && confinedTerritory !== undefined) {
    const confined = confinedTerritory;
    if (depth === 0) {
      return {
        level: 1,
        message: `Study the ${tname(confined)} territory. Its Watcher is confined to a single row.`,
        secondaryHighlightTerritories: [confined],
        highlightRows: [row],
      };
    }
    if (depth === 1) {
      return {
        level: 2,
        message: `The ${tname(confined)} territory can only place its Watcher somewhere in row ${row + 1}. If a Watcher rose at this cell, it would claim that row — leaving the ${tname(confined)} territory with nowhere to go.`,
        highlightCells: [[row, col]],
        highlightTerritories: [cellTerritory],
        secondaryHighlightTerritories: [confined],
        highlightRows: [row],
      };
    }
    return {
      level: 3,
      message: `The ${tname(confined)} territory is confined to row ${row + 1}. Since it must use that row, no other Watcher can occupy it. This cell — belonging to the ${tname(cellTerritory)} territory — must be a Ward.`,
      highlightCells: [[row, col]],
      highlightTerritories: [cellTerritory],
      secondaryHighlightTerritories: [confined],
      highlightRows: [row],
      deduction: d,
    };
  }

  // ---- Column confinement ----
  if (reasonType === 'col-confinement' && confinedTerritory !== undefined) {
    const confined = confinedTerritory;
    if (depth === 0) {
      return {
        level: 1,
        message: `Study the ${tname(confined)} territory. Its Watcher is confined to a single column.`,
        secondaryHighlightTerritories: [confined],
        highlightCols: [col],
      };
    }
    if (depth === 1) {
      return {
        level: 2,
        message: `The ${tname(confined)} territory can only place its Watcher somewhere in column ${col + 1}. If a Watcher rose at this cell, it would claim that column — leaving the ${tname(confined)} territory with nowhere to go.`,
        highlightCells: [[row, col]],
        highlightTerritories: [cellTerritory],
        secondaryHighlightTerritories: [confined],
        highlightCols: [col],
      };
    }
    return {
      level: 3,
      message: `The ${tname(confined)} territory is confined to column ${col + 1}. Since it must use that column, no other Watcher can occupy it. This cell must be a Ward.`,
      highlightCells: [[row, col]],
      highlightTerritories: [cellTerritory],
      secondaryHighlightTerritories: [confined],
      highlightCols: [col],
      deduction: d,
    };
  }

  // ---- Pair / group elimination ----
  if ((reasonType === 'pair-row' || reasonType === 'pair-col') && pairedTerritories?.length) {
    const paired = pairedTerritories;
    const dim = reasonType === 'pair-row' ? 'row' : 'column';
    const dimNum = reasonType === 'pair-row' ? row + 1 : col + 1;

    // Compute contested rows/cols and the candidate cells of the paired territories
    const allCandidates = getCandidates(puzzle, playerCells);
    const contestedDims = new Set<number>();
    const pairedCandidateCells: [number, number][] = [];
    for (const t of paired) {
      for (const [r, c] of (allCandidates.get(t) ?? [])) {
        contestedDims.add(reasonType === 'pair-row' ? r : c);
        pairedCandidateCells.push([r, c]);
      }
    }
    const dimHighlight = reasonType === 'pair-row'
      ? { highlightRows: Array.from(contestedDims) }
      : { highlightCols: Array.from(contestedDims) };

    if (depth === 0) {
      return {
        level: 1,
        message: `${tnames(paired)} are competing for the same ${dim}s. Consider what that means for other territories.`,
        secondaryHighlightCells: pairedCandidateCells,
        ...dimHighlight,
      };
    }
    if (depth === 1) {
      return {
        level: 2,
        message: `${tnames(paired)} together can only fit into the same ${paired.length} ${dim}s. If a Watcher rose here, it would steal ${dim} ${dimNum} from them — leaving one of those territories with no valid home.`,
        highlightCells: [[row, col]],
        secondaryHighlightCells: pairedCandidateCells,
        ...dimHighlight,
      };
    }
    return {
      level: 3,
      message: `${tnames(paired)} are collectively confined to exactly ${paired.length} ${dim}${paired.length > 1 ? 's' : ''}. They must fill those ${dim}s between them, so no other Watcher can occupy ${dim} ${dimNum}. This cell must be a Ward.`,
      highlightCells: [[row, col]],
      secondaryHighlightCells: pairedCandidateCells,
      ...dimHighlight,
      deduction: d,
    };
  }

  // ---- Hypothetical (contradiction test) ----
  if (reasonType === 'hypothetical' && confinedTerritory !== undefined) {
    const victim = confinedTerritory;

    // Compute victim's remaining valid candidates
    const allCandidates = getCandidates(puzzle, playerCells);
    const victimCells: [number, number][] = allCandidates.get(victim) ?? [];
    const victimRows = new Set(victimCells.map(([r]) => r));
    const victimCols = new Set(victimCells.map(([, c]) => c));

    // Explain exactly which constraint wipes out the victim
    let whySealed: string;
    if (victimCells.length === 0) {
      whySealed = `the ${tname(victim)} territory already has no valid refuge`;
    } else if (victimRows.size === 1 && victimRows.has(row)) {
      whySealed = `every remaining cell in the ${tname(victim)} territory sits in row ${row + 1} — the same row this Watcher would claim`;
    } else if (victimCols.size === 1 && victimCols.has(col)) {
      whySealed = `every remaining cell in the ${tname(victim)} territory sits in column ${col + 1} — the same column this Watcher would claim`;
    } else {
      whySealed = `this Watcher's row ${row + 1}, column ${col + 1}, and adjacency zone together cover every remaining refuge in the ${tname(victim)} territory`;
    }

    if (depth === 0) {
      // Level I: point to the hypothetical cell and the victim territory only
      return {
        level: 1,
        message: `Consider what would happen if a Watcher rose at this cell. Study where the ${tname(victim)} territory can still place its Watcher.`,
        primaryCell: [row, col],
        highlightTerritories: [victim],
      };
    }

    // Level II / III: show the cross-pattern (row + col) the hypothetical watcher claims,
    // with the victim's remaining cells outlined in red within that zone.
    // This makes the cascade visible: "the cross is what the watcher claims; the red cells
    // are what it destroys."
    if (depth === 1) {
      return {
        level: 2,
        message: `If a Watcher rose here, it would claim row ${row + 1} and column ${col + 1}. ${whySealed.charAt(0).toUpperCase() + whySealed.slice(1)}. The ${tname(victim)} territory would have nowhere to go.`,
        primaryCell: [row, col],
        highlightCells: victimCells,
        highlightRows: [row],
        highlightCols: [col],
      };
    }
    const forcedSteps      = computeCascadeSteps(puzzle, playerCells, row, col);
    const constraintWaves  = buildCascadeConstraintWaves(puzzle, playerCells, row, col, forcedSteps);
    const constraintCovered = new Set(
      constraintWaves.flatMap(ww => ww.flat()).map(([r, c]) => `${r},${c}`)
    );
    const remainingVictimCells = victimCells.filter(([r, c]) => !constraintCovered.has(`${r},${c}`));

    return {
      level: 3,
      message: `A Watcher here is impossible. It would claim row ${row + 1} and column ${col + 1} — but ${whySealed}. The ${tname(victim)} territory would be sealed off. Mark this cell with a Ward.`,
      primaryCell: [row, col],
      highlightCells: victimCells,
      highlightRows: [row],
      highlightCols: [col],
      deduction: d,
      cascadeSteps: forcedSteps,
      cascadeConstraintWaves: constraintWaves,
      cascadeVictimCells: remainingVictimCells,
    };
  }

  // ---- Fallback ----
  if (depth === 0) {
    return {
      level: 1,
      message: `Study the ${tname(cellTerritory)} territory and the constraints around it.`,
      highlightTerritories: [cellTerritory],
    };
  }
  return {
    level: 3,
    message: `This cell cannot shelter a Watcher. ${d.reason} Mark it with a Ward.`,
    primaryCell: [row, col],
    highlightCells: [[row, col]],
    highlightTerritories: [cellTerritory],
    secondaryHighlightTerritories: d.affectedTerritories,
    deduction: d,
  };
}

function buildWatcherHint(d: DeductionResult, puzzle: Puzzle): HintResult {
  const territory = puzzle.territoryMap[d.row][d.col];
  const name = tname(territory);

  let message: string;
  if (d.reasonType === 'naked-single-row') {
    message = `Row ${d.row + 1} has only one cell that can still receive a Watcher — this one, belonging to the ${name} territory. A Watcher must rise here.`;
  } else if (d.reasonType === 'naked-single-col') {
    message = `Column ${d.col + 1} has only one cell that can still receive a Watcher — this one, belonging to the ${name} territory. A Watcher must rise here.`;
  } else {
    message = `All other cells in the ${name} territory have been eliminated. Only one refuge remains. A Watcher must rise here.`;
  }

  return {
    level: 4,
    message,
    highlightCells: [[d.row, d.col]],
    highlightTerritories: [territory],
    deduction: d,
  };
}

function buildContradictionHint(
  message: string,
  affectedCells?: [number, number][],
  affectedTerritories?: number[],
): HintResult {
  const territories = affectedTerritories ?? [];
  const phrase = territories.length > 0
    ? `${tnames(territories)} has`
    : 'a territory has';

  return {
    level: 2,
    message: `The arrangement has become impossible. ${
      message || `${phrase} no valid cells remaining.`
    } Something placed earlier is wrong.`,
    highlightCells: affectedCells,
    highlightTerritories: affectedTerritories,
  };
}

function buildStudyHint(puzzle: Puzzle, playerCells: CellState[][]): HintResult {
  const candidates = getCandidates(puzzle, playerCells);
  let minCands = Infinity;
  let minTerritory = -1;
  for (const [t, cands] of candidates) {
    if (cands.length > 0 && cands.length < minCands) {
      minCands = cands.length;
      minTerritory = t;
    }
  }
  if (minTerritory >= 0) {
    return {
      level: 1,
      message: `The ${tname(minTerritory)} territory has only ${minCands} possible position${minCands > 1 ? 's' : ''} remaining. Begin your reasoning there.`,
      highlightTerritories: [minTerritory],
    };
  }
  return {
    level: 1,
    message: 'The chart offers no clear sign yet. Study the territories with the fewest remaining options.',
  };
}

// ---------------------------------------------------------------------------
// getHint — main export
// depth: how many hints the player has already requested without making a move.
//         0 = first ask (vague), 1 = second ask (consequence), 2+ = direct.
// ---------------------------------------------------------------------------

export function getHint(
  puzzle: Puzzle,
  playerCells: CellState[][],
  depth: number = 0,
): HintResult {
  // Contradiction takes priority at any depth
  const contradiction = findContradictions(puzzle, playerCells);
  if (contradiction.found) {
    return buildContradictionHint(
      contradiction.message ?? '',
      contradiction.affectedCells,
      contradiction.affectedTerritories,
    );
  }

  const deduction = getNextDeduction(puzzle, playerCells);
  if (!deduction) return buildStudyHint(puzzle, playerCells);

  if (deduction.type === 'watcher') {
    // Watcher hints are always level 4 — only shown when forced
    // At depth 0, just highlight the territory; at depth 1+, give the answer
    if (depth === 0) {
      const territory = puzzle.territoryMap[deduction.row][deduction.col];
      return {
        level: 1,
        message: `The ${tname(territory)} territory is close to resolution. Study it carefully.`,
        highlightTerritories: [territory],
      };
    }
    return buildWatcherHint(deduction, puzzle);
  }

  // Ward deductions — adjacency/row/col/territory-occupied are cheap facts,
  // always show at depth 0 → level 1, depth 1+ → level 3
  const isCheapFact = ['adjacency','row-occupied','col-occupied','territory-occupied']
    .includes(deduction.reasonType ?? '');

  if (isCheapFact && depth >= 1) {
    return buildWardHint(deduction, puzzle, 2, playerCells);
  }

  return buildWardHint(deduction, puzzle, depth, playerCells);
}
