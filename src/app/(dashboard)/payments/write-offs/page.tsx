"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WriteOffsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/expenses?tab=write-offs");
  }, [router]);

  return (
    <div className="p-8 text-center text-xs text-[var(--text-muted)] font-semibold">
      Redirecting to Expenses & Financial Adjustments Hub...
    </div>
  );
}
