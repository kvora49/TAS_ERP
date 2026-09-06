import React from "react";
import { Skeleton } from "@/components/experience/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-7 w-48 rounded-lg" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </div>
      <Skeleton variant="stats" count={4} />
      <Skeleton variant="chart" chartHeight={220} />
    </div>
  );
}
