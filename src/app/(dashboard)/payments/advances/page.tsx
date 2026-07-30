"use client";

import React, { Suspense } from "react";
import AdvancesCreditNotesTab from "@/components/payments/AdvancesCreditNotesTab";

function AdvancesContent() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">
          Advance Payments Tracker
        </h1>
        <p className="text-xs text-[var(--text-muted)] mt-0.5 uppercase tracking-wider">
          PAYMENTS & FINANCE / ADVANCES
        </p>
      </div>

      <AdvancesCreditNotesTab showBackButton={true} />
    </div>
  );
}

export default function AdvancesPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-[var(--text-muted)]">Loading Advances...</div>}>
      <AdvancesContent />
    </Suspense>
  );
}
