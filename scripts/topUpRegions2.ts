/**
 * topUpRegions2.ts
 *
 * Follow-up to dedupeBatchClustering.ts: that pass trimmed every region
 * down to the max-2-per-batch cap and backfilled from whatever unpromoted
 * mutsearch-* material existed at the time, but ran short (Survey 0/13,
 * Lower Level 2/23, Lantern Room 10/19, West Wall 15/18). A fresh set of
 * 13 generation batches (refill2-*) was run specifically to cover this.
 * This tops each region back up toward its PRE-DEDUPE count using that new
 * material, enforcing the batch cap against each region's FULL CURRENT
 * state (not a run-local counter) so it can't reintroduce the same bug.
 *
 * Usage: npx tsx scripts/topUpRegions2.ts
 */
import { getNextDeduction } from '../engine/solver';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle, CellState, Difficulty } from '../engine/boardTypes';
import { nextUnusedTitle } from './titlePool';
import { REGIONS, getRegionPuzzles } from '../data/regions';

const EXP_FILE = join(process.cwd(), 'data', 'experimentalPuzzles.ts');
const SAMPLE_FILE = join(process.cwd(), 'data', 'samplePuzzles.ts');
const MAX_PICKS_PER_BATCH = 2;

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

function batchKey(seed: string | undefined, id: string): string {
  if (!seed) return `noseed-${id}`;
  return seed.includes('-shortlist-') ? seed.split('-shortlist-')[0] : `noshortlist-${seed}`;
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
  return { longestRun, eventCount: eventSteps.length, meCount };
}

function ts() { return new Date().toISOString().slice(11, 19); }

interface TargetRegion { name: string; difficulty: Difficulty; minScore: number; maxScore: number; topUpCount: number; }
const TARGETS: TargetRegion[] = [
  { name: 'The Survey', difficulty: 'Scholar', minScore: 10, maxScore: 66, topUpCount: 13 },
  { name: 'The Lower Level', difficulty: 'Occultist', minScore: 20, maxScore: 128, topUpCount: 21 },
  { name: 'The Lantern Room', difficulty: 'High Priest', minScore: 32, maxScore: 148, topUpCount: 9 },
  { name: 'The West Wall', difficulty: 'Eldritch', minScore: 40, maxScore: 189, topUpCount: 3 },
];

async function main() {
  const sampleContent = readFileSync(SAMPLE_FILE, 'utf-8');
  const samplePuzzles = parseAllPuzzles(sampleContent);

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
  console.log(`[${ts()}] ${clean.length} clean unpromoted candidates available.\n`);

  const usedTitles = new Set<string>();
  const titleRe = /"title":"((?:[^"\\]|\\.)*)"/g;
  let tm;
  while ((tm = titleRe.exec(sampleContent)) !== null) usedTitles.add(tm[1].replace(/\\"/g, '"'));

  const usedIdsThisRun = new Set<string>();
  const allPromoted: Puzzle[] = [];

  for (const target of TARGETS) {
    const region = REGIONS.find(r => r.name === target.name)!;
    const active = getRegionPuzzles(region, samplePuzzles);
    const counts = new Map<string, number>();
    for (const p of active) {
      const k = batchKey(p.seed, p.id);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }

    const pool = clean
      .filter(({ p }) => p.score >= target.minScore && p.score <= target.maxScore && !usedIdsThisRun.has(p.id))
      .sort((a, b) => a.p.score - b.p.score);

    const picks: typeof pool = [];
    const n = Math.min(target.topUpCount, pool.length);
    let idx = 0;
    while (picks.length < n && idx < pool.length * 3) {
      const candidateIdx = Math.round((picks.length * (pool.length - 1)) / Math.max(1, n - 1));
      let chosen: typeof pool[number] | null = null;
      for (let d = 0; d < pool.length; d++) {
        for (const probe of [candidateIdx + d, candidateIdx - d]) {
          const cand = pool[probe];
          if (!cand || picks.includes(cand)) continue;
          const bk = batchKey(cand.p.seed, cand.p.id);
          if ((counts.get(bk) ?? 0) >= MAX_PICKS_PER_BATCH) continue;
          chosen = cand;
          break;
        }
        if (chosen) break;
      }
      if (!chosen) break;
      const bk = batchKey(chosen.p.seed, chosen.p.id);
      counts.set(bk, (counts.get(bk) ?? 0) + 1);
      picks.push(chosen);
      idx++;
    }

    console.log(`[${ts()}] ${target.name}: topping up ${picks.length}/${target.topUpCount} (${picks.filter(p => p.meCount > 0).length} use mutual-exclusion)`);
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
        generatorCmd: `${p.generatorCmd ?? ''} (topUpRegions2: promoted to ${target.difficulty})`,
      });
    }
  }

  const insertPoint = sampleContent.indexOf('\n];');
  const insertionText = allPromoted.map(p => ',\n' + JSON.stringify(p)).join('');
  const newContent =
    sampleContent.slice(0, insertPoint).replace(/,(\s*)$/, '$1') +
    insertionText +
    sampleContent.slice(insertPoint);
  writeFileSync(SAMPLE_FILE, newContent, 'utf-8');
  console.log(`\n[${ts()}] Promoted ${allPromoted.length} top-up puzzles.`);
}

main();
