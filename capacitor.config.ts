import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tysondravey.eldritchbeacon',
  appName: 'The Eldritch Beacon',
  webDir: 'out',
  // Capacitor dismisses the native LaunchScreen as soon as the WKWebView is
  // inserted into the view hierarchy — not once it's actually painted
  // anything. On-device tracing found a ~5s native WKWebView warm-up
  // (requestAnimationFrame itself didn't fire for that long, tied to native
  // GPU/WebContent/Networking process launches visible in the device log,
  // not anything in this app's own JS) sitting in exactly that gap, during
  // which the WKWebView's own background shows through. Matching it to
  // SplashScreen.tsx's own bg-black wrapper (not the parchment used
  // elsewhere) means that native warm-up reads as a continuation of the
  // splash screen that's about to render, rather than introducing a second,
  // different-colored flash of its own right as React mounts.
  backgroundColor: '#000000',
  ios: {
    // Default ('automatic') lets content render under the status bar/notch
    // on scroll despite the app's own env(safe-area-inset-top) CSS padding
    // — a known Capacitor/WKWebView quirk. 'always' makes the native layer
    // respect the safe area itself instead.
    contentInset: 'always',
    backgroundColor: '#000000',
  },
};

export default config;
