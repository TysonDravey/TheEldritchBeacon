'use client';

import { WATCHER_SVGS } from '@/theme/colors';

interface WatcherProps {
  territory: number;
  size: number;
  isFreshWin?: boolean;
}

export default function Watcher({ territory, size, isFreshWin }: WatcherProps) {
  const src = WATCHER_SVGS[territory] ?? WATCHER_SVGS[0];
  const pulseAnim = `watcher-glow`;
  const pulseTime = [2.1,1.8,2.4,2.0,1.9,2.3,2.6,2.2,1.7,2.5][territory] ?? 2.0;

  // Glow plays once when the Watcher mounts (fresh placement, or reload of a solved cell)
  // then settles — an infinite per-Watcher filter/drop-shadow animation is expensive to
  // repaint and doesn't scale once several Watchers are on the board at once on mobile.
  // The static filter here matches the animation's rest frame so there's no jump when it ends.
  const animation = isFreshWin
    ? `${pulseAnim} ${pulseTime}s ease-in-out 1, watcher-rise-slam 2.2s linear 200ms both`
    : `${pulseAnim} ${pulseTime}s ease-in-out 1`;

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt="Watcher"
      draggable={false}
      style={{
        animation,
        transform: 'translateY(-4px)',
        filter: 'brightness(1.0) saturate(1.0) drop-shadow(3px 6px 4px rgba(0,0,0,0.95)) drop-shadow(1px 2px 2px rgba(0,0,0,0.75))',
      }}
    />
  );
}
