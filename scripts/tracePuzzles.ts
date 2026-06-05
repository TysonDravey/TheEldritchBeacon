/**
 * tracePuzzles.ts
 *
 * Runs the logical solver on every puzzle in samplePuzzles.ts and prints a
 * technique-frequency breakdown grouped by board size. Use this to understand
 * which deduction techniques actually fire — and at what rate — for each size.
 *
 * Usage:
 *   npx tsx scripts/tracePuzzles.ts
 *   npx tsx scripts/tracePuzzles.ts --detail    # also print per-puzzle rows
 *   npx tsx scripts/tracePuzzles.ts --size 10   # only show one size
 */

import { SAMPLE_PUZZLES } from '../data/samplePuzzles';
import { solveWithTrace } from '../engine/solver';
import type { DeductionReasonType } from '../engine/boardTypes';

const showDetail = process.argv.includes('--detail');
const sizeFilter = (() => {
  const idx = process.argv.indexOf('--size');
  return idx !== -1 ? parseInt(process.argv[idx + 1]) : null;
})();

// ---------------------------------------------------------------------------
// Bucketing
// ---------------------------------------------------------------------------

type Bucket = {
  cleanup: number;   // adjacency + row/col/territory-occupied (automatic ward sweep)
  naked: number;     // naked-single-territory / row / col
  confine: number;   // row-confinement + col-confinement
  dual: number;      // dual-confinement
  pair: number;      // pair-row + pair-col
  tde: number;       // territory-dead-end
  hidset: number;    // hidden-set-row + hidden-set-col
  hypo: number;      // hypothetical (contradiction test)
  unknown: number;   // anything not yet categorised
  total: number;
};

function emptyBucket(): Bucket {
  return { cleanup: 0, naked: 0, confine: 0, dual: 0, pair: 0, tde: 0, hidset: 0, hypo: 0, unknown: 0, total: 0 };
}

function classify(rt: DeductionReasonType | undefined): keyof Bucket {
  if (!rt) return 'unknown';
  if (rt === 'adjacency' || rt === 'row-occupied' || rt === 'col-occupied' || rt === 'territory-occupied') return 'cleanup';
  if (rt === 'naked-single-territory' || rt === 'naked-single-row' || rt === 'naked-single-col') return 'naked';
  if (rt === 'row-confinement' || rt === 'col-confinement') return 'confine';
  if (rt === 'dual-confinement') return 'dual';
  if (rt === 'pair-row' || rt === 'pair-col') return 'pair';
  if (rt === 'territory-dead-end') return 'tde';
  if (rt === 'hidden-set-row' || rt === 'hidden-set-col') return 'hidset';
  if (rt === 'hypothetical') return 'hypo';
  return 'unknown';
}

function addStep(b: Bucket, rt: DeductionReasonType | undefined): void {
  b[classify(rt)]++;
  b.total++;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

type PuzzleRow = {
  id: string;
  title: string;
  difficulty: string;
  solved: boolean;
  bucket: Bucket;
};

const bySize = new Map<number, PuzzleRow[]>();

for (const puzzle of SAMPLE_PUZZLES) {
  if (sizeFilter !== null && puzzle.size !== sizeFilter) continue;

  const { solved, steps } = solveWithTrace(puzzle);
  const b = emptyBucket();
  for (const s of steps) addStep(b, s.reasonType);

  const row: PuzzleRow = { id: puzzle.id, title: puzzle.title, difficulty: puzzle.difficulty, solved, bucket: b };
  if (!bySize.has(puzzle.size)) bySize.set(puzzle.size, []);
  bySize.get(puzzle.size)!.push(row);
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const COL_W = 7;
const pad = (v: number | string, w = COL_W) => String(v).padStart(w);
const fmt = (n: number) => n === 0 ? '     -' : pad(n.toFixed(1));
const hdr = (s: string, w = COL_W) => s.padStart(w);

const HEADER =
  `${'puzzle'.padEnd(24)} ${'diff'.padEnd(11)} ${'steps'.padStart(5)} │` +
  `${hdr('clean')} ${hdr('naked')} ${hdr('cnfine')} ${hdr('dual')} ${hdr('pair')} ${hdr('tde')} ${hdr('hidset')} ${hdr('hypo')}`;

const SEP = '─'.repeat(HEADER.length);
const DBL = '═'.repeat(HEADER.length);

function avgRow(rows: PuzzleRow[]): string {
  const n = rows.length;
  const sum = (k: keyof Bucket) => rows.reduce((a, r) => a + r.bucket[k], 0);
  const avg = (k: keyof Bucket) => sum(k) / n;
  return (
    `${'avg'.padEnd(24)} ${''.padEnd(11)} ${pad(avg('total').toFixed(1), 5)} │` +
    `${fmt(avg('cleanup'))} ${fmt(avg('naked'))} ${fmt(avg('confine'))} ${fmt(avg('dual'))} ${fmt(avg('pair'))} ${fmt(avg('tde'))} ${fmt(avg('hidset'))} ${fmt(avg('hypo'))}`
  );
}

function detailRow(r: PuzzleRow): string {
  const b = r.bucket;
  const mark = r.solved ? '' : ' ✗STUCK';
  return (
    `${(r.id + mark).padEnd(24)} ${r.difficulty.padEnd(11)} ${pad(b.total, 5)} │` +
    `${fmt(b.cleanup)} ${fmt(b.naked)} ${fmt(b.confine)} ${fmt(b.dual)} ${fmt(b.pair)} ${fmt(b.tde)} ${fmt(b.hidset)} ${fmt(b.hypo)}`
  );
}

// ---------------------------------------------------------------------------
// Print
// ---------------------------------------------------------------------------

console.log('\n' + DBL);
console.log(HEADER);
console.log(DBL);

const sizes = [...bySize.keys()].sort((a, b) => a - b);
for (const size of sizes) {
  const rows = bySize.get(size)!;
  const solvedCount = rows.filter(r => r.solved).length;
  const label = `── ${size}×${size}  (${solvedCount}/${rows.length} solved)`;
  console.log(label);
  console.log(SEP);

  if (showDetail) {
    for (const r of rows) console.log(detailRow(r));
    console.log(SEP);
  }

  console.log(avgRow(rows));
  console.log(DBL);
}

// Flag any stuck puzzles
const stuck = [...bySize.values()].flat().filter(r => !r.solved);
if (stuck.length > 0) {
  console.log(`\n⚠ Solver got stuck on ${stuck.length} puzzle(s):`);
  for (const r of stuck) console.log(`  ${r.id}  "${r.title}"  (${r.difficulty})`);
}
console.log();
