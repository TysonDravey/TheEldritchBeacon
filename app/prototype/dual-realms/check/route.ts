import { NextResponse } from 'next/server';
import fs from 'fs';
import type { Puzzle, CellState } from '@/engine/boardTypes';
import { hasUniqueSolution, solveLogically, solveWithTrace } from '@/engine/solver';
import { getWatcherPositions, canPlaceWatcher, isSolved } from '@/engine/rules';
import { generatePuzzle } from '@/engine/generator';
import { DUAL_REALMS_PUZZLE } from '../lib/puzzle';
import { DUAL_REALMS_PUZZLE_SCATTERED } from '../lib/puzzle-variant-scattered';
import { DUAL_REALMS_PUZZLE_2 } from '../lib/puzzle-variant-2';
import { DUAL_REALMS_PUZZLE_3 } from '../lib/puzzle-variant-3';
import { DUAL_REALMS_PUZZLE_ONE_TILE } from '../lib/puzzle-variant-4-onetile';
import { DUAL_REALMS_PUZZLE_5 } from '../lib/puzzle-variant-5-onetile';
import { DUAL_REALMS_PUZZLE_6 } from '../lib/puzzle-variant-6-onetile';
import { DUAL_REALMS_PUZZLE_7 } from '../lib/puzzle-variant-7-onetile';
import { DUAL_REALMS_PUZZLE_MIXED } from '../lib/puzzle-variant-8-mixed';
import { DUAL_REALMS_PUZZLE_9 } from '../lib/puzzle-variant-9-mixed';
import { DUAL_REALMS_PUZZLE_10 } from '../lib/puzzle-variant-10-mixed';
import { DUAL_REALMS_PUZZLE_11 } from '../lib/puzzle-variant-11-mixed';
import { DUAL_REALMS_PUZZLE_12 } from '../lib/puzzle-variant-12-mixed3-6x6';
import { DUAL_REALMS_PUZZLE_13 } from '../lib/puzzle-variant-13-allwatcher3-6x6';
import { DUAL_REALMS_PUZZLE_14 } from '../lib/puzzle-variant-14-allwatcher3-6x6';
import { DUAL_REALMS_PUZZLE_15 } from '../lib/puzzle-variant-15-allwatcher3-6x6';
import { DUAL_REALMS_PUZZLE_16 } from '../lib/puzzle-variant-16-allwatcher3-6x6';
import { DUAL_REALMS_PUZZLE_17 } from '../lib/puzzle-variant-17-allwatcher3-6x6';
import { DUAL_REALMS_PUZZLE_18 } from '../lib/puzzle-variant-18-allwatcher3-6x6';
import { DUAL_REALMS_PUZZLE_19 } from '../lib/puzzle-variant-19-shattered3-6x6';
import { DUAL_REALMS_PUZZLE_20 } from '../lib/puzzle-variant-20-shattered3-6x6';
import { DUAL_REALMS_PUZZLE_21 } from '../lib/puzzle-variant-21-shattered3-6x6';
import { DUAL_REALMS_PUZZLE_22 } from '../lib/puzzle-variant-22-allwatcher2-6x6';
import { DUAL_REALMS_PUZZLE_24 } from '../lib/puzzle-variant-24-allwatcher2-6x6';
import { DUAL_REALMS_PUZZLE_25 } from '../lib/puzzle-variant-25-allwatcher3-6x6';
import { DUAL_REALMS_PUZZLE_26 } from '../lib/puzzle-variant-26-allwatcher2-6x6';
import { deriveTerritoryMap } from '../lib/deriveTerritoryMap';
import { tryBuildAllWatcherThreeTilePuzzle } from '../lib/allWatcherSearch';

const LIVE_PUZZLES: Record<string, typeof DUAL_REALMS_PUZZLE> = {
  '1': DUAL_REALMS_PUZZLE_SCATTERED,
  '2': DUAL_REALMS_PUZZLE_2,
  '3': DUAL_REALMS_PUZZLE_3,
  '4': DUAL_REALMS_PUZZLE_ONE_TILE,
  '5': DUAL_REALMS_PUZZLE_5,
  '6': DUAL_REALMS_PUZZLE_6,
  '7': DUAL_REALMS_PUZZLE_7,
  '8': DUAL_REALMS_PUZZLE_MIXED,
  '9': DUAL_REALMS_PUZZLE_9,
  '10': DUAL_REALMS_PUZZLE_10,
  '11': DUAL_REALMS_PUZZLE_11,
  '12': DUAL_REALMS_PUZZLE_12,
  '13': DUAL_REALMS_PUZZLE_13,
  '14': DUAL_REALMS_PUZZLE_14,
  '15': DUAL_REALMS_PUZZLE_15,
  '16': DUAL_REALMS_PUZZLE_16,
  '17': DUAL_REALMS_PUZZLE_17,
  '18': DUAL_REALMS_PUZZLE_18,
  '19': DUAL_REALMS_PUZZLE_19,
  '20': DUAL_REALMS_PUZZLE_20,
  '21': DUAL_REALMS_PUZZLE_21,
  '22': DUAL_REALMS_PUZZLE_22,
  '24': DUAL_REALMS_PUZZLE_24,
  '25': DUAL_REALMS_PUZZLE_25,
  '26': DUAL_REALMS_PUZZLE_26,
};

// A cell with 3 same-colored neighbors and one lone poke of a different
// color still reads as an obvious outlier to a human eye, even though it
// technically "borders" both colors — one adjacent match isn't enough to
// call an orientation visually plausible. Require a genuinely balanced
// corner instead: at least 2 of the 8 surrounding cells (not just the 4
// orthogonal ones) for BOTH of the tile's colors.
function isBalancedCorner(map: number[][], size: number, r: number, c: number, colorA: number, colorB: number): boolean {
  let countA = 0, countB = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      if (map[nr][nc] === colorA) countA++;
      if (map[nr][nc] === colorB) countB++;
    }
  }
  return countA >= 2 && countB >= 2;
}

// If a tile's home cell is a "bridge" holding two lobes of its own home
// territory together, showing the away color there splits that territory
// into visibly disconnected pieces — its own kind of obvious tell,
// independent of isBalancedCorner (which only looks at the tile's immediate
// neighbors, not the territory's overall shape).
function wouldFractureIfRemoved(map: number[][], size: number, color: number, r: number, c: number): boolean {
  const cells: [number, number][] = [];
  for (let rr = 0; rr < size; rr++)
    for (let cc = 0; cc < size; cc++)
      if (map[rr][cc] === color && !(rr === r && cc === c)) cells.push([rr, cc]);
  if (cells.length <= 1) return false; // nothing left to disconnect

  const cellSet = new Set(cells.map(([rr, cc]) => `${rr},${cc}`));
  const visited = new Set<string>([`${cells[0][0]},${cells[0][1]}`]);
  const stack = [cells[0]];
  while (stack.length > 0) {
    const [cr, cc] = stack.pop()!;
    for (const [nr, nc] of [[cr - 1, cc], [cr + 1, cc], [cr, cc - 1], [cr, cc + 1]] as [number, number][]) {
      const key = `${nr},${nc}`;
      if (!cellSet.has(key) || visited.has(key)) continue;
      visited.add(key);
      stack.push([nr, nc]);
    }
  }
  return visited.size !== cells.length;
}

