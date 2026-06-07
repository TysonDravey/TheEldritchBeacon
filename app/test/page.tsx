'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SAMPLE_PUZZLES } from '@/data/samplePuzzles';
import { scorePuzzle } from '@/engine/difficulty';
import type { Difficulty } from '@/engine/boardTypes';

type Rating = 1 | 2 | 3;
type RatingMap = Record<string, Rating>;

const STORAGE_KEY = 'eb-test-ratings';

const DIFFICULTIES: Difficulty[] = ['Initiate', 'Scholar', 'Occultist', 'High Priest', 'Eldritch', 'Harbinger', 'Archon', 'Unbound'];

function loadRatings(): RatingMap {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveRatings(ratings: RatingMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings));
}

function Stars({ puzzleId, rating, onRate }: { puzzleId: string; rating: Rating | undefined; onRate: (id: string, r: Rating | 0) => void }) {
  return (
    <span className="flex gap-0.5">
      {([1, 2, 3] as Rating[]).map(n => (
        <button
          key={n}
          onClick={() => onRate(puzzleId, n === rating ? 0 : n)}
          title={n === rating ? 'Clear rating' : `${n} star${n > 1 ? 's' : ''}`}
          style={{
            fontSize: '1.1rem',
            lineHeight: 1,
            color: n <= (rating ?? 0) ? '#B5860D' : 'rgba(26,18,9,0.25)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0 1px',
            transition: 'color 0.1s',
          }}
        >
          ★
        </button>
      ))}
    </span>
  );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 10px',
        borderRadius: 12,
        border: '1px solid',
        borderColor: active ? '#8B1A1A' : 'rgba(26,18,9,0.25)',
        background: active ? '#8B1A1A' : 'transparent',
        color: active ? '#F2E9D8' : 'var(--ink)',
        fontFamily: 'Georgia, serif',
        fontSize: '0.78rem',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

const ALL_SIZES = [...new Set(SAMPLE_PUZZLES.map(p => p.size))].sort((a, b) => a - b);
const ALL_DIFFS = DIFFICULTIES.filter(d => SAMPLE_PUZZLES.some(p => p.difficulty === d));

export default function TestPage() {
  const [ratings, setRatings] = useState<RatingMap>({});
  const [sizeFilter, setSizeFilter] = useState<number | null>(null);
  const [diffFilter, setDiffFilter] = useState<Difficulty | null>(null);
  const [starFilter, setStarFilter] = useState<Rating | 'unrated' | null>(null);

  useEffect(() => {
    setRatings(loadRatings());
  }, []);

  function handleRate(id: string, r: Rating | 0) {
    const next = { ...ratings };
    if (r === 0) delete next[id];
    else next[id] = r;
    setRatings(next);
    saveRatings(next);
  }

  const puzzles = [...SAMPLE_PUZZLES]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .filter(p => sizeFilter === null || p.size === sizeFilter)
    .filter(p => diffFilter === null || p.difficulty === diffFilter)
    .filter(p => {
      if (starFilter === null) return true;
      if (starFilter === 'unrated') return ratings[p.id] === undefined;
      return ratings[p.id] === starFilter;
    });

  const ratedCount = SAMPLE_PUZZLES.filter(p => ratings[p.id] !== undefined).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--parchment)', padding: '32px 24px', fontFamily: 'Georgia, serif', color: 'var(--ink)' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: "'Lovecraftimus', serif", fontSize: '1.8rem', marginBottom: 4 }}>
            Puzzle Review
          </h1>
          <p style={{ fontSize: '0.85rem', opacity: 0.6, margin: 0 }}>
            {SAMPLE_PUZZLES.length} puzzles total · {ratedCount} rated · showing {puzzles.length} · newest first
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {/* Size */}
          <FilterPill label="All sizes" active={sizeFilter === null} onClick={() => setSizeFilter(null)} />
          {ALL_SIZES.map(s => (
            <FilterPill key={s} label={`${s}×${s}`} active={sizeFilter === s} onClick={() => setSizeFilter(sizeFilter === s ? null : s)} />
          ))}

          <div style={{ width: 1, background: 'rgba(26,18,9,0.2)', margin: '0 4px' }} />

          {/* Difficulty */}
          <FilterPill label="All difficulties" active={diffFilter === null} onClick={() => setDiffFilter(null)} />
          {ALL_DIFFS.map(d => (
            <FilterPill key={d} label={d} active={diffFilter === d} onClick={() => setDiffFilter(diffFilter === d ? null : d)} />
          ))}

          <div style={{ width: 1, background: 'rgba(26,18,9,0.2)', margin: '0 4px' }} />

          {/* Stars */}
          <FilterPill label="All ratings" active={starFilter === null} onClick={() => setStarFilter(null)} />
          <FilterPill label="★★★" active={starFilter === 3} onClick={() => setStarFilter(starFilter === 3 ? null : 3)} />
          <FilterPill label="★★" active={starFilter === 2} onClick={() => setStarFilter(starFilter === 2 ? null : 2)} />
          <FilterPill label="★" active={starFilter === 1} onClick={() => setStarFilter(starFilter === 1 ? null : 1)} />
          <FilterPill label="Unrated" active={starFilter === 'unrated'} onClick={() => setStarFilter(starFilter === 'unrated' ? null : 'unrated')} />
        </div>

        {/* Table */}
        <div style={{ border: '1px solid rgba(26,18,9,0.2)', borderRadius: 6, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'rgba(26,18,9,0.06)', borderBottom: '1px solid rgba(26,18,9,0.15)' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Title</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, whiteSpace: 'nowrap' }}>Size</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Difficulty</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Rating</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Play</th>
              </tr>
            </thead>
            <tbody>
              {puzzles.map((p, i) => (
                <tr
                  key={p.id}
                  style={{
                    borderBottom: '1px solid rgba(26,18,9,0.08)',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(26,18,9,0.025)',
                  }}
                >
                  <td style={{ padding: '7px 12px' }}>
                    <span style={{ fontWeight: 500 }}>{p.title}</span>
                    <span style={{ marginLeft: 8, fontSize: '0.75rem', opacity: 0.45 }}>{p.id}</span>
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'center' }}>{p.size}×{p.size}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 7px',
                      borderRadius: 10,
                      fontSize: '0.75rem',
                      background: diffColor(p.difficulty).bg,
                      color: diffColor(p.difficulty).text,
                    }}>
                      {p.difficulty}
                    </span>
                    <span style={{ marginLeft: 6, fontSize: '0.72rem', opacity: 0.5 }}>
                      ◆{scorePuzzle(p)}
                    </span>
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                    <Stars puzzleId={p.id} rating={ratings[p.id]} onRate={handleRate} />
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                    <Link
                      href={`/puzzle/${p.id}`}
                      style={{
                        padding: '3px 10px',
                        borderRadius: 4,
                        background: '#8B1A1A',
                        color: '#F2E9D8',
                        textDecoration: 'none',
                        fontSize: '0.78rem',
                        fontFamily: 'Georgia, serif',
                      }}
                    >
                      Play
                    </Link>
                  </td>
                </tr>
              ))}
              {puzzles.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', opacity: 0.5 }}>
                    No puzzles match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}

function diffColor(d: Difficulty): { bg: string; text: string } {
  switch (d) {
    case 'Initiate':    return { bg: 'rgba(107,158,142,0.25)', text: '#2E5E38' };
    case 'Scholar':     return { bg: 'rgba(107,158,142,0.25)', text: '#2E5E38' };
    case 'Occultist':   return { bg: 'rgba(181,134,13,0.2)',   text: '#7A6030' };
    case 'High Priest': return { bg: 'rgba(181,134,13,0.2)',   text: '#7A6030' };
    case 'Eldritch':    return { bg: 'rgba(139,26,26,0.15)',   text: '#8B1A1A' };
    case 'Harbinger':   return { bg: 'rgba(139,26,26,0.25)',   text: '#8B1A1A' };
    case 'Archon':      return { bg: 'rgba(26,18,9,0.15)',     text: '#1A1209'  };
    case 'Unbound':     return { bg: 'rgba(26,18,9,0.22)',     text: '#1A1209'  };
    default:            return { bg: 'rgba(26,18,9,0.08)',     text: 'var(--ink)' };
  }
}
