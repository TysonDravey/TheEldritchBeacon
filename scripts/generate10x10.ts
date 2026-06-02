/**
 * generate10x10.ts
 *
 * Constructive generator for 10x10 puzzles.
 *
 * Random BFS territory maps almost never produce uniquely solvable 10x10
 * boards (0 successes in 16,000 random attempts across bias 0.25-0.95).
 * Instead, this script designs territories to ensure the depth-1 solver can
 * crack them: some territories are deliberately thin (single row or single
 * column) so confinement fires immediately, kickstarting a cascade.
 *
 * Usage:
 *   npx tsx scripts/generate10x10.ts --count 3
 *   npx tsx scripts/generate10x10.ts --count 5 --base eb-10x10-c1 --thin 3
 */

import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { solveLogically } from '../engine/solver';
import { rateDifficulty } from '../engine/difficulty';
import { isAdjacent } from '../engine/rules';
import { createRNG } from '../lib/randomSeed';
import type { Puzzle } from '../engine/boardTypes';

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

const TITLES = [
  'The Deepwell Codex',
  'Throne of the Sunken Empire',
  'The Final Cartography',
  'Tides Beneath the Tenth Star',
  'The Ossuary of Drowned Kings',
  'Echoes of the Hundred Wards',
  'The Loom of Forgotten Tides',
  'Vault of the Pale Antiquarian',
  'The Cipher of the Ten Veils',
  'Hymnal of the Final Meridian',
];

// ---------------------------------------------------------------------------
// Solution generation
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
// Constructive territory map: mix of thin and blob territories
// ---------------------------------------------------------------------------

function generateMixedTerritoryMap(
  n: number,
  solution: [number, number][],
  rng: () => number,
  thinCount: number,
): number[][] | null {
  const map: number[][] = Array.from({ length: n }, () => Array(n).fill(-1));

  // Assign "shape" to each territory.
  // - "single": single cell — instant forced placement; one kickstart is OK,
  //   two makes the puzzle trivial (player sees both 1-cell regions immediately).
  // - "thin-row" / "thin-col": few cells in same row/col → confinement fires after
  //   another nearby watcher is placed
  // - "blob": BFS-grown territory
  type Shape = 'single' | 'thin-row' | 'thin-col' | 'blob';
  const shapes: Shape[] = solution.map(() => 'blob');
  const indices = Array.from({ length: n }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  let assigned = 0;
  // One single-cell kickstart territory (load-bearing for depth-1 cascade at n=10)
  if (assigned < indices.length) shapes[indices[assigned++]] = 'single';
  for (let k = 0; k < thinCount && assigned < indices.length; k++) {
    shapes[indices[assigned++]] = rng() < 0.5 ? 'thin-row' : 'thin-col';
  }

  // Step 1: place watcher seeds
  for (let t = 0; t < solution.length; t++) {
    const [r, c] = solution[t];
    map[r][c] = t;
  }

  // Step 2: build thin territories first — contiguous runs in their row/col
  // adjacent to the watcher. Contiguity matters: scattered thin cells fragment
  // the remaining grid and force blob territories to become disconnected.
  for (let t = 0; t < solution.length; t++) {
    if (shapes[t] !== 'thin-row' && shapes[t] !== 'thin-col') continue;
    const [wr, wc] = solution[t];
    const targetSize = 2 + Math.floor(rng() * 2); // 2-3 cells
    const cells: [number, number][] = [[wr, wc]];

    if (shapes[t] === 'thin-row') {
      // Grow contiguously left and right from (wr, wc), preferring one direction
      const goLeftFirst = rng() < 0.5;
      let left = wc - 1, right = wc + 1;
      while (cells.length < targetSize && (left >= 0 || right < n)) {
        const tryLeft = goLeftFirst ? left >= 0 : right >= n;
        if (tryLeft && left >= 0 && map[wr][left] === -1) {
          cells.push([wr, left]); left--;
        } else if (right < n && map[wr][right] === -1) {
          cells.push([wr, right]); right++;
        } else if (left >= 0 && map[wr][left] === -1) {
          cells.push([wr, left]); left--;
        } else break;
      }
    } else {
      // thin-col
      const goUpFirst = rng() < 0.5;
      let up = wr - 1, down = wr + 1;
      while (cells.length < targetSize && (up >= 0 || down < n)) {
        const tryUp = goUpFirst ? up >= 0 : down >= n;
        if (tryUp && up >= 0 && map[up][wc] === -1) {
          cells.push([up, wc]); up--;
        } else if (down < n && map[down][wc] === -1) {
          cells.push([down, wc]); down++;
        } else if (up >= 0 && map[up][wc] === -1) {
          cells.push([up, wc]); up--;
        } else break;
      }
    }

    for (const [r, c] of cells) map[r][c] = t;
  }

  // Step 3: BFS-grow remaining territories from their watcher cells
  const pending: Array<{ row: number; col: number; territory: number }> = [];
  for (let t = 0; t < solution.length; t++) {
    if (shapes[t] === 'blob') {
      const [r, c] = solution[t];
      pending.push({ row: r, col: c, territory: t });
    }
  }
  // Shuffle pending
  for (let i = pending.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pending[i], pending[j]] = [pending[j], pending[i]];
  }

  while (pending.length > 0) {
    const idx = Math.floor(rng() * Math.min(pending.length, 3));
    const { row, col, territory } = pending.splice(idx, 1)[0];
    const neighbors: [number, number][] = [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]];
    for (let i = neighbors.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [neighbors[i], neighbors[j]] = [neighbors[j], neighbors[i]];
    }
    for (const [nr, nc] of neighbors) {
      if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
      if (map[nr][nc] !== -1) continue;
      map[nr][nc] = territory;
      pending.push({ row: nr, col: nc, territory });
    }
  }

  // Step 4: handle any leftover unfilled cells — assign to nearest blob territory
  let unfilledCount = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (map[r][c] === -1) unfilledCount++;
    }
  }
  if (unfilledCount > 0) {
    let changed = true;
    while (changed) {
      changed = false;
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (map[r][c] !== -1) continue;
          for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < n && nc >= 0 && nc < n && map[nr][nc] !== -1 && shapes[map[nr][nc]] === 'blob') {
              map[r][c] = map[nr][nc];
              changed = true;
              break;
            }
          }
        }
      }
    }
  }

  // Sanity check: every cell assigned
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (map[r][c] === -1) return null;
    }
  }

  return map;
}

