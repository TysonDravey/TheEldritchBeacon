/**
 * replaceNeitherPuzzles.ts
 *
 * The user's "boring" complaint traced to 90 "eb-*" (original base-batch)
 * puzzles across The Survey/The Lower Level/The Lantern Room that use ZERO
 * hypothetical/mutual-exclusion reasoning at all — pure mechanical cleanup.
 * This removes those specific puzzles and replaces them 1:1 from the large
 * existing unpromoted mutsearch-* pool in data/experimentalPuzzles.ts
 * (already-verified-good material sitting unused, no new generation needed),
 * screened the same way as buildRamp.ts (grind ceiling + zero-event floor),
 * matched to each region's score band, with the same MAX_PICKS_PER_BATCH=2
 * anti-clustering guard.
 *
 * Usage: npx tsx scripts/replaceNeitherPuzzles.ts
 */
import { getNextDeduction } from '../engine/solver';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle, CellState, Difficulty } from '../engine/boardTypes';
import { nextUnusedTitle } from './titlePool';
import { REGIONS, getRegionPuzzles } from '../data/regions';

const EXP_FILE = join(process.cwd(), 'data', 'experimentalPuzzles.ts');
const SAMPLE_FILE = join(process.cwd(), 'data', 'samplePuzzles.ts');

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
    try { puzzles.push(JSON.parse(content.slice(start, end))); } catch {}
  }
  return puzzles;
}

function analyze(p: Puzzle) {
  const n = p.size;
  const cells: CellState[][] = Array.from({ length: n }, () => Array(n).fill('empty'));
  let total = 0;
  const eventSteps: number[] = [];
  let meCount = 0;
  let guard = 0;
  while (guard++ < 2000) {
    const d = getNextDeduction(p, cells, 0);
    if (!d) break;
    total++;
    if (d.reasonType === 'hypothetical' || d.reasonType === 'mutual-exclusion') eventSteps.push(total);
    if (d.reasonType === 'mutual-exclusion') meCount++;
    cells[d.row][d.col] = d.type === 'watcher' ? 'watcher' : 'ward';
    if (d.type === 'watcher') {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = d.row + dr, nc = d.col + dc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n && cells[nr][nc] === 'empty') cells[nr][nc] = 'ward';
      }
      for (let c = 0; c < n; c++) if (c !== d.col && cells[d.row][c] === 'empty') cells[d.row][c] = 'ward';
      for (let r = 0; r < n; r++) if (r !== d.row && cells[r][d.col] === 'empty') cells[r][d.col] = 'ward';
    }
  }
  let longestRun = eventSteps.length > 0 ? 1 : 0, currentRun = 1;
  for (let i = 1; i < eventSteps.length; i++) {
    if (eventSteps[i] - eventSteps[i - 1] === 1) currentRun++;
    else currentRun = 1;
    longestRun = Math.max(longestRun, currentRun);
  }
  return { longestRun, eventCount: eventSteps.length, meCount, hasDeep: eventSteps.length > 0 };
}

function ts() { return new Date().toISOString().slice(11, 19); }

interface TargetRegion {
  name: string;
  difficulty: Difficulty;
  minScore: number;
  maxScore: number;
}
const TARGETS: TargetRegion[] = [
  { name: 'The Survey', difficulty: 'Scholar', minScore: 10, maxScore: 66 },
  { name: 'The Lower Level', difficulty: 'Occultist', minScore: 20, maxScore: 128 },
  { name: 'The Lantern Room', difficulty: 'High Priest', minScore: 32, maxScore: 148 },
];

