const CACHE_NAME = 'lan-tracker-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/render.js',
  '/api.js',
  '/chart.min.js'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Forzar activación inmediata
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim()); // Tomar control de inmediato
});

self.addEventListener('fetch', event => {
  // Solo cachear archivos estáticos conocidos
  if (ASSETS.some(asset => event.request.url.includes(asset))) {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request);
      })
    );
  } else {
    event.respondWith(fetch(event.request));
  }
});
