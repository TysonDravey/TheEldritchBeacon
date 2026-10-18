'use client';

interface AdvancedModesPaywallProps {
  price: string | null;
  purchasing: boolean;
  error: string | null;
  onPurchase: () => void;
  onRestore: () => void;
  onBack: () => void;
}

// Full-screen block, not a dismissible overlay — a locked puzzle shows this
// INSTEAD of the board, not blurred behind it. Same visual family as
// RuleChangeIntro (the other full-screen narrative/rules card).
export default function AdvancedModesPaywall({ price, purchasing, error, onPurchase, onRestore, onBack }: AdvancedModesPaywallProps) {
  return (
    <main
      style={{
        height: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1a1209',
        padding: '0 24px',
      }}
    >
      <div
        style={{
          background: 'rgba(242,233,216,0.97)',
          border: '1px solid rgba(26,18,9,0.25)',
          borderRadius: 8,
          padding: '28px 24px 24px',
          maxWidth: 380,
          width: '100%',
          boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <span
            className="font-serif"
            style={{
              fontSize: 10,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'rgba(181,134,13,0.8)',
              background: 'rgba(181,134,13,0.1)',
              border: '1px solid rgba(181,134,13,0.3)',
              borderRadius: 4,
              padding: '3px 10px',
            }}
          >
            Advanced Modes
          </span>
        </div>

        <h2 className="font-lovecraftian text-ink" style={{ fontSize: 22, lineHeight: 1.2, marginBottom: 14 }}>
          The Charts Go Further
        </h2>

        <div style={{ width: 40, height: 1, background: 'rgba(26,18,9,0.2)', margin: '0 auto 16px' }} />

        <p className="font-serif text-sm text-ink" style={{ lineHeight: 1.6, marginBottom: 20, opacity: 0.85 }}>
          Shattered Realms and Twin Watchers unlock together — scattered territories, and a second
          Watcher to place in every line. One purchase, both modes, forever.
        </p>

        {error && (
          <p className="font-serif text-xs text-red-ink" style={{ marginBottom: 14 }}>
            {error}
          </p>
        )}

        <button
          onClick={onPurchase}
          disabled={purchasing}
          className="font-serif text-sm transition-opacity"
          style={{
            border: '1px solid var(--brass, #b5860d)',
            borderRadius: 4,
            padding: '9px 28px',
            background: purchasing ? 'transparent' : 'var(--brass, #b5860d)',
            color: purchasing ? 'rgba(26,18,9,0.5)' : '#2a1c0d',
            cursor: purchasing ? 'not-allowed' : 'pointer',
            marginBottom: 14,
            width: '100%',
          }}
        >
          {purchasing ? 'Purchasing…' : price ? `Unlock — ${price}` : 'Unlock Advanced Modes'}
        </button>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 18 }}>
          <button
            onClick={onRestore}
            className="font-serif text-xs text-ink-light transition-opacity hover:opacity-70"
            style={{ background: 'transparent', border: 'none' }}
          >
            Restore Purchases
          </button>
          <button
            onClick={onBack}
            className="font-serif text-xs text-ink-light transition-opacity hover:opacity-70"
            style={{ background: 'transparent', border: 'none' }}
          >
            Back
          </button>
        </div>
      </div>
    </main>
  );
}
