// Scripts for imported Firebase SDKs
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js");

// Initialize the Firebase app inside the service worker
// Note: These credentials will be parsed by Firebase SDK directly
firebase.initializeApp({
  apiKey: "placeholder-api-key",
  authDomain: "tas-erp.firebaseapp.com",
  projectId: "tas-erp",
  storageBucket: "tas-erp.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:placeholderapphash",
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Received background message ", payload);
  
  const notificationTitle = payload.notification?.title || "TAS ERP Notification";
  const notificationOptions = {
    body: payload.notification?.body || "New update in workspace.",
    icon: "/icons/icon-192x192.png", // fallback placeholder icon
    badge: "/favicon.ico",
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
