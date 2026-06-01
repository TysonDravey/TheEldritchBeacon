'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Board from '@/components/Board';
import type { CellState, Puzzle } from '@/engine/boardTypes';

// ---------------------------------------------------------------------------
// Tutorial puzzle — 5×5 based on eb-5x5-001
// Solution path: T0(0,4) → T1(1,2) → T2(2,0) forced → T4(4,1) cascade → T3(3,3)
// ---------------------------------------------------------------------------

const PUZZLE: Puzzle = {
  id: 'tutorial',
  title: 'The First Awakening',
  mode: 'initiate',
  size: 5,
  territoryMap: [
    [1, 1, 1, 0, 0],
    [1, 1, 1, 3, 3],
    [2, 2, 1, 3, 3],
    [4, 4, 3, 3, 3],
    [4, 4, 4, 3, 3],
  ],
  solution: [[0, 4], [1, 2], [2, 0], [3, 3], [4, 1]],
  difficulty: 'Initiate',
  seed: 'tutorial',
  createdAt: '2026-01-01',
};

const N = PUZZLE.size;

// ---------------------------------------------------------------------------
// Step types
// ---------------------------------------------------------------------------

type StepAction =
  | { type: 'next' }
  | { type: 'watcher'; row: number; col: number }
  | { type: 'done' };

interface TutorialStep {
  title: string;
  body: string;
  action: StepAction;
  primaryCell?: [number, number];
  highlightCells?: [number, number][];
  secondaryCells?: [number, number][];
  highlightTerritories?: number[];
  highlightRows?: number[];
  highlightCols?: number[];
  hintActive?: boolean;
}

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEPS: TutorialStep[] = [
  // ── Introduction ──────────────────────────────────────────────────────────
  {
    title: 'The Watchers Stir',
    body: 'Five colored territories. Each must hold exactly one Watcher — no more, no fewer.',
    action: { type: 'next' },
  },
  {
    title: 'Four Laws',
    body: '• One Watcher per territory\n• No two in the same row\n• No two in the same column\n• None adjacent — not even diagonally',
    action: { type: 'next' },
  },

  // ── Row confinement ───────────────────────────────────────────────────────
  {
    title: 'Row Confinement',
    body: 'The two outlined territories each have only two cells — both in the same row. No matter which cell a Watcher uses, it will always claim that entire row.\n\nThe dimmed cells sharing those rows will be eliminated.',
    action: { type: 'next' },
    highlightTerritories: [0, 2],
    // Brass outlines on same-row cells from other territories
    secondaryCells: [[0,0],[0,1],[0,2],[2,2],[2,3],[2,4]],
    hintActive: true,
  },
  {
    title: 'The Large Territory Narrows',
    body: 'Once those rows are claimed, the large territory loses its top-row cells and its one row-3 cell. Only three candidates remain — all in the second row (outlined).',
    action: { type: 'next' },
    highlightCells: [[1,0],[1,1],[1,2]],
    secondaryCells: [[0,0],[0,1],[0,2],[2,2]],
    hintActive: true,
  },

  // ── First placement (fully explained) ────────────────────────────────────
  {
    title: 'One Column Survives',
    body: 'Columns 1 and 2 (outlined red) would sit diagonally adjacent to the left territory\'s cells (outlined gold). That would eliminate both — making it unsolvable.\n\nOnly the third column (glowing) is safe. Double-click to place.',
    action: { type: 'watcher', row: 1, col: 2 },
    primaryCell: [1, 2],
    highlightCells: [[1,0],[1,1]],
    secondaryCells: [[2,0],[2,1]],
    hintActive: true,
  },

  // ── Cascade ───────────────────────────────────────────────────────────────
  {
    title: 'Chain Reaction',
    body: 'The Watcher\'s diagonal adjacency just eliminated one of the left territory\'s two cells. Only one remains — the logic forces the next move.',
    action: { type: 'next' },
    highlightTerritories: [2],
  },
  {
    title: 'Forced',
    body: 'One cell remains. Double-click to place.',
    action: { type: 'watcher', row: 2, col: 0 },
    primaryCell: [2, 0],
    highlightTerritories: [2],
  },
  {
    title: 'The Cascade Continues',
    body: 'Row and column eliminations have closed off four of the bottom territory\'s five cells. One remains.',
    action: { type: 'watcher', row: 4, col: 1 },
    primaryCell: [4, 1],
    highlightTerritories: [4],
  },
  {
    title: 'Top-Right Territory Revealed',
    body: 'The diagonal adjacency from the large territory\'s Watcher just eliminated the left cell of the top-right territory. Only one option remains.',
    action: { type: 'watcher', row: 0, col: 4 },
    primaryCell: [0, 4],
    highlightTerritories: [0],
  },
  {
    title: 'One Last Light',
    body: 'Place the final Watcher.',
    action: { type: 'watcher', row: 3, col: 3 },
    primaryCell: [3, 3],
    highlightTerritories: [3],
  },
  {
    title: 'The Beacon Is Restored',
    body: 'You mastered row confinement and cascading deductions — the same logic powers every puzzle in the Beacon.',
    action: { type: 'done' },
  },
];

