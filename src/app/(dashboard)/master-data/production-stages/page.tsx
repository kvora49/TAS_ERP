"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function LegacyProductionStagesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/master-data/production-stages/templates");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
      <Loader2 className="h-7 w-7 animate-spin text-[var(--primary)]" />
      <p className="text-sm font-medium text-[var(--text-muted)]">
        Redirecting to Production Stages &amp; Templates...
      </p>
    </div>
  );
}

