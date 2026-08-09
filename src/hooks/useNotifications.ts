import { useEffect, useState } from "react";
import { requestFCMToken } from "@/lib/firebase/client";

export function useNotifications() {
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(async (reg) => {
          if (Notification.permission === "granted") {
            const token = await requestFCMToken();
            if (token) setFcmToken(token);
          }
        })
        .catch(() => {});
    }
  }, []);

  return { fcmToken };
}

