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

  // Fresh win: all watchers rise together (no stagger), slam, then resume glow pulse.
  // Reload of already-complete puzzle: just the ambient glow pulse.
  const animation = isFreshWin
    ? `${pulseAnim} ${pulseTime}s ease-in-out infinite, watcher-rise-slam 2.2s linear 200ms both`
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
        transform: 'translateY(-4px)',
      }}
    />
  );
}
