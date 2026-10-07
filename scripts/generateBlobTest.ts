/**
 * generateBlobTest.ts
 *
 * One-off experiment: our entire regular-mode (initiate) puzzle catalog has
 * only ever used the default biasStrength=0.75 (stripe/confinement-friendly
 * territory shapes) — zero puzzles have ever used a lower, blobbier bias,
 * and as a result zero puzzles have ever required hidden-set reasoning
 * (rateDifficulty's 'Harbinger' tier). This generates a small test batch at
 * a lower bias to see if it produces puzzles that feel genuinely different
 * to solve, without touching the live campaign catalog at all — writes to
 * data/experimentalPuzzles.ts, a separate file getPuzzleById falls back to,
 * so these are reachable at /puzzle/<id> for manual testing but invisible
 * to every campaign/region/daily listing.
 *
 * Usage: npx tsx scripts/generateBlobTest.ts
 */

import { generatePuzzle } from '../engine/generator';
import { rateDifficulty, scorePuzzle, hasForcedOpening } from '../engine/difficulty';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle } from '../engine/boardTypes';
import { nextUnusedTitle, existingTitles } from './titlePool';

const SIZES = [6, 7, 8];
const PER_SIZE = 5;
const BIAS = 0.3;
const BASE = 'blobtest-v1';

async function main() {
  const puzzles: Puzzle[] = [];
  const samplePuzzlesContent = readFileSync(join(process.cwd(), 'data', 'samplePuzzles.ts'), 'utf-8');
  const usedTitles = existingTitles(samplePuzzlesContent);

  for (const size of SIZES) {
    let added = 0;
    let seedIdx = 0;
    let attempts = 0;
    while (added < PER_SIZE && attempts < 400) {
      attempts++;
      const seed = `${BASE}-${size}-${seedIdx++}`;
      const puzzle = generatePuzzle({ size, seed, maxAttempts: 500, biasStrength: BIAS });
      if (!puzzle) continue;

      const diff = rateDifficulty(puzzle);
      const { difficulty: _d, score: _s, ...rest } = puzzle;
      const id = `blob-${size}x${size}-${String(added + 1).padStart(2, '0')}`;
      const title = nextUnusedTitle(usedTitles, diff);
      usedTitles.add(title);

      const entry: Puzzle = {
        ...rest,
        id,
        title,
        difficulty: diff,
        score: scorePuzzle(puzzle),
        generatorCmd: `generateBlobTest --base ${BASE} --sizes ${size} --bias ${BIAS}`,
      };
      puzzles.push(entry);
      added++;
      process.stderr.write(`  ${id} "${title}" — ${diff} (score ${entry.score}, forcedOpening=${hasForcedOpening(entry)})\n`);
    }
    if (added < PER_SIZE) {
      process.stderr.write(`  only found ${added}/${PER_SIZE} at size ${size} after ${attempts} attempts\n`);
    }
  }

  const diffCounts = new Map<string, number>();
  for (const p of puzzles) diffCounts.set(p.difficulty, (diffCounts.get(p.difficulty) ?? 0) + 1);
  process.stderr.write(`\nDifficulty distribution: ${JSON.stringify(Object.fromEntries(diffCounts))}\n`);

  const content = `// Experimental test batch — NOT part of the live campaign/daily rotation.
// Generated with biasStrength=${BIAS} (blob-shaped territories) to compare
// against the default 0.75 stripe-biased shape every real puzzle uses.
// See scripts/generateBlobTest.ts. Reachable at /puzzle/<id> for manual
// testing via getPuzzleById's fallback, but invisible to every
// campaign-region/daily listing since those only ever read SAMPLE_PUZZLES.
import type { Puzzle } from '@/engine/boardTypes';

export const EXPERIMENTAL_PUZZLES: Puzzle[] = [
${puzzles.map(p => JSON.stringify(p)).join(',\n')}
];
`;
  writeFileSync(join(process.cwd(), 'data', 'experimentalPuzzles.ts'), content, 'utf-8');
  process.stderr.write(`\nWrote ${puzzles.length} puzzles to data/experimentalPuzzles.ts\n`);
  process.stderr.write(`IDs: ${puzzles.map(p => p.id).join(', ')}\n`);
}

main();
