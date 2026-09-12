self.addEventListener('install', (e) => {
  self.skipWaiting();
  console.log('[Service Worker] Installed');
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
  console.log('[Service Worker] Activated');
});

self.addEventListener('fetch', (e) => {
  // This simple pass-through satisfies Chrome's PWA requirement perfectly
  e.respondWith(fetch(e.request).catch(() => new Response("Network error")));
});
