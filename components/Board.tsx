'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { Puzzle, CellState, ContradictionResult } from '@/engine/boardTypes';
import Cell from './Cell';
import BoardCanvas from './BoardCanvas';


interface BoardProps {
  puzzle: Puzzle;
  playerCells: CellState[][];
  onCellWard: (row: number, col: number) => void;
  onCellWatcher: (row: number, col: number) => void;
  onCellDrag?: (row: number, col: number, action: 'place' | 'remove') => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  /** Optional: fires after holding a cell still for ~500ms. Used by the
   *  Dual Realms prototype to flip a reversible tile via long-press;
   *  unused (and thus never wired up, so no behavior change) elsewhere. */
  onCellLongPress?: (row: number, col: number) => void;
  primaryCell?: [number, number];
  highlightCells?: [number, number][];
  secondaryHighlightCells?: [number, number][];
  highlightTerritories?: number[];
  secondaryHighlightTerritories?: number[];
  highlightRows?: number[];
  highlightCols?: number[];
  hintActive?: boolean;
  contradiction?: ContradictionResult;
  flashCells?: [number, number][];
  ghostCells?: [number, number][];
  ghostWardCells?: [number, number][];
  constraintWardCells?: [number, number][];
  isCompleted?: boolean;
  isFreshWin?: boolean;
  /** Optional: per-cell outline colors, keyed "row,col". Used by the Dual
   *  Realms prototype to mark reversible tiles; unused elsewhere. */
  reversibleOutlines?: Map<string, string>;
  /** Optional: per-cell 3D flip-reveal stagings, keyed "row,col". Used by
   *  the Dual Realms prototype's "flip all" gem button; unused elsewhere. */
  flipReveals?: Map<string, { delayMs: number; from: string; to: string }>;
}

// Red outline — only explicit cells and territories, NOT rows/cols
function isCellOutlined(
  row: number, col: number, territory: number,
  highlightCells?: [number, number][],
  highlightTerritories?: number[],
): boolean {
  if (highlightCells?.some(([r, c]) => r === row && c === col)) return true;
  if (highlightTerritories?.includes(territory)) return true;
  return false;
}

// Lit up (not dimmed) — all sources including rows/cols
function isCellLit(
  row: number, col: number, territory: number,
  highlightCells?: [number, number][],
  highlightTerritories?: number[],
  highlightRows?: number[],
  highlightCols?: number[],
): boolean {
  if (isCellOutlined(row, col, territory, highlightCells, highlightTerritories)) return true;
  if (highlightRows?.includes(row)) return true;
  if (highlightCols?.includes(col)) return true;
  return false;
}

function isCellContradiction(row: number, col: number, contradiction?: ContradictionResult): boolean {
  if (!contradiction?.found) return false;
  return contradiction.affectedCells?.some(([r, c]) => r === row && c === col) ?? false;
}

