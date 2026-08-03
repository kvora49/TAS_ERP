"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SalesBillEditor } from "@/components/sales/SalesBillEditor";
import { Loader2 } from "lucide-react";

function CreateSaleBillContent() {
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type") as "pakka" | "kacha" | null;

  return (
    <SalesBillEditor mode="create" type={typeParam || "pakka"} />
  );
}

export default function CreateSaleBillPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <CreateSaleBillContent />
    </Suspense>
  );
}
