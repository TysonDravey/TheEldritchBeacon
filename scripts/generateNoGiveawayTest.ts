/**
 * generateNoGiveawayTest.ts
 *
 * Round 3 of the "why do our puzzles all feel the same" investigation.
 * Checked the entire existing initiate-mode catalog (137 puzzles): every
 * single one has at least one territory confined to exactly one row or one
 * column — a completely free, zero-effort opening move ("this colour only
 * has cells in row 3, done"). That's the actual milquetoast culprit, not
 * shape bias (round 1) or missing contradiction-testing (round 2, and
 * contiguous territories turned out to essentially never need that anyway).
 *
 * This rejects any territory confined to a single row/column at generation
 * time, so every puzzle's opening move requires real 2D reasoning instead
 * of a free giveaway. Writes incrementally to data/experimentalPuzzles.ts
 * (one puzzle at a time, re-reading the file each loop) so progress is
 * visible live via `tail -f` on this script's own stderr output, unlike
 * round 2's batch-at-the-end mistake.
 *
 * Usage: npx tsx scripts/generateNoGiveawayTest.ts
 */

import { generatePuzzle } from '../engine/generator';
import { rateDifficulty, scorePuzzle, hasForcedOpening } from '../engine/difficulty';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle } from '../engine/boardTypes';
import { nextUnusedTitle, existingTitles } from './titlePool';

const SIZES = [6, 7, 8];
const PER_SIZE = 5;
const BASE = 'nogiveaway-v1';
const FILE = join(process.cwd(), 'data', 'experimentalPuzzles.ts');

function hasSingleLineTerritory(puzzle: Puzzle): boolean {
  const n = puzzle.size;
  const cellsByT = new Map<number, [number, number][]>();
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const t = puzzle.territoryMap[r][c];
    if (!cellsByT.has(t)) cellsByT.set(t, []);
    cellsByT.get(t)!.push([r, c]);
  }
  for (const cells of cellsByT.values()) {
    const rows = new Set(cells.map(([r]) => r));
    const cols = new Set(cells.map(([, c]) => c));
    if (rows.size === 1 || cols.size === 1) return true;
  }
  return false;
}

function appendPuzzle(entry: Puzzle) {
  const content = readFileSync(FILE, 'utf-8');
  const insertPoint = content.lastIndexOf('\n];');
  const newContent =
    content.slice(0, insertPoint).replace(/,(\s*)$/, '$1') +
    ',\n' + JSON.stringify(entry) +
    content.slice(insertPoint);
  writeFileSync(FILE, newContent, 'utf-8');
}

async function main() {
  for (const size of SIZES) {
    let added = 0;
    let seedIdx = 0;
    const maxSeeds = 3000;
    while (added < PER_SIZE && seedIdx < maxSeeds) {
      const seed = `${BASE}-${size}-${seedIdx++}`;
      const puzzle = generatePuzzle({ size, seed, maxAttempts: 500 });
      if (!puzzle) continue;
      if (hasSingleLineTerritory(puzzle)) continue;

      const content = readFileSync(FILE, 'utf-8');
      const usedTitles = existingTitles(content);
      const diff = rateDifficulty(puzzle);
      const { difficulty: _d, score: _s, ...rest } = puzzle;
      const id = `nogiveaway-${size}x${size}-${String(added + 1).padStart(2, '0')}`;
      const title = nextUnusedTitle(usedTitles, diff);

      const entry: Puzzle = {
        ...rest,
        id,
        title,
        difficulty: diff,
        score: scorePuzzle(puzzle),
        generatorCmd: `generateNoGiveawayTest --base ${BASE} --sizes ${size}`,
      };
      appendPuzzle(entry);
      added++;
      process.stderr.write(`  ${id} "${title}" — ${diff} (score ${entry.score}, forcedOpening=${hasForcedOpening(entry)}) [seed idx ${seedIdx}]\n`);
    }
    if (added < PER_SIZE) {
      process.stderr.write(`  only found ${added}/${PER_SIZE} at size ${size} after ${seedIdx} seed attempts\n`);
    } else {
      process.stderr.write(`  done with size ${size}: ${added}/${PER_SIZE}\n`);
    }
  }
  process.stderr.write('\nAll sizes complete.\n');
}

main();
