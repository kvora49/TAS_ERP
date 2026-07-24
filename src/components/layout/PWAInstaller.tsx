"use client";

import React, { useEffect, useState } from "react";
import { Download, WifiOff, X } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export default function PWAInstaller() {
  const isOnline = useOnlineStatus();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Register Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      const dismissed = localStorage.getItem("tas-erp-pwa-dismissed");
      if (!dismissed) {
        setDeferredPrompt(e);
        setShowPrompt(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("tas-erp-pwa-dismissed", "true");
  };

  return (
    <>
      {/* Offline Status Bar */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-600 text-white text-xs font-bold px-4 py-2 flex items-center justify-between shadow-md select-none">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4" />
            <span>You are currently offline. Viewing cached local data.</span>
          </div>
        </div>
      )}

      {/* PWA Install Banner */}
      {showPrompt && isOnline && (
        <div className="fixed bottom-20 md:bottom-6 right-6 z-50 bg-[var(--card-bg)] border border-[var(--primary)] rounded-xl p-4 shadow-xl max-w-sm flex items-center gap-3 select-none">
          <div className="p-2.5 rounded-lg bg-[var(--primary-light)] text-[var(--primary)]">
            <Download className="w-5 h-5" />
          </div>
          <div className="flex-1 text-xs">
            <h4 className="font-bold text-[var(--text-primary)]">Install TAS ERP App</h4>
            <p className="text-[var(--text-muted)] text-[11px] mt-0.5">
              Add to Home Screen for fast mobile access & offline scan
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleInstallClick}
              className="px-3 py-1.5 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-bold shadow-xs cursor-pointer"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
