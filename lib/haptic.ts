import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export type HapticType =
  | 'light' | 'medium' | 'error' | 'win-ward' | 'win-slam'
  | 'drag-start' | 'drag-tick' | 'drag-end';

// WKWebView's native bridge hard-caps outgoing messages at ~32/sec and
// silently drops the rest ("Message send exceeds rate-limit threshold"),
// with no error surfaced to the dropped call's promise — it just vanishes
// before reaching native code. Every Capacitor plugin call (Haptics
// included) shares this one ceiling with every other native bridge message
// the page sends, and two call sites can burst well past it:
//  - a fast drag crossing many cells/sec;
//  - the win celebration, which schedules a haptic('win-ward') per ward at
//    a delay of `2000 + distanceFromNearestWatcher * 60ms` — every ward at
//    the same distance shares the exact same delay, so a whole ring of them
//    fires in the same instant, and a bigger puzzle just means a bigger
//    simultaneous ring.
// Throttling to one rapid-haptic call per ~50ms (20/sec) keeps a felt
// rhythm in both cases while leaving headroom under the limit for whatever
// else is in flight.
let lastRapidHapticAt = 0;
const RAPID_HAPTIC_MIN_INTERVAL_MS = 50;

export function haptic(type: HapticType): void {
  if (type === 'drag-tick' || type === 'win-ward') {
    const now = Date.now();
    if (now - lastRapidHapticAt < RAPID_HAPTIC_MIN_INTERVAL_MS) return;
    lastRapidHapticAt = now;
  }
  // iOS Safari/WKWebView has never implemented the Vibration API, so
  // navigator.vibrate is silently a no-op in the native app shell — go
  // through Capacitor's plugin there to reach the real Taptic Engine.
  // Web/PWA installs (no native bridge) keep using navigator.vibrate.
  if (Capacitor.isNativePlatform()) {
    let call: Promise<void>;
    switch (type) {
      case 'light':
      case 'win-ward': // each ward in the win ripple
        call = Haptics.impact({ style: ImpactStyle.Light });
        break;
      case 'medium': // watcher place/remove
        call = Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case 'win-slam': // the watchers' rise-slam landing — one big hit, not per-tile
        call = Haptics.impact({ style: ImpactStyle.Heavy });
        break;
      case 'error': // invalid watcher
        call = Haptics.notification({ type: NotificationType.Error });
        break;
      // A drag paints many cells within milliseconds. UIImpactFeedbackGenerator
      // creates a fresh Taptic Engine session on every single call (see the
      // plugin's Haptics.swift — `let generator = UIImpactFeedbackGenerator(...)`
      // each time), which is unreliable back-to-back: iOS drops most of the
      // rapid-fire hits rather than queuing them. UISelectionFeedbackGenerator
      // is Apple's own answer for exactly this shape of interaction — a
      // warmed-up, reused generator for a rapid sequence of discrete changes
      // within one continuous gesture (their own example is a picker wheel;
      // ours is a drag crossing cells) — so drag ticks get selectionChanged()
      // instead of a fresh impact() per cell.
      case 'drag-start': call = Haptics.selectionStart();   break;
      case 'drag-tick':  call = Haptics.selectionChanged(); break;
      case 'drag-end':   call = Haptics.selectionEnd();     break;
    }
    // Fire-and-forget by design (haptic() is called from hot UI paths with
    // no await), but a silent rejection here is exactly the kind of thing
    // that looks like "haptics just don't work" with zero signal as to why
    // — log it instead of swallowing it.
    call.catch(err => console.error('[haptic] native call failed', type, err));
    return;
  }
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  switch (type) {
    case 'light':      navigator.vibrate(8);            break; // ward place/remove
    case 'medium':     navigator.vibrate(22);           break; // watcher place/remove
    case 'error':      navigator.vibrate([25, 15, 25]); break; // invalid watcher
    case 'win-ward':   navigator.vibrate(12);           break; // each ward in the win ripple
    case 'win-slam':   navigator.vibrate(45);           break; // the watchers' rise-slam landing
    case 'drag-tick':  navigator.vibrate(6);            break; // each cell painted mid-drag
    case 'drag-start':                                  break; // no-op: nothing to warm up on web
    case 'drag-end':                                    break;
  }
}
