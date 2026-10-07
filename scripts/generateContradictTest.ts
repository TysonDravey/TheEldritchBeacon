/**
 * generateContradictTest.ts
 *
 * Round 2 of the "why do our puzzles all feel the same" experiment. Round 1
 * (scripts/generateBlobTest.ts) lowered territory-shape bias but left
 * requireContradict off — so the generator's own confinement pre-filter
 * still demanded an easy forward-reasoning opener exist, regardless of
 * shape. That's almost certainly why it didn't feel harder despite scoring
 * higher: those puzzles were still "long chains of the same technique,"
 * never "stuck, no entry point."
 *
 * This generates puzzles with requireContradict=true and maxDepth=1 — the
 * solver must verify depth-0 (pure forward reasoning) genuinely CANNOT
 * solve it before the puzzle is accepted. Checked across the whole catalog:
 * zero existing initiate-mode puzzles have ever been generated this way;
 * only shattered-realms puzzles ever used --depth 1. Default bias (0.75)
 * on purpose, to isolate "no easy opener" as its own variable from shape.
 *
 * Writes to data/experimentalPuzzles.ts (appends to round 1's batch) — same
 * non-live, direct-ID-only setup, invisible to every campaign/daily listing.
 *
 * Usage: npx tsx scripts/generateContradictTest.ts
 */

import { generatePuzzle } from '../engine/generator';
import { rateDifficulty, scorePuzzle, hasForcedOpening } from '../engine/difficulty';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle } from '../engine/boardTypes';
import { nextUnusedTitle, existingTitles } from './titlePool';

const SIZES = [6, 7, 8, 9];
const PER_SIZE = 4;
const BASE = 'contradicttest-v1';
const MAX_ATTEMPTS_PER_SEED = 500;
const MAX_SEEDS_PER_SIZE = 2000;

async function main() {
  const filePath = join(process.cwd(), 'data', 'experimentalPuzzles.ts');
  const existingContent = readFileSync(filePath, 'utf-8');
  const samplePuzzlesContent = readFileSync(join(process.cwd(), 'data', 'samplePuzzles.ts'), 'utf-8');
  const usedTitles = new Set<string>([...existingTitles(existingContent), ...existingTitles(samplePuzzlesContent)]);

  const puzzles: Puzzle[] = [];

  for (const size of SIZES) {
    let added = 0;
    let seedIdx = 0;
    while (added < PER_SIZE && seedIdx < MAX_SEEDS_PER_SIZE) {
      const seed = `${BASE}-${size}-${seedIdx++}`;
      const puzzle = generatePuzzle({
        size, seed, maxAttempts: MAX_ATTEMPTS_PER_SEED, maxDepth: 1, requireContradict: true,
      });
      if (!puzzle) continue;

      const diff = rateDifficulty(puzzle);
      const { difficulty: _d, score: _s, ...rest } = puzzle;
      const id = `contradict-${size}x${size}-${String(added + 1).padStart(2, '0')}`;
      const title = nextUnusedTitle(usedTitles, diff);
      usedTitles.add(title);

      const entry: Puzzle = {
        ...rest,
        id,
        title,
        difficulty: diff,
        score: scorePuzzle(puzzle),
        generatorCmd: `generateContradictTest --base ${BASE} --sizes ${size} --depth 1 --requireContradict`,
      };
      puzzles.push(entry);
      added++;
      process.stderr.write(`  ${id} "${title}" — ${diff} (score ${entry.score}, forcedOpening=${hasForcedOpening(entry)}) [seed idx ${seedIdx}]\n`);
    }
    if (added < PER_SIZE) {
      process.stderr.write(`  only found ${added}/${PER_SIZE} at size ${size} after ${seedIdx} seed attempts\n`);
    }
  }

  const diffCounts = new Map<string, number>();
  for (const p of puzzles) diffCounts.set(p.difficulty, (diffCounts.get(p.difficulty) ?? 0) + 1);
  process.stderr.write(`\nDifficulty distribution: ${JSON.stringify(Object.fromEntries(diffCounts))}\n`);

  // Append to the existing EXPERIMENTAL_PUZZLES array rather than overwriting round 1.
  const insertPoint = existingContent.lastIndexOf('\n];');
  if (insertPoint === -1) {
    process.stderr.write('ERROR: could not find insertion point in experimentalPuzzles.ts\n');
    process.exitCode = 1;
    return;
  }
  const newContent =
    existingContent.slice(0, insertPoint).replace(/,(\s*)$/, '$1') +
    (puzzles.length > 0 ? ',\n' + puzzles.map(p => JSON.stringify(p)).join(',\n') : '') +
    existingContent.slice(insertPoint);
  writeFileSync(filePath, newContent, 'utf-8');

  process.stderr.write(`\nAppended ${puzzles.length} puzzles to data/experimentalPuzzles.ts\n`);
  process.stderr.write(`IDs: ${puzzles.map(p => p.id).join(', ')}\n`);
}

main();
