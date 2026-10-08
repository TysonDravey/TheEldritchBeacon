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

const content = readFileSync(join(process.cwd(), 'data', 'samplePuzzles.ts'), 'utf-8');
const all = parseAllPuzzles(content).filter(p => p.mode === 'initiate');

const oldPuzzles = all.filter(p => !p.id.startsWith('promoted-'));
const newPuzzles = all.filter(p => p.id.startsWith('promoted-'));

function dist(label: string, list: Puzzle[]) {
  const scores = list.map(p => scorePuzzle(p)).sort((a, b) => a - b);
  const pct = (p: number) => scores[Math.floor(scores.length * p)];
  console.log(`${label}: n=${scores.length} min=${scores[0].toFixed(1)} p25=${pct(0.25).toFixed(1)} p50=${pct(0.5).toFixed(1)} p75=${pct(0.75).toFixed(1)} p90=${pct(0.9).toFixed(1)} max=${scores[scores.length - 1].toFixed(1)}`);
}

dist('OLD (no real technique, mostly)', oldPuzzles);
dist('NEW (promoted, real technique)', newPuzzles);
dist('ALL', all);
