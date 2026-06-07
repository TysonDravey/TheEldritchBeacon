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
      className="select-none"
      style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 60,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 16px',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
        background: 'rgba(8,5,2,0.75)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
    <div className="relative w-full" style={{ maxWidth: 480 }}>
      {/* Scroll background — stretched to match content height */}
      <img
        src="/scrolls/scroll_short_01.png"
        alt=""
        draggable={false}
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: 'fill', display: 'block' }}
      />

      {/* Content drives the container height */}
      <div className="relative flex flex-col" style={{ padding: '13% 17%' }}>
        {/* Parchment inset for readability */}
        <div
          style={{
            background: 'rgba(242,233,216,0.82)',
            padding: '10px 14px',
            borderRadius: 3,
            border: '1px solid rgba(26,18,9,0.18)',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.12)',
          }}
        >
          {/* Header row */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <img src="/svg/hint_ink_circle.svg" alt="" width={18} height={18} />
              <span className="font-serif text-xs text-ink-light tracking-widest uppercase">
                Divination &bull; Level {LEVEL_LABELS[hint.level] ?? hint.level}
              </span>
            </div>
            <button
              onClick={onDismiss}
              className="text-ink text-base leading-none hover:text-red-ink transition-colors"
              aria-label="Dismiss hint"
            >
              &times;
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-ink opacity-20 mb-2" />

          {/* Message */}
          <p className="font-serif text-sm text-ink italic leading-relaxed">
            {hint.message}
          </p>
        </div>

        {/* Dismiss button */}
        <div className="flex justify-center mt-3 mb-1">
          <button
            onClick={onDismiss}
            className="relative transition-all duration-100 hover:brightness-110 active:scale-95"
            title="Dismiss"
          >
            <img
              src="/buttons/button_01.png"
              alt=""
              draggable={false}
              style={{ width: 120, height: 60, display: 'block' }}
            />
            <span
              className="absolute inset-0 flex items-center justify-center font-serif text-sm font-bold"
              style={{ color: 'rgba(242,233,210,0.95)', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
            >
              Dismiss
            </span>
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}
