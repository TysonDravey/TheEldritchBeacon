import fs from 'fs';
// Relative imports (not the @/ alias) so this module works both from a
// Next.js route AND a standalone script run via `npx tsx` — matches the
// convention already used by scripts/*.ts in this repo.
import type { Puzzle, CellState } from '../../../../engine/boardTypes';
import { hasUniqueSolution, solveLogically } from '../../../../engine/solver';
import { getWatcherPositions, canPlaceWatcher, isSolved } from '../../../../engine/rules';
import { generatePuzzle } from '../../../../engine/generator';

// Extracted from check/route.ts so it can run as a standalone Node script
// (scripts/search-allwatcher3.ts), independent of the Next.js dev server.
// Node is single-threaded — running this search AS a Next.js route request
// handler was found to completely block the dev server (a live /progress
// poll hung for 2+ minutes while a search ran), even with periodic
// `await new Promise(resolve => setImmediate(resolve))` yields inside the
// loop. Running it as its own OS process sidesteps the problem entirely:
// the Next server stays free to serve the progress page the whole time.

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
// flagged as a boolean. Debug-only.
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

function territorySize(map: number[][], color: number): number {
  let n = 0;
  for (const row of map) for (const v of row) if (v === color) n++;
  return n;
}

// Experiment: THREE Rifts, ALL watcher-type (two tied to Face A's own
// win-check, one to Face B's) — no "ordinary, forced-by-B" Rift at all.
// Built in response to a confirmed bug: the ordinary-type Rift only ever
// produced AMBIGUITY when wrong (multiple valid placements still satisfy
// isSolved), never a genuine dead end — which let a player fully solve a
// puzzle without ever flipping a Rift, whenever the random start happened
// to land with the ordinary Rift wrong but the watcher Rifts already
// correct. Diagnostic instrumentation confirmed watcher-type Rifts don't
// have this problem (0 solutions when wrong, every time observed), so this
// hard-requires that explicitly instead of assuming it: every tile here
// must reduce its own face to ZERO valid solutions when wrong alone, not
// just make the true solution fail isSolved.
export async function tryBuildAllWatcherThreeTilePuzzle(
  size: number,
  mode: 'initiate' | 'shattered-realms',
  strictContinuity = false,
) {
  function toPuzzle(territoryMap: number[][]): Puzzle {
    return { id: 'gen', title: 'gen', mode: 'initiate', size, territoryMap, solution: [], difficulty: 'Initiate', seed: 'gen', createdAt: '' };
  }
  function cellKey(r: number, c: number) { return `${r},${c}`; }

  const isShattered = mode === 'shattered-realms';
  const maxIslands = 3;

  // Generation is cheap here (seconds, not the 30-40s/attempt of the mixed
  // 2-tile builder), so keep searching for a LOW-risk candidate instead of
  // returning the first thing that satisfies the math — only stop early on
  // a perfect (risk 0) find.
  type Result = {
    size: number;
    baseTerritoryMapA: number[][];
    baseTerritoryMapB: number[][];
    reversibleTiles: { row: number; col: number; colorOnA: number; colorOnB: number }[];
    solutionFlips: boolean[];
    solutionA: [number, number][];
    solutionB: [number, number][];
    visualRisk: number;
  };
  let best: Result | null = null;
  const stats = { seeds: 0, t0Passed: 0, t1Passed: 0, t2Passed: 0, visualPassed: 0, mathPassed: 0 };
  // Track the closest miss (fewest obviously-wrong-when-flipped Rifts) so
  // progress is visible mid-search instead of a total blackbox.
  let nearMiss: (Result & { obviousCount: number; obviousTotal: number }) | null = null;
  // Separately collect several examples with exactly 1 obvious Rift (2 of 3
  // clean) — the user's own playtest found that tier still playable
  // ("Puzzle 16 ... two that weren't obvious ... not bad"), so it's worth
  // saving multiple to try even while the main search keeps chasing 0.
  const twoCleanExamples: (Result & { obviousCount: number; obviousTotal: number })[] = [];
  const maxTwoCleanExamples = 6;
  // A candidate that passes EVERY check (0 obvious Rifts, hard math
  // correctness) but hasn't hit visualRisk===0 yet doesn't stop the
  // search — it's still a fully valid, playable puzzle. Save several as
  // they're found instead of waiting for the search to exhaust its budget
  // or find a "perfect" one.
  const fullSuccessExamples: Result[] = [];
  const maxFullSuccessExamples = 6;
  const searchStartTime = Date.now();
  let lastLogTime = Date.now();
  const totalSeedBudget = 12000;

  // A cell with no direct orthogonal neighbor already showing its AWAY
  // color is mathematically guaranteed to be an isolated island the
  // instant it flips — no amount of luck in the rest of the board saves
  // it. Cheap to check (4 lookups) and a NECESSARY condition, so reject on
  // it before ever reaching the expensive solver calls in
  // watcherTileHolds — pruning the search here instead of catching the
  // failure later (in anyAwayStateFractures) means the same time budget
  // explores far more candidates that actually have a chance.
  function hasOrthogonalNeighbor(map: number[][], size: number, r: number, c: number, color: number): boolean {
    return ([[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]] as [number, number][])
      .some(([nr, nc]) => nr >= 0 && nr < size && nc >= 0 && nc < size && map[nr][nc] === color);
  }

  // Watcher-type tile positions are pinned to actual solution cells — far
  // less freedom than an ordinary tile's "any open cell" choice, so hard
  // continuity filters here starved the search (0/6 successes with them
  // hard; 5/5 in under 2s with them off entirely). Score visual risk
  // instead (0 = clean, higher = worse) and use it only to prefer the
  // least-risky candidate first; never hard-reject on it — EXCEPT the
  // orthogonal-neighbor check above, which is a hard reject regardless.
  function evaluateCell(
    puzzleA: NonNullable<ReturnType<typeof generatePuzzle>>,
    puzzleB: NonNullable<ReturnType<typeof generatePuzzle>>,
    r: number, c: number,
  ): { colorOnA: number; colorOnB: number; visualRisk: number } | null {
    const colorOnA = puzzleA.territoryMap[r][c];
    let colorOnB = puzzleB.territoryMap[r][c];
    if (colorOnB === colorOnA) {
      const nb = ([[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]] as [number, number][])
        .filter(([nr, nc]) => nr >= 0 && nr < size && nc >= 0 && nc < size)
        .map(([nr, nc]) => puzzleB.territoryMap[nr][nc]).filter(v => v !== colorOnA);
      colorOnB = nb[0] ?? (colorOnA + 1) % size;
    }
    if (!isShattered) {
      if (!hasOrthogonalNeighbor(puzzleA.territoryMap, size, r, c, colorOnB)) return null;
      if (!hasOrthogonalNeighbor(puzzleB.territoryMap, size, r, c, colorOnA)) return null;
    }
    let visualRisk = 0;
    if (strictContinuity) {
      if (!isBalancedCorner(puzzleA.territoryMap, size, r, c, colorOnA, colorOnB)) visualRisk++;
      if (!isBalancedCorner(puzzleB.territoryMap, size, r, c, colorOnA, colorOnB)) visualRisk++;
      if (wouldFractureIfRemoved(puzzleA.territoryMap, size, colorOnA, r, c)) visualRisk++;
      if (wouldFractureIfRemoved(puzzleB.territoryMap, size, colorOnB, r, c)) visualRisk++;
      if (isNotchRisk(puzzleA.territoryMap, size, r, c, colorOnA, colorOnB)) visualRisk++;
      if (isNotchRisk(puzzleB.territoryMap, size, r, c, colorOnA, colorOnB)) visualRisk++;
    }
    return { colorOnA, colorOnB, visualRisk };
  }

  // evaluateCell (and its per-candidate visualRisk) checks each tile in
  // ISOLATION against the pristine pre-insertion map — it can't see that a
  // DIFFERENT tile's insertion might change one of ITS neighbors. Two tiles
  // sitting next to each other can silently fracture a territory that way
  // (confirmed in the field: two adjacent Rifts, one tile's insertion
  // turned the other's only remaining same-color neighbor into a different
  // color, splitting that color's territory into two disconnected pieces —
  // invisible to any single-tile check). Re-verify against the FULLY
  // combined home-state map once all three tiles are chosen. A genuine
  // fracture here is a hard reject, not just a risk point — it's an
  // objectively broken-looking board, not a borderline case.
  function combinedRisk(
    mapA: number[][], mapB: number[][],
    tiles: { row: number; col: number; colorOnA: number; colorOnB: number }[],
  ): { risk: number; fractured: boolean } {
    const homeA = mapA.map(row => [...row]);
    const homeB = mapB.map(row => [...row]);
    tiles.forEach(t => { homeA[t.row][t.col] = t.colorOnA; homeB[t.row][t.col] = t.colorOnB; });
    let risk = 0;
    let fractured = false;
    // Check EVERY color on the board, not just ones a tile's home value
    // equals — a tile's insertion can fracture a DIFFERENT territory too,
    // by stealing away a cell that territory used to occupy in the raw
    // base map (the color that used to be there before insertion isn't
    // necessarily any tile's colorOnA/colorOnB).
    for (let color = 0; color < size; color++) {
      if (!isTerritoryConnected(homeA, size, color)) fractured = true;
      if (!isTerritoryConnected(homeB, size, color)) fractured = true;
    }
    for (const t of tiles) {
      // Bridge-cell check (would the AWAY state, missing this cell, fracture it).
      if (wouldFractureIfRemoved(homeA, size, t.colorOnA, t.row, t.col)) fractured = true;
      if (wouldFractureIfRemoved(homeB, size, t.colorOnB, t.row, t.col)) fractured = true;
      if (!isBalancedCorner(homeA, size, t.row, t.col, t.colorOnA, t.colorOnB)) risk++;
      if (!isBalancedCorner(homeB, size, t.row, t.col, t.colorOnA, t.colorOnB)) risk++;
      if (isNotchRisk(homeA, size, t.row, t.col, t.colorOnA, t.colorOnB)) risk++;
      if (isNotchRisk(homeB, size, t.row, t.col, t.colorOnA, t.colorOnB)) risk++;
    }
    return { risk, fractured };
  }

  // Checking only "one tile flipped alone" states missed a real case: two
  // ADJACENT Rifts can each lean on the OTHER'S still-home-colored cell for
  // contiguity, passing every single-flip check — but flip them BOTH away
  // at once (a state a random start, or a player experimenting, can
  // genuinely reach) and that mutual support disappears, fracturing the
  // board. Sweep EVERY non-intended flip combination (2^n - 1 of them, not
  // just the n single-tile ones) and count how many look visually broken.
  function countObviousCombos(
    mapA: number[][], mapB: number[][],
    tiles: { row: number; col: number; colorOnA: number; colorOnB: number }[],
  ): { count: number; total: number } {
    const n = tiles.length;
    const total = (1 << n) - 1; // excludes mask 0 (the intended, all-home state)
    let obvious = 0;
    for (let mask = 1; mask <= total; mask++) {
      const testA = mapA.map(row => [...row]);
      const testB = mapB.map(row => [...row]);
      tiles.forEach((t, i) => {
        const away = !!(mask & (1 << i));
        testA[t.row][t.col] = away ? t.colorOnB : t.colorOnA;
        testB[t.row][t.col] = away ? t.colorOnA : t.colorOnB;
      });
      let fractured = false;
      for (let color = 0; color < size && !fractured; color++) {
        if (!isTerritoryConnected(testA, size, color)) fractured = true;
        if (!isTerritoryConnected(testB, size, color)) fractured = true;
      }
      if (fractured) obvious++;
    }
    return { count: obvious, total };
  }

  // Verify a watcher-type tile: wrong-alone must reduce ITS OWN face to
  // zero solutions (a real dead end), and leave the OTHER face uniquely
  // solvable (indifferent).
  function watcherTileHolds(
    puzzleOwn: NonNullable<ReturnType<typeof generatePuzzle>>,
    puzzleOther: NonNullable<ReturnType<typeof generatePuzzle>>,
    r: number, c: number, colorOwnHome: number, colorOwnAway: number, colorOtherAway: number,
  ): boolean {
    const flippedOwn = puzzleOwn.territoryMap.map(row => [...row]);
    flippedOwn[r][c] = colorOwnAway;
    if (enumerateSolutions(toPuzzle(flippedOwn), 1).length !== 0) return false;
    const flippedOther = puzzleOther.territoryMap.map(row => [...row]);
    flippedOther[r][c] = colorOtherAway;
    if (!hasUniqueSolution(toPuzzle(flippedOther))) return false;
    return true;
  }

  for (let seedAttempt = 0; seedAttempt < totalSeedBudget; seedAttempt++) {
    // Yield periodically so a caller running this in a loop (or an async
    // context sharing the event loop with other work) doesn't starve it.
    if (seedAttempt % 3 === 0) {
      await new Promise(resolve => setImmediate(resolve));
    }

    const seedA = `dr-aw3-A-${Date.now()}-${seedAttempt}-${Math.random()}`;
    const seedB = `dr-aw3-B-${Date.now()}-${seedAttempt}-${Math.random()}`;
    const puzzleA = generatePuzzle({ size, seed: seedA, mode });
    const puzzleB = generatePuzzle({ size, seed: seedB, mode });
    if (!puzzleA || !puzzleB) continue;
    stats.seeds++;

    if (Date.now() - lastLogTime > 5000) {
      lastLogTime = Date.now();
      const progress = {
        ...stats,
        totalSeedBudget,
        bestNearMissObvious: nearMiss ? nearMiss.obviousCount : null,
        twoCleanCount: twoCleanExamples.length,
        elapsedSec: Math.round((Date.now() - searchStartTime) / 1000),
      };
      console.log('[allwatcher3 progress]', JSON.stringify(progress));
      try {
        fs.writeFileSync(`/tmp/allwatcher3-${size}-progress.json`, JSON.stringify(progress, null, 2));
      } catch { /* best-effort, ignore write failures */ }
    }

    // Shattered-realms territories are non-contiguous BY DESIGN — "is this
    // fully connected" is the wrong question there, and an unconstrained
    // shattered generator can produce 5-6 islands per color ("popcorn").
    // Cap it: every color gets at most maxIslands separate islands, so a
    // Rift's flip creating "one more island" doesn't stand out — the board
    // already normally looks like that.
    if (isShattered) {
      let islandsOk = true;
      for (let color = 0; color < size && islandsOk; color++) {
        if (countComponents(puzzleA.territoryMap, size, color) > maxIslands) islandsOk = false;
        if (countComponents(puzzleB.territoryMap, size, color) > maxIslands) islandsOk = false;
      }
      if (!islandsOk) continue;
    }

    const candidatesA = [...puzzleA.solution];
    for (let i = candidatesA.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidatesA[i], candidatesA[j]] = [candidatesA[j], candidatesA[i]];
    }

    const evalA = candidatesA
      .map(([r, c]) => {
        const colorOnA = puzzleA.territoryMap[r][c];
        if (territorySize(puzzleA.territoryMap, colorOnA) < 3) return null;
        const ev = evaluateCell(puzzleA, puzzleB, r, c);
        if (!ev) return null;
        return { r, c, colorOnA: ev.colorOnA, colorOnB: ev.colorOnB, visualRisk: ev.visualRisk };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .sort((a, b) => a.visualRisk - b.visualRisk);

    // Need two DISTINCT watcher-on-A candidates that both independently hold.
    for (let i0 = 0; i0 < evalA.length; i0++) {
      const t0 = evalA[i0];
      if (!watcherTileHolds(puzzleA, puzzleB, t0.r, t0.c, t0.colorOnA, t0.colorOnB, t0.colorOnA)) continue;
      stats.t0Passed++;

      for (let i1 = 0; i1 < evalA.length; i1++) {
        if (i1 === i0) continue;
        const t1 = evalA[i1];
        // t1's own check must still hold with t0 already present (t0's
        // cell untouched here since it's a different territory/cell).
        if (!watcherTileHolds(puzzleA, puzzleB, t1.r, t1.c, t1.colorOnA, t1.colorOnB, t1.colorOnA)) continue;
        stats.t1Passed++;

        const candidatesB = puzzleB.solution.filter(
          ([r, c]) => cellKey(r, c) !== cellKey(t0.r, t0.c) && cellKey(r, c) !== cellKey(t1.r, t1.c),
        );
        for (let i = candidatesB.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [candidatesB[i], candidatesB[j]] = [candidatesB[j], candidatesB[i]];
        }

        const evalB = candidatesB
          .map(([r, c]) => {
            const colorOnB = puzzleB.territoryMap[r][c];
            if (territorySize(puzzleB.territoryMap, colorOnB) < 3) return null;
            const ev = evaluateCell(puzzleA, puzzleB, r, c);
            if (!ev) return null;
            return { r, c, colorOnA: ev.colorOnA, colorOnB: ev.colorOnB, visualRisk: ev.visualRisk };
          })
          .filter((v): v is NonNullable<typeof v> => v !== null)
          .sort((a, b) => a.visualRisk - b.visualRisk);

        for (const t2 of evalB) {
          if (!watcherTileHolds(puzzleB, puzzleA, t2.r, t2.c, t2.colorOnB, t2.colorOnA, t2.colorOnB)) continue;
          stats.t2Passed++;

          const tiles = [
            { row: t0.r, col: t0.c, colorOnA: t0.colorOnA, colorOnB: t0.colorOnB },
            { row: t1.r, col: t1.c, colorOnA: t1.colorOnA, colorOnB: t1.colorOnB },
            { row: t2.r, col: t2.c, colorOnA: t2.colorOnA, colorOnB: t2.colorOnB },
          ];

          // Cheap flood-fill checks FIRST, before the expensive backtracking
          // solver calls below (8x hasUniqueSolution + 2x solveLogically per
          // candidate) — "does this look obviously wrong" is by far the
          // most common rejection reason, so filtering on it first lets the
          // same time budget explore far more candidates.
          let visualRisk = 0;
          if (isShattered) {
            // Shattered territories are non-contiguous by design, so "does
            // this fracture a blob" is the wrong test — check that flipping
            // any single Rift doesn't push a color's island count well past
            // the established norm (a small +1 buffer over maxIslands).
            let islandsOk = true;
            for (let i = 0; i < tiles.length && islandsOk; i++) {
              const testA = puzzleA.territoryMap.map(row => [...row]);
              const testB = puzzleB.territoryMap.map(row => [...row]);
              tiles.forEach((t, j) => {
                const away = j === i;
                testA[t.row][t.col] = away ? t.colorOnB : t.colorOnA;
                testB[t.row][t.col] = away ? t.colorOnA : t.colorOnB;
              });
              for (let color = 0; color < size && islandsOk; color++) {
                if (countComponents(testA, size, color) > maxIslands + 1) islandsOk = false;
                if (countComponents(testB, size, color) > maxIslands + 1) islandsOk = false;
              }
            }
            if (!islandsOk) continue;
          } else {
            const combined = combinedRisk(puzzleA.territoryMap, puzzleB.territoryMap, tiles);
            if (combined.fractured) continue;
            const { count: obviousCount, total: obviousTotal } = countObviousCombos(puzzleA.territoryMap, puzzleB.territoryMap, tiles);
            if (obviousCount > 0) {
              const candidate = {
                size,
                baseTerritoryMapA: puzzleA.territoryMap,
                baseTerritoryMapB: puzzleB.territoryMap,
                reversibleTiles: tiles,
                solutionFlips: tiles.map(() => false),
                solutionA: puzzleA.solution,
                solutionB: puzzleB.solution,
                visualRisk: combined.risk,
                obviousCount,
                obviousTotal,
              };
              if (!nearMiss || obviousCount < nearMiss.obviousCount) {
                nearMiss = candidate;
                console.log('[allwatcher3 near-miss]', JSON.stringify({ seeds: stats.seeds, obviousCount, obviousTotal }));
                try {
                  fs.writeFileSync(`/tmp/allwatcher3-${size}-nearmiss.json`, JSON.stringify(nearMiss, null, 2));
                } catch { /* best-effort, ignore write failures */ }
              }
              if (obviousCount === 1 && twoCleanExamples.length < maxTwoCleanExamples) {
                twoCleanExamples.push(candidate);
                console.log('[allwatcher3 two-clean]', JSON.stringify({ seeds: stats.seeds, count: twoCleanExamples.length }));
                try {
                  fs.writeFileSync(`/tmp/allwatcher3-${size}-twoclean.json`, JSON.stringify(twoCleanExamples, null, 2));
                } catch { /* best-effort, ignore write failures */ }
              }
              continue;
            }
            visualRisk = combined.risk;
          }
          stats.visualPassed++;

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
          stats.mathPassed++;

          const thisCandidate: Result = {
            size,
            baseTerritoryMapA: puzzleA.territoryMap,
            baseTerritoryMapB: puzzleB.territoryMap,
            reversibleTiles: tiles,
            solutionFlips: tiles.map(() => false),
            solutionA: puzzleA.solution,
            solutionB: puzzleB.solution,
            visualRisk,
          };
          if (!best || visualRisk < best.visualRisk) {
            best = thisCandidate;
          }
          if (fullSuccessExamples.length < maxFullSuccessExamples) {
            fullSuccessExamples.push(thisCandidate);
            console.log('[allwatcher3 full-success]', JSON.stringify({ seeds: stats.seeds, count: fullSuccessExamples.length, visualRisk }));
            try {
              fs.writeFileSync(`/tmp/allwatcher3-${size}-fullsuccess.json`, JSON.stringify(fullSuccessExamples, null, 2));
            } catch { /* best-effort, ignore write failures */ }
          }
          if (visualRisk === 0) {
            console.log('[allwatcher3 stats]', JSON.stringify(stats), 'found risk-0');
            return best;
          }
        }
      }
    }
  }
  console.log('[allwatcher3 stats]', JSON.stringify(stats), best ? `found risk-${best.visualRisk}` : 'not found');
  return best;
}

// Same design as tryBuildAllWatcherThreeTilePuzzle but with TWO Rifts
// instead of three (one tied to Face A's win-check, one to Face B's) — no
// second A-tied Rift. The 3-Rift version needs 3 independent rare events
// (each Rift individually non-obvious when flipped) to align at once,
// which empirical search found close to a wall (0/38+ in large batches).
// Dropping to 2 needs only 2 to align — should be meaningfully easier to
// hit "all clean", especially now with the orthogonal-neighbor pre-filter
// (hasOrthogonalNeighbor) that didn't exist when the original 2-Rift
// "mixed type" puzzles (8-11) were built.
export async function tryBuildAllWatcherTwoTilePuzzle(
  size: number,
  mode: 'initiate' | 'shattered-realms',
  strictContinuity = false,
) {
  function toPuzzle(territoryMap: number[][]): Puzzle {
    return { id: 'gen', title: 'gen', mode: 'initiate', size, territoryMap, solution: [], difficulty: 'Initiate', seed: 'gen', createdAt: '' };
  }

  const isShattered = mode === 'shattered-realms';
  const maxIslands = 3;

  type Result = {
    size: number;
    baseTerritoryMapA: number[][];
    baseTerritoryMapB: number[][];
    reversibleTiles: { row: number; col: number; colorOnA: number; colorOnB: number }[];
    solutionFlips: boolean[];
    solutionA: [number, number][];
    solutionB: [number, number][];
    visualRisk: number;
  };
  let best: Result | null = null;
  const stats = { seeds: 0, t0Passed: 0, t1Passed: 0, visualPassed: 0, mathPassed: 0 };
  let nearMiss: (Result & { obviousCount: number; obviousTotal: number }) | null = null;
  const twoCleanExamples: (Result & { obviousCount: number; obviousTotal: number })[] = [];
  const maxTwoCleanExamples = 6;
  const fullSuccessExamples: Result[] = [];
  const maxFullSuccessExamples = 6;
  const searchStartTime = Date.now();
  let lastLogTime = Date.now();
  const totalSeedBudget = 12000;

  function hasOrthogonalNeighbor(map: number[][], size: number, r: number, c: number, color: number): boolean {
    return ([[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]] as [number, number][])
      .some(([nr, nc]) => nr >= 0 && nr < size && nc >= 0 && nc < size && map[nr][nc] === color);
  }

  function evaluateCell(
    puzzleA: NonNullable<ReturnType<typeof generatePuzzle>>,
    puzzleB: NonNullable<ReturnType<typeof generatePuzzle>>,
    r: number, c: number,
  ): { colorOnA: number; colorOnB: number; visualRisk: number } | null {
    const colorOnA = puzzleA.territoryMap[r][c];
    let colorOnB = puzzleB.territoryMap[r][c];
    if (colorOnB === colorOnA) {
      const nb = ([[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]] as [number, number][])
        .filter(([nr, nc]) => nr >= 0 && nr < size && nc >= 0 && nc < size)
        .map(([nr, nc]) => puzzleB.territoryMap[nr][nc]).filter(v => v !== colorOnA);
      colorOnB = nb[0] ?? (colorOnA + 1) % size;
    }
    if (!isShattered) {
      if (!hasOrthogonalNeighbor(puzzleA.territoryMap, size, r, c, colorOnB)) return null;
      if (!hasOrthogonalNeighbor(puzzleB.territoryMap, size, r, c, colorOnA)) return null;
    }
    let visualRisk = 0;
    if (strictContinuity) {
      if (!isBalancedCorner(puzzleA.territoryMap, size, r, c, colorOnA, colorOnB)) visualRisk++;
      if (!isBalancedCorner(puzzleB.territoryMap, size, r, c, colorOnA, colorOnB)) visualRisk++;
      if (wouldFractureIfRemoved(puzzleA.territoryMap, size, colorOnA, r, c)) visualRisk++;
      if (wouldFractureIfRemoved(puzzleB.territoryMap, size, colorOnB, r, c)) visualRisk++;
      if (isNotchRisk(puzzleA.territoryMap, size, r, c, colorOnA, colorOnB)) visualRisk++;
      if (isNotchRisk(puzzleB.territoryMap, size, r, c, colorOnA, colorOnB)) visualRisk++;
    }
    return { colorOnA, colorOnB, visualRisk };
  }

  function combinedRisk(
    mapA: number[][], mapB: number[][],
    tiles: { row: number; col: number; colorOnA: number; colorOnB: number }[],
  ): { risk: number; fractured: boolean } {
    const homeA = mapA.map(row => [...row]);
    const homeB = mapB.map(row => [...row]);
    tiles.forEach(t => { homeA[t.row][t.col] = t.colorOnA; homeB[t.row][t.col] = t.colorOnB; });
    let risk = 0;
    let fractured = false;
    for (let color = 0; color < size; color++) {
      if (!isTerritoryConnected(homeA, size, color)) fractured = true;
      if (!isTerritoryConnected(homeB, size, color)) fractured = true;
    }
    for (const t of tiles) {
      if (wouldFractureIfRemoved(homeA, size, t.colorOnA, t.row, t.col)) fractured = true;
      if (wouldFractureIfRemoved(homeB, size, t.colorOnB, t.row, t.col)) fractured = true;
      if (!isBalancedCorner(homeA, size, t.row, t.col, t.colorOnA, t.colorOnB)) risk++;
      if (!isBalancedCorner(homeB, size, t.row, t.col, t.colorOnA, t.colorOnB)) risk++;
      if (isNotchRisk(homeA, size, t.row, t.col, t.colorOnA, t.colorOnB)) risk++;
      if (isNotchRisk(homeB, size, t.row, t.col, t.colorOnA, t.colorOnB)) risk++;
    }
    return { risk, fractured };
  }

  // Sweeps EVERY non-intended flip combination (2^n - 1, not just the n
  // single-tile ones) — two adjacent Rifts can each pass single-flip checks
  // by leaning on the OTHER'S still-home-colored cell, but fail when BOTH
  // are flipped away together and that mutual support disappears.
  function countObviousCombos(
    mapA: number[][], mapB: number[][],
    tiles: { row: number; col: number; colorOnA: number; colorOnB: number }[],
  ): { count: number; total: number } {
    const n = tiles.length;
    const total = (1 << n) - 1;
    let obvious = 0;
    for (let mask = 1; mask <= total; mask++) {
      const testA = mapA.map(row => [...row]);
      const testB = mapB.map(row => [...row]);
      tiles.forEach((t, i) => {
        const away = !!(mask & (1 << i));
        testA[t.row][t.col] = away ? t.colorOnB : t.colorOnA;
        testB[t.row][t.col] = away ? t.colorOnA : t.colorOnB;
      });
      let fractured = false;
      for (let color = 0; color < size && !fractured; color++) {
        if (!isTerritoryConnected(testA, size, color)) fractured = true;
        if (!isTerritoryConnected(testB, size, color)) fractured = true;
      }
      if (fractured) obvious++;
    }
    return { count: obvious, total };
  }

  function watcherTileHolds(
    puzzleOwn: NonNullable<ReturnType<typeof generatePuzzle>>,
    puzzleOther: NonNullable<ReturnType<typeof generatePuzzle>>,
    r: number, c: number, colorOwnAway: number, colorOtherAway: number,
  ): boolean {
    const flippedOwn = puzzleOwn.territoryMap.map(row => [...row]);
    flippedOwn[r][c] = colorOwnAway;
    if (enumerateSolutions(toPuzzle(flippedOwn), 1).length !== 0) return false;
    const flippedOther = puzzleOther.territoryMap.map(row => [...row]);
    flippedOther[r][c] = colorOtherAway;
    if (!hasUniqueSolution(toPuzzle(flippedOther))) return false;
    return true;
  }

  for (let seedAttempt = 0; seedAttempt < totalSeedBudget; seedAttempt++) {
    if (seedAttempt % 3 === 0) {
      await new Promise(resolve => setImmediate(resolve));
    }

    const seedA = `dr-aw2-A-${Date.now()}-${seedAttempt}-${Math.random()}`;
    const seedB = `dr-aw2-B-${Date.now()}-${seedAttempt}-${Math.random()}`;
    const puzzleA = generatePuzzle({ size, seed: seedA, mode });
    const puzzleB = generatePuzzle({ size, seed: seedB, mode });
    if (!puzzleA || !puzzleB) continue;
    stats.seeds++;

    if (Date.now() - lastLogTime > 5000) {
      lastLogTime = Date.now();
      const progress = {
        ...stats,
        totalSeedBudget,
        bestNearMissObvious: nearMiss ? nearMiss.obviousCount : null,
        twoCleanCount: twoCleanExamples.length,
        elapsedSec: Math.round((Date.now() - searchStartTime) / 1000),
      };
      console.log('[allwatcher2 progress]', JSON.stringify(progress));
      try {
        fs.writeFileSync(`/tmp/allwatcher2-${size}-progress.json`, JSON.stringify(progress, null, 2));
      } catch { /* best-effort, ignore write failures */ }
    }

    if (isShattered) {
      let islandsOk = true;
      for (let color = 0; color < size && islandsOk; color++) {
        if (countComponents(puzzleA.territoryMap, size, color) > maxIslands) islandsOk = false;
        if (countComponents(puzzleB.territoryMap, size, color) > maxIslands) islandsOk = false;
      }
      if (!islandsOk) continue;
    }

    const candidatesA = [...puzzleA.solution];
    for (let i = candidatesA.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidatesA[i], candidatesA[j]] = [candidatesA[j], candidatesA[i]];
    }

    const evalA = candidatesA
      .map(([r, c]) => {
        const colorOnA = puzzleA.territoryMap[r][c];
        if (territorySize(puzzleA.territoryMap, colorOnA) < 3) return null;
        const ev = evaluateCell(puzzleA, puzzleB, r, c);
        if (!ev) return null;
        return { r, c, colorOnA: ev.colorOnA, colorOnB: ev.colorOnB, visualRisk: ev.visualRisk };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .sort((a, b) => a.visualRisk - b.visualRisk);

    for (const t0 of evalA) {
      if (!watcherTileHolds(puzzleA, puzzleB, t0.r, t0.c, t0.colorOnB, t0.colorOnA)) continue;
      stats.t0Passed++;

      const candidatesB = puzzleB.solution.filter(([r, c]) => `${r},${c}` !== `${t0.r},${t0.c}`);
      for (let i = candidatesB.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidatesB[i], candidatesB[j]] = [candidatesB[j], candidatesB[i]];
      }

      const evalB = candidatesB
        .map(([r, c]) => {
          const colorOnB = puzzleB.territoryMap[r][c];
          if (territorySize(puzzleB.territoryMap, colorOnB) < 3) return null;
          const ev = evaluateCell(puzzleA, puzzleB, r, c);
          if (!ev) return null;
          return { r, c, colorOnA: ev.colorOnA, colorOnB: ev.colorOnB, visualRisk: ev.visualRisk };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null)
        .sort((a, b) => a.visualRisk - b.visualRisk);

      for (const t1 of evalB) {
        if (!watcherTileHolds(puzzleB, puzzleA, t1.r, t1.c, t1.colorOnA, t1.colorOnB)) continue;
        stats.t1Passed++;

        const tiles = [
          { row: t0.r, col: t0.c, colorOnA: t0.colorOnA, colorOnB: t0.colorOnB },
          { row: t1.r, col: t1.c, colorOnA: t1.colorOnA, colorOnB: t1.colorOnB },
        ];

        let visualRisk = 0;
        if (isShattered) {
          let islandsOk = true;
          for (let i = 0; i < tiles.length && islandsOk; i++) {
            const testA = puzzleA.territoryMap.map(row => [...row]);
            const testB = puzzleB.territoryMap.map(row => [...row]);
            tiles.forEach((t, j) => {
              const away = j === i;
              testA[t.row][t.col] = away ? t.colorOnB : t.colorOnA;
              testB[t.row][t.col] = away ? t.colorOnA : t.colorOnB;
            });
            for (let color = 0; color < size && islandsOk; color++) {
              if (countComponents(testA, size, color) > maxIslands + 1) islandsOk = false;
              if (countComponents(testB, size, color) > maxIslands + 1) islandsOk = false;
            }
          }
          if (!islandsOk) continue;
        } else {
          const combined = combinedRisk(puzzleA.territoryMap, puzzleB.territoryMap, tiles);
          if (combined.fractured) continue;
          const { count: obviousCount, total: obviousTotal } = countObviousCombos(puzzleA.territoryMap, puzzleB.territoryMap, tiles);
          if (obviousCount > 0) {
            const candidate = {
              size,
              baseTerritoryMapA: puzzleA.territoryMap,
              baseTerritoryMapB: puzzleB.territoryMap,
              reversibleTiles: tiles,
              solutionFlips: tiles.map(() => false),
              solutionA: puzzleA.solution,
              solutionB: puzzleB.solution,
              visualRisk: combined.risk,
              obviousCount,
              obviousTotal,
            };
            if (!nearMiss || obviousCount < nearMiss.obviousCount) {
              nearMiss = candidate;
              console.log('[allwatcher2 near-miss]', JSON.stringify({ seeds: stats.seeds, obviousCount, obviousTotal }));
              try {
                fs.writeFileSync(`/tmp/allwatcher2-${size}-nearmiss.json`, JSON.stringify(nearMiss, null, 2));
              } catch { /* best-effort, ignore write failures */ }
            }
            if (obviousCount === 1 && twoCleanExamples.length < maxTwoCleanExamples) {
              twoCleanExamples.push(candidate);
              try {
                fs.writeFileSync(`/tmp/allwatcher2-${size}-twoclean.json`, JSON.stringify(twoCleanExamples, null, 2));
              } catch { /* best-effort, ignore write failures */ }
            }
            continue;
          }
          visualRisk = combined.risk;
        }
        stats.visualPassed++;

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
        stats.mathPassed++;

        const thisCandidate: Result = {
          size,
          baseTerritoryMapA: puzzleA.territoryMap,
          baseTerritoryMapB: puzzleB.territoryMap,
          reversibleTiles: tiles,
          solutionFlips: tiles.map(() => false),
          solutionA: puzzleA.solution,
          solutionB: puzzleB.solution,
          visualRisk,
        };
        if (!best || visualRisk < best.visualRisk) {
          best = thisCandidate;
        }
        if (fullSuccessExamples.length < maxFullSuccessExamples) {
          fullSuccessExamples.push(thisCandidate);
          console.log('[allwatcher2 full-success]', JSON.stringify({ seeds: stats.seeds, count: fullSuccessExamples.length, visualRisk }));
          try {
            fs.writeFileSync(`/tmp/allwatcher2-${size}-fullsuccess.json`, JSON.stringify(fullSuccessExamples, null, 2));
          } catch { /* best-effort, ignore write failures */ }
        }
        if (visualRisk === 0) {
          console.log('[allwatcher2 stats]', JSON.stringify(stats), 'found risk-0');
          return best;
        }
      }
    }
  }
  console.log('[allwatcher2 stats]', JSON.stringify(stats), best ? `found risk-${best.visualRisk}` : 'not found');
  return best;
}
