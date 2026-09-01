import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tysondravey.eldritchbeacon',
  appName: 'The Eldritch Beacon',
  webDir: 'out',
  ios: {
    // Default ('automatic') lets content render under the status bar/notch
    // on scroll despite the app's own env(safe-area-inset-top) CSS padding
    // — a known Capacitor/WKWebView quirk. 'always' makes the native layer
    // respect the safe area itself instead.
    contentInset: 'always',
  },
};

export default config;
