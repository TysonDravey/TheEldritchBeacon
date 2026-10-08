/**
 * pickChainHeavy8x8.ts
 *
 * Pivot after confirming the hypothetical/mutual-exclusion keep-bar is
 * essentially unreachable at 8x8 (515 generated, 0 kept over 42k seeds;
 * hypothetical fired 0/10 times in the technique-profile sample). Rather
 * than keep chasing that exact signature, this tests a different
 * hypothesis: maybe a LONG, TANGLED chain of only "cheap" techniques
 * (territory-dead-end, pair-elimination, confinement) still feels hard to
 * a human, even with zero hypothetical/ME, simply because there are many
 * more of them chained together than at 6x6/7x7.
 *
 * Generates a batch of real 8x8 puzzles, scores each by total non-single
 * step count (confinement + dead-end + pair + dual-confinement, excluding
 * naked-singles and adjacency which are truly trivial), and keeps the
 * single highest-scoring one for a live playtest.
 *
 * Usage: npx tsx scripts/pickChainHeavy8x8.ts
 */

import { generatePuzzle } from '../engine/generator';
import { getNextDeduction } from '../engine/solver';
import { rateDifficulty, scorePuzzle } from '../engine/difficulty';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle, CellState } from '../engine/boardTypes';
import { nextUnusedTitle, existingTitles } from './titlePool';

const SIZE = 8;
const SAMPLE_SIZE = 400;
const BASE = 'chainheavy-v1';
const FILE = join(process.cwd(), 'data', 'experimentalPuzzles.ts');

const TRULY_TRIVIAL = new Set([
  'adjacency', 'row-occupied', 'col-occupied', 'territory-occupied',
  'naked-single-territory', 'naked-single-row', 'naked-single-col',
]);

function analyze(p: Puzzle) {
  const n = p.size;
  const cells: CellState[][] = Array.from({ length: n }, () => Array(n).fill('empty'));
  let total = 0, trivial = 0, chainy = 0, hypothetical = 0, me = 0;
  const counts: Record<string, number> = {};
  let guard = 0;
  while (guard++ < 1000) {
    const d = getNextDeduction(p, cells, 0);
    if (!d) break;
    total++;
    const key = d.reasonType ?? 'unknown';
    counts[key] = (counts[key] ?? 0) + 1;
    if (TRULY_TRIVIAL.has(key)) trivial++;
    else chainy++;
    if (key === 'hypothetical') hypothetical++;
    if (key === 'mutual-exclusion') me++;
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
  return { total, trivial, chainy, hypothetical, me, counts };
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
  console.log(`[${ts()}] Generating ${SAMPLE_SIZE} 8x8 puzzles, ranking by non-trivial step count (chain length), no hypothetical/ME requirement...`);

  let best: { p: Puzzle; a: ReturnType<typeof analyze> } | null = null;
  let generated = 0;

  for (let i = 0; i < SAMPLE_SIZE * 20 && generated < SAMPLE_SIZE; i++) {
    const seed = `${BASE}-${i}`;
    const p = generatePuzzle({ size: SIZE, seed, maxAttempts: 300, requireContradict: true });
    if (!p) continue;
    generated++;
    const a = analyze(p);
    if (!best || a.chainy > best.a.chainy) {
      best = { p, a };
      console.log(`[${ts()}] new best (gen ${generated}): chainy=${a.chainy} total=${a.total} hypothetical=${a.hypothetical} me=${a.me}`);
    }
    if (generated % 50 === 0) console.log(`[${ts()}] generated=${generated}/${SAMPLE_SIZE}`);
  }

  if (!best) {
    console.log('No puzzles generated at all — something is wrong.');
    return;
  }

  console.log(`\n[${ts()}] Best found: chainy=${best.a.chainy}, total=${best.a.total}, trivial=${best.a.trivial}, hypothetical=${best.a.hypothetical}, me=${best.a.me}`);
  console.log('Full technique breakdown:', JSON.stringify(best.a.counts, null, 2));

  const content = readFileSync(FILE, 'utf-8');
  const usedTitles = existingTitles(content);
  const diff = rateDifficulty(best.p);
  const { difficulty: _d, score: _s, ...rest } = best.p;
  const id = `chainheavy-8x8-01`;
  const title = nextUnusedTitle(usedTitles, diff);
  const entry: Puzzle = {
    ...rest, id, title, difficulty: diff, score: scorePuzzle(best.p),
    generatorCmd: `pickChainHeavy8x8 (best-of-${generated})`,
  };
  appendPuzzle(entry);
  console.log(`\n[${ts()}] SAVED ${id} "${title}" — try it at /puzzle/${id}`);
}

main();
