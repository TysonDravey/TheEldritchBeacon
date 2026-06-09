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

// Technique name for each deduction type — shown in hints and Codex
export const TECHNIQUE_NAMES: Partial<Record<string, string>> = {
  'adjacency':          'Touching Shadows',
  'row-occupied':       'Full Row',
  'col-occupied':       'Full Column',
  'territory-occupied': 'Territory Claimed',
  'row-confinement':    'Territory Lock',
  'col-confinement':    'Column Lock',
  'pair-row':           'Shared Horizon',
  'pair-col':           'Shared Horizon',
  'hidden-set-row':     'Hidden Set',
  'hidden-set-col':     'Hidden Set',
  'dual-confinement':   'Dual Confinement',
  'territory-dead-end': 'Territory Dead-End',
  'hypothetical':       'Forbidden Tide',
  'hypothetical-deep':  'Forced Territory Chain',
  'naked-single-territory': 'Last Refuge',
  'naked-single-row':   'Last Refuge',
  'naked-single-col':   'Last Refuge',
};

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
    const isTwin = puzzle.mode === 'twin-watchers';
    if (depth === 0) {
      return {
        level: 1,
        message: isTwin
          ? `Row ${br + 1} is already guarded by both its Watchers.`
          : `Row ${br + 1} has already received its Watcher.`,
        highlightRows: [br],
        highlightTerritories: [blockerTerritory],
      };
    }
    return {
      level: 3,
      message: isTwin
        ? `Row ${br + 1} already holds 2 Watchers — its full complement. No more may enter. Mark this cell with a Ward.`
        : `The ${tname(blockerTerritory)} Watcher at column ${bc + 1} claims row ${br + 1}. No other Watcher may share that row. Mark this cell with a Ward.`,
      highlightCells: [[row, col], [br, bc]],
      highlightRows: [br],
      deduction: d,
    };
  }

  if (reasonType === 'col-occupied' && blockedBy) {
    const [br, bc] = blockedBy;
    const blockerTerritory = puzzle.territoryMap[br][bc];
    const isTwin = puzzle.mode === 'twin-watchers';
    if (depth === 0) {
      return {
        level: 1,
        message: isTwin
          ? `Column ${bc + 1} is already guarded by both its Watchers.`
          : `Column ${bc + 1} has already received its Watcher.`,
        highlightCols: [bc],
        highlightTerritories: [blockerTerritory],
      };
    }
    return {
      level: 3,
      message: isTwin
        ? `Column ${bc + 1} already holds 2 Watchers — its full complement. No more may enter. Mark this cell with a Ward.`
        : `The ${tname(blockerTerritory)} Watcher at row ${br + 1} claims column ${bc + 1}. No other Watcher may share that column. Mark this cell with a Ward.`,
      highlightCells: [[row, col], [br, bc]],
      highlightCols: [bc],
      deduction: d,
    };
  }

  if (reasonType === 'territory-occupied' && blockedBy) {
    const [br, bc] = blockedBy;
    const isTwin = puzzle.mode === 'twin-watchers';
    if (depth === 0) {
      return {
        level: 1,
        message: isTwin
          ? `The ${tname(cellTerritory)} territory already holds both its Watchers.`
          : `The ${tname(cellTerritory)} territory has already been claimed.`,
        highlightTerritories: [cellTerritory],
      };
    }
    return {
      level: 3,
      message: isTwin
        ? `The ${tname(cellTerritory)} territory is fully guarded — both Watchers are placed. This cell must be a Ward.`
        : `The ${tname(cellTerritory)} territory already has a Watcher at row ${br + 1}, column ${bc + 1}. This cell must be a Ward.`,
      highlightCells: [[row, col], [br, bc]],
      highlightTerritories: [cellTerritory],
      deduction: d,
    };
  }

  // ---- Row confinement ----
  if (reasonType === 'row-confinement' && confinedTerritory !== undefined) {
    const confined = confinedTerritory;
    const isTwin = puzzle.mode === 'twin-watchers';
    if (depth === 0) {
      return {
        level: 1,
        message: isTwin
          ? `Study the ${tname(confined)} territory. All its remaining candidates fall in row ${row + 1}.`
          : `Study the ${tname(confined)} territory. Its Watcher is confined to a single row.`,
        secondaryHighlightTerritories: [confined],
        highlightRows: [row],
      };
    }
    if (depth === 1) {
      return {
        level: 2,
        message: isTwin
          ? `The ${tname(confined)} territory must use row ${row + 1} — every valid cell it has is there. Placing a Watcher here would take a slot that ${tname(confined)} needs, leaving it with no valid refuge.`
          : `The ${tname(confined)} territory can only place its Watcher somewhere in row ${row + 1}. If a Watcher rose at this cell, it would claim that row — leaving the ${tname(confined)} territory with nowhere to go.`,
        highlightCells: [[row, col]],
        highlightTerritories: [cellTerritory],
        secondaryHighlightTerritories: [confined],
        highlightRows: [row],
      };
    }
    return {
      level: 3,
      message: isTwin
        ? `The ${tname(confined)} territory's remaining candidates are all in row ${row + 1}, and it needs every open slot there. No other Watcher can enter row ${row + 1}. This cell — belonging to the ${tname(cellTerritory)} territory — must be a Ward.`
        : `The ${tname(confined)} territory is confined to row ${row + 1}. Since it must use that row, no other Watcher can occupy it. This cell — belonging to the ${tname(cellTerritory)} territory — must be a Ward.`,
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
    const isTwin = puzzle.mode === 'twin-watchers';
    if (depth === 0) {
      return {
        level: 1,
        message: isTwin
          ? `Study the ${tname(confined)} territory. All its remaining candidates fall in column ${col + 1}.`
          : `Study the ${tname(confined)} territory. Its Watcher is confined to a single column.`,
        secondaryHighlightTerritories: [confined],
        highlightCols: [col],
      };
    }
    if (depth === 1) {
      return {
        level: 2,
        message: isTwin
          ? `The ${tname(confined)} territory must use column ${col + 1} — every valid cell it has is there. Placing a Watcher here would take a slot that ${tname(confined)} needs, leaving it with no valid refuge.`
          : `The ${tname(confined)} territory can only place its Watcher somewhere in column ${col + 1}. If a Watcher rose at this cell, it would claim that column — leaving the ${tname(confined)} territory with nowhere to go.`,
        highlightCells: [[row, col]],
        highlightTerritories: [cellTerritory],
        secondaryHighlightTerritories: [confined],
        highlightCols: [col],
      };
    }
    return {
      level: 3,
      message: isTwin
        ? `The ${tname(confined)} territory's remaining candidates are all in column ${col + 1}, and it needs every open slot there. No other Watcher can enter column ${col + 1}. This cell must be a Ward.`
        : `The ${tname(confined)} territory is confined to column ${col + 1}. Since it must use that column, no other Watcher can occupy it. This cell must be a Ward.`,
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
    const isTwin = puzzle.mode === 'twin-watchers';

    // Compute victim's remaining valid candidates
    const allCandidates = getCandidates(puzzle, playerCells);
    const victimCells: [number, number][] = allCandidates.get(victim) ?? [];

    if (depth === 0) {
      return {
        level: 1,
        message: isTwin
          ? `Consider what would happen if a Watcher rose at this cell. Trace how it forces other placements, and watch what happens to the ${tname(victim)} territory.`
          : `Consider what would happen if a Watcher rose at this cell. Study where the ${tname(victim)} territory can still place its Watcher.`,
        primaryCell: [row, col],
        highlightTerritories: [victim],
      };
    }

    // Twin mode: a single watcher never claims a full row or column (takes two).
    // The contradiction comes from adjacency alone or a chain of forced placements.
    if (isTwin) {
      const forcedSteps     = computeCascadeSteps(puzzle, playerCells, row, col);
      const constraintWaves = buildCascadeConstraintWaves(puzzle, playerCells, row, col, forcedSteps);
      const constraintCovered = new Set(
        constraintWaves.flatMap(ww => ww.flat()).map(([r, c]) => `${r},${c}`)
      );
      const remainingVictimCells = victimCells.filter(([r, c]) => !constraintCovered.has(`${r},${c}`));
      const chainLen = forcedSteps.length;

      if (depth === 1) {
        const msg = chainLen === 0
          ? `If a Watcher rose here, its adjacency zone alone would eliminate every remaining valid cell in the ${tname(victim)} territory — leaving it with no refuge.`
          : `If a Watcher rose here, it would force ${chainLen} more Watcher${chainLen > 1 ? 's' : ''} into fixed positions. Together that chain leaves the ${tname(victim)} territory with no valid refuge.`;
        return {
          level: 2,
          message: msg,
          primaryCell: [row, col],
          highlightCells: victimCells,
          highlightTerritories: [victim],
        };
      }

      const msg = chainLen === 0
        ? `A Watcher here is impossible. Its adjacency zone directly eliminates every remaining valid cell in the ${tname(victim)} territory. Mark this cell with a Ward.`
        : `A Watcher here is impossible. It forces ${chainLen} Watcher${chainLen > 1 ? 's' : ''} into fixed positions — Watchers that have nowhere else to go. By the end of that chain, the ${tname(victim)} territory has no valid cell remaining. Mark this cell with a Ward.`;
      return {
        level: 3,
        message: msg,
        primaryCell: [row, col],
        highlightCells: victimCells,
        highlightTerritories: [victim],
        deduction: d,
        cascadeSteps: forcedSteps,
        cascadeConstraintWaves: constraintWaves,
        cascadeVictimCells: remainingVictimCells,
      };
    }

    // Standard mode: single watcher claims its full row and column.
    const victimRows = new Set(victimCells.map(([r]) => r));
    const victimCols = new Set(victimCells.map(([, c]) => c));

    // Partition victim cells by which constraint eliminates them
    const inSameRow = victimCells.filter(([r])    => r === row);
    const inSameCol = victimCells.filter(([r, c]) => r !== row && c === col);
    const adjacent  = victimCells.filter(([r, c]) => r !== row && c !== col && Math.abs(r - row) <= 1 && Math.abs(c - col) <= 1);

    let whySealed: string;
    if (victimCells.length === 0) {
      whySealed = `the ${tname(victim)} territory already has no valid refuge`;
    } else if (victimRows.size === 1 && victimRows.has(row)) {
      whySealed = `every remaining cell in the ${tname(victim)} territory sits in row ${row + 1} — the same row this Watcher would claim`;
    } else if (victimCols.size === 1 && victimCols.has(col)) {
      whySealed = `every remaining cell in the ${tname(victim)} territory sits in column ${col + 1} — the same column this Watcher would claim`;
    } else {
      const parts: string[] = [];
      if (inSameRow.length > 0)
        parts.push(`${inSameRow.length} cell${inSameRow.length > 1 ? 's' : ''} sit in row ${row + 1}`);
      if (inSameCol.length > 0)
        parts.push(`${inSameCol.length} cell${inSameCol.length > 1 ? 's' : ''} sit in column ${col + 1}`);
      if (adjacent.length > 0)
        parts.push(`${adjacent.length} cell${adjacent.length > 1 ? 's are' : ' is'} adjacent to this position`);
      const remaining = victimCells.length - inSameRow.length - inSameCol.length - adjacent.length;
      if (remaining > 0)
        parts.push(`${remaining} more would be forced out by the chain reaction`);
      whySealed = parts.length > 0
        ? `of the ${tname(victim)} territory's remaining refuges: ${parts.join(', ')}`
        : `this Watcher's row, column, and adjacency zone together seal off the ${tname(victim)} territory`;
    }

    if (depth === 1) {
      const opener = whySealed.startsWith('of the')
        ? `If a Watcher rose here, it would claim row ${row + 1} and column ${col + 1}. But ${whySealed}. The ${tname(victim)} territory would have nowhere to go.`
        : `If a Watcher rose here, it would claim row ${row + 1} and column ${col + 1}. ${whySealed.charAt(0).toUpperCase() + whySealed.slice(1)}. The ${tname(victim)} territory would have nowhere to go.`;
      return {
        level: 2,
        message: opener,
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
      message: whySealed.startsWith('of the')
        ? `A Watcher here is impossible. It would claim row ${row + 1} and column ${col + 1} — but ${whySealed}. The ${tname(victim)} territory would be sealed off. Mark this cell with a Ward.`
        : `A Watcher here is impossible. ${whySealed.charAt(0).toUpperCase() + whySealed.slice(1)} — the ${tname(victim)} territory would be sealed off. Mark this cell with a Ward.`,
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
  const isTwin = puzzle.mode === 'twin-watchers';

  let message: string;
  if (d.reasonType === 'naked-single-row') {
    message = isTwin
      ? `Row ${d.row + 1} has only one valid cell left for its next Watcher — this one, belonging to the ${name} territory. A Watcher must rise here.`
      : `Row ${d.row + 1} has only one cell that can still receive a Watcher — this one, belonging to the ${name} territory. A Watcher must rise here.`;
  } else if (d.reasonType === 'naked-single-col') {
    message = isTwin
      ? `Column ${d.col + 1} has only one valid cell left for its next Watcher — this one, belonging to the ${name} territory. A Watcher must rise here.`
      : `Column ${d.col + 1} has only one cell that can still receive a Watcher — this one, belonging to the ${name} territory. A Watcher must rise here.`;
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

function techniqueForDeduction(d: { type: string; reasonType?: string }, isDeepChain?: boolean): string | undefined {
  if (d.type === 'watcher') return TECHNIQUE_NAMES['naked-single-territory'];
  const key = isDeepChain ? 'hypothetical-deep' : (d.reasonType ?? '');
  return TECHNIQUE_NAMES[key];
}

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

  const solverDepth = puzzle.mode === 'twin-watchers' ? 2 : 1;
  const deduction = getNextDeduction(puzzle, playerCells, solverDepth);
  if (!deduction) return buildStudyHint(puzzle, playerCells);

  if (deduction.type === 'watcher') {
    if (depth === 0) {
      const territory = puzzle.territoryMap[deduction.row][deduction.col];
      return {
        level: 1,
        message: `The ${tname(territory)} territory is close to resolution. Study it carefully.`,
        highlightTerritories: [territory],
      };
    }
    const hint = buildWatcherHint(deduction, puzzle);
    return { ...hint, techniqueName: techniqueForDeduction(deduction) };
  }

  // Ward deductions — adjacency/row/col/territory-occupied are cheap facts,
  // always show at depth 0 → level 1, depth 1+ → level 3
  const isCheapFact = ['adjacency','row-occupied','col-occupied','territory-occupied']
    .includes(deduction.reasonType ?? '');

  const rawHint = isCheapFact && depth >= 1
    ? buildWardHint(deduction, puzzle, 2, playerCells)
    : buildWardHint(deduction, puzzle, depth, playerCells);

  // Attach technique name once the hint is concrete (level > 1, or cheap facts always)
  const isDeepChain = deduction.reasonType === 'hypothetical' &&
    rawHint.cascadeSteps != null && rawHint.cascadeSteps.length >= 3;
  const techniqueName = (rawHint.level >= 2 || isCheapFact)
    ? techniqueForDeduction(deduction, isDeepChain)
    : undefined;

  return techniqueName ? { ...rawHint, techniqueName } : rawHint;
}
