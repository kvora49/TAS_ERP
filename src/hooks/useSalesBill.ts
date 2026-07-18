import { useState, useEffect } from "react";
import { useERPQuery, useERPMutation } from "@/hooks/useERPQuery";
import { SalesBillService } from "@/services/sales-bill.service";
import { SalesBillRepository } from "@/repositories/sales-bill.repository";
import { createClient } from "@/lib/supabase/client";

export function useSalesBill(id?: string) {
  const supabase = createClient();
  const repo = new SalesBillRepository(supabase);
  const service = new SalesBillService(repo);

  // Core editor state
  const [partyId, setPartyId] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [gstin, setGstin] = useState("");
  const [gstTreatment, setGstTreatment] = useState("regular");
  const [transporterName, setTransporterName] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [salesman, setSalesman] = useState("");
  const [remarks, setRemarks] = useState("");
  const [discountType, setDiscountType] = useState<"flat" | "percentage" | null>(null);
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [status, setStatus] = useState<"draft" | "active">("draft");
  
  const [items, setItems] = useState<any[]>([]);
  const [charges, setCharges] = useState<any[]>([]);
  const [isInterstate, setIsInterstate] = useState(false);

  // Fetch bill details if ID is provided
  const { data: billData, isPending } = useERPQuery(
    ["sales-bill-detail", id],
    async () => {
      if (!id) return null;
      const res = await fetch(`/api/sales/bills/${id}`);
      if (!res.ok) throw new Error("Failed to load bill details");
      return (await res.json()).data;
    },
    { enabled: !!id }
  );

  const loading = !!id && isPending;

  // Sync state with loaded bill details
  useEffect(() => {
    if (billData) {
      const b = billData.bill || billData;
      setPartyId(b.party_id || "");
      setBillDate(b.bill_date || "");
      setDueDate(b.due_date || "");
      setPaymentTerms(b.payment_terms || "");
      setReferenceNo(b.reference_no || "");
      setBillingAddress(b.billing_address || "");
      setPhone(b.phone || "");
      setGstin(b.gstin || "");
      setGstTreatment(b.gst_treatment || "regular");
      setTransporterName(b.eway_transporter || b.transporter_name || "");
      setVehicleNo(b.eway_vehicle_no || b.vehicle_no || "");
      setSalesman(b.salesman || "");
      setRemarks(b.remarks || "");
      setDiscountType(b.discount_type || null);
      setDiscountValue(Number(b.discount_value || 0));
      setStatus(b.status || "draft");
      setItems(b.items || []);
      setCharges(b.charges || []);
    }
  }, [billData]);

  // Recalculate totals
  const totals = service.calculateTotals({
    items,
    charges,
    discount_type: discountType,
    discount_value: discountValue,
    gst_treatment: gstTreatment,
    isInterstate,
  });

  return {
    state: {
      partyId, setPartyId,
      billDate, setBillDate,
      dueDate, setDueDate,
      paymentTerms, setPaymentTerms,
      referenceNo, setReferenceNo,
      billingAddress, setBillingAddress,
      phone, setPhone,
      gstin, setGstin,
      gstTreatment, setGstTreatment,
      transporterName, setTransporterName,
      vehicleNo, setVehicleNo,
      salesman, setSalesman,
      remarks, setRemarks,
      discountType, setDiscountType,
      discountValue, setDiscountValue,
      status, setStatus,
      items, setItems,
      charges, setCharges,
      isInterstate, setIsInterstate,
    },
    totals,
    loading,
    bill: billData,
  };
}
