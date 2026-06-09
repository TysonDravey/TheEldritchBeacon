/**
 * generateTwin.ts
 *
 * Generates twin-watcher puzzles (2 watchers per territory / row / column)
 * and appends them to data/samplePuzzles.ts.
 *
 * Usage:
 *   npx tsx scripts/generateTwin.ts
 *   npx tsx scripts/generateTwin.ts --count 5 --size 8 --base twin-v1
 *
 * Options:
 *   --count    Number of puzzles to add (default: 5)
 *   --size     Board size (default: 8; must be ≥ 6)
 *   --base     Base seed string (default: twin-v1)
 */

import './loadEnv';
import { generateTwinPuzzle } from '../engine/generator-twin';
import { solveWithTrace } from '../engine/solver';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle } from '../engine/boardTypes';
import { nextUnusedTitle, existingTitles } from './titlePool';

function parseArgs(): { count: number; size: number; base: string } {
  const args = process.argv.slice(2);
  let count = 5, size = 8, base = 'twin-v1';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--count' && args[i + 1]) count = parseInt(args[++i]);
    if (args[i] === '--size'  && args[i + 1]) size  = parseInt(args[++i]);
    if (args[i] === '--base'  && args[i + 1]) base  = args[++i];
  }
  return { count, size, base };
}

function nextTwinIdNum(content: string, size: number): number {
  const pattern = new RegExp(`"id":"twin-${size}x${size}-(\\d+)"`, 'g');
  const nums: number[] = [];
  for (const m of content.matchAll(pattern)) nums.push(parseInt(m[1]));
  return nums.length > 0 ? Math.max(...nums) + 1 : 1;
}

function usedSeeds(content: string): Set<string> {
  const seeds = new Set<string>();
  for (const m of content.matchAll(/"seed":"([^"]+)"/g)) seeds.add(m[1]);
  return seeds;
}

async function main() {
  const { count, size, base } = parseArgs();

  if (size < 9) {
    process.stderr.write('Size must be at least 9 for twin-watcher puzzles (8x8 has only 2 possible solution grids).\n');
    process.exit(1);
  }

  const filePath = join(process.cwd(), 'data', 'samplePuzzles.ts');
  let content = readFileSync(filePath, 'utf-8');
  const existingSeeds = usedSeeds(content);

  // Track solution fingerprints of already-generated twins to ensure diversity
  const existingSolutionFps = new Set<string>();
  for (const m of content.matchAll(/"solution":(\[\[[\d,\[\] ]+\]\])/g)) {
    try {
      const sol: [number,number][] = JSON.parse(m[1]);
      const fp = [...sol].sort((a,b)=>a[0]-b[0]||a[1]-b[1]).map(([r,c])=>r+','+c).join('|');
      existingSolutionFps.add(fp);
    } catch { /* ignore parse errors */ }
  }

  let added = 0;
  let seedIdx = 0;

  process.stderr.write(`\nGenerating ${count} twin-watcher ${size}×${size} puzzles...\n`);

  while (added < count) {
    const seed = `${base}-${size}-${seedIdx}`;
    seedIdx++;

    if (existingSeeds.has(seed)) continue;

    process.stderr.write(`  trying seed ${seed}...\n`);
    const puzzle = generateTwinPuzzle({ size, seed, maxAttempts: 300 });

    if (!puzzle) {
      process.stderr.write(`  skip ${seed}: no unique solution found\n`);
      continue;
    }

    // Reject if solution grid is identical to an existing puzzle
    const fp = [...puzzle.solution].sort((a,b)=>a[0]-b[0]||a[1]-b[1]).map(([r,c])=>r+','+c).join('|');
    if (existingSolutionFps.has(fp)) {
      process.stderr.write(`  skip ${seed}: duplicate solution grid\n`);
      continue;
    }

    // Require logical solvability at depth 2 (contradictionTest with sub-pass)
    const { solved } = solveWithTrace(puzzle, 2);
    if (!solved) {
      process.stderr.write(`  skip ${seed}: not logically solvable at depth 2\n`);
      continue;
    }

    content = readFileSync(filePath, 'utf-8');
    const idNum = nextTwinIdNum(content, size);
    const id    = `twin-${size}x${size}-${String(idNum).padStart(3, '0')}`;
    const title = nextUnusedTitle(existingTitles(content), 'Scholar'); // placeholder tier

    const cmd = `generateTwin --size ${size} --base ${base}`;

    const { difficulty: _d, ...rest } = puzzle;
    const entry: Omit<Puzzle, 'difficulty'> = { ...rest, id, title, generatorCmd: cmd };

    const insertPoint = content.lastIndexOf('\n];');
    if (insertPoint === -1) {
      process.stderr.write('ERROR: could not find insertion point in samplePuzzles.ts\n');
      process.exit(1);
    }

    const newContent =
      content.slice(0, insertPoint) +
      ',\n' + JSON.stringify(entry) +
      content.slice(insertPoint);

    writeFileSync(filePath, newContent, 'utf-8');
    existingSeeds.add(seed);

    existingSolutionFps.add(fp);
    process.stderr.write(`  ✓ ${id} "${title}" (seed ${seed})\n`);
    added++;
  }

  process.stderr.write(`\nDone. Added ${added} twin-watcher puzzle${added !== 1 ? 's' : ''}.\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
