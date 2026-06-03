import type { Metadata } from 'next';
import './globals.css';
import Backdrop from '@/components/Backdrop';

export const metadata: Metadata = {
  title: 'The Eldritch Beacon',
  description: 'A Puzzle of Watchers and Wards',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-parchment text-ink font-serif min-h-screen">
        <Backdrop />
        {children}
      </body>
    </html>
  );
}
