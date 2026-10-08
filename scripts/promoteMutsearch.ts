/**
 * promoteMutsearch.ts
 *
 * Promotes a curated selection of confirmed-passing mutsearch-* puzzles from
 * the experimental pool into the real campaign (data/samplePuzzles.ts).
 *
 * Why the difficulty field gets overridden: every mutsearch-* puzzle uses
 * the hypothetical/contradiction-test technique, which engine/difficulty.ts's
 * rateDifficulty() deliberately auto-promotes straight to 'Archon'/'Unbound'
 * regardless of score — bypassing 'Eldritch' entirely. That's correct for
 * the puzzle's TRUE difficulty, but it also means none of these puzzles
 * belong to any sequential campaign region as generated (West Wall requires
 * exactly 'Eldritch'; 'Archon' only matches The Reply, which is
 * twin-watchers-only). Promotion here deliberately relabels the `difficulty`
 * field to the target region's own difficulty name — an intentional pacing
 * choice (these are harder than their region's usual puzzles, on purpose),
 * not a correctness claim. `score` is left untouched so sortPuzzlesForRegion
 * still places them near the end of their region's sequence.
 *
 * Usage: npx tsx scripts/promoteMutsearch.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle } from '../engine/boardTypes';
import { nextUnusedTitle } from './titlePool';

const EXP_FILE = join(process.cwd(), 'data', 'experimentalPuzzles.ts');
const SAMPLE_FILE = join(process.cwd(), 'data', 'samplePuzzles.ts');

interface PromotionRule {
  idPrefix: string;   // e.g. 'mutsearch-8x8-'
  targetDifficulty: Puzzle['difficulty'];
  count: number;       // how many to promote, highest score first (hardest of the batch)
}

const RULES: PromotionRule[] = [
  { idPrefix: 'mutsearch-8x8-', targetDifficulty: 'Eldritch', count: 14 },
  { idPrefix: 'mutsearch-9x9-', targetDifficulty: 'Eldritch', count: 10 },
  { idPrefix: 'mutsearch-6x6-', targetDifficulty: 'Occultist', count: 6 },
  { idPrefix: 'mutsearch-7x7-', targetDifficulty: 'High Priest', count: 6 },
];

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
    try {
      puzzles.push(JSON.parse(content.slice(start, end)));
    } catch { /* skip malformed */ }
  }
  return puzzles;
}

function ts() { return new Date().toISOString().slice(11, 19); }

async function main() {
  const expContent = readFileSync(EXP_FILE, 'utf-8');
  const allExperimental = parseAllPuzzles(expContent);

  const sampleContent = readFileSync(SAMPLE_FILE, 'utf-8');
  const usedTitles = new Set<string>();
  // Collect every title already used anywhere in samplePuzzles.ts (not just the pool list)
  const titleRe = /"title":"((?:[^"\\]|\\.)*)"/g;
  let tm;
  while ((tm = titleRe.exec(sampleContent)) !== null) {
    usedTitles.add(tm[1].replace(/\\"/g, '"'));
  }
  // Also avoid collisions with other experimental titles not being promoted
  const expTitleRe = /"title":"((?:[^"\\]|\\.)*)"/g;
  const expTitlesAll = new Set<string>();
  let etm;
  while ((etm = expTitleRe.exec(expContent)) !== null) {
    expTitlesAll.add(etm[1].replace(/\\"/g, '"'));
  }

  const promoted: Puzzle[] = [];
  const usedIds = new Set<string>();

  // Every candidate's seed is "<batchSeed>-shortlist-<i>" (see runExperiment.ts) —
  // all candidates sharing a batchSeed were mutated from the SAME single
  // starting board (confirmed: every batch run so far had restarts=0), so
  // they're structurally very similar to each other. Cap how many can come
  // from any one batch so the promoted set actually spans different boards,
  // not just different small mutations of one.
  function batchKeyOf(seed: string): string {
    const idx = seed.lastIndexOf('-shortlist-');
    return idx === -1 ? seed : seed.slice(0, idx);
  }
  const MAX_PER_BATCH = 4;

  for (const rule of RULES) {
    const candidates = allExperimental
      .filter(p => p.id.startsWith(rule.idPrefix))
      .sort((a, b) => b.score - a.score); // hardest first

    let takenForRule = 0;
    const takenPerBatch = new Map<string, number>();
    const batchesUsed = new Set<string>();
    for (const p of candidates) {
      if (takenForRule >= rule.count) break;
      const batchKey = batchKeyOf(p.seed);
      const soFar = takenPerBatch.get(batchKey) ?? 0;
      if (soFar >= MAX_PER_BATCH) continue;
      takenPerBatch.set(batchKey, soFar + 1);
      batchesUsed.add(batchKey);
      let title = p.title;
      if (usedTitles.has(title)) {
        // Pick a fresh unused title from the shared pool rather than collide
        title = nextUnusedTitle(usedTitles, rule.targetDifficulty);
      }
      usedTitles.add(title);

      const promotedId = `promoted-${p.id}`;
      if (usedIds.has(promotedId)) continue;
      usedIds.add(promotedId);

      promoted.push({
        ...p,
        id: promotedId,
        title,
        difficulty: rule.targetDifficulty,
        generatorCmd: `${p.generatorCmd ?? ''} (promoted to ${rule.targetDifficulty} for campaign placement)`,
      });
      takenForRule++;
    }
    console.log(`[${ts()}] ${rule.idPrefix}: promoted ${takenForRule}/${rule.count} requested (${candidates.length} candidates available) -> difficulty=${rule.targetDifficulty}`);
  }

  // Insert into samplePuzzles.ts's RAW_PUZZLES array (same append pattern used
  // throughout tonight's scripts, just targeting the real campaign file).
  const insertPoint = sampleContent.indexOf('\n];');
  const insertionText = promoted.map(p => ',\n' + JSON.stringify(p)).join('');
  const newContent =
    sampleContent.slice(0, insertPoint).replace(/,(\s*)$/, '$1') +
    insertionText +
    sampleContent.slice(insertPoint);
  writeFileSync(SAMPLE_FILE, newContent, 'utf-8');

  console.log(`\n[${ts()}] Promoted ${promoted.length} total puzzles into data/samplePuzzles.ts.`);
  for (const p of promoted) {
    console.log(`  ${p.id} "${p.title}" size=${p.size} difficulty=${p.difficulty} score=${p.score}`);
  }
}

main();
