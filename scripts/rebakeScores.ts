/**
 * rebakeScores.ts
 *
 * Recomputes `score` for every puzzle in both data files under the revamped
 * engine/difficulty.ts formula. `difficulty` is also recomputed for every
 * puzzle EXCEPT ones with a "promoted-" id prefix — those have a
 * deliberately hand-overridden difficulty for campaign placement (see
 * scripts/promoteMutsearch.ts / buildRamp.ts), which must not be touched by
 * a re-score; only their sort-order-driving `score` field updates.
 *
 * Usage: npx tsx scripts/rebakeScores.ts
 */

import { scorePuzzle, rateDifficulty } from '../engine/difficulty';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle } from '../engine/boardTypes';

function rebakeFile(path: string) {
  let content = readFileSync(path, 'utf-8');
  const idxs: number[] = [];
  const re = /\{"id":/g;
  let m;
  while ((m = re.exec(content)) !== null) idxs.push(m.index);

  // Collect replacements first (don't mutate while scanning original indices)
  const replacements: { start: number; end: number; newText: string }[] = [];
  let rescoredCount = 0, rediffedCount = 0;

  for (const start of idxs) {
    let depth = 0, end = start;
    for (let i = start; i < content.length; i++) {
      if (content[i] === '{') depth++;
      if (content[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    let p: Puzzle;
    try { p = JSON.parse(content.slice(start, end)); } catch { continue; }

    const newScore = scorePuzzle(p);
    const isPromoted = p.id.startsWith('promoted-');
    const newDifficulty = isPromoted ? p.difficulty : rateDifficulty(p);

    if (newScore !== p.score) rescoredCount++;
    if (newDifficulty !== p.difficulty) rediffedCount++;

    const updated: Puzzle = { ...p, score: newScore, difficulty: newDifficulty };
    replacements.push({ start, end, newText: JSON.stringify(updated) });
  }

  // Apply from the end backwards so earlier indices stay valid
  for (let i = replacements.length - 1; i >= 0; i--) {
    const r = replacements[i];
    content = content.slice(0, r.start) + r.newText + content.slice(r.end);
  }

  writeFileSync(path, content, 'utf-8');
  console.log(`${path}: ${idxs.length} puzzles, ${rescoredCount} scores changed, ${rediffedCount} difficulty labels changed`);
}

rebakeFile(join(process.cwd(), 'data', 'samplePuzzles.ts'));
rebakeFile(join(process.cwd(), 'data', 'experimentalPuzzles.ts'));
