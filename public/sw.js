const CACHE_NAME = "tas-erp-pwa-v2";
const STATIC_ASSETS = [
  "/manifest.json",
  "/favicon.ico",
];

// Always activate immediately on new deployment
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Delete old cache versions upon activation
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // Network-First for API routes, Next.js internal routes (_next), and HTML navigation
  const isApi = url.pathname.startsWith("/api/");
  const isNextInternal = url.pathname.startsWith("/_next/");
  const isNavigation = event.request.mode === "navigate";

  if (isApi || isNextInternal || isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return networkResponse;
        })
        .catch(() => {
          // If network fails (offline), attempt cache fallback
          return caches.match(event.request);
        })
    );
    return;
  }

  // Network-First for static assets to avoid stale bundle issues
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
