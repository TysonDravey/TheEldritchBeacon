/**
 * dashboardServer.ts
 *
 * Local control panel for puzzle generation. Serves a single auto-refreshing
 * HTML page plus JSON/control endpoints. No external dependencies — just
 * Node's built-in http module.
 *
 * Three kinds of job, mutually exclusive (they share data/samplePuzzles.ts
 * and data/dailyCalendar.ts, so only one may run at a time):
 *   - the year-end preset (scripts/runYearEndGeneration.ts)
 *   - a custom generateBatch.ts run (scripts/runAdHoc.ts --job batch)
 *   - a buildMonthlyCalendar.ts run for arbitrary months (scripts/runAdHoc.ts --job calendar)
 *
 * Usage: npx tsx scripts/dashboardServer.ts
 * Then open http://localhost:4321
 */

import './loadEnv';
import { createServer, IncomingMessage } from 'http';
import { spawn, execFileSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, openSync, unlinkSync } from 'fs';
import { join } from 'path';

const PORT         = 4321;
const ROOT         = process.cwd();
const STATUS_PATH  = join(ROOT, 'scripts', '.genstatus.json');
const STOP_PATH    = join(ROOT, 'scripts', '.genstop');
const RAW_LOG_PATH = join(ROOT, 'scripts', '.genraw.log');

const FRESH_MS = 4 * 60 * 1000; // heartbeat considered alive within this window

function readStatus(): Record<string, unknown> {
  if (!existsSync(STATUS_PATH)) return { state: 'idle' };
  try { return JSON.parse(readFileSync(STATUS_PATH, 'utf-8')); }
  catch { return { state: 'idle' }; }
}

function isAlive(status: Record<string, unknown>): boolean {
  if (status.state !== 'running') return false;
  const updatedAt = status.updatedAt as string | undefined;
  if (!updatedAt) return false;
  return Date.now() - new Date(updatedAt).getTime() < FRESH_MS;
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { resolve({}); }
    });
  });
}

function spawnDetached(args: string[]): void {
  const logFd = openSync(RAW_LOG_PATH, 'a');
  const child = spawn('npx', args, {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    windowsHide: true,
    shell: true,
  });
  child.unref();
}

function startYearEnd(): { ok: boolean; reason?: string } {
  const status = readStatus();
  if (isAlive(status)) return { ok: false, reason: 'already running' };
  if (existsSync(STOP_PATH)) { try { unlinkSync(STOP_PATH); } catch { /* ignore */ } }
  spawnDetached(['tsx', 'scripts/runYearEndGeneration.ts']);
  return { ok: true };
}

function startBatch(params: Record<string, unknown>): { ok: boolean; reason?: string } {
  const status = readStatus();
  if (isAlive(status)) return { ok: false, reason: 'already running' };
  spawnDetached(['tsx', 'scripts/runAdHoc.ts', '--job', 'batch', '--args', JSON.stringify(params)]);
  return { ok: true };
}

function startCalendar(params: Record<string, unknown>): { ok: boolean; reason?: string } {
  const status = readStatus();
  if (isAlive(status)) return { ok: false, reason: 'already running' };
  spawnDetached(['tsx', 'scripts/runAdHoc.ts', '--job', 'calendar', '--args', JSON.stringify(params)]);
  return { ok: true };
}

function stopJob(): { ok: boolean } {
  const status = readStatus();
  const pid = status.pid as number | undefined;
  if (pid) {
    try { execFileSync('taskkill', ['/PID', String(pid), '/T', '/F']); } catch { /* already dead, or not on Windows */ }
  }
  try { writeFileSync(STOP_PATH, String(Date.now())); } catch { /* ignore */ }
  writeFileSync(STATUS_PATH, JSON.stringify({ ...status, state: 'stopped', message: 'Stopped by user.' }, null, 2));
  return { ok: true };
}

