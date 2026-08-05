// Scripts for imported Firebase SDKs
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js");

// Initialize the Firebase app inside the service worker
// Environment placeholders will be replaced by your Firebase config values
firebase.initializeApp({
  apiKey: "placeholder-api-key",
  authDomain: "tas-erp.firebaseapp.com",
  projectId: "tas-erp",
  storageBucket: "tas-erp.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:placeholderapphash",
});

const messaging = firebase.messaging();

// Handle background push messages (when app/tab is closed or screen is locked)
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Received background lock-screen push message:", payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || "TAS ERP Notification";
  const targetUrl = payload.data?.url || payload.data?.link_url || "/";

  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || "New update in workspace.",
    icon: payload.notification?.icon || "/icons/icon-192x192.png",
    badge: "/favicon.ico",
    tag: payload.data?.tag || "tas-erp-lockscreen-alert",
    renotify: true,
    requireInteraction: true, // Keeps notification visible on lock screen until user interacts
    vibrate: [200, 100, 200, 100, 200], // Haptic pulse pattern for locked devices
    data: {
      url: targetUrl,
      timestamp: Date.now(),
    },
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click event (Open or focus PWA window)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // If a tab is already open, focus it and navigate
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          return client.navigate(urlToOpen);
        }
      }
      // If no tab is open, open a new window/PWA frame
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
