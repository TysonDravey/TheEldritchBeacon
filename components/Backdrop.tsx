'use client';

import { usePathname } from 'next/navigation';

const BACKDROPS = [
  '/boards/sampleBoard_06.png',
  '/boards/sampleBoard_07.png',
  '/boards/sampleBoard_08.png',
  '/boards/sampleBoard_09.png',
  '/boards/sampleBoard_10.png',
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
        inset: 0,
        backgroundImage: `url(${url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        zIndex: -1,
      }}
    />
  );
}
