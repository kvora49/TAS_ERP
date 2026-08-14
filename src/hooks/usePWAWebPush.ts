"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { requestFCMToken } from "@/lib/firebase/client";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePWAWebPush() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  const registerAndSavePushSubscription = async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }

    try {
      // 1. Re-use active main Service Worker if present, or register dynamic Firebase Messaging SW
      let registration = await navigator.serviceWorker.getRegistration("/").catch(() => null);
      if (!registration) {
        registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js").catch((err) => {
          console.warn("[PWA Push] Failed to register firebase-messaging-sw.js:", err);
          return null;
        });
      }
      if (!registration) {
        registration = await navigator.serviceWorker.ready;
      }
      if (!registration) return;

      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

      if (vapidKey && !vapidKey.includes("placeholder")) {
        const existingSub = await registration.pushManager.getSubscription();
        let subscription = existingSub;

        if (!subscription) {
          const convertedVapidKey = urlBase64ToUint8Array(vapidKey);
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey,
          });
        }

        if (subscription) {
          const subJson = subscription.toJSON();
          if (subJson.endpoint && subJson.keys) {
            await fetch("/api/notifications/push-subscription", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ subscription: subJson }),
            }).catch((e) => console.warn("[PWA Push] Error saving push subscription:", e));
          }
        }
      }
    } catch (err) {
      console.warn("[PWA Push] Subscription error:", err);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator) {
      setIsSupported(true);
      setPermission(Notification.permission);

      if (Notification.permission === "granted") {
        requestFCMToken().then((token) => {
          if (token) setFcmToken(token);
        });
        registerAndSavePushSubscription();
      }
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (!isSupported) {
      toast.error("Web push notifications are not supported on this browser/device.");
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        toast.success("Mobile PWA Notifications enabled!");
        const token = await requestFCMToken();
        if (token) setFcmToken(token);
        await registerAndSavePushSubscription();
        return true;
      } else {
        toast.error("Notification permission was denied.");
        return false;
      }
    } catch (err) {
      console.error("Error requesting notification permission:", err);
      return false;
    }
  };

  const triggerLocalMobilePush = (title: string, options?: NotificationOptions & { link_url?: string }) => {
    if (typeof window === "undefined" || Notification.permission !== "granted") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          body: options?.body || "",
          icon: "/icons/icon-192x192.png",
          badge: "/favicon.ico",
          data: { url: options?.link_url || "/" },
          requireInteraction: true,
          vibrate: [200, 100, 200, 100, 200],
          ...options,
        } as any);
      });
    } else {
      new Notification(title, options);
    }
  };

  const sendTestLockScreenPush = async (title?: string, body?: string) => {
    let tokenToUse = fcmToken;
    if (!tokenToUse) {
      tokenToUse = await requestFCMToken();
    }

    // Always attempt to save push subscription before sending test push
    await registerAndSavePushSubscription();

    try {
      const res = await fetch("/api/notifications/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: tokenToUse,
          title: title || "⚠️ Low Stock Alert",
          body: body || "Item #1042 reached reorder level. Tap to view inventory.",
          url: "/inventory",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send push notification");

      toast.success("Lock screen push notification sent to device!");
      return true;
    } catch (err: any) {
      console.error("[Test Lock Screen Push Error]:", err);
      toast.error(err.message || "Failed to trigger server push notification");
      return false;
    }
  };

  return {
    permission,
    isSupported,
    fcmToken,
    requestNotificationPermission,
    triggerLocalMobilePush,
    sendTestLockScreenPush,
  };
}

