/**
 * generateBalanced.ts
 *
 * Balanced territory generator for 9×9 and 10×10 boards.
 *
 * PROBLEMS WITH EXISTING GENERATORS:
 * - generate10x10.ts: thin territories are straight rows/columns — looks bad
 * - generateBatch.ts on 9×9/10×10: unconstrained BFS, one territory can eat 30+ cells
 *
 * THIS GENERATOR:
 * 1. Round-robin BFS — each territory grows one cell per turn (no territory races ahead)
 * 2. Per-territory size cap — capped at ~1.5× board average (e.g. 15 cells on 10×10)
 * 3. L-shaped "hook" territories — short L/Z shape instead of a straight stripe,
 *    provides confinement kick-starts without looking like a ruler
 * 4. Uses depth-1 solver — allows contradiction reasoning so we don't need to rely
 *    entirely on trivial forced placements
 *
 * KNOWN GOOD COMMANDS (update this list when you find a good run):
 *   9×9 initiate:   npx tsx scripts/generateBalanced.ts --size 9  --count 10 --hooks 2
 *   10×10 initiate: npx tsx scripts/generateBalanced.ts --size 10 --count 5  --hooks 2
 *   10×10 hard:     npx tsx scripts/generateBalanced.ts --size 10 --count 5  --hooks 3 --min-runup 15
 *
 * Usage:
 *   npx tsx scripts/generateBalanced.ts
 *   npx tsx scripts/generateBalanced.ts --size 9 --count 10
 *   npx tsx scripts/generateBalanced.ts --size 10 --count 5 --hooks 2 --max 12000
 *
 * Options:
 *   --size        Board size (9 or 10, default: 10)
 *   --count       Number of puzzles to generate (default: 5)
 *   --base        Seed prefix (default: balanced-v1)
 *   --hooks       Number of L-shaped hook territories (default: 2)
 *   --straights   Number of straight thin row/col territories (default: 0 for 9x9, 2 for 10x10)
 *                 Thin territories improve solver hit rate; increase if generation is slow
 *   --max         Max seed attempts (default: 12000)
 *   --min-runup   Minimum steps before first naked deduction (harder puzzles)
 *   --max-size    Hard cap on territory size (default: ceil(n * 1.5))
 */

import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { solveLogically, getNextDeduction, findContradictions } from '../engine/solver';
import { isSolved } from '../engine/rules';
import { isAdjacent } from '../engine/rules';
import { createRNG } from '../lib/randomSeed';
import { rateDifficulty } from '../engine/difficulty';
import type { Puzzle, CellState, DeductionResult } from '../engine/boardTypes';
import { nextUnusedTitle, existingTitles } from './titlePool';

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK ?? '';

async function discordPing(msg: string): Promise<void> {
  if (!DISCORD_WEBHOOK) return;
  try {
    await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: msg }),
    });
  } catch {}
}

// ---------------------------------------------------------------------------
// Solution generation (same backtrack approach as other generators)
// ---------------------------------------------------------------------------

function generateSolution(n: number, rng: () => number): [number, number][] | null {
  const solution: [number, number][] = [];
  function backtrack(row: number): boolean {
    if (row === n) return true;
    const cols = Array.from({ length: n }, (_, i) => i);
    for (let i = cols.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [cols[i], cols[j]] = [cols[j], cols[i]];
    }
    for (const col of cols) {
      if (solution.some(([, c]) => c === col)) continue;
      if (solution.some(([r, c]) => isAdjacent(row, col, r, c))) continue;
      solution.push([row, col]);
      if (backtrack(row + 1)) return true;
      solution.pop();
    }
    return false;
  }
  return backtrack(0) ? solution : null;
}

// ---------------------------------------------------------------------------
// Balanced territory map
// ---------------------------------------------------------------------------

