import { getNextDeduction } from '../engine/solver';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle, CellState } from '../engine/boardTypes';

const content = readFileSync(join(process.cwd(), 'data', 'samplePuzzles.ts'), 'utf-8');
const idxs: number[] = [];
const re = /\{"id":/g;
let m;
while ((m = re.exec(content)) !== null) idxs.push(m.index);
const puzzles: Puzzle[] = [];
for (const start of idxs) {
  let depth = 0, end = start;
  for (let i = start; i < content.length; i++) {
    if (content[i] === '{') depth++;
    if (content[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  try { puzzles.push(JSON.parse(content.slice(start, end))); } catch { /* skip */ }
}

const TRIVIAL = new Set([
  'adjacency', 'row-occupied', 'col-occupied', 'territory-occupied',
  'naked-single-territory', 'naked-single-row', 'naked-single-col',
  'row-confinement', 'col-confinement',
]);

function analyze(p: Puzzle) {
  const n = p.size;
  const cells: CellState[][] = Array.from({ length: n }, () => Array(n).fill('empty'));
  let total = 0, trivial = 0, hypothetical = 0, me = 0;
  let guard = 0;
  while (guard++ < 2000) {
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

const westWall = puzzles.filter(p => p.mode === 'initiate' && p.difficulty === 'Eldritch');
console.log(`West Wall: ${westWall.length} puzzles\n`);

for (const p of westWall) {
  const a = analyze(p);
  const ratio = a.total > 0 ? (a.trivial / a.total * 100).toFixed(0) : '?';
  const source = (p.generatorCmd ?? '').includes('runExperiment') ? 'NEW' : 'old';
  console.log(`[${source}] ${p.id.padEnd(28)} size=${p.size} score=${p.score} trivial=${ratio}% hyp=${a.hypothetical} me=${a.me}`);
}
