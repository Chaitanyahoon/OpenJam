const CACHE_NAME = 'openjam-pwa-v2';

// Core assets to cache immediately on SW install
const PRECACHE_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/static/img/logo.png',
  '/static/img/icon-192.png',
  '/static/img/icon-512.png',
  '/static/img/cover-banner.webp'
];

// Install event: cache initial shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Pre-caching offline shell');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event: clean up legacy caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Clearing legacy cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: serve cached static shell or fetch dynamically
self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Define pathways to strictly bypass (do NOT cache socket connections, audio stream chunks, search, or auth redirects)
  const bypassPrefixes = [
    '/socket.io',
    '/stream',
    '/search',
    '/auth',
    '/rooms',
    '/queue',
    '/admin',
    '/ping',
    '/health'
  ];

  const shouldBypass = bypassPrefixes.some(prefix => url.pathname.startsWith(prefix));

  if (shouldBypass) {
    return;
  }

  // Network-First for main pages and document navigation (ensures online updates render instantly)
  const isNav = event.request.mode === 'navigate' || url.pathname === '/';
  if (isNav) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || caches.match('/offline');
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version immediately
        return cachedResponse;
      }

      // Fallback to network fetch
      return fetch(event.request).then((response) => {
        // Only cache valid GET responses that are static assets (Next.js chunks, public images, icons, manifest)
        const isStaticAsset = 
          response.status === 200 &&
          (url.pathname.startsWith('/_next/static/') ||
           url.pathname.startsWith('/static/') ||
           url.pathname === '/manifest.json');

        if (isStaticAsset) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }

        return response;
      }).catch((err) => {
        // Offline fallback for page navigation requests (return the root index page cache)
        if (event.request.mode === 'navigate') {
          console.log('[Service Worker] Offline fallback triggered for navigation:', url.pathname);
          return caches.match('/offline');
        }
        throw err;
      });
    })
  );
});