function isConnected(map: number[][], n: number, territory: number): boolean {
  let start: [number, number] | null = null;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (map[r][c] === territory) { start = [r, c]; break; }
    }
    if (start) break;
  }
  if (!start) return true;
  const visited = new Set<string>();
  const stack = [start];
  visited.add(`${start[0]},${start[1]}`);
  while (stack.length > 0) {
    const [r, c] = stack.pop()!;
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
      const key = `${nr},${nc}`;
      if (visited.has(key)) continue;
      if (map[nr][nc] !== territory) continue;
      visited.add(key);
      stack.push([nr, nc]);
    }
  }
  let total = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (map[r][c] === territory) total++;
  return visited.size === total;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  let count = 3;
  let base = 'eb-10x10-c1';
  let thin = 3;
  let maxSeeds = 20000;
  let minDifficulty: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--count'          && args[i+1]) count = parseInt(args[++i]);
    if (args[i] === '--base'           && args[i+1]) base  = args[++i];
    if (args[i] === '--thin'           && args[i+1]) thin  = parseInt(args[++i]);
    if (args[i] === '--max'            && args[i+1]) maxSeeds = parseInt(args[++i]);
    if (args[i] === '--min-difficulty' && args[i+1]) minDifficulty = args[++i];
  }
  return { count, base, thin, maxSeeds, minDifficulty };
}

const DIFFICULTY_RANK: Record<string, number> = {
  Initiate: 1, Scholar: 2, Occultist: 3, 'High Priest': 4, Eldritch: 5, Harbinger: 6, Archon: 7,
};