// Straightforward connectivity check on a color's FULL current territory
// (no cell excluded) — answers "does this look like one contiguous blob
// right now", as opposed to wouldFractureIfRemoved's "would REMOVING this
// one cell break it". Needed because inserting multiple tiles at once can
// fracture a territory even though no single tile's own insertion would —
// e.g. one tile changes a cell that used to be another tile's only
// same-color neighbor, splitting that color into disconnected islands.
function isTerritoryConnected(map: number[][], size: number, color: number): boolean {
  const cells: [number, number][] = [];
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (map[r][c] === color) cells.push([r, c]);
  if (cells.length <= 1) return true;
  const cellSet = new Set(cells.map(([r, c]) => `${r},${c}`));
  const visited = new Set<string>([`${cells[0][0]},${cells[0][1]}`]);
  const stack = [cells[0]];
  while (stack.length > 0) {
    const [cr, cc] = stack.pop()!;
    for (const [nr, nc] of [[cr - 1, cc], [cr + 1, cc], [cr, cc - 1], [cr, cc + 1]] as [number, number][]) {
      const key = `${nr},${nc}`;
      if (!cellSet.has(key) || visited.has(key)) continue;
      visited.add(key);
      stack.push([nr, nc]);
    }
  }
  return visited.size === cells.length;
}

// Counts connected components (islands) for a color. Used for
// shattered-realms territories, where "is this fully connected" is the
// wrong question by design — every color is EXPECTED to have a few
// separate islands. What matters there is capping the count (2-3, not the
// "popcorn" 5-6 islands an unconstrained shattered generator can produce),
// so a Rift's flip doesn't need to hide inside a fake single-blob illusion.
function countComponents(map: number[][], size: number, color: number): number {
  const cellSet = new Set<string>();
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (map[r][c] === color) cellSet.add(`${r},${c}`);
  const visited = new Set<string>();
  let components = 0;
  for (const key of cellSet) {
    if (visited.has(key)) continue;
    components++;
    const [sr, sc] = key.split(',').map(Number);
    const stack: [number, number][] = [[sr, sc]];
    visited.add(key);
    while (stack.length > 0) {
      const [cr, cc] = stack.pop()!;
      for (const [nr, nc] of [[cr - 1, cc], [cr + 1, cc], [cr, cc - 1], [cr, cc + 1]] as [number, number][]) {
        const nk = `${nr},${nc}`;
        if (!cellSet.has(nk) || visited.has(nk)) continue;
        visited.add(nk);
        stack.push([nr, nc]);
      }
    }
  }
  return components;
}

// A tile sitting in the middle of a LONG straight run of one color reads as
// an obvious notch the instant it shows its other color — isBalancedCorner
// alone missed this because diagonal neighbors can satisfy its "2 of 8"
// count even while the tile sits dead-center in an otherwise uniform row or
// column. Rejecting on ANY 2-neighbor match (immediate left+right or
// up+down) turned out to kill nearly all candidates — most blob-edge cells
// legitimately have one or two same-color neighbors on an axis. Instead,
// measure the total straight-line run length through this cell (excluding
// the cell itself, since map is the pre-insertion territory) and only flag
// runs of 3+ cells, the egregious "carved out of a solid line" case.
function isNotchRisk(map: number[][], size: number, r: number, c: number, colorA: number, colorB: number): boolean {
  function runLength(dr: number, dc: number, color: number): number {
    let n = 0, rr = r + dr, cc = c + dc;
    while (rr >= 0 && rr < size && cc >= 0 && cc < size && map[rr][cc] === color) {
      n++; rr += dr; cc += dc;
    }
    return n;
  }
  const severeRun = (dr: number, dc: number, color: number) =>
    runLength(dr, dc, color) + runLength(-dr, -dc, color) >= 3;
  for (const color of [colorA, colorB]) {
    if (severeRun(0, 1, color) || severeRun(1, 0, color)) return true;
  }
  return false;
}

// Brute-force enumeration (reusing only canPlaceWatcher/isSolved from the real
// engine) so non-uniqueness can actually be SEEN during authoring, not just
// flagged as a boolean. Debug-only, lives entirely in this route.
function enumerateSolutions(puzzle: Puzzle, cap: number): [number, number][][] {
  const n = puzzle.size;
  const found: [number, number][][] = [];
  const cells: CellState[][] = Array.from({ length: n }, () => Array(n).fill('empty') as CellState[]);

  function backtrack(territory: number) {
    if (found.length >= cap) return;
    if (territory === n) {
      if (isSolved(puzzle, cells)) found.push(getWatcherPositions(cells));
      return;
    }
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (puzzle.territoryMap[r][c] !== territory) continue;
        if (!canPlaceWatcher(puzzle, cells, r, c)) continue;
        cells[r][c] = 'watcher';
        backtrack(territory + 1);
        cells[r][c] = 'empty';
        if (found.length >= cap) return;
      }
    }
  }
  backtrack(0);
  return found;
}

// Debug-only route for this prototype: sweeps every possible flip combination
// (2^tiles) and reports, per face, whether the resulting Beacon puzzle has a
// unique solution and whether the existing pure-logic solver (no guessing)
// can find it. This is the cheap validity check the design brief asked for —
// entirely built from the real, unmodified engine/solver.ts and
// engine/rules.ts. Not linked from any UI; hit it directly while developing:
//   GET /prototype/dual-realms/check              — full flip-combo sweep
//   GET /prototype/dual-realms/check?generate=A    — re-roll Face A's territory map
//   GET /prototype/dual-realms/check?generate=B    — re-roll Face B's territory map
//
// Authoring helper used by ?generate=: randomly searches for a territory map
// (fixed cells forced to DUAL_REALMS_PUZZLE's solution + reversible tiles'
// home colors) with a UNIQUE solution matching exactly the intended one, AND
// matching the requested per-tile "does this face need to know it" pattern.
function randomSearchTerritoryMap(
  size: number,
  face: 'A' | 'B',
  solution: [number, number][],
  /** For each tile: true = this face MUST need it correct (flip alone breaks
   *  the face); false = this face must be BLIND to it (flip alone leaves the
   *  face still uniquely solvable — just possibly to a different board — so
   *  this face's own logic can never pin the tile down; only the other
   *  face's contradiction can rule out the wrong value). */
  faceCaresAboutTile: boolean[],
  maxTries = 40000,
): number[][] | null {
  function toPuzzle(territoryMap: number[][]): Puzzle {
    return { id: 'gen', title: 'gen', mode: 'initiate', size, territoryMap, solution: [], difficulty: 'Initiate', seed: 'gen', createdAt: '' };
  }
  const { reversibleTiles } = DUAL_REALMS_PUZZLE;
  const homeColors = reversibleTiles.map(t => (face === 'A' ? t.colorOnA : t.colorOnB));
  const awayColors = reversibleTiles.map(t => (face === 'A' ? t.colorOnB : t.colorOnA));
  const tilePositions = reversibleTiles.map(t => ({ row: t.row, col: t.col }));

  const fixedKey = new Map<string, number>();
  solution.forEach(([r, c], t) => fixedKey.set(`${r},${c}`, t));
  tilePositions.forEach(({ row, col }, i) => fixedKey.set(`${row},${col}`, homeColors[i]));

  for (let attempt = 0; attempt < maxTries; attempt++) {
    const map: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const key = `${r},${c}`;
        map[r][c] = fixedKey.has(key) ? fixedKey.get(key)! : Math.floor(Math.random() * size);
      }
    }
    const puzzle = toPuzzle(map);
    if (!hasUniqueSolution(puzzle)) continue;
    const found = enumerateSolutions(puzzle, 1);
    if (found.length !== 1 || !sameCellsStandalone(found[0], solution)) continue;

    let ok = true;
    for (let i = 0; i < tilePositions.length; i++) {
      const flippedMap = map.map(row => [...row]);
      flippedMap[tilePositions[i].row][tilePositions[i].col] = awayColors[i];
      const flippedPuzzle = toPuzzle(flippedMap);
      const stillUnique = hasUniqueSolution(flippedPuzzle);
      // "cares": flipping this tile alone must break uniqueness entirely.
      // "doesn't care": flipping this tile alone must NOT break uniqueness —
      // this face's own logic accepts either value.
      if (faceCaresAboutTile[i] ? stillUnique : !stillUnique) { ok = false; break; }
    }
    if (!ok) continue;

    return map;
  }
  return null;
}
function sameCellsStandalone(a: [number, number][], b: [number, number][]): boolean {
  if (a.length !== b.length) return false;
  const key = (p: [number, number]) => `${p[0]},${p[1]}`;
  const setA = new Set(a.map(key));
  return b.every(p => setA.has(key(p)));
}

