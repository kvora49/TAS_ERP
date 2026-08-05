"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { requestFCMToken } from "@/lib/firebase/client";

export function usePWAWebPush() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator) {
      setIsSupported(true);
      setPermission(Notification.permission);

      if (Notification.permission === "granted") {
        requestFCMToken().then((token) => {
          if (token) setFcmToken(token);
        });
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

    if (!tokenToUse) {
      toast.error("FCM Token unavailable. Verify Firebase environment configuration in .env.local");
      return false;
    }

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
