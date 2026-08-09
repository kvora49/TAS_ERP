// Deprecated: sw-push.js has been unified into /sw.js
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    self.registration.unregister().then(() => self.clients.claim())
  );
});

