'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SAMPLE_PUZZLES } from '@/data/samplePuzzles';
import { REGIONS, getRegionPuzzles, sortPuzzlesForRegion, type CampaignRegion } from '@/data/regions';
import type { Puzzle, Difficulty } from '@/engine/boardTypes';
import PuzzleCard from '@/components/PuzzleCard';
import JournalViewer from '@/components/JournalViewer';

const STORAGE_KEY_PREFIX = 'eldritch_beacon_state_';

type RegionStatus = 'completed' | 'current' | 'locked';

// A locked-looking preview of Captain Mercer's journal page for this region —
// cropped rather than letterboxed at this size (these are dense, landscape
// scans; a small, legible letterboxed preview isn't really possible), tap to
// open the full page in JournalViewer. Hidden for locked regions to avoid
// spoiling what's ahead.
function JournalPreview({ src, onOpen }: { src: string; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="mt-3 w-full rounded-sm overflow-hidden border border-ink border-opacity-20 relative block"
      style={{ height: 64 }}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to right, rgba(8,5,2,0.1) 40%, rgba(8,5,2,0.6) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 12px',
        }}
      >
        <span className="font-serif text-xs italic" style={{ color: 'rgba(242,233,216,0.95)' }}>
          Mercer&rsquo;s Journal &rarr;
        </span>
      </div>
    </button>
  );
}

