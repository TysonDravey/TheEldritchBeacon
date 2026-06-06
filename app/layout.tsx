import type { Metadata } from 'next';
import './globals.css';
import Backdrop from '@/components/Backdrop';

export const metadata: Metadata = {
  title: 'The Eldritch Beacon',
  description: 'A Puzzle of Watchers and Wards',
};

const TILE_COUNT = 10;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {Array.from({ length: TILE_COUNT }, (_, i) => (
          <link
            key={i}
            rel="preload"
            as="image"
            href={`/tiles/processed/plain_tile_${String(i + 1).padStart(2, '0')}.png`}
          />
        ))}
        {[1, 2, 3].map(i => (
          <link key={`scroll-${i}`} rel="preload" as="image" href={`/scrolls/scroll_0${i}.png`} />
        ))}
        {[6, 7, 8, 9, 10].map(i => (
          <link key={`bg-${i}`} rel="preload" as="image" href={`/boards/sampleBoard_${String(i).padStart(2, '0')}.png`} />
        ))}
      </head>
      <body className="text-ink font-serif min-h-screen">
        <Backdrop />
        {children}
      </body>
    </html>
  );
}
