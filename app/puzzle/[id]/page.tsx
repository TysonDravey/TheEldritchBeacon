'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { getPuzzleById } from '@/data/samplePuzzles';
import { loadPlayerState, savePlayerState, createFreshPlayerState } from '@/lib/storage';
import { getHint } from '@/engine/hints';
import { isSolved, canPlaceWatcher, watcherRejectionReason } from '@/engine/rules';
import { findContradictions } from '@/engine/solver';
import type { PlayerState, CellState, HintResult, ContradictionResult } from '@/engine/boardTypes';
import Board from '@/components/Board';
import GameControls from '@/components/GameControls';
import HintOverlay from '@/components/HintOverlay';

const UNDO_LIMIT = 50;

export default function PuzzlePage() {
  const params = useParams();
  const router = useRouter();
  const id     = typeof params.id === 'string' ? params.id : params.id?.[0] ?? '';
  const puzzle = getPuzzleById(id);

  const [playerState,      setPlayerState]      = useState<PlayerState | null>(null);
  const [hintResult,       setHintResult]       = useState<HintResult | null>(null);
  const [showCompletion,   setShowCompletion]   = useState(false);
  const [contradiction,    setContradiction]    = useState<ContradictionResult>({ found: false });
  const [flashCells,       setFlashCells]       = useState<[number, number][]>([]);
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);
  // Tracks how many hints player has asked without making a move — drives escalation
  const hintDepthRef = useRef(0);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Shared logic for applying any cell state change
  const applyChange = useCallback(
    (row: number, col: number, next: CellState) => {
      if (!playerState || !puzzle || playerState.completed) return;

      const newCells: CellState[][] = playerState.cells.map((r) => [...r]);
      newCells[row][col] = next;

      const newUndoStack = [
        ...playerState.undoStack,
        playerState.cells.map((r) => [...r]),
      ].slice(-UNDO_LIMIT);

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
      <main className="min-h-screen bg-parchment flex flex-col items-center justify-center px-4">
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
      <main className="min-h-screen bg-parchment flex items-center justify-center">
        <p className="font-serif text-ink opacity-60">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-parchment flex flex-col items-center px-4 py-8">

      {/* Back link */}
      <div className="w-full max-w-2xl mb-4">
        <button
          onClick={() => router.push('/')}
          className="font-serif text-sm text-ink-light hover:text-ink border-b border-transparent hover:border-ink transition-colors"
        >
          &larr; All Puzzles
        </button>
      </div>

      {/* Puzzle header — fixed height, never changes */}
      <div className="w-full max-w-2xl mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-ink">{puzzle.title}</h1>
          <p className="font-serif text-sm text-ink-light mt-0.5">
            {puzzle.size}&times;{puzzle.size} &mdash; {puzzle.difficulty}
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
      <Board
        puzzle={puzzle}
        playerCells={playerState.cells}
        onCellWard={handleCellWard}
        onCellWatcher={handleCellWatcher}
        primaryCell={hintResult?.primaryCell}
        highlightCells={hintResult?.highlightCells}
        highlightTerritories={hintResult?.highlightTerritories}
        secondaryHighlightTerritories={hintResult?.secondaryHighlightTerritories}
        highlightRows={hintResult?.highlightRows}
        highlightCols={hintResult?.highlightCols}
        hintActive={!!hintResult}
        contradiction={contradiction}
        flashCells={flashCells}
      />

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
            <Image src="/svg/completion_stamp.svg" alt="Completed" width={48} height={48} />
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
