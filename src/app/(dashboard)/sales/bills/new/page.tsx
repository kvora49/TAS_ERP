"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { SalesBillEditor } from "@/components/sales/SalesBillEditor";

export default function CreateSaleBillPage() {
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type") as "pakka" | "kacha" | null;

  return (
    <SalesBillEditor mode="create" type={typeParam || "pakka"} />
  );
}
