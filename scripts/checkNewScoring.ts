import { scorePuzzle } from '../engine/difficulty';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle } from '../engine/boardTypes';

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
    try { puzzles.push(JSON.parse(content.slice(start, end))); } catch { /* skip */ }
  }
  return puzzles;
}

const sampleContent = readFileSync(join(process.cwd(), 'data', 'samplePuzzles.ts'), 'utf-8');
const all = parseAllPuzzles(sampleContent);

const checkIds = [
  'eb-9x9-015', 'eb-9x9-008', 'eb-9x9-031', 'eb-9x9-035', // old, zero real technique, were high-scoring
  'eb-5x5-004', 'eb-6x6-001', // old, trivial, low tier
  'eb-7x7-009', // old Survey-tier
  'promoted-mutsearch-8x8-31', // wait this was removed — skip if missing
  'promoted-mutsearch-6x6-01', 'promoted-mutsearch-6x6-02',
  'promoted-mutsearch-7x7-02', 'promoted-mutsearch-7x7-28', 'promoted-mutsearch-7x7-20',
  'promoted-mutsearch-8x8-40', 'promoted-mutsearch-8x8-24', 'promoted-mutsearch-8x8-63',
  'promoted-mutsearch-9x9-15', 'promoted-mutsearch-9x9-12', 'promoted-mutsearch-9x9-13',
  'promoted-mutsearch-9x9-03', 'promoted-mutsearch-9x9-33',
];

for (const id of checkIds) {
  const p = all.find(x => x.id === id);
  if (!p) { console.log(id, '-- not found, skipping'); continue; }
  const oldScore = p.score;
  const newScore = scorePuzzle(p);
  console.log(`${id.padEnd(30)} old=${String(oldScore).padStart(5)}  new=${newScore}`);
}
