'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';

export function ErrorState({ error, onRetry }: { error?: Error | null; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-14 h-14 rounded-full bg-[#FEE2E2] flex items-center justify-center mb-4">
        <AlertCircle className="w-7 h-7 text-[#DC2626]" />
      </div>
      <h3 className="text-base font-semibold text-[#0F172A] mb-1">Something went wrong</h3>
      <p className="text-sm text-[#64748B] text-center max-w-sm mb-6">
        {error?.message || 'An unexpected error occurred. Please try again.'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 h-10 px-4 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F8FAFC] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      )}
    </div>
  );
}
