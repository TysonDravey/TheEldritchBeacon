'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Board from '@/components/Board';
import type { CellState, Puzzle, ContradictionResult } from '@/engine/boardTypes';
import { canPlaceWatcher, watcherRejectionReason, isSolved } from '@/engine/rules';
import { findContradictions } from '@/engine/solver';
import { TERRITORY_COLORS, TERRITORY_NAMES } from '@/theme/colors';
import { DUAL_REALMS_PUZZLE_SCATTERED } from './lib/puzzle-variant-scattered';
import { DUAL_REALMS_PUZZLE_MIXED } from './lib/puzzle-variant-8-mixed';
import { DUAL_REALMS_PUZZLE_9 } from './lib/puzzle-variant-9-mixed';
import { DUAL_REALMS_PUZZLE_10 } from './lib/puzzle-variant-10-mixed';
import { DUAL_REALMS_PUZZLE_11 } from './lib/puzzle-variant-11-mixed';
import { DUAL_REALMS_PUZZLE_12 } from './lib/puzzle-variant-12-mixed3-6x6';
import { DUAL_REALMS_PUZZLE_19 } from './lib/puzzle-variant-19-shattered3-6x6';
import { DUAL_REALMS_PUZZLE_20 } from './lib/puzzle-variant-20-shattered3-6x6';
import { DUAL_REALMS_PUZZLE_21 } from './lib/puzzle-variant-21-shattered3-6x6';
import { DUAL_REALMS_PUZZLE_22 } from './lib/puzzle-variant-22-allwatcher2-6x6';
import { DUAL_REALMS_PUZZLE_24 } from './lib/puzzle-variant-24-allwatcher2-6x6';
import { DUAL_REALMS_PUZZLE_25 } from './lib/puzzle-variant-25-allwatcher3-6x6';
import { DUAL_REALMS_PUZZLE_26 } from './lib/puzzle-variant-26-allwatcher2-6x6';
import { deriveTerritoryMap } from './lib/deriveTerritoryMap';
import type { DualRealmsPuzzle, FaceId } from './lib/types';

const PUZZLE_OPTIONS: { label: string; puzzle: DualRealmsPuzzle; group: string }[] = [
  { label: 'Puzzle 1', puzzle: DUAL_REALMS_PUZZLE_SCATTERED, group: 'Legacy' },
  { label: 'Puzzle 8', puzzle: DUAL_REALMS_PUZZLE_MIXED, group: '5×5 · 2 Rifts · mixed types' },
  { label: 'Puzzle 9', puzzle: DUAL_REALMS_PUZZLE_9, group: '5×5 · 2 Rifts · mixed types' },
  { label: 'Puzzle 10', puzzle: DUAL_REALMS_PUZZLE_10, group: '5×5 · 2 Rifts · mixed types' },
  { label: 'Puzzle 11', puzzle: DUAL_REALMS_PUZZLE_11, group: '5×5 · 2 Rifts · mixed types' },
  { label: 'Puzzle 12', puzzle: DUAL_REALMS_PUZZLE_12, group: '6×6 · 3 Rifts · mixed types' },
  // Puzzles 13-18 removed from the picker: confirmed broken by the full
  // flip-combo sweep (checks ALL 2^3-1 non-intended combos, not just
  // single-Rift-alone flips) — every one fractures on most/all multi-Rift
  // flip combinations, most severely 5-7 of 7. Data files kept on disk;
  // not wired into LIVE_PUZZLES. Awaiting regenerated replacements.
  { label: 'Puzzle 19', puzzle: DUAL_REALMS_PUZZLE_19, group: '6×6 · 3 Rifts · shattered' },
  { label: 'Puzzle 20', puzzle: DUAL_REALMS_PUZZLE_20, group: '6×6 · 3 Rifts · shattered' },
  { label: 'Puzzle 21', puzzle: DUAL_REALMS_PUZZLE_21, group: '6×6 · 3 Rifts · shattered' },
  { label: 'Puzzle 22', puzzle: DUAL_REALMS_PUZZLE_22, group: '6×6 · 2 Rifts · all watcher-type (fully clean)' },
  // Puzzle 23 removed from the picker: confirmed broken by the full
  // flip-combo sweep — fractures when BOTH Rifts are flipped together,
  // even though it looked perfect under the old single-tile-only check.
  // Data file kept on disk for reference; not wired into LIVE_PUZZLES.
  { label: 'Puzzle 24', puzzle: DUAL_REALMS_PUZZLE_24, group: '6×6 · 2 Rifts · all watcher-type (fully clean)' },
  { label: 'Puzzle 25', puzzle: DUAL_REALMS_PUZZLE_25, group: '6×6 · 3 Rifts · all watcher-type (fully clean)' },
  { label: 'Puzzle 26', puzzle: DUAL_REALMS_PUZZLE_26, group: '6×6 · 2 Rifts · all watcher-type (fully clean)' },
];

