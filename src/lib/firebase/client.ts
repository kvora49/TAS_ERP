import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function getFirebaseApp() {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(firebaseConfig);
}

/**
 * Requests and returns the unique FCM push token for this browser device.
 * Requires service worker to be registered and VAPID key configured.
 */
export async function requestFCMToken() {
  if (typeof window === "undefined") return null;

  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn("[FCM Client] Firebase Messaging is not supported in this browser.");
      return null;
    }

    const app = getFirebaseApp();
    const messaging = getMessaging(app);

    const registration = await navigator.serviceWorker.ready;
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

    if (!vapidKey || vapidKey.includes("placeholder")) {
      console.warn("[FCM Client] NEXT_PUBLIC_FIREBASE_VAPID_KEY is missing or placeholder.");
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      console.log("[FCM Client] FCM Device Token obtained:", token);
      return token;
    } else {
      console.warn("[FCM Client] No registration token available. Request permission to generate one.");
      return null;
    }
  } catch (err) {
    console.error("[FCM Client] Error retrieving FCM token:", err);
    return null;
  }
}
