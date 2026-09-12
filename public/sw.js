self.addEventListener('install', (e) => {
  console.log('[Service Worker] Installed');
});

self.addEventListener('fetch', (e) => {
  // Chrome requires this fetch handler to allow the app to be installed
});
