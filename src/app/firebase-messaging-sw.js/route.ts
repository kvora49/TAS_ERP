import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "placeholder-api-key";
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "tas-erp.firebaseapp.com";
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "tas-erp";
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "tas-erp.appspot.com";
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789012";
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789012:web:placeholderapphash";

  const swContent = `// Dynamic Firebase Messaging Service Worker
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "${apiKey}",
  authDomain: "${authDomain}",
  projectId: "${projectId}",
  storageBucket: "${storageBucket}",
  messagingSenderId: "${messagingSenderId}",
  appId: "${appId}"
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
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
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
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          return client.navigate(urlToOpen);
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
`;

  return new NextResponse(swContent, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
