/**
 * runExperiment.ts
 *
 * Bounded experiment driver. Runs the mutation search for a configured
 * budget, then for the shortlist of promising candidates (by cheap-stall
 * score), runs the expensive checks only on survivors:
 *   1. Full solveLogically with the ACCEPTED technique ladder (must
 *      actually complete — no silently broadening the solver to pass).
 *   2. Single-assumption (depth=0) explainable hypothetical check.
 *   3. Nested (depth=1) hypothetical check, reported separately.
 *
 * The initial success target (per the spec this implements): a unique 8x8
 * puzzle whose cheaper-ladder solve stalls with at least half the watchers
 * unplaced, ambiguity spread across the board, AND a short, explainable
 * hypothetical deduction that allows progress from that stall. That is a
 * candidate for playtesting, not proof of human difficulty.
 *
 * Usage: npx tsx scripts/hard8x8/runExperiment.ts [--n=8] [--seed=exp1]
 *   [--iterations=20000] [--restartAfterStale=600]
 */

import { runMutationSearch, type ShortlistEntry } from './mutationSearch';
import { checkSingleAssumptionHypothetical, checkNestedHypothetical } from './hypotheticalCheck';
import { solveLogically, getNextDeduction } from '../../engine/solver';
import { rateDifficulty, scorePuzzle } from '../../engine/difficulty';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle, CellState } from '../../engine/boardTypes';
import { nextUnusedTitle, existingTitles } from '../titlePool';

function arg(name: string, fallback: string): string {
  const found = process.argv.find(a => a.startsWith(`--${name}=`));
  return found ? found.split('=')[1] : fallback;
}

const N = parseInt(arg('n', '8'), 10);
const SEED = arg('seed', `exp-${N}-${Date.now()}`);
const MAX_ITERATIONS = parseInt(arg('iterations', '20000'), 10);
const RESTART_AFTER_STALE = parseInt(arg('restartAfterStale', '600'), 10);
const FILE = join(process.cwd(), 'data', 'experimentalPuzzles.ts');

function ts() { return new Date().toISOString().slice(11, 19); }

// Full open-fraction-at-first-deep-event trace, reusing the exact getNextDeduction
// chain (not a reimplementation) so this number means the same thing it has all
// night: fraction of cells still 'empty' when the first hypothetical/mutual-exclusion
// event fires during a COMPLETE solve (contradiction-testing included, maxDepth=0).
function fullSolveTimingTrace(p: Puzzle): { total: number; firstEventStep: number; firstEventOpenFraction: number; firstEventType: string; solvedByAcceptedLadder: boolean } {
  const n = p.size;
  const totalCells = n * n;
  const cells: CellState[][] = Array.from({ length: n }, () => Array(n).fill('empty'));
  let total = 0;
  let firstEventStep = -1;
  let firstEventOpenFraction = -1;
  let firstEventType = '';
  let guard = 0;
  while (guard++ < 1000) {
    const d = getNextDeduction(p, cells, 0);
    if (!d) break;
    total++;
    if ((d.reasonType === 'hypothetical' || d.reasonType === 'mutual-exclusion') && firstEventStep === -1) {
      const openCount = cells.flat().filter(c => c === 'empty').length;
      firstEventStep = total;
      firstEventOpenFraction = openCount / totalCells;
      firstEventType = d.reasonType;
    }
    cells[d.row][d.col] = d.type === 'watcher' ? 'watcher' : 'ward';
    if (d.type === 'watcher') {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = d.row + dr, nc = d.col + dc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n && cells[nr][nc] === 'empty') cells[nr][nc] = 'ward';
      }
      for (let c = 0; c < n; c++) if (c !== d.col && cells[d.row][c] === 'empty') cells[d.row][c] = 'ward';
      for (let r = 0; r < n; r++) if (r !== d.row && cells[r][d.col] === 'empty') cells[r][d.col] = 'ward';
    }
  }
  let solved = true;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (cells[r][c] === 'empty') solved = false;
  return { total, firstEventStep, firstEventOpenFraction, firstEventType, solvedByAcceptedLadder: solved };
}

function appendPuzzle(entry: Puzzle) {
  const content = readFileSync(FILE, 'utf-8');
  const insertPoint = content.lastIndexOf('\n];');
  const newContent =
    content.slice(0, insertPoint).replace(/,(\s*)$/, '$1') +
    ',\n' + JSON.stringify(entry) +
    content.slice(insertPoint);
  writeFileSync(FILE, newContent, 'utf-8');
}

