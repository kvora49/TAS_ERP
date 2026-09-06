"use client";

import React from "react";
import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "@/components/experience/Skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { useExperienceProfile } from "@/components/experience/NavigationExperienceProvider";

interface PageStateProps {
  isLoading: boolean;
  isError?: boolean;
  error?: string | null;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyMessage?: string;
  emptyDescription?: string;
  emptyTitle?: string;
  onEmptyAction?: () => void;
  emptyActionLabel?: string;
  emptyAction?: React.ReactNode;

  // Skeleton variant configuration
  skeletonVariant?: "table" | "stats" | "form" | "card" | "chart" | "custom";
  skeletonRows?: number;
  skeletonColumns?: number;
  skeletonCount?: number;

  children: React.ReactNode;
}

export default function PageState({
  isLoading,
  isError,
  error,
  onRetry,
  isEmpty = false,
  emptyMessage: emptyMessageProp,
  emptyDescription,
  emptyTitle = "No Data Available",
  onEmptyAction,
  emptyActionLabel,
  emptyAction,
  skeletonVariant = "table",
  skeletonRows = 6,
  skeletonColumns = 5,
  skeletonCount = 4,
  children,
}: PageStateProps) {
  const profile = useExperienceProfile();
  const isUltraFast = profile?.level === "ultraFast";
  const emptyMessage = emptyDescription || emptyMessageProp || "No records found matching the query.";
  const hasError = isError !== undefined ? isError : Boolean(error);

  let stateKey = "ready";
  let content: React.ReactNode = null;

  if (isLoading) {
    stateKey = "loading";
    if (skeletonVariant === "table") {
      content = (
        <div className="w-full space-y-3">
          <div className="flex justify-between items-center pb-2">
            <Skeleton className="h-8 w-48 rounded-lg" />
            <Skeleton className="h-8 w-32 rounded-lg" />
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] overflow-hidden">
            <div className="border-b border-[var(--border)] bg-[var(--table-header-bg)] p-3">
              <div className="flex gap-4">
                {Array.from({ length: skeletonColumns }).map((_, i) => (
                  <Skeleton key={i} className="h-4 flex-1 rounded" />
                ))}
              </div>
            </div>
            <div className="p-3 space-y-3">
              {Array.from({ length: skeletonRows }).map((_, i) => (
                <div key={i} className="flex gap-4 items-center">
                  {Array.from({ length: skeletonColumns }).map((_, j) => (
                    <Skeleton key={j} className="h-5 flex-1 rounded" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    } else if (skeletonVariant === "stats") {
      content = (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div
              key={i}
              className="p-5 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] space-y-3"
            >
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-32 rounded" />
              <Skeleton className="h-3 w-20 rounded" />
            </div>
          ))}
        </div>
      );
    } else if (skeletonVariant === "card") {
      content = (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] space-y-3"
            >
              <Skeleton className="h-6 w-3/4 rounded" />
              <Skeleton className="h-4 w-1/2 rounded" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ))}
        </div>
      );
    } else if (skeletonVariant === "form") {
      content = (
        <div className="w-full p-6 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] space-y-4">
          <Skeleton className="h-6 w-48 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      );
    } else {
      // Default loader
      content = (
        <div className="flex h-[40vh] w-full items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              Loading data...
            </span>
          </div>
        </div>
      );
    }
  } else if (hasError) {
    stateKey = "error";
    content = (
      <div className="flex h-[40vh] w-full items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center max-w-md bg-[var(--card-bg)] border border-[var(--border)] p-6 rounded-xl shadow-[var(--shadow-md)]">
          <div className="h-12 w-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            Failed to Load Content
          </h3>
          <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed">
            {error || "An unexpected error occurred while fetching data."}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              aria-label="Retry loading data"
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          )}
        </div>
      </div>
    );
  } else if (isEmpty) {
    stateKey = "empty";
    content = (
      <div
        role="region"
        aria-label={emptyTitle}
        className="flex w-full items-center justify-center bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden shadow-[var(--shadow-sm)]"
      >
        <EmptyState
          icon={<Inbox className="h-8 w-8 text-[var(--text-muted)]" />}
          title={emptyTitle}
          description={emptyMessage}
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
        />
        {emptyAction && <div className="p-4">{emptyAction}</div>}
      </div>
    );
  } else {
    content = children;
  }

  if (isUltraFast) {
    return (
      <div
        role={hasError ? "alert" : isLoading ? "status" : undefined}
        aria-live={hasError ? "assertive" : isLoading ? "polite" : undefined}
      >
        {content}
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={stateKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
        role={hasError ? "alert" : isLoading ? "status" : undefined}
        aria-live={hasError ? "assertive" : isLoading ? "polite" : undefined}
        className="w-full"
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
}
