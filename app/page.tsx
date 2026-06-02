'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { SAMPLE_PUZZLES } from '@/data/samplePuzzles';
import { scorePuzzle } from '@/engine/difficulty';
import type { Puzzle, Difficulty } from '@/engine/boardTypes';

const STORAGE_KEY_PREFIX = 'eldritch_beacon_state_';

function difficultyColor(difficulty: Difficulty): string {
  switch (difficulty) {
    case 'Initiate':    return 'text-ink border-ink';
    case 'Scholar':     return 'text-brass border-brass';
    case 'Occultist':   return 'text-red-ink border-red-ink';
    case 'High Priest': return 'text-red-ink border-red-ink opacity-80';
    case 'Eldritch':    return 'text-red-ink border-red-ink font-bold';
    case 'Harbinger':   return 'text-red-ink border-red-ink font-bold italic';
    case 'Archon':      return 'text-red-ink border-red-ink font-bold opacity-90';
    default:            return 'text-ink border-ink';
  }
}

function PuzzleCard({ puzzle, completed }: { puzzle: Puzzle; completed: boolean }) {
  const isShattered = puzzle.mode === 'shattered-realms';
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
        {isShattered && (
          <span className="inline-block text-xs border border-brass text-brass px-1.5 py-0.5 rounded-sm font-serif italic opacity-80">
            Shattered
          </span>
        )}
        <span className="text-xs font-serif text-ink-light opacity-50" title="Obscurity score">
          &#9670;&thinsp;{scorePuzzle(puzzle)}
        </span>
      </div>
    </Link>
  );
}

function SizeSection({
  size,
  puzzles,
  completedIds,
}: {
  size: number;
  puzzles: Puzzle[];
  completedIds: Set<string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const PREVIEW = 6;
  const shown = expanded ? puzzles : puzzles.slice(0, PREVIEW);
  const completedCount = puzzles.filter(p => completedIds.has(p.id)).length;

  return (
    <div className="mb-8">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-serif text-base font-bold text-ink">
          {size}&times;{size}
        </h3>
        <span className="font-serif text-xs text-ink-light">
          {completedCount}/{puzzles.length} solved
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {shown.map(p => (
          <PuzzleCard key={p.id} puzzle={p} completed={completedIds.has(p.id)} />
        ))}
      </div>
      {puzzles.length > PREVIEW && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-3 font-serif text-xs text-ink-light border-b border-transparent hover:border-ink-light transition-colors"
        >
          {expanded ? 'Show less' : `Show all ${puzzles.length} →`}
        </button>
      )}
    </div>
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
      } catch { /* ignore */ }
    }
    setCompletedIds(ids);
  }, []);

  // Split by mode
  const campaignPuzzles = SAMPLE_PUZZLES.filter(
    p => p.mode === 'initiate' || p.mode === 'cult-master'
  );
  const shatteredPuzzles = SAMPLE_PUZZLES.filter(p => p.mode === 'shattered-realms');

  // Group by size
  function groupBySize(puzzles: Puzzle[]): [number, Puzzle[]][] {
    const map = new Map<number, Puzzle[]>();
    for (const p of puzzles) {
      if (!map.has(p.size)) map.set(p.size, []);
      map.get(p.size)!.push(p);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }

  const campaignGroups  = groupBySize(campaignPuzzles);
  const shatteredGroups = groupBySize(shatteredPuzzles);

  return (
    <main className="min-h-screen bg-parchment flex flex-col items-center px-4 py-12">

      {/* Header */}
      <div className="flex flex-col items-center gap-4 mb-10">
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

      <div className="w-full max-w-2xl flex flex-col gap-6">

        {/* Daily Beacon — coming soon */}
        <section>
          <div className="flex items-center justify-between border border-ink border-opacity-30 bg-parchment px-4 py-3 rounded-sm opacity-50 cursor-not-allowed select-none">
            <div>
              <p className="font-serif text-sm font-bold text-ink">Daily Beacon</p>
              <p className="font-serif text-xs text-ink-light mt-0.5 italic">
                A new challenge every day — coming soon
              </p>
            </div>
            <span className="font-serif text-xs text-ink-light border border-ink border-opacity-30 px-2 py-0.5 rounded-sm">
              Soon
            </span>
          </div>
        </section>

        {/* Tutorial nudge */}
        <section>
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

        {/* Campaign */}
        <section>
          <h2 className="font-serif text-xl text-ink border-b border-ink pb-1 mb-6">
            Campaign
          </h2>
          {campaignGroups.map(([size, puzzles]) => (
            <SizeSection
              key={size}
              size={size}
              puzzles={puzzles}
              completedIds={completedIds}
            />
          ))}
        </section>

        {/* Shattered Realms — only shown when puzzles exist */}
        {shatteredGroups.length > 0 && (
          <section>
            <div className="border-b border-ink pb-1 mb-6">
              <h2 className="font-serif text-xl text-ink">Shattered Realms</h2>
              <p className="font-serif text-xs text-ink-light italic mt-0.5">
                Territories may be scattered — one Watcher per color, wherever it falls
              </p>
            </div>
            {shatteredGroups.map(([size, puzzles]) => (
              <SizeSection
                key={size}
                size={size}
                puzzles={puzzles}
                completedIds={completedIds}
              />
            ))}
          </section>
        )}

      </div>
    </main>
  );
}
