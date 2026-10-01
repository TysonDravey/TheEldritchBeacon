'use client';

import { useEffect, useState } from 'react';

const SETTINGS_KEY = 'eb_settings';
const CHANGE_EVENT = 'eb-settings-changed';

export interface Settings {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  tutorialDismissed: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  musicEnabled: true,
  sfxEnabled: true,
  tutorialDismissed: false,
};

export function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const next = { ...loadSettings(), ...patch };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch { /* best-effort, ignore write failures */ }
  // Same-tab components (e.g. background music mounted in the root layout)
  // can't see another component's localStorage write — storage events only
  // fire in OTHER tabs by spec — so broadcast a same-tab custom event too.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<Settings>(CHANGE_EVENT, { detail: next }));
  }
  return next;
}

// Convenience hook for any component that needs to read settings and stay in
// sync with changes made elsewhere (e.g. the Settings page toggling music
// while a background player mounted in the root layout is listening).
export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(loadSettings());
    const onChange = (e: Event) => setSettings((e as CustomEvent<Settings>).detail);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  return [settings, updateSettings];
}
