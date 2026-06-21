const CACHE_NAME = 'openjam-pwa-v3';

// Core assets to cache immediately on SW install
const PRECACHE_ASSETS = [
  '/offline',
  '/manifest.json',
  '/static/img/logo.png',
  '/static/img/icon-192.png',
  '/static/img/icon-512.png',
  '/static/img/cover-banner.webp',
  '/static/img/default_art.png'
];

// Install event: cache initial shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching offline shell');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event: clean up legacy caches and prefetch /offline chunks
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Clearing legacy cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => self.clients.claim())
    .then(() => prefetchOfflineChunks())
  );
});

/**
 * Prefetch the /offline page and recursively cache all JS/CSS chunks it needs.
 * This ensures the offline page works without any network.
 */
async function prefetchOfflineChunks() {
  try {
    const cache = await caches.open(CACHE_NAME);

    // Fetch the /offline HTML page (network, then cache it)
    const offlineResponse = await fetch('/offline');
    if (offlineResponse.ok) {
      await cache.put(new Request('/offline'), offlineResponse.clone());

      // Parse the HTML to find all linked JS/CSS resources
      const html = await offlineResponse.text();
      const resourceUrls = [];

      // Match script src and link href for Next.js chunks
      const scriptMatches = html.matchAll(/src="(\/_next\/static\/[^"]+)"/g);
      for (const match of scriptMatches) {
        resourceUrls.push(match[1]);
      }
      const linkMatches = html.matchAll(/href="(\/_next\/static\/[^"]+)"/g);
      for (const match of linkMatches) {
        resourceUrls.push(match[1]);
      }

      // Also fetch the homepage to cache its critical chunks
      try {
        const homeResponse = await fetch('/');
        if (homeResponse.ok) {
          await cache.put(new Request('/'), homeResponse.clone());
          const homeHtml = await homeResponse.text();
          const homeScripts = homeHtml.matchAll(/src="(\/_next\/static\/[^"]+)"/g);
          for (const match of homeScripts) {
            resourceUrls.push(match[1]);
          }
          const homeLinks = homeHtml.matchAll(/href="(\/_next\/static\/[^"]+)"/g);
          for (const match of homeLinks) {
            resourceUrls.push(match[1]);
          }
        }
      } catch (e) {
        // Homepage prefetch is best-effort
      }

      // Deduplicate
      const unique = [...new Set(resourceUrls)];

      // Fetch and cache each chunk
      const fetchPromises = unique.map(async (url) => {
        try {
          const existing = await cache.match(url);
          if (!existing) {
            const resp = await fetch(url);
            if (resp.ok) {
              await cache.put(new Request(url), resp);
            }
          }
        } catch (e) {
          // Individual chunk failures are non-fatal
        }
      });

      await Promise.allSettled(fetchPromises);
      console.log(`[PWA] Prefetched ${unique.length} /offline chunks for seamless offline access.`);
    }
  } catch (err) {
    console.warn('[SW] Offline prefetch failed (non-fatal):', err.message);
  }
}

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data === 'PREFETCH_OFFLINE') {
    prefetchOfflineChunks();
  }
});

// Fetch event: serve cached static shell or fetch dynamically
self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Bypass API routes, socket connections, and audio streams entirely
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

  // Only bypass for same-origin API paths
  if (url.origin === self.location.origin) {
    const shouldBypass = bypassPrefixes.some(prefix => url.pathname.startsWith(prefix));
    if (shouldBypass) {
      return;
    }
  }

  // --- Strategy 1: Next.js static chunks & public static assets -> Cache-First ---
  const isNextStatic = url.pathname.startsWith('/_next/static/');
  const isPublicStatic = url.pathname.startsWith('/static/');
  const isGoogleFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

  if (isNextStatic || isPublicStatic || isGoogleFont) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => {
          // For JS/CSS chunks that fail offline, return empty response to prevent hard crash
          if (url.pathname.endsWith('.js')) {
            return new Response('// offline chunk unavailable', {
              status: 200,
              headers: { 'Content-Type': 'application/javascript' }
            });
          }
          if (url.pathname.endsWith('.css')) {
            return new Response('/* offline */', {
              status: 200,
              headers: { 'Content-Type': 'text/css' }
            });
          }
          return new Response('', { status: 503 });
        });
      })
    );
    return;
  }

  // --- Strategy 2: Page navigations -> Network-First, fallback to cache, then /offline ---
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Try to serve the exact cached page first
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            // Fallback to the offline page
            return caches.match('/offline');
          });
        })
    );
    return;
  }

  // --- Strategy 3: Everything else -> Cache-First with network fallback ---
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cache manifest and font files
        if (response.ok && (url.pathname === '/manifest.json' || url.pathname.endsWith('.woff2') || url.pathname.endsWith('.woff'))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        return new Response('', { status: 503 });
      });
    })
  );
});
