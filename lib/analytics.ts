import { Capacitor, registerPlugin } from '@capacitor/core';

interface AnalyticsNativePlugin {
  setup(options: { token: string; host: string }): Promise<void>;
  capture(options: { event: string; propertiesJson: string }): Promise<void>;
}

const Analytics = registerPlugin<AnalyticsNativePlugin>('Analytics');

function native(): boolean {
  return Capacitor.isNativePlatform();
}

let setupStarted = false;

// Native PostHog for iOS -- posthog-js (instrumentation-client.ts) never
// initializes on mobile (NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is only injected
// by Vercel's web build, always empty for a local `npm run build:ios`
// unless .env.local supplies it) and shouldn't, per that file's own comment
// about the ~5.2s cold-launch delay a webview-side init caused. Call once
// at app startup; no-ops on web and when no token is configured.
export function initNativeAnalytics(): void {
  if (!native() || setupStarted) return;
  setupStarted = true;
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) return;
  Analytics.setup({ token, host: 'https://us.i.posthog.com' }).catch(err => {
    console.error('[analytics] native setup failed', err);
  });
}

export function captureNativeEvent(event: string, properties?: Record<string, unknown>): void {
  if (!native()) return;
  Analytics.capture({ event, propertiesJson: JSON.stringify(properties ?? {}) }).catch(err => {
    console.error('[analytics] native capture failed', event, err);
  });
}
