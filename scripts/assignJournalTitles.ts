/**
 * assignJournalTitles.ts
 *
 * Renames every puzzle in the 5 sequential campaign regions (Landfall
 * through The West Wall) using that region's journal-grounded title bank
 * (journalTitles.ts), replacing the generic maritime-flavor titles (old
 * pipeline) and pool-assigned "II"/"III"-suffixed titles (promoted-*).
 *
 * Assignment order follows each region's actual play sequence
 * (sortPuzzlesForRegion, same ascending-by-score order the game itself
 * uses) so the bank's own escalating unease lines up with the puzzles'
 * escalating real difficulty.
 *
 * Scope: sequential initiate-mode regions only (Landfall, Survey, Lower
 * Level, Lantern Room, West Wall) — Keeper's Quarters (shattered-realms)
 * and The Reply (twin-watchers) are a separate follow-up, not touched here.
 *
 * Usage: npx tsx scripts/assignJournalTitles.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { REGIONS, getRegionPuzzles, sortPuzzlesForRegion } from '../data/regions';
import type { Puzzle } from '../engine/boardTypes';
import {
  LANDFALL_TITLES, SURVEY_TITLES, LOWER_LEVEL_TITLES, LANTERN_ROOM_TITLES, WEST_WALL_TITLES,
} from './journalTitles';
import { KEEPERS_QUARTERS_TITLES, REPLY_TITLES } from './journalTitlesExtended';

const FILE = join(process.cwd(), 'data', 'samplePuzzles.ts');

const BANKS: Record<string, string[]> = {
  'Landfall': LANDFALL_TITLES,
  'The Survey': SURVEY_TITLES,
  'The Lower Level': LOWER_LEVEL_TITLES,
  'The Lantern Room': LANTERN_ROOM_TITLES,
  'The West Wall': WEST_WALL_TITLES,
  'The Keeper’s Quarters': KEEPERS_QUARTERS_TITLES,
  'The Reply': REPLY_TITLES,
};

function parseAllPuzzles(content: string): Puzzle[] {
  const puzzles: Puzzle[] = [];
  const idxs: number[] = [];
  const re = /\{"id":/g;
  let m;
  while ((m = re.exec(content)) !== null) idxs.push(m.index);
  for (const start of idxs) {
    let depth = 0, end = start;
    for (let i = start; i < content.length; i++) {
      if (content[i] === '{') depth++;
      if (content[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    try { puzzles.push(JSON.parse(content.slice(start, end))); } catch { /* skip */ }
  }
  return puzzles;
}

async function main() {
  let content = readFileSync(FILE, 'utf-8');
  const allPuzzles = parseAllPuzzles(content);

  const renames = new Map<string, string>(); // id -> new title

  for (const region of REGIONS) {
    const bank = BANKS[region.name];
    if (!bank) continue; // skip shattered-realms / twin-watchers regions

    const pool = getRegionPuzzles(region, allPuzzles);
    const sorted = sortPuzzlesForRegion(pool, region.mode ?? 'initiate');

    if (sorted.length > bank.length) {
      console.log(`WARNING: ${region.name} has ${sorted.length} puzzles but only ${bank.length} titles in bank — ${sorted.length - bank.length} will be left unrenamed.`);
    }

    for (let i = 0; i < sorted.length && i < bank.length; i++) {
      renames.set(sorted[i].id, bank[i]);
    }
    console.log(`${region.name}: renaming ${Math.min(sorted.length, bank.length)}/${sorted.length} puzzles`);
  }

  // Apply renames via string replacement, scoped to each puzzle's own id so
  // we only ever touch that specific object's title field.
  let applied = 0;
  for (const [id, newTitle] of renames) {
    const idMarker = `"id":"${id}"`;
    const idx = content.indexOf(idMarker);
    if (idx === -1) continue;
    // Find the title field within this specific object (search forward from id, bounded by the object's closing brace)
    let depth = 0, objEnd = idx;
    const objStart = content.lastIndexOf('{', idx);
    for (let i = objStart; i < content.length; i++) {
      if (content[i] === '{') depth++;
      if (content[i] === '}') { depth--; if (depth === 0) { objEnd = i + 1; break; } }
    }
    const objText = content.slice(objStart, objEnd);
    const newObjText = objText.replace(/"title":"(?:[^"\\]|\\.)*"/, `"title":${JSON.stringify(newTitle)}`);
    if (newObjText === objText) { console.log(`  (no title field matched for ${id}, skipped)`); continue; }
    content = content.slice(0, objStart) + newObjText + content.slice(objEnd);
    applied++;
  }

  writeFileSync(FILE, content, 'utf-8');
  console.log(`\nApplied ${applied} renames.`);
}

main();
