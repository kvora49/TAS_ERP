"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RedirectToInventory() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/reports/inventory");
  }, [router]);
  return <div className="p-8 text-center text-xs text-[var(--text-muted)]">Redirecting to Inventory & Stock Reports...</div>;
}
