/**
 * runAdHoc.ts
 *
 * Generic one-shot job runner used by the dashboard for anything outside
 * the year-end preset: a custom generateBatch.ts run, or a buildMonthlyCalendar.ts
 * run for arbitrary months. Streams child output live into
 * scripts/.genstatus.json / scripts/.genlog.txt so the dashboard can show
 * progress in real time, the same way runYearEndGeneration.ts does.
 *
 * Usage:
 *   npx tsx scripts/runAdHoc.ts --job batch --args '{"sizes":[7],"perSize":5,"mode":"shattered-realms"}'
 *   npx tsx scripts/runAdHoc.ts --job calendar --args '{"months":["2026-10","2026-11"]}'
 */

import './loadEnv';
import { spawn } from 'child_process';
import { writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';

const ROOT        = process.cwd();
const STATUS_PATH = join(ROOT, 'scripts', '.genstatus.json');
const LOG_PATH    = join(ROOT, 'scripts', '.genlog.txt');

interface BatchParams {
  sizes: number[];
  perSize: number;
  mode?: 'initiate' | 'shattered-realms' | 'twin-watchers';
  depth?: number;
  difficulty?: string;
  base?: string;
  bias?: number;
  attempts?: number;
}

interface CalendarParams {
  months: string[];
}

function parseArgs(): { job: string; params: BatchParams | CalendarParams } {
  const args = process.argv.slice(2);
  const get = (flag: string) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : undefined; };
  const job = get('--job') ?? '';
  const argsJson = get('--args');
  return { job, params: argsJson ? JSON.parse(argsJson) : {} };
}

const { job, params } = parseArgs();
const startedAt = new Date().toISOString();
const recentLog: string[] = [];

function pushLog(line: string) {
  const stamped = `[${new Date().toISOString()}] ${line}`;
  console.log(stamped);
  recentLog.push(stamped);
  if (recentLog.length > 120) recentLog.shift();
  try { appendFileSync(LOG_PATH, stamped + '\n'); } catch { /* non-fatal */ }
}

function writeStatus(extra: Record<string, unknown>) {
  writeFileSync(STATUS_PATH, JSON.stringify({
    state: 'running',
    jobType: job,
    jobParams: params,
    pid: process.pid,
    startedAt,
    updatedAt: new Date().toISOString(),
    recentLog,
    ...extra,
  }, null, 2));
}

let cmd: string[];
let label: string;

if (job === 'batch') {
  const p = params as BatchParams;
  const base = p.base && p.base.trim() ? p.base.trim() : `eldritch-custom-${Date.now()}`;
  if (p.mode === 'twin-watchers') {
    const size = (p.sizes ?? [9])[0] ?? 9;
    cmd = [
      'tsx', 'scripts/generateTwin.ts',
      '--count', String(p.perSize ?? 10),
      '--size', String(size),
      '--base', base,
    ];
    label = `twin-watchers batch — size ${size} × ${p.perSize ?? 10}`;
  } else {
    cmd = [
      'tsx', 'scripts/generateBatch.ts',
      '--per-size', String(p.perSize ?? 10),
      '--sizes', (p.sizes ?? [5, 6, 7, 8]).join(','),
      '--mode', p.mode ?? 'shattered-realms',
      '--base', base,
    ];
    if (p.depth != null) cmd.push('--depth', String(p.depth));
    if (p.difficulty) cmd.push('--difficulty', p.difficulty);
    if (p.bias != null) cmd.push('--bias', String(p.bias));
    if (p.attempts != null) cmd.push('--attempts', String(p.attempts));
    label = `custom batch — sizes [${(p.sizes ?? []).join(',')}] × ${p.perSize ?? 10} (${p.mode ?? 'shattered-realms'})`;
  }
} else if (job === 'calendar') {
  const p = params as CalendarParams;
  cmd = ['tsx', 'scripts/buildMonthlyCalendar.ts'];
  for (const m of p.months ?? []) cmd.push('--month', m);
  label = `calendar build — ${(p.months ?? []).join(', ')}`;
} else {
  console.error(`Unknown job type: ${job}`);
  process.exit(1);
}

pushLog(`=== Starting ${label} ===`);
writeStatus({ phase: 'running', message: `Running ${label}…` });

const child = spawn('npx', cmd, { cwd: ROOT, shell: true });

const heartbeat = setInterval(() => writeStatus({ phase: 'running', message: `Running ${label}…` }), 3000);

function handleChunk(buf: Buffer) {
  for (const line of buf.toString().split('\n')) {
    if (line.trim()) pushLog(line.trim());
  }
  writeStatus({ phase: 'running', message: `Running ${label}…` });
}
child.stdout?.on('data', handleChunk);
child.stderr?.on('data', handleChunk);

child.on('close', (code) => {
  clearInterval(heartbeat);
  if (job === 'calendar' && code !== 0) {
    pushLog(`Calendar build did not complete — likely a weekday tier ran out of puzzles.`);
    writeStatus({ state: 'error', phase: 'error', message: 'Calendar build failed — see log (a tier likely ran out).' });
  } else if (code === 0) {
    pushLog(`=== ${label} finished. ===`);
    writeStatus({ state: 'done', phase: 'done', message: `${label} — complete.` });
  } else {
    pushLog(`=== ${label} exited with code ${code}. ===`);
    writeStatus({ state: 'error', phase: 'error', message: `Exited with code ${code}.` });
  }
});
