const CACHE_NAME = "tas-erp-pwa-v8";
const MAX_CACHE_ITEMS = 60;
const STATIC_ASSETS = [
  "/manifest.json",
  "/favicon.ico",
  "/logo.png",
  "/offline",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

/**
 * LRU Cache Eviction Helper
 * Ensures service worker cache doesn't exceed maximum storage limits on mobile devices
 */
async function limitCacheSize(cacheName, maxItems = MAX_CACHE_ITEMS) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      await cache.delete(keys[0]);
      await limitCacheSize(cacheName, maxItems);
    }
  } catch (_e) {
    // Ignore cache eviction errors silently
  }
}

// 1. Install & Activate Lifecycle
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// 1b. Activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== "tas-erp-fonts") {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 2. Fetch Handler
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET") return;

  // Google Fonts caching (Cache-First for instant offline typography)
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open("tas-erp-fonts").then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Next.js static immutable chunks & assets (Cache First for ultra-fast instant transitions)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  const isApi = url.pathname.startsWith("/api/");
  const isNextData = url.pathname.startsWith("/_next/data/");
  const isNavigation = event.request.mode === "navigate";

  // Navigation requests: Network-first with offline fallback page
  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
              limitCacheSize(CACHE_NAME, MAX_CACHE_ITEMS);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          const fallback = await caches.match("/offline");
          if (fallback) return fallback;
          return new Response("Offline", { status: 503, headers: { "Content-Type": "text/html" } });
        })
    );
    return;
  }

  if (isApi || isNextData) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => networkResponse)
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
            limitCacheSize(CACHE_NAME, MAX_CACHE_ITEMS);
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});

// 3. Web Push Handler (Optimized for Mobile Lock Screen & Cross-Browser)
self.addEventListener("push", function (event) {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (_e) {
      data = { title: "TAS ERP Notification", body: event.data.text() };
    }
  }

  const title = data.title || data.notification?.title || "TAS ERP Alert";
  const body = data.body || data.message || data.notification?.body || "You have a new update in your workspace.";
  const url = data.url || data.link_url || data.data?.url || "/";

  const options = {
    body: body,
    icon: data.icon || "/icons/icon-192x192.png",
    badge: "/favicon.ico",
    tag: data.tag || "tas-erp-system-alert",
    renotify: true,
    requireInteraction: true, // Keeps notification visible on Mobile Lock Screen
    vibrate: [200, 100, 200, 100, 200], // Haptic vibration pulse for locked mobile devices
    data: {
      url: url,
      timestamp: Date.now(),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 4. Notification Click Handler (Open/Focus PWA App Window)
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      // If PWA tab/window is already open, focus it and navigate
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          if ("navigate" in client) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      // If no window open, launch PWA
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// 5. Background Sync (Offline Queue Synchronization)
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-offline-mutations") {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: "SYNC_OFFLINE_MUTATIONS" });
        });
      })
    );
  }
});
