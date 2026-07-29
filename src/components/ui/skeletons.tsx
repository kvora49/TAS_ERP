import React from "react";

// CardSkeleton mimics the standard grid cards
export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="bg-[var(--card-bg)] p-6 rounded-xl border border-[var(--border)] shadow-[var(--shadow-sm)] space-y-4">
          <div className="flex justify-between items-center">
            <div className="h-6 bg-[var(--skeleton-base)] rounded w-1/3 animate-pulse" />
            <div className="h-4 bg-[var(--skeleton-base)] rounded-full w-12 animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-[var(--skeleton-base)] rounded w-3/4 animate-pulse" />
            <div className="h-4 bg-[var(--skeleton-base)] rounded w-5/6 animate-pulse" />
          </div>
          <div className="pt-4 border-t border-[var(--border-light)] flex justify-between items-center">
            <div className="h-4 bg-[var(--skeleton-base)] rounded w-1/4 animate-pulse" />
            <div className="h-6 bg-[var(--skeleton-base)] rounded-md w-16 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

// DashboardSkeleton contains stat cards and large grid widgets
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="bg-[var(--card-bg)] p-5 rounded-xl border border-[var(--border)] shadow-[var(--shadow-sm)] flex items-center gap-4">
            <div className="h-10 w-10 bg-[var(--skeleton-base)] rounded-lg animate-pulse" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3 bg-[var(--skeleton-base)] rounded w-1/2 animate-pulse" />
              <div className="h-5 bg-[var(--skeleton-base)] rounded w-3/4 animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Large Grid Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[var(--card-bg)] p-6 rounded-xl border border-[var(--border)] shadow-[var(--shadow-sm)] space-y-4">
          <div className="h-6 bg-[var(--skeleton-base)] rounded w-1/4 animate-pulse" />
          <div className="h-[250px] bg-[var(--skeleton-base)] rounded animate-pulse" />
        </div>
        <div className="bg-[var(--card-bg)] p-6 rounded-xl border border-[var(--border)] shadow-[var(--shadow-sm)] space-y-4">
          <div className="h-6 bg-[var(--skeleton-base)] rounded w-1/3 animate-pulse" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <div className="h-4 bg-[var(--skeleton-base)] rounded w-1/2 animate-pulse" />
                <div className="h-4 bg-[var(--skeleton-base)] rounded w-1/4 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// FormSkeleton displays form fields and input layouts
export function FormSkeleton({ fieldsCount = 6 }: { fieldsCount?: number }) {
  return (
    <div className="bg-[var(--card-bg)] p-6 rounded-xl border border-[var(--border)] shadow-[var(--shadow-sm)] space-y-6">
      <div className="h-6 bg-[var(--skeleton-base)] rounded w-1/4 animate-pulse mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: fieldsCount }).map((_, idx) => (
          <div key={idx} className="space-y-2">
            <div className="h-3 bg-[var(--skeleton-base)] rounded w-1/4 animate-pulse" />
            <div className="h-10 bg-[var(--skeleton-base)] rounded-lg w-full animate-pulse" />
          </div>
        ))}
      </div>
      <div className="pt-6 border-t border-[var(--border-light)] flex justify-end gap-3">
        <div className="h-10 bg-[var(--skeleton-base)] rounded-lg w-20 animate-pulse" />
        <div className="h-10 bg-[var(--skeleton-base)] rounded-lg w-28 animate-pulse" />
      </div>
    </div>
  );
}
