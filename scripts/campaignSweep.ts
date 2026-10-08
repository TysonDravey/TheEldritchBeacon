/**
 * campaignSweep.ts
 *
 * Full campaign audit: for every sequential region (Landfall -> Survey ->
 * Lower Level -> Lantern Room -> West Wall), profile every puzzle's actual
 * solve character (trivial%, hypothetical/mutual-exclusion usage) and its
 * position in the region's play ORDER (sortPuzzlesForRegion sorts by score
 * ascending, so this is literally the sequence a player experiences).
 * Flags: regions with no difficulty variation at all, and large score gaps
 * within a region's sequence (a sudden spike with nothing building up to it).
 *
 * Usage: npx tsx scripts/campaignSweep.ts
 */

import { getNextDeduction } from '../engine/solver';
import { REGIONS, getRegionPuzzles, sortPuzzlesForRegion } from '../data/regions';
import { SAMPLE_PUZZLES } from '../data/samplePuzzles';
import type { Puzzle, CellState } from '../engine/boardTypes';

const TRIVIAL = new Set([
  'adjacency', 'row-occupied', 'col-occupied', 'territory-occupied',
  'naked-single-territory', 'naked-single-row', 'naked-single-col',
  'row-confinement', 'col-confinement',
]);

function analyze(p: Puzzle) {
  const n = p.size;
  const cells: CellState[][] = Array.from({ length: n }, () => Array(n).fill('empty'));
  let total = 0, trivial = 0, hypothetical = 0, me = 0;
  let guard = 0;
  while (guard++ < 2000) {
    const d = getNextDeduction(p, cells, 0);
    if (!d) break;
    total++;
    if (TRIVIAL.has(d.reasonType ?? '')) trivial++;
    if (d.reasonType === 'hypothetical') hypothetical++;
    if (d.reasonType === 'mutual-exclusion') me++;
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
  return { total, trivial, hypothetical, me };
}

const SEQUENTIAL_DIFFICULTIES = new Set(['Initiate', 'Scholar', 'Occultist', 'High Priest', 'Eldritch']);

for (const region of REGIONS) {
  if (region.mode && region.mode !== 'initiate') continue; // sequential, same-ruleset regions only
  if (!SEQUENTIAL_DIFFICULTIES.has(region.difficulty) && !region.difficultyPool) continue;

  const pool = getRegionPuzzles(region, SAMPLE_PUZZLES);
  const sorted = sortPuzzlesForRegion(pool, region.mode ?? 'initiate');

  console.log(`\n${'='.repeat(70)}`);
  console.log(`${region.name} (${region.difficulty}) — ${sorted.length} puzzles`);
  console.log('='.repeat(70));

  let prevScore = -1;
  let deepCount = 0;
  const profiles: { p: Puzzle; a: ReturnType<typeof analyze> }[] = [];

  for (const p of sorted) {
    const a = analyze(p);
    profiles.push({ p, a });
    if (a.hypothetical + a.me > 0) deepCount++;
  }

  const FULL = process.env.FULL === '1';
  const SHOW_EVERY = FULL ? 1 : (sorted.length > 20 ? Math.ceil(sorted.length / 20) : 1);
  for (let i = 0; i < profiles.length; i++) {
    const { p, a } = profiles[i];
    const ratio = a.total > 0 ? (a.trivial / a.total * 100).toFixed(0) : '?';
    const gap = prevScore >= 0 ? p.score - prevScore : 0;
    const flag = gap > 15 ? `  <-- GAP +${gap.toFixed(1)}` : '';
    if (i % SHOW_EVERY === 0 || gap > 15 || i === profiles.length - 1) {
      console.log(`  #${String(i + 1).padStart(3)} ${p.id.padEnd(26)} ${p.size}x${p.size}  score=${String(p.score).padStart(6)}  trivial=${ratio}%  hyp=${a.hypothetical} me=${a.me}${flag}`);
    }
    prevScore = p.score;
  }

  const scores = profiles.map(x => x.p.score);
  const sizes = [...new Set(profiles.map(x => x.p.size))].sort((a, b) => a - b);
  console.log(`\n  Summary: score range ${Math.min(...scores)}-${Math.max(...scores)}, sizes [${sizes.join(',')}], ${deepCount}/${sorted.length} puzzles use hypothetical/ME at all`);
}
