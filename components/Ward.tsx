'use client';

import { WARD_PNG } from '@/theme/colors';

interface WardProps {
  territory: number;
  size: number;
}

export default function Ward({ territory: _territory, size }: WardProps) {
  const src = WARD_PNG;
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt="Ward"
      className="ward-sigil"
      draggable={false}
      style={{
        transform: 'translateY(-3px)',
        filter: 'drop-shadow(0 5px 10px rgba(0,0,0,0.85)) drop-shadow(0 2px 4px rgba(0,0,0,0.65))',
      }}
    />
  );
}
