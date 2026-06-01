'use client';

import type { HintResult } from '@/engine/boardTypes';

interface HintOverlayProps {
  hint: HintResult | null;
  onDismiss: () => void;
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
};

export default function HintOverlay({ hint, onDismiss }: HintOverlayProps) {
  if (!hint) return null;

  return (
    <div
      className="w-full max-w-sm bg-parchment border-2 border-ink rounded-sm p-5"
      role="status"
      aria-label="Hint"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <img
            src="/svg/hint_ink_circle.svg"
            alt=""
            width={24}
            height={24}
          />
          <span className="font-serif text-xs text-ink-light tracking-widest uppercase">
            Divination &bull; Level {LEVEL_LABELS[hint.level] ?? hint.level}
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="text-ink text-lg leading-none hover:text-red-ink transition-colors"
          aria-label="Dismiss hint"
        >
          &times;
        </button>
      </div>

      {/* Divider */}
      <div className="border-t border-ink opacity-20 mb-3" />

      {/* Message */}
      <p className="font-serif text-sm text-ink italic leading-relaxed">
        {hint.message}
      </p>

      {/* Footer */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={onDismiss}
          className="font-serif text-xs border border-ink px-3 py-1 rounded-sm bg-parchment hover:bg-parchment-dark transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
