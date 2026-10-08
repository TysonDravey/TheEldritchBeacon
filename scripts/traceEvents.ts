import { getNextDeduction } from '../engine/solver';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { CellState, Puzzle } from '../engine/boardTypes';

const content = readFileSync(join(process.cwd(), 'data', 'experimentalPuzzles.ts'), 'utf-8');

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

function trace(id: string) {
  const p = getPuzzle(id);
  const n = p.size;
  const cells: CellState[][] = Array.from({ length: n }, () => Array(n).fill('empty'));
  let total = 0;
  const events: { step: number; type: string }[] = [];
  const openCellsAtEvent: number[] = [];
  let guard = 0;
  while (guard++ < 1000) {
    const d = getNextDeduction(p, cells, 0);
    if (!d) break;
    total++;
    if (d.reasonType === 'hypothetical' || d.reasonType === 'mutual-exclusion') {
      const openCount = cells.flat().filter(c => c === 'empty').length;
      events.push({ step: total, type: d.reasonType });
      openCellsAtEvent.push(openCount);
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
  const totalCells = n * n;
  console.log(`${id}: n=${n} total steps=${total} (${totalCells} cells)`);
  events.forEach((e, i) => {
    console.log(`  step ${e.step}/${total} (${(100 * e.step / total).toFixed(0)}% through solve) — ${e.type} — ${openCellsAtEvent[i]} cells still open at that moment`);
  });
}

for (const id of ['mutualtest-6x6-01', 'contighard-7x7-01', 'deepreasonv2-7x7-01', 'mixedshape-7x7-01']) trace(id);
