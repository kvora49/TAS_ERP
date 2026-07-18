"use client";

import React from "react";
import { Loader2, AlertCircle, Inbox } from "lucide-react";
import { EmptyState } from "./EmptyState";

interface PageStateProps {
  isLoading: boolean;
  error?: string | null;
  isEmpty?: boolean;
  emptyMessage?: string;
  emptyTitle?: string;
  onEmptyAction?: () => void;
  emptyActionLabel?: string;
  children: React.ReactNode;
}

export default function PageState({
  isLoading,
  error,
  isEmpty = false,
  emptyMessage = "No records found matching the query.",
  emptyTitle = "No Data Available",
  onEmptyAction,
  emptyActionLabel,
  children,
}: PageStateProps) {
  if (isLoading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-[#6366F1]" />
          <span className="text-xs font-semibold text-[var(--text-muted)]">Loading data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center max-w-md">
          <div className="h-12 w-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-[var(--text-primary)]">Failed to Load Content</h3>
          <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed">
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex w-full items-center justify-center bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-[var(--shadow-sm)]">
        <EmptyState
          icon={<Inbox className="h-8 w-8 text-slate-400" />}
          title={emptyTitle}
          description={emptyMessage}
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
        />
      </div>
    );
  }

  return <>{children}</>;
}
