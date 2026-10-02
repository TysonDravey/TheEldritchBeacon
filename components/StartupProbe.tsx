'use client';

import { useEffect } from 'react';

// Temporary, left in on purpose: marks when React actually hydrates/mounts,
// for the cold-launch black-screen timing investigation. Paired with the
// inline <script> in app/layout.tsx's <head> (marks raw document-parse-start,
// before any JS bundle loads) and SplashScreen.tsx's own asset-preload timing
// — together these show where a slow cold launch is actually spending time:
// before the JS bundle even starts (native/WKWebView-level), during bundle
// parse/hydrate, or during asset loading.
export default function StartupProbe() {
  useEffect(() => {
    const t0 = (window as unknown as { __startupT0?: number }).__startupT0;
    const now = performance.now();
    // eslint-disable-next-line no-console
    console.log(
      `[startup] react-hydrated @ ${now.toFixed(0)}ms` +
      (t0 != null ? ` (+${(now - t0).toFixed(0)}ms since html-parse-start)` : '')
    );
  }, []);
  return null;
}
