/**
 * generateDeepReasoningGrindV2.ts
 *
 * Tightened again. V1's "hypothetical or mutual-exclusion at least once"
 * bar was too weak — confirmed live: it found 159 6x6 puzzles and the
 * first 7x7 batch, but the user called them "a slight speed bump," not a
 * real wall. The one confirmed-good result so far (contighard-7x7-01) had
 * BOTH hypothetical AND mutual-exclusion (one each), at 39% trivial — V1's
 * hits mostly had only one occurrence of one technique, diluted across
 * 50-65% trivial steps.
 *
 * New keep rule, combining both signals instead of either alone:
 *   trivial% < 45%  AND  (hypothetical count + mutualExclusion count) >= 2
 *
 * That matches contighard-7x7-01's actual profile (39% trivial, 1+1=2)
 * instead of V1's much looser "fires once, anywhere" bar. Expect this to
 * be rarer than V1 — that's fine, quality over volume at this point.
 *
 * Same requireContradict:true / default bias. Sizes 6-8.
 *
 * Usage: npx tsx scripts/generateDeepReasoningGrindV2.ts
 * Watch:  tail -f /tmp/deep-reasoning-grind-v2.log
 */

import { generatePuzzle } from '../engine/generator';
import { rateDifficulty, scorePuzzle } from '../engine/difficulty';
import { getNextDeduction } from '../engine/solver';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle, CellState } from '../engine/boardTypes';
import { nextUnusedTitle, existingTitles } from './titlePool';

const SIZES = [6, 7, 8];
const MAX_SEEDS_PER_SIZE = 100000;
const BASE = 'deepreason-v2';
const FILE = join(process.cwd(), 'data', 'experimentalPuzzles.ts');
const TRIVIAL_THRESHOLD = 0.45;
const MIN_DEEP_COUNT = 2;

function analyze(p: Puzzle): { total: number; trivial: number; hypothetical: number; me: number } {
  const TRIVIAL = new Set([
    'adjacency', 'row-occupied', 'col-occupied', 'territory-occupied',
    'naked-single-territory', 'naked-single-row', 'naked-single-col',
    'row-confinement', 'col-confinement',
  ]);
  const n = p.size;
  const cells: CellState[][] = Array.from({ length: n }, () => Array(n).fill('empty'));
  let total = 0, trivial = 0, hypothetical = 0, me = 0;
  let guard = 0;
  while (guard++ < 1000) {
    const d = getNextDeduction(p, cells, 0);
    if (!d) break;
    total++;
    if (TRIVIAL.has(d.reasonType ?? '')) trivial++;
    if (d.reasonType === 'hypothetical') hypothetical++;
    if (d.reasonType === 'mutual-exclusion') me++;
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
  return { total, trivial, hypothetical, me };
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
  console.log(`[${ts()}] Starting v2 grind. Sizes: ${SIZES.join(', ')}. Keep rule: trivial<${TRIVIAL_THRESHOLD * 100}% AND (hypothetical+mutualExclusion)>=${MIN_DEEP_COUNT}.`);

  for (const size of SIZES) {
    console.log(`\n[${ts()}] === ${size}x${size} ===`);
    let tried = 0, generated = 0, kept = 0;

    for (let i = 0; i < MAX_SEEDS_PER_SIZE; i++) {
      tried++;
      const seed = `${BASE}-${size}-${i}`;
      const p = generatePuzzle({ size, seed, maxAttempts: 300, requireContradict: true });

      if (p) {
        generated++;
        const a = analyze(p);
        const ratio = a.total > 0 ? a.trivial / a.total : 1;
        const deepCount = a.hypothetical + a.me;

        if (ratio < TRIVIAL_THRESHOLD && deepCount >= MIN_DEEP_COUNT) {
          const content = readFileSync(FILE, 'utf-8');
          const usedTitles = existingTitles(content);
          const diff = rateDifficulty(p);
          const { difficulty: _d, score: _s, ...rest } = p;
          const id = `deepreasonv2-${size}x${size}-${String(kept + 1).padStart(2, '0')}`;
          const title = nextUnusedTitle(usedTitles, diff);
          const entry: Puzzle = {
            ...rest, id, title, difficulty: diff, score: scorePuzzle(p),
            generatorCmd: `generateDeepReasoningGrindV2 --base ${BASE} --sizes ${size} --requireContradict`,
          };
          appendPuzzle(entry);
          kept++;
          console.log(`[${ts()}] KEPT ${id} "${title}" — ${diff}, steps=${a.total}, trivial=${(ratio * 100).toFixed(0)}%, hypothetical=${a.hypothetical}, mutualExclusion=${a.me}`);
        }
      }

      if (tried % 500 === 0) {
        console.log(`[${ts()}] [${size}x${size}] tried=${tried} generated=${generated} kept=${kept}`);
      }
    }

    console.log(`[${ts()}] === ${size}x${size} done: tried=${tried} generated=${generated} kept=${kept} ===`);
  }

  console.log(`\n[${ts()}] Grind complete.`);
}

main();
