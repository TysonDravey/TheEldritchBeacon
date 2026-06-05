/**
 * backfillGeneratorCmd.ts
 *
 * Adds a `generatorCmd` field to existing puzzles that lack one,
 * inferred from their seed string.
 *
 * Usage:
 *   npx tsx scripts/backfillGeneratorCmd.ts
 *   npx tsx scripts/backfillGeneratorCmd.ts --dry-run
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const dryRun = process.argv.includes('--dry-run');

function inferCmd(seed: string, mode: string): string | null {
  // generate10x10 seeds
  if (/^eb-10x10-hard-pack-s\d+$/.test(seed))
    return `generate10x10 --base eb-10x10-hard-pack --thin 3 --hard`;
  if (/^eb-10x10-h3-s\d+$/.test(seed))
    return `generate10x10 --base eb-10x10-h3 --thin 3`;
  if (/^eb-10x10-v4-s\d+$/.test(seed))
    return `generate10x10 --base eb-10x10-v4 --thin 3`;
  if (/^eb-10x10-cap-s\d+$/.test(seed))
    return `generate10x10 --base eb-10x10-cap --thin 3`;
  // Any other eb-10x10-* pattern
  const m10 = seed.match(/^(eb-10x10-[^-]+(?:-[^s][^-]*)*)-s\d+$/);
  if (m10) return `generate10x10 --base ${m10[1]} --thin 3`;

  // generateBatch seeds — pattern: {base}-{size}-{idx}
  // base may itself contain hyphens; size is always a small integer; idx is always an integer
  const mBatch = seed.match(/^(.+)-(\d+)-(\d+)$/);
  if (mBatch) {
    const [, base, sizeStr] = mBatch;
    const size = parseInt(sizeStr);
    if (size >= 5 && size <= 9) {
      const modeFlag = mode === 'shattered-realms' ? ' --mode shattered-realms' : '';
      return `generateBatch --base ${base} --sizes ${size}${modeFlag}`;
    }
  }

  // eldritch-v2 seeds: eldritch-v2-eb-{size}x{size}-{id}-s0
  const mV2 = seed.match(/^(eldritch-v2)-eb-(\d+)x\d+-[^-]+-s\d+$/);
  if (mV2) {
    const [, base, sizeStr] = mV2;
    return `generateBatch --base ${base} --sizes ${sizeStr}`;
  }

  return null;
}

const filePath = join(process.cwd(), 'data', 'samplePuzzles.ts');
const content = readFileSync(filePath, 'utf-8');

// Parse each puzzle object on its own line
let updated = 0;
let skipped = 0;
let unknown = 0;

// Each puzzle is a single line ending with `},` or `}`
const newContent = content.replace(/^\{[^{}]+\},?$/gm, (line) => {
  // Already has generatorCmd — leave it alone
  if (line.includes('"generatorCmd"')) { skipped++; return line; }

  const seedMatch  = line.match(/"seed":"([^"]+)"/);
  const modeMatch  = line.match(/"mode":"([^"]+)"/);
  if (!seedMatch) return line;

  const seed = seedMatch[1];
  const mode = modeMatch?.[1] ?? 'initiate';
  const cmd  = inferCmd(seed, mode);

  if (!cmd) {
    process.stderr.write(`  ⚠ unknown seed pattern: ${seed}\n`);
    unknown++;
    return line;
  }

  // Insert generatorCmd before the closing `}` (preserve trailing comma if present)
  const trailingComma = line.endsWith(',');
  const base = trailingComma ? line.slice(0, -2) : line.slice(0, -1); // strip `},` or `}`
  const injected = base + `,"generatorCmd":${JSON.stringify(cmd)}}${trailingComma ? ',' : ''}`;
  updated++;
  return injected;
});

process.stderr.write(`Backfill: ${updated} updated, ${skipped} already had cmd, ${unknown} unknown patterns\n`);

if (dryRun) {
  process.stderr.write('Dry run — no file written.\n');
  // Print a sample of what changed
  const lines = newContent.split('\n').filter(l => l.includes('"generatorCmd"') && !content.includes(l));
  for (const l of lines.slice(0, 5)) {
    const id = l.match(/"id":"([^"]+)"/)?.[1] ?? '?';
    const cmd = l.match(/"generatorCmd":"([^"]+)"/)?.[1] ?? '?';
    process.stderr.write(`  ${id}: ${cmd}\n`);
  }
} else {
  writeFileSync(filePath, newContent, 'utf-8');
  process.stderr.write('Written.\n');
}
