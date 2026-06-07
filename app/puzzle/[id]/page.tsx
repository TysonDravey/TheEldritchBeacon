'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import NextImage from 'next/image';
import Link from 'next/link';
import { getPuzzleById, SAMPLE_PUZZLES } from '@/data/samplePuzzles';
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
import { REGION_BY_DIFFICULTY } from '@/data/regions';

const UNDO_LIMIT = 50;

function scrollIndexForId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (Math.abs(h) % 3) + 1;
}

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
  const [isFreshWin,       setIsFreshWin]       = useState(false);
  // Tracks how many hints player has asked without making a move — drives escalation
  const hintDepthRef      = useRef(0);
  const flashTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cascadeTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const winTimersRef      = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isDraggingRef     = useRef(false);
  const preDragCellsRef   = useRef<CellState[][] | null>(null);
  // Mutable ref kept in sync with playerState — applyChange reads and writes this
  // synchronously so that multiple rapid drag calls in the same JS frame each build
  // on the previous result instead of all starting from the same stale closure.
  const playerStateRef    = useRef<PlayerState | null>(null);

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

  useEffect(() => () => { winTimersRef.current.forEach(clearTimeout); }, []);
  useEffect(() => { playerStateRef.current = playerState; }, [playerState]);

  // Shared logic for applying any cell state change
  const applyChange = useCallback(
    (row: number, col: number, next: CellState) => {
      // Read from the ref so that multiple rapid calls in the same JS frame (e.g. from
      // coalesced pointer events during a drag) each build on the previous result rather
      // than all starting from the same stale React state closure.
      const current = playerStateRef.current;
      if (!current || !puzzle || current.completed) return;

      const newCells: CellState[][] = current.cells.map((r) => [...r]);
      newCells[row][col] = next;

      let newUndoStack: CellState[][][];
      if (isDraggingRef.current && preDragCellsRef.current) {
        newUndoStack = [...current.undoStack, preDragCellsRef.current].slice(-UNDO_LIMIT);
        preDragCellsRef.current = null;
      } else if (isDraggingRef.current) {
        newUndoStack = current.undoStack;
      } else {
        newUndoStack = [...current.undoStack, current.cells.map((r) => [...r])].slice(-UNDO_LIMIT);
      }

      hintDepthRef.current = 0;
      setHintResult(null);
      const contra  = findContradictions(puzzle, newCells);
      const solved  = isSolved(puzzle, newCells);

      const newState: PlayerState = {
        ...current,
        cells: newCells,
        undoStack: newUndoStack,
        completed: solved,
      };

      // Sync ref update must happen before setPlayerState so the next rapid call
      // in the same frame sees this call's changes, not the stale closure state.
      playerStateRef.current = newState;
      setContradiction(contra);
      setPlayerState(newState);
      savePlayerState(newState);
      if (solved) {
        posthog.capture('puzzle_completed', {
          puzzle_id:   puzzle.id,
          size:        puzzle.size,
          difficulty:  puzzle.difficulty,
          score:       scorePuzzle(puzzle),
          hints_used:  newState.hintsUsed,
          mode:        puzzle.mode ?? 'initiate',
        });
        setShowCompletion(true);
        setIsFreshWin(true);
        const SLAM_DELAY = 2000;
        const STEP_MS    = 60;
        winTimersRef.current.forEach(clearTimeout);
        winTimersRef.current = [];
        const watcherCells: [number, number][] = [];
        for (let r = 0; r < puzzle.size; r++) {
          for (let c = 0; c < puzzle.size; c++) {
            if (newCells[r][c] === 'watcher') watcherCells.push([r, c]);
          }
        }
        for (let r = 0; r < puzzle.size; r++) {
          for (let c = 0; c < puzzle.size; c++) {
            if (newCells[r][c] === 'ward') {
              const dist = Math.min(...watcherCells.map(([wr, wc]) => Math.abs(wr - r) + Math.abs(wc - c)));
              const t = setTimeout(() => {
                const el = document.querySelector(`[data-cell="true"][data-row="${r}"][data-col="${c}"]`);
                if (el) {
                  el.classList.remove('tile-wiggle');
                  void (el as HTMLElement).offsetWidth;
                  el.classList.add('tile-wiggle');
                }
              }, SLAM_DELAY + dist * STEP_MS);
              winTimersRef.current.push(t);
            }
          }
        }
      }
    },
    [puzzle],
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

  // Drag ward — dedicated non-toggle callback: only places when action='place', only removes
  // when action='remove'. Reads playerStateRef (always fresh, sync-updated by applyChange)
  // so it is immune to stale-closure races that could cause a toggle during fast drags.
  const handleCellDrag = useCallback(
    (row: number, col: number, action: 'place' | 'remove') => {
      const current = playerStateRef.current;
      if (!current || current.completed) return;
      const prev = current.cells[row][col];
      if (action === 'place'  && prev === 'empty') applyChange(row, col, 'ward');
      if (action === 'remove' && prev === 'ward')  applyChange(row, col, 'empty');
    },
    [applyChange],
  );

  // Single click → ward toggle (empty↔ward; ignore watcher cells)
  // Reads playerStateRef.current (not playerState closure) so the function stays stable
  // across renders — onCellWardRef in Board never swaps to a new closure mid-drag, which
  // was the race that caused wards to flip when dragging fast on desktop.
  const handleCellWard = useCallback(
    (row: number, col: number) => {
      const current = playerStateRef.current;
      if (!current) return;
      const prev = current.cells[row][col];
      if (prev === 'watcher') return;
      applyChange(row, col, prev === 'empty' ? 'ward' : 'empty');
    },
    [applyChange],
  );

  // Double click → watcher toggle (empty↔watcher; invalid attempts become red wards)
  const handleCellWatcher = useCallback(
    (row: number, col: number) => {
      const current = playerStateRef.current;
      if (!current || !puzzle) return;
      const prev = current.cells[row][col];
      if (prev === 'ward') return;

      if (prev === 'watcher') {
        applyChange(row, col, 'empty');
        return;
      }

      if (!canPlaceWatcher(puzzle, current.cells, row, col)) {
        const reason = watcherRejectionReason(puzzle, current.cells, row, col);
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
    [puzzle, applyChange],
  );

  const handleHint = useCallback(() => {
    if (!puzzle || !playerState) return;
    const hint     = getHint(puzzle, playerState.cells, hintDepthRef.current);
    posthog.capture('hint_used', {
      puzzle_id:  puzzle.id,
      difficulty: puzzle.difficulty,
      hint_level: hint.level,
      hints_so_far: playerState.hintsUsed + 1,
    });
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
    setIsFreshWin(false);
    winTimersRef.current.forEach(clearTimeout);
    winTimersRef.current = [];
  }, [playerState, puzzle]);

  const handleRestart = useCallback(() => {
    if (!puzzle) return;
    const fresh = createFreshPlayerState(puzzle.id, puzzle.size);
    setPlayerState(fresh);
    savePlayerState(fresh);
    setContradiction({ found: false });
    setShowCompletion(false);
    setIsFreshWin(false);
    setHintResult(null);
    winTimersRef.current.forEach(clearTimeout);
    winTimersRef.current = [];
  }, [puzzle]);

  if (!puzzle) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6">
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

  const region = REGION_BY_DIFFICULTY[puzzle.difficulty] ?? null;
  const regionPuzzles = SAMPLE_PUZZLES
    .filter(p => p.difficulty === puzzle.difficulty && p.mode === 'initiate')
    .sort((a, b) => scorePuzzle(a) - scorePuzzle(b));
  const currentIdx = regionPuzzles.findIndex(p => p.id === puzzle.id);
  const nextPuzzle = currentIdx >= 0 && currentIdx < regionPuzzles.length - 1
    ? regionPuzzles[currentIdx + 1]
    : null;

  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-8">

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
            style={{ height: 64, display: 'block', filter: 'drop-shadow(3px 7px 3px rgba(0,0,0,0.75))' }}
          />
        </button>
      </div>

      {/* Puzzle title on a scroll */}
      <div
        className="w-full max-w-2xl mb-6 relative select-none"
        style={{ filter: 'drop-shadow(3px 7px 3px rgba(0,0,0,0.75))' }}
      >
        <img
          src={`/scrolls/scroll_0${scrollIndexForId(puzzle.id)}.png`}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: 'fill', display: 'block' }}
        />
        <div className="relative text-center" style={{ padding: '10% 16%' }}>
          <div style={{
            background: 'rgba(242,233,216,0.88)',
            padding: '10px 18px',
            borderRadius: 6,
            boxShadow: '0 0 24px 18px rgba(242,233,216,0.88)',
          }}>
            <h1 className="font-lovecraftian text-2xl text-ink leading-snug" style={{ textWrap: 'balance' } as React.CSSProperties}>{puzzle.title}</h1>
            <p className="font-serif text-sm text-ink-light mt-1">
              {puzzle.size}&times;{puzzle.size} &mdash; {puzzle.difficulty}
              <span className="ml-2 text-xs opacity-60" title="Obscurity score">&#9670; {scorePuzzle(puzzle)}</span>
            </p>
            {playerState.hintsUsed > 0 && (
              <p className="font-serif text-xs text-red-ink mt-1">
                {playerState.hintsUsed} hint{playerState.hintsUsed !== 1 ? 's' : ''} used
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Region progress bar */}
      {region && regionPuzzles.length > 1 && currentIdx >= 0 && (
        <div className="w-full max-w-2xl mb-4">
          <div style={{
            background: 'rgba(26,18,9,0.07)',
            border: '1px solid rgba(26,18,9,0.22)',
            borderRadius: 8,
            padding: '10px 14px',
          }}>
            <div className="flex items-center gap-3">
              <img
                src={region.ward}
                alt=""
                draggable={false}
                style={{
                  height: 40, width: 40, objectFit: 'contain',
                  filter: 'drop-shadow(2px 4px 3px rgba(0,0,0,0.55))',
                  flexShrink: 0,
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="font-serif text-sm text-ink">{region.name}</span>
                  <span className="font-serif text-xs text-ink-light ml-3" style={{ flexShrink: 0 }}>
                    {currentIdx + 1} / {regionPuzzles.length}
                  </span>
                </div>
                <div className="flex gap-px">
                  {regionPuzzles.map((p, i) => (
                    <div
                      key={p.id}
                      className="flex-1 rounded-sm"
                      style={{
                        height: 8,
                        background: i < currentIdx
                          ? 'rgba(26,18,9,0.55)'
                          : i === currentIdx
                            ? '#8B1A1A'
                            : 'rgba(26,18,9,0.14)',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
        onCellDrag={handleCellDrag}
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
        isFreshWin={isFreshWin}
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
          <div className="flex justify-center">
            <div
              className="relative select-none"
              style={{ width: '52%', filter: 'drop-shadow(3px 7px 3px rgba(0,0,0,0.75))' }}
            >
              <img
                src={`/scrolls/scroll_0${(scrollIndexForId(puzzle.id) % 3) + 1}.png`}
                alt=""
                draggable={false}
                className="absolute inset-0 w-full h-full"
                style={{ objectFit: 'fill', display: 'block' }}
              />
              <div className="relative text-center" style={{ padding: '10% 16%' }}>
                <div style={{
                  background: 'rgba(242,233,216,0.88)',
                  padding: '8px 14px',
                  borderRadius: 6,
                  boxShadow: '0 0 24px 18px rgba(242,233,216,0.88)',
                }}>
                  <div className="flex items-center justify-center gap-2">
                    <NextImage src="/svg/completion_stamp.svg" alt="Completed" width={28} height={28} />
                    <h2
                      className="font-lovecraftian text-base text-ink leading-snug"
                      style={{ textWrap: 'balance' } as React.CSSProperties}
                    >
                      Beacon Restored
                    </h2>
                  </div>
                  <p className="font-serif text-xs text-ink-light italic mt-1" style={{ textWrap: 'balance' } as React.CSSProperties}>
                    The Watchers stand vigilant. The wards hold.
                  </p>
                  {nextPuzzle && (
                    <div className="mt-3">
                      <Link href={`/puzzle/${nextPuzzle.id}`}>
                        <img
                          src="/buttons/left_button_01.png"
                          alt="Next Puzzle"
                          draggable={false}
                          className="transition-all duration-100 hover:brightness-110 active:scale-95"
                          style={{
                            height: 52,
                            display: 'block',
                            margin: '0 auto',
                            transform: 'scaleX(-1)',
                            filter: 'drop-shadow(3px 7px 3px rgba(0,0,0,0.75))',
                          }}
                        />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
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
