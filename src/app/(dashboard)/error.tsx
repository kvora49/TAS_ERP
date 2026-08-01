"use client";

import React, { useEffect } from "react";
import PageState from "@/components/shared/PageState";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard View Error caught:", error);
  }, [error]);

  const isChunkError =
    error.message?.includes("Loading chunk") ||
    error.message?.includes("missing") ||
    error.name === "ChunkLoadError";

  const handleRetry = () => {
    if (isChunkError && typeof window !== "undefined") {
      window.location.reload();
    } else {
      reset();
    }
  };

  return (
    <div className="py-12 px-4 flex items-center justify-center">
      <PageState
        isLoading={false}
        isError={true}
        error={
          isChunkError
            ? "New application update detected. Please reload to sync the latest modules."
            : error?.message || "An unexpected error occurred while loading this section."
        }
        onRetry={handleRetry}
        emptyTitle="Unable to Display View"
      >
        <div />
      </PageState>
    </div>
  );
}
