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
      </head>
      <body className="text-ink font-serif min-h-screen">
        <Backdrop />
        {children}
      </body>
    </html>
  );
}
