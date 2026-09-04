"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MakePaymentView from "@/components/payments/MakePaymentView";
import ModuleSubNav from "@/components/shared/ModuleSubNav";
import { PAYMENTS_NAV } from "@/lib/moduleNav";

function MakePaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPartyId =
    searchParams.get("party_id") ||
    searchParams.get("supplier_id") ||
    searchParams.get("worker_id") ||
    "";

  return (
    <div className="p-2.5 sm:p-6 space-y-4 max-w-7xl mx-auto">
      <ModuleSubNav items={PAYMENTS_NAV} />
      <MakePaymentView
        initialPartyId={initialPartyId}
        onSuccess={() => router.push("/payments")}
        onCancel={() => router.push("/payments")}
      />
    </div>
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