// ---------------------------------------------------------------------------
// Ward wave propagation — splits into adjacent (wave1) and far row/col (wave2)
// ---------------------------------------------------------------------------

function computeWaves(row: number, col: number, cells: CellState[][]): {
  wave1: [number, number][];
  wave2: [number, number][];
} {
  const wave1: [number, number][] = [];
  const wave2: [number, number][] = [];

  // Wave 1: all cells within Chebyshev distance 1 (the 8 surrounding cells)
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr, nc = col + dc;
      if (nr >= 0 && nr < N && nc >= 0 && nc < N && cells[nr][nc] === 'empty') {
        wave1.push([nr, nc]);
      }
    }
  }

  // Wave 2: row/col cells further than distance 1
  for (let c = 0; c < N; c++) {
    if (c !== col && Math.abs(c - col) > 1 && cells[row][c] === 'empty') {
      wave2.push([row, c]);
    }
  }
  for (let r = 0; r < N; r++) {
    if (r !== row && Math.abs(r - row) > 1 && cells[r][col] === 'empty') {
      wave2.push([r, col]);
    }
  }

  return { wave1, wave2 };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TutorialPage() {
  const [stepIdx, setStepIdx] = useState(0);
  const [cells, setCells] = useState<CellState[][]>(
    () => Array.from({ length: N }, () => Array<CellState>(N).fill('empty')),
  );
  const [wrongMsg, setWrongMsg] = useState<string | null>(null);
  const placingRef = useRef(false); // lock during wave animation

  const step = STEPS[stepIdx];

  function showWrong(msg: string) {
    setWrongMsg(msg);
    setTimeout(() => setWrongMsg(null), 1500);
  }

  function handleCellWatcher(row: number, col: number) {
    if (placingRef.current) return;
    if (step.action.type !== 'watcher') {
      if (step.action.type === 'next') showWrong('Press Next to continue.');
      return;
    }
    if (row !== step.action.row || col !== step.action.col) {
      showWrong('Try the glowing cell.');
      return;
    }

    placingRef.current = true;
    setWrongMsg(null);

    // Compute waves before any state update
    const { wave1, wave2 } = computeWaves(row, col, cells);

    // Immediately place the watcher
    setCells(prev => {
      const next = prev.map(r => [...r]);
      next[row][col] = 'watcher';
      return next;
    });

    // Wave 1: adjacent wards (130ms)
    setTimeout(() => {
      setCells(prev => {
        const next = prev.map(r => [...r]);
        wave1.forEach(([r, c]) => { if (next[r][c] === 'empty') next[r][c] = 'ward'; });
        return next;
      });
    }, 130);

    // Wave 2: far row/col wards + advance step (320ms)
    setTimeout(() => {
      setCells(prev => {
        const next = prev.map(r => [...r]);
        wave2.forEach(([r, c]) => { if (next[r][c] === 'empty') next[r][c] = 'ward'; });
        return next;
      });
      setStepIdx(i => i + 1);
      placingRef.current = false;
    }, 320);
  }

  function handleCellWard(_row: number, _col: number) {
    if (step.action.type === 'next') showWrong('Press Next to continue.');
    else if (step.action.type === 'watcher') showWrong('Double-click to place a Watcher.');
  }

  function handleNext() {
    if (step.action.type !== 'next') return;
    setWrongMsg(null);
    setStepIdx(i => i + 1);
  }

  const isDone = step.action.type === 'done';

  return (
    <main className="min-h-screen bg-parchment flex flex-col items-center px-4 py-10">

      {/* Nav */}
      <div className="w-full max-w-2xl mb-8 flex items-center gap-2">
        <Link
          href="/"
          className="font-serif text-sm text-ink-light hover:text-ink border-b border-transparent hover:border-ink transition-colors"
        >
          &larr; All Puzzles
        </Link>
        <span className="font-serif text-xs text-ink opacity-30 mx-1">|</span>
        <span className="font-serif text-sm text-ink-light">Tutorial</span>
      </div>

      <div className="flex flex-col items-center gap-6 w-full max-w-lg">

        {/* Board — data-ward-animate scopes the CSS pop-in to this page only */}
        <div data-ward-animate="true">
          <Board
            puzzle={PUZZLE}
            playerCells={cells}
            onCellWard={handleCellWard}
            onCellWatcher={handleCellWatcher}
            primaryCell={step.primaryCell}
            highlightCells={step.highlightCells}
            secondaryHighlightCells={step.secondaryCells}
            highlightTerritories={step.highlightTerritories}
            highlightRows={step.highlightRows}
            highlightCols={step.highlightCols}
            hintActive={step.hintActive ?? false}
          />
        </div>

        {/* Victory banner */}
        {isDone && (
          <div className="w-full border-2 border-brass bg-parchment px-5 py-4 flex items-center gap-4 rounded-sm">
            <Image src="/svg/completion_stamp.svg" alt="Complete" width={44} height={44} />
            <div>
              <p className="font-serif text-base font-bold text-ink">Beacon Restored</p>
              <p className="font-serif text-xs text-ink-light italic">
                The Watchers stand vigilant. The wards hold.
              </p>
            </div>
          </div>
        )}

        {/* Instruction card */}
        <div className="w-full border border-ink bg-parchment p-5 rounded-sm">
          <h2 className="font-serif text-lg font-bold text-ink mb-2">{step.title}</h2>
          <p className="font-serif text-sm text-ink-light whitespace-pre-line leading-relaxed">
            {step.body}
          </p>

          {wrongMsg && (
            <p className="mt-3 font-serif text-xs text-red-ink italic">{wrongMsg}</p>
          )}

          <div className="mt-5 flex items-center justify-between">
            {/* Progress dots */}
            <div className="flex gap-1.5 items-center">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width:           i === stepIdx ? '10px' : '8px',
                    height:          i === stepIdx ? '10px' : '8px',
                    borderRadius:    '50%',
                    border:          '1px solid #1A1209',
                    backgroundColor: i < stepIdx ? '#1A1209' : i === stepIdx ? '#B5860D' : 'transparent',
                    transition:      'all 0.2s',
                  }}
                />
              ))}
            </div>

            {/* CTA */}
            {step.action.type === 'next' && (
              <button
                onClick={handleNext}
                className="font-serif text-sm border border-ink px-4 py-1.5 rounded-sm hover:bg-parchment-dark transition-colors"
              >
                Next &rarr;
              </button>
            )}
            {step.action.type === 'watcher' && (
              <span className="font-serif text-xs text-ink-light italic">
                Double-click to place
              </span>
            )}
            {isDone && (
              <Link
                href="/"
                className="font-serif text-sm border border-brass text-brass px-4 py-1.5 rounded-sm hover:bg-parchment-dark transition-colors"
              >
                Begin Puzzles &rarr;
              </Link>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}
