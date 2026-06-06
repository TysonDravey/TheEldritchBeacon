'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SAMPLE_PUZZLES } from '@/data/samplePuzzles';
import { rateDifficulty, scorePuzzle } from '@/engine/difficulty';
import type { Puzzle, Difficulty } from '@/engine/boardTypes';
import SplashScreen from '@/components/SplashScreen';

const STORAGE_KEY_PREFIX = 'eldritch_beacon_state_';
const UNLOCKED_KEY = 'eb_unlocked_regions';

const OUTLINE = '-1px -1px 0 rgba(242,233,216,0.95), 1px -1px 0 rgba(242,233,216,0.95), -1px 1px 0 rgba(242,233,216,0.95), 1px 1px 0 rgba(242,233,216,0.95)';

const REGIONS: {
  name: string;
  difficulty: Difficulty;
  ward: string;
  description: string;
  techniques: string[];
}[] = [
  {
    name: 'The Foundations',
    difficulty: 'Initiate',
    ward: '/tiles/wards/genericward_01.png',
    description: 'The base of the Beacon. Light still reaches here.',
    techniques: ['Last Refuge', 'Full Row', 'Full Column', 'Touching Shadows'],
  },
  {
    name: 'The Shore',
    difficulty: 'Scholar',
    ward: '/tiles/wards/ward_seagreen_01.png',
    description: 'Salt and stone. The tide carries strange things.',
    techniques: ['Territory Lock', 'Column Lock'],
  },
  {
    name: 'The Fog',
    difficulty: 'Occultist',
    ward: '/tiles/wards/ward_indigo_01.png',
    description: 'Visibility narrows. Shapes move in the grey.',
    techniques: ['Narrow Channel', 'Shared Horizon'],
  },
  {
    name: 'The Reefs',
    difficulty: 'High Priest',
    ward: '/tiles/wards/ward_emerald_01.png',
    description: 'Hidden dangers below the surface. Proceed carefully.',
    techniques: ['Beacon Pair', 'Territory Dead-End', 'Dual Confinement'],
  },
  {
    name: 'Deep Water',
    difficulty: 'Eldritch',
    ward: '/tiles/wards/ward_storm_01.png',
    description: 'No light reaches here. Something watches from below.',
    techniques: ['Mutual Exclusion', 'Forbidden Tide', 'Territory Network'],
  },
  {
    name: 'The Black Tide',
    difficulty: 'Harbinger',
    ward: '/tiles/wards/ward_crimson_03.png',
    description: 'The water has turned. The rules have not.',
    techniques: ['Forced Territory Chain', 'Chain of Madness'],
  },
  {
    name: 'The Lantern Room',
    difficulty: 'Archon',
    ward: '/tiles/wards/ward_ochre_01.png',
    description: 'The top of the Beacon. Whatever keeps the light burning lives here.',
    techniques: ['Deep Current', 'Watcher Network'],
  },
];

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

function RegionSection({
  region,
  puzzles,
  completedIds,
  locked,
  newlyUnlocked,
}: {
  region: typeof REGIONS[number];
  puzzles: Puzzle[];
  completedIds: Set<string>;
  locked: boolean;
  newlyUnlocked: boolean;
}) {
  const sorted = [...puzzles].sort((a, b) => scorePuzzle(a) - scorePuzzle(b));
  const completedCount = sorted.filter(p => completedIds.has(p.id)).length;
  const allDone = completedCount === sorted.length;
  const currentPuzzle = sorted.find(p => !completedIds.has(p.id)) ?? null;
  const currentIdx = sorted.findIndex(p => !completedIds.has(p.id));

  // ── Locked ──────────────────────────────────────────────────────────────
  if (locked) {
    return (
      <div className="opacity-40 select-none">
        <div className="flex items-center gap-4">
          <img
            src={region.ward}
            alt=""
            className="w-12 h-12 object-contain grayscale"
          />
          <div>
            <h2 className="font-lovecraftian text-xl text-ink" style={{ textShadow: OUTLINE }}>
              {region.name}
            </h2>
            <p className="font-serif text-xs text-ink-light italic mt-0.5" style={{ textShadow: OUTLINE }}>
              Sealed — complete the previous region to ascend
            </p>
          </div>
        </div>
        <div className="border-t border-ink opacity-30 mt-4" />
      </div>
    );
  }

  // ── Complete ─────────────────────────────────────────────────────────────
  if (allDone) {
    return (
      <div>
        <div className="flex items-center gap-4">
          <img
            src={region.ward}
            alt=""
            className="w-12 h-12 object-contain"
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
          />
          <div className="flex-1">
            <h2 className="font-lovecraftian text-xl text-ink" style={{ textShadow: OUTLINE }}>
              {region.name}
              <span className="ml-2 text-brass text-base font-serif">✓</span>
            </h2>
            <p className="font-serif text-xs text-ink-light italic mt-0.5" style={{ textShadow: OUTLINE }}>
              {completedCount}/{sorted.length} completed
            </p>
          </div>
        </div>
        <div className="border-t border-ink opacity-30 mt-4" />
      </div>
    );
  }

  // ── Active ────────────────────────────────────────────────────────────────
  return (
    <div
      style={newlyUnlocked ? {
        animation: 'region-reveal 1.2s ease-out both',
      } : undefined}
    >
      {/* Region header */}
      <div className="flex items-start gap-4 mb-3">
        <img
          src={region.ward}
          alt=""
          className="w-16 h-16 object-contain shrink-0"
          style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.65))' }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-lovecraftian text-xl text-ink" style={{ textShadow: OUTLINE }}>
              {region.name}
            </h2>
            <span className="font-serif text-xs text-ink-light shrink-0" style={{ textShadow: OUTLINE }}>
              {completedCount}/{sorted.length}
            </span>
          </div>
          <p className="font-serif text-xs text-ink-light italic mt-0.5" style={{ textShadow: OUTLINE }}>
            {region.description}
          </p>
          <p className="font-serif text-xs text-ink-light opacity-60 mt-1" style={{ textShadow: OUTLINE }}>
            {region.techniques.join(' · ')}
          </p>
        </div>
      </div>

      <div className="border-t border-ink opacity-30 mb-4" />

      {/* Current puzzle */}
      {currentPuzzle && (
        <div>
          <PuzzleCard puzzle={currentPuzzle} completed={false} />
          <p className="mt-2 font-serif text-xs text-center text-ink-light" style={{ textShadow: OUTLINE }}>
            Puzzle {currentIdx + 1} of {sorted.length}
          </p>
        </div>
      )}
    </div>
  );
}

