'use client';

import { WARD_PNGS } from '@/theme/colors';

interface WardProps {
  territory: number;
  size: number;
}

export default function Ward({ territory, size }: WardProps) {
  const src = WARD_PNGS[territory] ?? WARD_PNGS[0];
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        isolation: 'isolate',
        transform: 'translateY(-3px)',
        filter: 'drop-shadow(0 5px 10px rgba(0,0,0,0.85)) drop-shadow(0 2px 4px rgba(0,0,0,0.65))',
      }}
    >
      <img
        src={src}
        width={size}
        height={size}
        alt="Ward"
        className="ward-sigil"
        draggable={false}
        style={{ display: 'block' }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, transparent 55%)',
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
