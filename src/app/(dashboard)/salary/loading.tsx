import React from "react";
import { Skeleton } from "@/components/experience/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton variant="stats" count={3} />
      <Skeleton variant="table" columns={6} rows={8} />
    </div>
  );
}
