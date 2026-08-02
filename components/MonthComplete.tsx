'use client';

import { useEffect, useState } from 'react';

interface MonthCompleteProps {
  monthLabel: string;
  dayCount: number;
  monthsCompleted: number;
  onDismiss: () => void;
}

const SPARK_COUNT = 12;

export default function MonthComplete({ monthLabel, dayCount, monthsCompleted, onDismiss }: MonthCompleteProps) {
  const [visible, setVisible] = useState(false);

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
          Every Beacon Lit
        </span>

        {/* Seal medallion — stamps in with a radiating spark burst */}
        {visible && (
          <div style={{ position: 'relative', width: 108, height: 108, margin: '22px auto 16px' }}>
            {Array.from({ length: SPARK_COUNT }, (_, i) => (
              <div key={i} className={`seal-spark seal-spark-${i}`} />
            ))}
            <div className="seal-glow" style={{ position: 'absolute', inset: 10 }}>
              <img
                src="/svg/beacon_seal.svg"
                alt=""
                draggable={false}
                className="seal-stamp"
                style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))' }}
              />
            </div>
          </div>
        )}

        <h2 className="font-lovecraftian text-ink" style={{ fontSize: 24, lineHeight: 1.2, marginBottom: 6 }}>
          {monthLabel}
        </h2>
        <p className="font-serif text-sm text-ink" style={{ opacity: 0.75, marginBottom: 16 }}>
          {dayCount} beacon{dayCount !== 1 ? 's' : ''} lit — not a single ward left untended.
        </p>

        <div style={{ width: 40, height: 1, background: 'rgba(26,18,9,0.2)', margin: '0 auto 16px' }} />

        <p className="font-serif text-xs text-ink-light italic" style={{ lineHeight: 1.6, marginBottom: 20, opacity: 0.65 }}>
          {monthsCompleted > 1
            ? `You've now completed ${monthsCompleted} months in full.`
            : "The first seal added to your calendar."}
        </p>

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
          Continue
        </button>
      </div>
    </div>
  );
}
