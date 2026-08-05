import { useEffect, useState } from "react";
import { requestFCMToken } from "@/lib/firebase/client";

export function useNotifications() {
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/firebase-messaging-sw.js")
        .then(async (reg) => {
          console.log("[FCM] Service Worker registered with scope:", reg.scope);
          if (Notification.permission === "granted") {
            const token = await requestFCMToken();
            if (token) setFcmToken(token);
          }
        })
        .catch((err) => {
          console.error("[FCM] Service Worker registration failed:", err);
        });
    }
  }, []);

  return { fcmToken };
}
