if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').then(
      function (registration) {
        console.log('[Service Worker] registered successfully with scope:', registration.scope);

        // Once the SW is active, tell it to prefetch offline chunks
        if (registration.active) {
          registration.active.postMessage('PREFETCH_OFFLINE');
        }

        // Also listen for the new SW becoming active (first install or update)
        registration.addEventListener('updatefound', function () {
          var newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', function () {
              if (newWorker.state === 'activated') {
                newWorker.postMessage('PREFETCH_OFFLINE');
              }
            });
          }
        });
      },
      function (err) {
        console.error('[Service Worker] registration failed:', err);
      }
    );
  });
}
