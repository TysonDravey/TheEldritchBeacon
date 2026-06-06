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

import './loadEnv';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { solveLogically, getNextDeduction, findContradictions } from '../engine/solver';
import { rateDifficulty, scorePuzzle } from '../engine/difficulty';
import { isSolved } from '../engine/rules';
import type { CellState, DeductionResult } from '../engine/boardTypes';
import { isAdjacent } from '../engine/rules';
import { createRNG } from '../lib/randomSeed';
import type { Puzzle } from '../engine/boardTypes';
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
  hard: boolean = false,
  maxBlobSize: number = 999,
): number[][] | null {
  const map: number[][] = Array.from({ length: n }, () => Array(n).fill(-1));

  // Assign "shape" to each territory. Tiny territories (1- and 2-cell) are
  // capped at one each — more than that makes the puzzle feel trivial since
  // the player can scan for tiny regions and place watchers immediately.
  // - "single":   1 cell        (max 1)
  // - "thin-2":   2 cells       (max 1)
  // - "thin-big": 4–5 cells in a row/col → confinement after a neighbour fires
  // - "blob":     BFS-grown
  type Shape = 'single' | 'thin-2' | 'thin-big-row' | 'thin-big-col' | 'blob';
  const shapes: Shape[] = solution.map(() => 'blob');
  const indices = Array.from({ length: n }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  let assigned = 0;
  if (!hard) {
    // Soft mode: 1 single + 1 thin-2 + thin-big stripes — easier to find but
    // the single-cell territory gives the player a free first deduction.
    if (assigned < indices.length) shapes[indices[assigned++]] = 'single';
    if (assigned < indices.length) shapes[indices[assigned++]] = 'thin-2';
    for (let k = 0; k < thinCount - 2 && assigned < indices.length; k++) {
      shapes[indices[assigned++]] = rng() < 0.5 ? 'thin-big-row' : 'thin-big-col';
    }
  } else {
    // Hard mode: NO single-cell territory. Player must find a confinement
    // deduction first instead of just spotting a one-cell region.
    if (assigned < indices.length) shapes[indices[assigned++]] = 'thin-2';
    for (let k = 0; k < thinCount - 1 && assigned < indices.length; k++) {
      shapes[indices[assigned++]] = rng() < 0.5 ? 'thin-big-row' : 'thin-big-col';
    }
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
    const shape = shapes[t];
    if (shape !== 'thin-2' && shape !== 'thin-big-row' && shape !== 'thin-big-col') continue;
    const [wr, wc] = solution[t];
    const targetSize =
      shape === 'thin-2' ? 2 :
      3 + Math.floor(rng() * 2); // 3-4 cells for thin-big
    const isRow = shape === 'thin-big-row' || (shape === 'thin-2' && rng() < 0.5);
    const cells: [number, number][] = [[wr, wc]];

    if (isRow) {
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
      // column
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

    // ~50% of thin-big bend one cell perpendicular at the end to break the
    // "all territories are straight lines" feel. Aggressive bending fragments
    // blob territories' BFS expansion (70% mapFails at 100%); leaving roughly
    // half as straight lines keeps the map generator viable.
    if ((shape === 'thin-big-row' || shape === 'thin-big-col') && rng() < 0.5) {
      const tail = cells[cells.length - 1];
      const perpendiculars: [number, number][] = isRow
        ? [[tail[0] - 1, tail[1]], [tail[0] + 1, tail[1]]]
        : [[tail[0], tail[1] - 1], [tail[0], tail[1] + 1]];
      if (rng() < 0.5) perpendiculars.reverse();
      for (const [nr, nc] of perpendiculars) {
        if (nr >= 0 && nr < n && nc >= 0 && nc < n && map[nr][nc] === -1) {
          map[nr][nc] = t;
          break;
        }
      }
    }
  }

  // Step 3: BFS-grow remaining (blob) territories from their watcher cells.
  // Per-territory size tracking lets us cap each blob so no single territory
  // dominates. Cells left unclaimed (when all neighbours hit the cap) are
  // picked up by the overflow fill in Step 4.
  const blobSizes: Record<number, number> = {};
  const pending: Array<{ row: number; col: number; territory: number }> = [];
  for (let t = 0; t < solution.length; t++) {
    if (shapes[t] === 'blob') {
      const [r, c] = solution[t];
      blobSizes[t] = 1; // seed cell already placed
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
    if ((blobSizes[territory] ?? 0) >= maxBlobSize) continue; // cap reached
    const neighbors: [number, number][] = [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]];
    for (let i = neighbors.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [neighbors[i], neighbors[j]] = [neighbors[j], neighbors[i]];
    }
    for (const [nr, nc] of neighbors) {
      if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
      if (map[nr][nc] !== -1) continue;
      map[nr][nc] = territory;
      blobSizes[territory] = (blobSizes[territory] ?? 0) + 1;
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

// Returns true if `territory` remains connected when cell (er,ec) is removed.
function isConnectedWithout(map: number[][], n: number, territory: number, er: number, ec: number): boolean {
  let start: [number, number] | null = null;
  for (let r = 0; r < n && !start; r++) {
    for (let c = 0; c < n; c++) {
      if (map[r][c] === territory && !(r === er && c === ec)) { start = [r, c]; break; }
    }
  }
  if (!start) return false; // territory would become empty
  const visited = new Set<string>();
  const stack = [start];
  visited.add(`${start[0]},${start[1]}`);
  while (stack.length > 0) {
    const [r, c] = stack.pop()!;
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
      if (map[nr][nc] !== territory) continue;
      if (nr === er && nc === ec) continue;
      const key = `${nr},${nc}`;
      if (!visited.has(key)) { visited.add(key); stack.push([nr, nc]); }
    }
  }
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (map[r][c] === territory && !(r === er && c === ec) && !visited.has(`${r},${c}`)) return false;
    }
  }
  return true;
}

// Repeatedly move single boundary cells between adjacent territories, accepting
// only moves that keep the puzzle uniquely solvable. Each accepted step slightly
// organicises the territory shapes without breaking the solver cascade.
function applyBorderMutations(
  map: number[][],
  solution: [number, number][],
  n: number,
  puzzle: Puzzle,
  rng: () => number,
  attempts: number,
): { map: number[][], accepted: number } {
  let cur = map;
  let accepted = 0;
  const dirs: [number,number][] = [[-1,0],[1,0],[0,-1],[0,1]];

  for (let i = 0; i < attempts; i++) {
    // Collect all movable boundary cells: non-watcher cells that border a different territory
    const candidates: [number, number, number, number][] = []; // [r, c, fromT, toT]
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const t = cur[r][c];
        if (solution[t][0] === r && solution[t][1] === c) continue; // watcher cell — never move
        for (const [dr, dc] of dirs) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
          const nt = cur[nr][nc];
          if (nt !== t) { candidates.push([r, c, t, nt]); break; }
        }
      }
    }
    if (candidates.length === 0) break;

    const [r, c, fromT, toT] = candidates[Math.floor(rng() * candidates.length)];
    if (!isConnectedWithout(cur, n, fromT, r, c)) continue; // would disconnect source

    const next = cur.map(row => [...row]);
    next[r][c] = toT;

    if (solveLogically({ ...puzzle, territoryMap: next }, 1)) {
      cur = next;
      accepted++;
    }
  }
  return { map: cur, accepted };
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
  let hard = false;
  let minContradictions = 0;
  let minScore = 0;
  let minRunup = 0;
  let maxBlobSize = 999; // default uncapped; use --max-blob-size N to experiment
  let mutateAttempts = 150; // border mutation steps after each valid puzzle is found
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--count'              && args[i+1]) count             = parseInt(args[++i]);
    if (args[i] === '--base'               && args[i+1]) base              = args[++i];
    if (args[i] === '--thin'               && args[i+1]) thin              = parseInt(args[++i]);
    if (args[i] === '--max'                && args[i+1]) maxSeeds          = parseInt(args[++i]);
    if (args[i] === '--min-difficulty'     && args[i+1]) minDifficulty     = args[++i];
    if (args[i] === '--min-contradictions' && args[i+1]) minContradictions = parseInt(args[++i]);
    if (args[i] === '--min-score'          && args[i+1]) minScore          = parseInt(args[++i]);
    if (args[i] === '--min-runup'          && args[i+1]) minRunup          = parseInt(args[++i]);
    if (args[i] === '--max-blob-size'      && args[i+1]) maxBlobSize       = parseInt(args[++i]);
    if (args[i] === '--mutate'             && args[i+1]) mutateAttempts    = parseInt(args[++i]);
    if (args[i] === '--hard')                            hard              = true;
  }
  return { count, base, thin, maxSeeds, minDifficulty, hard, minContradictions, minScore, minRunup, maxBlobSize, mutateAttempts };
}

