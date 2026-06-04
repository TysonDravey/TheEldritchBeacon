'use client';

import { WATCHER_SVGS } from '@/theme/colors';

interface WatcherProps {
  territory: number;
  size: number;
}

export default function Watcher({ territory, size }: WatcherProps) {
  const src = WATCHER_SVGS[territory] ?? WATCHER_SVGS[0];
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        isolation: 'isolate',
        transform: 'translateY(-4px)',
        filter: 'drop-shadow(0 5px 10px rgba(0,0,0,0.85)) drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
      }}
    >
      <img
        src={src}
        width={size}
        height={size}
        alt="Watcher"
        draggable={false}
        style={{ display: 'block' }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.45) 0%, transparent 55%)',
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