// Group consecutive options sharing the same `group` label, keeping each
// entry's original index (selectPuzzle takes an index into the flat array).
const PUZZLE_GROUPS: { group: string; indices: number[] }[] = [];
PUZZLE_OPTIONS.forEach((opt, i) => {
  const last = PUZZLE_GROUPS[PUZZLE_GROUPS.length - 1];
  if (last && last.group === opt.group) last.indices.push(i);
  else PUZZLE_GROUPS.push({ group: opt.group, indices: [i] });
});

function emptyGrid(size: number): CellState[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, (): CellState => 'empty'));
}

// Randomize each tile's starting orientation independently, rather than
// always starting every tile flipped away from the answer — otherwise, once
// you've played more than one puzzle, "whatever's currently showing must be
// wrong" becomes a free meta-shortcut that needs no board logic at all.
// Still guards against starting fully pre-solved (nothing left to figure out).
function randomStartFlips(solutionFlips: boolean[]): boolean[] {
  let flips = solutionFlips.map(() => Math.random() < 0.5);
  if (flips.every((f, i) => f === solutionFlips[i])) {
    const i = Math.floor(Math.random() * flips.length);
    flips = flips.map((f, idx) => (idx === i ? !f : f));
  }
  return flips;
}

function toPuzzle(territoryMap: number[][], size: number): Puzzle {
  return {
    id: 'dual-realms-v1',
    title: 'Dual Realms (prototype)',
    mode: 'initiate',
    size,
    territoryMap,
    solution: [],
    difficulty: 'Initiate',
    seed: 'dual-realms-v1',
    createdAt: '',
  };
}

type FlipReveal = { delayMs: number; from: string; to: string };
// Stable empty map for the side-by-side debug view, where both Faces are
// always visible at once so there's nothing to flip-reveal.
const EMPTY_FLIP_REVEALS = new Map<string, FlipReveal>();

interface FaceProps {
  label: string;
  puzzle: Puzzle;
  cells: CellState[][];
  onWard: (row: number, col: number) => void;
  onWatcher: (row: number, col: number) => void;
  onDrag: (row: number, col: number, action: 'place' | 'remove') => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onLongPress: (row: number, col: number) => void;
  contradiction: ContradictionResult;
  solved: boolean;
  reversibleOutlines: Map<string, string>;
  flipReveals: Map<string, FlipReveal>;
  leftActive: boolean;
  rightActive: boolean;
  onFlipLeft: () => void;
  onFlipRight: () => void;
}

// The two gem halves of the board-flip control, mounted at the top edge of
// the board. Lit = currently viewing that Face (left = A, right = B);
// clicking the dim side flips the whole board over to show it.
function FlipGemButton({ leftActive, rightActive, onLeft, onRight }: {
  leftActive: boolean;
  rightActive: boolean;
  onLeft: () => void;
  onRight: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: -16, zIndex: 5, position: 'relative' }}>
      <img
        src={leftActive ? '/dual-realms/left-on.png' : '/dual-realms/left-off.png'}
        alt="Flip to Face A"
        title="Flip to Face A"
        onClick={onLeft}
        draggable={false}
        style={{ width: 52, height: 52, cursor: 'pointer', filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.6))' }}
      />
      <img
        src={rightActive ? '/dual-realms/right-on.png' : '/dual-realms/right-off.png'}
        alt="Flip to Face B"
        title="Flip to Face B"
        onClick={onRight}
        draggable={false}
        style={{ width: 52, height: 52, cursor: 'pointer', filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.6))' }}
      />
    </div>
  );
}

