import type { Metadata } from 'next';
import { Caveat } from 'next/font/google';
import './globals.css';
import Backdrop from '@/components/Backdrop';
import RegisterSW from '@/components/RegisterSW';

const caveat = Caveat({ subsets: ['latin'], variable: '--font-caveat' });

export const metadata: Metadata = {
  title: 'The Eldritch Beacon',
  description: 'A Puzzle of Watchers and Wards',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Eldritch Beacon',
    statusBarStyle: 'black-translucent',
  },
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
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no, maximum-scale=1" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
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
      <body className={`${caveat.variable} text-ink font-serif min-h-screen`}>
        <RegisterSW />
        <Backdrop />
        {children}
      </body>
    </html>
  );
}