// Authoring helper: GET .../check?full=1 (blob) or ?full=shattered — builds
// a WHOLE new Dual Realms puzzle (both faces + 3 reversible tiles) from
// scratch using the real game's own generatePuzzle() for each face, so
// territories come from the actual production generator (contiguous blobs
// for mode:'initiate', or the tuned multi-seed-BFS scattered algorithm for
// mode:'shattered-realms') rather than my own crude uniform-random-per-cell
// filler from the very first version of this tool.
//
// Each face gets its own independently-generated puzzle (own solution, own
// territories). Reversible tile positions are then chosen only from cells
// satisfying the realm-continuity plausibility rule (see neighborsInclude
// below) — both of the tile's colors must border a same-colored neighbor on
// BOTH faces, so neither orientation is a visible outlier. The care/don't-care
// sensitivity requirement (which face's own logic can force this tile) is
// checked per tile per face same as before.
function tryBuildPuzzle(
  size: number,
  mode: 'initiate' | 'shattered-realms',
  caresA: boolean[],
  caresB: boolean[],
  /** Require the strict realm-continuity rule (both colors border a same-
   *  colored neighbor on both faces). Empirically this conflicts hard with
   *  the sensitivity requirement on a board this small — 0/1200 attempts
   *  passed with it on, for both blob and shattered modes. Off by default;
   *  kept as an option for future experimentation with bigger boards. */
  strictContinuity = false,
) {
  function toPuzzle(territoryMap: number[][]): Puzzle {
    return { id: 'gen', title: 'gen', mode: 'initiate', size, territoryMap, solution: [], difficulty: 'Initiate', seed: 'gen', createdAt: '' };
  }
  function cellKey(r: number, c: number) { return `${r},${c}`; }

  for (let seedAttempt = 0; seedAttempt < 60; seedAttempt++) {
    const seedA = `dual-realms-A-${Date.now()}-${seedAttempt}-${Math.random()}`;
    const seedB = `dual-realms-B-${Date.now()}-${seedAttempt}-${Math.random()}`;
    const puzzleA = generatePuzzle({ size, seed: seedA, mode });
    const puzzleB = generatePuzzle({ size, seed: seedB, mode });
    if (!puzzleA || !puzzleB) continue;

    const forbidden = new Set<string>();
    puzzleA.solution.forEach(([r, c]) => forbidden.add(cellKey(r, c)));
    puzzleB.solution.forEach(([r, c]) => forbidden.add(cellKey(r, c)));

    const openCells: [number, number][] = [];
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        if (!forbidden.has(cellKey(r, c))) openCells.push([r, c]);

    // REALM CONTINUITY RULE (optional — see strictContinuity above): a
    // reversible tile looks like a plausible extension of an existing
    // region in EITHER orientation, on BOTH faces, only if it sits on a
    // genuinely balanced corner between the two colors (see isBalancedCorner).
    const plausibleCells: { row: number; col: number; colorOnA: number; colorOnB: number }[] = [];
    for (const [r, c] of openCells) {
      const colorOnA = puzzleA.territoryMap[r][c];
      let colorOnB = puzzleB.territoryMap[r][c];
      if (colorOnB === colorOnA) {
        const neighborColors = ([[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]] as [number, number][])
          .filter(([nr, nc]) => nr >= 0 && nr < size && nc >= 0 && nc < size)
          .map(([nr, nc]) => puzzleB.territoryMap[nr][nc])
          .filter(v => v !== colorOnA);
        colorOnB = neighborColors[0] ?? (colorOnA + 1) % size;
      }
      if (strictContinuity) {
        if (!isBalancedCorner(puzzleA.territoryMap, size, r, c, colorOnA, colorOnB)) continue;
        if (!isBalancedCorner(puzzleB.territoryMap, size, r, c, colorOnA, colorOnB)) continue;
        if (wouldFractureIfRemoved(puzzleA.territoryMap, size, colorOnA, r, c)) continue;
        if (wouldFractureIfRemoved(puzzleB.territoryMap, size, colorOnB, r, c)) continue;
        if (isNotchRisk(puzzleA.territoryMap, size, r, c, colorOnA, colorOnB)) continue;
        if (isNotchRisk(puzzleB.territoryMap, size, r, c, colorOnA, colorOnB)) continue;
      }
      plausibleCells.push({ row: r, col: c, colorOnA, colorOnB });
    }
    const tileCount = caresA.length;
    if (plausibleCells.length < tileCount) continue;

    for (let posAttempt = 0; posAttempt < 60; posAttempt++) {
      // Shuffle and pick N distinct plausible positions for this attempt.
      for (let i = plausibleCells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [plausibleCells[i], plausibleCells[j]] = [plausibleCells[j], plausibleCells[i]];
      }
      const tiles = plausibleCells.slice(0, tileCount).map(t => ({ ...t }));

      let ok = true;
      for (let i = 0; i < tiles.length && ok; i++) {
        const t = tiles[i];
        const flippedA = puzzleA.territoryMap.map(row => [...row]);
        flippedA[t.row][t.col] = t.colorOnB;
        const stillUniqueA = hasUniqueSolution(toPuzzle(flippedA));
        if (caresA[i] ? stillUniqueA : !stillUniqueA) { ok = false; break; }

        const flippedB = puzzleB.territoryMap.map(row => [...row]);
        flippedB[t.row][t.col] = t.colorOnA;
        const stillUniqueB = hasUniqueSolution(toPuzzle(flippedB));
        if (caresB[i] ? stillUniqueB : !stillUniqueB) { ok = false; break; }
      }
      if (!ok) continue;

      // Final sanity: home combo (all unflipped) must be the sole working combo.
      const n = tiles.length;
      let bothUniqueCount = 0;
      let intendedWorks = false;
      for (let mask = 0; mask < (1 << n); mask++) {
        const flips = Array.from({ length: n }, (_, i) => !!(mask & (1 << i)));
        const mapA = puzzleA.territoryMap.map(row => [...row]);
        const mapB = puzzleB.territoryMap.map(row => [...row]);
        tiles.forEach((t, i) => {
          mapA[t.row][t.col] = flips[i] ? t.colorOnB : t.colorOnA;
          mapB[t.row][t.col] = flips[i] ? t.colorOnA : t.colorOnB;
        });
        const bothUnique = hasUniqueSolution(toPuzzle(mapA)) && hasUniqueSolution(toPuzzle(mapB));
        if (bothUnique) {
          bothUniqueCount++;
          if (mask === 0) intendedWorks = true;
        }
      }
      if (bothUniqueCount !== 1 || !intendedWorks) continue;

      // Unique solution is necessary but NOT sufficient — hasUniqueSolution
      // itself backtracks/guesses to find it. Require the intended (all-home)
      // combo to also be reachable by the real pure-logic solver on both
      // faces, or a player has no logical path in at all.
      const solvableA = solveLogically(toPuzzle(puzzleA.territoryMap)) !== null;
      const solvableB = solveLogically(toPuzzle(puzzleB.territoryMap)) !== null;
      if (!solvableA || !solvableB) continue;

      return {
        size,
        baseTerritoryMapA: puzzleA.territoryMap,
        baseTerritoryMapB: puzzleB.territoryMap,
        reversibleTiles: tiles,
        solutionFlips: tiles.map(() => false),
        solutionA: puzzleA.solution,
        solutionB: puzzleB.solution,
      };
    }
  }
  return null;
}

// Experiment: make the ONE reversible tile an actual watcher position on the
// face that forces it (Face A), instead of always being an ordinary
// leftover cell. This directly ties Face A's own win-check (isSolved, which
// only looks at watcher cells) to the tile's orientation — getting it wrong
// means the watcher that's supposed to be at this exact cell isn't there
// anymore, not just "some candidate got harder to find along the way".
// Face B still doesn't care about this tile (same asymmetric-blindness
// idea as the other 1-tile puzzles) — it's an ordinary cell on B's side.
function territorySize(map: number[][], color: number): number {
  let n = 0;
  for (const row of map) for (const v of row) if (v === color) n++;
  return n;
}

