"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PurchaseReturnsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/purchases?tab=returns");
  }, [router]);

  return (
    <div className="p-8 text-center text-[var(--text-muted)] text-sm font-semibold">
      Redirecting to Purchases & Returns Hub...
    </div>
  );
}
