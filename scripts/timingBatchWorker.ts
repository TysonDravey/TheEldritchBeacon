/**
 * timingBatchWorker.ts
 *
 * Processes one batch of seeds for the timing-based search and exits. Run by
 * generateTimingBased.ts as a child process with a wall-clock timeout, so a
 * single pathologically slow puzzle (confirmed via `sample` to be real,
 * continuous computation — likely exponential blowup in contradictionTest
 * for some rare board shape, not an infinite loop) can only ever cost one
 * batch, not the whole overnight run.
 *
 * Usage: npx tsx scripts/timingBatchWorker.ts <size> <startIdx> <count> <base>
 */

import { generatePuzzle } from '../engine/generator';
import { getNextDeduction } from '../engine/solver';
import { rateDifficulty, scorePuzzle } from '../engine/difficulty';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle, CellState } from '../engine/boardTypes';
import { nextUnusedTitle, existingTitles } from './titlePool';

const [, , sizeArg, startArg, countArg, baseArg] = process.argv;
const size = parseInt(sizeArg, 10);
const startIdx = parseInt(startArg, 10);
const count = parseInt(countArg, 10);
const BASE = baseArg;
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

let tried = 0, generated = 0, kept = 0;

for (let i = startIdx; i < startIdx + count; i++) {
  tried++;
  const seed = `${BASE}-${size}-${i}`;
  const p = generatePuzzle({ size, seed, maxAttempts: 300, requireContradict: true });
  if (!p) continue;
  generated++;

  const a = analyze(p);
  if (a.firstEventOpenFraction >= MIN_OPEN_FRACTION_AT_FIRST_EVENT) {
    const content = readFileSync(FILE, 'utf-8');
    const usedTitles = existingTitles(content);
    const diff = rateDifficulty(p);
    const { difficulty: _d, score: _s, ...rest } = p;
    const id = `timingbased-${size}x${size}-${Date.now()}`;
    const title = nextUnusedTitle(usedTitles, diff);
    const entry: Puzzle = {
      ...rest, id, title, difficulty: diff, score: scorePuzzle(p),
      generatorCmd: `generateTimingBased --base ${BASE} --sizes ${size}`,
    };
    appendPuzzle(entry);
    kept++;
    console.log(`KEPT ${id} "${title}" — ${diff}, steps=${a.total}, first-event-step=${a.firstEventStep} (${(a.firstEventOpenFraction * 100).toFixed(0)}% cells open), type=${a.firstEventType}, deepCount=${a.deepCount}`);
  }
}

console.log(`BATCH_DONE tried=${tried} generated=${generated} kept=${kept}`);
