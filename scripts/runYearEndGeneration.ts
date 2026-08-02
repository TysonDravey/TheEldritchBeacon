/**
 * runYearEndGeneration.ts
 *
 * Resumable job: generates enough new Shattered Realms puzzles so the daily
 * calendar can be built out through the months in genState.ts's
 * TARGET_MONTHS, then builds it. Safe to kill (or lose power) and restart —
 * every loop tick re-derives what's left to do from the data files on disk
 * instead of trusting any saved plan, so nothing needs "resuming" per se.
 *
 * Progress is written to scripts/.genstatus.json on every tick for the
 * dashboard (scripts/dashboardServer.ts) to poll and display.
 *
 * Drop scripts/.genstop to make the current tick exit cleanly.
 *
 * Usage: npx tsx scripts/runYearEndGeneration.ts
 */

import './loadEnv';
import { execFileSync, spawnSync } from 'child_process';
import { writeFileSync, appendFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const ROOT         = process.cwd();
const STATUS_PATH  = join(ROOT, 'scripts', '.genstatus.json');
const LOG_PATH     = join(ROOT, 'scripts', '.genlog.txt');
const STOP_PATH    = join(ROOT, 'scripts', '.genstop');
const SEED_BASE    = 'eldritch-yearend2026';
const CHILD_TIMEOUT_MS = 5 * 60 * 1000; // kill a hung generation attempt after 5 min

interface GenState {
  targetMonths: string[];
  dayNames: string[];
  tierNeed: number[];
  tierRemaining: number[];
  tierDeficit: number[];
  totalDeficit: number;
  poolTotal: number;
  sizesByTier: number[][];
  unusedSizesByTier: number[][];
}

const startedAt = new Date().toISOString();
const recentLog: string[] = [];
let totalAddedThisSession = 0;
let lastPuzzle: { id: string; size: number; difficulty: string } | null = null;

function log(line: string) {
  const stamped = `[${new Date().toISOString()}] ${line}`;
  console.log(stamped);
  recentLog.push(stamped);
  if (recentLog.length > 80) recentLog.shift();
  try { appendFileSync(LOG_PATH, stamped + '\n'); } catch { /* non-fatal */ }
}

function readState(): GenState {
  const out = execFileSync('npx', ['tsx', 'scripts/genState.ts'], { cwd: ROOT, encoding: 'utf-8', shell: true });
  return JSON.parse(out.trim().split('\n').pop()!);
}

function writeStatus(phase: string, extra: Record<string, unknown> = {}, state?: GenState) {
  const s = state ?? (() => { try { return readState(); } catch { return null; } })();
  writeFileSync(STATUS_PATH, JSON.stringify({
    state: 'running',
    jobType: 'yearend',
    pid: process.pid,
    startedAt,
    updatedAt: new Date().toISOString(),
    phase,
    totalAddedThisSession,
    lastPuzzle,
    recentLog,
    ...(s ?? {}),
    ...extra,
  }, null, 2));
}

function modalSize(sizes: number[]): number | null {
  if (sizes.length === 0) return null;
  const counts = new Map<number, number>();
  for (const sz of sizes) counts.set(sz, (counts.get(sz) ?? 0) + 1);
  let best = sizes[0], bestCount = -1;
  for (const [sz, c] of counts) if (c > bestCount) { best = sz; bestCount = c; }
  return best;
}

function checkStop(): boolean {
  if (existsSync(STOP_PATH)) {
    try { unlinkSync(STOP_PATH); } catch { /* ignore */ }
    return true;
  }
  return false;
}

function generateOne(size: number): void {
  log(`Generating one size-${size} Shattered Realms puzzle...`);
  writeStatus('generating', { message: `Generating a ${size}×${size} puzzle…` });
  // generateBatch.ts writes its progress to stderr, not stdout — spawnSync
  // (unlike execFileSync) hands back both streams regardless of exit code.
  const result = spawnSync(
    'npx',
    ['tsx', 'scripts/generateBatch.ts', '--per-size', '1', '--sizes', String(size), '--mode', 'shattered-realms', '--base', SEED_BASE],
    { cwd: ROOT, encoding: 'utf-8', timeout: CHILD_TIMEOUT_MS, shell: true },
  );
  const out = (result.stdout ?? '') + (result.stderr ?? '');
  for (const line of out.split('\n')) if (line.trim()) log(`  ${line.trim()}`);
  const match = out.match(/✓ (eb-\d+x\d+-\d+) — (\w[\w ]*) \(seed/);
  if (match) {
    lastPuzzle = { id: match[1], size, difficulty: match[2] };
    totalAddedThisSession++;
  }
}

function tryBuildCalendar(months: string[]): { ok: boolean; output: string } {
  log(`Attempting to build calendar for ${months.join(', ')}...`);
  const args = ['tsx', 'scripts/buildMonthlyCalendar.ts'];
  for (const m of months) args.push('--month', m);
  try {
    const out = execFileSync('npx', args, { cwd: ROOT, encoding: 'utf-8', timeout: CHILD_TIMEOUT_MS, shell: true });
    for (const line of out.split('\n')) if (line.trim()) log(`  ${line.trim()}`);
    return { ok: true, output: out };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    const out = (e.stdout ?? '') + (e.stderr ?? '');
    for (const line of out.split('\n')) if (line.trim()) log(`  ${line.trim()}`);
    return { ok: false, output: out };
  }
}

async function main() {
  log('=== Year-end generation job starting ===');

  // Bounded top-up retries in case our size estimate doesn't land exactly
  // right and the calendar build still comes up short on some tier.
  let topUpRetriesLeft = 20;

  while (true) {
    if (checkStop()) {
      log('Stop flag detected — exiting.');
      writeStatus('stopped', { state: 'stopped' });
      return;
    }

    let state: GenState;
    try {
      state = readState();
    } catch (err) {
      log(`ERROR reading generation state: ${(err as Error).message}`);
      writeStatus('error', { state: 'error', message: (err as Error).message });
      return;
    }
    writeStatus('generating', {}, state);

    if (state.totalDeficit === 0) {
      const result = tryBuildCalendar(state.targetMonths);
      if (result.ok) {
        log('=== Calendar built successfully. Job complete. ===');
        writeStatus('done', { state: 'done', message: 'Calendar built through ' + state.targetMonths[state.targetMonths.length - 1] });
        return;
      }
      // Tier came up short despite deficit==0 (percentile drift) — top up the
      // implicated tier a little and keep going, bounded so we can't spin forever.
      if (topUpRetriesLeft <= 0) {
        log('ERROR: repeated calendar-build failures after top-ups exhausted.');
        writeStatus('error', { state: 'error', message: 'Calendar build kept failing after top-up retries.' });
        return;
      }
      topUpRetriesLeft--;
      const tierMatch = result.output.match(/tier (\d)/);
      const tierIdx = tierMatch ? parseInt(tierMatch[1]) : 0;
      const size = modalSize(state.unusedSizesByTier[tierIdx]) ?? modalSize(state.sizesByTier[tierIdx]) ?? 6;
      log(`Top-up: tier ${tierIdx} came up short, generating an extra size-${size} puzzle.`);
      generateOne(size);
      continue;
    }

    const maxDeficit = Math.max(...state.tierDeficit);
    const tierIdx = state.tierDeficit.indexOf(maxDeficit);
    const size = modalSize(state.unusedSizesByTier[tierIdx]) ?? modalSize(state.sizesByTier[tierIdx]);
    if (size == null) {
      log(`ERROR: tier ${tierIdx} (${state.dayNames[tierIdx]}) has no puzzles at all to model a size from.`);
      writeStatus('error', { state: 'error', message: `Tier ${tierIdx} has no puzzles to derive a size from.` });
      return;
    }
    log(`Deficit ${maxDeficit} on ${state.dayNames[tierIdx]} tier — generating a size-${size} puzzle.`);
    generateOne(size);
  }
}

main().catch(err => {
  log(`FATAL: ${(err as Error).message}`);
  writeStatus('error', { state: 'error', message: (err as Error).message });
  process.exit(1);
});
