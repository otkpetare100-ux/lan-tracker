const CACHE_NAME = 'lan-tracker-v4';
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
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Ignorar peticiones de extensiones de Chrome o esquemas no soportados
  if (!event.request.url.startsWith('http')) return;

  // Estrategia: Network First para archivos HTML/JS críticos
  if (event.request.mode === 'navigate' || ASSETS.some(asset => event.request.url.includes(asset))) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(fetch(event.request));
  }
});
