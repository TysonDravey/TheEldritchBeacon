'use client';

import { useEffect, useState } from 'react';
import { getLanternTotal, LANTERNS_CHANGED_EVENT } from '@/lib/storage';

// Persistent Lantern total, pinned to whichever top corner is free of
// whatever a given page already puts there — the home page has its Settings
// gear at `fixed top-4 right-4` (so the badge defaults to the left), while
// the puzzle/Daily pages have a Back button in their header's own top-left
// (so they pass corner="right" to avoid covering it). id="lantern-badge" is
// a stable anchor the win-sequence fly animation targets via
// getBoundingClientRect — see PuzzleClient.tsx/app/daily/page.tsx.
export default function LanternBadge({ corner = 'left' }: { corner?: 'left' | 'right' }) {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setTotal(getLanternTotal());
    const onChange = (e: Event) => setTotal((e as CustomEvent<number>).detail);
    window.addEventListener(LANTERNS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(LANTERNS_CHANGED_EVENT, onChange);
  }, []);

  return (
    <div
      id="lantern-badge"
      className={`fixed top-4 ${corner === 'left' ? 'left-4' : 'right-4'} z-40 flex items-center gap-1.5 rounded-full bg-parchment border border-ink border-opacity-30`}
      style={{ padding: '4px 10px 4px 6px', boxShadow: '0 2px 6px rgba(0,0,0,0.35)' }}
    >
      <svg width="16" height="19" viewBox="0 0 20 24" fill="none" aria-hidden="true">
        <path
          d="M10 2c-2.2 2.6-3.6 4.8-3.6 7a3.6 3.6 0 0 0 7.2 0c0-2.2-1.4-4.4-3.6-7Z"
          fill="#B5860D" stroke="#8B1A1A" strokeWidth="1.2"
        />
        <rect x="7.2" y="10" width="5.6" height="9" rx="1" fill="#8B1A1A" stroke="#8B1A1A" strokeWidth="1.2" />
        <rect x="6" y="18.5" width="8" height="2" rx="0.5" fill="#3D2B1F" stroke="#3D2B1F" strokeWidth="1" />
      </svg>
      <span className="font-serif text-sm text-ink" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {total}
      </span>
    </div>
  );
}
