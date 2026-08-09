const CACHE_NAME = "tas-erp-pwa-v4";
const STATIC_ASSETS = [
  "/manifest.json",
  "/favicon.ico",
  "/logo.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// 1. Install & Activate Lifecycle
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

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

// 2. Fetch Handler (Network First for API & Navigation)
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET") return;

  const isApi = url.pathname.startsWith("/api/");
  const isNextInternal = url.pathname.startsWith("/_next/");
  const isNavigation = event.request.mode === "navigate";

  if (isApi || isNextInternal || isNavigation) {
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
