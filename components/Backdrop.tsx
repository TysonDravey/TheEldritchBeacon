'use client';

import { usePathname } from 'next/navigation';

const BACKDROPS = [
  '/tiles/processed/BG_parchment_01.png',
  '/tiles/processed/BG_parchment_02.png',
  '/tiles/processed/BG_parchment_03.png',
  '/tiles/processed/BG_parchment_04.png',
  '/tiles/processed/BG_parchment_05.png',
  '/tiles/processed/BG_parchment_06.png',
  '/tiles/processed/BG_parchment_07.png',
  '/tiles/processed/BG_parchment_08.png',
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Fixed parchment background. Picks deterministically per path so each
 * page (home, tutorial, each puzzle) gets a stable parchment but the
 * site has visible variety across pages.
 */
export default function Backdrop() {
  const pathname = usePathname() ?? '/';
  const url = BACKDROPS[hash(pathname) % BACKDROPS.length];
  return (
    <div
      aria-hidden
      className="fixed pointer-events-none bg-parchment"
      style={{
        inset: '-30%',
        backgroundImage: `url(${url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        zIndex: -1,
        transform: 'perspective(2400px) rotateX(18deg)',
        transformOrigin: '50% 50%',
      }}
    />
  );
}
