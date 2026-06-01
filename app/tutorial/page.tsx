'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Board from '@/components/Board';
import type { CellState, Puzzle } from '@/engine/boardTypes';

// ---------------------------------------------------------------------------
// Tutorial puzzle — 4×4, two valid solutions, scripted path: (0,1)→(1,3)→(2,0)→(3,2)
// ---------------------------------------------------------------------------

const PUZZLE: Puzzle = {
  id: 'tutorial',
  title: 'The First Awakening',
  mode: 'initiate',
  size: 4,
  territoryMap: [
    [0, 0, 1, 1],
    [0, 0, 1, 1],
    [2, 2, 3, 3],
    [2, 2, 3, 3],
  ],
  solution: [[0, 1], [1, 3], [2, 0], [3, 2]],
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
  {
    title: 'The Watchers Stir',
    body: 'The board is divided into four colored territories. Every territory must hold exactly one Watcher — no more, no fewer.',
    action: { type: 'next' },
  },
  {
    title: 'Three Laws',
    body: '• One Watcher per territory\n• No two Watchers in the same row\n• No two Watchers in the same column\n• Watchers may never stand adjacent — not even diagonally',
    action: { type: 'next' },
  },
  {
    title: 'Your First Watcher',
    body: 'Double-click the glowing cell to place a Watcher in the top-left territory.',
    action: { type: 'watcher', row: 0, col: 1 },
    primaryCell: [0, 1],
  },
  {
    title: 'Row and Column Claimed',
    body: 'This Watcher now holds its row and column. No second Watcher may stand in either. The × marks show every cell that has been eliminated.',
    action: { type: 'next' },
    // Brass outlines on all wards placed by this watcher
    secondaryCells: [[0,0],[0,2],[0,3],[1,0],[1,1],[1,2],[2,1],[3,1]],
  },
  {
    title: 'One Cell Remains',
    body: 'Three of the four cells in the top-right territory are now blocked. Only one valid placement remains — the logic compels it.',
    action: { type: 'next' },
    highlightTerritories: [1],
  },
  {
    title: 'Follow the Logic',
    body: 'Double-click to place the Watcher in the only open cell of the top-right territory.',
    action: { type: 'watcher', row: 1, col: 3 },
    primaryCell: [1, 3],
  },
  {
    title: 'Two Down',
    body: 'Two territories remain. Study what the eliminations have left open, and find where the Watchers must stand.',
    action: { type: 'next' },
  },
  {
    title: 'The Bottom-Left Territory',
    body: 'Double-click to place the Watcher in the bottom-left territory.',
    action: { type: 'watcher', row: 2, col: 0 },
    primaryCell: [2, 0],
  },
  {
    title: 'One Last Light',
    body: 'Place the final Watcher to complete the puzzle.',
    action: { type: 'watcher', row: 3, col: 2 },
    primaryCell: [3, 2],
  },
  {
    title: 'The Beacon Is Restored',
    body: 'You have mastered the basics. The puzzles grow harder — but the logic always lights the way.',
    action: { type: 'done' },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function propagateWatcher(cells: CellState[][], row: number, col: number): CellState[][] {
  const next = cells.map(r => [...r]);
  next[row][col] = 'watcher';
  for (let c = 0; c < N; c++)
    if (c !== col && next[row][c] === 'empty') next[row][c] = 'ward';
  for (let r = 0; r < N; r++)
    if (r !== row && next[r][col] === 'empty') next[r][col] = 'ward';
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr, nc = col + dc;
      if (nr >= 0 && nr < N && nc >= 0 && nc < N && next[nr][nc] === 'empty')
        next[nr][nc] = 'ward';
    }
  }
  return next;
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

  const step = STEPS[stepIdx];

  function showWrong(msg: string) {
    setWrongMsg(msg);
    setTimeout(() => setWrongMsg(null), 1500);
  }

  function handleCellWatcher(row: number, col: number) {
    if (step.action.type !== 'watcher') {
      if (step.action.type === 'next') showWrong('Press Next to continue.');
      return;
    }
    if (row !== step.action.row || col !== step.action.col) {
      showWrong('Try the glowing cell.');
      return;
    }
    setCells(prev => propagateWatcher(prev, row, col));
    setWrongMsg(null);
    setStepIdx(i => i + 1);
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

        {/* Board */}
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

        {/* Victory banner — shown on the final step */}
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
                    width:  i === stepIdx ? '10px' : '8px',
                    height: i === stepIdx ? '10px' : '8px',
                    borderRadius: '50%',
                    border: `1px solid ${i <= stepIdx ? '#1A1209' : '#1A1209'}`,
                    backgroundColor:
                      i < stepIdx  ? '#1A1209' :
                      i === stepIdx ? '#B5860D' :
                      'transparent',
                    transition: 'all 0.2s',
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
