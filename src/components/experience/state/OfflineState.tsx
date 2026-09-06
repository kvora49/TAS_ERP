"use client";

import React, { useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";

export function OfflineState({ onRetry }: { onRetry?: () => void }) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      if (onRetry) {
        await onRetry();
      } else {
        window.location.reload();
      }
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center select-none">
      <div className="w-14 h-14 rounded-full bg-[var(--primary-light)] flex items-center justify-center mb-4 shadow-[var(--shadow-sm)]">
        <WifiOff className="w-7 h-7 text-[var(--primary)]" />
      </div>
      <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">
        You&apos;re offline
      </h3>
      <p className="text-sm text-[var(--text-muted)] text-center max-w-sm mb-6">
        No internet connection detected. Please check your network or Wi-Fi settings and try again.
      </p>
      <button
        type="button"
        onClick={handleRetry}
        disabled={retrying}
        className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--text-body)] bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${retrying ? "animate-spin text-[var(--primary)]" : ""}`} />
        {retrying ? "Checking..." : "Retry Connection"}
      </button>
    </div>
  );
}