async function main() {
  const { count, base, thin, maxSeeds, minDifficulty } = parseArgs();
  const minRank = minDifficulty ? DIFFICULTY_RANK[minDifficulty] ?? 0 : 0;
  const n = 10;
  const filePath = join(process.cwd(), 'data', 'samplePuzzles.ts');
  let fileContent = readFileSync(filePath, 'utf-8');

  // Track seeds already used so re-running with the same base doesn't duplicate
  const usedSeeds = new Set<string>();
  for (const m of fileContent.matchAll(/"seed":"([^"]+)"/g)) usedSeeds.add(m[1]);

  process.stderr.write(`Constructive 10x10 generator: ${count} puzzles, thin=${thin}, max seeds=${maxSeeds}\n`);
  await discordPing(`▶ Starting 10x10 constructive generation (target=${count}, thin=${thin})`);

  let found = 0;
  let solveFails = 0;
  let connFails = 0;
  let mapFails = 0;
  let solFails = 0;
  const tStart = Date.now();

  for (let s = 0; s < maxSeeds && found < count; s++) {
    const seed = `${base}-s${s}`;
    if (usedSeeds.has(seed)) continue;
    const rng = createRNG(seed);
    const solution = generateSolution(n, rng);
    if (!solution) { solFails++; continue; }

    const map = generateMixedTerritoryMap(n, solution, rng, thin);
    if (!map) { mapFails++; continue; }

    // Verify all territories connected
    let allConnected = true;
    for (let t = 0; t < n; t++) {
      if (!isConnected(map, n, t)) { allConnected = false; break; }
    }
    if (!allConnected) { connFails++; continue; }

    // Build candidate puzzle
    const raw: Puzzle = {
      id: 'tmp', title: 'tmp', mode: 'initiate', size: n,
      territoryMap: map, solution,
      seed, createdAt: new Date().toISOString(),
      difficulty: 'Initiate',
    };

    // Test depth-1 solvability
    const solved = solveLogically(raw, 1);
    if (!solved) {
      solveFails++;
      if (s % 100 === 0 && s > 0) process.stderr.write(`  seed ${s}: still searching (solveFails=${solveFails})\n`);
      continue;
    }

    // Find next available eb-10x10 ID
    fileContent = readFileSync(filePath, 'utf-8');
    const pattern = /"id":"eb-10x10-(\d+)"/g;
    const nums: number[] = [];
    for (const m of fileContent.matchAll(pattern)) nums.push(parseInt(m[1]));
    const idNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    const id = `eb-10x10-${String(idNum).padStart(3, '0')}`;
    const title = TITLES[(idNum - 1) % TITLES.length];

    const diff = rateDifficulty({ ...raw, id, title });
    if (minRank > 0 && (DIFFICULTY_RANK[diff] ?? 0) < minRank) {
      // Doesn't meet difficulty threshold — skip and don't mark this ID as used
      if (process.env.DEBUG_DIFF) process.stderr.write(`  seed s${s}: ${diff} (below ${minDifficulty})\n`);
      continue;
    }
    const { difficulty: _d, ...rest } = raw;
    const entry = { ...rest, id, title };

    // Insert into samplePuzzles.ts before `\n];`
    const insertPoint = fileContent.lastIndexOf('\n];');
    if (insertPoint === -1) { process.stderr.write('ERROR: cannot find insertion point\n'); process.exit(1); }
    fileContent = fileContent.slice(0, insertPoint) + ',\n' + JSON.stringify(entry) + fileContent.slice(insertPoint);
    writeFileSync(filePath, fileContent, 'utf-8');
    usedSeeds.add(seed);

    found++;
    const elapsed = ((Date.now() - tStart) / 1000).toFixed(1);
    process.stderr.write(`  ✓ ${id} — ${diff} (seed s${s}, ${elapsed}s elapsed)\n`);
    await discordPing(`✓ ${id} — ${diff}`);
  }

  const elapsed = ((Date.now() - tStart) / 1000).toFixed(1);
  process.stderr.write(`\nDone. Found ${found}/${count} puzzles in ${elapsed}s.\n`);
  process.stderr.write(`Stats: solFails=${solFails}, mapFails=${mapFails}, connFails=${connFails}, solveFails=${solveFails}\n`);
  await discordPing(`@here 🔔 10x10 generation complete: ${found}/${count} puzzles in ${elapsed}s.`);
}

main().catch(err => { console.error(err); process.exit(1); });
