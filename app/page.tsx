'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { SAMPLE_PUZZLES } from '@/data/samplePuzzles';
import type { Puzzle, Difficulty } from '@/engine/boardTypes';

const STORAGE_KEY_PREFIX = 'eldritch_beacon_state_';

function difficultyColor(difficulty: Difficulty): string {
  switch (difficulty) {
    case 'Initiate':    return 'text-ink border-ink';
    case 'Scholar':     return 'text-brass border-brass';
    case 'Occultist':   return 'text-red-ink border-red-ink';
    case 'High Priest': return 'text-red-ink border-red-ink opacity-80';
    case 'Eldritch':    return 'text-red-ink border-red-ink font-bold';
    case 'Archon':      return 'text-red-ink border-red-ink font-bold opacity-90';
    default:            return 'text-ink border-ink';
  }
}

function PuzzleCard({ puzzle, completed }: { puzzle: Puzzle; completed: boolean }) {
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
          <span className="text-brass text-lg flex-shrink-0" title="Completed">
            ✓
          </span>
        )}
      </div>

      <p className="mt-1 text-ink-light text-sm font-serif">
        {puzzle.size}&times;{puzzle.size}
      </p>

      <span
        className={`mt-2 inline-block text-xs border px-1.5 py-0.5 rounded-sm font-serif ${difficultyColor(puzzle.difficulty)}`}
      >
        {puzzle.difficulty}
      </span>
    </Link>
  );
}

export default function HomePage() {
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ids = new Set<string>();
    for (const puzzle of SAMPLE_PUZZLES) {
      try {
        const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${puzzle.id}`);
        if (raw) {
          const state = JSON.parse(raw);
          if (state?.completed) ids.add(puzzle.id);
        }
      } catch {
        // ignore
      }
    }
    setCompletedIds(ids);
  }, []);

  return (
    <main className="min-h-screen bg-parchment flex flex-col items-center px-4 py-12">
      {/* Header */}
      <div className="flex flex-col items-center gap-4 mb-12">
        <Image
          src="/svg/lighthouse_mark.svg"
          alt="The Eldritch Beacon"
          width={120}
          height={120}
          priority
        />
        <h1 className="font-serif text-4xl font-bold text-ink tracking-tight text-center">
          The Eldritch Beacon
        </h1>
        <p className="font-serif text-base text-ink-light italic text-center">
          A Puzzle of Watchers and Wards
        </p>
        <div className="w-24 border-t border-ink opacity-30 mt-1" />
      </div>

      {/* Tutorial nudge */}
      <section className="w-full max-w-2xl mb-6">
        <Link
          href="/tutorial"
          className="flex items-center justify-between border border-brass bg-parchment hover:bg-parchment-dark transition-colors px-4 py-3 rounded-sm"
        >
          <div>
            <p className="font-serif text-sm font-bold text-brass">New to the Beacon?</p>
            <p className="font-serif text-xs text-ink-light mt-0.5">
              Learn the rules in a guided walkthrough
            </p>
          </div>
          <span className="font-serif text-sm text-brass opacity-60">&rarr;</span>
        </Link>
      </section>

      {/* Puzzle grid */}
      <section className="w-full max-w-2xl">
        <h2 className="font-serif text-xl text-ink mb-4 border-b border-ink pb-1">
          Puzzles
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SAMPLE_PUZZLES.map((puzzle) => (
            <PuzzleCard
              key={puzzle.id}
              puzzle={puzzle}
              completed={completedIds.has(puzzle.id)}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
