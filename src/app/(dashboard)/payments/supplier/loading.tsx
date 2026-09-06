import React from "react";
import { Skeleton } from "@/components/experience/Skeleton";

export default function SupplierPaymentsLoading() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-7 w-48 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      <Skeleton variant="table" columns={6} rows={8} />
    </div>
  );
}
