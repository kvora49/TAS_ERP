import React from "react";
import { TableSkeleton } from "@/components/tables/TableSkeleton";

export default function Loading() {
  return (
    <div className="space-y-6 max-w-[1400px] mx-auto p-6 bg-white rounded-xl border border-[#E5E7EB] shadow-sm">
      <div className="flex justify-between items-center pb-4 border-b border-slate-100">
        <div className="h-7 bg-[#E2E8F0] rounded w-1/4 animate-pulse" />
        <div className="h-10 bg-[#E2E8F0] rounded-lg w-32 animate-pulse" />
      </div>
      <TableSkeleton columnsCount={6} rowCount={6} />
    </div>
  );
}
