'use client';

import { useEffect } from 'react';

export default function RegisterSW() {
  useEffect(() => {
    // Temporary, left in on purpose: see components/StartupProbe.tsx for why.
    // eslint-disable-next-line no-console
    console.log(`[startup] registersw-effect @ ${performance.now().toFixed(0)}ms`);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(
        () => console.log(`[startup] registersw-resolved @ ${performance.now().toFixed(0)}ms`), // eslint-disable-line no-console
        () => console.log(`[startup] registersw-rejected @ ${performance.now().toFixed(0)}ms`), // eslint-disable-line no-console
      );
    } else {
      // eslint-disable-next-line no-console
      console.log(`[startup] registersw-unsupported @ ${performance.now().toFixed(0)}ms`);
    }
  }, []);
  return null;
}
