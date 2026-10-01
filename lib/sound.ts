import { loadSettings } from './settings';

// One-shot sound effects, keyed by game moment. Finer-grained than
// haptic.ts's HapticType in a couple of places (place vs. remove) because a
// sound can carry that distinction in a way a single impact style can't.
export type SoundType =
  | 'ward' | 'ward-remove'
  | 'watcher' | 'watcher-remove'
  | 'error'
  | 'win-ward'
  | 'win-slam'
  | 'complete'
  | 'hint'
  | 'region-reveal';

// Each moment has a small pool of variants at public/sounds/<type>/1.mp3,
// 2.mp3, ... — playSound() picks one at random per call so a sound heard
// dozens of times a session (Ward placement especially) doesn't wear out its
// welcome. Counts come from however many takes actually got generated per
// moment; update here if more/fewer are added to public/sounds/<type>/.
const SOUND_VARIANT_COUNTS: Record<SoundType, number> = {
  'ward':            4,
  'ward-remove':     4,
  'watcher':         4,
  'watcher-remove':  5,
  'error':           4,
  'win-ward':        4,
  'win-slam':        6,
  'complete':        4,
  'hint':            5,
  'region-reveal':   4,
};

// Until public/sounds/<type>/1.mp3 actually exists, Audio's own fetch 404s
// and playSound() swallows the rejection — every call site can call this
// unconditionally, the same way they already call haptic(), without needing
// to guard on "do we have audio yet."
function randomVariantPath(type: SoundType): string {
  const count = SOUND_VARIANT_COUNTS[type];
  const n = 1 + Math.floor(Math.random() * count);
  return `/sounds/${type}/${n}.mp3`;
}

// Shares the drag-tick lesson from haptic.ts: the win ripple schedules one
// of these per ward, and wards at the same distance from the nearest Watcher
// share the same delay, so a bunch can land in the same instant. A dozen
// identical dings firing together reads as noise, not a ripple — throttle to
// one every ~70ms so it stays a rhythm instead of a wall of sound.
let lastRipplePlayAt = 0;
const RIPPLE_MIN_INTERVAL_MS = 70;

export function playSound(type: SoundType): void {
  if (!loadSettings().sfxEnabled) return;
  if (type === 'win-ward') {
    const now = Date.now();
    if (now - lastRipplePlayAt < RIPPLE_MIN_INTERVAL_MS) return;
    lastRipplePlayAt = now;
  }
  try {
    const audio = new Audio(randomVariantPath(type));
    audio.play().catch(() => { /* no file yet, or autoplay blocked — silent */ });
  } catch { /* ignore */ }
}
