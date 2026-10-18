import posthog from 'posthog-js';
import { captureNativeEvent } from '@/lib/analytics';

// Single call site for both the web path (posthog-js -- already a no-op on
// mobile, since instrumentation-client.ts never calls posthog.init() there)
// and the native path (captureNativeEvent -- already a no-op on web, via
// its own isNativePlatform() guard), so every event only needs firing once.
export function track(event: string, properties?: Record<string, unknown>): void {
  posthog.capture(event, properties);
  captureNativeEvent(event, properties);
}
