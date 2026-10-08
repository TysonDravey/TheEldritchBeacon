/**
 * generateTimingBased.ts
 *
 * Root cause finally identified via step-by-step tracing: the proven-good
 * puzzles (contighard-7x7-01, deepreasonv2-7x7-01) have their hypothetical
 * event at 39% through the solve with 73% of cells still open. Every puzzle
 * from tonight's hybrid-trap work — despite matching or beating the old
 * "count >= 2" bar — has its deep events at 82-91% through the solve with
 * only 14-25% of cells open, and played as trivial or a minor slowdown at
 * best. Mutual-exclusion is structurally a late-game technique (it needs two
 * OTHER territories already narrowed to exactly one candidate as a
 * precondition); hypothetical has no such precondition and can fire early —
 * but only if nothing hands the solver a free first move. contighard-7x7-01
 * has NO single-cell territory anywhere (smallest is 2 cells); our hand-built
 * trap's single-cell T0 anchor was exactly the kind of giveaway that lets
 * the rest of the board cascade trivially before the hard part is reached.
 *
 * New keep rule: track the FIRST hypothetical/mutual-exclusion event's
 * position, require it to fire while at least HALF the board is still open
 * (not just require a raw count). Applied to the plain, well-tested
 * requireContradict generator — no hand skeleton, since contighard-7x7-01
 * itself came from blind random generation, just mis-filtered by count
 * instead of timing.
 *
 * Usage: npx tsx scripts/generateTimingBased.ts
 */

import { generatePuzzle } from '../engine/generator';
import { getNextDeduction } from '../engine/solver';
import { rateDifficulty, scorePuzzle } from '../engine/difficulty';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle, CellState } from '../engine/boardTypes';
import { nextUnusedTitle, existingTitles } from './titlePool';

const SIZES = [8, 9];
const TRIES_PER_SIZE = 40000;
const BASE = 'timingbased-v1';
const FILE = join(process.cwd(), 'data', 'experimentalPuzzles.ts');
const MIN_OPEN_FRACTION_AT_FIRST_EVENT = 0.5;

function analyze(p: Puzzle) {
  const n = p.size;
  const totalCells = n * n;
  const cells: CellState[][] = Array.from({ length: n }, () => Array(n).fill('empty'));
  let total = 0;
  let firstEventStep = -1;
  let firstEventOpenFraction = -1;
  let firstEventType = '';
  let deepCount = 0;
  let guard = 0;
  while (guard++ < 1000) {
    const d = getNextDeduction(p, cells, 0);
    if (!d) break;
    total++;
    if (d.reasonType === 'hypothetical' || d.reasonType === 'mutual-exclusion') {
      deepCount++;
      if (firstEventStep === -1) {
        firstEventStep = total;
        const openCount = cells.flat().filter(c => c === 'empty').length;
        firstEventOpenFraction = openCount / totalCells;
        firstEventType = d.reasonType;
      }
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
  return { total, firstEventStep, firstEventOpenFraction, firstEventType, deepCount };
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

function ts() {
  return new Date().toISOString().slice(11, 19);
}

async function main() {
  console.log(`[${ts()}] Timing-based sweep (plain requireContradict, no skeleton). Sizes: ${SIZES.join(', ')}. Keep rule: first deep event fires with >=${MIN_OPEN_FRACTION_AT_FIRST_EVENT * 100}% of cells still open.`);

  for (const size of SIZES) {
    console.log(`\n[${ts()}] === ${size}x${size} ===`);
    let tried = 0, generated = 0, kept = 0;
    let bestFrac = -1, bestInfo = '';

    for (let i = 0; i < TRIES_PER_SIZE; i++) {
      tried++;
      const seed = `${BASE}-${size}-${i}`;
      const genStart = Date.now();
      const p = generatePuzzle({ size, seed, maxAttempts: 300, requireContradict: true });
      const genMs = Date.now() - genStart;
      if (genMs > 2000) console.log(`[${ts()}] [DEBUG] seed ${seed} generatePuzzle took ${genMs}ms`);
      if (!p) continue;
      generated++;

      const analyzeStart = Date.now();
      const a = analyze(p);
      const analyzeMs = Date.now() - analyzeStart;
      if (analyzeMs > 2000) console.log(`[${ts()}] [DEBUG] seed ${seed} analyze() took ${analyzeMs}ms`);
      if (a.firstEventOpenFraction > bestFrac) {
        bestFrac = a.firstEventOpenFraction;
        bestInfo = `frac=${(a.firstEventOpenFraction * 100).toFixed(0)}% type=${a.firstEventType} deepCount=${a.deepCount} total=${a.total}`;
      }

      if (a.firstEventOpenFraction >= MIN_OPEN_FRACTION_AT_FIRST_EVENT) {
        const content = readFileSync(FILE, 'utf-8');
        const usedTitles = existingTitles(content);
        const diff = rateDifficulty(p);
        const { difficulty: _d, score: _s, ...rest } = p;
        const id = `timingbased-${size}x${size}-${String(kept + 1).padStart(2, '0')}`;
        const title = nextUnusedTitle(usedTitles, diff);
        const entry: Puzzle = {
          ...rest, id, title, difficulty: diff, score: scorePuzzle(p),
          generatorCmd: `generateTimingBased --base ${BASE} --sizes ${size}`,
        };
        appendPuzzle(entry);
        kept++;
        console.log(`[${ts()}] KEPT ${id} "${title}" — ${diff}, steps=${a.total}, first-event-step=${a.firstEventStep} (${(a.firstEventOpenFraction * 100).toFixed(0)}% cells open), type=${a.firstEventType}, deepCount=${a.deepCount}`);
      }

      if (tried % 500 === 0) {
        console.log(`[${ts()}] [${size}x${size}] tried=${tried} generated=${generated} kept=${kept} best-so-far: ${bestInfo}`);
      }
    }

    console.log(`[${ts()}] === ${size}x${size} done: tried=${tried} generated=${generated} kept=${kept} best: ${bestInfo} ===`);
  }

  console.log(`\n[${ts()}] Timing-based sweep complete.`);
}

main();
