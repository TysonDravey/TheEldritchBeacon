'use client';

import { useEffect, useState } from 'react';

interface StreakRescueProps {
  streakCount: number;
  cost: number;
  lanternTotal: number;
  onRestore: () => void;
  onDismiss: () => void;
  /** Real-money alternative, alongside the Lantern path (not replacing it).
   *  null price means the product hasn't loaded yet (or isn't available,
   *  e.g. on web) -- that row is simply hidden in that case. */
  realMoneyPrice: string | null;
  purchasingRealMoney: boolean;
  onPurchaseRealMoney: () => void;
}

export default function StreakRescue({
  streakCount, cost, lanternTotal, onRestore, onDismiss,
  realMoneyPrice, purchasingRealMoney, onPurchaseRealMoney,
}: StreakRescueProps) {
  const [visible, setVisible] = useState(false);
  const canAfford = lanternTotal >= cost;

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    setVisible(false);
    setTimeout(onDismiss, 300);
  }

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(8,5,2,0.8)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.35s ease',
        padding: '0 24px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(242,233,216,0.97)',
          border: '1px solid rgba(26,18,9,0.25)',
          borderRadius: 8,
          padding: '30px 24px 26px',
          maxWidth: 380,
          width: '100%',
          boxShadow: '0 8px 48px rgba(0,0,0,0.75)',
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
          transition: 'transform 0.35s ease',
          textAlign: 'center',
        }}
      >
        <span
          className="font-serif"
          style={{
            fontSize: 10,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'rgba(181,134,13,0.85)',
            background: 'rgba(181,134,13,0.1)',
            border: '1px solid rgba(181,134,13,0.3)',
            borderRadius: 4,
            padding: '3px 10px',
          }}
        >
          The Watch Lapsed
        </span>

        <h2 className="font-lovecraftian text-ink" style={{ fontSize: 24, lineHeight: 1.2, margin: '18px 0 6px' }}>
          {streakCount}-day streak
        </h2>
        <p className="font-serif text-sm text-ink" style={{ opacity: 0.75, marginBottom: 16 }}>
          A night went unwatched. Spend Lanterns to keep the light burning without a gap.
        </p>

        <div style={{ width: 40, height: 1, background: 'rgba(26,18,9,0.2)', margin: '0 auto 16px' }} />

        <p className="font-serif text-xs text-ink-light" style={{ marginBottom: 20, opacity: 0.75 }}>
          {canAfford
            ? `Restore for ${cost} Lanterns (you have ${lanternTotal}).`
            : `Restoring costs ${cost} Lanterns — you have ${lanternTotal}.`}
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={dismiss}
            className="font-serif text-sm text-ink-light transition-opacity hover:opacity-70"
            style={{
              border: '1px solid rgba(26,18,9,0.25)',
              borderRadius: 4,
              padding: '7px 20px',
              background: 'transparent',
            }}
          >
            Let it go
          </button>
          <button
            onClick={() => { if (canAfford) { onRestore(); dismiss(); } }}
            disabled={!canAfford}
            className="font-serif text-sm transition-opacity"
            style={{
              border: '1px solid var(--brass, #b5860d)',
              borderRadius: 4,
              padding: '7px 20px',
              background: canAfford ? 'var(--brass, #b5860d)' : 'transparent',
              color: canAfford ? '#2a1c0d' : 'rgba(26,18,9,0.4)',
              cursor: canAfford ? 'pointer' : 'not-allowed',
            }}
          >
            Restore
          </button>
        </div>

        {realMoneyPrice && (
          <button
            onClick={() => { if (!purchasingRealMoney) onPurchaseRealMoney(); }}
            disabled={purchasingRealMoney}
            className="font-serif text-xs text-ink-light transition-opacity hover:opacity-70"
            style={{ background: 'transparent', border: 'none', marginTop: 14 }}
          >
            {purchasingRealMoney ? 'Purchasing…' : `Or restore instantly — ${realMoneyPrice}`}
          </button>
        )}
      </div>
    </div>
  );
}
