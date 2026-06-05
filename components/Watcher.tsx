'use client';

import { WATCHER_SVGS } from '@/theme/colors';

interface WatcherProps {
  territory: number;
  size: number;
  awakenDelay?: number;
}

export default function Watcher({ territory, size, awakenDelay }: WatcherProps) {
  const src = WATCHER_SVGS[territory] ?? WATCHER_SVGS[0];
  const pulseAnim   = `watcher-glow-${territory}`;
  const pulseTime   = [2.1,1.8,2.4,2.0,1.9,2.3,2.6,2.2,1.7,2.5][territory] ?? 2.0;
  const baseDelay   = 400; // let the win banner register before animating
  const animation   = awakenDelay !== undefined
    ? `${pulseAnim} ${pulseTime}s ease-in-out infinite, watcher-awaken 2s ease-in-out ${baseDelay + awakenDelay}ms both`
    : `${pulseAnim} ${pulseTime}s ease-in-out infinite`;

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt="Watcher"
      draggable={false}
      style={{
        animation,
        transform: awakenDelay !== undefined ? undefined : 'translateY(-4px)',
      }}
    />
  );
}