function ResetFooter({ onReset }: { onReset: () => void }) {
  const [confirming, setConfirming] = useState(false);

  function handleReset() {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) localStorage.removeItem(key);
    }
    localStorage.removeItem(UNLOCKED_KEY);
    setConfirming(false);
    onReset();
  }

  return (
    <div className="text-center">
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="font-serif text-xs text-ink-light opacity-40 hover:opacity-70 transition-opacity"
          style={{ textShadow: OUTLINE }}
        >
          Reset progress
        </button>
      ) : (
        <div className="inline-flex items-center gap-3 bg-parchment border border-ink border-opacity-30 px-4 py-2 rounded-sm">
          <span className="font-serif text-xs text-ink-light">Erase all progress?</span>
          <button
            onClick={handleReset}
            className="font-serif text-xs text-red-ink border border-red-ink px-2 py-0.5 rounded-sm hover:bg-red-ink hover:text-parchment transition-colors"
          >
            Yes, reset
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="font-serif text-xs text-ink-light hover:text-ink transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const [completedIds, setCompletedIds]     = useState<Set<string>>(new Set());
  const [newlyUnlocked, setNewlyUnlocked]   = useState<string | null>(null);
  const [showBanner, setShowBanner]         = useState(false);

  useEffect(() => {
    // Load completed puzzle IDs
    const ids = new Set<string>();
    for (const puzzle of SAMPLE_PUZZLES) {
      try {
        const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${puzzle.id}`);
        if (raw && JSON.parse(raw)?.completed) ids.add(puzzle.id);
      } catch { /* ignore */ }
    }
    setCompletedIds(ids);

    // Detect newly unlocked regions for the celebration banner
    const known = new Set<string>(JSON.parse(localStorage.getItem(UNLOCKED_KEY) ?? '[]'));
    const byDiff = new Map<Difficulty, Puzzle[]>();
    for (const p of SAMPLE_PUZZLES.filter(p => p.mode === 'initiate' || p.mode === 'cult-master')) {
      const d = rateDifficulty(p);
      if (!byDiff.has(d)) byDiff.set(d, []);
      byDiff.get(d)!.push(p);
    }

    // Walk the region chain to find what's newly unlocked
    let prevComplete = true;
    const nowKnown = new Set(known);
    let firstNew: string | null = null;
    for (const region of REGIONS) {
      const puzzles = byDiff.get(region.difficulty) ?? [];
      if (puzzles.length === 0) continue;
      if (!prevComplete) break;
      // This region is unlocked
      if (!known.has(region.name)) {
        nowKnown.add(region.name);
        if (!firstNew) firstNew = region.name;
      }
      prevComplete = puzzles.every(p => ids.has(p.id));
    }

    if (firstNew && firstNew !== 'The Foundations') {
      setNewlyUnlocked(firstNew);
      setShowBanner(true);
      localStorage.setItem(UNLOCKED_KEY, JSON.stringify([...nowKnown]));
    } else {
      localStorage.setItem(UNLOCKED_KEY, JSON.stringify([...nowKnown]));
    }
  }, []);

  // Group campaign puzzles by difficulty
  const campaignPuzzles = SAMPLE_PUZZLES.filter(
    p => p.mode === 'initiate' || p.mode === 'cult-master'
  );
  const byDifficulty = new Map<Difficulty, Puzzle[]>();
  for (const p of campaignPuzzles) {
    const d = rateDifficulty(p);
    if (!byDifficulty.has(d)) byDifficulty.set(d, []);
    byDifficulty.get(d)!.push(p);
  }

  // Compute which regions are locked (previous must be fully complete)
  const lockedRegions = new Set<string>();
  let prevComplete = true;
  for (const region of REGIONS) {
    const puzzles = byDifficulty.get(region.difficulty) ?? [];
    if (puzzles.length === 0) continue;
    if (!prevComplete) lockedRegions.add(region.name);
    prevComplete = prevComplete && puzzles.every(p => completedIds.has(p.id));
  }

  const shatteredPuzzles = SAMPLE_PUZZLES.filter(p => p.mode === 'shattered-realms');

  return (
    <>
      <SplashScreen />

      {/* Region-unlock celebration banner */}
      {showBanner && newlyUnlocked && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
          style={{ animation: 'banner-drop 0.5s ease-out both' }}
        >
          <div
            className="bg-parchment border border-brass text-ink font-lovecraftian text-base px-8 py-3 rounded-b-sm pointer-events-auto cursor-pointer"
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.5)', filter: 'drop-shadow(0 2px 8px rgba(181,134,13,0.5))' }}
            onClick={() => setShowBanner(false)}
          >
            {newlyUnlocked} has been revealed
          </div>
        </div>
      )}

      <main className="min-h-screen flex flex-col items-center px-6 py-12">

        {/* Header scroll */}
        <div
          className="w-full max-w-lg mb-10 relative select-none"
          style={{ filter: 'drop-shadow(3px 7px 3px rgba(0,0,0,0.75))' }}
        >
          <img src="/scrolls/scroll_02.png" alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: 'fill' }} />
          <div className="relative text-center" style={{ padding: '10% 16%' }}>
            <div style={{ background: 'rgba(242,233,216,0.88)', padding: '10px 18px', borderRadius: 6, boxShadow: '0 0 24px 18px rgba(242,233,216,0.88)' }}>
              <h1 className="font-lovecraftian text-3xl text-ink leading-snug">The Eldritch Beacon</h1>
              <p className="font-serif text-sm text-ink-light italic mt-1">A Puzzle of Watchers and Wards</p>
            </div>
          </div>
        </div>

        <div className="w-full max-w-2xl flex flex-col gap-8">

          {/* Daily Beacon — coming soon */}
          <section>
            <div className="flex items-center justify-between border border-ink border-opacity-30 bg-parchment px-4 py-3 rounded-sm opacity-50 cursor-not-allowed select-none">
              <div>
                <p className="font-serif text-sm font-bold text-ink">Daily Beacon</p>
                <p className="font-serif text-xs text-ink-light mt-0.5 italic">A new challenge every day — coming soon</p>
              </div>
              <span className="font-serif text-xs text-ink-light border border-ink border-opacity-30 px-2 py-0.5 rounded-sm">Soon</span>
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
                <p className="font-serif text-xs text-ink-light mt-0.5">Learn the rules in a guided walkthrough</p>
              </div>
              <span className="font-serif text-sm text-brass opacity-60">&rarr;</span>
            </Link>
          </section>

          {/* Campaign regions */}
          <section className="flex flex-col gap-8">
            {REGIONS.map(region => {
              const puzzles = byDifficulty.get(region.difficulty) ?? [];
              if (puzzles.length === 0) return null;
              return (
                <RegionSection
                  key={region.difficulty}
                  region={region}
                  puzzles={puzzles}
                  completedIds={completedIds}
                  locked={lockedRegions.has(region.name)}
                  newlyUnlocked={region.name === newlyUnlocked}
                />
              );
            })}
          </section>

          {/* Shattered Realms */}
          {shatteredPuzzles.length > 0 && (
            <section>
              <div className="border-b border-ink pb-1 mb-6">
                <h2 className="font-lovecraftian text-xl text-ink" style={{ textShadow: OUTLINE }}>Shattered Realms</h2>
                <p className="font-serif text-xs text-ink-light italic mt-0.5" style={{ textShadow: OUTLINE }}>
                  Territories may be scattered — one Watcher per color, wherever it falls
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {shatteredPuzzles.map(p => (
                  <PuzzleCard key={p.id} puzzle={p} completed={completedIds.has(p.id)} />
                ))}
              </div>
            </section>
          )}

        </div>

        {/* Footer */}
        <footer className="w-full max-w-2xl mt-16 pb-8">
          <ResetFooter onReset={() => {
            setCompletedIds(new Set());
            setNewlyUnlocked(null);
            setShowBanner(false);
          }} />
        </footer>

      </main>

      <style>{`
        @keyframes region-reveal {
          0%   { opacity: 0; transform: translateY(12px); filter: brightness(1.4); }
          40%  { opacity: 1; transform: translateY(0);    filter: brightness(1.4); }
          100% { opacity: 1; transform: translateY(0);    filter: brightness(1); }
        }
        @keyframes banner-drop {
          0%   { opacity: 0; transform: translateY(-100%); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
