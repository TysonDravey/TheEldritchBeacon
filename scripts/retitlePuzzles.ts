/**
 * retitlePuzzles.ts
 *
 * Reads data/samplePuzzles.ts, and assigns each puzzle a tier-appropriate
 * title based on its stored difficulty (Tier 1 for Initiate/Scholar, Tier 2
 * for Occultist/High Priest, Tier 3 for Eldritch/Harbinger, Tier 4 for Archon).
 *
 * Puzzles are processed in ID-alphabetical order within each difficulty group
 * so that assignments are stable and reproducible on re-runs.
 *
 * Special case: eb-8x8-001 is always titled "The Eldritch Beacon".
 *
 * Usage:
 *   npx tsx scripts/retitlePuzzles.ts
 */

import './loadEnv';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { SAMPLE_PUZZLES } from '../data/samplePuzzles';
import { nextUnusedTitle } from './titlePool';
import type { Difficulty } from '../engine/boardTypes';

const PROTECTED: Record<string, string> = {
  'eb-8x8-001': 'The Eldritch Beacon',
};

const filePath = join(process.cwd(), 'data', 'samplePuzzles.ts');
let content = readFileSync(filePath, 'utf-8');

// Group puzzles by difficulty, sort by ID within each group
const byDiff = new Map<Difficulty, typeof SAMPLE_PUZZLES>();
for (const p of SAMPLE_PUZZLES) {
  if (!byDiff.has(p.difficulty)) byDiff.set(p.difficulty, []);
  byDiff.get(p.difficulty)!.push(p);
}
for (const arr of byDiff.values()) arr.sort((a, b) => a.id.localeCompare(b.id));

const used = new Set<string>(Object.values(PROTECTED));
const assignments = new Map<string, string>();

// Assign protected titles first
for (const [id, title] of Object.entries(PROTECTED)) {
  assignments.set(id, title);
}

// Assign tier titles for each difficulty group
for (const [difficulty, puzzles] of byDiff) {
  for (const p of puzzles) {
    if (assignments.has(p.id)) continue;
    const title = nextUnusedTitle(used, difficulty);
    used.add(title);
    assignments.set(p.id, title);
  }
}

// Apply replacements
let modified = content;
for (const [id, newTitle] of assignments) {
  // Find the current title for this puzzle
  const idMatch = content.match(new RegExp(`"id":"${id}","title":"((?:[^"\\\\]|\\\\.)*)"`));
  if (!idMatch) {
    process.stderr.write(`WARNING: could not find id ${id}\n`);
    continue;
  }
  const oldTitle = idMatch[1];
  if (oldTitle === newTitle) continue;

  // Replace the specific occurrence
  modified = modified.replace(
    `"id":"${id}","title":"${oldTitle}"`,
    `"id":"${id}","title":"${newTitle.replace(/"/g, '\\"')}"`,
  );
  process.stderr.write(`  ${id}: "${oldTitle}" → "${newTitle}"\n`);
}

writeFileSync(filePath, modified, 'utf-8');
process.stderr.write(`\nDone. ${assignments.size} puzzles processed.\n`);