function tryBuildTileIsWatcherPuzzle(
  size: number,
  mode: 'initiate' | 'shattered-realms',
  strictContinuity = false,
) {
  function toPuzzle(territoryMap: number[][]): Puzzle {
    return { id: 'gen', title: 'gen', mode: 'initiate', size, territoryMap, solution: [], difficulty: 'Initiate', seed: 'gen', createdAt: '' };
  }
  for (let seedAttempt = 0; seedAttempt < 80; seedAttempt++) {
    const seedA = `dr-tw-A-${Date.now()}-${seedAttempt}-${Math.random()}`;
    const seedB = `dr-tw-B-${Date.now()}-${seedAttempt}-${Math.random()}`;
    const puzzleA = generatePuzzle({ size, seed: seedA, mode });
    const puzzleB = generatePuzzle({ size, seed: seedB, mode });
    if (!puzzleA || !puzzleB) continue;

    const candidates = [...puzzleA.solution];
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    for (const [r, c] of candidates) {
      const colorOnA = puzzleA.territoryMap[r][c]; // this cell's own true watcher territory
      // Skip singleton territories — if this cell is the ONLY cell of its
      // color, the puzzle screams the answer the instant it loads (zero
      // candidates for that color the moment the tile is wrong), which is a
      // trivial "obviously that must be it" tell, not real deduction.
      if (territorySize(puzzleA.territoryMap, colorOnA) < 3) continue;
      let colorOnB = puzzleB.territoryMap[r][c];
      if (colorOnB === colorOnA) {
        const neighborColors = ([[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]] as [number, number][])
          .filter(([nr, nc]) => nr >= 0 && nr < size && nc >= 0 && nc < size)
          .map(([nr, nc]) => puzzleB.territoryMap[nr][nc])
          .filter(v => v !== colorOnA);
        colorOnB = neighborColors[0] ?? (colorOnA + 1) % size;
      }

      if (strictContinuity) {
        if (!isBalancedCorner(puzzleA.territoryMap, size, r, c, colorOnA, colorOnB)) continue;
        if (!isBalancedCorner(puzzleB.territoryMap, size, r, c, colorOnA, colorOnB)) continue;
        if (wouldFractureIfRemoved(puzzleA.territoryMap, size, colorOnA, r, c)) continue;
        if (wouldFractureIfRemoved(puzzleB.territoryMap, size, colorOnB, r, c)) continue;
        if (isNotchRisk(puzzleA.territoryMap, size, r, c, colorOnA, colorOnB)) continue;
        if (isNotchRisk(puzzleB.territoryMap, size, r, c, colorOnA, colorOnB)) continue;
      }

      const flippedA = puzzleA.territoryMap.map(row => [...row]);
      flippedA[r][c] = colorOnB;
      // The core claim: with the tile wrong, Face A's OWN true watcher
      // placement (everything else unchanged) must no longer register as
      // solved — not just "some other arrangement exists instead".
      const stillSolvedWithWrongTile = isSolved(toPuzzle(flippedA), (() => {
        const cells: CellState[][] = Array.from({ length: size }, () => Array(size).fill('empty') as CellState[]);
        puzzleA.solution.forEach(([wr, wc]) => { cells[wr][wc] = 'watcher'; });
        return cells;
      })());
      if (stillSolvedWithWrongTile) continue;

      const flippedB = puzzleB.territoryMap.map(row => [...row]);
      flippedB[r][c] = colorOnA;
      const stillUniqueB = hasUniqueSolution(toPuzzle(flippedB)); // Face B must stay indifferent
      if (!stillUniqueB) continue;

      const solvableA = solveLogically(toPuzzle(puzzleA.territoryMap)) !== null;
      const solvableB = solveLogically(toPuzzle(puzzleB.territoryMap)) !== null;
      if (!solvableA || !solvableB) continue;

      return {
        size,
        baseTerritoryMapA: puzzleA.territoryMap,
        baseTerritoryMapB: puzzleB.territoryMap,
        reversibleTiles: [{ row: r, col: c, colorOnA, colorOnB }],
        solutionFlips: [false],
        solutionA: puzzleA.solution,
        solutionB: puzzleB.solution,
      };
    }
  }
  return null;
}

