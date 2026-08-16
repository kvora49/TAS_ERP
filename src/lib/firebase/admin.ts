import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getMessaging, Message } from "firebase-admin/messaging";

function parseServiceAccountKey(keyRaw: string | Record<string, any>): Record<string, any> | null {
  if (!keyRaw) return null;
  if (typeof keyRaw === "object") return keyRaw;

  let cleaned = keyRaw.trim();
  if ((cleaned.startsWith("'") && cleaned.endsWith("'")) || (cleaned.startsWith('"') && cleaned.endsWith('"'))) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Sanitize invalid escape sequences (like \+ or extra backslashes)
  cleaned = cleaned.replace(/\\([^+/bfnrtu"\\])/g, "$1").replace(/\\\+/g, "+");

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed.private_key === "string") {
      // Ensure private_key has actual newlines
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  } catch (err: any) {
    console.error("[Firebase Admin] Failed to parse FIREBASE_ADMIN_SDK_KEY:", err.message);
    return null;
  }
}

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  const serviceAccountKey = process.env.FIREBASE_ADMIN_SDK_KEY;

  if (!serviceAccountKey || serviceAccountKey.includes("placeholder")) {
    console.warn("[Firebase Admin] FIREBASE_ADMIN_SDK_KEY is missing or placeholder in environment variables.");
    return null;
  }

  try {
    const serviceAccount = parseServiceAccountKey(serviceAccountKey);
    if (!serviceAccount || !serviceAccount.project_id || !serviceAccount.private_key) {
      console.warn("[Firebase Admin] Service account object is incomplete or invalid.");
      return null;
    }

    return initializeApp({
      credential: cert(serviceAccount),
    });
  } catch (err: any) {
    console.error("[Firebase Admin] Failed to initialize Firebase Admin SDK:", err.message);
    return null;
  }
}

export interface LockScreenPushPayload {
  token: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  data?: Record<string, string>;
}

/**
 * Sends a high-priority push notification optimized for PWA lock screens and background wake-up.
 */
export async function sendLockScreenPushNotification(payload: LockScreenPushPayload) {
  const app = getAdminApp();

  if (!app) {
    return {
      success: false,
      error: "Firebase Admin SDK is not configured. Check FIREBASE_ADMIN_SDK_KEY in .env.local",
    };
  }

  try {
    const message: Message = {
      token: payload.token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        url: payload.url || "/",
        tag: payload.tag || "tas-erp-alert",
        ...payload.data,
      },
      webpush: {
        headers: {
          Urgency: "high", // Forces immediate delivery & lock screen wake-up
        },
        notification: {
          requireInteraction: true, // Keeps visible on lock screen until swiped/clicked
          vibrate: [200, 100, 200, 100, 200],
          icon: "/icons/icon-192x192.png",
          badge: "/favicon.ico",
        },
        fcmOptions: {
          link: payload.url || "/",
        },
      },
      android: {
        priority: "high",
        notification: {
          visibility: "public", // Forces visible on Android Lock Screen
          priority: "high",
          sound: "default",
        },
      },
    };

    const messaging = getMessaging(app);
    const response = await messaging.send(message);
    console.log("[Firebase Admin] Push notification sent successfully:", response);
    return { success: true, messageId: response };
  } catch (error: any) {
    console.error("[Firebase Admin] Error sending push notification:", error);
    return { success: false, error: error.message || "Failed to send push notification" };
  }
}
