/* App-shell cache only. Audio files, downloaded models and transcripts are never sent or cached by this service worker. */
const CACHE = 'whisper-private-pwa-shell-__APP_VERSION__';
const SHELL = ['/', '/index.html', '/app.css', '/manifest.webmanifest', '/icons/icon.svg',
  '/src/main.js', '/src/audio.js', '/src/engine.js', '/src/model-cache.js',
  '/src/models.js', '/src/transcript.js', '/src/history.js'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/runtime/')) {
    event.respondWith(caches.open(CACHE).then(async cache => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    }));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
