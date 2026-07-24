'use client';

import { WifiOff, RefreshCw } from 'lucide-react';

export function OfflineState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-14 h-14 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
        <WifiOff className="w-7 h-7 text-[#94A3B8]" />
      </div>
      <h3 className="text-base font-semibold text-[#0F172A] mb-1">You&apos;re offline</h3>
      <p className="text-sm text-[#64748B] text-center max-w-sm mb-6">
        Check your internet connection and try again.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 h-10 px-4 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F8FAFC] transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        Retry Connection
      </button>
    </div>
  );
}
