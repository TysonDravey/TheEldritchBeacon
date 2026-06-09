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
import type { PlayerState, CellState, HintResult, ContradictionResult, Difficulty } from '@/engine/boardTypes';
import Board from '@/components/Board';
import GameControls from '@/components/GameControls';
import HintOverlay from '@/components/HintOverlay';
import TechniqueDiscovery from '@/components/TechniqueDiscovery';
import { WATCHER_SVGS, WARD_PNG } from '@/theme/colors';
import { REGION_BY_DIFFICULTY } from '@/data/regions';
import { haptic } from '@/lib/haptic';
import { isTechniqueNew, markTechniqueDiscovered } from '@/lib/techniques';

// Chapter completion data — keyed by difficulty tier
const CHAPTER_COMPLETIONS: Partial<Record<Difficulty, {
  image: string;
  chapterLabel: string;
  title: string;
  lore: string;
}>> = {
  Initiate: {
    image: '/titleCards/campaign_01/chapter_01.png',
    chapterLabel: 'Chapter I Complete',
    title: 'The Lower Gallery',
    lore: 'The lower gallery is open.\n\nSomething in the walls shifted when the last chart was restored. The Beacon holds — for now.\n\nWhatever disturbed the Watchers came from higher up.',
  },
  Scholar: {
    image: '/titleCards/campaign_01/chapter_02.png',
    chapterLabel: 'Chapter II Complete',
    title: 'The Shore Charts',
    lore: 'The tide has not come in the way it should.\n\nThe shore charts are restored, and the Watchers hold the coast. Something moved through here before we arrived.\n\nThe fog is thickening to the west.',
  },
  Occultist: {
    image: '/titleCards/campaign_01/chapter_03.png',
    chapterLabel: 'Chapter III Complete',
    title: 'Into the Fog',
    lore: 'Visibility is four steps in any direction. No more.\n\nThe charts are restored but I cannot say what I saw in the margins — marks that were not there when I began.\n\nI am still counting. The numbers are still right. I do not know why that frightens me.',
  },
  'High Priest': {
    image: '/titleCards/campaign_01/chapter_04.png',
    chapterLabel: 'Chapter IV Complete',
    title: 'The Hidden Reefs',
    lore: 'There are things below the surface that do not appear on any chart I was given.\n\nThe Watchers hold. The Beacon holds. I keep telling myself this.\n\nSomething below the hull has been listening.',
  },
  Eldritch: {
    image: '/titleCards/campaign_01/chapter_05.png',
    chapterLabel: 'Chapter V Complete',
    title: 'Deep Water',
    lore: 'No light reaches here from outside.\n\nI have been restoring charts for longer than I can account for. The Watchers do not sleep. I am beginning to understand why.\n\nThe Beacon still holds. That is all I am permitted to say.',
  },
  Archon: {
    image: '/titleCards/campaign_01/chapter_07.png',
    chapterLabel: 'Chapter VII Complete',
    title: 'The Lantern Room',
    lore: 'I am at the top.\n\nThe light burns. It has always burned. I understand now that someone must stand here for it to do so — and that I am not the first.\n\nThe chart is complete. The Beacon holds.',
  },
  Unbound: {
    image: '/titleCards/campaign_01/unbound_01.png',
    chapterLabel: 'Beyond the Chart',
    title: 'The Unbound',
    lore: 'These charts should not exist.\n\nThe rules hold — one Watcher, one row, one column — but something has learned to use the rules against themselves.\n\nI restored the chart. I do not know what I have released.',
  },
};