async function main() {
  const sampleContent = readFileSync(SAMPLE_FILE, 'utf-8');
  const samplePuzzles = parseAllPuzzles(sampleContent);
  const bySampleId = new Map(samplePuzzles.map(p => [p.id, p]));

  // Identify the exact "neither" ids to remove, per target region, using the
  // SAME region-membership logic the game itself uses (getRegionPuzzles).
  const idsToRemove = new Map<string, TargetRegion>(); // id -> region
  for (const target of TARGETS) {
    const region = REGIONS.find(r => r.name === target.name)!;
    const active = getRegionPuzzles(region, samplePuzzles);
    for (const p of active) {
      const a = analyze(p);
      if (!a.hasDeep) idsToRemove.set(p.id, target);
    }
  }
  console.log(`[${ts()}] Found ${idsToRemove.size} "neither" puzzles to remove across ${TARGETS.length} regions.`);

  // Build the replacement candidate pool from unpromoted mutsearch-* puzzles.
  const expContent = readFileSync(EXP_FILE, 'utf-8');
  const allExp = parseAllPuzzles(expContent).filter(p => p.id.startsWith('mutsearch-'));
  const alreadyPromoted = new Set<string>();
  const idRe = /"id":"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = idRe.exec(sampleContent)) !== null) {
    if (m[1].startsWith('promoted-')) alreadyPromoted.add(m[1].replace('promoted-', ''));
  }

  const clean: { p: Puzzle; meCount: number }[] = [];
  for (const p of allExp) {
    if (alreadyPromoted.has(p.id)) continue;
    const a = analyze(p);
    if (a.longestRun >= 4 || a.eventCount >= 8) continue;
    if (a.eventCount < 1) continue;
    clean.push({ p, meCount: a.meCount });
  }
  console.log(`[${ts()}] ${clean.length} clean unpromoted mutsearch candidates available.\n`);

  const usedTitles = new Set<string>();
  const titleRe = /"title":"((?:[^"\\]|\\.)*)"/g;
  let tm;
  while ((tm = titleRe.exec(sampleContent)) !== null) usedTitles.add(tm[1].replace(/\\"/g, '"'));

  const usedIdsThisRun = new Set<string>();
  const MAX_PICKS_PER_BATCH = 2;
  const allPromoted: Puzzle[] = [];

  for (const target of TARGETS) {
    const removeCount = [...idsToRemove.values()].filter(t => t.name === target.name).length;
    const pool = clean
      .filter(({ p }) => p.score >= target.minScore && p.score <= target.maxScore && !usedIdsThisRun.has(p.id))
      .sort((a, b) => a.p.score - b.p.score);

    const batchCounts = new Map<string, number>();
    const picks: typeof pool = [];
    const n = Math.min(removeCount, pool.length);
    let idx = 0;
    while (picks.length < n && idx < pool.length * 3) {
      const candidateIdx = Math.round((picks.length * (pool.length - 1)) / Math.max(1, n - 1));
      let chosen: typeof pool[number] | null = null;
      for (let d = 0; d < pool.length; d++) {
        for (const probe of [candidateIdx + d, candidateIdx - d]) {
          const cand = pool[probe];
          if (!cand || picks.includes(cand)) continue;
          const batchKey = (cand.p.seed ?? '').split('-shortlist-')[0];
          if ((batchCounts.get(batchKey) ?? 0) >= MAX_PICKS_PER_BATCH) continue;
          chosen = cand;
          break;
        }
        if (chosen) break;
      }
      if (!chosen) break;
      const batchKey = (chosen.p.seed ?? '').split('-shortlist-')[0];
      batchCounts.set(batchKey, (batchCounts.get(batchKey) ?? 0) + 1);
      picks.push(chosen);
      idx++;
    }

    console.log(`[${ts()}] ${target.name}: removing ${removeCount}, replacing with ${picks.length}/${removeCount} (${picks.filter(p => p.meCount > 0).length} use mutual-exclusion)`);
    for (const { p } of picks) {
      usedIdsThisRun.add(p.id);
      let title = p.title;
      if (usedTitles.has(title)) title = nextUnusedTitle(usedTitles, target.difficulty);
      usedTitles.add(title);
      const promotedId = `promoted-${p.id}`;
      allPromoted.push({
        ...p,
        id: promotedId,
        title,
        difficulty: target.difficulty,
        generatorCmd: `${p.generatorCmd ?? ''} (replaceNeitherPuzzles: promoted to ${target.difficulty}, replacing a zero-deep-technique puzzle)`,
      });
    }
  }

  // Remove the "neither" puzzle lines from samplePuzzles.ts (one JSON object
  // per line in this file, so a line-based removal is safe and simple).
  const lines = sampleContent.split('\n');
  const removedIds = new Set(idsToRemove.keys());
  const keptLines = lines.filter(line => {
    const idMatch = line.match(/^\{"id":"((?:[^"\\]|\\.)*)"/);
    return !(idMatch && removedIds.has(idMatch[1]));
  });
  let newContent = keptLines.join('\n');

  const insertPoint = newContent.indexOf('\n];');
  const insertionText = allPromoted.map(p => ',\n' + JSON.stringify(p)).join('');
  newContent =
    newContent.slice(0, insertPoint).replace(/,(\s*)$/, '$1') +
    insertionText +
    newContent.slice(insertPoint);

  writeFileSync(SAMPLE_FILE, newContent, 'utf-8');
  console.log(`\n[${ts()}] Removed ${removedIds.size} puzzles, promoted ${allPromoted.length} replacements into data/samplePuzzles.ts.`);
}

main();