const DIFFICULTY_RANK: Record<string, number> = {
  Initiate: 1, Scholar: 2, Occultist: 3, 'High Priest': 4, Eldritch: 5, Harbinger: 6, Archon: 7,
};

/** Re-runs the depth-1 solver, recording technique counts and the first deduction kind. */
function tracePuzzle(p: Puzzle): { firstDeduction: string; contradictions: number; runupBeforeFirstNaked: number } {
  const n = p.size;
  const cells: CellState[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => 'empty' as CellState));
  let firstDeduction = 'none';
  let contradictions = 0;
  let runupBeforeFirstNaked = 0;
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

  for (let step = 0; step < 200; step++) {
    if (isSolved(p, cells)) break;
    if (findContradictions(p, cells).found) break;
    const d = getNextDeduction(p, cells, 1);
    if (!d) break;
    let kind: string;
    if (d.type === 'watcher' && d.reasonType !== 'dual-confinement') kind = 'naked';
    else if (d.reasonType === 'hypothetical') { contradictions++; kind = 'contradiction'; }
    else if (d.reasonType === 'hidden-set-row' || d.reasonType === 'hidden-set-col') kind = 'hidden';
    else if (d.reasonType === 'dual-confinement') kind = 'dual';
    else if (d.reasonType === 'territory-dead-end') kind = 'dead-end';
    else if (d.reasonType === 'row-confinement' || d.reasonType === 'col-confinement') kind = 'confinement';
    else if (d.reasonType === 'pair-row' || d.reasonType === 'pair-col') kind = 'pair';
    else kind = 'other';
    if (firstDeduction === 'none') firstDeduction = kind;
    if (!seenNaked) {
      if (kind === 'naked') seenNaked = true;
      else runupBeforeFirstNaked++;
    }
    applyDed(d);
  }
  return { firstDeduction, contradictions, runupBeforeFirstNaked };
}

