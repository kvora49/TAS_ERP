"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { WifiOff, RefreshCw, ArrowLeft, QrCode, Home } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

export default function OfflinePage() {
  const [isChecking, setIsChecking] = useState(false);
  const [onlineNow, setOnlineNow] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setOnlineNow(true);
      triggerHaptic("success");
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  const handleRetry = () => {
    triggerHaptic("impactMedium");
    setIsChecking(true);
    setTimeout(() => {
      if (typeof window !== "undefined" && navigator.onLine) {
        window.location.reload();
      } else {
        setIsChecking(false);
        triggerHaptic("warning");
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[var(--page-bg)] flex items-center justify-center p-4 select-none">
      <div className="max-w-md w-full bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 shadow-[var(--shadow-md)] text-center">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-[var(--primary-light)] flex items-center justify-center mx-auto mb-5 text-[var(--primary)] shadow-[var(--shadow-sm)]">
          <WifiOff className="w-8 h-8 animate-pulse" />
        </div>

        {/* Headings */}
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] mb-2">
          You&apos;re Currently Offline
        </h1>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-6">
          TAS ERP couldn&apos;t establish a connection to the server. Don&apos;t worry—your local cached data and offline scanning are still accessible.
        </p>

        {onlineNow && (
          <div className="mb-6 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-xs font-semibold text-green-600 dark:text-green-400 flex items-center justify-center gap-2">
            <span>● Connection restored! Tap reload below.</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isChecking}
            className="w-full h-11 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-semibold text-sm shadow-[var(--shadow-sm)] flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? "animate-spin" : ""}`} />
            {isChecking ? "Checking Connection..." : "Retry Connection"}
          </button>

          <div className="grid grid-cols-2 gap-2.5 pt-2">
            <Link
              href="/"
              className="h-10 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] text-xs font-medium text-[var(--text-body)] flex items-center justify-center gap-1.5 transition-colors"
            >
              <Home className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              Cached Home
            </Link>

            <Link
              href="/scan"
              className="h-10 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] text-xs font-medium text-[var(--text-body)] flex items-center justify-center gap-1.5 transition-colors"
            >
              <QrCode className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              Offline Scan
            </Link>
          </div>
        </div>

        {/* Sub-info */}
        <div className="mt-6 pt-4 border-t border-[var(--border)] text-[11px] text-[var(--text-faint)]">
          TAS ERP Progressive Web App &bull; Offline Mode
        </div>
      </div>
    </div>
  );
}
