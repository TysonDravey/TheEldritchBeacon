'use client';

import { useEffect, useState } from 'react';
import type { PuzzleMode } from '@/engine/boardTypes';
import { RULE_CHANGES, markRuleChangeSeen } from '@/lib/ruleChanges';

interface RuleChangeIntroProps {
  mode: 'shattered-realms' | 'twin-watchers';
  onDismiss: () => void;
}

export default function RuleChangeIntro({ mode, onDismiss }: RuleChangeIntroProps) {
  const [visible, setVisible] = useState(false);
  const entry = RULE_CHANGES[mode];

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  if (!entry) return null;

  // Marked seen only on dismiss (not eagerly on mount, unlike
  // TechniqueDiscovery) — a narrative rule-change beat should reliably
  // reappear if the player backgrounds the app before actually reading it.
  function dismiss() {
    markRuleChangeSeen(mode);
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
        background: 'rgba(8,5,2,0.75)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        padding: '0 24px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(242,233,216,0.97)',
          border: '1px solid rgba(26,18,9,0.25)',
          borderRadius: 8,
          padding: '28px 24px 24px',
          maxWidth: 380,
          width: '100%',
          boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
          transition: 'transform 0.3s ease',
          textAlign: 'center',
        }}
      >
        {/* Badge */}
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
            The Rules Have Changed
          </span>
        </div>

        {/* Title */}
        <h2
          className="font-lovecraftian text-ink"
          style={{ fontSize: 22, lineHeight: 1.2, marginBottom: 14 }}
        >
          {entry.title}
        </h2>

        {/* Divider */}
        <div style={{ width: 40, height: 1, background: 'rgba(26,18,9,0.2)', margin: '0 auto 16px' }} />

        {/* Body — whitespace-pre-line so the \n\n paragraph breaks render */}
        <p
          className="font-serif text-sm text-ink"
          style={{ lineHeight: 1.6, marginBottom: 14, opacity: 0.85, whiteSpace: 'pre-line', textAlign: 'left' }}
        >
          {entry.body}
        </p>

        {/* Flavour */}
        <p
          className="font-serif text-xs text-ink-light italic"
          style={{ lineHeight: 1.6, marginBottom: 22, opacity: 0.65 }}
        >
          &ldquo;{entry.flavour}&rdquo;
        </p>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="font-serif text-sm text-ink transition-opacity hover:opacity-70"
          style={{
            border: '1px solid rgba(26,18,9,0.25)',
            borderRadius: 4,
            padding: '7px 24px',
            background: 'transparent',
          }}
        >
          I Understand
        </button>
      </div>
    </div>
  );
}
