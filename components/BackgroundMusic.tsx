'use client';

import { useEffect, useRef } from 'react';
import { useSettings } from '@/lib/settings';

// One track for now — add more paths here and pick randomly/sequentially
// once there's more than one, so a long session doesn't loop the same song
// forever.
const TRACKS = ['/music/restricted-beacon.mp3'];

export default function BackgroundMusic() {
  const [settings] = useSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(TRACKS[0]);
    audio.loop = true;
    audioRef.current = audio;
    return () => { audio.pause(); };
  }, []);

  // Separate from the enable/disable effect below so dragging the volume
  // slider doesn't re-trigger the autoplay-retry dance on every tick.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = settings.musicVolume;
  }, [settings.musicVolume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!settings.musicEnabled) {
      audio.pause();
      return;
    }

    // Browsers (and WKWebView) block audio-with-sound from autoplaying
    // without a user gesture having happened first. play() rejects in that
    // case — same rejection shape as "no file yet" — so on failure we just
    // wait for the first tap/click anywhere and retry once. If this is
    // missing audio rather than a blocked autoplay, that retry silently
    // fails the same way and nothing plays, which is the correct behavior
    // either way until a real file exists.
    const tryPlay = () => audio.play().catch(() => undefined);
    tryPlay();

    const onFirstInteraction = () => {
      tryPlay();
      window.removeEventListener('pointerdown', onFirstInteraction);
    };
    window.addEventListener('pointerdown', onFirstInteraction);
    return () => window.removeEventListener('pointerdown', onFirstInteraction);
  }, [settings.musicEnabled]);

  return null;
}