function FaceBoard({
  label, puzzle, cells, onWard, onWatcher, onDrag, onDragStart, onDragEnd, onLongPress,
  contradiction, solved, reversibleOutlines, flipReveals, leftActive, rightActive, onFlipLeft, onFlipRight,
}: FaceProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ fontWeight: 'bold', fontSize: 18, background: 'rgba(255,255,255,0.9)', borderRadius: 6, padding: '4px 14px' }}>
        Face {label} {solved && '— SOLVED'}
      </div>
      <FlipGemButton leftActive={leftActive} rightActive={rightActive} onLeft={onFlipLeft} onRight={onFlipRight} />
      <Board
        puzzle={puzzle}
        playerCells={cells}
        onCellWard={onWard}
        onCellWatcher={onWatcher}
        onCellDrag={onDrag}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onCellLongPress={onLongPress}
        contradiction={contradiction}
        reversibleOutlines={reversibleOutlines}
        flipReveals={flipReveals}
      />
      {contradiction.found && (
        <div style={{ color: '#8B1A1A', fontFamily: 'monospace', fontSize: 12, maxWidth: 260, textAlign: 'center' }}>
          {contradiction.message}
        </div>
      )}
    </div>
  );
}

export default function DualRealmsClient() {
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const DUAL_REALMS_PUZZLE = PUZZLE_OPTIONS[puzzleIndex].puzzle;
  const { size, baseTerritoryMapA, baseTerritoryMapB, reversibleTiles, solutionFlips } = DUAL_REALMS_PUZZLE;

  // Deterministic initial value (matches what the server renders) — the real
  // per-tile randomization happens client-only, right after mount, in the
  // effect below. Randomizing directly in this initializer would run during
  // SSR too, and since Math.random() gives a different answer server vs.
  // client, React would flag a hydration mismatch on first paint.
  const [flips, setFlips] = useState<boolean[]>(solutionFlips.map(f => !f));
  const [cellsA, setCellsA] = useState<CellState[][]>(() => emptyGrid(size));
  const [cellsB, setCellsB] = useState<CellState[][]>(() => emptyGrid(size));
  const [activeFace, setActiveFace] = useState<FaceId>('A');
  const [sideBySide, setSideBySide] = useState(false);
  const [rejection, setRejection] = useState<string | null>(null);

  // A drag gesture fires onCellDrag once per cell crossed, often faster than
  // React can re-render between calls — reading `cells` from a plain
  // closure would silently drop cells painted within the same batch (each
  // call starts from the same stale array). Refs always see the latest
  // write, matching the pattern already used for this in app/daily/page.tsx.
  const cellsARef = useRef(cellsA);
  const cellsBRef = useRef(cellsB);
  useEffect(() => { cellsARef.current = cellsA; }, [cellsA]);
  useEffect(() => { cellsBRef.current = cellsB; }, [cellsB]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setFlips(randomStartFlips(solutionFlips)); }, []);

  function selectPuzzle(index: number) {
    const p = PUZZLE_OPTIONS[index].puzzle;
    setPuzzleIndex(index);
    setCellsA(emptyGrid(p.size));
    setCellsB(emptyGrid(p.size));
    setFlips(randomStartFlips(p.solutionFlips));
    setActiveFace('A');
  }

  const territoryMapA = useMemo(
    () => deriveTerritoryMap('A', baseTerritoryMapA, reversibleTiles, flips),
    [baseTerritoryMapA, reversibleTiles, flips],
  );
  const territoryMapB = useMemo(
    () => deriveTerritoryMap('B', baseTerritoryMapB, reversibleTiles, flips),
    [baseTerritoryMapB, reversibleTiles, flips],
  );
  const puzzleA = useMemo(() => toPuzzle(territoryMapA, size), [territoryMapA, size]);
  const puzzleB = useMemo(() => toPuzzle(territoryMapB, size), [territoryMapB, size]);

  // Ring color for each reversible tile = the color it's CURRENTLY showing on
  // the OTHER face (the outline, per the design brief's core+outline mockup).
  const outlinesA = useMemo(() => {
    const map = new Map<string, string>();
    reversibleTiles.forEach((tile, i) => {
      const currentColorOnFaceB = flips[i] ? tile.colorOnA : tile.colorOnB;
      map.set(`${tile.row},${tile.col}`, TERRITORY_COLORS[currentColorOnFaceB]?.bg ?? '#999');
    });
    return map;
  }, [reversibleTiles, flips]);
  const outlinesB = useMemo(() => {
    const map = new Map<string, string>();
    reversibleTiles.forEach((tile, i) => {
      const currentColorOnFaceA = flips[i] ? tile.colorOnB : tile.colorOnA;
      map.set(`${tile.row},${tile.col}`, TERRITORY_COLORS[currentColorOnFaceA]?.bg ?? '#999');
    });
    return map;
  }, [reversibleTiles, flips]);

  const contradictionA = useMemo(() => findContradictions(puzzleA, cellsA), [puzzleA, cellsA]);
  const contradictionB = useMemo(() => findContradictions(puzzleB, cellsB), [puzzleB, cellsB]);
  const solvedA = useMemo(() => isSolved(puzzleA, cellsA), [puzzleA, cellsA]);
  const solvedB = useMemo(() => isSolved(puzzleB, cellsB), [puzzleB, cellsB]);

  const makeHandlers = useCallback(
    (
      puzzle: Puzzle,
      cells: CellState[][],
      setCells: (c: CellState[][]) => void,
      cellsRef: React.RefObject<CellState[][]>,
    ) => {
      const onDrag = (row: number, col: number, action: 'place' | 'remove') => {
        const current = cellsRef.current;
        const prev = current[row][col];
        if (action === 'place'  && prev === 'empty') {
          const next = current.map(r => [...r]);
          next[row][col] = 'ward';
          // Update the ref synchronously, not just via the effect below — a single
          // drag gesture can call onDrag several times before React re-renders
          // (coalesced pointermove events painting multiple cells in one batch), and
          // the effect only syncs the ref after commit. Without this, each call in
          // the same batch would rebuild `next` from the same stale snapshot and the
          // final setCells would clobber all but the last cell painted, matching the
          // playerStateRef.current = newState pattern in app/daily/page.tsx.
          cellsRef.current = next;
          setCells(next);
        }
        if (action === 'remove' && prev === 'ward') {
          const next = current.map(r => [...r]);
          next[row][col] = 'empty';
          cellsRef.current = next;
          setCells(next);
        }
      };
      const onWard = (row: number, col: number) => {
        const prev = cells[row][col];
        if (prev === 'watcher') return;
        const next = cells.map(r => [...r]);
        next[row][col] = prev === 'empty' ? 'ward' : 'empty';
        setCells(next);
      };
      const onWatcher = (row: number, col: number) => {
        const prev = cells[row][col];
        if (prev === 'watcher') {
          const next = cells.map(r => [...r]);
          next[row][col] = 'empty';
          setCells(next);
          return;
        }
        const testCells = prev === 'ward'
          ? cells.map((r, ri) => r.map((c, ci) => (ri === row && ci === col ? ('empty' as CellState) : c)))
          : cells;
        if (!canPlaceWatcher(puzzle, testCells, row, col)) {
          setRejection(watcherRejectionReason(puzzle, testCells, row, col));
          setTimeout(() => setRejection(null), 1600);
          const next = cells.map(r => [...r]);
          if (prev !== 'ward') next[row][col] = 'ward';
          setCells(next);
          return;
        }
        const next = testCells.map(r => [...r]);
        next[row][col] = 'watcher';
        setCells(next);
      };
      return { onWard, onWatcher, onDrag };
    },
    [],
  );

  const handlersA = makeHandlers(puzzleA, cellsA, setCellsA, cellsARef);
  const handlersB = makeHandlers(puzzleB, cellsB, setCellsB, cellsBRef);

  function flipTile(index: number) {
    setFlips(prev => prev.map((f, i) => (i === index ? !f : f)));
  }

  // Must match the rift-flip-reveal animation duration in globals.css.
  const FLIP_ANIM_MS = 520;
  // Per unit of distance from the gem button — tuned so a 6x6 board's
  // farthest corner finishes noticeably later than a cell right next to it,
  // without the whole sequence dragging past a second.
  const FLIP_STAGGER_MS = 70;
  const flipRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flipReveals, setFlipReveals] = useState<Map<string, FlipReveal>>(new Map());

  // The gem button flips the WHOLE board over to the other Face (same job as
  // the View Face A/B buttons, just with a 3D reveal). Every cell whose color
  // actually differs between the two Faces gets staged — most of the board,
  // not just the Rifts — with a delay proportional to distance from just
  // above the board's top-center, where the gem button sits, so the flip
  // visibly radiates outward from there.
  function buildBoardFlipReveals(fromMap: number[][], toMap: number[][]) {
    const anchorRow = -1.5;
    const anchorCol = (size - 1) / 2;
    const map = new Map<string, FlipReveal>();
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (fromMap[r][c] === toMap[r][c]) continue;
        const dist = Math.hypot(r - anchorRow, c - anchorCol);
        map.set(`${r},${c}`, {
          delayMs: Math.round(dist * FLIP_STAGGER_MS),
          from: TERRITORY_COLORS[fromMap[r][c]]?.bg ?? '#999',
          to:   TERRITORY_COLORS[toMap[r][c]]?.bg ?? '#999',
        });
      }
    }
    return map;
  }

  function flipToFace(target: FaceId) {
    if (activeFace === target) return;
    const fromMap = activeFace === 'A' ? territoryMapA : territoryMapB;
    const toMap = target === 'A' ? territoryMapA : territoryMapB;
    const map = buildBoardFlipReveals(fromMap, toMap);
    setActiveFace(target);
    setFlipReveals(map);
    const maxDelay = Math.max(0, ...[...map.values()].map(v => v.delayMs));
    if (flipRevealTimerRef.current) clearTimeout(flipRevealTimerRef.current);
    flipRevealTimerRef.current = setTimeout(() => {
      setFlipReveals(new Map());
    }, maxDelay + FLIP_ANIM_MS + 80);
  }

  useEffect(() => () => {
    if (flipRevealTimerRef.current) clearTimeout(flipRevealTimerRef.current);
  }, []);

  // Long-press directly on a Rift cell flips it — same tile list as the
  // button row below, just reachable without scrolling down to it. Both
  // faces share the same reversibleTiles positions, so one handler works
  // for either Board.
  const onRiftLongPress = useCallback((row: number, col: number) => {
    const idx = reversibleTiles.findIndex(t => t.row === row && t.col === col);
    if (idx !== -1) flipTile(idx);
  }, [reversibleTiles]);

  function noopDragStart() {}
  function noopDragEnd() {}

  function resetAll() {
    setCellsA(emptyGrid(size));
    setCellsB(emptyGrid(size));
    setFlips(randomStartFlips(solutionFlips));
  }

  const bothSolved = solvedA && solvedB;
  const onFlipLeft = useCallback(() => flipToFace('A'), [activeFace, territoryMapA, territoryMapB, size]);
  const onFlipRight = useCallback(() => flipToFace('B'), [activeFace, territoryMapA, territoryMapB, size]);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, fontFamily: 'sans-serif' }}>
      <div style={{ background: 'rgba(255,255,255,0.9)', borderRadius: 8, padding: '12px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Dual Realms — prototype (rough)</h1>
        <p style={{ maxWidth: 560, textAlign: 'center', fontSize: 13, opacity: 0.75, margin: 0 }}>
          Two {size}×{size} Beacon boards share {reversibleTiles.length} Rifts. Each Rift shows a big
          core color (its current territory on THIS face) and a thin outline (its color
          on the OTHER face). Click a Rift in the list below to flip it, or press and hold
          it directly on the board — both faces update at once. The gem pair at the top of
          the board flips the whole board over to the other Face. Solve both faces to win.
        </p>

        {bothSolved && (
          <div style={{ fontSize: 20, fontWeight: 'bold', color: '#2E7D32' }}>Both faces solved! 🎉</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 760 }}>
          {PUZZLE_GROUPS.map(({ group, indices }) => (
            <div key={indices[0]} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{ fontSize: 11, opacity: 0.6, minWidth: 190, textAlign: 'right' }}>{group}:</span>
              {indices.map(i => (
                <button
                  key={PUZZLE_OPTIONS[i].label}
                  onClick={() => selectPuzzle(i)}
                  disabled={i === puzzleIndex}
                  style={i === puzzleIndex ? { fontWeight: 'bold' } : undefined}
                >
                  {PUZZLE_OPTIONS[i].label}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => flipToFace('A')} disabled={activeFace === 'A' || sideBySide}>
            View Face A
          </button>
          <button onClick={() => flipToFace('B')} disabled={activeFace === 'B' || sideBySide}>
            View Face B
          </button>
          <button onClick={() => setSideBySide(s => !s)}>
            {sideBySide ? 'Hide' : 'Show'} debug side-by-side
          </button>
          <button onClick={resetAll}>Reset</button>
        </div>
      </div>

      {/* Fixed-height slot, always rendered — letting this text mount/unmount
          shifts the boards below it, which lands a double-click's second
          tap on the wrong cell the instant a rejection pops up mid-gesture. */}
      <div style={{ height: 20, color: '#8B1A1A', fontWeight: 'bold', visibility: rejection ? 'visible' : 'hidden' }}>
        {rejection || ' '}
      </div>

      <div style={{ display: 'flex', gap: 32 }}>
        {sideBySide ? (
          <>
            <FaceBoard
              label="A"
              puzzle={puzzleA}
              cells={cellsA}
              onWard={handlersA.onWard}
              onWatcher={handlersA.onWatcher}
              onDrag={handlersA.onDrag}
              onDragStart={noopDragStart}
              onDragEnd={noopDragEnd}
              onLongPress={onRiftLongPress}
              contradiction={contradictionA}
              solved={solvedA}
              reversibleOutlines={outlinesA}
              flipReveals={EMPTY_FLIP_REVEALS}
              leftActive={activeFace === 'A'}
              rightActive={activeFace === 'B'}
              onFlipLeft={onFlipLeft}
              onFlipRight={onFlipRight}
            />
            <FaceBoard
              label="B"
              puzzle={puzzleB}
              cells={cellsB}
              onWard={handlersB.onWard}
              onWatcher={handlersB.onWatcher}
              onDrag={handlersB.onDrag}
              onDragStart={noopDragStart}
              onDragEnd={noopDragEnd}
              onLongPress={onRiftLongPress}
              contradiction={contradictionB}
              solved={solvedB}
              reversibleOutlines={outlinesB}
              flipReveals={EMPTY_FLIP_REVEALS}
              leftActive={activeFace === 'A'}
              rightActive={activeFace === 'B'}
              onFlipLeft={onFlipLeft}
              onFlipRight={onFlipRight}
            />
          </>
        ) : (
          <FaceBoard
            label={activeFace}
            puzzle={activeFace === 'A' ? puzzleA : puzzleB}
            cells={activeFace === 'A' ? cellsA : cellsB}
            onWard={activeFace === 'A' ? handlersA.onWard : handlersB.onWard}
            onWatcher={activeFace === 'A' ? handlersA.onWatcher : handlersB.onWatcher}
            onDrag={activeFace === 'A' ? handlersA.onDrag : handlersB.onDrag}
            onDragStart={noopDragStart}
            onDragEnd={noopDragEnd}
            onLongPress={onRiftLongPress}
            contradiction={activeFace === 'A' ? contradictionA : contradictionB}
            solved={activeFace === 'A' ? solvedA : solvedB}
            reversibleOutlines={activeFace === 'A' ? outlinesA : outlinesB}
            flipReveals={flipReveals}
            leftActive={activeFace === 'A'}
            rightActive={activeFace === 'B'}
            onFlipLeft={onFlipLeft}
            onFlipRight={onFlipRight}
          />
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        <div style={{ fontWeight: 'bold', background: 'rgba(255,255,255,0.9)', borderRadius: 6, padding: '4px 10px', display: 'inline-block', textAlign: 'center' }}>
          Rifts
        </div>
        {reversibleTiles.map((tile, i) => {
          const flipped = flips[i];
          const currentA = flipped ? tile.colorOnB : tile.colorOnA;
          const currentB = flipped ? tile.colorOnA : tile.colorOnB;
          const nameA = TERRITORY_NAMES[currentA];
          const nameB = TERRITORY_NAMES[currentB];
          const bgA = TERRITORY_COLORS[currentA]?.bg ?? '#999';
          const bgB = TERRITORY_COLORS[currentB]?.bg ?? '#999';
          return (
            <button
              key={i}
              onClick={() => flipTile(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 12px',
                border: '2px solid #333',
                borderRadius: 6,
                cursor: 'pointer',
                background: 'white',
              }}
            >
              <span>Rift {i + 1} at ({tile.row + 1}, {tile.col + 1}):</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: bgA, border: `3px solid ${bgB}` }} />
                Face A = {nameA} (Face B = {nameB})
              </span>
              <span style={{ opacity: 0.6, fontSize: 12 }}>click to flip</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
