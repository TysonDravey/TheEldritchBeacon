'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { Puzzle, CellState, ContradictionResult } from '@/engine/boardTypes';
import Cell from './Cell';


interface BoardProps {
  puzzle: Puzzle;
  playerCells: CellState[][];
  onCellWard: (row: number, col: number) => void;
  onCellWatcher: (row: number, col: number) => void;
  onCellDrag?: (row: number, col: number, action: 'place' | 'remove') => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
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
}: BoardProps) {
  const { size, territoryMap } = puzzle;

  // Keep latest versions in refs so stable handlers don't go stale
  const onCellWardRef    = useRef(onCellWard);
  const onCellWatcherRef = useRef(onCellWatcher);
  const onCellDragRef    = useRef(onCellDrag);
  const onDragStartRef   = useRef(onDragStart);
  const onDragEndRef     = useRef(onDragEnd);
  const playerCellsRef   = useRef(playerCells);
  useEffect(() => { onCellWardRef.current    = onCellWard;    }, [onCellWard]);
  useEffect(() => { onCellWatcherRef.current = onCellWatcher; }, [onCellWatcher]);
  useEffect(() => { onCellDragRef.current    = onCellDrag;    }, [onCellDrag]);
  useEffect(() => { onDragStartRef.current   = onDragStart;   }, [onDragStart]);
  useEffect(() => { onDragEndRef.current     = onDragEnd;     }, [onDragEnd]);
  useEffect(() => { playerCellsRef.current   = playerCells;   }, [playerCells]);

  const pointerDownRef  = useRef(false);
  const isDraggingRef   = useRef(false);
  const startPosRef     = useRef({ x: 0, y: 0 });
  const prevDragPosRef  = useRef({ x: 0, y: 0 });
  const dragActionRef   = useRef<'place' | 'remove'>('place');
  const visitedDragCellsRef = useRef<Set<string>>(new Set());
  const clickTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef         = useRef<{ x: number; y: number; time: number } | null>(null);
  const doubletapFiredRef  = useRef(false);
  const boardHandledUpRef  = useRef(false);
  const boardRef = useRef<HTMLDivElement>(null);

  // Cache of cell screen rects — built once after mount and on resize.
  // elementFromPoint is unreliable with preserve-3d and transparent tile corners;
  // using getBoundingClientRect per cell is exact regardless of 3D transforms.
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
  }

  // Build cache on mount and whenever the board resizes (orientation change, zoom, etc.)
  useEffect(() => {
    buildCellCache();
    const ro = new ResizeObserver(() => buildCellCache());
    if (boardRef.current) ro.observe(boardRef.current);
    return () => ro.disconnect();
  }, [size]);

  function getCellAtPoint(x: number, y: number): { row: number; col: number } | null {
    for (const c of cellRectsRef.current) {
      if (x >= c.left && x < c.right && y >= c.top && y < c.bottom) return { row: c.row, col: c.col };
    }
    return null;
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
    e.currentTarget.setPointerCapture(e.pointerId);

    // Cancel the double-tap expiry timer so lastTapRef doesn't get cleared mid-gesture.
    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }

    pointerDownRef.current  = true;
    isDraggingRef.current   = false;
    visitedDragCellsRef.current = new Set();
    startPosRef.current     = { x: e.clientX, y: e.clientY };

    const cell = getCellAtPoint(e.clientX, e.clientY);
    if (!cell) return;

    // Detect double-tap by proximity (not exact cell) — finger position varies on mobile.
    const now  = Date.now();
    const last = lastTapRef.current;
    if (last) {
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 40 && now - last.time < 900) {
        doubletapFiredRef.current = true;
        lastTapRef.current = null;
        onCellWatcherRef.current(cell.row, cell.col);
        return;
      }
    }

    const state = playerCellsRef.current[cell.row]?.[cell.col];
    dragActionRef.current = state === 'ward' ? 'remove' : 'place';
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerDownRef.current) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;

    if (!isDraggingRef.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      isDraggingRef.current = true;
      onDragStartRef.current?.();
      // Cancel double-tap expiry timer and clear last-tap so drag doesn't accidentally
      // trigger double-tap on the next pointer-down.
      if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
      lastTapRef.current = null;
      // Start interpolation from the actual drag origin so the full path is covered,
      // including cells crossed in the first 8px before drag mode was detected.
      prevDragPosRef.current = { x: startPosRef.current.x, y: startPosRef.current.y };
    }

    if (isDraggingRef.current) {
      // Use coalesced events for the actual pointer path, fall back to interpolation
      const rawEvents = e.nativeEvent.getCoalescedEvents?.() ?? [];
      const points: { x: number; y: number }[] = rawEvents.length > 0
        ? rawEvents.map(ev => ({ x: ev.clientX, y: ev.clientY }))
        : (() => {
            const px = prevDragPosRef.current.x, py = prevDragPosRef.current.y;
            const cx = e.clientX, cy = e.clientY;
            const dist  = Math.sqrt((cx - px) ** 2 + (cy - py) ** 2);
            const steps = Math.max(1, Math.ceil(dist / 6));
            return Array.from({ length: steps }, (_, i) => ({
              x: px + (cx - px) * ((i + 1) / steps),
              y: py + (cy - py) * ((i + 1) / steps),
            }));
          })();

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

    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      onDragEndRef.current?.();
      return;
    }

    const cell = getCellAtPoint(e.clientX, e.clientY);
    if (!cell) return;

    // Double-tap was already handled in pointerDown — just clean up and return
    if (doubletapFiredRef.current) {
      doubletapFiredRef.current = false;
      return;
    }

    wiggleCell(cell.row, cell.col);

    // Record screen position for double-tap detection (tolerates finger drift)
    lastTapRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };

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


  useEffect(() => () => { if (clickTimerRef.current) clearTimeout(clickTimerRef.current); }, []);

  // Safety net: reset drag state whenever the pointer is released anywhere on the page.
  useEffect(() => {
    const onGlobalUp = () => {
      if (!pointerDownRef.current) return;
      pointerDownRef.current  = false;
      isDraggingRef.current   = false;
      visitedDragCellsRef.current = new Set();
      if (!boardHandledUpRef.current) {
        if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
      }
      boardHandledUpRef.current = false;
    };
    window.addEventListener('pointerup', onGlobalUp);
    return () => window.removeEventListener('pointerup', onGlobalUp);
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
        willChange: 'transform',
        transformStyle: 'preserve-3d',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {Array.from({ length: size }, (_, row) => (
        <div key={row} className="flex" style={{ transformStyle: 'preserve-3d' }}>
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
