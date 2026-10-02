import type { Metadata } from 'next';
import { Caveat } from 'next/font/google';
import './globals.css';
import Backdrop from '@/components/Backdrop';
import RegisterSW from '@/components/RegisterSW';
import BuildBadge from '@/components/BuildBadge';
import BackgroundMusic from '@/components/BackgroundMusic';
import StartupProbe from '@/components/StartupProbe';

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
        {/* Temporary, left in on purpose: an inline script runs the instant the
            HTML parser reaches it — before the JS bundle even loads, let alone
            hydrates — to mark true document-parse-start for the cold-launch
            timing investigation in StartupProbe. */}
        <script dangerouslySetInnerHTML={{ __html: `window.__startupT0 = performance.now();console.log('[startup] html-parse-start @ ' + window.__startupT0.toFixed(0) + 'ms');` }} />
      </head>
      <body className={`${caveat.variable} text-ink font-serif min-h-screen`}>
        <StartupProbe />
        <RegisterSW />
        <BuildBadge />
        <Backdrop />
        <BackgroundMusic />
        {children}
      </body>
    </html>
  );
}
