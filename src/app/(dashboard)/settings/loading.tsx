import React from "react";
import { Skeleton } from "@/components/experience/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton variant="list" rows={6} />
    </div>
  );
}
