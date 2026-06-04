'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { Puzzle, CellState, ContradictionResult } from '@/engine/boardTypes';
import Cell from './Cell';

interface BoardProps {
  puzzle: Puzzle;
  playerCells: CellState[][];
  onCellWard: (row: number, col: number) => void;
  onCellWatcher: (row: number, col: number) => void;
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
}: BoardProps) {
  const { size, territoryMap } = puzzle;

  // Keep latest versions in refs so stable handlers don't go stale
  const onCellWardRef    = useRef(onCellWard);
  const onCellWatcherRef = useRef(onCellWatcher);
  const onDragStartRef   = useRef(onDragStart);
  const onDragEndRef     = useRef(onDragEnd);
  const playerCellsRef   = useRef(playerCells);
  useEffect(() => { onCellWardRef.current    = onCellWard;    }, [onCellWard]);
  useEffect(() => { onCellWatcherRef.current = onCellWatcher; }, [onCellWatcher]);
  useEffect(() => { onDragStartRef.current   = onDragStart;   }, [onDragStart]);
  useEffect(() => { onDragEndRef.current     = onDragEnd;     }, [onDragEnd]);
  useEffect(() => { playerCellsRef.current   = playerCells;   }, [playerCells]);

  const pointerDownRef  = useRef(false);
  const isDraggingRef   = useRef(false);
  const startPosRef     = useRef({ x: 0, y: 0 });
  const prevDragPosRef  = useRef({ x: 0, y: 0 });
  const dragActionRef   = useRef<'place' | 'remove'>('place');
  const lastDragCellRef = useRef(''); // "row,col" — skip re-entry on same cell
  const clickTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingClickRef   = useRef<{ row: number; col: number } | null>(null);
  const lastTapRef        = useRef<{ row: number; col: number; time: number } | null>(null);
  const doubletapFiredRef = useRef(false);

  function getCellAtPoint(x: number, y: number): { row: number; col: number } | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const cell = el?.closest('[data-cell="true"]') as HTMLElement | null;
    if (!cell) return null;
    const row = parseInt(cell.dataset.row ?? '-1', 10);
    const col = parseInt(cell.dataset.col ?? '-1', 10);
    if (row < 0 || col < 0) return null;
    return { row, col };
  }

  function wiggleCell(row: number, col: number) {
    const cellEl = document.querySelector(`[data-cell="true"][data-row="${row}"][data-col="${col}"]`);
    if (cellEl) {
      cellEl.classList.remove('tile-wiggle');
      void (cellEl as HTMLElement).offsetWidth;
      cellEl.classList.add('tile-wiggle');
    }
  }

  function applyDragWard(row: number, col: number) {
    const key = `${row},${col}`;
    if (lastDragCellRef.current === key) return;
    lastDragCellRef.current = key;
    const state = playerCellsRef.current[row]?.[col];
    if (dragActionRef.current === 'place'  && state === 'empty') { onCellWardRef.current(row, col); wiggleCell(row, col); }
    if (dragActionRef.current === 'remove' && state === 'ward')  { onCellWardRef.current(row, col); wiggleCell(row, col); }
  }

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    pointerDownRef.current  = true;
    isDraggingRef.current   = false;
    lastDragCellRef.current = '';
    startPosRef.current     = { x: e.clientX, y: e.clientY };

    const cell = getCellAtPoint(e.clientX, e.clientY);
    if (!cell) return;

    // Detect double-tap: lastTapRef is set in pointerUp so both the double-click
    // window and the ward timer start from the same moment — no race condition.
    const now  = Date.now();
    const last = lastTapRef.current;
    if (last && last.row === cell.row && last.col === cell.col && now - last.time < 500) {
      doubletapFiredRef.current = true;
      lastTapRef.current = null;
      if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
      pendingClickRef.current = null;
      const state = playerCellsRef.current[cell.row]?.[cell.col];
      if (state !== 'ward') onCellWatcherRef.current(cell.row, cell.col);
      return;
    }

    const state = playerCellsRef.current[cell.row]?.[cell.col];
    dragActionRef.current = state === 'ward' ? 'remove' : 'place';
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerDownRef.current) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;

    if (!isDraggingRef.current && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      isDraggingRef.current = true;
      onDragStartRef.current?.();
      // Cancel any pending single-click
      if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
      pendingClickRef.current = null;
      lastTapRef.current      = null;
      // Apply to the cell where the drag started
      const origin = getCellAtPoint(startPosRef.current.x, startPosRef.current.y);
      if (origin) applyDragWard(origin.row, origin.col);
      prevDragPosRef.current = { x: e.clientX, y: e.clientY };
    }

    if (isDraggingRef.current) {
      // Interpolate between previous and current position to catch skipped cells
      const px = prevDragPosRef.current.x, py = prevDragPosRef.current.y;
      const cx = e.clientX, cy = e.clientY;
      const dist  = Math.sqrt((cx - px) ** 2 + (cy - py) ** 2);
      const steps = Math.max(1, Math.ceil(dist / 12));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const cell = getCellAtPoint(px + (cx - px) * t, py + (cy - py) * t);
        if (cell) applyDragWard(cell.row, cell.col);
      }
      prevDragPosRef.current = { x: cx, y: cy };
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!pointerDownRef.current) return;
    pointerDownRef.current = false;

    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      onDragEndRef.current?.();
      return;
    }

    const cell = getCellAtPoint(e.clientX, e.clientY);
    if (!cell) return;

    wiggleCell(cell.row, cell.col);

    // Double-tap was already handled in pointerDown — just clean up and return
    if (doubletapFiredRef.current) {
      doubletapFiredRef.current = false;
      return;
    }

    // Record tap time here (not pointerDown) so the ward timer and double-click
    // window share the exact same start point — guarantees clear-on-doubletap wins.
    lastTapRef.current = { row: cell.row, col: cell.col, time: Date.now() };

    // Start single-click timer — fires ward toggle if no double-tap comes within 500ms
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    pendingClickRef.current = cell;
    clickTimerRef.current = setTimeout(() => {
      const pending = pendingClickRef.current;
      if (pending) {
        const state = playerCellsRef.current[pending.row]?.[pending.col];
        if (state !== 'watcher') onCellWardRef.current(pending.row, pending.col);
      }
      pendingClickRef.current = null;
      clickTimerRef.current   = null;
      lastTapRef.current      = null;
    }, 500);
  }, []);


  useEffect(() => () => { if (clickTimerRef.current) clearTimeout(clickTimerRef.current); }, []);

  // Safety net: reset drag state whenever the pointer is released anywhere on the page.
  // This catches releases outside the board that pointer capture may miss (e.g. browser
  // chrome, iframe boundaries, or rapid focus changes).
  useEffect(() => {
    const onGlobalUp = () => {
      if (!pointerDownRef.current) return;
      pointerDownRef.current  = false;
      isDraggingRef.current   = false;
      lastDragCellRef.current = '';
      if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
      pendingClickRef.current = null;
    };
    window.addEventListener('pointerup', onGlobalUp);
    return () => window.removeEventListener('pointerup', onGlobalUp);
  }, []);

  return (
    <div style={{ perspective: '700px', perspectiveOrigin: '50% 50%' }}>
    <div
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