// Experiment: TWO tiles, DIFFERENT types, mixed. tile0 is a real watcher
// position on Face A (as in tryBuildTileIsWatcherPuzzle — wrong orientation
// breaks A's own isSolved check, not just its solving process). tile1 is an
// ordinary ward-only cell forced by Face B instead (as in tryBuildPuzzle's
// 3-tile design). Neither face is "always the watcher face" or "always the
// ordinary face" by construction — this just tests whether one of each kind
// can coexist in one puzzle without the combined constraints becoming
// unsatisfiable.
function tryBuildMixedTwoTilePuzzle(
  size: number,
  mode: 'initiate' | 'shattered-realms',
  strictContinuity = false,
) {
  function toPuzzle(territoryMap: number[][]): Puzzle {
    return { id: 'gen', title: 'gen', mode: 'initiate', size, territoryMap, solution: [], difficulty: 'Initiate', seed: 'gen', createdAt: '' };
  }
  function cellKey(r: number, c: number) { return `${r},${c}`; }
  function watchersOf(cells: [number, number][]): CellState[][] {
    const grid: CellState[][] = Array.from({ length: size }, () => Array(size).fill('empty') as CellState[]);
    cells.forEach(([r, c]) => { grid[r][c] = 'watcher'; });
    return grid;
  }

  // Requiring wrong-tile1 to make Face B genuinely UNSOLVABLE (a real
  // contradiction), rather than merely non-unique, turned out to collapse
  // yield to ~0 at this board size when combined with every other
  // constraint. Treat it the same way as notch risk: a soft preference.
  // Keep searching for a "clean" (genuinely unsolvable when wrong) result;
  // if the whole search budget runs out, fall back to the first candidate
  // found where wrong-tile1 only makes B ambiguous (non-unique) rather than
  // outright unsolvable — still flagged so it can be told apart.
  let fallback: ReturnType<typeof buildResult> | null = null;

  function buildResult(
    puzzleA: NonNullable<ReturnType<typeof generatePuzzle>>,
    puzzleB: NonNullable<ReturnType<typeof generatePuzzle>>,
    tiles: { row: number; col: number; colorOnA: number; colorOnB: number }[],
    notchRisk: boolean,
    ambiguousWhenTile1Wrong: boolean,
  ) {
    return {
      size,
      baseTerritoryMapA: puzzleA.territoryMap,
      baseTerritoryMapB: puzzleB.territoryMap,
      reversibleTiles: tiles,
      solutionFlips: tiles.map(() => false),
      solutionA: puzzleA.solution,
      solutionB: puzzleB.solution,
      notchRisk,
      ambiguousWhenTile1Wrong,
    };
  }

  for (let seedAttempt = 0; seedAttempt < 300; seedAttempt++) {
    const seedA = `dr-mix-A-${Date.now()}-${seedAttempt}-${Math.random()}`;
    const seedB = `dr-mix-B-${Date.now()}-${seedAttempt}-${Math.random()}`;
    const puzzleA = generatePuzzle({ size, seed: seedA, mode });
    const puzzleB = generatePuzzle({ size, seed: seedB, mode });
    if (!puzzleA || !puzzleB) continue;

    const watcherCandidates = [...puzzleA.solution];
    for (let i = watcherCandidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [watcherCandidates[i], watcherCandidates[j]] = [watcherCandidates[j], watcherCandidates[i]];
    }

    // Notch risk is a SOFT preference, not a hard filter: requiring zero
    // notch risk outright dropped yield to 0/several-hundred attempts, since
    // most blob-edge cells have some straight-line same-color run nearby.
    // Try notch-free candidates first; fall back to notchy ones (still
    // passing the harder balanced-corner + fracture checks) if that's all
    // that's available, so generation still succeeds.
    const tile0Candidates = watcherCandidates
      .map(([r0, c0]) => {
        const colorOnA0 = puzzleA.territoryMap[r0][c0];
        if (territorySize(puzzleA.territoryMap, colorOnA0) < 3) return null; // avoid singleton "obvious tell" territories
        let colorOnB0 = puzzleB.territoryMap[r0][c0];
        if (colorOnB0 === colorOnA0) {
          const nb = ([[r0 - 1, c0], [r0 + 1, c0], [r0, c0 - 1], [r0, c0 + 1]] as [number, number][])
            .filter(([nr, nc]) => nr >= 0 && nr < size && nc >= 0 && nc < size)
            .map(([nr, nc]) => puzzleB.territoryMap[nr][nc]).filter(v => v !== colorOnA0);
          colorOnB0 = nb[0] ?? (colorOnA0 + 1) % size;
        }
        if (strictContinuity && !isBalancedCorner(puzzleA.territoryMap, size, r0, c0, colorOnA0, colorOnB0)) return null;
        if (strictContinuity && !isBalancedCorner(puzzleB.territoryMap, size, r0, c0, colorOnA0, colorOnB0)) return null;
        // This cell must not be a bridge holding its own home territory
        // together on either face — removing it (when flipped away) would
        // visibly split that territory into disconnected pieces.
        if (strictContinuity && wouldFractureIfRemoved(puzzleA.territoryMap, size, colorOnA0, r0, c0)) return null;
        if (strictContinuity && wouldFractureIfRemoved(puzzleB.territoryMap, size, colorOnB0, r0, c0)) return null;
        const notchRisk = strictContinuity && (
          isNotchRisk(puzzleA.territoryMap, size, r0, c0, colorOnA0, colorOnB0) ||
          isNotchRisk(puzzleB.territoryMap, size, r0, c0, colorOnA0, colorOnB0)
        );
        return { r0, c0, colorOnA0, colorOnB0, notchRisk };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .sort((a, b) => Number(a.notchRisk) - Number(b.notchRisk));

    for (const { r0, c0, colorOnA0, colorOnB0 } of tile0Candidates) {
      // tile0 alone must break Face A's actual isSolved check when wrong, and
      // Face B must stay fully indifferent to it.
      const flippedA0 = puzzleA.territoryMap.map(row => [...row]);
      flippedA0[r0][c0] = colorOnB0;
      if (isSolved(toPuzzle(flippedA0), watchersOf(puzzleA.solution))) continue;
      const flippedB0 = puzzleB.territoryMap.map(row => [...row]);
      flippedB0[r0][c0] = colorOnA0;
      if (!hasUniqueSolution(toPuzzle(flippedB0))) continue;

      // tile1: ordinary ward-only cell, forced by Face B, Face A indifferent.
      const forbidden = new Set<string>([cellKey(r0, c0)]);
      puzzleA.solution.forEach(([r, c]) => forbidden.add(cellKey(r, c)));
      puzzleB.solution.forEach(([r, c]) => forbidden.add(cellKey(r, c)));
      const openCells: [number, number][] = [];
      for (let r = 0; r < size; r++)
        for (let c = 0; c < size; c++)
          if (!forbidden.has(cellKey(r, c))) openCells.push([r, c]);
      for (let i = openCells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [openCells[i], openCells[j]] = [openCells[j], openCells[i]];
      }

      // Same soft-preference treatment as tile0: try notch-free cells first,
      // fall back to notchy-but-otherwise-valid ones if that's all there is.
      const tile1Candidates = openCells.slice(0, 30)
        .map(([r1, c1]) => {
          const colorOnA1 = puzzleA.territoryMap[r1][c1];
          let colorOnB1 = puzzleB.territoryMap[r1][c1];
          if (colorOnB1 === colorOnA1) {
            const nb = ([[r1 - 1, c1], [r1 + 1, c1], [r1, c1 - 1], [r1, c1 + 1]] as [number, number][])
              .filter(([nr, nc]) => nr >= 0 && nr < size && nc >= 0 && nc < size)
              .map(([nr, nc]) => puzzleB.territoryMap[nr][nc]).filter(v => v !== colorOnA1);
            colorOnB1 = nb[0] ?? (colorOnA1 + 1) % size;
          }
          if (strictContinuity) {
            if (!isBalancedCorner(puzzleA.territoryMap, size, r1, c1, colorOnA1, colorOnB1)) return null;
            if (!isBalancedCorner(puzzleB.territoryMap, size, r1, c1, colorOnA1, colorOnB1)) return null;
            if (wouldFractureIfRemoved(puzzleA.territoryMap, size, colorOnA1, r1, c1)) return null;
            if (wouldFractureIfRemoved(puzzleB.territoryMap, size, colorOnB1, r1, c1)) return null;
          }
          const notchRisk = strictContinuity && (
            isNotchRisk(puzzleA.territoryMap, size, r1, c1, colorOnA1, colorOnB1) ||
            isNotchRisk(puzzleB.territoryMap, size, r1, c1, colorOnA1, colorOnB1)
          );
          return { r1, c1, colorOnA1, colorOnB1, notchRisk };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null)
        .sort((a, b) => Number(a.notchRisk) - Number(b.notchRisk));

      for (const { r1, c1, colorOnA1, colorOnB1 } of tile1Candidates) {
        const flippedA1 = puzzleA.territoryMap.map(row => [...row]);
        flippedA1[r1][c1] = colorOnB1;
        if (!hasUniqueSolution(toPuzzle(flippedA1))) continue; // A must stay indifferent
        const flippedB1 = puzzleB.territoryMap.map(row => [...row]);
        flippedB1[r1][c1] = colorOnA1;
        // B must be forced: at minimum, wrong tile1 must make B non-unique
        // (hard requirement — otherwise it's not "forced" at all).
        if (hasUniqueSolution(toPuzzle(flippedB1))) continue;
        // Best case: wrong tile1 makes B genuinely UNSOLVABLE (a real
        // contradiction). If it's merely ambiguous (multiple valid
        // arrangements exist), a player could "solve" B with tile1 still
        // wrong — flag it and keep looking for a cleaner candidate.
        const ambiguousWhenTile1Wrong = enumerateSolutions(toPuzzle(flippedB1), 1).length !== 0;

        const tiles = [
          { row: r0, col: c0, colorOnA: colorOnA0, colorOnB: colorOnB0 },
          { row: r1, col: c1, colorOnA: colorOnA1, colorOnB: colorOnB1 },
        ];

        // Full 4-combo sweep: only the all-home combo may work for both faces.
        let bothUniqueCount = 0, intendedWorks = false;
        for (let mask = 0; mask < 4; mask++) {
          const flips = [!!(mask & 1), !!(mask & 2)];
          const mapA = puzzleA.territoryMap.map(row => [...row]);
          const mapB = puzzleB.territoryMap.map(row => [...row]);
          tiles.forEach((t, i) => {
            mapA[t.row][t.col] = flips[i] ? t.colorOnB : t.colorOnA;
            mapB[t.row][t.col] = flips[i] ? t.colorOnA : t.colorOnB;
          });
          const bothUnique = hasUniqueSolution(toPuzzle(mapA)) && hasUniqueSolution(toPuzzle(mapB));
          if (bothUnique) { bothUniqueCount++; if (mask === 0) intendedWorks = true; }
        }
        if (bothUniqueCount !== 1 || !intendedWorks) continue;

        const solvableA = solveLogically(toPuzzle(puzzleA.territoryMap)) !== null;
        const solvableB = solveLogically(toPuzzle(puzzleB.territoryMap)) !== null;
        if (!solvableA || !solvableB) continue;

        const notchRisk =
          isNotchRisk(puzzleA.territoryMap, size, r0, c0, colorOnA0, colorOnB0) ||
          isNotchRisk(puzzleB.territoryMap, size, r0, c0, colorOnA0, colorOnB0) ||
          isNotchRisk(puzzleA.territoryMap, size, r1, c1, colorOnA1, colorOnB1) ||
          isNotchRisk(puzzleB.territoryMap, size, r1, c1, colorOnA1, colorOnB1);

        if (!ambiguousWhenTile1Wrong) {
          return buildResult(puzzleA, puzzleB, tiles, notchRisk, false);
        }
        if (!fallback) {
          fallback = buildResult(puzzleA, puzzleB, tiles, notchRisk, true);
        }
      }
    }
  }
  return fallback;
}

// Experiment: THREE tiles at a larger board (6x6 by default). tile0 and
// tile2 are both watcher-type — tile0 tied to Face A's own isSolved check,
// tile2 tied to Face B's — so BOTH faces get a hard, contradiction-backed
// tile instead of just one. tile1 stays the "ordinary, forced by B" type
// from the two-tile design. The hope: giving Face B its own watcher-type
// stake (not just an ordinary cell) should cut into the "solve A, then
// solve B separately" feeling, since B's win condition now also directly
// depends on getting a Facet right, not just candidate elimination.
function tryBuildMixedThreeTilePuzzle(
  size: number,
  mode: 'initiate' | 'shattered-realms',
  strictContinuity = false,
) {
  function toPuzzle(territoryMap: number[][]): Puzzle {
    return { id: 'gen', title: 'gen', mode: 'initiate', size, territoryMap, solution: [], difficulty: 'Initiate', seed: 'gen', createdAt: '' };
  }
  function cellKey(r: number, c: number) { return `${r},${c}`; }
  function watchersOf(cells: [number, number][]): CellState[][] {
    const grid: CellState[][] = Array.from({ length: size }, () => Array(size).fill('empty') as CellState[]);
    cells.forEach(([r, c]) => { grid[r][c] = 'watcher'; });
    return grid;
  }

  let fallback: ReturnType<typeof buildResult> | null = null;

  function buildResult(
    puzzleA: NonNullable<ReturnType<typeof generatePuzzle>>,
    puzzleB: NonNullable<ReturnType<typeof generatePuzzle>>,
    tiles: { row: number; col: number; colorOnA: number; colorOnB: number }[],
    notchRisk: boolean,
    ambiguousWhenTile1Wrong: boolean,
  ) {
    return {
      size,
      baseTerritoryMapA: puzzleA.territoryMap,
      baseTerritoryMapB: puzzleB.territoryMap,
      reversibleTiles: tiles,
      solutionFlips: tiles.map(() => false),
      solutionA: puzzleA.solution,
      solutionB: puzzleB.solution,
      notchRisk,
      ambiguousWhenTile1Wrong,
    };
  }

  // Shared helper: derive a plausible away-color for a cell, then run the
  // strict-continuity + notch checks. Returns null if it fails a HARD
  // filter (balanced-corner / fracture); notchRisk is a soft flag.
  function evaluateCell(
    puzzleA: NonNullable<ReturnType<typeof generatePuzzle>>,
    puzzleB: NonNullable<ReturnType<typeof generatePuzzle>>,
    r: number, c: number,
  ): { colorOnA: number; colorOnB: number; notchRisk: boolean } | null {
    const colorOnA = puzzleA.territoryMap[r][c];
    let colorOnB = puzzleB.territoryMap[r][c];
    if (colorOnB === colorOnA) {
      const nb = ([[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]] as [number, number][])
        .filter(([nr, nc]) => nr >= 0 && nr < size && nc >= 0 && nc < size)
        .map(([nr, nc]) => puzzleB.territoryMap[nr][nc]).filter(v => v !== colorOnA);
      colorOnB = nb[0] ?? (colorOnA + 1) % size;
    }
    if (strictContinuity) {
      if (!isBalancedCorner(puzzleA.territoryMap, size, r, c, colorOnA, colorOnB)) return null;
      if (!isBalancedCorner(puzzleB.territoryMap, size, r, c, colorOnA, colorOnB)) return null;
      if (wouldFractureIfRemoved(puzzleA.territoryMap, size, colorOnA, r, c)) return null;
      if (wouldFractureIfRemoved(puzzleB.territoryMap, size, colorOnB, r, c)) return null;
    }
    const notchRisk = strictContinuity && (
      isNotchRisk(puzzleA.territoryMap, size, r, c, colorOnA, colorOnB) ||
      isNotchRisk(puzzleB.territoryMap, size, r, c, colorOnA, colorOnB)
    );
    return { colorOnA, colorOnB, notchRisk };
  }

  for (let seedAttempt = 0; seedAttempt < 150; seedAttempt++) {
    const seedA = `dr-mix3-A-${Date.now()}-${seedAttempt}-${Math.random()}`;
    const seedB = `dr-mix3-B-${Date.now()}-${seedAttempt}-${Math.random()}`;
    const puzzleA = generatePuzzle({ size, seed: seedA, mode });
    const puzzleB = generatePuzzle({ size, seed: seedB, mode });
    if (!puzzleA || !puzzleB) continue;

    const watcherCandidatesA = [...puzzleA.solution];
    for (let i = watcherCandidatesA.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [watcherCandidatesA[i], watcherCandidatesA[j]] = [watcherCandidatesA[j], watcherCandidatesA[i]];
    }

    const tile0Candidates = watcherCandidatesA
      .map(([r0, c0]) => {
        const colorOnA0 = puzzleA.territoryMap[r0][c0];
        if (territorySize(puzzleA.territoryMap, colorOnA0) < 3) return null;
        const ev = evaluateCell(puzzleA, puzzleB, r0, c0);
        if (!ev) return null;
        return { r0, c0, colorOnA0: ev.colorOnA, colorOnB0: ev.colorOnB, notchRisk: ev.notchRisk };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .sort((a, b) => Number(a.notchRisk) - Number(b.notchRisk));

    for (const { r0, c0, colorOnA0, colorOnB0 } of tile0Candidates) {
      // tile0 alone must break Face A's actual isSolved check when wrong,
      // and Face B must stay fully indifferent to it.
      const flippedA0 = puzzleA.territoryMap.map(row => [...row]);
      flippedA0[r0][c0] = colorOnB0;
      if (isSolved(toPuzzle(flippedA0), watchersOf(puzzleA.solution))) continue;
      const flippedB0 = puzzleB.territoryMap.map(row => [...row]);
      flippedB0[r0][c0] = colorOnA0;
      if (!hasUniqueSolution(toPuzzle(flippedB0))) continue;

      // tile2: watcher-type on Face B, the mirror of tile0. Face A must
      // stay indifferent to it.
      const watcherCandidatesB = puzzleB.solution.filter(([r, c]) => cellKey(r, c) !== cellKey(r0, c0));
      for (let i = watcherCandidatesB.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [watcherCandidatesB[i], watcherCandidatesB[j]] = [watcherCandidatesB[j], watcherCandidatesB[i]];
      }

      const tile2Candidates = watcherCandidatesB
        .map(([r2, c2]) => {
          const colorOnB2 = puzzleB.territoryMap[r2][c2];
          if (territorySize(puzzleB.territoryMap, colorOnB2) < 3) return null;
          const ev = evaluateCell(puzzleA, puzzleB, r2, c2);
          if (!ev) return null;
          // evaluateCell treats colorOnA as "home on A" — for a
          // B-watcher tile we want colorOnB to be the true B territory,
          // so re-derive with roles swapped for clarity.
          return { r2, c2, colorOnA2: ev.colorOnA, colorOnB2: ev.colorOnB, notchRisk: ev.notchRisk };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null)
        .sort((a, b) => Number(a.notchRisk) - Number(b.notchRisk));

      for (const { r2, c2, colorOnA2, colorOnB2 } of tile2Candidates) {
        // tile2 alone must break Face B's actual isSolved check when
        // wrong, and Face A must stay fully indifferent to it.
        const flippedB2 = puzzleB.territoryMap.map(row => [...row]);
        flippedB2[r2][c2] = colorOnA2;
        if (isSolved(toPuzzle(flippedB2), watchersOf(puzzleB.solution))) continue;
        const flippedA2 = puzzleA.territoryMap.map(row => [...row]);
        flippedA2[r2][c2] = colorOnB2;
        if (!hasUniqueSolution(toPuzzle(flippedA2))) continue;

        // tile1: ordinary ward-only cell, forced by Face B, Face A indifferent.
        const forbidden = new Set<string>([cellKey(r0, c0), cellKey(r2, c2)]);
        puzzleA.solution.forEach(([r, c]) => forbidden.add(cellKey(r, c)));
        puzzleB.solution.forEach(([r, c]) => forbidden.add(cellKey(r, c)));
        const openCells: [number, number][] = [];
        for (let r = 0; r < size; r++)
          for (let c = 0; c < size; c++)
            if (!forbidden.has(cellKey(r, c))) openCells.push([r, c]);
        for (let i = openCells.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [openCells[i], openCells[j]] = [openCells[j], openCells[i]];
        }

        const tile1Candidates = openCells.slice(0, 30)
          .map(([r1, c1]) => {
            const ev = evaluateCell(puzzleA, puzzleB, r1, c1);
            if (!ev) return null;
            return { r1, c1, colorOnA1: ev.colorOnA, colorOnB1: ev.colorOnB, notchRisk: ev.notchRisk };
          })
          .filter((v): v is NonNullable<typeof v> => v !== null)
          .sort((a, b) => Number(a.notchRisk) - Number(b.notchRisk));

        for (const { r1, c1, colorOnA1, colorOnB1 } of tile1Candidates) {
          const flippedA1 = puzzleA.territoryMap.map(row => [...row]);
          flippedA1[r1][c1] = colorOnB1;
          if (!hasUniqueSolution(toPuzzle(flippedA1))) continue; // A must stay indifferent
          const flippedB1 = puzzleB.territoryMap.map(row => [...row]);
          flippedB1[r1][c1] = colorOnA1;
          if (hasUniqueSolution(toPuzzle(flippedB1))) continue; // B must be forced (at least non-unique)
          const ambiguousWhenTile1Wrong = enumerateSolutions(toPuzzle(flippedB1), 1).length !== 0;

          const tiles = [
            { row: r0, col: c0, colorOnA: colorOnA0, colorOnB: colorOnB0 },
            { row: r1, col: c1, colorOnA: colorOnA1, colorOnB: colorOnB1 },
            { row: r2, col: c2, colorOnA: colorOnA2, colorOnB: colorOnB2 },
          ];

          // Full 8-combo sweep: only the all-home combo may work for both faces.
          let bothUniqueCount = 0, intendedWorks = false;
          for (let mask = 0; mask < 8; mask++) {
            const flips = [!!(mask & 1), !!(mask & 2), !!(mask & 4)];
            const mapA = puzzleA.territoryMap.map(row => [...row]);
            const mapB = puzzleB.territoryMap.map(row => [...row]);
            tiles.forEach((t, i) => {
              mapA[t.row][t.col] = flips[i] ? t.colorOnB : t.colorOnA;
              mapB[t.row][t.col] = flips[i] ? t.colorOnA : t.colorOnB;
            });
            const bothUnique = hasUniqueSolution(toPuzzle(mapA)) && hasUniqueSolution(toPuzzle(mapB));
            if (bothUnique) { bothUniqueCount++; if (mask === 0) intendedWorks = true; }
          }
          if (bothUniqueCount !== 1 || !intendedWorks) continue;

          const solvableA = solveLogically(toPuzzle(puzzleA.territoryMap)) !== null;
          const solvableB = solveLogically(toPuzzle(puzzleB.territoryMap)) !== null;
          if (!solvableA || !solvableB) continue;

          const notchRisk =
            isNotchRisk(puzzleA.territoryMap, size, r0, c0, colorOnA0, colorOnB0) ||
            isNotchRisk(puzzleB.territoryMap, size, r0, c0, colorOnA0, colorOnB0) ||
            isNotchRisk(puzzleA.territoryMap, size, r1, c1, colorOnA1, colorOnB1) ||
            isNotchRisk(puzzleB.territoryMap, size, r1, c1, colorOnA1, colorOnB1) ||
            isNotchRisk(puzzleA.territoryMap, size, r2, c2, colorOnA2, colorOnB2) ||
            isNotchRisk(puzzleB.territoryMap, size, r2, c2, colorOnA2, colorOnB2);

          if (!ambiguousWhenTile1Wrong) {
            return buildResult(puzzleA, puzzleB, tiles, notchRisk, false);
          }
          if (!fallback) {
            fallback = buildResult(puzzleA, puzzleB, tiles, notchRisk, true);
          }
        }
      }
    }
  }
  return fallback;
}


// tryBuildAllWatcherThreeTilePuzzle moved to ../lib/allWatcherSearch.ts so it
// can also run as a standalone script (scripts/search-allwatcher3.ts),
// independent of the Next.js dev server — running it as a route handler was
// found to fully block the server (a /progress poll hung for 2+ minutes).

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const generate = url.searchParams.get('generate');
  const full = url.searchParams.get('full');

  // Live status for a long-running background generation search (see
  // tryBuildAllWatcherThreeTilePuzzle) — lets /progress/page.tsx poll and
  // show something other than a blackbox while the search runs.
  if (url.searchParams.get('progress')) {
    function readJsonFile(path: string): unknown {
      try {
        return JSON.parse(fs.readFileSync(path, 'utf-8'));
      } catch {
        return null;
      }
    }
    return NextResponse.json({
      progress: readJsonFile('/tmp/allwatcher3-6-progress.json'),
      nearMiss: readJsonFile('/tmp/allwatcher3-6-nearmiss.json'),
      twoClean: readJsonFile('/tmp/allwatcher3-6-twoclean.json'),
      fullSuccess3: readJsonFile('/tmp/allwatcher3-6-fullsuccess.json'),
      progress2: readJsonFile('/tmp/allwatcher2-6-progress.json'),
      nearMiss2: readJsonFile('/tmp/allwatcher2-6-nearmiss.json'),
      twoClean2: readJsonFile('/tmp/allwatcher2-6-twoclean.json'),
      fullSuccess2: readJsonFile('/tmp/allwatcher2-6-fullsuccess.json'),
      progress3x7: readJsonFile('/tmp/allwatcher3-7-progress.json'),
      nearMiss3x7: readJsonFile('/tmp/allwatcher3-7-nearmiss.json'),
      twoClean3x7: readJsonFile('/tmp/allwatcher3-7-twoclean.json'),
      fullSuccess3x7: readJsonFile('/tmp/allwatcher3-7-fullsuccess.json'),
    });
  }

  if (url.searchParams.get('trace')) {
    const selected = LIVE_PUZZLES[url.searchParams.get('puzzle') ?? ''] ?? DUAL_REALMS_PUZZLE;
    const { size, baseTerritoryMapA, baseTerritoryMapB, reversibleTiles, solutionFlips } = selected;
    const mapA = deriveTerritoryMap('A', baseTerritoryMapA, reversibleTiles, solutionFlips);
    const mapB = deriveTerritoryMap('B', baseTerritoryMapB, reversibleTiles, solutionFlips);
    function toP(tm: number[][]): Puzzle {
      return { id: 'trace', title: 'trace', mode: 'initiate', size, territoryMap: tm, solution: [], difficulty: 'Initiate', seed: 'trace', createdAt: '' };
    }
    const traceA = solveWithTrace(toP(mapA));
    const traceB = solveWithTrace(toP(mapB));
    const summarize = (t: ReturnType<typeof solveWithTrace>) => ({
      solved: t.solved,
      stepCount: t.steps.length,
      reasonTypes: t.steps.map(s => s.reasonType ?? 'unknown'),
      usesHypothetical: t.steps.some(s => s.reasonType === 'hypothetical'),
    });
    return NextResponse.json({ faceA: summarize(traceA), faceB: summarize(traceB) });
  }
  if (full === 'mixed') {
    const mode = url.searchParams.get('shattered') === '1' ? 'shattered-realms' : 'initiate';
    const count = Math.max(1, Math.min(10, Number(url.searchParams.get('count')) || 1));
    const strictContinuity = url.searchParams.get('strict') === '1';
    const size = Math.max(5, Math.min(8, Number(url.searchParams.get('size')) || DUAL_REALMS_PUZZLE.size));
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(tryBuildMixedTwoTilePuzzle(size, mode, strictContinuity));
    }
    const found = results.filter((r): r is NonNullable<typeof r> => r !== null);
    return NextResponse.json(
      { requested: count, found: found.length, puzzles: found },
      { status: found.length > 0 ? 200 : 404 },
    );
  }
  if (full === 'mixed3') {
    const mode = url.searchParams.get('shattered') === '1' ? 'shattered-realms' : 'initiate';
    const count = Math.max(1, Math.min(10, Number(url.searchParams.get('count')) || 1));
    const strictContinuity = url.searchParams.get('strict') === '1';
    const size = Math.max(5, Math.min(8, Number(url.searchParams.get('size')) || 6));
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(tryBuildMixedThreeTilePuzzle(size, mode, strictContinuity));
    }
    const found = results.filter((r): r is NonNullable<typeof r> => r !== null);
    return NextResponse.json(
      { requested: count, found: found.length, puzzles: found },
      { status: found.length > 0 ? 200 : 404 },
    );
  }
  if (full === 'allwatcher3') {
    const mode = url.searchParams.get('shattered') === '1' ? 'shattered-realms' : 'initiate';
    const count = Math.max(1, Math.min(10, Number(url.searchParams.get('count')) || 1));
    const strictContinuity = url.searchParams.get('strict') === '1';
    const size = Math.max(5, Math.min(8, Number(url.searchParams.get('size')) || 6));
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(await tryBuildAllWatcherThreeTilePuzzle(size, mode, strictContinuity));
    }
    const found = results.filter((r): r is NonNullable<typeof r> => r !== null);
    return NextResponse.json(
      { requested: count, found: found.length, puzzles: found },
      { status: found.length > 0 ? 200 : 404 },
    );
  }
  if (full === 'tilewatcher') {
    const mode = url.searchParams.get('shattered') === '1' ? 'shattered-realms' : 'initiate';
    const count = Math.max(1, Math.min(10, Number(url.searchParams.get('count')) || 1));
    const strictContinuity = url.searchParams.get('strict') === '1';
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(tryBuildTileIsWatcherPuzzle(DUAL_REALMS_PUZZLE.size, mode, strictContinuity));
    }
    const found = results.filter((r): r is NonNullable<typeof r> => r !== null);
    return NextResponse.json(
      { requested: count, found: found.length, puzzles: found },
      { status: found.length > 0 ? 200 : 404 },
    );
  }
  if (full) {
    const mode = full === 'shattered' ? 'shattered-realms' : 'initiate';
    const count = Math.max(1, Math.min(10, Number(url.searchParams.get('count')) || 1));
    const strictContinuity = url.searchParams.get('strict') === '1';
    const tileCount = Math.max(1, Math.min(3, Number(url.searchParams.get('tiles')) || 3));
    const caresA = tileCount === 1 ? [true] : [true, false, true];
    const caresB = tileCount === 1 ? [false] : [false, true, true];
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(tryBuildPuzzle(DUAL_REALMS_PUZZLE.size, mode, caresA, caresB, strictContinuity));
    }
    const found = results.filter((r): r is NonNullable<typeof r> => r !== null);
    return NextResponse.json(
      { requested: count, found: found.length, puzzles: found },
      { status: found.length > 0 ? 200 : 404 },
    );
  }
  if (generate === 'A' || generate === 'B') {
    const { solutionA, solutionB, size } = DUAL_REALMS_PUZZLE;
    const solution = generate === 'A' ? solutionA : solutionB;
    // tile0 -> only Face A can force it; tile1 -> only Face B can force it;
    // tile2 -> either face forces it (redundant safety net).
    const caresA = [true, false, true];
    const caresB = [false, true, true];
    const map = randomSearchTerritoryMap(size, generate, solution, generate === 'A' ? caresA : caresB);
    return NextResponse.json({ face: generate, territoryMap: map }, { status: map ? 200 : 404 });
  }
  const selectedPuzzle = LIVE_PUZZLES[url.searchParams.get('puzzle') ?? ''] ?? DUAL_REALMS_PUZZLE;
  const { size, baseTerritoryMapA, baseTerritoryMapB, reversibleTiles, solutionFlips, solutionA, solutionB } =
    selectedPuzzle;
  const n = reversibleTiles.length;

  function toPuzzle(territoryMap: number[][]): Puzzle {
    return {
      id: 'dual-realms-check',
      title: 'check',
      mode: 'initiate',
      size,
      territoryMap,
      solution: [],
      difficulty: 'Initiate',
      seed: 'check',
      createdAt: new Date().toISOString(),
    };
  }

  function sameCells(a: [number, number][], b: [number, number][]): boolean {
    if (a.length !== b.length) return false;
    const key = (p: [number, number]) => `${p[0]},${p[1]}`;
    const setA = new Set(a.map(key));
    return b.every(p => setA.has(key(p)));
  }

  const results = [];
  for (let mask = 0; mask < (1 << n); mask++) {
    const flips = Array.from({ length: n }, (_, i) => !!(mask & (1 << i)));

    const mapA = deriveTerritoryMap('A', baseTerritoryMapA, reversibleTiles, flips);
    const mapB = deriveTerritoryMap('B', baseTerritoryMapB, reversibleTiles, flips);
    const puzzleA = toPuzzle(mapA);
    const puzzleB = toPuzzle(mapB);

    const uniqueA = hasUniqueSolution(puzzleA);
    const uniqueB = hasUniqueSolution(puzzleB);
    const logicA = solveLogically(puzzleA);
    const logicB = solveLogically(puzzleB);

    const isIntended = flips.every((f, i) => f === solutionFlips[i]);

    // Report actual solution counts (capped at 3) for every combo, not just
    // the intended one — "not unique" alone doesn't say whether a wrong-flip
    // state is a hard contradiction (0 solutions, safe) or genuinely
    // ambiguous (2+ solutions, meaning a player can "solve" the board
    // without ever noticing the Facet is wrong).
    const solutionsA = !uniqueA ? enumerateSolutions(puzzleA, 3) : null;
    const solutionsB = !uniqueB ? enumerateSolutions(puzzleB, 3) : null;

    results.push({
      flips,
      isIntended,
      uniqueA,
      uniqueB,
      bothUnique: uniqueA && uniqueB,
      solvableByPureLogicA: logicA !== null,
      solvableByPureLogicB: logicB !== null,
      logicMatchesIntendedA: logicA !== null && sameCells(getWatcherPositions(logicA), solutionA),
      logicMatchesIntendedB: logicB !== null && sameCells(getWatcherPositions(logicB), solutionB),
      ...(solutionsA ? { solutionCountA: solutionsA.length, ambiguousA: solutionsA.length > 0 } : {}),
      ...(solutionsB ? { solutionCountB: solutionsB.length, ambiguousB: solutionsB.length > 0 } : {}),
      ...(isIntended && !uniqueA ? { sampleSolutionsA: solutionsA } : {}),
      ...(isIntended && !uniqueB ? { sampleSolutionsB: solutionsB } : {}),
    });
  }

  const onlyIntendedWorks =
    results.filter(r => r.bothUnique).length === 1 && results.find(r => r.bothUnique)?.isIntended === true;

  return NextResponse.json({ onlyIntendedWorks, results }, { status: 200 });
}
