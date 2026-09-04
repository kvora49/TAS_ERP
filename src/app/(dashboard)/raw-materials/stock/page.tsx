"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyRawMaterialStockRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/stock/raw-materials");
  }, [router]);

  return (
    <div className="p-8 text-center text-[var(--text-muted)] text-sm font-semibold">
      Redirecting to Raw Material Stock...
    </div>
  );
}