function generateBalancedMap(
  n: number,
  solution: [number, number][],
  rng: () => number,
  hookCount: number,
  straightCount: number,
  maxTerritorySize: number,
): number[][] | null {
  const nT = solution.length;
  const map: number[][] = Array.from({ length: n }, () => Array(n).fill(-1));

  // Seed watcher positions
  for (let t = 0; t < nT; t++) {
    const [r, c] = solution[t];
    map[r][c] = t;
  }

  // Randomly assign territories to shape categories: straight, hook, blob
  const order = Array.from({ length: nT }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const straightSet = new Set(order.slice(0, straightCount));
  const hookSet = new Set(order.slice(straightCount, straightCount + hookCount));

  // ── Straight thin territories: row or col run of 3–4 cells (solver confinement kick-start) ──
  for (const t of straightSet) {
    const [wr, wc] = solution[t];
    const targetLen = 3 + Math.floor(rng() * 2); // 3–4 cells
    const isRow = rng() < 0.5;
    const cells: [number, number][] = [[wr, wc]];
    const goFwdFirst = rng() < 0.5;
    let fwd = isRow ? wc + 1 : wr + 1;
    let bwd = isRow ? wc - 1 : wr - 1;
    while (cells.length < targetLen && (fwd < n || bwd >= 0)) {
      const tryFwd = goFwdFirst ? fwd < n : bwd < 0;
      const fr = isRow ? wr : fwd, fc = isRow ? fwd : wc;
      const br = isRow ? wr : bwd, bc = isRow ? bwd : wc;
      if (tryFwd && fwd < n && map[fr][fc] === -1) {
        cells.push([fr, fc]); fwd++;
      } else if (bwd >= 0 && map[br][bc] === -1) {
        cells.push([br, bc]); bwd--;
      } else if (fwd < n && map[fr][fc] === -1) {
        cells.push([fr, fc]); fwd++;
      } else break;
    }
    for (const [r, c] of cells) map[r][c] = t;
  }

  // ── Hook territories: L-shaped, provides confinement without a straight line ──

  for (const t of hookSet) {
    const [wr, wc] = solution[t];
    const armLen = 2 + Math.floor(rng() * 2); // 2–3 cells in primary direction

    // Try all 4 primary directions, shuffled
    const dirs: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }

    let hooked = false;
    for (const [dr, dc] of dirs) {
      const arm: [number, number][] = [[wr, wc]];
      let r = wr, c = wc;
      let ok = true;
      for (let step = 0; step < armLen; step++) {
        r += dr; c += dc;
        if (r < 0 || r >= n || c < 0 || c >= n || map[r][c] !== -1) { ok = false; break; }
        arm.push([r, c]);
      }
      if (!ok || arm.length < 3) continue;

      // L-turn: perpendicular from the tip of the arm
      const perpDirs: [number, number][] = (dr === 0)
        ? [[1, 0], [-1, 0]]
        : [[0, 1], [0, -1]];
      if (rng() < 0.5) perpDirs.reverse();
      for (const [pr, pc] of perpDirs) {
        const nr = r + pr, nc = c + pc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n && map[nr][nc] === -1) {
          arm.push([nr, nc]);
          break;
        }
      }

      if (arm.length < 3) continue;

      for (const [ar, ac] of arm) map[ar][ac] = t;
      hooked = true;
      break;
    }
    if (!hooked) {
      // Couldn't build an L — leave as single seed, blob BFS will grow it
    }
  }

  // ── Round-robin BFS for all territories ──
  // Each territory has its own frontier queue.
  // Every round, each territory grows exactly one cell (if it hasn't hit maxSize).
  const frontiers: [number, number][][] = Array.from({ length: nT }, () => []);
  const sizes = Array(nT).fill(0);

  // Count cells already placed (seeds + hooks)
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const t = map[r][c];
      if (t !== -1) {
        sizes[t]++;
        // Seed frontier from this cell's empty neighbors
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < n && nc >= 0 && nc < n && map[nr][nc] === -1) {
            frontiers[t].push([nr, nc]);
          }
        }
      }
    }
  }

  // Grow until all cells claimed or all frontiers empty
  let totalFilled = sizes.reduce((a, b) => a + b, 0);
  const totalCells = n * n;

  for (let round = 0; round < totalCells * 4 && totalFilled < totalCells; round++) {
    // Shuffle territory order each round for fairness
    const roundOrder = Array.from({ length: nT }, (_, i) => i);
    for (let i = roundOrder.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [roundOrder[i], roundOrder[j]] = [roundOrder[j], roundOrder[i]];
    }

    let anyGrew = false;
    for (const t of roundOrder) {
      if (sizes[t] >= maxTerritorySize) continue;

      // Deduplicate + filter already-claimed cells
      const validFront = frontiers[t].filter(([r, c]) => map[r][c] === -1);
      frontiers[t] = validFront;
      if (validFront.length === 0) continue;

      // Pick a random frontier cell
      const idx = Math.floor(rng() * validFront.length);
      const [r, c] = validFront[idx];
      frontiers[t].splice(idx, 1);

      map[r][c] = t;
      sizes[t]++;
      totalFilled++;
      anyGrew = true;

      // Add new neighbors to this territory's frontier
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n && map[nr][nc] === -1) {
          frontiers[t].push([nr, nc]);
        }
      }
    }

    if (!anyGrew) break;
  }

  // ── Overflow fill: assign any remaining cells to adjacent territories ──
  // (cells left unclaimed because all touching territories hit maxTerritorySize)
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (map[r][c] !== -1) continue;
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < n && nc >= 0 && nc < n && map[nr][nc] !== -1) {
            map[r][c] = map[nr][nc];
            changed = true;
            break;
          }
        }
      }
    }
  }

  // Verify all cells assigned
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (map[r][c] === -1) return null;
    }
  }

  // Reject if any territory ended up with < 3 cells (too trivial, and we
  // allow at most 1 each of 1-cell and 2-cell territories per memory note)
  const finalSizes = Array(nT).fill(0);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) finalSizes[map[r][c]]++;
  const tinyCount = finalSizes.filter(s => s <= 2).length;
  if (tinyCount > 2) return null; // more than 2 tiny territories feels rinkydink

  return map;
}

