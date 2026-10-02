import posthog from 'posthog-js';

// NEXT_PUBLIC_* env vars are baked in at build time — Vercel injects this one
// for the web build, but `npm run build:ios` is a local build with no such
// injection, so it's always empty there. Calling init() anyway (with `!`
// previously asserting it away) meant the mobile app unconditionally tried to
// talk to PostHog directly over the network (no server to proxy through,
// unlike web) with an invalid token on every single cold launch, every
// session, with capture_exceptions actively instrumenting for it — on-device
// testing traced a suspiciously consistent ~5.2s startup delay to this: far
// more plausibly an SDK/network timeout from a request that can never
// succeed than any coincidence, especially since it stayed identical across
// multiple rounds of fixes that were nowhere near this code path.
const POSTHOG_TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
if (POSTHOG_TOKEN) {
  posthog.init(POSTHOG_TOKEN, {
    // The web build proxies through /ingest (see next.config.ts rewrites) so
    // ad blockers are less likely to catch it. The iOS app has no server to
    // proxy through, so it talks to PostHog directly.
    api_host: process.env.NEXT_PUBLIC_MOBILE_BUILD ? 'https://us.i.posthog.com' : '/ingest',
    ui_host: 'https://us.posthog.com',
    defaults: '2026-01-30',
    capture_exceptions: true,
    debug: false,
    disable_session_recording: true,
    autocapture: false,
    capture_heatmaps: false,
    capture_pageview: false,
  });
}
