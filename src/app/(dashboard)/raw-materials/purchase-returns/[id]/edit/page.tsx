"use client";

import { useEffect, useState } from "react";
import { ReturnForm } from "@/components/forms/ReturnForm";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function EditPurchaseReturnPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [initialData, setInitialData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReturn() {
      try {
        const res = await fetch(`/api/raw-materials/purchase-returns/${id}`);
        if (!res.ok) throw new Error("Failed to load purchase return details");
        const data = await res.json();
        const r = data.return;

        // Map API data to ReturnForm-compatible structure
        const mappedData = {
          purchase_id: r.purchase_id || "",
          supplier_id: r.supplier_id || "",
          return_date: r.return_date || new Date().toISOString().split("T")[0],
          return_type: r.return_type || "material_return",
          reason: r.reason || "",
          godown_id: r.godown_id || "",
          challan_no: r.challan_no || "",
          remarks: r.remarks || "",
          generate_debit_note: r.generate_debit_note ?? true,
          attachments: r.attachments || [],
          status: r.status || "completed",
          items: (r.items || []).map((it: any) => {
            const calculatedType = it.item_type || (it.design_id ? "finished_goods" : "accessory");
            const materialName = calculatedType === "finished_goods"
              ? `${it.design?.design_number || it.design?.name || "Finished Good"}${it.colour?.colour_name ? ` (${it.colour.colour_name})` : ""}`
              : it.material_type?.name || "Material";

            return {
              purchase_item_id: it.purchase_item_id || "",
              material_type_id: it.material_type_id || null,
              design_id: it.design_id || null,
              colour_id: it.colour_id || null,
              size_quantities: it.size_quantities || {},
              invoice_size_quantities: it.size_quantities || {},
              sizes: it.size_quantities ? Object.keys(it.size_quantities) : [],
              material_name: materialName,
              hsn_sac: it.hsn_sac || "",
              unit: it.unit || (calculatedType === "finished_goods" ? "Pcs" : "Meters"),
              invoice_qty: Number(it.invoice_qty || 0),
              returned_qty: Number(it.returned_qty || 0),
              rate: Number(it.rate || 0),
              discount_percent: Number(it.discount_percent || 0),
              taxable_value: Number(it.taxable_value || 0),
              item_type: calculatedType,
              rolls: [],
            };
          }),
        };

        setInitialData(mappedData);
      } catch (err: any) {
        toast.error(err.message || "Could not fetch purchase return info");
      } finally {
        setLoading(false);
      }
    }
    fetchReturn();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#6366F1]" />
      </div>
    );
  }

  if (!initialData) {
    return (
      <div className="p-6 text-center text-sm font-semibold text-red-500">
        Purchase return not found or could not be loaded.
      </div>
    );
  }

  return (
    <div className="p-6">
      <ReturnForm initialData={initialData} id={id} />
    </div>
  );
}
