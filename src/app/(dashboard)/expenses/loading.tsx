import React from "react";
import { Skeleton } from "@/components/experience/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton variant="stats" count={4} />
      <Skeleton variant="table" columns={5} rows={8} />
    </div>
  );
}
