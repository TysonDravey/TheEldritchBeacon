'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import NextImage from 'next/image';
import { getPuzzleById } from '@/data/samplePuzzles';
import { loadPlayerState, savePlayerState, createFreshPlayerState } from '@/lib/storage';
import { getHint } from '@/engine/hints';
import { scorePuzzle } from '@/engine/difficulty';
import { isSolved, canPlaceWatcher, watcherRejectionReason } from '@/engine/rules';
import { findContradictions } from '@/engine/solver';
import type { PlayerState, CellState, HintResult, ContradictionResult } from '@/engine/boardTypes';
import Board from '@/components/Board';
import GameControls from '@/components/GameControls';
import HintOverlay from '@/components/HintOverlay';
import { WATCHER_SVGS, WARD_PNG } from '@/theme/colors';

const UNDO_LIMIT = 50;

export default function PuzzlePage() {
  const params = useParams();
  const router = useRouter();
  const id     = typeof params.id === 'string' ? params.id : params.id?.[0] ?? '';
  const puzzle = getPuzzleById(id);

  const [playerState,      setPlayerState]      = useState<PlayerState | null>(null);
  const [hintResult,       setHintResult]       = useState<HintResult | null>(null);
  const [showCompletion,   setShowCompletion]   = useState(false);
  const [tilesReady,       setTilesReady]       = useState(false);
  const [loadProgress,     setLoadProgress]     = useState(0);
  const [contradiction,    setContradiction]    = useState<ContradictionResult>({ found: false });
  const [flashCells,       setFlashCells]       = useState<[number, number][]>([]);
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);
  const [cascadeGhosts,    setCascadeGhosts]    = useState<[number, number][]>([]);
  const [cascadeWards,     setCascadeWards]     = useState<[number, number][]>([]);
  const [constraintWards,  setConstraintWards]  = useState<[number, number][]>([]);
  // Tracks how many hints player has asked without making a move — drives escalation
  const hintDepthRef      = useRef(0);
  const flashTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cascadeTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef     = useRef(false);
  const preDragCellsRef   = useRef<CellState[][] | null>(null);

  useEffect(() => {
    const srcs = [
      ...Array.from({ length: 10 }, (_, i) =>
        `/tiles/processed/plain_tile_${String(i + 1).padStart(2, '0')}.png`
      ),
      ...Object.values(WATCHER_SVGS).filter(s => s.endsWith('.png')),
      WARD_PNG,
    ];
    let loaded = 0;
    const total = srcs.length;
    const onLoad = () => { loaded++; setLoadProgress(Math.round((loaded / total) * 100)); };
    Promise.all(
      srcs.map(src => {
        const img = new Image();
        img.src = src;
        return img.decode().catch(() => {}).then(onLoad);
      })
    ).then(() => setTilesReady(true));
  }, []);

  useEffect(() => {
    if (!puzzle) return;
    const saved = loadPlayerState(puzzle.id);
    if (saved) {
      setPlayerState(saved);
      if (saved.completed) setShowCompletion(true);
    } else {
      setPlayerState(createFreshPlayerState(puzzle.id, puzzle.size));
    }
  }, [puzzle]);

  // Interleaved cascade animation for Level III hypothetical hints:
  //   For each watcher (hypothesis first, then each forced placement):
  //     1. Ghost watcher appears
  //     2. Its adj / row / col / territory waves appear (amber, 380ms between)
  //   After all watchers: victim wards appear (red, 350ms between)
  useEffect(() => {
    if (cascadeTimerRef.current) {
      clearTimeout(cascadeTimerRef.current);
      cascadeTimerRef.current = null;
    }

    const primary       = hintResult?.primaryCell;
    const steps         = hintResult?.cascadeSteps ?? [];
    // Per-watcher waves: watcherWaves[i] = waves for watcher i (hypothesis=0, forced=1,2,…)
    const watcherWaves  = hintResult?.cascadeConstraintWaves ?? [];
    const victimCells   = hintResult?.cascadeVictimCells ?? [];

    if (!primary) {
      setCascadeGhosts([]);
      setCascadeWards([]);
      setConstraintWards([]);
      return;
    }

    console.log('[cascade] primary:', primary, 'steps:', steps, 'waves:', watcherWaves, 'victims:', victimCells);

    const watcherPositions: [number, number][] = [primary, ...steps];

    // Show the hypothesis ghost watcher immediately
    setCascadeGhosts([watcherPositions[0]]);
    setCascadeWards([]);
    setConstraintWards([]);

    let watcherPhaseIdx = 0; // which watcher's waves we're currently showing
    let wavePhaseIdx    = 0; // which wave within that watcher
    let victimIdx       = 0;

    function animateCurrentWaves() {
      const waves = watcherWaves[watcherPhaseIdx] ?? [];
      if (wavePhaseIdx < waves.length) {
        const wave = waves[wavePhaseIdx];
        if (Array.isArray(wave) && wave.length > 0 && Array.isArray(wave[0])) {
          setConstraintWards(prev => [...prev, ...(wave as [number, number][])]);
        }
        wavePhaseIdx++;
        cascadeTimerRef.current = setTimeout(animateCurrentWaves, 380);
      } else {
        // Done with this watcher's waves — advance to next watcher
        watcherPhaseIdx++;
        wavePhaseIdx = 0;
        if (watcherPhaseIdx < watcherPositions.length) {
          // Show the next forced ghost watcher, then its waves
          const next = watcherPositions[watcherPhaseIdx];
          if (next != null) setCascadeGhosts(prev => [...prev, next]);
          cascadeTimerRef.current = setTimeout(animateCurrentWaves, 500);
        } else if (victimCells.length > 0) {
          cascadeTimerRef.current = setTimeout(animateNextVictimWard, 450);
        }
      }
    }

    function animateNextVictimWard() {
      if (victimIdx < victimCells.length) {
        const next = victimCells[victimIdx];
        if (next != null) setCascadeWards(prev => [...prev, next]);
        victimIdx++;
        cascadeTimerRef.current = setTimeout(animateNextVictimWard, 350);
      }
    }

    // Kick off waves for the first watcher (hypothesis) after a brief pause
    cascadeTimerRef.current = setTimeout(animateCurrentWaves, 500);

    return () => {
      if (cascadeTimerRef.current) {
        clearTimeout(cascadeTimerRef.current);
        cascadeTimerRef.current = null;
      }
    };
  }, [hintResult]);

  // Shared logic for applying any cell state change
  const applyChange = useCallback(
    (row: number, col: number, next: CellState) => {
      if (!playerState || !puzzle || playerState.completed) return;

      const newCells: CellState[][] = playerState.cells.map((r) => [...r]);
      newCells[row][col] = next;

      // Build undo stack entry:
      // - Single click: push current cells as snapshot
      // - First cell of a drag: push the pre-drag snapshot stored in preDragCellsRef, then clear it
      // - Subsequent drag cells: no push (snapshot already pushed on first cell)
      // NOTE: snapshot must be pushed here, not in handleDragStart, because handleDragStart
      // runs in the same event tick as the first applyChange — pushing in handleDragStart
      // causes a stale-closure race where applyChange's setPlayerState overwrites it.
      let newUndoStack: CellState[][][];
      if (isDraggingRef.current && preDragCellsRef.current) {
        newUndoStack = [...playerState.undoStack, preDragCellsRef.current].slice(-UNDO_LIMIT);
        preDragCellsRef.current = null; // only push once per drag gesture
      } else if (isDraggingRef.current) {
        newUndoStack = playerState.undoStack; // subsequent drag cells — no new snapshot
      } else {
        newUndoStack = [...playerState.undoStack, playerState.cells.map((r) => [...r])].slice(-UNDO_LIMIT);
      }

      hintDepthRef.current = 0; // any move resets hint escalation
      setHintResult(null);      // dismiss active hint on any move
      const contra  = findContradictions(puzzle, newCells);
      const solved  = isSolved(puzzle, newCells);

      const newState: PlayerState = {
        ...playerState,
        cells: newCells,
        undoStack: newUndoStack,
        completed: solved,
      };

      setContradiction(contra);
      setPlayerState(newState);
      savePlayerState(newState);
      if (solved) setShowCompletion(true);
    },
    [playerState, puzzle],
  );

  const handleDragStart = useCallback(() => {
    if (!playerState) return;
    isDraggingRef.current   = true;
    preDragCellsRef.current = playerState.cells.map((r) => [...r]);
    // Snapshot is pushed by the first applyChange call during this drag (avoids stale-closure race)
  }, [playerState]);

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current   = false;
    preDragCellsRef.current = null;
  }, []);

  // Single click → ward toggle (empty↔ward; ignore watcher cells)
  const handleCellWard = useCallback(
    (row: number, col: number) => {
      if (!playerState) return;
      const prev = playerState.cells[row][col];
      if (prev === 'watcher') return;
      applyChange(row, col, prev === 'empty' ? 'ward' : 'empty');
    },
    [playerState, applyChange],
  );

  // Double click → watcher toggle (empty↔watcher; invalid attempts become red wards)
  const handleCellWatcher = useCallback(
    (row: number, col: number) => {
      if (!playerState || !puzzle) return;
      const prev = playerState.cells[row][col];
      if (prev === 'ward') return;

      if (prev === 'watcher') {
        // Remove existing watcher
        applyChange(row, col, 'empty');
        return;
      }

      // Attempting to place on an empty cell — validate first
      if (!canPlaceWatcher(puzzle, playerState.cells, row, col)) {
        const reason = watcherRejectionReason(puzzle, playerState.cells, row, col);
        // Place a ward instead and flash it red
        applyChange(row, col, 'ward');
        setRejectionMessage(reason);
        setFlashCells([[row, col]]);
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => {
          setFlashCells([]);
          setRejectionMessage(null);
        }, 1600);
        return;
      }

      applyChange(row, col, 'watcher');
    },
    [playerState, puzzle, applyChange],
  );

  const handleHint = useCallback(() => {
    if (!puzzle || !playerState) return;
    const hint     = getHint(puzzle, playerState.cells, hintDepthRef.current);
    hintDepthRef.current += 1; // next ask escalates
    const newState = { ...playerState, hintsUsed: playerState.hintsUsed + 1 };
    setPlayerState(newState);
    savePlayerState(newState);
    setHintResult(hint);
  }, [puzzle, playerState]);

  const handleUndo = useCallback(() => {
    if (!playerState || playerState.undoStack.length === 0) return;
    const stack     = [...playerState.undoStack];
    const prevCells = stack.pop()!;
    const newState: PlayerState = {
      ...playerState,
      cells: prevCells,
      undoStack: stack,
      completed: false,
    };
    setPlayerState(newState);
    savePlayerState(newState);
    setContradiction(findContradictions(puzzle!, prevCells));
    setShowCompletion(false);
  }, [playerState, puzzle]);

  const handleRestart = useCallback(() => {
    if (!puzzle) return;
    const fresh = createFreshPlayerState(puzzle.id, puzzle.size);
    setPlayerState(fresh);
    savePlayerState(fresh);
    setContradiction({ found: false });
    setShowCompletion(false);
    setHintResult(null);
  }, [puzzle]);

  if (!puzzle) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4">
        <p className="font-serif text-lg text-ink mb-4">Puzzle not found.</p>
        <button
          onClick={() => router.push('/')}
          className="font-serif text-sm border border-ink px-4 py-2 rounded-sm bg-parchment hover:bg-parchment-dark"
        >
          Return to Harbour
        </button>
      </main>
    );
  }

  if (!playerState) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-serif text-ink opacity-60">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">

      {/* Back button */}
      <div className="w-full max-w-2xl mb-4">
        <button
          onClick={() => router.push('/')}
          className="transition-all duration-100 hover:brightness-110 active:scale-95"
          title="Back to all puzzles"
        >
          <img
            src="/buttons/left_button_01.png"
            alt="All Puzzles"
            draggable={false}
            style={{ height: 64, display: 'block' }}
          />
        </button>
      </div>

      {/* Puzzle header — fixed height, never changes */}
      <div
        className="w-full max-w-2xl mb-6 flex items-start justify-between gap-4 px-4 py-3 rounded-sm"
        style={{ backgroundColor: 'rgba(242, 233, 216, 0.78)' }}
      >
        <div>
          <h1 className="font-serif text-2xl font-bold text-ink">{puzzle.title}</h1>
          <p className="font-serif text-sm text-ink-light mt-0.5">
            {puzzle.size}&times;{puzzle.size} &mdash; {puzzle.difficulty}
            <span className="ml-2 text-xs opacity-60" title="Obscurity score">&#9670; {scorePuzzle(puzzle)}</span>
          </p>
        </div>
        <span
          className="font-serif text-xs text-red-ink border border-red-ink px-2 py-0.5 rounded-sm mt-1"
          style={{ visibility: playerState.hintsUsed > 0 ? 'visible' : 'hidden' }}
        >
          {playerState.hintsUsed} hint{playerState.hintsUsed !== 1 ? 's' : ''} used
        </span>
      </div>

      {/* Board — always in the same position */}
      <div style={{ opacity: tilesReady ? 1 : 0, transition: 'opacity 0.4s ease', position: 'relative' }}>
      {!tilesReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-50 gap-3"
          style={{ minWidth: 200 }}>
          <p className="font-serif text-sm text-ink opacity-60 italic">Summoning the Watchers…</p>
          <div className="w-48 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(26,18,9,0.15)' }}>
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{ width: `${loadProgress}%`, background: 'rgba(139,26,26,0.7)' }}
            />
          </div>
          <p className="font-serif text-xs opacity-40">{loadProgress}%</p>
        </div>
      )}
      <Board
        puzzle={puzzle}
        playerCells={playerState.cells}
        onCellWard={handleCellWard}
        onCellWatcher={handleCellWatcher}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        primaryCell={hintResult?.primaryCell}
        highlightCells={hintResult?.highlightCells}
        secondaryHighlightCells={hintResult?.secondaryHighlightCells}
        highlightTerritories={hintResult?.highlightTerritories}
        secondaryHighlightTerritories={hintResult?.secondaryHighlightTerritories}
        highlightRows={hintResult?.highlightRows}
        highlightCols={hintResult?.highlightCols}
        hintActive={!!hintResult}
        contradiction={contradiction}
        flashCells={flashCells}
        ghostCells={cascadeGhosts}
        ghostWardCells={cascadeWards}
        constraintWardCells={constraintWards}
        isCompleted={playerState.completed}
      />
      </div>

      {/* Controls */}
      <div className="mt-6">
        <GameControls
          onHint={handleHint}
          onUndo={handleUndo}
          onRestart={handleRestart}
          hintsUsed={playerState.hintsUsed}
          canUndo={playerState.undoStack.length > 0}
          completed={playerState.completed}
        />
      </div>

      {/* Status messages — below controls so they never shift the board */}
      <div className="mt-4 w-full max-w-2xl space-y-3">
        {showCompletion && (
          <div className="border-2 border-brass bg-parchment px-6 py-4 flex items-center gap-4 rounded-sm">
            <NextImage src="/svg/completion_stamp.svg" alt="Completed" width={48} height={48} />
            <div>
              <p className="font-serif text-lg font-bold text-ink">Beacon Restored</p>
              <p className="font-serif text-sm text-ink-light italic">
                The Watchers stand vigilant. The wards hold.
              </p>
            </div>
          </div>
        )}
        {rejectionMessage && (
          <div className="border border-red-ink bg-parchment px-4 py-2 rounded-sm">
            <p className="font-serif text-sm text-red-ink italic">
              {rejectionMessage}
            </p>
          </div>
        )}
        {contradiction.found && !showCompletion && !rejectionMessage && (
          <div className="border border-red-ink bg-parchment px-4 py-2 rounded-sm">
            <p className="font-serif text-sm text-red-ink">
              {contradiction.message ?? 'A contradiction lurks in the arrangement.'}
            </p>
          </div>
        )}
      </div>

      {/* Hint overlay — fixed position, never affects layout */}
      <HintOverlay hint={hintResult} onDismiss={() => setHintResult(null)} />
    </main>
  );
}
