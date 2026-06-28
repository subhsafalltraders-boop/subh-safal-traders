const CACHE_NAME = 'sst-billing-v2';
const urlsToCache = [
  '/dashboard',
  '/billing',
  '/payments',
  '/settlements',
  '/vendors',
  '/products',
  '/reports'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Never cache-intercept navigation requests (HTML pages) — let the server/middleware handle redirects
  if (event.request.mode === 'navigate') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;
      return fetch(event.request);
    })
  );
});
