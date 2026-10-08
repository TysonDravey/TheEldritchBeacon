/**
 * buildRamp.ts
 *
 * Fills the actual difficulty gaps identified by campaignSweep.ts, using the
 * clean (non-grind) candidate pool from harvestForRamp.ts. For each region,
 * picks N candidates evenly spaced by score across a target band (so
 * coverage is smooth, not clustered), favoring size/generator diversity so
 * the picks don't all look like the same puzzle repeated. Difficulty field
 * is set to the target region's own name on promotion (same deliberate
 * pacing-override as promoteMutsearch.ts).
 *
 * Usage: npx tsx scripts/buildRamp.ts
 */

import { getNextDeduction } from '../engine/solver';
import { rateDifficulty } from '../engine/difficulty';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle, CellState, Difficulty } from '../engine/boardTypes';
import { nextUnusedTitle } from './titlePool';

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
    try { puzzles.push(JSON.parse(content.slice(start, end))); } catch { /* skip */ }
  }
  return puzzles;
}

function analyze(p: Puzzle) {
  const n = p.size;
  const cells: CellState[][] = Array.from({ length: n }, () => Array(n).fill('empty'));
  let total = 0;
  const eventSteps: number[] = [];
  let guard = 0;
  while (guard++ < 2000) {
    const d = getNextDeduction(p, cells, 0);
    if (!d) break;
    total++;
    if (d.reasonType === 'hypothetical' || d.reasonType === 'mutual-exclusion') eventSteps.push(total);
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
  return { longestRun, eventCount: eventSteps.length };
}

function generatorPrefix(p: Puzzle): string {
  return p.id.replace(/-?\d+$/, '');
}

interface RampTarget {
  name: string;
  difficulty: Difficulty;
  minScore: number;
  maxScore: number;
  count: number;
}

// Round 2 bands, targeted at the specific gaps left after the scoring
// revamp (engine/difficulty.ts) changed every puzzle's score — see
// scripts/campaignSweep.ts's GAP flags for the exact jumps these close.
const TARGETS: RampTarget[] = [
  { name: 'The Survey', difficulty: 'Scholar', minScore: 25, maxScore: 65, count: 6 },
  { name: 'The Lower Level', difficulty: 'Occultist', minScore: 50, maxScore: 125, count: 8 },
  { name: 'The Lantern Room', difficulty: 'High Priest', minScore: 65, maxScore: 145, count: 8 },
  { name: 'The West Wall', difficulty: 'Eldritch', minScore: 80, maxScore: 188, count: 6 },
];

function ts() { return new Date().toISOString().slice(11, 19); }

async function main() {
  const expContent = readFileSync(EXP_FILE, 'utf-8');
  const all = parseAllPuzzles(expContent);

  let sampleContent = readFileSync(SAMPLE_FILE, 'utf-8');
  const alreadyPromoted = new Set<string>();
  const idRe = /"id":"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = idRe.exec(sampleContent)) !== null) {
    if (m[1].startsWith('promoted-')) alreadyPromoted.add(m[1].replace('promoted-', ''));
  }

  console.log(`[${ts()}] Screening ${all.length} candidates for grind pattern...`);
  const clean: { p: Puzzle; eventCount: number }[] = [];
  for (const p of all) {
    if (alreadyPromoted.has(p.id)) continue;
    const a = analyze(p);
    if (a.longestRun >= 4 || a.eventCount >= 8) continue;
    clean.push({ p, eventCount: a.eventCount });
  }
  console.log(`[${ts()}] ${clean.length} clean candidates available.\n`);

  const usedTitles = new Set<string>();
  const titleRe = /"title":"((?:[^"\\]|\\.)*)"/g;
  let tm;
  while ((tm = titleRe.exec(sampleContent)) !== null) usedTitles.add(tm[1].replace(/\\"/g, '"'));

  const usedIdsThisRun = new Set<string>();
  const allPromoted: Puzzle[] = [];

  for (const target of TARGETS) {
    const pool = clean
      .filter(({ p }) => p.score >= target.minScore && p.score <= target.maxScore && !usedIdsThisRun.has(p.id))
      .sort((a, b) => a.p.score - b.p.score);

    if (pool.length === 0) {
      console.log(`[${ts()}] ${target.name}: no candidates in band [${target.minScore}-${target.maxScore}]`);
      continue;
    }

    // Evenly spaced indices across the sorted-by-score pool, with a light
    // diversity pass: skip a pick if it shares a generator prefix with
    // either of the previous 2 picks and an alternative is available nearby.
    const picks: typeof pool = [];
    const n = Math.min(target.count, pool.length);
    for (let i = 0; i < n; i++) {
      let idx = Math.round((i * (pool.length - 1)) / Math.max(1, n - 1));
      const recentPrefixes = picks.slice(-2).map(({ p }) => generatorPrefix(p));
      if (recentPrefixes.includes(generatorPrefix(pool[idx].p))) {
        // look for a nearby alternative with a different prefix
        for (let d = 1; d < 8; d++) {
          const alt = pool[idx + d] ?? pool[idx - d];
          if (alt && !recentPrefixes.includes(generatorPrefix(alt.p)) && !picks.includes(alt)) {
            idx = pool.indexOf(alt);
            break;
          }
        }
      }
      if (!picks.includes(pool[idx])) picks.push(pool[idx]);
    }

    console.log(`[${ts()}] ${target.name}: picked ${picks.length}/${target.count} from ${pool.length} candidates in band`);
    for (const { p } of picks) {
      usedIdsThisRun.add(p.id);
      let title = p.title;
      if (usedTitles.has(title)) title = nextUnusedTitle(usedTitles, target.difficulty);
      usedTitles.add(title);

      const promotedId = `promoted-${p.id}`;
      const entry: Puzzle = {
        ...p,
        id: promotedId,
        title,
        difficulty: target.difficulty,
        generatorCmd: `${p.generatorCmd ?? ''} (buildRamp: promoted to ${target.difficulty}, band ${target.minScore}-${target.maxScore})`,
      };
      allPromoted.push(entry);
      console.log(`    ${promotedId}  score=${p.score}  "${title}"`);
    }
  }

  const insertPoint = sampleContent.indexOf('\n];');
  const insertionText = allPromoted.map(p => ',\n' + JSON.stringify(p)).join('');
  const newContent =
    sampleContent.slice(0, insertPoint).replace(/,(\s*)$/, '$1') +
    insertionText +
    sampleContent.slice(insertPoint);
  writeFileSync(SAMPLE_FILE, newContent, 'utf-8');

  console.log(`\n[${ts()}] Promoted ${allPromoted.length} puzzles total into data/samplePuzzles.ts.`);
}

main();
