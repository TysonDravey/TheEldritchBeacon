'use client';

import Link from 'next/link';
import type { Puzzle, Difficulty } from '@/engine/boardTypes';
import { scorePuzzle } from '@/engine/difficulty';

export function difficultyColor(difficulty: Difficulty): string {
  switch (difficulty) {
    case 'Initiate':    return 'text-ink border-ink';
    case 'Scholar':     return 'text-brass border-brass';
    case 'Occultist':   return 'text-red-ink border-red-ink';
    case 'High Priest': return 'text-red-ink border-red-ink opacity-80';
    case 'Eldritch':    return 'text-red-ink border-red-ink font-bold';
    case 'Harbinger':   return 'text-red-ink border-red-ink font-bold italic';
    case 'Archon':      return 'text-red-ink border-red-ink font-bold opacity-90';
    case 'Unbound':     return 'text-red-ink border-red-ink font-bold italic opacity-90';
    default:            return 'text-ink border-ink';
  }
}

export default function PuzzleCard({ puzzle, completed }: { puzzle: Puzzle; completed: boolean }) {
  return (
    <Link
      href={`/puzzle/${puzzle.id}`}
      className="block border border-ink bg-parchment hover:bg-parchment-dark transition-colors duration-150 p-4 rounded-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-serif text-base font-bold text-ink leading-snug">
          {puzzle.title}
        </h3>
        {completed && (
          <span className="text-brass text-lg flex-shrink-0" title="Completed">✓</span>
        )}
      </div>
      <p className="mt-1 text-ink-light text-sm font-serif">
        {puzzle.size}&times;{puzzle.size}
      </p>
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <span className={`inline-block text-xs border px-1.5 py-0.5 rounded-sm font-serif ${difficultyColor(puzzle.difficulty)}`}>
          {puzzle.difficulty}
        </span>
        <span className="text-xs font-serif text-ink-light opacity-50" title="Obscurity score">
          &#9670;&thinsp;{scorePuzzle(puzzle)}
        </span>
      </div>
    </Link>
  );
}
