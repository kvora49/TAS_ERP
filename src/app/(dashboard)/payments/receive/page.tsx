"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReceivePaymentView from "@/components/payments/ReceivePaymentView";

function ReceivePaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPartyId =
    searchParams.get("party_id") ||
    searchParams.get("customer_id") ||
    "";

  return (
    <ReceivePaymentView
      initialPartyId={initialPartyId}
      onSuccess={() => router.push("/payments")}
      onCancel={() => router.push("/payments")}
    />
  );
}

export default function ReceivePaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-xs text-[var(--text-muted)]">
          Loading Receive Payment Page...
        </div>
      }
    >
      <ReceivePaymentContent />
    </Suspense>
  );
}
