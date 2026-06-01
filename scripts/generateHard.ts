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
import type { Puzzle } from '../engine/boardTypes';

const HARD_TITLES = [
  'The Obsidian Concordat',
  'Shards of the Broken Astrolabe',
  'The Warden of Sunken Light',
  'Rite of the Seventh Tide',
  'The Corroded Vigil',
  'Echoes in the Abyssal Chart',
  'The Leviathan Meridian',
  'Codex of Drowned Stars',
  'The Pale Congregation',
  'Hymn of the Outer Dark',
  'The Unmarked Reliquary',
  'Depths of the Final Cartography',
  'The Crumbling Zodiac',
  'Voices from the Kelp Choir',
  'The Architect of Forgotten Tides',
];

function parseArgs(): { size: number; count: number; base: string; start: number } {
  const args = process.argv.slice(2);
  let size = 8, count = 5, base = 'hard-v1', start = 1;
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

  process.stderr.write(`Generating ${count} hard ${size}×${size} puzzles (depth-1 solver)...\n`);
  process.stderr.write(`This takes ~5–25s per puzzle. Grab a coffee.\n\n`);

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
    });
    const elapsed = ((Date.now() - start_ms) / 1000).toFixed(1);

    if (!puzzle) {
      process.stderr.write(`  seed ${seed}: no puzzle found\n`);
      continue;
    }

    const idx = start + found.length;
    const idStr = String(idx).padStart(3, '0');
    const id = `eb-hard-${size}x${size}-${idStr}`;
    const title = HARD_TITLES[(idx - 1) % HARD_TITLES.length];

    const finalPuzzle: Puzzle = {
      ...puzzle,
      id,
      title,
      difficulty: rateDifficulty({ ...puzzle, id, title }),
    };

    found.push(finalPuzzle);
    process.stderr.write(`  ✓ ${id} — ${finalPuzzle.difficulty} (${elapsed}s, seed ${seed})\n`);
  }

  process.stderr.write(`\nDone. ${found.length} puzzles from ${attempts} seed attempts.\n\n`);
  process.stderr.write(`Paste the following lines into data/samplePuzzles.ts:\n\n`);

  for (const p of found) {
    process.stdout.write(JSON.stringify(p) + ',\n');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
