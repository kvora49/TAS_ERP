"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MakePaymentView from "@/components/payments/MakePaymentView";

function MakePaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPartyId =
    searchParams.get("party_id") ||
    searchParams.get("supplier_id") ||
    searchParams.get("worker_id") ||
    "";

  return (
    <MakePaymentView
      initialPartyId={initialPartyId}
      onSuccess={() => router.push("/payments")}
      onCancel={() => router.push("/payments")}
    />
  );
}

export default function MakePaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-xs text-[var(--text-muted)]">
          Loading Make Payment Page...
        </div>
      }
    >
      <MakePaymentContent />
    </Suspense>
  );
}
