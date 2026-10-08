import { getNextDeduction } from '../engine/solver';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle, CellState } from '../engine/boardTypes';

const content = readFileSync(join(process.cwd(), 'data', 'samplePuzzles.ts'), 'utf-8');
function getPuzzle(id: string): Puzzle {
  const idx = content.indexOf(`"id":"${id}"`);
  const start = content.lastIndexOf('{', idx);
  let depth = 0, end = start;
  for (let i = start; i < content.length; i++) {
    if (content[i] === '{') depth++;
    if (content[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return JSON.parse(content.slice(start, end));
}

function traceEvents(p: Puzzle) {
  const n = p.size;
  const totalCells = n * n;
  const cells: CellState[][] = Array.from({ length: n }, () => Array(n).fill('empty'));
  let total = 0;
  const events: { step: number; type: string; openFrac: number; proofLen?: number }[] = [];
  let guard = 0;
  while (guard++ < 2000) {
    const d = getNextDeduction(p, cells, 0);
    if (!d) break;
    total++;
    if (d.reasonType === 'hypothetical' || d.reasonType === 'mutual-exclusion') {
      const openCount = cells.flat().filter(c => c === 'empty').length;
      events.push({ step: total, type: d.reasonType, openFrac: openCount / totalCells });
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
  return { total, events };
}

for (const id of ['promoted-mutsearch-8x8-49', 'promoted-mutsearch-8x8-60', 'promoted-mutsearch-9x9-42', 'promoted-mutsearch-9x9-43']) {
  const p = getPuzzle(id);
  const { total, events } = traceEvents(p);
  console.log(`\n${id}: total=${total} steps, ${events.length} deep events`);
  console.log(`  events at steps: ${events.map(e => `${e.step}(${(e.openFrac * 100).toFixed(0)}%)`).join(', ')}`);
  // Check clustering: are events bunched together (consecutive steps) or spread out?
  const gaps = [];
  for (let i = 1; i < events.length; i++) gaps.push(events[i].step - events[i - 1].step);
  console.log(`  gaps between consecutive events: [${gaps.join(', ')}]`);
}
