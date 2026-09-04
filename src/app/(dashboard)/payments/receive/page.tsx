"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReceivePaymentView from "@/components/payments/ReceivePaymentView";
import ModuleSubNav from "@/components/shared/ModuleSubNav";
import { PAYMENTS_NAV } from "@/lib/moduleNav";

function ReceivePaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPartyId =
    searchParams.get("party_id") ||
    searchParams.get("customer_id") ||
    "";

  return (
    <div className="p-2.5 sm:p-6 space-y-4 max-w-7xl mx-auto">
      <ModuleSubNav items={PAYMENTS_NAV} />
      <ReceivePaymentView
        initialPartyId={initialPartyId}
        onSuccess={() => router.push("/payments")}
        onCancel={() => router.push("/payments")}
      />
    </div>
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
