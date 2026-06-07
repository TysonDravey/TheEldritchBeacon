const CACHE = 'eldritch-beacon-v1';

const PRECACHE = [
  '/',
  '/manifest.json',
  '/Lovecraftimus.otf',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests; skip PostHog ingest and API routes
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/ingest')) return;
  if (url.pathname.startsWith('/api')) return;

  // Cache-first for static assets (tiles, images, fonts, SVGs)
  if (
    url.pathname.startsWith('/tiles/') ||
    url.pathname.startsWith('/svg/') ||
    url.pathname.startsWith('/buttons/') ||
    url.pathname.startsWith('/scrolls/') ||
    url.pathname.startsWith('/boards/') ||
    url.pathname.startsWith('/titleCards/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.otf')
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Network-first for HTML/JS (app shell stays fresh)
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
