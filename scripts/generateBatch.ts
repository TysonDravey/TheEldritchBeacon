/**
 * generateBatch.ts
 *
 * Generates standard (depth-0) puzzles and appends them directly to
 * data/samplePuzzles.ts, picking up IDs where the existing ones left off.
 *
 * Usage:
 *   npx tsx scripts/generateBatch.ts
 *   npx tsx scripts/generateBatch.ts --per-size 10 --sizes 5,6,7,8 --base eldritch-v3
 *
 * Options:
 *   --per-size    Puzzles to add per board size (default: 10)
 *   --sizes       Comma-separated list of sizes (default: 5,6,7,8)
 *   --base        Base seed string (default: eldritch-v3)
 *   --depth       Max solver depth (0 = forward only, 1 = hypothesis/Archon; default: 0)
 *   --difficulty  Filter for a specific difficulty label, e.g. Harbinger or Archon
 *   --mode        Puzzle mode: initiate (default) or shattered-realms
 */

import { generatePuzzle } from '../engine/generator';
import { rateDifficulty } from '../engine/difficulty';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle, PuzzleMode } from '../engine/boardTypes';

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK ?? '';

async function discordPing(msg: string): Promise<void> {
  try {
    await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: msg }),
    });
  } catch {
    // non-fatal — don't interrupt generation if Discord is unreachable
  }
}

// ---------------------------------------------------------------------------
// Title pool — enough for many runs
// ---------------------------------------------------------------------------

const TITLE_POOL = [
  'The Hollowed Meridian',
  'Covenant of the Sunken Chart',
  'The Abyssal Warden',
  'Hymn of Fractured Stars',
  'The Tidal Concordat',
  'Reliquary of the Drowned Eye',
  'The Corroded Sigil',
  'Rites of the Bone Shoal',
  'The Whispering Astrolabe',
  'Congregation of the Pale Deep',
  'The Kelp Cathedral',
  'Scrolls of the Outer Flood',
  'The Unmarked Vigil',
  'Litany of the Sunken Spire',
  'The Ink-Black Compass',
  'Voices from the Abyssal Chart',
  'The Corroded Zodiac',
  'Omen of the Second Tide',
  'The Warden of Drowned Light',
  'Codex of the Hollow Shore',
  'The Pale Congregation',
  'Echoes Below the Meridian',
  'The Fractured Reliquary',
  'Rite of the Outer Dark',
  'The Leviathan Cartography',
  'Shards of the Forgotten Flood',
  'The Obsidian Vigil',
  'Hymn of the Corroded Gate',
  'The Second Congregation',
  'Depths of the Bone Compass',
  'The Warden of Seven Tides',
  'Covenant of the Hollow Spire',
  'The Tidal Reliquary',
  'Scrolls of the Drowned Zodiac',
  'The Crumbling Cartography',
  'Litany of Sunken Stars',
  'The Pale Sigil',
  'Voices of the Outer Flood',
  'The Ossified Concordat',
  'Omen Below the Broken Shore',
  'The Kelp Meridian',
  'Rites of the Hollow Eye',
  'The Sunken Vigil',
  'Codex of the Abyssal Gate',
  'The Second Cartography',
  'Echoes of the Corroded Tide',
  'The Fractured Zodiac',
  'Hymn of the Bone Warden',
  'The Pale Astrolabe',
  'Congregation of Drowned Omens',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  let perSize = 10;
  let sizes = [5, 6, 7, 8];
  let base = 'eldritch-v3';
  let depth = 0;
  let difficulty: string | null = null;
  let mode: PuzzleMode = 'initiate';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--per-size'   && args[i + 1]) perSize = parseInt(args[++i]);
    if (args[i] === '--sizes'      && args[i + 1]) sizes = args[++i].split(',').map(Number);
    if (args[i] === '--base'       && args[i + 1]) base = args[++i];
    if (args[i] === '--depth'      && args[i + 1]) depth = parseInt(args[++i]);
    if (args[i] === '--difficulty' && args[i + 1]) difficulty = args[++i];
    if (args[i] === '--mode'       && args[i + 1]) mode = args[++i] as PuzzleMode;
  }
  return { perSize, sizes, base, depth, difficulty, mode };
}

function nextIdNum(content: string, size: number): number {
  const sizeStr = `${size}x${size}`;
  const pattern = new RegExp(`"id":"eb-${sizeStr}-(\\d+)"`, 'g');
  const nums: number[] = [];
  for (const m of content.matchAll(pattern)) nums.push(parseInt(m[1]));
  return nums.length > 0 ? Math.max(...nums) + 1 : 1;
}

function usedSeeds(content: string): Set<string> {
  const seeds = new Set<string>();
  for (const m of content.matchAll(/"seed":"([^"]+)"/g)) seeds.add(m[1]);
  return seeds;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { perSize, sizes, base, depth, difficulty, mode } = parseArgs();
  const filePath = join(process.cwd(), 'data', 'samplePuzzles.ts');

  let content = readFileSync(filePath, 'utf-8');
  const existingSeeds = usedSeeds(content);

  let totalAdded = 0;

  for (const size of sizes) {
    process.stderr.write(`\n── ${size}×${size} ──\n`);

    let added = 0;
    let seedIdx = 0;

    while (added < perSize) {
      const seed = `${base}-${size}-${seedIdx}`;
      seedIdx++;

      if (existingSeeds.has(seed)) continue;

      const puzzle = generatePuzzle({ size, seed, maxAttempts: depth > 0 ? 200 : 500, maxDepth: depth, mode });
      if (!puzzle) {
        process.stderr.write(`  skip ${seed}: no puzzle\n`);
        continue;
      }

      const diff = rateDifficulty(puzzle);
      if (difficulty && diff !== difficulty) {
        process.stderr.write(`  skip ${seed}: wrong difficulty ${diff}\n`);
        continue;
      } else if (!difficulty && depth > 0 && diff !== 'Archon') {
        process.stderr.write(`  skip ${seed}: solvable without hypothesis (${diff})\n`);
        continue;
      }

      // Re-read file each time so nextIdNum is accurate after each write
      content = readFileSync(filePath, 'utf-8');
      const idNum  = nextIdNum(content, size);
      const id     = `eb-${size}x${size}-${String(idNum).padStart(3, '0')}`;
      const title  = TITLE_POOL[(idNum - 1) % TITLE_POOL.length];

      const { difficulty: _d, ...rest } = puzzle;
      const entry: Omit<Puzzle, 'difficulty'> = { ...rest, id, title };

      const insertPoint = content.lastIndexOf('\n];');
      if (insertPoint === -1) {
        process.stderr.write('ERROR: could not find insertion point\n');
        process.exit(1);
      }

      const newContent =
        content.slice(0, insertPoint) +
        ',\n' + JSON.stringify(entry) +
        content.slice(insertPoint);

      writeFileSync(filePath, newContent, 'utf-8');
      existingSeeds.add(seed);

      process.stderr.write(`  ✓ ${id} — ${diff} (seed ${seed})\n`);
      await discordPing(`✓ ${id} — ${diff}`);
      added++;
      totalAdded++;
    }
  }

  process.stderr.write(`\nDone. Added ${totalAdded} puzzles.\n`);
  await discordPing(`@here 🔔 Vesper — generation complete. Added ${totalAdded} puzzle${totalAdded !== 1 ? 's' : ''} (sizes: ${sizes.join(', ')}).`);
}

main().catch(err => { console.error(err); process.exit(1); });