const PAGE = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Puzzle Generation Control Panel</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: -apple-system, Segoe UI, Georgia, serif;
    background: #0e0c0a; color: #e8ddc8; padding: 28px 20px 60px;
  }
  h1 { font-size: 20px; margin: 0 0 4px; color: #f2e9d8; }
  h2 { font-size: 14px; margin: 0 0 10px; color: #d8c9a8; }
  .sub { color: #9b8f78; font-size: 13px; margin-bottom: 20px; }
  .card {
    background: #1a1611; border: 1px solid #3a3226; border-radius: 8px;
    padding: 18px 20px; margin-bottom: 16px;
  }
  .state-badge {
    display: inline-block; padding: 3px 10px; border-radius: 4px;
    font-size: 12px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: bold;
  }
  .state-running { background: #2a4a2a; color: #8ee08e; }
  .state-idle    { background: #3a3226; color: #c8b98f; }
  .state-done    { background: #2a3a4a; color: #8eb8e0; }
  .state-error   { background: #4a2a2a; color: #e08e8e; }
  .state-stopped { background: #3a3226; color: #c8b98f; }
  button {
    background: #B5860D; color: #1a1209; border: none; border-radius: 4px;
    padding: 8px 18px; font-size: 13px; font-weight: bold; cursor: pointer; margin-right: 8px;
  }
  button:disabled { opacity: 0.4; cursor: default; }
  button.stop { background: #8B1A1A; color: #f2e9d8; }
  .bars { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
  .bar-row { display: flex; align-items: center; gap: 10px; font-size: 12px; }
  .bar-label { width: 40px; color: #9b8f78; }
  .bar-track { flex: 1; height: 10px; background: #2a241c; border-radius: 5px; overflow: hidden; }
  .bar-fill { height: 100%; background: linear-gradient(90deg, #B5860D, #e0b840); }
  .bar-count { width: 70px; text-align: right; color: #c8b98f; }
  .log {
    background: #080705; border: 1px solid #2a241c; border-radius: 6px;
    padding: 10px 12px; font-family: Consolas, monospace; font-size: 11px;
    max-height: 320px; overflow-y: auto; white-space: pre-wrap; color: #a8c8a8;
  }
  .stat-row { display: flex; gap: 24px; margin-top: 6px; font-size: 13px; color: #c8b98f; flex-wrap: wrap; }
  .stat-row b { color: #f2e9d8; }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; margin-bottom: 12px; }
  .field { display: flex; flex-direction: column; gap: 4px; }
  .field label { font-size: 11px; color: #9b8f78; text-transform: uppercase; letter-spacing: 0.03em; }
  .field input, .field select {
    background: #0e0c0a; border: 1px solid #3a3226; color: #e8ddc8;
    border-radius: 4px; padding: 6px 8px; font-size: 13px; font-family: inherit;
  }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 760px) { .grid-2 { grid-template-columns: 1fr; } }
</style>
</head>
<body>
  <h1>Puzzle Generation Control Panel</h1>
  <div class="sub">Generates Shattered Realms puzzles and builds the daily calendar. Only one job can run at a time.</div>

  <div class="card">
    <span id="stateBadge" class="state-badge state-idle">idle</span>
    <span id="jobType" style="margin-left:8px;color:#9b8f78;font-size:12px;"></span>
    <span id="message" style="margin-left:10px;color:#9b8f78;font-size:13px;"></span>
    <div style="margin-top:14px;">
      <button id="stopBtn" class="stop" onclick="stopJob()">Stop current job</button>
    </div>
    <div class="stat-row">
      <div>Puzzles still needed for year-end: <b id="totalDeficit">–</b></div>
      <div>Added this session: <b id="totalAdded">–</b></div>
      <div>Pool total: <b id="poolTotal">–</b></div>
      <div>Last update: <b id="lastUpdate">–</b></div>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <h2>Preset: build out through Dec 2026</h2>
      <div style="font-size:12px;color:#9b8f78;margin-bottom:10px;">
        Auto-generates whatever's needed per weekday tier, then builds the calendar for Oct–Dec 2026. Resumable — safe to stop and restart.
      </div>
      <button id="yearEndBtn" onclick="startYearEnd()">Run year-end preset</button>
      <div class="bars" id="bars" style="margin-top:14px;"></div>
    </div>

    <div class="card">
      <h2>Custom batch</h2>
      <div class="form-grid">
        <div class="field">
          <label>Sizes (comma-separated)</label>
          <input id="batchSizes" value="7,8">
        </div>
        <div class="field">
          <label>Per size</label>
          <input id="batchPerSize" type="number" value="5" min="1">
        </div>
        <div class="field">
          <label>Mode</label>
          <select id="batchMode" onchange="onBatchModeChange()">
            <option value="shattered-realms" selected>shattered-realms</option>
            <option value="initiate">initiate</option>
            <option value="twin-watchers">twin-watchers</option>
          </select>
        </div>
        <div class="field" id="batchDepthField">
          <label>Depth (0 = forward only)</label>
          <input id="batchDepth" type="number" value="0" min="0">
        </div>
        <div class="field" id="batchDifficultyField">
          <label>Difficulty filter (optional)</label>
          <input id="batchDifficulty" placeholder="e.g. Archon">
        </div>
        <div class="field">
          <label>Seed base (optional)</label>
          <input id="batchBase" placeholder="auto">
        </div>
      </div>
      <div id="batchTwinHint" style="display:none; opacity:0.7; font-size:0.85em; margin-top:-8px;">
        twin-watchers uses only the first Sizes value, and it must be 9 or larger (8×8 and below only have two possible solution grids). Per size = how many puzzles to generate.
      </div>
      <button id="batchBtn" onclick="startBatch()">Run custom batch</button>
    </div>
  </div>

  <div class="card">
    <h2>Build calendar for specific months</h2>
    <div class="form-grid">
      <div class="field" style="grid-column: 1 / -1;">
        <label>Months (comma-separated, YYYY-MM)</label>
        <input id="calMonths" placeholder="2026-10, 2026-11, 2026-12">
      </div>
    </div>
    <button id="calBtn" onclick="startCalendar()">Build calendar</button>
  </div>

  <div class="card">
    <h2>Log</h2>
    <div class="log" id="log"></div>
  </div>

<script>
function onBatchModeChange() {
  const isTwin = document.getElementById('batchMode').value === 'twin-watchers';
  document.getElementById('batchTwinHint').style.display = isTwin ? 'block' : 'none';
  document.getElementById('batchDepthField').style.display = isTwin ? 'none' : '';
  document.getElementById('batchDifficultyField').style.display = isTwin ? 'none' : '';
}

function setButtonsEnabled(running) {
  document.getElementById('yearEndBtn').disabled = running;
  document.getElementById('batchBtn').disabled = running;
  document.getElementById('calBtn').disabled = running;
  document.getElementById('stopBtn').disabled = !running;
}

async function refresh() {
  const res = await fetch('/status');
  const s = await res.json();
  const running = s.state === 'running';

  const badge = document.getElementById('stateBadge');
  badge.textContent = s.state || 'idle';
  badge.className = 'state-badge state-' + (s.state || 'idle');
  document.getElementById('jobType').textContent = s.jobType ? ('(' + s.jobType + ')') : '';
  document.getElementById('message').textContent = s.message || (s.phase ? ('phase: ' + s.phase) : '');

  document.getElementById('totalAdded').textContent = s.totalAddedThisSession ?? 0;
  document.getElementById('lastUpdate').textContent = s.updatedAt ? new Date(s.updatedAt).toLocaleTimeString() : '–';

  setButtonsEnabled(running);

  const log = document.getElementById('log');
  const atBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 10;
  log.textContent = (s.recentLog || []).join('\\n');
  if (atBottom) log.scrollTop = log.scrollHeight;
}

async function refreshPool() {
  try {
    const res = await fetch('/poolstate');
    const p = await res.json();
    if (p.error) return;

    document.getElementById('totalDeficit').textContent = p.totalDeficit ?? '–';
    document.getElementById('poolTotal').textContent = p.poolTotal ?? '–';

    const bars = document.getElementById('bars');
    bars.innerHTML = '';
    for (let i = 0; i < p.dayNames.length; i++) {
      const need = p.tierNeed[i], have = p.tierRemaining[i];
      const pct = Math.min(100, Math.round((have / need) * 100));
      const row = document.createElement('div');
      row.className = 'bar-row';
      row.innerHTML = '<div class="bar-label">' + p.dayNames[i] + '</div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="bar-count">' + have + ' / ' + need + '</div>';
      bars.appendChild(row);
    }
  } catch { /* ignore transient errors */ }
}

async function startYearEnd() {
  await fetch('/start', { method: 'POST' });
  refresh();
}

async function startBatch() {
  const sizes = document.getElementById('batchSizes').value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
  const body = {
    sizes,
    perSize: parseInt(document.getElementById('batchPerSize').value) || 1,
    mode: document.getElementById('batchMode').value,
    depth: parseInt(document.getElementById('batchDepth').value) || 0,
    difficulty: document.getElementById('batchDifficulty').value.trim() || undefined,
    base: document.getElementById('batchBase').value.trim() || undefined,
  };
  await fetch('/run-batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  refresh();
}

async function startCalendar() {
  const months = document.getElementById('calMonths').value.split(',').map(s => s.trim()).filter(Boolean);
  await fetch('/run-calendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ months }) });
  refresh();
}

async function stopJob() {
  await fetch('/stop', { method: 'POST' });
  refresh();
}

refresh();
refreshPool();
setInterval(refresh, 2000);
setInterval(refreshPool, 6000);
</script>
</body>
</html>`;

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(PAGE);
    return;
  }
  if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(readStatus()));
    return;
  }
  if (req.method === 'GET' && req.url === '/poolstate') {
    try {
      const out = execFileSync('npx', ['tsx', 'scripts/genState.ts'], { cwd: ROOT, encoding: 'utf-8', shell: true });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(out.trim().split('\n').pop());
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }
  if (req.method === 'POST' && req.url === '/start') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(startYearEnd()));
    return;
  }
  if (req.method === 'POST' && req.url === '/run-batch') {
    const body = await readBody(req);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(startBatch(body)));
    return;
  }
  if (req.method === 'POST' && req.url === '/run-calendar') {
    const body = await readBody(req);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(startCalendar(body)));
    return;
  }
  if (req.method === 'POST' && req.url === '/stop') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stopJob()));
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} already in use — dashboard is likely already running.`);
    process.exit(0);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
  // Auto-resume: if a prior run was interrupted (crash, reboot, power loss)
  // and never finished, pick it back up without requiring a manual click.
  const status = readStatus();
  if (status.jobType === 'yearend' && status.state !== 'done' && !isAlive(status)) {
    console.log('Year-end job not finished and not currently running — auto-resuming.');
    startYearEnd();
  }
});
