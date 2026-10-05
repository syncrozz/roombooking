/**
 * KPMBP SmartHub Service Worker
 * Provides offline shell caching and PWA installation capability.
 */

const CACHE_NAME = 'kpmbp-smarthub-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass non-GET requests, Firebase, chrome extensions and dev server websockets
  if (
    event.request.method !== 'GET' ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.pathname.startsWith('/api') ||
    url.protocol === 'chrome-extension:'
  ) {
    return;
  }

  // Network-first strategy with cache fallback for navigation and static shell
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache successful responses for same-origin or static assets
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (url.origin === location.origin || url.hostname.includes('fonts.gstatic.com'))
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch(() => {});
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html') || caches.match('/');
        }
        return new Response('Luar talian / Offline', { status: 503, statusText: 'Service Unavailable' });
      })
  );
});
