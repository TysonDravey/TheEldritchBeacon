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
  | 'region-reveal'
  | 'drag-tick';

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
  'drag-tick':       4, // no dedicated pool — reuses ward's, see POOL_FOR
};

// drag-tick has no sound of its own (a drag always paints wards, same as a
// tap would) — it reuses the ward pool rather than needing a duplicate set
// of near-identical files, just played quieter (see VOLUME_SCALE) and
// throttled (see RAPID_MIN_INTERVAL_MS) since one can fire per cell crossed.
const POOL_FOR: Partial<Record<SoundType, SoundType>> = {
  'drag-tick': 'ward',
};

const VOLUME_SCALE: Partial<Record<SoundType, number>> = {
  'drag-tick': 0.4,
};

// Until public/sounds/<type>/1.mp3 actually exists, Audio's own fetch 404s
// and playSound() swallows the rejection — every call site can call this
// unconditionally, the same way they already call haptic(), without needing
// to guard on "do we have audio yet."
function randomVariantPath(type: SoundType): string {
  const pool = POOL_FOR[type] ?? type;
  const count = SOUND_VARIANT_COUNTS[pool];
  const n = 1 + Math.floor(Math.random() * count);
  return `/sounds/${pool}/${n}.mp3`;
}

// The win ripple schedules one of these per ward, and wards at the same
// distance from the nearest Watcher share the same delay, so a bunch can
// land in the same instant — and a drag can cross many cells within
// milliseconds. Either way, a dozen identical sounds firing together reads
// as noise, not a rhythm, so both share one throttle: at most one of these
// rapid-fire sounds every ~70ms. Unlike haptic.ts's equivalent throttle,
// this isn't working around a platform rate limit (Audio.play() never
// touches Capacitor's native bridge) — it's purely about not machine-gunning
// the player's ears.
let lastRapidPlayAt = 0;
const RAPID_MIN_INTERVAL_MS = 70;

export function playSound(type: SoundType): void {
  const settings = loadSettings();
  if (!settings.sfxEnabled) return;
  if (type === 'win-ward' || type === 'drag-tick') {
    const now = Date.now();
    if (now - lastRapidPlayAt < RAPID_MIN_INTERVAL_MS) return;
    lastRapidPlayAt = now;
  }
  try {
    const audio = new Audio(randomVariantPath(type));
    audio.volume = settings.sfxVolume * (VOLUME_SCALE[type] ?? 1);
    audio.play().catch(() => { /* no file yet, or autoplay blocked — silent */ });
  } catch { /* ignore */ }
}
