const CACHE_NAME = 'sst-billing-v1';
const urlsToCache = [
  '/',
  '/dashboard',
  '/billing',
  '/payments',
  '/settlements',
  '/vendors',
  '/products',
  '/reports'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;
      return fetch(event.request);
    })
  );
});
