const SESSION_KEY = 'eb_splash_shown';

let resolveReady: (() => void) | null = null;

// Resolves once the splash screen (components/SplashScreen.tsx) has actually
// finished — immediately, if it already ran earlier this session (sessionStorage
// already has the flag) and was skipped on this mount. Non-essential setup that
// doesn't need to happen before the player can see anything (Web Audio/
// AudioContext init among it — see the callers) should wait on this instead of
// firing at module load, so it can't compete with the splash's own critical
// rendering path.
export const appReady: Promise<void> =
  typeof window === 'undefined'
    ? new Promise<void>(() => {}) // SSR: nothing here ever runs server-side anyway
    : sessionStorage.getItem(SESSION_KEY)
      ? Promise.resolve()
      : new Promise<void>(resolve => { resolveReady = resolve; });

export function markAppReady(): void {
  resolveReady?.();
  resolveReady = null;
}

let resolveAssetsDecoded: (() => void) | null = null;

// Resolves earlier than appReady — once the splash's own PRELOAD_ASSETS
// decode finishes, rather than once the whole splash sequence (its
// deliberate minimum display time, then fade) has finished. The player is
// captive behind the splash either way for that stretch, so it's otherwise
// dead time worth spending on background work (see PuzzleCard.tsx) instead
// of leaving it idle until appReady resolves.
//
// Deliberately NOT gated on splash-card-painted instead, despite that firing
// earlier still: on-device testing found starting a second, unrelated
// native resource fetch (PuzzleCard's route prefetch) at that exact moment
// contends with the decode() calls PRELOAD_ASSETS kicks off at the same
// instant, stretching both out to several real seconds and apparently
// freezing the whole WebView's rendering while they fight over Capacitor's
// resource-serving layer — not just JS, since even a CSS-driven progress bar
// stopped animating through it. Waiting for the decode to finish first keeps
// that fetch from ever overlapping it.
export const splashAssetsDecoded: Promise<void> =
  typeof window === 'undefined'
    ? new Promise<void>(() => {})
    : sessionStorage.getItem(SESSION_KEY)
      ? Promise.resolve()
      : new Promise<void>(resolve => { resolveAssetsDecoded = resolve; });

export function markAssetsDecoded(): void {
  resolveAssetsDecoded?.();
  resolveAssetsDecoded = null;
}
