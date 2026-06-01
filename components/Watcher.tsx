'use client';

import { WATCHER_SVGS } from '@/theme/colors';

interface WatcherProps {
  territory: number;
  size: number;
}

export default function Watcher({ territory, size }: WatcherProps) {
  const src = WATCHER_SVGS[territory] ?? WATCHER_SVGS[0];
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt="Watcher"
      draggable={false}
    />
  );
}