function isConnected(map: number[][], n: number, territory: number): boolean {
  let start: [number, number] | null = null;
  for (let r = 0; r < n && !start; r++) {
    for (let c = 0; c < n && !start; c++) {
      if (map[r][c] === territory) start = [r, c];
    }
  }
  if (!start) return true;
  const visited = new Set<string>();
  const stack = [start];
  visited.add(`${start[0]},${start[1]}`);
  while (stack.length) {
    const [r, c] = stack.pop()!;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
      const key = `${nr},${nc}`;
      if (visited.has(key) || map[nr][nc] !== territory) continue;
      visited.add(key);
      stack.push([nr, nc]);
    }
  }
  let total = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (map[r][c] === territory) total++;
  return visited.size === total;
}

// ---------------------------------------------------------------------------
// Runup metric (same as generate10x10.ts)
// ---------------------------------------------------------------------------

function runupBeforeFirstNaked(p: Puzzle): number {
  const n = p.size;
  const cells: CellState[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => 'empty' as CellState));
  let runup = 0;
  let seenNaked = false;

  function applyDed(d: DeductionResult): void {
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

  for (let step = 0; step < 300; step++) {
    if (isSolved(p, cells)) break;
    if (findContradictions(p, cells).found) break;
    const d = getNextDeduction(p, cells, 1);
    if (!d) break;
    const kind = d.type === 'watcher' ? 'naked' : (d.reasonType === 'hypothetical' ? 'contradiction' : 'other');
    if (!seenNaked) {
      if (kind === 'naked') seenNaked = true;
      else runup++;
    }
    applyDed(d);
  }
  return runup;
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  let size = 10;
  let count = 5;
  let base = 'balanced-v1';
  let hooks = 2;
  let straights = -1; // -1 = auto (0 for 9x9, 2 for 10x10)
  let maxSeeds = 12000;
  let minRunup = 0;
  let maxTerritorySize = 0; // 0 = auto
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--size'         && args[i + 1]) size             = parseInt(args[++i]);
    if (args[i] === '--count'        && args[i + 1]) count            = parseInt(args[++i]);
    if (args[i] === '--base'         && args[i + 1]) base             = args[++i];
    if (args[i] === '--hooks'        && args[i + 1]) hooks            = parseInt(args[++i]);
    if (args[i] === '--straights'    && args[i + 1]) straights        = parseInt(args[++i]);
    if (args[i] === '--max'          && args[i + 1]) maxSeeds         = parseInt(args[++i]);
    if (args[i] === '--min-runup'    && args[i + 1]) minRunup         = parseInt(args[++i]);
    if (args[i] === '--max-size'     && args[i + 1]) maxTerritorySize = parseInt(args[++i]);
  }
  if (straights === -1) straights = size >= 10 ? 2 : 0;
  if (maxTerritorySize === 0) maxTerritorySize = Math.ceil(size * 1.5);
  return { size, count, base, hooks, straights, maxSeeds, minRunup, maxTerritorySize };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { size: n, count, base, hooks, straights, maxSeeds, minRunup, maxTerritorySize } = parseArgs();

  const filePath = join(process.cwd(), 'data', 'samplePuzzles.ts');
  let fileContent = readFileSync(filePath, 'utf-8');
  const usedSeeds = new Set<string>();
  for (const m of fileContent.matchAll(/"seed":"([^"]+)"/g)) usedSeeds.add(m[1]);

  const avgSize = (n * n) / n;
  process.stderr.write(
    `Balanced ${n}×${n} generator: target=${count}, hooks=${hooks}, straights=${straights}, maxTerritorySize=${maxTerritorySize} (avg ${avgSize.toFixed(1)}), maxSeeds=${maxSeeds}\n`
  );
  await discordPing(`▶ Starting balanced ${n}×${n} generation (target=${count}, hooks=${hooks})`);

  let found = 0;
  let solveFails = 0, mapFails = 0, connFails = 0, solverFails = 0, runupFails = 0;
  const tStart = Date.now();

  for (let s = 0; s < maxSeeds && found < count; s++) {
    const seed = `${base}-${n}-s${s}`;
    if (usedSeeds.has(seed)) continue;

    const rng = createRNG(seed);
    const solution = generateSolution(n, rng);
    if (!solution) { solveFails++; continue; }

    const map = generateBalancedMap(n, solution, rng, hooks, straights, maxTerritorySize);
    if (!map) { mapFails++; continue; }

    // Connectivity check
    let allConnected = true;
    for (let t = 0; t < n && allConnected; t++) {
      if (!isConnected(map, n, t)) allConnected = false;
    }
    if (!allConnected) { connFails++; continue; }

    const raw: Puzzle = {
      id: 'tmp', title: 'tmp', mode: 'initiate', size: n,
      territoryMap: map, solution,
      seed, createdAt: new Date().toISOString(),
      difficulty: 'Initiate',
    };

    // Depth-1 solvability check
    if (!solveLogically(raw, 1)) { solverFails++; continue; }

    // Optional runup filter (harder puzzles)
    if (minRunup > 0) {
      const ru = runupBeforeFirstNaked(raw);
      if (ru < minRunup) { runupFails++; continue; }
    }

    // Assign ID
    fileContent = readFileSync(filePath, 'utf-8');
    const pattern = new RegExp(`"id":"eb-${n}x${n}-(\\d+)"`, 'g');
    const nums: number[] = [];
    for (const m of fileContent.matchAll(pattern)) nums.push(parseInt(m[1]));
    const idNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    const id = `eb-${n}x${n}-${String(idNum).padStart(3, '0')}`;
    const title = nextUnusedTitle(existingTitles(fileContent));
    const diff = rateDifficulty({ ...raw, id, title });

    const { difficulty: _d, ...rest } = raw;
    const entry = { ...rest, id, title };

    const insertPoint = fileContent.lastIndexOf('\n];');
    if (insertPoint === -1) { process.stderr.write('ERROR: insertion point not found\n'); process.exit(1); }
    fileContent = fileContent.slice(0, insertPoint) + ',\n' + JSON.stringify(entry) + fileContent.slice(insertPoint);
    writeFileSync(filePath, fileContent, 'utf-8');
    usedSeeds.add(seed);

    found++;
    const elapsed = ((Date.now() - tStart) / 1000).toFixed(1);
    process.stderr.write(`  ✓ ${id} "${title}" — ${diff} (seed s${s}, ${elapsed}s)\n`);
    await discordPing(`✓ ${id} — ${diff}`);

    if (s % 500 === 0 && s > 0) {
      process.stderr.write(
        `  [s${s}] solveFails=${solveFails} mapFails=${mapFails} connFails=${connFails} solverFails=${solverFails} runupFails=${runupFails}\n`
      );
    }
  }

  const elapsed = ((Date.now() - tStart) / 1000).toFixed(1);
  process.stderr.write(`\nDone. Found ${found}/${count} in ${elapsed}s.\n`);
  process.stderr.write(`Stats: solveFails=${solveFails} mapFails=${mapFails} connFails=${connFails} solverFails=${solverFails} runupFails=${runupFails}\n`);
  await discordPing(`@here 🔔 Balanced ${n}×${n} generation complete: ${found}/${count} in ${elapsed}s.`);
}

main().catch(err => { console.error(err); process.exit(1); });
