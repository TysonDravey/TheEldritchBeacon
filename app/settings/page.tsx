'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSettings } from '@/lib/settings';

const STORAGE_KEY_PREFIX = 'eldritch_beacon_state_';
const UNLOCKED_KEY = 'eb_unlocked_regions';

function VolumeSlider({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
}) {
  return (
    <input
      type="range"
      min={0}
      max={100}
      step={1}
      value={Math.round(value * 100)}
      disabled={disabled}
      onChange={e => onChange(Number(e.target.value) / 100)}
      className="w-full"
      style={{
        accentColor: 'var(--brass, #b5860d)',
        opacity: disabled ? 0.35 : 1,
      }}
      aria-label="Volume"
    />
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-4 w-full text-left"
    >
      <div>
        <p className="font-serif text-sm font-bold text-ink">{label}</p>
        <p className="font-serif text-xs text-ink-light mt-0.5">{description}</p>
      </div>
      <span
        className="shrink-0 relative rounded-full transition-colors"
        style={{
          width: 44,
          height: 24,
          background: checked ? 'var(--brass, #b5860d)' : 'rgba(26,18,9,0.2)',
        }}
      >
        <span
          className="absolute top-0.5 rounded-full bg-parchment transition-transform"
          style={{
            width: 20,
            height: 20,
            left: 2,
            transform: checked ? 'translateX(20px)' : 'translateX(0)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
          }}
        />
      </span>
    </button>
  );
}

export default function SettingsPage() {
  const [settings, updateSettings] = useSettings();
  const [confirmingReset, setConfirmingReset] = useState(false);

  function handleReset() {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) localStorage.removeItem(key);
    }
    localStorage.removeItem(UNLOCKED_KEY);
    setConfirmingReset(false);
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-12">
      <div className="w-full max-w-lg flex flex-col gap-8">
        <div className="flex items-center gap-3 bg-parchment border border-ink border-opacity-30 rounded-sm px-4 py-3">
          <Link href="/" className="font-serif text-sm text-ink-light opacity-60 hover:opacity-100 transition-opacity">
            &larr; Back
          </Link>
          <h1 className="font-lovecraftian text-2xl text-ink">Settings</h1>
        </div>

        <section className="flex flex-col gap-5 border border-ink border-opacity-30 rounded-sm p-4 bg-parchment">
          <div className="flex flex-col gap-2">
            <Toggle
              label="Music"
              description="Background ambience while you play"
              checked={settings.musicEnabled}
              onChange={v => updateSettings({ musicEnabled: v })}
            />
            <VolumeSlider
              value={settings.musicVolume}
              onChange={v => updateSettings({ musicVolume: v })}
              disabled={!settings.musicEnabled}
            />
          </div>
          <div className="border-t border-ink opacity-10" />
          <div className="flex flex-col gap-2">
            <Toggle
              label="Sound Effects"
              description="Wards, Watchers, and other feedback"
              checked={settings.sfxEnabled}
              onChange={v => updateSettings({ sfxEnabled: v })}
            />
            <VolumeSlider
              value={settings.sfxVolume}
              onChange={v => updateSettings({ sfxVolume: v })}
              disabled={!settings.sfxEnabled}
            />
          </div>
          <div className="border-t border-ink opacity-10" />
          <Toggle
            label="Haptics"
            description="Vibration feedback on supported devices"
            checked={settings.hapticsEnabled}
            onChange={v => updateSettings({ hapticsEnabled: v })}
          />
        </section>

        <section className="border border-ink border-opacity-30 rounded-sm p-4 bg-parchment">
          <Toggle
            label="Show &ldquo;New to the Beacon?&rdquo; hint"
            description="A nudge toward the tutorial on the home screen"
            checked={!settings.tutorialDismissed}
            onChange={v => updateSettings({ tutorialDismissed: !v })}
          />
        </section>

        <section className="text-center pt-4">
          {!confirmingReset ? (
            <button
              onClick={() => setConfirmingReset(true)}
              className="inline-block font-serif text-xs text-ink-light opacity-70 hover:opacity-100 transition-opacity bg-parchment border border-ink border-opacity-30 rounded-sm px-3 py-1.5"
            >
              Reset all progress
            </button>
          ) : (
            <div className="inline-flex items-center gap-3 border border-ink border-opacity-30 px-4 py-2 rounded-sm bg-parchment">
              <span className="font-serif text-xs text-ink-light">Erase all progress?</span>
              <button
                onClick={handleReset}
                className="font-serif text-xs text-red-ink border border-red-ink px-2 py-0.5 rounded-sm hover:bg-red-ink hover:text-parchment transition-colors"
              >
                Yes, reset
              </button>
              <button
                onClick={() => setConfirmingReset(false)}
                className="font-serif text-xs text-ink-light hover:text-ink transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
