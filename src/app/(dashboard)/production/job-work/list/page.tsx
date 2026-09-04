"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function JobWorkListRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/production/job-work?tab=entries");
  }, [router]);

  return (
    <div className="py-20 text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)] mx-auto" />
      <p className="text-xs text-[var(--text-muted)] mt-2 font-medium">Redirecting to Job Work Workspace...</p>
    </div>
  );
}
