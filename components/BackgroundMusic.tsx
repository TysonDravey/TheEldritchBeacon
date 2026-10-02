'use client';

import { useEffect, useRef } from 'react';
import { useSettings } from '@/lib/settings';
import { getAudioContext } from '@/lib/sound';

// Picked at random each time a track ends (never the one that just played,
// once there's more than one) rather than looping a single track forever —
// same rationale as lib/sound.ts's SFX variant pools, just for music.
const TRACKS = [
  '/music/restricted-beacon.mp3',
  '/music/beacon-in-the-fog-1.mp3',
  '/music/beacon-in-the-fog-2.mp3',
];

function pickNextTrack(exclude: number): number {
  if (TRACKS.length <= 1) return 0;
  let i = Math.floor(Math.random() * TRACKS.length);
  while (i === exclude) i = Math.floor(Math.random() * TRACKS.length);
  return i;
}

// Not cached across tracks like lib/sound.ts's short SFX clips — a decoded
// ~3-4 minute 48kHz stereo track is roughly 80MB of raw PCM in memory, so only
// ever one track's buffer is held onto at a time (the old one is dropped as
// soon as a new one decodes, simply by not keeping a reference to it).
function loadTrackBuffer(ctx: AudioContext, path: string): Promise<AudioBuffer | null> {
  return fetch(path)
    .then(res => res.arrayBuffer())
    .then(data => ctx.decodeAudioData(data))
    .catch(() => null);
}

export default function BackgroundMusic() {
  const [settings] = useSettings();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const gainRef       = useRef<GainNode | null>(null);
  const sourceRef     = useRef<AudioBufferSourceNode | null>(null);
  const trackIdxRef   = useRef(-1);
  const wantPlayingRef = useRef(false);
  // Guards the gap between starting a track's async decode and the source
  // actually existing — without it, two overlapping start attempts (the
  // immediate one on enable, plus the first-interaction retry) could both
  // pass a `sourceRef.current` check before either sets it, and both
  // resolve into two tracks playing on top of each other.
  const startingRef = useRef(false);

  function playNextTrack(ctx: AudioContext, gain: GainNode) {
    startingRef.current = true;
    trackIdxRef.current = pickNextTrack(trackIdxRef.current);
    loadTrackBuffer(ctx, TRACKS[trackIdxRef.current]).then(buffer => {
      startingRef.current = false;
      // Settings may have changed (or the component unmounted) while this was
      // decoding — a few hundred KB of mp3 decodes fast, but don't be the
      // slow decode that starts audio after the player already paused it.
      if (!buffer || !wantPlayingRef.current) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      source.onended = () => {
        if (sourceRef.current === source) sourceRef.current = null;
        if (wantPlayingRef.current) playNextTrack(ctx, gain);
      };
      source.start();
      sourceRef.current = source;
    });
  }

  // iOS WebKit hard-ignores HTMLMediaElement.volume (the same bug fixed for SFX
  // in lib/sound.ts), and routing a plain <audio> element through Web Audio via
  // createMediaElementSource — the usual workaround for long streamed audio —
  // turned out not to reliably fix that here either. AudioBufferSourceNode +
  // GainNode is the one mechanism already proven (via the SFX engine) to
  // actually control volume on iOS, so music uses it too despite the memory
  // cost of decoding a full track, rather than a second unverified approach.
  useEffect(() => {
    const ctx = getAudioContext();
    if (!ctx) return;
    const gain = ctx.createGain();
    gain.gain.value = settingsRef.current.musicVolume;
    gain.connect(ctx.destination);
    gainRef.current = gain;

    return () => {
      wantPlayingRef.current = false;
      sourceRef.current?.stop();
      sourceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = settings.musicVolume;
  }, [settings.musicVolume]);

  useEffect(() => {
    const ctxOrNull = getAudioContext();
    const gainOrNull = gainRef.current;
    if (!ctxOrNull || !gainOrNull) return;
    const ctx: AudioContext = ctxOrNull;
    const gain: GainNode = gainOrNull;

    function stop() {
      wantPlayingRef.current = false;
      sourceRef.current?.stop();
      sourceRef.current = null;
    }

    function syncToVisibility() {
      // Capacitor's WKWebView fires the standard Page Visibility API on
      // app background/foreground — no native plugin needed. This is a
      // game, not a music player: nothing should keep playing once the
      // player has left the app, and without this, Web Audio playback
      // (unlike a plain <audio> element, which WKWebView suspends on its
      // own) just keeps running in the background indefinitely.
      if (document.hidden || !settings.musicEnabled) {
        stop();
        return;
      }
      wantPlayingRef.current = true;
      if (!sourceRef.current && !startingRef.current) playNextTrack(ctx, gain);
    }

    syncToVisibility();
    document.addEventListener('visibilitychange', syncToVisibility);

    // decodeAudioData doesn't need a user gesture, but ctx.resume() (inside
    // getAudioContext()) does on iOS — so the first attempt above can decode
    // fine yet still play silently into a suspended context. Retry once on
    // the first tap/click anywhere, same pattern as the old <audio>-element
    // version used for its own autoplay-block retry.
    const onFirstInteraction = () => {
      syncToVisibility();
      window.removeEventListener('pointerdown', onFirstInteraction);
    };
    window.addEventListener('pointerdown', onFirstInteraction);

    return () => {
      document.removeEventListener('visibilitychange', syncToVisibility);
      window.removeEventListener('pointerdown', onFirstInteraction);
    };
  }, [settings.musicEnabled]);

  return null;
}
