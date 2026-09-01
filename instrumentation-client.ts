import posthog from 'posthog-js';

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
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
