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
        filter: 'drop-shadow(3px 6px 4px rgba(0,0,0,0.95)) drop-shadow(1px 2px 2px rgba(0,0,0,0.75))',
      }}
    />
  );
}
