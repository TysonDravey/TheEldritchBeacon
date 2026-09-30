import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export function haptic(type: 'light' | 'medium' | 'error' | 'win-ward'): void {
  // iOS Safari/WKWebView has never implemented the Vibration API, so
  // navigator.vibrate is silently a no-op in the native app shell — go
  // through Capacitor's plugin there to reach the real Taptic Engine.
  // Web/PWA installs (no native bridge) keep using navigator.vibrate.
  if (Capacitor.isNativePlatform()) {
    switch (type) {
      case 'light':
      case 'win-ward': // each ward in the win slam
        Haptics.impact({ style: ImpactStyle.Light });
        break;
      case 'medium': // watcher place/remove
        Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case 'error': // invalid watcher
        Haptics.notification({ type: NotificationType.Error });
        break;
    }
    return;
  }
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  switch (type) {
    case 'light':    navigator.vibrate(8);           break; // ward place/remove
    case 'medium':   navigator.vibrate(22);          break; // watcher place/remove
    case 'error':    navigator.vibrate([25, 15, 25]); break; // invalid watcher
    case 'win-ward': navigator.vibrate(12);          break; // each ward in the win slam
  }
}
