import { useEffect } from "react";

export function useNotifications() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/firebase-messaging-sw.js")
        .then((reg) => {
          console.log("FCM Service Worker registered with scope:", reg.scope);
        })
        .catch((err) => {
          console.error("FCM Service Worker registration failed:", err);
        });
    }
  }, []);
}
