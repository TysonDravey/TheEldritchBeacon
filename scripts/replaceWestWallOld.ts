/**
 * replaceWestWallOld.ts
 *
 * One-off: removes the 7 old blind-generated (non-mutation-search) 8x8/9x9
 * puzzles that had ended up placed in The West Wall campaign region, and
 * backfills them from the existing (already-validated, just unpromoted)
 * mutsearch-8x8- and mutsearch-9x9- pool in data/experimentalPuzzles.ts --
 * picking the HARDEST (highest-score) unpromoted candidates, per explicit
 * request ("harder the better"), one per distinct mutation-search batch
 * (same diversity cap promoteMutsearch.ts uses) so the 7 aren't just
 * near-duplicate mutations of a single starting board.
 *
 * Usage: npx tsx scripts/replaceWestWallOld.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle } from '../engine/boardTypes';
import { nextUnusedTitle } from './titlePool';

const EXP_FILE = join(process.cwd(), 'data', 'experimentalPuzzles.ts');
const SAMPLE_FILE = join(process.cwd(), 'data', 'samplePuzzles.ts');

const OLD_IDS_TO_REMOVE = [
  'eb-8x8-009', 'eb-8x8-014', 'eb-8x8-021', 'eb-8x8-039', 'eb-8x8-043', // 5x 8x8
  'eb-9x9-002', 'eb-9x9-022', // 2x 9x9
];
const NEED_8X8 = 5;
const NEED_9X9 = 2;
const MAX_PER_BATCH = 1; // force the 7 to span 7 different starting boards

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

function batchKeyOf(seed: string): string {
  const idx = seed.lastIndexOf('-shortlist-');
  return idx === -1 ? seed : seed.slice(0, idx);
}

function ts() { return new Date().toISOString().slice(11, 19); }

function main() {
  const expContent = readFileSync(EXP_FILE, 'utf-8');
  const allExperimental = parseAllPuzzles(expContent);

  let sampleContent = readFileSync(SAMPLE_FILE, 'utf-8');

  // Already-promoted mutsearch ids (so we never double-promote the same candidate).
  const promotedRe = /"id":"promoted-(mutsearch-(?:8x8|9x9)-\d+)"/g;
  const alreadyPromoted = new Set<string>();
  let pm;
  while ((pm = promotedRe.exec(sampleContent)) !== null) alreadyPromoted.add(pm[1]);

  const usedTitles = new Set<string>();
  const titleRe = /"title":"((?:[^"\\]|\\.)*)"/g;
  let tm;
  while ((tm = titleRe.exec(sampleContent)) !== null) usedTitles.add(tm[1].replace(/\\"/g, '"'));

  function pickHardest(prefix: string, count: number): Puzzle[] {
    const candidates = allExperimental
      .filter(p => p.id.startsWith(prefix) && !alreadyPromoted.has(p.id))
      .sort((a, b) => b.score - a.score);
    const picked: Puzzle[] = [];
    const takenPerBatch = new Map<string, number>();
    for (const p of candidates) {
      if (picked.length >= count) break;
      const batchKey = batchKeyOf(p.seed);
      const soFar = takenPerBatch.get(batchKey) ?? 0;
      if (soFar >= MAX_PER_BATCH) continue;
      takenPerBatch.set(batchKey, soFar + 1);
      picked.push(p);
    }
    return picked;
  }

  const picked8x8 = pickHardest('mutsearch-8x8-', NEED_8X8);
  const picked9x9 = pickHardest('mutsearch-9x9-', NEED_9X9);

  if (picked8x8.length < NEED_8X8 || picked9x9.length < NEED_9X9) {
    console.error(`[${ts()}] Not enough unpromoted candidates: got ${picked8x8.length}/${NEED_8X8} 8x8, ${picked9x9.length}/${NEED_9X9} 9x9. Aborting without writing.`);
    process.exit(1);
  }

  const replacements: Puzzle[] = [...picked8x8, ...picked9x9].map(p => {
    let title = p.title;
    if (usedTitles.has(title)) title = nextUnusedTitle(usedTitles, 'Eldritch');
    usedTitles.add(title);
    return {
      ...p,
      id: `promoted-${p.id}`,
      title,
      difficulty: 'Eldritch',
      generatorCmd: `${p.generatorCmd ?? ''} (promoted to Eldritch, replacing old blind-generated West Wall puzzle)`,
    } as Puzzle;
  });

  // 1. Remove the 7 old puzzles from samplePuzzles.ts.
  for (const id of OLD_IDS_TO_REMOVE) {
    const marker = `"id":"${id}"`;
    const start = sampleContent.indexOf(marker);
    if (start === -1) { console.error(`[${ts()}] Could not find ${id} to remove -- skipping.`); continue; }
    // Walk backward to the entry's opening '{', forward to its matching '}'.
    let objStart = sampleContent.lastIndexOf('{', start);
    let depth = 0, objEnd = objStart;
    for (let i = objStart; i < sampleContent.length; i++) {
      if (sampleContent[i] === '{') depth++;
      if (sampleContent[i] === '}') { depth--; if (depth === 0) { objEnd = i + 1; break; } }
    }
    // Consume a trailing comma+whitespace, or a leading comma+whitespace if this was the last entry.
    let removeStart = objStart, removeEnd = objEnd;
    if (sampleContent.slice(removeEnd).match(/^\s*,/)) {
      removeEnd += sampleContent.slice(removeEnd).match(/^\s*,/)![0].length;
    } else if (sampleContent.slice(0, removeStart).match(/,\s*$/)) {
      const lead = sampleContent.slice(0, removeStart).match(/,\s*$/)![0];
      removeStart -= lead.length;
    }
    sampleContent = sampleContent.slice(0, removeStart) + sampleContent.slice(removeEnd);
    console.log(`[${ts()}] Removed ${id}`);
  }

  // 2. Insert the 7 replacements.
  const insertPoint = sampleContent.indexOf('\n];');
  const insertionText = replacements.map(p => ',\n' + JSON.stringify(p)).join('');
  sampleContent =
    sampleContent.slice(0, insertPoint).replace(/,(\s*)$/, '$1') +
    insertionText +
    sampleContent.slice(insertPoint);

  writeFileSync(SAMPLE_FILE, sampleContent, 'utf-8');

  console.log(`\n[${ts()}] Replaced ${OLD_IDS_TO_REMOVE.length} old West Wall puzzles with ${replacements.length} mutation-search puzzles:`);
  for (const p of replacements) {
    console.log(`  ${p.id} "${p.title}" size=${p.size} score=${p.score}`);
  }
}

main();
