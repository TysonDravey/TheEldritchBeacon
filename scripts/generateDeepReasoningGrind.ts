/**
 * generateDeepReasoningGrind.ts
 *
 * Refined replacement for generateContigHardOvernight.ts. That script kept
 * anything under 40% trivial-step-dominated, which let through puzzles
 * like contighard-6x6-01 — formally "non-trivial" by step-type but every
 * one of its non-trivial steps was territory-dead-end/pair-elimination,
 * both still local, single-glance patterns. The user confirmed it live:
 * that 6x6 was easy, but contighard-7x7-01 (nearly identical trivial %)
 * was genuinely good — and the ONLY difference in its technique sequence
 * is that it required BOTH 'hypothetical' (real contradiction-testing)
 * AND 'mutual-exclusion' at least once. Those two techniques are the only
 * ones that force testing a hypothesis and tracking consequences
 * elsewhere on the board, rather than spotting a pattern in place.
 *
 * So the keep criterion here is sharper and more specific: the solve must
 * use 'hypothetical' or 'mutual-exclusion' at least once. Trivial % is
 * still logged for reference but no longer the gate.
 *
 * Same requireContradict:true / default bias setup as before (that part
 * was already confirmed to work — it's the only reason these techniques
 * show up in contiguous mode at all). Sizes 6-8 only; 9x9 under
 * requireContradict is extremely rare even for ANY valid puzzle (1 in
 * 24,600+ overnight) so it's not worth budget here.
 *
 * Usage: npx tsx scripts/generateDeepReasoningGrind.ts
 * Watch:  tail -f /tmp/deep-reasoning-grind.log
 */

import { generatePuzzle } from '../engine/generator';
import { rateDifficulty, scorePuzzle } from '../engine/difficulty';
import { getNextDeduction } from '../engine/solver';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle, CellState } from '../engine/boardTypes';
import { nextUnusedTitle, existingTitles } from './titlePool';

const SIZES = [6, 7, 8];
const MAX_SEEDS_PER_SIZE = 60000;
const BASE = 'deepreason-v1';
const FILE = join(process.cwd(), 'data', 'experimentalPuzzles.ts');

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
  console.log(`[${ts()}] Starting deep-reasoning grind. Sizes: ${SIZES.join(', ')}. Keep rule: requires hypothetical or mutual-exclusion at least once.`);

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

        if (a.hypothetical > 0 || a.me > 0) {
          const content = readFileSync(FILE, 'utf-8');
          const usedTitles = existingTitles(content);
          const diff = rateDifficulty(p);
          const { difficulty: _d, score: _s, ...rest } = p;
          const id = `deepreason-${size}x${size}-${String(kept + 1).padStart(2, '0')}`;
          const title = nextUnusedTitle(usedTitles, diff);
          const entry: Puzzle = {
            ...rest, id, title, difficulty: diff, score: scorePuzzle(p),
            generatorCmd: `generateDeepReasoningGrind --base ${BASE} --sizes ${size} --requireContradict`,
          };
          appendPuzzle(entry);
          kept++;
          console.log(`[${ts()}] KEPT ${id} "${title}" — ${diff}, steps=${a.total}, trivial=${(ratio * 100).toFixed(0)}%, hypothetical=${a.hypothetical}, mutualExclusion=${a.me}`);
        }
      }

      if (tried % 200 === 0) {
        console.log(`[${ts()}] [${size}x${size}] tried=${tried} generated=${generated} kept=${kept}`);
      }
    }

    console.log(`[${ts()}] === ${size}x${size} done: tried=${tried} generated=${generated} kept=${kept} ===`);
  }

  console.log(`\n[${ts()}] Grind complete.`);
}

main();