function loadAllCompleted(): Set<string> {
  const ids = new Set<string>();
  try {
    for (const puzzle of SAMPLE_PUZZLES) {
      const raw = localStorage.getItem(`eldritch_beacon_state_${puzzle.id}`);
      if (raw && JSON.parse(raw)?.completed) ids.add(puzzle.id);
    }
  } catch { /* ignore */ }
  return ids;
}

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
  const [pendingDiscovery, setPendingDiscovery] = useState<string | null>(null);
  const [showCompletion,   setShowCompletion]   = useState(false);
  const [tilesReady,       setTilesReady]       = useState(false);
  const [loadProgress,     setLoadProgress]     = useState(0);
  const [contradiction,    setContradiction]    = useState<ContradictionResult>({ found: false });
  const [flashCells,       setFlashCells]       = useState<[number, number][]>([]);
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);
  const [cascadeGhosts,    setCascadeGhosts]    = useState<[number, number][]>([]);
  const [cascadeWards,     setCascadeWards]     = useState<[number, number][]>([]);
  const [constraintWards,  setConstraintWards]  = useState<[number, number][]>([]);
  const [isFreshWin,          setIsFreshWin]          = useState(false);
  const [showChapterComplete, setShowChapterComplete] = useState(false);
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
    // Reset all per-puzzle UI state so nothing bleeds over from the previous puzzle.
    setIsFreshWin(false);
    setShowCompletion(false);
    setShowChapterComplete(false);
    setContradiction({ found: false });
    setHintResult(null);
    setFlashCells([]);
    setRejectionMessage(null);
    setCascadeGhosts([]);
    setCascadeWards([]);
    setConstraintWards([]);
    hintDepthRef.current = 0;
    winTimersRef.current.forEach(clearTimeout);
    winTimersRef.current = [];

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

    // Only run ghost cascade for actual hypothetical hints that have steps/waves/victims.
    // Simple watcher hints use primaryCell for the spinner — don't overwrite with a ghost.
    const isCascade = steps.length > 0 || watcherWaves.length > 0 || victimCells.length > 0;
    if (!isCascade) {
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

      // Haptic for the cell transition
      if (next === 'watcher' || (next === 'empty' && current.cells[row][col] === 'watcher')) haptic('medium');
      else haptic('light');

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
        setIsFreshWin(true);
        const SLAM_DELAY = 2000;
        const STEP_MS    = 60;
        winTimersRef.current.forEach(clearTimeout);
        winTimersRef.current = [];
        const watcherCells: [number, number][] = [];
        for (let r = 0; r < puzzle.size; r++)
          for (let c = 0; c < puzzle.size; c++)
            if (newCells[r][c] === 'watcher') watcherCells.push([r, c]);

        let maxDelay = 0;
        for (let r = 0; r < puzzle.size; r++) {
          for (let c = 0; c < puzzle.size; c++) {
            if (newCells[r][c] === 'ward') {
              const dist = Math.min(...watcherCells.map(([wr, wc]) => Math.abs(wr - r) + Math.abs(wc - c)));
              const delay = SLAM_DELAY + dist * STEP_MS;
              if (delay > maxDelay) maxDelay = delay;
              const t = setTimeout(() => {
                haptic('win-ward');
                const el = document.querySelector(`[data-cell="true"][data-row="${r}"][data-col="${c}"]`);
                if (el) {
                  el.classList.remove('tile-wiggle');
                  void (el as HTMLElement).offsetWidth;
                  el.classList.add('tile-wiggle');
                }
              }, delay);
              winTimersRef.current.push(t);
            }
          }
        }
        // Check if this completes the whole chapter (initiate-mode puzzles only)
        const tierPuzzles = SAMPLE_PUZZLES.filter(p => p.difficulty === puzzle.difficulty && p.mode === 'initiate');
        const allCompleted = loadAllCompleted();
        allCompleted.add(puzzle.id);
        const chapterJustFinished = puzzle.mode === 'initiate'
          && CHAPTER_COMPLETIONS[puzzle.difficulty] != null
          && tierPuzzles.length > 0
          && tierPuzzles.every(p => allCompleted.has(p.id));

        // watcher-rise-slam: 200ms delay + 2200ms duration — always wait for it to finish
        const WATCHER_ANIM_END = 2600;
        const completionT = setTimeout(() => {
          if (chapterJustFinished) {
            setShowChapterComplete(true);
          } else {
            setShowCompletion(true);
          }
        }, Math.max(maxDelay, WATCHER_ANIM_END) + 500);
        winTimersRef.current.push(completionT);
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
        haptic('error');
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
    hintDepthRef.current += 1;
    const newState = { ...playerState, hintsUsed: playerState.hintsUsed + 1 };
    setPlayerState(newState);
    savePlayerState(newState);
    setHintResult(hint);
    if (hint.techniqueName && isTechniqueNew(hint.techniqueName)) {
      markTechniqueDiscovered(hint.techniqueName);
      setPendingDiscovery(hint.techniqueName);
    }
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
    <main style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Compact header ── */}
      <div style={{
        flexShrink: 0,
        background: 'rgba(242,233,216,0.92)',
        borderBottom: '1px solid rgba(26,18,9,0.15)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        paddingTop: 'env(safe-area-inset-top)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px' }}>
          <button
            onClick={() => router.push('/')}
            className="transition-all duration-100 hover:brightness-110 active:scale-95 shrink-0"
          >
            <img
              src="/buttons/left_button_01.png"
              alt="Back"
              draggable={false}
              style={{ height: 40, display: 'block', filter: 'drop-shadow(2px 4px 2px rgba(0,0,0,0.6))' }}
            />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="font-lovecraftian text-base text-ink leading-tight truncate">{puzzle.title}</h1>
            <p className="font-serif text-ink-light leading-none" style={{ fontSize: 11 }}>
              {puzzle.size}&times;{puzzle.size} &mdash; {puzzle.difficulty}
              <span className="ml-1 opacity-50">&#9670; {scorePuzzle(puzzle)}</span>
              {playerState.hintsUsed > 0 && (
                <span className="ml-2 text-red-ink">
                  {playerState.hintsUsed} hint{playerState.hintsUsed !== 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Slim progress bar */}
        {region && regionPuzzles.length > 1 && currentIdx >= 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px 8px' }}>
            <img
              src={region.ward}
              alt=""
              draggable={false}
              style={{ height: 20, width: 20, objectFit: 'contain', opacity: 0.8, flexShrink: 0 }}
            />
            <div style={{ flex: 1, display: 'flex', gap: 2 }}>
              {regionPuzzles.map((p, i) => (
                <div
                  key={p.id}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    background: i < currentIdx
                      ? 'rgba(26,18,9,0.55)'
                      : i === currentIdx ? '#8B1A1A' : 'rgba(26,18,9,0.14)',
                  }}
                />
              ))}
            </div>
            <span className="font-serif shrink-0" style={{ fontSize: 10, color: 'rgba(26,18,9,0.45)' }}>
              {currentIdx + 1}/{regionPuzzles.length}
            </span>
          </div>
        )}
      </div>

      {/* ── Board — fills remaining space ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, minHeight: 0 }}>
        <div style={{ opacity: tilesReady ? 1 : 0, transition: 'opacity 0.4s ease', position: 'relative' }}>
          {!tilesReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-50 gap-3" style={{ minWidth: 200 }}>
              <p className="font-serif text-sm text-ink opacity-60 italic">Summoning the Watchers…</p>
              <div className="w-48 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(26,18,9,0.15)' }}>
                <div className="h-full rounded-full transition-all duration-200" style={{ width: `${loadProgress}%`, background: 'rgba(139,26,26,0.7)' }} />
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
      </div>

      {/* ── Controls footer ── */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        justifyContent: 'center',
        background: 'rgba(242,233,216,0.92)',
        borderTop: '1px solid rgba(26,18,9,0.12)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '8px 16px',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
      }}>
        <GameControls
          onHint={handleHint}
          onUndo={handleUndo}
          onRestart={handleRestart}
          hintsUsed={playerState.hintsUsed}
          canUndo={playerState.undoStack.length > 0}
          completed={playerState.completed}
        />
      </div>

      {/* ── Fixed overlays — never affect layout ── */}

      {/* Hint overlay */}
      <HintOverlay hint={hintResult} onDismiss={() => setHintResult(null)} />

      {pendingDiscovery && (
        <TechniqueDiscovery
          techniqueName={pendingDiscovery}
          onDismiss={() => setPendingDiscovery(null)}
        />
      )}

      {/* Contradiction / rejection — floats above footer */}
      {(rejectionMessage || (contradiction.found && !showCompletion)) && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom) + 72px)',
          left: 16, right: 16,
          zIndex: 40,
        }}>
          <div className="border border-red-ink bg-parchment px-4 py-2 rounded-sm" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
            <p className="font-serif text-sm text-red-ink italic">
              {rejectionMessage ?? contradiction.message ?? 'A contradiction lurks in the arrangement.'}
            </p>
          </div>
        </div>
      )}

      {/* Completion overlay */}
      {showCompletion && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(8,5,2,0.6)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowCompletion(false)}
        >
          <div
            className="relative select-none"
            style={{ width: '80%', maxWidth: 360, filter: 'drop-shadow(3px 7px 3px rgba(0,0,0,0.75))' }}
            onClick={e => e.stopPropagation()}
          >
            <img
              src={`/scrolls/scroll_0${(scrollIndexForId(puzzle.id) % 3) + 1}.png`}
              alt=""
              draggable={false}
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: 'fill', display: 'block' }}
            />
            <div className="relative text-center" style={{ padding: '10% 16%' }}>
              <div style={{ background: 'rgba(242,233,216,0.92)', padding: '12px 18px', borderRadius: 6, boxShadow: '0 0 24px 18px rgba(242,233,216,0.92)' }}>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <NextImage src="/svg/completion_stamp.svg" alt="Completed" width={28} height={28} />
                  <h2 className="font-lovecraftian text-lg text-ink leading-snug">Beacon Restored</h2>
                </div>
                <p className="font-serif text-xs text-ink-light italic">The Watchers stand vigilant. The wards hold.</p>
                {nextPuzzle && (
                  <div className="mt-3">
                    <Link href={`/puzzle/${nextPuzzle.id}`}>
                      <img
                        src="/buttons/left_button_01.png"
                        alt="Next Puzzle"
                        draggable={false}
                        className="transition-all duration-100 hover:brightness-110 active:scale-95"
                        style={{ height: 48, display: 'block', margin: '0 auto', transform: 'scaleX(-1)', filter: 'drop-shadow(3px 7px 3px rgba(0,0,0,0.75))' }}
                      />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chapter completion overlay */}
      {showChapterComplete && (() => {
        const completion = CHAPTER_COMPLETIONS[puzzle.difficulty];
        if (!completion) return null;
        return (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 60,
              display: 'flex', flexDirection: 'column',
              background: '#0a0705',
            }}
          >
            <img
              src={completion.image}
              alt=""
              draggable={false}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover', objectPosition: 'center top',
              }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to bottom, rgba(8,5,2,0.2) 0%, rgba(8,5,2,0.1) 35%, rgba(8,5,2,0.6) 65%, rgba(8,5,2,0.95) 100%)',
            }} />

            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '0 28px',
              paddingBottom: 'max(44px, env(safe-area-inset-bottom))',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
            }}>
              <p className="font-serif" style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(242,233,216,0.5)' }}>
                {completion.chapterLabel}
              </p>
              <h2 className="font-lovecraftian text-center" style={{ fontSize: 28, color: 'rgba(242,233,216,0.95)', textShadow: '0 2px 20px rgba(0,0,0,0.9)', lineHeight: 1.2, marginTop: -4 }}>
                {completion.title}
              </h2>
              <p className="font-journal text-center" style={{ fontSize: 18, color: 'rgba(242,233,216,0.78)', textShadow: '0 1px 8px rgba(0,0,0,0.9)', lineHeight: 1.65, maxWidth: 300, whiteSpace: 'pre-line' }}>
                {completion.lore}
              </p>
              <button
                onClick={() => router.push('/')}
                className="transition-all duration-100 hover:brightness-110 active:scale-95 relative"
                style={{ filter: 'drop-shadow(3px 7px 3px rgba(0,0,0,0.75))' }}
              >
                <img
                  src="/buttons/left_button_01.png"
                  alt="Continue"
                  draggable={false}
                  style={{ height: 64, display: 'block', transform: 'scaleX(-1)' }}
                />
                <span className="absolute inset-0 flex items-center justify-center font-serif text-sm font-bold" style={{ color: 'rgba(242,233,210,0.95)', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                  Continue
                </span>
              </button>
            </div>
          </div>
        );
      })()}

    </main>
  );
}
