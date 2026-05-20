const CACHE_NAME = 'openjam-static-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/static/css/style.css',
  '/static/js/socket-client.js',
  '/static/js/lyrics.js',
  '/static/js/youtube-player.js',
  '/static/js/socket.io.min.js',
  '/static/js/gsap.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[openjam SW] Pre-caching static assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[openjam SW] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only cache GET requests, avoid caching socket.io polling or API routes or /stream/
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || 
      url.pathname.startsWith('/socket.io') || 
      url.pathname.startsWith('/auth') || 
      url.pathname.startsWith('/rooms') || 
      url.pathname.startsWith('/stream')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache (Stale-While-Revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => { /* Ignore background fetch failures */ });
        return cachedResponse;
      }
      
      return fetch(event.request).then((networkResponse) => {
        // Cache newly requested static resources on the fly
        if (networkResponse && networkResponse.status === 200 && 
            (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.png') || url.pathname.endsWith('.svg') || url.pathname.includes('/fonts/'))) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});
