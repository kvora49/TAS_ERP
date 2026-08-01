"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error internally
    console.error("Global Application Error:", error);
  }, [error]);

  const isChunkError =
    error.message?.includes("Loading chunk") ||
    error.message?.includes("missing") ||
    error.name === "ChunkLoadError";

  const handleRefresh = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    } else {
      reset();
    }
  };

  return (
    <html lang="en">
      <body className="bg-[var(--page-bg)] text-[var(--text-primary)] min-h-screen flex items-center justify-center p-4">
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto shadow-sm">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-extrabold text-[var(--text-primary)] tracking-tight">
              {isChunkError ? "App Updated / Cache Reset" : "Something Went Wrong"}
            </h2>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              {isChunkError
                ? "A new version of TAS ERP is available or cache was refreshed. Tap reload to update."
                : error.message || "An unexpected system error occurred. Please try reloading."}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleRefresh}
              className="w-full h-10 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-[var(--primary)]/20"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{isChunkError ? "Reload Application" : "Try Again"}</span>
            </button>

            <a
              href="/"
              className="w-full h-10 border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] text-[var(--text-primary)] text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              <Home className="w-4 h-4" />
              <span>Go to Home</span>
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
