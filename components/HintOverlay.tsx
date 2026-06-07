'use client';

import type { HintResult } from '@/engine/boardTypes';

interface HintOverlayProps {
  hint: HintResult | null;
  onDismiss: () => void;
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'I', 2: 'II', 3: 'III', 4: 'IV',
};

export default function HintOverlay({ hint, onDismiss }: HintOverlayProps) {
  if (!hint) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: 0, right: 0,
        bottom: 'calc(env(safe-area-inset-bottom) + 64px)', // sits just above the controls footer
        zIndex: 55,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 12px',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: 'rgba(242,233,216,0.97)',
          border: '1px solid rgba(26,18,9,0.25)',
          borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          padding: '10px 14px',
          maxWidth: 480,
          width: '100%',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          pointerEvents: 'auto',
        }}
      >
        {/* Level badge */}
        <span
          className="font-serif shrink-0"
          style={{
            fontSize: 10,
            color: 'rgba(26,18,9,0.45)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            paddingTop: 1,
          }}
        >
          {LEVEL_LABELS[hint.level] ?? hint.level}
        </span>

        {/* Message */}
        <p className="font-serif text-sm text-ink italic flex-1 leading-snug">
          {hint.message}
        </p>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="shrink-0 font-serif text-ink-light hover:text-ink transition-colors"
          style={{ fontSize: 18, lineHeight: 1, paddingTop: 1 }}
          aria-label="Dismiss hint"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
