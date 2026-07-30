"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RedirectToFinancial() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/reports/financial");
  }, [router]);
  return <div className="p-8 text-center text-xs text-[var(--text-muted)]">Redirecting to Financial Reports...</div>;
}
