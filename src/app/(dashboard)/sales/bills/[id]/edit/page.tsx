"use client";

import React from "react";
import { useParams } from "next/navigation";
import { SalesBillEditor } from "@/components/sales/SalesBillEditor";

export default function EditSaleBillPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <SalesBillEditor mode="edit" billId={id} />
  );
}
