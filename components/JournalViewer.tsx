'use client';

import { useRef, useState } from 'react';

// Full-screen viewer for a page of Captain Mercer's journal. These scans are
// dense with small handwriting and technical detail that's illegible at
// thumbnail size, so this isn't a simple image popup — it needs a real way
// to zoom in and read it. Zoom toggles via an explicit button or a
// double-tap on the image; panning is the browser's own native scroll.
// Deliberately not a custom pinch-gesture implementation — a hand-rolled
// pinch handler risks the same class of gesture-conflict bugs this session
// already found in the board's own gesture code, and this is a lore viewer,
// not gameplay, so it doesn't need to feel like a native photo app.
export default function JournalViewer({
  src,
  onClose,
}: {
  src: string;
  onClose: () => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  // Plain click-timestamp double-tap, not a custom pinch/gesture handler —
  // there's only one tappable target here (the whole image), so there's none
  // of the "which cell did this land on" ambiguity that caused real bugs in
  // the board's own double-tap detection (see components/Board.tsx).
  const lastTapRef = useRef(0);

  function handleImageTap() {
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      setZoomed(z => !z);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ zIndex: 500, background: 'rgba(8,5,2,0.97)' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 16px',
          paddingTop: 'calc(env(safe-area-inset-top) + 10px)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setZoomed(z => !z)}
          className="font-serif text-sm transition-opacity hover:opacity-100"
          style={{
            color: 'rgba(242,233,216,0.9)',
            border: '1px solid rgba(242,233,216,0.35)',
            borderRadius: 4,
            padding: '6px 14px',
            opacity: 0.85,
          }}
        >
          {zoomed ? 'Zoom Out' : 'Zoom In'}
        </button>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ color: 'rgba(242,233,216,0.9)', fontSize: 22, lineHeight: 1, padding: 6 }}
        >
          &#10005;
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <img
          src={src}
          alt="A page from Captain Mercer's journal"
          draggable={false}
          onClick={handleImageTap}
          // maxWidth: 'none' overrides Tailwind's global `img { max-width:
          // 100% }` reset, which otherwise silently clamps this straight
          // back down regardless of the width set here.
          style={{ width: zoomed ? '220%' : '100%', maxWidth: 'none', display: 'block' }}
        />
      </div>
    </div>
  );
}
