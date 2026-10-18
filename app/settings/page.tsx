'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSettings } from '@/lib/settings';
import { getLanternTotal, getAutoWardCharges, spendLanterns, addAutoWardCharges, LANTERNS_CHANGED_EVENT } from '@/lib/storage';
import { getProducts, purchaseProduct, AUTOWARD_PACK_PRODUCT_IDS, AUTOWARD_PACK_CHARGES, type StoreProduct } from '@/lib/purchases';
import { useAdvancedModesEntitlement } from '@/lib/useAdvancedModesEntitlement';
import { track } from '@/lib/track';

const STORAGE_KEY_PREFIX = 'eldritch_beacon_state_';
const UNLOCKED_KEY = 'eb_unlocked_regions';

// Starting prices — easy to retune once there's real play data on how fast
// Lanterns accumulate vs. how often players actually want Auto-Ward.
// Pushed from 5 to 8 Lanterns/charge (2026-10-18) now that real-money
// charge packs exist alongside this — the Lantern path should stay usable
// but clearly the slower of the two routes, not a comparable shortcut to
// just paying. Flat per-charge cost, no bulk discount: a bigger pack is a
// convenience (fewer taps), not a better rate.
const AUTOWARD_PACKS = [
  { charges: 3, cost: 24 },
  { charges: 10, cost: 80 },
];

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
  const [lanternTotal, setLanternTotal] = useState(0);
  const [autoWardCharges, setAutoWardCharges] = useState(0);
  const [purchaseError, setPurchaseError] = useState(false);
  const [realMoneyPacks, setRealMoneyPacks] = useState<StoreProduct[]>([]);
  const [purchasingPackId, setPurchasingPackId] = useState<string | null>(null);
  const advancedModes = useAdvancedModesEntitlement();

  useEffect(() => {
    setLanternTotal(getLanternTotal());
    setAutoWardCharges(getAutoWardCharges());
    const onLanternsChanged = (e: Event) => setLanternTotal((e as CustomEvent<number>).detail);
    window.addEventListener(LANTERNS_CHANGED_EVENT, onLanternsChanged);
    getProducts(AUTOWARD_PACK_PRODUCT_IDS).then(setRealMoneyPacks);
    return () => window.removeEventListener(LANTERNS_CHANGED_EVENT, onLanternsChanged);
  }, []);

  function handlePurchase(pack: { charges: number; cost: number }) {
    if (!spendLanterns(pack.cost)) {
      setPurchaseError(true);
      setTimeout(() => setPurchaseError(false), 1600);
      return;
    }
    setLanternTotal(getLanternTotal());
    setAutoWardCharges(addAutoWardCharges(pack.charges));
  }

  async function handleRealMoneyPurchase(product: StoreProduct) {
    setPurchasingPackId(product.id);
    const result = await purchaseProduct(product.id);
    setPurchasingPackId(null);
    if (result.success) {
      setAutoWardCharges(addAutoWardCharges(AUTOWARD_PACK_CHARGES[product.id] ?? 0));
      track('iap_purchased', { product_id: product.id });
    }
  }

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
          <Link href="/" className="transition-all duration-100 hover:brightness-110 active:scale-95 shrink-0">
            <img
              src="/buttons/left_button_01.png"
              alt="Back"
              draggable={false}
              style={{ height: 40, display: 'block', filter: 'drop-shadow(2px 4px 2px rgba(0,0,0,0.6))' }}
            />
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

        <section className="flex flex-col gap-4 border border-ink border-opacity-30 rounded-sm p-4 bg-parchment">
          <div className="flex items-center justify-between">
            <h2 className="font-lovecraftian text-lg text-ink">Lantern Vault</h2>
            <span className="font-serif text-sm text-ink">{lanternTotal} Lanterns</span>
          </div>

          <div className="border-t border-ink opacity-10" />

          <Toggle
            label="Auto-Ward"
            description="When you place a Watcher, automatically mark every cell its row, column, adjacency, and territory rule out — no deduction, just the bookkeeping"
            checked={settings.autoWardEnabled}
            onChange={v => updateSettings({ autoWardEnabled: v })}
          />
          <p className="font-serif text-xs text-ink-light">
            {autoWardCharges} charge{autoWardCharges === 1 ? '' : 's'} remaining — one charge unlocks Auto-Ward for a full puzzle.
          </p>

          <div className="flex gap-2">
            {AUTOWARD_PACKS.map(pack => (
              <button
                key={pack.charges}
                onClick={() => handlePurchase(pack)}
                className="flex-1 font-serif text-xs text-ink border border-ink border-opacity-30 rounded-sm px-3 py-2 bg-parchment hover:bg-parchment-dark transition-colors"
              >
                +{pack.charges} charges<br />
                <span className="opacity-60">{pack.cost} Lanterns</span>
              </button>
            ))}
          </div>
          {purchaseError && (
            <p className="font-serif text-xs text-red-ink">Not enough Lanterns for that pack.</p>
          )}

          {realMoneyPacks.length > 0 && (
            <>
              <div className="border-t border-ink opacity-10" />
              <p className="font-serif text-xs text-ink-light" style={{ opacity: 0.75 }}>
                Or skip the wait:
              </p>
              <div className="flex gap-2">
                {realMoneyPacks.map(product => (
                  <button
                    key={product.id}
                    onClick={() => handleRealMoneyPurchase(product)}
                    disabled={purchasingPackId === product.id}
                    className="flex-1 font-serif text-xs text-ink border border-ink border-opacity-30 rounded-sm px-3 py-2 bg-parchment hover:bg-parchment-dark transition-colors"
                    style={{ opacity: purchasingPackId === product.id ? 0.5 : 1 }}
                  >
                    +{AUTOWARD_PACK_CHARGES[product.id] ?? '?'} charges<br />
                    <span className="opacity-60">
                      {purchasingPackId === product.id ? 'Purchasing…' : product.displayPrice}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="flex flex-col gap-3 border border-ink border-opacity-30 rounded-sm p-4 bg-parchment">
          <h2 className="font-lovecraftian text-lg text-ink">Advanced Modes</h2>
          <p className="font-serif text-xs text-ink-light" style={{ opacity: 0.75 }}>
            {advancedModes.unlocked
              ? 'Shattered Realms and Twin Watchers are unlocked.'
              : 'Unlock Shattered Realms and Twin Watchers together with one purchase.'}
          </p>
          {!advancedModes.unlocked && (
            <button
              onClick={advancedModes.purchase}
              disabled={advancedModes.purchasing}
              className="font-serif text-sm text-ink border border-ink border-opacity-30 rounded-sm px-3 py-2 bg-parchment hover:bg-parchment-dark transition-colors"
              style={{ opacity: advancedModes.purchasing ? 0.5 : 1 }}
            >
              {advancedModes.purchasing ? 'Purchasing…' : advancedModes.price ? `Unlock — ${advancedModes.price}` : 'Unlock'}
            </button>
          )}
          {advancedModes.error && (
            <p className="font-serif text-xs text-red-ink">{advancedModes.error}</p>
          )}
          <button
            onClick={advancedModes.restore}
            className="font-serif text-xs text-ink-light self-start hover:text-ink transition-colors"
          >
            Restore Purchases
          </button>
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

        <p className="font-serif text-xs text-ink-light text-center opacity-50 pt-2">
          Campaign art by Tyson Draws Stuff
        </p>
      </div>
    </main>
  );
}
