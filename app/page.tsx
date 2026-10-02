'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SAMPLE_PUZZLES } from '@/data/samplePuzzles';
import type { Puzzle, Difficulty } from '@/engine/boardTypes';
import SplashScreen from '@/components/SplashScreen';
import { REGIONS, campaignRegionDifficulty } from '@/data/regions';
import { useSettings } from '@/lib/settings';
import { playSound } from '@/lib/sound';
import PuzzleCard from '@/components/PuzzleCard';

const STORAGE_KEY_PREFIX = 'eldritch_beacon_state_';
const UNLOCKED_KEY = 'eb_unlocked_regions';

export default function HomePage() {
  const [completedIds, setCompletedIds]   = useState<Set<string>>(new Set());
  const [newlyUnlocked, setNewlyUnlocked] = useState<string | null>(null);
  const [showBanner, setShowBanner]       = useState(false);
  const [settings, updateSettings]        = useSettings();

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
    for (const p of SAMPLE_PUZZLES.filter(p => p.mode === 'initiate')) {
      const region = campaignRegionDifficulty(p);
      if (!byDiff.has(region)) byDiff.set(region, []);
      byDiff.get(region)!.push(p);
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
      playSound('region-reveal');
      localStorage.setItem(UNLOCKED_KEY, JSON.stringify([...nowKnown]));
    } else {
      localStorage.setItem(UNLOCKED_KEY, JSON.stringify([...nowKnown]));
    }
  }, []);

  // Group campaign puzzles by difficulty — only needed here to compute the
  // "Chapter N — Region Name" banner text, not to render per-region detail
  // (that detail now lives entirely on /campaign/map).
  const campaignPuzzles = SAMPLE_PUZZLES.filter(p => p.mode === 'initiate');
  const byDifficulty = new Map<Difficulty, Puzzle[]>();
  for (const p of campaignPuzzles) {
    const region = campaignRegionDifficulty(p);
    if (!byDifficulty.has(region)) byDifficulty.set(region, []);
    byDifficulty.get(region)!.push(p);
  }

  // Compute current chapter for the campaign banner
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const regionsWithPuzzles = REGIONS.filter(r => (byDifficulty.get(r.difficulty) ?? []).length > 0);
  let currentChapterIdx = regionsWithPuzzles.length - 1;
  let allChaptersComplete = true;
  for (let i = 0; i < regionsWithPuzzles.length; i++) {
    const puzzles = byDifficulty.get(regionsWithPuzzles[i].difficulty) ?? [];
    if (!puzzles.every(p => completedIds.has(p.id))) {
      currentChapterIdx = i;
      allChaptersComplete = false;
      break;
    }
  }
  const completedChapterCount = allChaptersComplete ? regionsWithPuzzles.length : currentChapterIdx;
  const currentRegion = regionsWithPuzzles[currentChapterIdx];
  const chapterImage = completedChapterCount === 0
    ? '/titleCards/campaign_01/intro_01.png'
    : `/titleCards/campaign_01/chapter_${String(completedChapterCount).padStart(2, '0')}.png`;
  const chapterRoman = ROMAN[currentChapterIdx] ?? String(currentChapterIdx + 1);
  const campaignStarted = completedIds.size > 0;

  const shatteredPuzzles = SAMPLE_PUZZLES.filter(p => p.mode === 'shattered-realms');
  const twinPuzzles = SAMPLE_PUZZLES.filter(p => p.mode === 'twin-watchers');

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

        <Link
          href="/settings"
          aria-label="Settings"
          className="fixed top-4 right-4 z-40 flex items-center justify-center w-9 h-9 rounded-full bg-parchment border border-ink border-opacity-30 text-ink opacity-70 hover:opacity-100 transition-opacity"
          style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.35)' }}
        >
          <span style={{ fontSize: 16 }}>&#9881;</span>
        </Link>

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

        {/* Three clear choices — Campaign, Daily, Advanced. Everything else
            (region-by-region progress, which puzzle you're on) lives on
            /campaign/map now, not crammed onto this page. */}
        <div className="w-full max-w-2xl flex flex-col gap-8">

          {/* Campaign entry */}
          <section>
            <Link
              href="/campaign"
              className="relative block overflow-hidden rounded-sm"
              style={{ filter: 'drop-shadow(3px 7px 3px rgba(0,0,0,0.6))' }}
            >
              <img
                src={chapterImage}
                alt=""
                draggable={false}
                className="w-full object-cover"
                style={{ height: 160, objectPosition: 'center 30%' }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to bottom, rgba(8,5,2,0.1) 0%, rgba(8,5,2,0.65) 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  padding: '12px 16px',
                }}
              >
                <p className="font-serif text-xs" style={{ color: 'rgba(242,233,216,0.55)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 2 }}>Chapter {chapterRoman}</p>
                <p className="font-lovecraftian text-xl" style={{ color: 'rgba(242,233,216,0.95)', textShadow: '0 1px 8px rgba(0,0,0,0.9)' }}>{currentRegion?.name ?? 'The Foundations'}</p>
                <p className="font-serif text-xs italic" style={{ color: 'rgba(242,233,216,0.6)', marginTop: 2 }}>
                  {allChaptersComplete ? 'Revisit the campaign' : campaignStarted ? 'Continue the campaign' : 'Begin the campaign'}
                </p>
              </div>
            </Link>
          </section>

          {/* Daily Beacon */}
          <section>
            <Link
              href="/daily"
              className="flex items-center justify-between border border-ink bg-parchment hover:bg-parchment-dark transition-colors px-4 py-3 rounded-sm"
            >
              <div>
                <p className="font-serif text-sm font-bold text-ink">Daily Beacon</p>
                <p className="font-serif text-xs text-ink-light mt-0.5 italic">A new challenge every day</p>
              </div>
              <span className="font-serif text-sm text-ink opacity-60">&rarr;</span>
            </Link>
          </section>

          {/* Tutorial nudge — dismissed automatically by visiting /tutorial
              (see its mount effect), or manually via the × here. Either way
              it won't come back unless re-enabled from Settings. */}
          {!settings.tutorialDismissed && (
            <section className="relative">
              <Link
                href="/tutorial"
                className="flex items-center justify-between border border-brass bg-parchment hover:bg-parchment-dark transition-colors px-4 py-3 pr-9 rounded-sm"
              >
                <div>
                  <p className="font-serif text-sm font-bold text-brass">New to the Beacon?</p>
                  <p className="font-serif text-xs text-ink-light mt-0.5">Learn the rules in a guided walkthrough</p>
                </div>
                <span className="font-serif text-sm text-brass opacity-60">&rarr;</span>
              </Link>
              <button
                onClick={() => updateSettings({ tutorialDismissed: true })}
                aria-label="Dismiss"
                className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center font-serif text-xs text-ink-light opacity-50 hover:opacity-90 transition-opacity"
              >
                &#10005;
              </button>
            </section>
          )}

          {/* Advanced Modes — demoted below the core campaign on purpose:
              these are variants for players who already know the base game,
              not a third "start here" competing with Campaign/Daily. Wrapped
              in one solid card (rather than floating text on the backdrop)
              so it stays readable against the busy background art. */}
          {(shatteredPuzzles.length > 0 || twinPuzzles.length > 0) && (
            <section className="bg-parchment border border-ink border-opacity-30 rounded-sm p-4 flex flex-col gap-6">
              <div className="text-center">
                <h2 className="font-lovecraftian text-base text-ink opacity-70">Advanced Modes</h2>
                <p className="font-serif text-xs text-ink-light opacity-70 italic mt-0.5">
                  Variants for those who&rsquo;ve mastered the basics
                </p>
              </div>

              {/* Shattered Realms */}
              {shatteredPuzzles.length > 0 && (() => {
                const sorted = [...shatteredPuzzles].sort((a, b) => a.score - b.score);
                const completedCount = sorted.filter(p => completedIds.has(p.id)).length;
                const current = sorted.find(p => !completedIds.has(p.id)) ?? null;
                const currentIdx = sorted.findIndex(p => !completedIds.has(p.id));
                const allDone = completedCount === sorted.length;
                return (
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-lovecraftian text-base text-ink">
                        Shattered Realms
                        {allDone && <span className="ml-2 text-brass text-sm font-serif">✓</span>}
                      </h3>
                      <span className="font-serif text-xs text-ink-light shrink-0">
                        {completedCount}/{sorted.length}
                      </span>
                    </div>
                    <p className="font-serif text-xs text-ink-light italic mt-0.5">
                      Territories may be scattered — one Watcher per color, wherever it falls
                    </p>
                    {current && (
                      <div className="mt-3">
                        <PuzzleCard puzzle={current} completed={false} />
                        <p className="mt-2 font-serif text-xs text-center text-ink-light">
                          Puzzle {currentIdx + 1} of {sorted.length}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {(shatteredPuzzles.length > 0 && twinPuzzles.length > 0) && (
                <div className="border-t border-ink opacity-10" />
              )}

              {/* Twin Watchers */}
              {twinPuzzles.length > 0 && (() => {
                const sorted = [...twinPuzzles].sort((a, b) => a.score - b.score);
                const completedCount = sorted.filter(p => completedIds.has(p.id)).length;
                const current = sorted.find(p => !completedIds.has(p.id)) ?? null;
                const currentIdx = sorted.findIndex(p => !completedIds.has(p.id));
                const allDone = completedCount === sorted.length;
                return (
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-lovecraftian text-base text-ink">
                        Twin Watchers
                        {allDone && <span className="ml-2 text-brass text-sm font-serif">✓</span>}
                      </h3>
                      <span className="font-serif text-xs text-ink-light shrink-0">
                        {completedCount}/{sorted.length}
                      </span>
                    </div>
                    <p className="font-serif text-xs text-ink-light italic mt-0.5">
                      Two Watchers per row, column, and territory now — neither may touch the other
                    </p>
                    {current && (
                      <div className="mt-3">
                        <PuzzleCard puzzle={current} completed={false} />
                        <p className="mt-2 font-serif text-xs text-center text-ink-light">
                          Puzzle {currentIdx + 1} of {sorted.length}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </section>
          )}

        </div>

        <div className="w-full max-w-2xl mt-16 pb-8" />

      </main>

      <style>{`
        @keyframes banner-drop {
          0%   { opacity: 0; transform: translateY(-100%); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