async function main() {
  const { count, base, thin, maxSeeds, minDifficulty, hard, minContradictions, minScore, minRunup, maxBlobSize, mutateAttempts } = parseArgs();
  const minRank = minDifficulty ? DIFFICULTY_RANK[minDifficulty] ?? 0 : 0;
  const n = 10;
  const filePath = join(process.cwd(), 'data', 'samplePuzzles.ts');
  let fileContent = readFileSync(filePath, 'utf-8');

  // Track seeds already used so re-running with the same base doesn't duplicate
  const usedSeeds = new Set<string>();
  for (const m of fileContent.matchAll(/"seed":"([^"]+)"/g)) usedSeeds.add(m[1]);

  process.stderr.write(`Constructive 10x10 generator: ${count} puzzles, thin=${thin}, maxBlobSize=${maxBlobSize}, max seeds=${maxSeeds}\n`);
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

    const map = generateMixedTerritoryMap(n, solution, rng, thin, hard, maxBlobSize);
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

    // Test depth-1 solvability (forward + hypothesis chains).
    const solved = solveLogically(raw, 1);
    if (!solved) {
      solveFails++;
      if (s % 100 === 0 && s > 0) process.stderr.write(`  seed ${s}: still searching (solveFails=${solveFails})\n`);
      continue;
    }

    // Border mutation pass — organicise territory shapes while preserving solvability.
    // Each step moves one boundary cell between adjacent territories and re-runs the
    // solver; only moves that keep the puzzle uniquely solvable are accepted.
    const { map: mutMap, accepted: mutAccepted } = applyBorderMutations(map, solution, n, raw, rng, mutateAttempts);
    const finalRaw: Puzzle = { ...raw, territoryMap: mutMap };
    process.stderr.write(`  seed s${s}: solver pass — ${mutAccepted}/${mutateAttempts} border mutations accepted\n`);

    // Find next available eb-10x10 ID
    fileContent = readFileSync(filePath, 'utf-8');
    const pattern = /"id":"eb-10x10-(\d+)"/g;
    const nums: number[] = [];
    for (const m of fileContent.matchAll(pattern)) nums.push(parseInt(m[1]));
    const idNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    const id = `eb-10x10-${String(idNum).padStart(3, '0')}`;
    const title = nextUnusedTitle(existingTitles(fileContent));

    const diff = rateDifficulty({ ...finalRaw, id, title });
    if (minRank > 0 && (DIFFICULTY_RANK[diff] ?? 0) < minRank) {
      if (process.env.DEBUG_DIFF) process.stderr.write(`  seed s${s}: ${diff} (below ${minDifficulty})\n`);
      continue;
    }
    // "Hard" filters: the player should not get a free first deduction, and the
    // puzzle should genuinely require contradiction reasoning.
    if (minContradictions > 0 || minScore > 0 || minRunup > 0 || hard) {
      const trace = tracePuzzle({ ...finalRaw, id, title });
      const score = scorePuzzle({ ...finalRaw, id, title });
      if (hard && trace.firstDeduction === 'naked') {
        if (process.env.DEBUG_DIFF) process.stderr.write(`  seed s${s}: first deduction is naked (rejected for --hard)\n`);
        continue;
      }
      if (minRunup > 0 && trace.runupBeforeFirstNaked < minRunup) {
        if (process.env.DEBUG_DIFF) process.stderr.write(`  seed s${s}: runup ${trace.runupBeforeFirstNaked} (need ${minRunup})\n`);
        continue;
      }
      if (minContradictions > 0 && trace.contradictions < minContradictions) {
        if (process.env.DEBUG_DIFF) process.stderr.write(`  seed s${s}: only ${trace.contradictions} contradictions (need ${minContradictions})\n`);
        continue;
      }
      if (minScore > 0 && score < minScore) {
        if (process.env.DEBUG_DIFF) process.stderr.write(`  seed s${s}: score ${score} (need ${minScore})\n`);
        continue;
      }
    }
    const cmd = [
      'generate10x10',
      `--base ${base}`,
      `--thin ${thin}`,
      `--mutate ${mutateAttempts}`,
      ...(hard               ? ['--hard']                              : []),
      ...(maxBlobSize < 999  ? [`--max-blob-size ${maxBlobSize}`]      : []),
      ...(minDifficulty      ? [`--min-difficulty ${minDifficulty}`]   : []),
      ...(minRunup > 0       ? [`--min-runup ${minRunup}`]             : []),
      ...(minContradictions > 0 ? [`--min-contradictions ${minContradictions}`] : []),
      ...(minScore > 0       ? [`--min-score ${minScore}`]             : []),
    ].join(' ');

    const { difficulty: _d, ...rest } = finalRaw;
    const entry = { ...rest, id, title, generatorCmd: cmd };

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
