/* Jyoti service worker — build __BUILD_ID__ */
const BUILD = '__BUILD_ID__';
const SHELL_CACHE = `jyoti-shell-${BUILD}`;
const MEDIA_CACHE = 'jyoti-media-v1';
const MEDIA_LIMIT = 240;

const SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.webmanifest',
  '/icons/lamp.png',
  '/icons/icon-192.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith('jyoti-shell-') && key !== SHELL_CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

async function trimMediaCache() {
  const cache = await caches.open(MEDIA_CACHE);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MEDIA_LIMIT; i++) await cache.delete(keys[i]);
}

/** Photos are immutable once posted, so serve them from cache first. */
async function media(request) {
  const cache = await caches.open(MEDIA_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.status === 200) {
    await cache.put(request, response.clone());
    trimMediaCache();
  }
  return response;
}

async function networkFirst(request, fallbackPath) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(fallbackPath, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(fallbackPath);
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Never cache API traffic — the reveal gate and day number must stay live.
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, '/index.html'));
    return;
  }
  if (url.origin !== self.location.origin) {
    if (request.destination === 'image') event.respondWith(media(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});

