"use client";

import { useEffect, useState } from "react";
import { PurchaseForm } from "@/components/forms/PurchaseForm";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function EditPurchasePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [initialData, setInitialData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPurchase() {
      try {
        const res = await fetch(`/api/raw-materials/purchases/${id}`);
        if (!res.ok) throw new Error("Failed to load invoice details");
        const data = await res.json();
        
        // Map data.purchase and items to match PurchaseForm structure
        const p = data.purchase;
        const mappedData = {
          ...p,
          supplier_id: p.supplier_id,
          invoice_no: p.invoice_no,
          invoice_date: p.invoice_date,
          delivery_date: p.delivery_date || "",
          payment_terms: p.payment_terms || "30_days",
          due_date: p.due_date || "",
          reference: p.reference || "",
          transporter: p.transporter || "",
          place_of_supply: p.place_of_supply || "",
          gst_type: p.gst_type || "with_gst",
          notes: p.notes || "",
          freight: Number(p.freight || 0),
          loading_unloading: Number(p.loading_unloading || 0),
          other_charges: Number(p.other_charges || 0),
          attachments: p.attachments || [],
          items: p.items.map((it: any) => ({
            material_type_id: it.material_type_id,
            hsn_sac: it.hsn_sac || "",
            unit: it.unit || "meter",
            quantity: Number(it.quantity),
            rate: Number(it.rate),
            discount_percent: Number(it.discount_percent || 0),
            taxable_value: Number(it.taxable_value),
            gst_percent: Number(it.gst_percent || 0),
            gst_amount: Number(it.gst_amount || 0),
            amount: Number(it.amount),
          })),
        };
        setInitialData(mappedData);
      } catch (err: any) {
        toast.error(err.message || "Could not fetch purchase invoice info");
      } finally {
        setLoading(false);
      }
    }
    fetchPurchase();
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
        Purchase invoice not found or could not be loaded.
      </div>
    );
  }

  return (
    <div className="p-6">
      <PurchaseForm initialData={initialData} id={id} />
    </div>
  );
}
