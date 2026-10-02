'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Puzzle, Difficulty } from '@/engine/boardTypes';
import { splashAssetsDecoded } from '@/lib/appReady';

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

export default function PuzzleCard({
  puzzle,
  completed,
}: {
  puzzle: Puzzle;
  completed: boolean;
}) {
  const router = useRouter();
  const href = `/puzzle/${puzzle.id}`;

  // next/link's automatic prefetch buys nothing before the player has even
  // seen the home page, but on-device tracing found resolving a route's RSC
  // payload through Capacitor's capacitor://localhost scheme against the
  // ~370-puzzle static export directory cost several real seconds the first
  // time anything reaches into it — which just moved that cost to the first
  // real tap into a puzzle instead of eliminating it. Prefetching manually
  // once the splash's own asset decode is done (rather than waiting for the
  // whole splash sequence, including its deliberate minimum display time and
  // fade, to finish) spends that still-captive waiting time on this instead
  // of leaving it idle. Deliberately not any earlier than that: starting
  // this at splash-card-painted instead — the instant before the decode
  // begins — made the two contend over Capacitor's resource-serving layer
  // and stretched both out to several seconds apiece.
  useEffect(() => {
    let cancelled = false;
    splashAssetsDecoded.then(() => {
      if (!cancelled) router.prefetch(href);
    });
    return () => { cancelled = true; };
  }, [href, router]);

  return (
    <Link
      href={href}
      prefetch={false}
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
          &#9670;&thinsp;{puzzle.score}
        </span>
      </div>
    </Link>
  );
}
