/**
 * generateHard.ts
 *
 * Generates harder puzzles using the depth-1 contradiction solver.
 * These puzzles require hypothesis-based reasoning that the standard
 * generator (depth-0) never produces.
 *
 * Usage:
 *   npx tsx scripts/generateHard.ts
 *   npx tsx scripts/generateHard.ts --size 7 --count 5 --base myrun
 *
 * Options:
 *   --size   Board size (default: 8)
 *   --count  Number of puzzles to generate (default: 5)
 *   --base   Base seed string (default: hard-v1)
 *   --start  Starting index for IDs (default: 001)
 *
 * Output: JSON lines printed to stdout, ready to paste into samplePuzzles.ts
 */

import { generatePuzzle } from '../engine/generator';
import { rateDifficulty } from '../engine/difficulty';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle } from '../engine/boardTypes';
import { nextUnusedTitle, existingTitles } from './titlePool';

function parseArgs(): { size: number; count: number; base: string; start: number } {
  const args = process.argv.slice(2);
  let size = 8, count = 5, base = 'archon-v2', start = 1;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--size'  && args[i+1]) size  = parseInt(args[++i]);
    if (args[i] === '--count' && args[i+1]) count = parseInt(args[++i]);
    if (args[i] === '--base'  && args[i+1]) base  = args[++i];
    if (args[i] === '--start' && args[i+1]) start = parseInt(args[++i]);
  }
  return { size, count, base, start };
}

async function main() {
  const { size, count, base, start } = parseArgs();

  process.stderr.write(`Generating ${count} Archon ${size}×${size} puzzles (depth-1 solver, medium territories)...\n`);
  process.stderr.write(`Filtering for contradiction-test-required puzzles. Hit Ctrl+C to stop early.\n\n`);

  const found: Puzzle[] = [];
  let seedIdx = 0;
  let attempts = 0;

  while (found.length < count) {
    const seed = `${base}-${size}-${seedIdx}`;
    seedIdx++;
    attempts++;

    const start_ms = Date.now();
    const puzzle = generatePuzzle({
      size,
      seed,
      maxAttempts: 500,
      maxDepth: 1,
      mode: 'initiate',
      biasStrength: 0.5,   // medium shape: not so stripe that depth-0 solves; not so blob that contradiction chains can't form
    });
    const elapsed = ((Date.now() - start_ms) / 1000).toFixed(1);

    if (!puzzle) {
      process.stderr.write(`  seed ${seed}: no candidate found (${elapsed}s)\n`);
      continue;
    }

    const idx = start + found.length;
    const idStr = String(idx).padStart(3, '0');
    const id = `eb-hard-${size}x${size}-${idStr}`;
    // Pull a title from the shared pool that isn't already in samplePuzzles
    // OR already used by this run's pending results.
    const inFileTitles = existingTitles(readFileSync(join(process.cwd(), 'data', 'samplePuzzles.ts'), 'utf-8'));
    for (const p of found) inFileTitles.add(p.title);
    const title = nextUnusedTitle(inFileTitles);

    const finalPuzzle: Puzzle = {
      ...puzzle,
      id,
      title,
      difficulty: rateDifficulty({ ...puzzle, id, title }),
    };

    // Only count genuinely Archon puzzles (require contradiction-test reasoning)
    if (finalPuzzle.difficulty !== 'Archon') {
      process.stderr.write(`  seed ${seed}: skipped (${finalPuzzle.difficulty}, ${elapsed}s)\n`);
      continue;
    }

    found.push(finalPuzzle);
    process.stderr.write(`  ✓ ${id} — Archon (${elapsed}s, seed ${seed})\n`);
  }

  process.stderr.write(`\nDone. ${found.length} puzzles from ${attempts} seed attempts.\n\n`);
  process.stderr.write(`Paste the following lines into data/samplePuzzles.ts:\n\n`);

  for (const p of found) {
    process.stdout.write(JSON.stringify(p) + ',\n');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
