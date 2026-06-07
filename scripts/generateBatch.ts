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

import './loadEnv';
import { generatePuzzle } from '../engine/generator';
import { rateDifficulty } from '../engine/difficulty';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Difficulty, Puzzle, PuzzleMode } from '../engine/boardTypes';
import { nextUnusedTitle, existingTitles } from './titlePool';

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK ?? '';

async function discordPing(msg: string): Promise<void> {
  if (!DISCORD_WEBHOOK) return;
  try {
    await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: msg }),
    });
  } catch { /* non-fatal */ }
}

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
  let bias: number | null = null;
  let attempts: number | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--per-size'   && args[i + 1]) perSize = parseInt(args[++i]);
    if (args[i] === '--sizes'      && args[i + 1]) sizes = args[++i].split(',').map(Number);
    if (args[i] === '--base'       && args[i + 1]) base = args[++i];
    if (args[i] === '--depth'      && args[i + 1]) depth = parseInt(args[++i]);
    if (args[i] === '--difficulty' && args[i + 1]) difficulty = args[++i];
    if (args[i] === '--mode'       && args[i + 1]) mode = args[++i] as PuzzleMode;
    if (args[i] === '--bias'       && args[i + 1]) bias = parseFloat(args[++i]);
    if (args[i] === '--attempts'   && args[i + 1]) attempts = parseInt(args[++i]);
  }
  return { perSize, sizes, base, depth, difficulty, mode, bias, attempts };
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
  const { perSize, sizes, base, depth, difficulty, mode, bias, attempts } = parseArgs();
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

      const maxAttempts = attempts ?? (depth > 0 ? 200 : 500);
      const puzzle = generatePuzzle({ size, seed, maxAttempts, maxDepth: depth, mode, ...(bias != null && { biasStrength: bias }) });
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
      const title  = nextUnusedTitle(existingTitles(content), diff as Difficulty);

      const cmd = [
        'generateBatch',
        `--base ${base}`,
        `--sizes ${size}`,
        ...(depth > 0    ? [`--depth ${depth}`]          : []),
        ...(difficulty   ? [`--difficulty ${difficulty}`] : []),
        ...(mode !== 'initiate' ? [`--mode ${mode}`]      : []),
        ...(bias != null ? [`--bias ${bias}`]             : []),
        ...(attempts != null ? [`--attempts ${attempts}`] : []),
      ].join(' ');

      const { difficulty: _d, ...rest } = puzzle;
      const entry: Omit<Puzzle, 'difficulty'> = { ...rest, id, title, generatorCmd: cmd };

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
