"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function LegacyPurchaseReturnDetailRedirect() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  useEffect(() => {
    if (id) {
      router.replace(`/purchases/returns/${id}`);
    } else {
      router.replace("/purchases?tab=returns");
    }
  }, [router, id]);

  return (
    <div className="p-8 text-center text-[var(--text-muted)] text-sm font-semibold">
      Redirecting to Purchase Return...
    </div>
  );
}
