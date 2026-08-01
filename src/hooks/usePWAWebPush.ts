"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

export function usePWAWebPush() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator) {
      setIsSupported(true);
      setPermission(Notification.permission);
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
          badge: "/icons/badge-72x72.png",
          data: { url: options?.link_url || "/" },
          vibrate: [100, 50, 100],
          ...options,
        } as any);
      });
    } else {
      new Notification(title, options);
    }
  };

  return {
    permission,
    isSupported,
    requestNotificationPermission,
    triggerLocalMobilePush,
  };
}