function RegionNode({
  region,
  puzzles,
  completedIds,
  status,
  isLast,
  onOpenJournal,
}: {
  region: CampaignRegion;
  puzzles: Puzzle[];
  completedIds: Set<string>;
  status: RegionStatus;
  isLast: boolean;
  onOpenJournal: (src: string) => void;
}) {
  const sorted = sortPuzzlesForRegion(puzzles, region.mode ?? 'initiate');
  const completedCount = sorted.filter(p => completedIds.has(p.id)).length;
  const currentPuzzle = sorted.find(p => !completedIds.has(p.id)) ?? null;
  const currentIdx = sorted.findIndex(p => !completedIds.has(p.id));

  return (
    <div className="flex gap-4">
      {/* Node + connecting line — a placeholder for the real winding map */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className="rounded-full flex items-center justify-center"
          style={{
            width: status === 'current' ? 56 : 44,
            height: status === 'current' ? 56 : 44,
            background: status === 'locked' ? 'rgba(26,18,9,0.15)' : 'var(--parchment, #f2e9d8)',
            border: `2px solid ${status === 'current' ? 'var(--brass, #b5860d)' : 'rgba(26,18,9,0.3)'}`,
            boxShadow: status === 'current' ? '0 0 0 4px rgba(181,134,13,0.2)' : undefined,
          }}
        >
          {status === 'locked' ? (
            <span style={{ fontSize: 16, opacity: 0.4 }}>&#128274;</span>
          ) : (
            <img
              src={region.ward}
              alt=""
              style={{
                width: status === 'current' ? 32 : 24,
                height: status === 'current' ? 32 : 24,
                objectFit: 'contain',
                opacity: status === 'completed' ? 0.5 : 1,
              }}
            />
          )}
        </div>
        {!isLast && <div className="flex-1 w-px my-1" style={{ background: 'rgba(26,18,9,0.25)', minHeight: 24 }} />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-8">
        {status === 'locked' ? (
          <div className="bg-parchment border border-ink border-opacity-20 rounded-sm px-4 py-3 opacity-60">
            <h3 className="font-lovecraftian text-base text-ink">{region.name}</h3>
            <p className="font-serif text-xs text-ink-light italic mt-0.5">Sealed until the previous chart is restored</p>
          </div>
        ) : status === 'completed' ? (
          <div className="bg-parchment border border-ink border-opacity-20 rounded-sm px-4 py-3 opacity-80">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-lovecraftian text-base text-ink">
                {region.name} <span className="text-brass">&#10003;</span>
              </h3>
              <span className="font-serif text-xs text-ink-light">{completedCount}/{sorted.length}</span>
            </div>
            <JournalPreview src={region.journalPage} onOpen={() => onOpenJournal(region.journalPage)} />
          </div>
        ) : (
          <div className="bg-parchment border border-ink border-opacity-30 rounded-sm p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-lovecraftian text-lg text-ink">{region.name}</h3>
              <span className="font-serif text-xs text-ink-light">{completedCount}/{sorted.length}</span>
            </div>
            <p className="font-serif text-xs text-ink-light italic mt-0.5">{region.description}</p>
            <p className="font-serif text-xs text-ink-light opacity-60 mt-1">{region.techniques.join(' · ')}</p>
            <JournalPreview src={region.journalPage} onOpen={() => onOpenJournal(region.journalPage)} />
            {currentPuzzle && (
              <div className="mt-3">
                <PuzzleCard puzzle={currentPuzzle} completed={false} />
                <p className="mt-2 font-serif text-xs text-center text-ink-light">
                  Puzzle {currentIdx + 1} of {sorted.length}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CampaignMapPage() {
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const [openJournalSrc, setOpenJournalSrc] = useState<string | null>(null);

  useEffect(() => {
    const ids = new Set<string>();
    for (const puzzle of SAMPLE_PUZZLES) {
      try {
        const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${puzzle.id}`);
        if (raw && JSON.parse(raw)?.completed) ids.add(puzzle.id);
      } catch { /* ignore */ }
    }
    setCompletedIds(ids);
    setReady(true);
  }, []);

  const puzzlesByRegion = new Map<Difficulty, Puzzle[]>(REGIONS.map(r => [r.difficulty, getRegionPuzzles(r)]));
  const regionsWithPuzzles = REGIONS.filter(r => (puzzlesByRegion.get(r.difficulty) ?? []).length > 0);

  let prevComplete = true;
  const statuses: RegionStatus[] = regionsWithPuzzles.map(region => {
    const puzzles = puzzlesByRegion.get(region.difficulty) ?? [];
    const allDone = puzzles.every(p => completedIds.has(p.id));
    let status: RegionStatus;
    if (!prevComplete) status = 'locked';
    else if (allDone) status = 'completed';
    else status = 'current';
    prevComplete = prevComplete && allDone;
    return status;
  });

  if (!ready) return null;

  const campaignComplete = statuses.length > 0 && statuses[statuses.length - 1] === 'completed';

  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-12">
      <div className="w-full max-w-lg flex flex-col gap-8">
        <div className="flex items-center gap-3 bg-parchment border border-ink border-opacity-30 rounded-sm px-4 py-3">
          <Link href="/" className="transition-all duration-100 hover:brightness-110 active:scale-95 shrink-0">
            <img
              src="/buttons/left_button_01.png"
              alt="Back"
              draggable={false}
              style={{ height: 40, display: 'block', filter: 'drop-shadow(2px 4px 2px rgba(0,0,0,0.6))' }}
            />
          </Link>
          <h1 className="font-lovecraftian text-2xl text-ink">Campaign</h1>
        </div>

        <div className="flex flex-col">
          {regionsWithPuzzles.map((region, i) => (
            <RegionNode
              key={region.difficulty}
              region={region}
              puzzles={puzzlesByRegion.get(region.difficulty) ?? []}
              completedIds={completedIds}
              status={statuses[i]}
              isLast={i === regionsWithPuzzles.length - 1}
              onOpenJournal={setOpenJournalSrc}
            />
          ))}
        </div>

        {campaignComplete && (
          <div className="bg-parchment border border-brass rounded-sm p-4 text-center flex flex-col gap-3">
            <p className="font-lovecraftian text-lg text-ink">The Beacon holds steady</p>
            <p className="font-serif text-sm text-ink-light italic">
              Your charts of these waters are complete. Stranger puzzles await.
            </p>
            <div className="flex flex-col gap-2 mt-1">
              <Link
                href="/"
                className="font-serif text-sm border border-ink px-4 py-2 rounded-sm bg-parchment hover:bg-parchment-dark transition-colors"
              >
                Try Shattered Realms &rarr;
              </Link>
              <Link
                href="/"
                className="font-serif text-sm border border-ink px-4 py-2 rounded-sm bg-parchment hover:bg-parchment-dark transition-colors"
              >
                Try Twin Watchers &rarr;
              </Link>
            </div>
          </div>
        )}
      </div>

      {openJournalSrc && (
        <JournalViewer src={openJournalSrc} onClose={() => setOpenJournalSrc(null)} />
      )}
    </main>
  );
}
