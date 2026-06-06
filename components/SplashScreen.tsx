'use client';

import { useEffect, useRef, useState } from 'react';

const PRELOAD_ASSETS = [
  ...Array.from({ length: 10 }, (_, i) =>
    `/tiles/processed/plain_tile_${String(i + 1).padStart(2, '0')}.png`
  ),
  '/tiles/watchers/watcher_red_02.png',
  '/tiles/watchers/watcher_ochre_01.png',
  '/tiles/watchers/watcher_seagreen_01.png',
  '/tiles/watchers/watcher_bone_01.png',
  '/tiles/watchers/watcher_storm_01.png',
  '/tiles/watchers/watcher_indigo_01.png',
  '/tiles/watchers/watcher_emerald_01.png',
  '/tiles/watchers/watcher_violet_01.png',
  '/tiles/watchers/watcher_copper_01.png',
  '/tiles/watchers/watcher_rose_01.png',
  '/tiles/wards/genericward_01.png',
  '/scrolls/scroll_01.png',
  '/scrolls/scroll_02.png',
  '/scrolls/scroll_03.png',
  '/boards/sampleBoard_06.png',
  '/boards/sampleBoard_07.png',
  '/boards/sampleBoard_08.png',
  '/boards/sampleBoard_09.png',
  '/boards/sampleBoard_10.png',
];

const CARD_COUNT = 3;
const SESSION_KEY = 'eb_splash_shown';

const MIN_MS = 5000;

// Ease-in-out curve: slow start, fast middle, slow end.
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export default function SplashScreen() {
  const [visible,  setVisible]  = useState(true);
  const [fading,   setFading]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [cardIdx,  setCardIdx]  = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) {
      setVisible(false);
      return;
    }
    const idx = Math.floor(Math.random() * CARD_COUNT) + 1;
    setCardIdx(idx);
    setVisible(true);

    // Animate progress bar smoothly over MIN_MS regardless of real load speed.
    const startTime = performance.now();
    function tick() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / MIN_MS, 1);
      setProgress(Math.round(easeInOut(t) * 100));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);

    // Fire real loads for cache warming, but ignore their timing for the bar.
    const cardSrc = `/titleCards/titleCard_0${idx}_01.png`;
    const loadPromise = Promise.all(
      [cardSrc, ...PRELOAD_ASSETS].map(src => {
        const img = new Image();
        img.src = src;
        return img.decode().catch(() => {});
      })
    );
    const minDelay = new Promise<void>(res => setTimeout(res, MIN_MS));

    Promise.all([loadPromise, minDelay]).then(() => {
      setProgress(100);
      setFading(true);
      setTimeout(() => {
        setVisible(false);
        sessionStorage.setItem(SESSION_KEY, '1');
      }, 700);
    });

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  if (!visible) return null;

  // fading = opacity 0 but still in DOM during fade-out transition
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black"
      style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.7s ease' }}
    >
      <div className="relative flex items-center justify-center" style={{ width: '100%', height: '100%' }}>
        {cardIdx !== null && (
          <img
            src={`/titleCards/titleCard_0${cardIdx}_01.png`}
            alt="The Eldritch Beacon"
            style={{
              maxHeight: '100vh',
              maxWidth: '100vw',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        )}
        {/* Loading bar — overlaid near the bottom of the card */}
        <div
          className="absolute"
          style={{ bottom: '10%', left: '50%', transform: 'translateX(-50%)', width: '38%' }}
        >
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: 'rgba(242,233,216,0.18)' }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${progress}%`, background: 'rgba(181,134,13,0.85)' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
