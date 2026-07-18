"use client";

import React, { useEffect } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application boundary caught crash error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 select-none">
      <div className="max-w-md w-full bg-white rounded-2xl border border-[#E2E8F0] p-8 shadow-xl text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-[#FEF2F2] text-[#EF4444] flex items-center justify-center mx-auto shadow-lg shadow-[#EF4444]/10">
          <AlertCircle size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Something went wrong</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            An unexpected error occurred in this workspace view. Details: {error.message || "Unknown error"}
          </p>
        </div>
        <div className="flex gap-4 justify-center">
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="flex items-center gap-2 border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Reload Page
          </Button>
          <Button
            onClick={reset}
            className="flex items-center gap-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white"
          >
            <RotateCcw size={16} />
            <span>Try Again</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
