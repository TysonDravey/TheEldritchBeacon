'use client';

import { useEffect, useRef, useState } from 'react';
import { markAppReady, markAssetsDecoded } from '@/lib/appReady';

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
  '/boards/sampleBoard_06.jpg',
  '/boards/sampleBoard_07.jpg',
  '/boards/sampleBoard_08.jpg',
  '/boards/sampleBoard_09.jpg',
  '/boards/sampleBoard_10.jpg',
];

const CARD_COUNT = 3;
const SESSION_KEY = 'eb_splash_shown';

const MIN_MS = 1200;

export default function SplashScreen() {
  const [visible,  setVisible]  = useState(true);
  const [fading,   setFading]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [cardIdx,  setCardIdx]  = useState<number | null>(null);
  // Resolved from the real <img>'s onLoad below, not a separate manually-
  // decoded Image() — see the comment on handleCardLoad for why that
  // distinction turned out to matter a lot.
  const cardPaintedResolveRef = useRef<(() => void) | null>(null);
  const cardPaintedRef = useRef<Promise<void> | null>(null);
  const cardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Temporary, left in on purpose: see components/StartupProbe.tsx for why.
    // eslint-disable-next-line no-console
    console.log(`[startup] splash-mount @ ${performance.now().toFixed(0)}ms`);
    if (sessionStorage.getItem(SESSION_KEY)) {
      // eslint-disable-next-line no-console
      console.log(`[startup] splash-skipped(already-shown-this-session) @ ${performance.now().toFixed(0)}ms`);
      setVisible(false);
      return;
    }
    const idx = Math.floor(Math.random() * CARD_COUNT) + 1;
    setCardIdx(idx);
    setVisible(true);

    cardPaintedRef.current = new Promise<void>(resolve => { cardPaintedResolveRef.current = resolve; });
    // Safety net: if the card's onLoad/onError never fires for some reason
    // (a bad build, a 404), the whole splash must not hang on it forever —
    // everything downstream is gated on this one promise.
    cardTimeoutRef.current = setTimeout(() => cardPaintedResolveRef.current?.(), 3000);

    // Driven by a CSS transition (see the bar's style below), not a rAF tick
    // loop — a loop recomputing width every frame stops dead the instant
    // anything (the deferred puzzle-route prefetch in PuzzleCard.tsx, in
    // particular) blocks the main thread for a while, which reads as a
    // frozen bar. A CSS transition is handled on the compositor once
    // triggered, so it keeps animating smoothly regardless of JS being busy.
    // Double rAF forces the 0% state to actually paint first — setting
    // progress straight to 100 in this same tick would just skip the
    // transition instead of animating it.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setProgress(100));
    });

    // Cache-warming for the rest of the game only starts once the card has
    // actually been PAINTED (see handleCardLoad) — a screen recording showed
    // the card's decode resolving early (confirmed via this file's old
    // card-ready log) yet the full-screen art itself still only flashed
    // onto the screen for a single frame right before the fade. Decode
    // finishing isn't the same thing as the browser having had a free moment
    // to actually composite a new frame — under the CPU load of decoding
    // ~30 more images right afterward, it apparently didn't get one until
    // that work let up. Waiting for a real paint first, not just a resolved
    // decode promise, is what actually guarantees the player sees it.
    const loadPromise = cardPaintedRef.current.then(() => Promise.all(
      PRELOAD_ASSETS.map(src => {
        const img = new Image();
        img.src = src;
        return img.decode().catch(() => {});
      })
    ));
    const minDelay = new Promise<void>(res => setTimeout(res, MIN_MS));

    loadPromise.then(() => {
      // eslint-disable-next-line no-console
      console.log(`[startup] splash-assets-decoded @ ${performance.now().toFixed(0)}ms`);
      markAssetsDecoded();
    });

    Promise.all([loadPromise, minDelay]).then(() => {
      // eslint-disable-next-line no-console
      console.log(`[startup] splash-fade-start @ ${performance.now().toFixed(0)}ms`);
      setProgress(100);
      setFading(true);
      setTimeout(() => {
        setVisible(false);
        sessionStorage.setItem(SESSION_KEY, '1');
        markAppReady();
        // eslint-disable-next-line no-console
        console.log(`[startup] splash-done @ ${performance.now().toFixed(0)}ms`);
      }, 700);
    });

    return () => {
      if (cardTimeoutRef.current) clearTimeout(cardTimeoutRef.current);
    };
  }, []);

  function handleCardLoad() {
    if (cardTimeoutRef.current) { clearTimeout(cardTimeoutRef.current); cardTimeoutRef.current = null; }
    // eslint-disable-next-line no-console
    console.log(`[startup] splash-card-loaded @ ${performance.now().toFixed(0)}ms`);
    // Double rAF: the first callback only proves a frame *started*; browsers
    // guarantee an actual composite happened by the time the *second* one
    // runs. This is the standard trick for "wait until the DOM change I just
    // made has really been painted," which a resolved decode() promise does
    // not guarantee under heavy competing main-thread load.
    requestAnimationFrame(() => {
      // eslint-disable-next-line no-console
      console.log(`[startup] splash-card-raf1 @ ${performance.now().toFixed(0)}ms`);
      requestAnimationFrame(() => {
        // eslint-disable-next-line no-console
        console.log(`[startup] splash-card-painted @ ${performance.now().toFixed(0)}ms`);
        cardPaintedResolveRef.current?.();
      });
    });
  }

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
            src={`/titleCards/titleCard_0${cardIdx}_01.jpg`}
            alt="The Eldritch Beacon"
            onLoad={handleCardLoad}
            onError={handleCardLoad}
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
              style={{
                width: `${progress}%`,
                background: 'rgba(181,134,13,0.85)',
                transition: `width ${MIN_MS}ms ease-in-out`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
