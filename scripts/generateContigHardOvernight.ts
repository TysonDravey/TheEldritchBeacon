/**
 * generateContigHardOvernight.ts
 *
 * Overnight grind for genuinely-hard CONTIGUOUS (initiate-mode) puzzles.
 *
 * Context: our entire non-shattered catalog was generated with
 * requireContradict defaulting to false, which forces the generator's
 * confinement pre-filter to GUARANTEE at least half of every puzzle's
 * territories are trivially confined (<=2 rows or <=2 cols) — see
 * engine/generator.ts. That's the real reason every contiguous puzzle in
 * the game cascades through obvious moves: there's always an easy move
 * sitting somewhere on the board, by construction. requireContradict:true
 * flips that filter to require FEW confined territories instead — tested
 * this for the first time this session and got a real (if modest)
 * improvement: best case so far was 47% trivial-dominated vs the
 * catalog's existing ~50-55% best. Stacking it with a lower shape bias
 * made things WORSE (74-100% trivial) — tested and ruled out, don't
 * retry that combination.
 *
 * This grinds requireContradict:true at DEFAULT bias (0.75) across
 * 6x6-9x9, logging every success incrementally (one line per hit, plus a
 * heartbeat every 200 attempts so `tail -f` shows it's alive) and writing
 * anything meaningfully better than the catalog's current best straight
 * into data/experimentalPuzzles.ts so it's immediately playable by ID.
 *
 * Usage: npx tsx scripts/generateContigHardOvernight.ts
 * Watch:  tail -f /tmp/contig-hard-overnight.log
 */

import { generatePuzzle } from '../engine/generator';
import { rateDifficulty, scorePuzzle } from '../engine/difficulty';
import { getNextDeduction } from '../engine/solver';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle, CellState } from '../engine/boardTypes';
import { nextUnusedTitle, existingTitles } from './titlePool';

const SIZES = [6, 7, 8, 9];
const MAX_SEEDS_PER_SIZE = 60000;
const BASE = 'contighard-v1';
const FILE = join(process.cwd(), 'data', 'experimentalPuzzles.ts');
// Only keep puzzles clearly better than anything already in the catalog —
// existing best-case was ~32-50% trivial depending on size; 40% is a safe,
// meaningfully-better bar across all four sizes.
const TRIVIAL_KEEP_THRESHOLD = 0.40;

const TRIVIAL = new Set([
  'adjacency', 'row-occupied', 'col-occupied', 'territory-occupied',
  'naked-single-territory', 'naked-single-row', 'naked-single-col',
  'row-confinement', 'col-confinement',
]);

function analyze(p: Puzzle): { total: number; trivial: number; me: number } {
  const n = p.size;
  const cells: CellState[][] = Array.from({ length: n }, () => Array(n).fill('empty'));
  let total = 0, trivial = 0, me = 0;
  let guard = 0;
  while (guard++ < 1000) {
    const d = getNextDeduction(p, cells, 0);
    if (!d) break;
    total++;
    if (TRIVIAL.has(d.reasonType ?? '')) trivial++;
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
  return { total, trivial, me };
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
  console.log(`[${ts()}] Starting overnight grind. Sizes: ${SIZES.join(', ')}. Threshold: <${(TRIVIAL_KEEP_THRESHOLD * 100).toFixed(0)}% trivial to keep.`);

  for (const size of SIZES) {
    console.log(`\n[${ts()}] === ${size}x${size} ===`);
    let tried = 0, generated = 0, kept = 0;
    let bestRatio = 1;

    for (let i = 0; i < MAX_SEEDS_PER_SIZE; i++) {
      tried++;
      const seed = `${BASE}-${size}-${i}`;
      const p = generatePuzzle({ size, seed, maxAttempts: 300, requireContradict: true });

      if (p) {
        generated++;
        const a = analyze(p);
        const ratio = a.total > 0 ? a.trivial / a.total : 1;
        if (ratio < bestRatio) bestRatio = ratio;

        if (ratio < TRIVIAL_KEEP_THRESHOLD) {
          const content = readFileSync(FILE, 'utf-8');
          const usedTitles = existingTitles(content);
          const diff = rateDifficulty(p);
          const { difficulty: _d, score: _s, ...rest } = p;
          const id = `contighard-${size}x${size}-${String(kept + 1).padStart(2, '0')}`;
          const title = nextUnusedTitle(usedTitles, diff);
          const entry: Puzzle = {
            ...rest, id, title, difficulty: diff, score: scorePuzzle(p),
            generatorCmd: `generateContigHardOvernight --base ${BASE} --sizes ${size} --requireContradict`,
          };
          appendPuzzle(entry);
          kept++;
          console.log(`[${ts()}] KEPT ${id} "${title}" — ${diff}, steps=${a.total}, trivial=${(ratio * 100).toFixed(0)}%, ME=${a.me}`);
        }
      }

      if (tried % 200 === 0) {
        console.log(`[${ts()}] [${size}x${size}] tried=${tried} generated=${generated} kept=${kept} bestTrivial=${(bestRatio * 100).toFixed(0)}%`);
      }
    }

    console.log(`[${ts()}] === ${size}x${size} done: tried=${tried} generated=${generated} kept=${kept} bestTrivial=${(bestRatio * 100).toFixed(0)}% ===`);
  }

  console.log(`\n[${ts()}] Overnight grind complete.`);
}

main();
