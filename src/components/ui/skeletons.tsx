import React from "react";

// CardSkeleton mimics the standard grid cards
export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <div className="h-6 bg-[#E2E8F0] rounded w-1/3 animate-pulse" />
            <div className="h-4 bg-[#E2E8F0] rounded-full w-12 animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-[#E2E8F0] rounded w-3/4 animate-pulse" />
            <div className="h-4 bg-[#E2E8F0] rounded w-5/6 animate-pulse" />
          </div>
          <div className="pt-4 border-t border-[#F1F5F9] flex justify-between items-center">
            <div className="h-4 bg-[#E2E8F0] rounded w-1/4 animate-pulse" />
            <div className="h-6 bg-[#E2E8F0] rounded-md w-16 animate-pulse" />
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
          <div key={idx} className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-sm flex items-center gap-4">
            <div className="h-10 w-10 bg-[#E2E8F0] rounded-lg animate-pulse" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3 bg-[#E2E8F0] rounded w-1/2 animate-pulse" />
              <div className="h-5 bg-[#E2E8F0] rounded w-3/4 animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Large Grid Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-sm space-y-4">
          <div className="h-6 bg-[#E2E8F0] rounded w-1/4 animate-pulse" />
          <div className="h-[250px] bg-[#E2E8F0] rounded animate-pulse" />
        </div>
        <div className="bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-sm space-y-4">
          <div className="h-6 bg-[#E2E8F0] rounded w-1/3 animate-pulse" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <div className="h-4 bg-[#E2E8F0] rounded w-1/2 animate-pulse" />
                <div className="h-4 bg-[#E2E8F0] rounded w-1/4 animate-pulse" />
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
    <div className="bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-sm space-y-6">
      <div className="h-6 bg-[#E2E8F0] rounded w-1/4 animate-pulse mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: fieldsCount }).map((_, idx) => (
          <div key={idx} className="space-y-2">
            <div className="h-3 bg-[#E2E8F0] rounded w-1/4 animate-pulse" />
            <div className="h-10 bg-[#E2E8F0] rounded-lg w-full animate-pulse" />
          </div>
        ))}
      </div>
      <div className="pt-6 border-t border-[#F1F5F9] flex justify-end gap-3">
        <div className="h-10 bg-[#E2E8F0] rounded-lg w-20 animate-pulse" />
        <div className="h-10 bg-[#E2E8F0] rounded-lg w-28 animate-pulse" />
      </div>
    </div>
  );
}
