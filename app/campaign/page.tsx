'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SAMPLE_PUZZLES } from '@/data/samplePuzzles';
import { REGIONS } from '@/data/regions';
import { scorePuzzle } from '@/engine/difficulty';

const COMPLETED_KEY    = 'eldritch_beacon_completed';
const NOTE_SEEN_KEY    = 'eldritch_beacon_keeper_note_seen';

function loadCompletedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(COMPLETED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function findNextPuzzle(completedIds: Set<string>): string {
  for (const region of REGIONS) {
    const puzzles = SAMPLE_PUZZLES
      .filter(p => p.difficulty === region.difficulty && p.mode === 'initiate')
      .sort((a, b) => scorePuzzle(a) - scorePuzzle(b));
    const next = puzzles.find(p => !completedIds.has(p.id));
    if (next) return next.id;
  }
  return SAMPLE_PUZZLES[SAMPLE_PUZZLES.length - 1].id;
}

type View = 'intro' | 'note';

export default function CampaignPage() {
  const router = useRouter();
  const [view,    setView]    = useState<View>('intro');
  const [started, setStarted] = useState(false);
  const [nextId,  setNextId]  = useState<string | null>(null);
  const [ready,   setReady]   = useState(false);

  useEffect(() => {
    const completed  = loadCompletedIds();
    const noteSeen   = !!localStorage.getItem(NOTE_SEEN_KEY);
    setStarted(completed.size > 0 || noteSeen);
    setNextId(findNextPuzzle(completed));
    setReady(true);
  }, []);

  function handleBeginClick() {
    const noteSeen = !!localStorage.getItem(NOTE_SEEN_KEY);
    if (noteSeen) {
      if (nextId) router.push(`/puzzle/${nextId}`);
    } else {
      setView('note');
    }
  }

  function handleUnderstood() {
    try { localStorage.setItem(NOTE_SEEN_KEY, '1'); } catch { /* ignore */ }
    if (nextId) router.push(`/puzzle/${nextId}`);
  }

  // ── Keeper's note ──────────────────────────────────────────────────────────
  if (view === 'note') {
    return (
      <main
        style={{
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a1209',
          padding: '0 24px',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div
          style={{
            background: 'rgba(242,233,216,0.97)',
            border: '1px solid rgba(26,18,9,0.2)',
            borderRadius: 6,
            padding: '32px 28px',
            maxWidth: 400,
            width: '100%',
            boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
          }}
        >
          {/* Source label */}
          <p
            className="font-serif text-center"
            style={{
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(26,18,9,0.4)',
              marginBottom: 20,
            }}
          >
            Keeper's Log — Final Entry
          </p>

          {/* Note text */}
          <div
            className="font-journal"
            style={{ fontSize: 19, lineHeight: 1.7, color: 'rgba(26,18,9,0.85)' }}
          >
            <p style={{ marginBottom: 16 }}>
              The charts in this room show the Beacon's territories — each marked by colour, each requiring a single Watcher to hold its post.
            </p>
            <p style={{ marginBottom: 16 }}>
              The rules are fixed: one Watcher per territory. One per row. One per column. None may stand adjacent to another — not even at the corners.
            </p>
            <p style={{ marginBottom: 16 }}>
              When you find a cell where no Watcher can stand, mark it with a Ward. A Ward is not a failure. It is how the chart speaks.
            </p>
            <p style={{ marginBottom: 16 }}>
              Restore every Watcher to their rightful position and the Beacon holds.
            </p>
            <p style={{ fontStyle: 'italic', opacity: 0.6 }}>
              I do not know how long I have been here. I do not know what happens if the chart goes unfinished. I have decided not to find out.
            </p>
          </div>

          {/* Divider */}
          <div style={{ width: 40, height: 1, background: 'rgba(26,18,9,0.2)', margin: '24px auto' }} />

          {/* CTA */}
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={handleUnderstood}
              className="font-serif text-sm text-ink hover:opacity-70 transition-opacity"
              style={{
                border: '1px solid rgba(26,18,9,0.3)',
                borderRadius: 4,
                padding: '8px 28px',
                background: 'transparent',
              }}
            >
              Restore the Chart
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Intro ──────────────────────────────────────────────────────────────────
  return (
    <main
      style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        background: '#0a0705',
      }}
    >
      <img
        src="/titleCards/campaign_01/intro_01.png"
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center top',
          opacity: ready ? 1 : 0,
          transition: 'opacity 0.8s ease',
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(8,5,2,0.2) 0%, rgba(8,5,2,0.1) 40%, rgba(8,5,2,0.65) 70%, rgba(8,5,2,0.92) 100%)',
        }}
      />

      {/* Back */}
      <div style={{ position: 'absolute', top: 'max(16px, env(safe-area-inset-top))', left: 16, zIndex: 10 }}>
        <button
          onClick={() => router.push('/')}
          className="transition-all duration-100 hover:brightness-110 active:scale-95"
        >
          <img
            src="/buttons/left_button_01.png"
            alt="Back"
            draggable={false}
            style={{ height: 40, display: 'block', filter: 'drop-shadow(2px 4px 2px rgba(0,0,0,0.8))' }}
          />
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '0 28px',
          paddingBottom: 'max(40px, env(safe-area-inset-bottom))',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          opacity: ready ? 1 : 0,
          transition: 'opacity 0.8s ease 0.2s',
        }}
      >
        <p
          className="font-serif"
          style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(242,233,216,0.5)' }}
        >
          Chapter I
        </p>

        <h1
          className="font-lovecraftian text-center"
          style={{ fontSize: 32, color: 'rgba(242,233,216,0.95)', textShadow: '0 2px 20px rgba(0,0,0,0.9)', lineHeight: 1.2, marginTop: -8 }}
        >
          The Foundations
        </h1>

        <p
          className="font-journal text-center"
          style={{ fontSize: 18, color: 'rgba(242,233,216,0.75)', textShadow: '0 1px 8px rgba(0,0,0,0.9)', lineHeight: 1.6, maxWidth: 300 }}
        >
          {started
            ? 'The chart still holds. The work is not yet finished.'
            : 'The crossing took three days longer than the charts allowed. When the lighthouse finally appeared through the fog, I told myself it was the weather that had disoriented me.'}
        </p>

        <button
          onClick={handleBeginClick}
          className="transition-all duration-100 hover:brightness-110 active:scale-95 relative"
          style={{ filter: 'drop-shadow(3px 7px 3px rgba(0,0,0,0.75))' }}
        >
          <img
            src="/buttons/left_button_01.png"
            alt={started ? 'Continue' : 'Begin'}
            draggable={false}
            style={{ height: 64, display: 'block', transform: 'scaleX(-1)' }}
          />
          <span
            className="absolute inset-0 flex items-center justify-center font-serif text-sm font-bold"
            style={{ color: 'rgba(242,233,210,0.95)', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
          >
            {started ? 'Continue' : 'Begin'}
          </span>
        </button>
      </div>
    </main>
  );
}
