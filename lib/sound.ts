import { loadSettings } from './settings';

// One-shot sound effects, keyed by game moment. Finer-grained than
// haptic.ts's HapticType in a couple of places (place vs. remove) because a
// sound can carry that distinction in a way a single impact style can't.
export type SoundType =
  | 'ward' | 'ward-remove'
  | 'watcher' | 'watcher-remove'
  | 'error'
  | 'win-lift'
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
  'win-lift':        6,
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

function variantPath(type: SoundType, n: number): string {
  const pool = POOL_FOR[type] ?? type;
  return `/sounds/${pool}/${n}.mp3`;
}

function randomVariantPath(type: SoundType): string {
  const pool = POOL_FOR[type] ?? type;
  const count = SOUND_VARIANT_COUNTS[pool];
  const n = 1 + Math.floor(Math.random() * count);
  return variantPath(type, n);
}

// iOS WebKit hard-ignores HTMLMediaElement.volume — `new Audio()` always
// plays at full device volume no matter what .volume is set to, which is
// why the in-game SFX slider did nothing on a phone. Web Audio API's
// GainNode runs the attenuation in software before the signal reaches the
// OS, so it's the only way to actually get a quieter sound out on iOS.
// decodeAudioData() also gives us a plain in-memory buffer we can play
// instantly via a fresh BufferSourceNode — no per-play fetch/decode, which
// was the other half of the "clunky, stutters, plays overtop itself" complaint:
// a bare `new Audio(path).play()` has to fetch and decode from scratch every
// single call, and those costs vary enough call to call that a rapid-fire
// sequence (the win ripple especially) could visibly drift or double up.
let audioCtx: AudioContext | null = null;
// Exported so other modules needing Web Audio (BackgroundMusic.tsx, for its own
// iOS volume-control fix) share this one context instead of creating another —
// iOS caps concurrent AudioContexts, and there's no benefit to more than one here.
export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  // Starts 'suspended' until resumed from inside a user-gesture call stack (iOS
  // autoplay policy) — playSound's first call is always a direct tap handler, so
  // this unlocks the context for the rest of the session, including later
  // setTimeout-driven calls (the win sequence) that aren't gestures themselves.
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

const bufferCache = new Map<string, Promise<AudioBuffer | null>>();
function loadBuffer(path: string): Promise<AudioBuffer | null> {
  const ctx = getAudioContext();
  if (!ctx) return Promise.resolve(null);
  let cached = bufferCache.get(path);
  if (!cached) {
    cached = fetch(path)
      .then(res => res.arrayBuffer())
      .then(data => ctx.decodeAudioData(data))
      .catch(() => null); // no file yet, or a fetch/decode failure — silent
    bufferCache.set(path, cached);
  }
  return cached;
}

// Fire off every variant's fetch+decode as soon as this module loads (doesn't
// need a user gesture — only starting playback does) so the first real play of
// each sound in a session doesn't pay fetch/decode latency on top of everything
// else. Module-load time is as early as this can start; by the time a player's
// first tap calls playSound(), most of these have likely already resolved.
if (typeof window !== 'undefined') {
  for (const type of Object.keys(SOUND_VARIANT_COUNTS) as SoundType[]) {
    if (POOL_FOR[type]) continue; // drag-tick etc. share another type's pool/files
    for (let n = 1; n <= SOUND_VARIANT_COUNTS[type]; n++) {
      loadBuffer(variantPath(type, n));
    }
  }
}

// The win ripple schedules one of these per ward, and wards at the same
// distance from the nearest Watcher share the same delay, so a bunch can
// land in the same instant — and a drag can cross many cells within
// milliseconds. Either way, a dozen identical sounds firing together reads
// as noise, not a rhythm, so both share one throttle: at most one of these
// rapid-fire sounds every ~70ms.
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
  const ctx = getAudioContext();
  if (!ctx) return;
  const volume = settings.sfxVolume * (VOLUME_SCALE[type] ?? 1);
  loadBuffer(randomVariantPath(type)).then(buffer => {
    if (!buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(ctx.destination);
    source.start();
  });
}