async function main() {
  console.log(`[${ts()}] === Mutation-search experiment: ${N}x${N}, seed=${SEED}, iterations=${MAX_ITERATIONS}, restartAfterStale=${RESTART_AFTER_STALE} ===`);

  const t0 = Date.now();
  const report = runMutationSearch({
    n: N,
    seed: SEED,
    maxIterations: MAX_ITERATIONS,
    restartAfterStale: RESTART_AFTER_STALE,
    patchMutationChance: 0.3,
    acceptTolerance: 0.02,
    shortlistSize: 15,
  });

  console.log(`[${ts()}] Search done in ${report.runtimeMs}ms. candidatesEvaluated=${report.candidatesEvaluated} uniqueBoardsFound=${report.uniqueBoardsFound} restarts=${report.restarts} bestScore=${report.bestScore.toFixed(3)} shortlistSize=${report.shortlist.length}`);

  if (report.shortlist.length === 0) {
    console.log(`[${ts()}] No candidate ever reached the "at least half the watchers unplaced" bar. Reporting bottleneck: cheap-stall score never exceeded 0 — the ladder is resolving >=50% of watchers on every mutation tried. See report above for candidatesEvaluated/uniqueBoardsFound to judge whether this is a search-coverage problem or a genuine ceiling.`);
    return;
  }

  console.log(`\n[${ts()}] Evaluating shortlist of ${report.shortlist.length} candidates with the expensive checks...`);

  let successCount = 0;
  const existingFileContent = readFileSync(FILE, 'utf-8');
  const usedTitles0 = existingTitles(existingFileContent);
  // Scan for the highest already-used index under this exact id prefix so
  // repeated runs never collide (bug found and fixed after two batch runs
  // both started numbering from 01 and silently duplicated 15 ids).
  const idPrefix = `mutsearch-${N}x${N}-`;
  const idRe = new RegExp(`"id":"${idPrefix}(\\d+)"`, 'g');
  let highestExisting = 0;
  let m: RegExpExecArray | null;
  while ((m = idRe.exec(existingFileContent)) !== null) {
    highestExisting = Math.max(highestExisting, parseInt(m[1], 10));
  }
  let keptSoFar = highestExisting;

  for (let i = 0; i < report.shortlist.length; i++) {
    const entry: ShortlistEntry = report.shortlist[i];
    const puzzle: Puzzle = {
      id: 'tmp', title: 'tmp', mode: 'initiate', size: N,
      territoryMap: entry.territoryMap, solution: entry.solution,
      difficulty: 'Initiate', score: 0, seed: `${SEED}-shortlist-${i}`, createdAt: new Date().toISOString(),
    };

    const singleHyp = checkSingleAssumptionHypothetical(puzzle, entry.stall.cells);
    const nestedHyp = singleHyp.found ? null : checkNestedHypothetical(puzzle, entry.stall.cells);

    const fullSolved = solveLogically(puzzle, 0) !== null; // accepted ladder, depth=0 (single-assumption contradiction only)
    const timing = fullSolveTimingTrace(puzzle);

    console.log(`[${ts()}] shortlist[${i}] stallScore=${entry.score.toFixed(3)} watchersUnplaced=${entry.stall.watchersUnplaced}/${N} territoriesOpen=${entry.stall.unsolvedTerritories.length} singleAssumptionHyp=${singleHyp.found} ${singleHyp.found ? `(proofLen=${singleHyp.proofLength}, territories=${singleHyp.territoriesInvolved?.length})` : nestedHyp?.found ? `nestedOnly(proofLen=${nestedHyp.proofLength})` : 'none-found'} fullSolve=${fullSolved} firstEventFrac=${timing.firstEventOpenFraction >= 0 ? (timing.firstEventOpenFraction * 100).toFixed(0) + '%' : 'n/a'} firstEventType=${timing.firstEventType || 'n/a'}`);

    const isSuccess = singleHyp.found && fullSolved && entry.stall.watchersUnplaced / N >= 0.5;
    if (isSuccess) {
      successCount++;
      const diff = rateDifficulty(puzzle);
      const scored = scorePuzzle(puzzle);
      const id = `mutsearch-${N}x${N}-${String(keptSoFar + 1).padStart(2, '0')}`;
      const title = nextUnusedTitle(usedTitles0, diff);
      usedTitles0.add(title);
      const exportEntry: Puzzle = {
        id, title, mode: 'initiate', size: N,
        territoryMap: entry.territoryMap, solution: entry.solution,
        difficulty: diff, score: scored, seed: `${SEED}-shortlist-${i}`, createdAt: new Date().toISOString(),
        generatorCmd: `runExperiment --n ${N} --seed ${SEED} (mutation search, shortlist[${i}])`,
      } as Puzzle;
      appendPuzzle(exportEntry);
      keptSoFar++;
      console.log(`[${ts()}]   -> SUCCESS, exported as ${id} "${title}" (${diff}). stallScore=${entry.score.toFixed(3)}, singleAssumptionProofLen=${singleHyp.proofLength}, firstEventFrac=${(timing.firstEventOpenFraction * 100).toFixed(0)}%`);
    }
  }

  console.log(`\n[${ts()}] === Experiment complete ===`);
  console.log(`Total runtime: ${Date.now() - t0}ms`);
  console.log(`Candidates evaluated (cheap): ${report.candidatesEvaluated}`);
  console.log(`Unique boards found: ${report.uniqueBoardsFound}`);
  console.log(`Restarts: ${report.restarts}`);
  console.log(`Shortlist evaluated (expensive): ${report.shortlist.length}`);
  console.log(`Successes (unique + half-unplaced stall + explainable single-assumption hypothetical + full accepted-ladder solve): ${successCount}`);

  if (successCount === 0) {
    console.log(`\nBOTTLENECK: the search found stalls with real ambiguity (best stall score ${report.bestScore.toFixed(3)}), but none of the shortlisted candidates had a SHORT, single-assumption (non-nested) hypothetical deduction available to break the stall. This means the ambiguity, while genuine, isn't resolvable by the kind of reasoning a human/our hint system can explain in one step — either the puzzle needs nested reasoning (check logs above for "nestedOnly" entries) or is only solvable by deeper exhaustive search, which would NOT be a good puzzle even though it's technically unique.`);
  }
}

main();
