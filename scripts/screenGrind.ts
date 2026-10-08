import { getNextDeduction } from '../engine/solver';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle, CellState } from '../engine/boardTypes';

const content = readFileSync(join(process.cwd(), 'data', 'samplePuzzles.ts'), 'utf-8');
const idxs: number[] = [];
const re = /\{"id":"promoted-mutsearch-/g;
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

function trace(p: Puzzle) {
  const n = p.size;
  const cells: CellState[][] = Array.from({ length: n }, () => Array(n).fill('empty'));
  let total = 0;
  const eventSteps: number[] = [];
  let guard = 0;
  while (guard++ < 2000) {
    const d = getNextDeduction(p, cells, 0);
    if (!d) break;
    total++;
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
  // Longest run of CONSECUTIVE steps (gap === 1)
  let longestRun = eventSteps.length > 0 ? 1 : 0, currentRun = 1;
  for (let i = 1; i < eventSteps.length; i++) {
    if (eventSteps[i] - eventSteps[i - 1] === 1) currentRun++;
    else currentRun = 1;
    longestRun = Math.max(longestRun, currentRun);
  }
  return { total, eventCount: eventSteps.length, longestRun };
}

console.log(`Screening ${puzzles.length} promoted puzzles for grind pattern (long consecutive deep-technique runs)...\n`);
const flagged: Puzzle[] = [];
for (const p of puzzles) {
  const { total, eventCount, longestRun } = trace(p);
  const suspect = longestRun >= 4 || eventCount >= 8;
  if (suspect) flagged.push(p);
  console.log(`${suspect ? '[FLAG]' : '[ ok ]'} ${p.id.padEnd(28)} total=${total} events=${eventCount} longestConsecutiveRun=${longestRun}`);
}
console.log(`\n${flagged.length}/${puzzles.length} flagged as possible grind.`);
console.log(flagged.map(p => p.id).join(', '));
