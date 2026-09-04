"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WorkersRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/parties?type=worker");
  }, [router]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center bg-[var(--page-bg)] select-none">
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-[var(--text-muted)]">Redirecting to Workers...</p>
      </div>
    </div>
  );
}
