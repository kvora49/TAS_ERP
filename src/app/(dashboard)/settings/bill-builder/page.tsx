"use client";

import React, { useEffect, useState } from "react";
import { BillBuilderCanvas } from "@/components/settings/BillBuilderCanvas";
import { CustomBillLayout, DEFAULT_BILL_LAYOUT } from "@/lib/pdf/custom-layout-renderer";
import { toast } from "sonner";

export default function BillBuilderPage() {
  const [layout, setLayout] = useState<CustomBillLayout>(DEFAULT_BILL_LAYOUT);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load persisted layout if available
    try {
      const saved = localStorage.getItem("tas-erp-custom-bill-layout");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.elements) {
          setLayout(parsed);
        }
      }
    } catch (e) {}
  }, []);

  const handleSaveLayout = async (savedLayout: CustomBillLayout) => {
    try {
      localStorage.setItem("tas-erp-custom-bill-layout", JSON.stringify(savedLayout));
      setLayout(savedLayout);
    } catch (e) {}
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <BillBuilderCanvas initialLayout={layout} onSave={handleSaveLayout} />
    </div>
  );
}
