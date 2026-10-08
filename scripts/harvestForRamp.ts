/**
 * harvestForRamp.ts
 *
 * Scans every candidate in data/experimentalPuzzles.ts (not just mutsearch-*
 * — includes the earlier human-validated medium puzzles like
 * contighard-7x7-01, deepreasonv2-*, mixedshape-* from the first half of
 * tonight's investigation), screens out the grind pattern found in
 * screenGrind.ts (long consecutive runs of deep-technique steps — a marathon,
 * not a single satisfying moment), and reports a clean, score-sorted catalog
 * per size so a deliberate ramp can be built instead of just grabbing top
 * scorers.
 *
 * Usage: npx tsx scripts/harvestForRamp.ts
 */

import { getNextDeduction } from '../engine/solver';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle, CellState } from '../engine/boardTypes';

const EXP_FILE = join(process.cwd(), 'data', 'experimentalPuzzles.ts');
const SAMPLE_FILE = join(process.cwd(), 'data', 'samplePuzzles.ts');

function parseAllPuzzles(content: string): Puzzle[] {
  const puzzles: Puzzle[] = [];
  const idxs: number[] = [];
  const re = /\{"id":/g;
  let m;
  while ((m = re.exec(content)) !== null) idxs.push(m.index);
  for (const start of idxs) {
    let depth = 0, end = start;
    for (let i = start; i < content.length; i++) {
      if (content[i] === '{') depth++;
      if (content[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    try { puzzles.push(JSON.parse(content.slice(start, end))); } catch { /* skip malformed */ }
  }
  return puzzles;
}

const TRIVIAL = new Set([
  'adjacency', 'row-occupied', 'col-occupied', 'territory-occupied',
  'naked-single-territory', 'naked-single-row', 'naked-single-col',
  'row-confinement', 'col-confinement',
]);

function analyze(p: Puzzle) {
  const n = p.size;
  const cells: CellState[][] = Array.from({ length: n }, () => Array(n).fill('empty'));
  let total = 0, trivial = 0;
  const eventSteps: number[] = [];
  let guard = 0;
  while (guard++ < 2000) {
    const d = getNextDeduction(p, cells, 0);
    if (!d) break;
    total++;
    if (TRIVIAL.has(d.reasonType ?? '')) trivial++;
    if (d.reasonType === 'hypothetical' || d.reasonType === 'mutual-exclusion') eventSteps.push(total);
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
  let longestRun = eventSteps.length > 0 ? 1 : 0, currentRun = 1;
  for (let i = 1; i < eventSteps.length; i++) {
    if (eventSteps[i] - eventSteps[i - 1] === 1) currentRun++;
    else currentRun = 1;
    longestRun = Math.max(longestRun, currentRun);
  }
  return { total, trivial, eventCount: eventSteps.length, longestRun };
}

async function main() {
  const expContent = readFileSync(EXP_FILE, 'utf-8');
  const sampleContent = readFileSync(SAMPLE_FILE, 'utf-8');
  const already = new Set<string>();
  const idRe = /"id":"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = idRe.exec(sampleContent)) !== null) {
    if (m[1].startsWith('promoted-')) already.add(m[1].replace('promoted-', ''));
  }

  const all = parseAllPuzzles(expContent);
  console.log(`Scanning ${all.length} experimental puzzles (${already.size} already promoted)...\n`);

  const clean: { p: Puzzle; a: ReturnType<typeof analyze> }[] = [];
  let grindCount = 0;

  for (const p of all) {
    if (already.has(p.id)) continue;
    const a = analyze(p);
    const isGrind = a.longestRun >= 4 || a.eventCount >= 8;
    if (isGrind) { grindCount++; continue; }
    clean.push({ p, a });
  }

  console.log(`${clean.length} clean (non-grind) candidates, ${grindCount} rejected as grind.\n`);

  const bySize = new Map<number, typeof clean>();
  for (const entry of clean) {
    if (!bySize.has(entry.p.size)) bySize.set(entry.p.size, []);
    bySize.get(entry.p.size)!.push(entry);
  }

  for (const size of [...bySize.keys()].sort((a, b) => a - b)) {
    const list = bySize.get(size)!.sort((a, b) => a.p.score - b.p.score);
    console.log(`\n--- size ${size}x${size}: ${list.length} clean candidates ---`);
    for (const { p, a } of list) {
      const ratio = a.total > 0 ? (a.trivial / a.total * 100).toFixed(0) : '?';
      console.log(`  ${p.id.padEnd(26)} score=${String(p.score).padStart(4)} trivial=${ratio}% events=${a.eventCount} maxRun=${a.longestRun}`);
    }
  }
}

main();
