"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyPurchaseReturnsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/purchases?tab=returns");
  }, [router]);

  return (
    <div className="p-8 text-center text-slate-500 text-sm font-semibold">
      Redirecting to Purchase Returns...
    </div>
  );
}