export default function Board({
  puzzle,
  playerCells,
  onCellWard,
  onCellWatcher,
  onCellDrag,
  onDragStart,
  onDragEnd,
  onCellLongPress,
  primaryCell,
  highlightCells,
  secondaryHighlightCells,
  highlightTerritories,
  secondaryHighlightTerritories,
  highlightRows,
  highlightCols,
  hintActive = false,
  contradiction,
  flashCells,
  ghostCells,
  ghostWardCells,
  constraintWardCells,
  isCompleted = false,
  isFreshWin = false,
  reversibleOutlines,
  flipReveals,
}: BoardProps) {
  const { size, territoryMap } = puzzle;

  // Keep latest versions in refs so stable handlers don't go stale
  const onCellWardRef    = useRef(onCellWard);
  const onCellWatcherRef = useRef(onCellWatcher);
  const onCellDragRef    = useRef(onCellDrag);
  const onDragStartRef   = useRef(onDragStart);
  const onDragEndRef     = useRef(onDragEnd);
  const onCellLongPressRef = useRef(onCellLongPress);
  const playerCellsRef   = useRef(playerCells);
  useEffect(() => { onCellWardRef.current    = onCellWard;    }, [onCellWard]);
  useEffect(() => { onCellWatcherRef.current = onCellWatcher; }, [onCellWatcher]);
  useEffect(() => { onCellDragRef.current    = onCellDrag;    }, [onCellDrag]);
  useEffect(() => { onDragStartRef.current   = onDragStart;   }, [onDragStart]);
  useEffect(() => { onDragEndRef.current     = onDragEnd;     }, [onDragEnd]);
  useEffect(() => { onCellLongPressRef.current = onCellLongPress; }, [onCellLongPress]);
  useEffect(() => { playerCellsRef.current   = playerCells;   }, [playerCells]);

  const pointerDownRef  = useRef(false);
  const isDraggingRef   = useRef(false);
  const startPosRef     = useRef({ x: 0, y: 0 });
  const prevDragPosRef  = useRef({ x: 0, y: 0 });
  const dragActionRef   = useRef<'place' | 'remove'>('place');
  const pointerTypeRef  = useRef<string>('mouse');
  const visitedDragCellsRef = useRef<Set<string>>(new Set());
  const clickTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef         = useRef<{ x: number; y: number; time: number; row: number; col: number } | null>(null);
  const doubletapFiredRef  = useRef(false);
  const longPressTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef  = useRef(false);
  const LONG_PRESS_MS = 500;
  const boardHandledUpRef  = useRef(false);
  const lastCacheBuildRef  = useRef(0);
  const boardRef = useRef<HTMLDivElement>(null);

  // Cache of cell screen rects, rebuilt fresh at the start of every pointer gesture (see
  // handlePointerDown) plus on mount/resize as a baseline so it's never empty before the
  // first interaction. elementFromPoint is unreliable with preserve-3d and transparent tile
  // corners; using getBoundingClientRect per cell is exact regardless of 3D transforms.
  type CellRect = { row: number; col: number; left: number; top: number; right: number; bottom: number };
  const cellRectsRef = useRef<CellRect[]>([]);

  function buildCellCache() {
    if (!boardRef.current) return;
    const els = boardRef.current.querySelectorAll<HTMLElement>('[data-cell="true"]');
    const cache: CellRect[] = [];
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const row = parseInt(el.dataset.row ?? '-1', 10);
      const col = parseInt(el.dataset.col ?? '-1', 10);
      if (row >= 0 && col >= 0) cache.push({ row, col, left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    }
    cellRectsRef.current = cache;
    lastCacheBuildRef.current = Date.now();
  }

  // Rebuild at the start of a gesture, but throttled. A full board's worth of
  // getBoundingClientRect() calls (forced synchronous layout reads) on every single tap is a
  // real, size-scaling cost — noticeably slow on an 8x8+ board on a modest phone, since it's
  // paid on every tap and every drag-start, not just occasionally. The staleness this guards
  // against (layout shifting shortly after mount — a font or image settling in late) only
  // matters in the first moment of a session, not on every gesture for the rest of a long play
  // session, so rebuilding at most once a second is plenty to catch it without paying the full
  // cost on every tap.
  const CACHE_REBUILD_THROTTLE_MS = 1000;
  function buildCellCacheThrottled() {
    if (Date.now() - lastCacheBuildRef.current < CACHE_REBUILD_THROTTLE_MS) return;
    buildCellCache();
  }

  // Baseline cache on mount and whenever the board resizes (orientation change, zoom, etc.) —
  // handlePointerDown rebuilds it again per-gesture (throttled), so this just covers the window
  // before the first interaction.
  useEffect(() => {
    buildCellCache();
    const ro = new ResizeObserver(() => buildCellCache());
    if (boardRef.current) ro.observe(boardRef.current);
    return () => ro.disconnect();
  }, [size]);

  function getCellAtPoint(x: number, y: number): { row: number; col: number } | null {
    // Check every cell rather than returning the first match — the rotateX() tilt's
    // horizontal keystoning (cells lean outward from center under perspective) makes
    // neighboring cells' bounding boxes overlap by a couple px, worse toward the board's
    // edges. In that overlap zone, first-DOM-order-wins can resolve a tap to the wrong
    // neighbor; nearest-center disambiguates correctly instead.
    let best: { row: number; col: number } | null = null;
    let bestCenterDist = Infinity;
    for (const c of cellRectsRef.current) {
      if (x >= c.left && x < c.right && y >= c.top && y < c.bottom) {
        const cx = (c.left + c.right) / 2;
        const cy = (c.top + c.bottom) / 2;
        const d = (x - cx) ** 2 + (y - cy) ** 2;
        if (d < bestCenterDist) { bestCenterDist = d; best = { row: c.row, col: c.col }; }
      }
    }
    if (best) return best;

    // Fall back to the nearest cell within a tolerance for a tap landing just outside
    // every cell's box. The perspective tilt also shrinks far (low-row) cells noticeably
    // relative to near ones — e.g. ~30x36px vs ~40x42px on a 10x10 board — so a fixed
    // tolerance needs enough slack for the smallest cells on the board, not just to cover
    // sub-pixel rounding gaps.
    const NEAR_PX = 10;
    let bestDist = NEAR_PX;
    for (const c of cellRectsRef.current) {
      const dx = x < c.left ? c.left - x : x > c.right  ? x - c.right  : 0;
      const dy = y < c.top  ? c.top  - y : y > c.bottom ? y - c.bottom : 0;
      const dist = Math.max(dx, dy);
      if (dist < bestDist) { bestDist = dist; best = { row: c.row, col: c.col }; }
    }
    return best;
  }

  function wiggleCell(row: number, col: number) {
    const cellEl = document.querySelector(`[data-cell="true"][data-row="${row}"][data-col="${col}"]`);
    if (!cellEl) return;
    // Double-rAF restarts the CSS animation without a forced synchronous reflow.
    // (offsetWidth/offsetHeight flush layout and can stall the main thread for 1–2 s
    //  on a 3-D board with CSS masks; rAF defers to after the current paint.)
    cellEl.classList.remove('tile-wiggle');
    requestAnimationFrame(() => requestAnimationFrame(() => cellEl.classList.add('tile-wiggle')));
  }

  function applyDragWard(row: number, col: number) {
    const key = `${row},${col}`;
    if (visitedDragCellsRef.current.has(key)) return;
    visitedDragCellsRef.current.add(key);
    // Use the dedicated drag callback — it reads playerStateRef (always fresh) and only
    // places or only removes; the toggle-based onCellWard is never called during drags.
    if (onCellDragRef.current) {
      onCellDragRef.current(row, col, dragActionRef.current);
      // No wiggleCell here — offsetWidth forces a synchronous reflow per cell during drag
    }
  }

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    // setPointerCapture can throw (NotFoundError) if the browser doesn't consider this
    // pointer id "active" at the moment of the call — seen with some stylus/multi-touch
    // sequences. It's a nice-to-have (keeps the gesture tracking this element through a
    // drag that leaves the board's bounds), not a correctness requirement — the rest of
    // the gesture logic works fine without it, so a failure here shouldn't abort the tap.
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not fatal, see above */ }

    // Throttled rebuild — see buildCellCacheThrottled for why this isn't unconditional.
    buildCellCacheThrottled();

    // Cancel the double-tap expiry timer so lastTapRef doesn't get cleared mid-gesture.
    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }

    pointerDownRef.current  = true;
    isDraggingRef.current   = false;
    visitedDragCellsRef.current = new Set();
    startPosRef.current     = { x: e.clientX, y: e.clientY };
    pointerTypeRef.current  = e.pointerType;

    const cell = getCellAtPoint(e.clientX, e.clientY);
    if (!cell) return;

    // Detect double-tap either by proximity (raw pixels — finger position varies on
    // mobile) or by both taps resolving to the same cell. Same-cell is the more
    // reliable signal on the board's smaller, perspective-shrunk back rows: a fixed
    // pixel radius tuned against a ~42px front-row cell is proportionally huge there,
    // but still lets a tap drift onto a neighboring back-row cell; comparing resolved
    // cells (via the same nearest-center hit-test real taps use) catches that
    // correctly regardless of row size. Always target the cell tap A actually landed
    // on, not tap B's.
    const now  = Date.now();
    const last = lastTapRef.current;
    if (last && now - last.time < 900) {
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const sameCell = last.row === cell.row && last.col === cell.col;
      if (dist < 50 || sameCell) {
        doubletapFiredRef.current = true;
        lastTapRef.current = null;
        onCellWatcherRef.current(last.row, last.col);
        return;
      }
    }

    const state = playerCellsRef.current[cell.row]?.[cell.col];
    dragActionRef.current = state === 'ward' ? 'remove' : 'place';

    // Long-press: only armed when a consumer actually wants it (Dual Realms'
    // Rift-flip gesture) — cancelled below on drag or early pointerUp, so a
    // plain tap/double-tap/drag never triggers it.
    if (onCellLongPressRef.current) {
      longPressFiredRef.current = false;
      const pressRow = cell.row, pressCol = cell.col;
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        if (!pointerDownRef.current || isDraggingRef.current) return;
        longPressFiredRef.current = true;
        onCellLongPressRef.current?.(pressRow, pressCol);
      }, LONG_PRESS_MS);
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerDownRef.current) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;

    // Touch contact points naturally drift a few px during a still tap — an 8px threshold
    // (fine for a precise mouse) misclassifies ordinary taps as drags on a finger, which
    // drops them from the double-tap sequence (a drag's pointerUp never records lastTapRef).
    const dragThreshold = pointerTypeRef.current === 'touch' ? 16 : 8;
    if (!isDraggingRef.current && (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold)) {
      isDraggingRef.current = true;
      onDragStartRef.current?.();
      // Cancel double-tap expiry timer and clear last-tap so drag doesn't accidentally
      // trigger double-tap on the next pointer-down.
      if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
      lastTapRef.current = null;
      // A real drag means this was never a long-press-and-hold.
      if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
      // Start interpolation from the actual drag origin so the full path is covered,
      // including cells crossed in the first 8px before drag mode was detected.
      prevDragPosRef.current = { x: startPosRef.current.x, y: startPosRef.current.y };
    }

    if (isDraggingRef.current) {
      // Chrome's getCoalescedEvents() always returns at least the current event, even when no
      // real OS-level batching happened — so "coalesced events exist" does NOT mean "no gap to
      // fill." At medium drag speed the browser is fast enough that consecutive points land
      // 30-50px apart, but not fast enough to trigger real coalescing, so a single-entry
      // "coalesced" list combined with skipping interpolation silently jumped clean over
      // several cells. Slow drags avoid this because consecutive points are naturally close;
      // fast drags avoid it because the browser actually does coalesce multiple real samples.
      // Fix: always interpolate every segment of the path (prevDragPos -> each waypoint in
      // turn), regardless of whether those waypoints came from real coalescing or not.
      const rawEvents = e.nativeEvent.getCoalescedEvents?.() ?? [];
      const waypoints: { x: number; y: number }[] = rawEvents.length > 0
        ? rawEvents.map(ev => ({ x: ev.clientX, y: ev.clientY }))
        : [{ x: e.clientX, y: e.clientY }];

      const points: { x: number; y: number }[] = [];
      let segStart = prevDragPosRef.current;
      for (const waypoint of waypoints) {
        const dist  = Math.sqrt((waypoint.x - segStart.x) ** 2 + (waypoint.y - segStart.y) ** 2);
        const steps = Math.max(1, Math.ceil(dist / 6));
        for (let i = 1; i <= steps; i++) {
          points.push({
            x: segStart.x + (waypoint.x - segStart.x) * (i / steps),
            y: segStart.y + (waypoint.y - segStart.y) * (i / steps),
          });
        }
        segStart = waypoint;
      }

      for (const pt of points) {
        const cell = getCellAtPoint(pt.x, pt.y);
        if (cell) applyDragWard(cell.row, cell.col);
      }
      prevDragPosRef.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!pointerDownRef.current) return;
    boardHandledUpRef.current = true;
    pointerDownRef.current = false;

    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }

    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      onDragEndRef.current?.();
      return;
    }

    const cell = getCellAtPoint(e.clientX, e.clientY);
    if (!cell) return;

    // Long-press already fired its own action in pointerDown's timer — don't
    // also place a ward on release.
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }

    // Double-tap was already handled in pointerDown — just clean up and return
    if (doubletapFiredRef.current) {
      doubletapFiredRef.current = false;
      return;
    }

    wiggleCell(cell.row, cell.col);

    // Record screen position + the cell it resolved to for double-tap detection
    // (position tolerates finger drift; the cell itself stays anchored to this tap).
    lastTapRef.current = { x: e.clientX, y: e.clientY, time: Date.now(), row: cell.row, col: cell.col };

    // Place/remove ward immediately — no delay. If a double-tap follows within 900ms,
    // handleCellWatcher reads the updated state and handles ward→watcher correctly.
    const state = playerCellsRef.current[cell.row]?.[cell.col];
    if (state !== 'watcher') onCellWardRef.current(cell.row, cell.col);

    // Timer only expires the double-tap window (no pending action to fire)
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      lastTapRef.current    = null;
    }, 900);
  }, []);


  useEffect(() => () => {
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  }, []);

  // Safety net: reset drag state whenever the pointer is released anywhere on the page.
  // Must cover pointercancel as well as pointerup — mobile browsers (iOS especially)
  // fire cancel instead of up when a gesture gets interrupted (the system taking over
  // for an edge-swipe, a multi-touch conflict, Safari's own scroll-vs-drag
  // resolution). Without this, isDraggingRef.current can get stuck true forever: every
  // later applyChange hard-codes `solved = dragging ? false : isSolved(...)`, so a
  // stuck flag silently blocks win detection from then on, and Restart/Undo's
  // ref-sync effect also skips its update while dragging, so a stuck flag there made
  // Restart visually clear the board while the stale ref quietly resurrected it on the
  // next tap.
  useEffect(() => {
    const onGlobalUp = () => {
      if (!pointerDownRef.current) return;
      pointerDownRef.current  = false;
      isDraggingRef.current   = false;
      visitedDragCellsRef.current = new Set();
      if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
      if (!boardHandledUpRef.current) {
        if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
      }
      boardHandledUpRef.current = false;
    };
    window.addEventListener('pointerup', onGlobalUp);
    window.addEventListener('pointercancel', onGlobalUp);
    return () => {
      window.removeEventListener('pointerup', onGlobalUp);
      window.removeEventListener('pointercancel', onGlobalUp);
    };
  }, []);

  return (
    <div style={{ perspective: '700px', perspectiveOrigin: '50% 50%' }}>
    <div
      ref={boardRef}
      className="game-board inline-block border-2 cursor-pointer"
      style={{
        lineHeight: 0,
        touchAction: 'none',
        borderColor: 'rgba(26, 18, 9, 0.75)',
        boxShadow: '14px 40px 28px rgba(0, 0, 0, 0.9), 5px 12px 8px rgba(0, 0, 0, 0.75)',
        transform: 'rotateX(18deg)',
        transformOrigin: 'center center',
        position: 'relative',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <BoardCanvas puzzle={puzzle} />
      {Array.from({ length: size }, (_, row) => (
        <div key={row} className="flex">
          {Array.from({ length: size }, (_, col) => {
            const territory = territoryMap[row][col];
            const state     = playerCells[row]?.[col] ?? 'empty';

            const outlined = isCellOutlined(row, col, territory, highlightCells, highlightTerritories);
            const lit = outlined || isCellLit(row, col, territory, highlightCells, highlightTerritories, highlightRows, highlightCols);
            const isPrimary = primaryCell ? primaryCell[0] === row && primaryCell[1] === col : false;
            const secondaryHighlighted = !outlined && !isPrimary && (
              (secondaryHighlightCells?.some(([r, c]) => r === row && c === col) ?? false) ||
              (secondaryHighlightTerritories?.includes(territory) ?? false)
            );
            const isGhost          = ghostCells?.some((cell) => cell != null && cell[0] === row && cell[1] === col) ?? false;
            const isGhostWard      = ghostWardCells?.some((cell) => cell != null && cell[0] === row && cell[1] === col) ?? false;
            const isConstraintWard = constraintWardCells?.some((cell) => cell != null && cell[0] === row && cell[1] === col) ?? false;

            return (
              <Cell
                key={col}
                row={row}
                col={col}
                territory={territory}
                state={state}
                isCompleted={isCompleted}
                isFreshWin={isFreshWin}
                isHighlighted={outlined}
                isSecondaryHighlighted={secondaryHighlighted}
                isDimmed={hintActive && !lit && !secondaryHighlighted && !isPrimary && !isGhost && !isGhostWard && !isConstraintWard}
                isPrimaryHint={isPrimary}
                isContradiction={isCellContradiction(row, col, contradiction)}
                isFlash={flashCells?.some(([r, c]) => r === row && c === col) ?? false}
                isGhost={isGhost}
                isGhostWard={isGhostWard}
                isConstraintWard={isConstraintWard}
                reversibleOutline={reversibleOutlines?.get(`${row},${col}`)}
                flipReveal={flipReveals?.get(`${row},${col}`)}
                size={size}
                thickTop={row === 0          || territoryMap[row - 1][col] !== territory}
                thickBottom={row === size - 1 || territoryMap[row + 1][col] !== territory}
                thickLeft={col === 0          || territoryMap[row][col - 1] !== territory}
                thickRight={col === size - 1  || territoryMap[row][col + 1] !== territory}
              />
            );
          })}
        </div>
      ))}
    </div>
    </div>
  );
}
