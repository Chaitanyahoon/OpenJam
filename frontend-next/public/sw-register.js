if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').then(
      function (registration) {
        console.log('[Service Worker] registered successfully with scope:', registration.scope);
      },
      function (err) {
        console.error('[Service Worker] registration failed:', err);
      }
    );
  });
}
