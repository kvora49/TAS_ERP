"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSalesBill } from "@/hooks/useSalesBill";
import { CustomerSection } from "./CustomerSection";
import { ConsigneeSection } from "./ConsigneeSection";
import { ItemsTable } from "./ItemsTable";
import { TotalsPanel } from "./TotalsPanel";
import { BillValidation } from "./BillValidation";
import { useERPQuery, useERPMutation } from "@/hooks/useERPQuery";
import { toast } from "sonner";
import WizardHeader from "@/components/shared/WizardHeader";
import { PostInvoiceSuccessModal, CreatedInvoiceInfo } from "./PostInvoiceSuccessModal";
import { useGeneralSettings } from "@/hooks/useGeneralSettings";
import { Modal } from "@/components/shared/Modal";
import { PakkaBillTemplate } from "./PakkaBillTemplate";
import { KachaBillTemplate } from "./KachaBillTemplate";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { useGstRateLookup } from "@/hooks/useGstRateLookup";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

interface SalesBillEditorProps {
  mode: "create" | "edit";
  billId?: string;
  type?: "pakka" | "kacha";
}

export function SalesBillEditor({ mode, billId, type = "pakka" }: SalesBillEditorProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [showEway, setShowEway] = useState(false);

  // Post invoice success modal states
  const [createdInvoice, setCreatedInvoice] = useState<CreatedInvoiceInfo | null>(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Initialize unified state hook
  const { state, totals, loading: loadingBill } = useSalesBill(billId);

  // Unsaved changes guard: active if user has entered items or selected a party and haven't finished saving
  const isDirty = !loadingBill && (state.items.length > 0 || !!state.partyId);
  useUnsavedChangesGuard(isDirty && !successModalOpen);

  // Company profile for preview
  const { business, getEffectiveLogo } = useCompanyProfile();
  const { lookupGst } = useGstRateLookup();

  // Brand config for preview
  const { data: brandData } = useERPQuery(["brand-config-preview"], async () => {
    const res = await fetch("/api/settings/company-profile");
    if (!res.ok) return null;
    return res.json();
  }, { staleTime: 60_000 });

  // Bill config for bank details & terms preview
  const { data: billConfigData } = useERPQuery(["settings-bill-config-preview"], async () => {
    const res = await fetch("/api/settings/bill-config");
    if (!res.ok) return null;
    return res.json();
  }, { staleTime: 30_000 });

  // Set default type if creating
  useEffect(() => {
    if (mode === "create") {
      state.setGstTreatment(type === "pakka" ? "regular" : "exempt");
    }
  }, [mode, type]);

  // Pre-fill scanned SKU line item from URL parameters
  useEffect(() => {
    if (mode === "create" && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const stockId = params.get("stock_id");
      const size = params.get("size");
      const price = params.get("price");
      const designId = params.get("design_id");

      if (stockId || designId) {
        const fetchInitialItem = async () => {
          try {
            const lookupId = stockId || designId;
            const res = await fetch("/api/finished-stock/barcode/scan", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ qr_uuid: lookupId }),
            });
            const json = await res.json();
            if (res.ok && json.found && json.stock) {
              const stk = json.stock;
              const itemRate = Number(price || stk.designs?.sale_price || 0);
              const itemHsn = stk.designs?.hsn_code || "6204";
              const resolved = lookupGst(itemHsn, itemRate);
              const taxPct = type === "kacha" ? 0 : (resolved ? resolved.gstPercent : 5);

              const newItem = {
                id: crypto.randomUUID(),
                finished_stock_id: stk.id,
                design_id: stk.design_id,
                design_code: stk.designs?.design_number || "DES-001",
                design_name: stk.designs?.name || "Garment Item",
                colour_id: stk.colour_id,
                colour_name: stk.design_colours?.colour_name || "Standard",
                size: size || stk.size || "Free Size",
                quantity: 1,
                rate: itemRate,
                unit: "Pcs",
                hsn_sac: itemHsn,
                discount_percent: 0,
                tax_percent: taxPct,
              };
              state.setItems([newItem]);
              toast.success(`Scanned item pre-filled: ${stk.designs?.name || "Item"} (Size: ${size || stk.size || "Free Size"})`);
            }
          } catch (err) {
            console.error("Error pre-filling invoice item from scan:", err);
          }
        };
        fetchInitialItem();
      }
    }
  }, [mode, lookupGst, type]);

  // Sync showEway check if editing and transporter/vehicle exists
  useEffect(() => {
    if (state.transporterName || state.vehicleNo) {
      setShowEway(true);
    }
  }, [state.transporterName, state.vehicleNo]);

  // Fetch dependancies via useERPQuery
  const { data: partiesData, isPending: loadingParties } = useERPQuery(["parties"], async () => {
    const res = await fetch("/api/parties?type=customer");
    if (!res.ok) throw new Error("Failed to load customers");
    return (await res.json()).parties || [];
  });

  const { data: designsData, isPending: loadingDesigns } = useERPQuery(["designs-list"], async () => {
    const res = await fetch("/api/master-data/designs");
    if (!res.ok) throw new Error("Failed to load designs");
    return (await res.json()).designs || [];
  });

  const { data: salesmenData } = useERPQuery(["settings-users"], async () => {
    const res = await fetch("/api/settings/users");
    if (!res.ok) throw new Error("Failed to load salesmen");
    return (await res.json()).users || [];
  });

  const { enableKachaBilling, enableGst } = useGeneralSettings();
  const effectiveType = (!enableKachaBilling && type === "kacha") ? "pakka" : type;

  const parties = partiesData || [];
  const designs = designsData || [];
  const salesmen = (salesmenData || []).filter((u: any) => u.role === "staff" || u.role === "admin" || u.role === "owner");

  // Determine interstate GST rules
  useEffect(() => {
    const checkInterstate = async () => {
      if (state.gstin && state.gstin.length >= 2) {
        // Fetch current business GSTIN to compare state codes
        const res = await fetch("/api/settings/general");
        if (res.ok) {
          const biz = (await res.json()).business;
          if (biz?.gstin && biz.gstin.trim().substring(0, 2) !== state.gstin.trim().substring(0, 2)) {
            state.setIsInterstate(true);
            return;
          }
        }
      }
      state.setIsInterstate(false);
    };
    checkInterstate();
  }, [state.gstin]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create / Update mutations
  const saveMutation = useERPMutation(
    async (payload: any) => {
      const endpoint = mode === "create" ? "/api/sales/bills" : `/api/sales/bills/${billId}`;
      const method = mode === "create" ? "POST" : "PUT";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save invoice");
      }
      return res.json();
    },
    {
      successMessage: mode === "create" ? "Invoice generated successfully!" : "Invoice updated successfully!",
      invalidates: [
        ["sales-bills"],
        ["sales-bill-detail", billId],
        ["finished-stock"],
        ["designs-list"],
        ["design-detail-filters"],
        ["design-stock-filters-section"],
        ["godowns-list"],
        ["dashboard-stats"],
        ["raw-materials-stock"],
        ["raw-materials"],
      ],
      onSuccess: (data: any) => {
        setIsSubmitting(false);
        const billObj = data?.data || data?.bill || data;
        const selectedParty = parties.find((p: any) => p.id === state.partyId);
        setCreatedInvoice({
          id: billObj?.id || billId || "",
          bill_number: billObj?.bill_number || "INV-SUCCESS",
          party_name: selectedParty?.name || selectedParty?.company_name || state.phone || undefined,
          phone: selectedParty?.phone || state.phone || undefined,
          grand_total: billObj?.grand_total ?? totals?.grand_total ?? 0,
          bill_type: effectiveType,
        });
        setSuccessModalOpen(true);
      },
      onError: () => {
        setIsSubmitting(false);
      },
    }
  );

  const handleSaveBill = (saveStatus: "active" | "draft", isTemporary: boolean = false) => {
    if (isSubmitting || saveMutation.isPending) return;
    if (state.items.length === 0) {
      toast.error("Please add at least one item to proceed");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      bill_type: effectiveType,
      party_id: state.partyId,
      bill_date: state.billDate,
      due_date: state.dueDate || null,
      payment_terms: state.paymentTerms || null,
      reference_no: state.referenceNo || null,
      billing_address: state.billingAddress || null,
      phone: state.phone || null,
      gstin: state.gstin || null,
      gst_treatment: state.gstTreatment,
      transporter_name: state.transporterName || null,
      vehicle_no: state.vehicleNo || null,
      salesman: state.salesman || null,
      remarks: state.remarks || null,
      is_temporary: isTemporary,
      // Consignee / Ship-To
      ship_to_same_as_bill_to: state.shipToSameAsBillTo,
      consignee_name: state.shipToSameAsBillTo ? null : (state.consigneeName || null),
      consignee_address: state.shipToSameAsBillTo ? null : (state.consigneeAddress || null),
      consignee_gstin: state.shipToSameAsBillTo ? null : (state.consigneeGstin || null),
      consignee_state: state.shipToSameAsBillTo ? null : (state.consigneeState || null),
      consignee_state_code: state.shipToSameAsBillTo ? null : (state.consigneeStateCode || null),
      // Dispatch details
      buyer_order_no: state.buyerOrderNo || null,
      buyer_order_date: state.buyerOrderDate || null,
      dispatch_doc_no: state.dispatchDocNo || null,
      delivery_note: state.deliveryNote || null,
      delivery_note_date: state.deliveryNoteDate || null,
      dispatched_through: state.dispatchedThrough || null,
      destination: state.destination || null,
      terms_of_delivery: state.termsOfDelivery || null,
      mode_of_payment: state.modeOfPayment || null,
      // Print exclusions
      print_exclusions: state.printExclusions || {},
      items: state.items.map((it: any) => ({
        item_type: it.item_type || (it.material_type_id ? "fabric" : "finished_goods"),
        design_id: it.design_id || null,
        material_type_id: it.material_type_id || null,
        item_name: it.item_name || null,
        colour_id: it.colour_id || null,
        size: it.size || null,
        size_quantities: it.size_quantities || (it.sizes ? it.sizes : null),
        quantity: Number(it.quantity || 0),
        unit: it.unit || "Pcs",
        rate: Number(it.rate || 0),
        discount_percent: Number(it.discount_percent || 0),
        tax_percent: Number(it.tax_percent || 0),
        amount: Number(it.amount || 0),
        cost_per_piece: Number(it.cost_per_piece || 0),
        description: it.description || null,
        hsn_sac: it.hsn_sac || null,
        rolls: it.rolls && Array.isArray(it.rolls) ? it.rolls : undefined,
      })),
      charges: state.charges.map((c: any) => ({
        charge_name: c.charge_name,
        charge_type: c.charge_type,
        is_taxable: c.is_taxable,
        amount: c.amount,
      })),
      discount_type: state.discountType,
      discount_value: state.discountValue,
      status: saveStatus,
    };

    saveMutation.mutate(payload);
  };

  const isInitialLoading = (mode === "edit" && loadingBill) || (loadingParties && parties.length === 0) || (loadingDesigns && designs.length === 0);

  if (isInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 gap-3">
        <Loader2 className="h-8 w-8 text-[#6366F1] animate-spin" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Syncing invoice editor...
        </span>
      </div>
    );
  }

  // Wizard Steps Configuration
  const steps = [
    { title: "Customer & Info", description: "Select customer and dates" },
    { title: "Line Items", description: "Add products, quantities & rates" },
    { title: "Totals & Calculation", description: "Reconcile tax splits and discounts" },
    { title: "Consignee & Dispatch", description: "Ship-to address & dispatch details" },
    { title: "Review & Save", description: "Print options, preview & publish" },
  ];

  // Billing party info for consignee pre-fill
  const selectedParty = parties.find((p: any) => p.id === state.partyId);
  const billingParty = selectedParty ? {
    name: selectedParty.company_name || selectedParty.name,
    address: state.billingAddress,
    gstin: state.gstin,
    state: "",
    state_code: "",
  } : undefined;

  // Print exclusion toggles definition
  const EXCLUSION_OPTIONS = [
    { key: "excludeBuyerOrderNo", label: "Buyer's Order No." },
    { key: "excludeBuyerOrderDate", label: "Buyer Order Date" },
    { key: "excludeDispatchDocNo", label: "Dispatch Doc No." },
    { key: "excludeDeliveryNote", label: "Delivery Note" },
    { key: "excludeModeOfPayment", label: "Mode / Terms of Payment" },
    { key: "excludeDispatchedThrough", label: "Dispatched Through" },
    { key: "excludeDestination", label: "Destination" },
    { key: "excludeTermsOfDelivery", label: "Terms of Delivery" },
    { key: "excludeHsnTable", label: "HSN/SAC Summary Table" },
    { key: "excludeTermsConditions", label: "Terms & Conditions" },
    { key: "excludeBankDetails", label: "Bank Details" },
    { key: "excludeDeclaration", label: "Declaration" },
    { key: "excludeSignatory", label: "Authorised Signatory" },
  ] as const;

  const toggleExclusion = (key: string) => {
    state.setPrintExclusions((prev: Record<string, boolean>) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Build preview bill data from current state
  const previewBillData = {
    bill_number: "PREVIEW",
    bill_date: state.billDate,
    due_date: state.dueDate,
    payment_terms: state.paymentTerms,
    billing_address: state.billingAddress,
    phone: state.phone,
    gstin: state.gstin,
    ship_to_same_as_bill_to: state.shipToSameAsBillTo,
    consignee_name: state.consigneeName,
    consignee_address: state.consigneeAddress,
    consignee_gstin: state.consigneeGstin,
    consignee_state: state.consigneeState,
    consignee_state_code: state.consigneeStateCode,
    buyer_order_no: state.buyerOrderNo,
    dispatch_doc_no: state.dispatchDocNo,
    delivery_note: state.deliveryNote,
    delivery_note_date: state.deliveryNoteDate,
    dispatched_through: state.dispatchedThrough,
    destination: state.destination,
    terms_of_delivery: state.termsOfDelivery,
    mode_of_payment: state.modeOfPayment,
    item_total: totals.item_total,
    charges_total: totals.charges_total,
    discount_amount: totals.discount_amount,
    taxable_amount: totals.taxable_amount,
    cgst: totals.cgst,
    sgst: totals.sgst,
    igst: totals.igst,
    round_off: totals.round_off,
    grand_total: totals.grand_total,
    party: {
      name: selectedParty?.name || "",
      company_name: selectedParty?.company_name,
      gstin: state.gstin || selectedParty?.gstin,
      phone: state.phone || selectedParty?.phone,
      billing_address_line1: state.billingAddress || selectedParty?.billing_address_line1,
      billing_state: (selectedParty as any)?.billing_state || (selectedParty as any)?.state,
    },
    items: state.items.map((it: any) => {
      const design = designs.find((d: any) => d.id === it.design_id);
      const colour = design?.design_colours?.find((c: any) => c.id === it.colour_id);
      return {
        ...it,
        design: design
          ? { id: design.id, design_number: design.design_number, name: design.name, hsn_sac: design.hsn_sac }
          : it.design,
        design_code: it.design_code || design?.design_number,
        colour_name: it.colour_name || colour?.colour_name,
        hsn_sac: it.hsn_sac || design?.hsn_sac || "—",
      };
    }),
    charges: state.charges,
  };

  const companyProfile = {
    name: business?.name || (brandData?.brand?.name) || "",
    address: business?.address || (brandData?.brand?.address) || "",
    gstin: business?.gstin || (brandData?.brand?.gstin) || "",
    phone: business?.phone || (brandData?.brand?.phone) || "",
    email: (business as any)?.email || (brandData?.brand?.email) || "",
  };

  const brandConfig = billConfigData?.config || brandData?.brandConfig || null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-3.5 sm:p-6 pb-20 md:pb-6 bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-sm)]">

      {/* Back button and title */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/sales/bills")}
          className="border-[var(--border)] text-[var(--text-body)] hover:bg-[var(--page-bg)]"
        >
          <ArrowLeft size={16} className="mr-1.5" />
          <span>Back</span>
        </Button>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] capitalize">
            {mode} {type} Invoice
          </h1>
          <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider mt-0.5">
            Step {step} of 5: {steps[step - 1].title}
          </p>
        </div>
      </div>

      <WizardHeader steps={steps} currentStep={step} />

      <div className="pt-6 border-t border-[var(--border-light)] min-h-[300px]">
        {step === 1 && (
          <CustomerSection state={state} parties={parties} salesmen={salesmen} />
        )}
        {step === 2 && (
          <ItemsTable state={state} designs={designs} />
        )}
        {step === 3 && (
          <TotalsPanel state={state} totals={totals} />
        )}
        {step === 4 && (
          <ConsigneeSection state={state} billingParty={billingParty} />
        )}
        {step === 5 && (
          <div className="space-y-6">
            {/* Preview Bill Button + Step Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider font-mono">Review &amp; Save</h3>
              <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary-light)] text-xs font-bold transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview Bill
              </button>
            </div>

            <BillValidation state={state} />

            <div className="border border-[var(--border)] rounded-xl p-6 bg-[var(--card-bg)] space-y-6">
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider font-mono">Review Details</h3>
              
              {/* Invoice Overview */}
              <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-4 space-y-3">
                <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-widest block font-mono">Invoice Overview</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] font-bold block uppercase">Customer</span>
                    <span className="text-xs font-bold text-[var(--text-primary)] capitalize">
                      {parties.find((p: any) => p.id === state.partyId)?.name || "Unknown"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] font-bold block uppercase">GSTIN</span>
                    <span className="text-xs font-bold text-[var(--text-primary)] font-mono">
                      {state.gstin || "URP"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] font-bold block uppercase">Bill Date</span>
                    <span className="text-xs font-bold text-[var(--text-primary)] font-mono">
                      {state.billDate}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] font-bold block uppercase">Payment Terms</span>
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {state.paymentTerms || "None Listed"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Table Overview */}
              <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                <div className="bg-[var(--table-header-bg)] border-b border-[var(--border)] p-3">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest block font-mono">Items In Invoice ({state.items.length})</span>
                </div>

                {/* Mobile View: Item Cards */}
                <div className="md:hidden divide-y divide-[var(--border)] bg-[var(--card-bg)]">
                  {state.items.map((it: any, idx: number) => {
                    const design = designs.find((d: any) => d.id === it.design_id);
                    const colour = design?.design_colours?.find((c: any) => c.id === it.colour_id);
                    const isFabric = it.item_type === "fabric" || !!it.material_type_id || !!it.material_type;
                    const itemName = it.item_name || design?.name || (isFabric ? "Fabric Material" : "Item");
                    const itemCode = it.design_code || design?.design_number;

                    let detailsDisplay = colour?.colour_name || it.colour_name || "—";
                    if (isFabric) {
                      if (it.rolls?.length) {
                        detailsDisplay = `${it.rolls.length} Rolls: ` + it.rolls.map((r: any) => `#${r.roll_number} (${r.meters}m)`).join(", ");
                      } else {
                        detailsDisplay = it.description || "Fabric Material";
                      }
                    } else if (it.size_quantities && Object.keys(it.size_quantities).length > 0) {
                      const sq = Object.entries(it.size_quantities)
                        .filter(([, q]) => Number(q) > 0)
                        .map(([s, q]) => `${s}:${q}`)
                        .join(", ");
                      if (sq) detailsDisplay += ` [Sizes: ${sq}]`;
                    }

                    return (
                      <div key={idx} className="p-3 space-y-1.5 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-bold text-[var(--text-primary)] font-mono">{itemName}</span>
                            {itemCode && <span className="text-[10px] text-[var(--text-muted)] block font-sans">Art: {itemCode}</span>}
                          </div>
                          <span className="font-bold font-mono text-[var(--primary)] text-sm">₹{it.amount}</span>
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)]">{detailsDisplay}</div>
                        <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] border-t border-[var(--border-light)] pt-1">
                          <span>Size: <strong className="text-[var(--text-primary)]">{it.size || (isFabric ? "Meters" : "Pcs")}</strong></span>
                          <span>Qty: <strong className="text-[var(--text-primary)]">{it.quantity} {it.unit || (isFabric ? "MTR" : "PCS")}</strong></span>
                          <span>Rate: <strong className="text-[var(--text-primary)]">₹{it.rate}</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop View: Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[10px] text-[var(--text-muted)] uppercase font-mono font-bold tracking-wider">
                        <th className="py-2 px-3">Item</th>
                        <th className="py-2 px-3">Details</th>
                        <th className="py-2 px-3">Size</th>
                        <th className="py-2 px-3 text-right">Qty</th>
                        <th className="py-2 px-3 text-right">Rate</th>
                        <th className="py-2 px-3 text-right">Dis %</th>
                        {effectiveType === "pakka" && <th className="py-2 px-3 text-right">Tax %</th>}
                        <th className="py-2 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] font-medium text-[var(--text-primary)]">
                      {state.items.map((it: any, idx: number) => {
                        const design = designs.find((d: any) => d.id === it.design_id);
                        const colour = design?.design_colours?.find((c: any) => c.id === it.colour_id);
                        const isFabric = it.item_type === "fabric" || !!it.material_type_id || !!it.material_type;
                        const itemName = it.item_name || design?.name || (isFabric ? "Fabric Material" : "Item");
                        const itemCode = it.design_code || design?.design_number;

                        let detailsDisplay = colour?.colour_name || it.colour_name || "—";
                        if (isFabric) {
                          if (it.rolls?.length) {
                            detailsDisplay = `${it.rolls.length} Rolls: ` + it.rolls.map((r: any) => `#${r.roll_number} (${r.meters}m)`).join(", ");
                          } else {
                            detailsDisplay = it.description || "Fabric Material";
                          }
                        } else if (it.size_quantities && Object.keys(it.size_quantities).length > 0) {
                          const sq = Object.entries(it.size_quantities)
                            .filter(([, q]) => Number(q) > 0)
                            .map(([s, q]) => `${s}:${q}`)
                            .join(", ");
                          if (sq) detailsDisplay += ` [Sizes: ${sq}]`;
                        }

                        return (
                          <tr key={idx} className="hover:bg-[var(--table-row-hover)] transition-colors">
                            <td className="py-2 px-3 text-[var(--primary)] font-mono font-bold">
                              {itemName}
                              {itemCode && <span className="text-[10px] text-[var(--text-muted)] font-normal block font-sans">Art: {itemCode}</span>}
                            </td>
                            <td className="py-2 px-3 text-[var(--text-secondary)]">{detailsDisplay}</td>
                            <td className="py-2 px-3 font-mono">{it.size || (isFabric ? "Meters" : "Pcs")}</td>
                            <td className="py-2 px-3 text-right font-mono">{it.quantity} {it.unit || (isFabric ? "MTR" : "PCS")}</td>
                            <td className="py-2 px-3 text-right font-mono">₹{it.rate}</td>
                            <td className="py-2 px-3 text-right font-mono">{it.discount_percent || 0}%</td>
                            {effectiveType === "pakka" && <td className="py-2 px-3 text-right font-mono">{it.tax_percent || 0}%</td>}
                            <td className="py-2 px-3 text-right font-mono font-bold">₹{it.amount}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Summary */}
              <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-4 space-y-2">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest block font-mono">Financial Summary</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-semibold">
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] font-bold block uppercase">Sub Total</span>
                    <span className="text-xs font-bold text-[var(--text-primary)] font-mono">₹{totals.sub_total.toFixed(2)}</span>
                  </div>
                  {effectiveType === "pakka" && (
                    <>
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)] font-bold block uppercase">Taxable Amount</span>
                        <span className="text-xs font-bold text-[var(--text-primary)] font-mono">₹{totals.taxable_amount.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)] font-bold block uppercase">GST Total</span>
                        <span className="text-xs font-bold text-[var(--text-primary)] font-mono">₹{(totals.cgst + totals.sgst + totals.igst).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  {effectiveType === "kacha" && (
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] font-bold block uppercase">Round Off</span>
                      <span className="text-xs font-bold text-[var(--text-primary)] font-mono">₹{(totals.round_off || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-lg p-2 flex flex-col justify-center">
                    <span className="text-[9px] text-[var(--primary)] font-bold block uppercase">Grand Total</span>
                    <span className="text-sm font-black text-indigo-700 dark:text-indigo-300 font-mono">₹{totals.grand_total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Print Display Options */}
              <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-4 space-y-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-[var(--text-primary)] block">Print Display Options</span>
                  <p className="text-[10px] text-[var(--text-muted)] leading-normal">
                    Uncheck items you want to <span className="font-bold">exclude</span> from the printed bill. Changes apply to print/preview only.
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-[var(--border-light)]">
                  {EXCLUSION_OPTIONS.filter((opt) => effectiveType === "pakka" || opt.key !== "excludeHsnTable").map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer select-none group">
                      <input
                        type="checkbox"
                        checked={!state.printExclusions[key]}
                        onChange={() => toggleExclusion(key)}
                        className="w-3.5 h-3.5 rounded accent-[var(--primary)] cursor-pointer"
                      />
                      <span className={`text-[10px] font-semibold transition-colors ${
                        state.printExclusions[key]
                          ? "line-through text-[var(--text-faint)]"
                          : "text-[var(--text-body)]"
                      }`}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-4 p-4 border border-[var(--border)] rounded-xl bg-[var(--page-bg)]">
              <div className="flex-1 space-y-1">
                <span className="text-xs font-bold text-[var(--text-primary)] block">Save as Draft</span>
                <p className="text-xs text-[var(--text-muted)] leading-normal">
                  Keeps the invoice in draft status so it won&apos;t impact general ledgers or statistics yet.
                </p>
              </div>
              <Button
                onClick={() => handleSaveBill("draft")}
                disabled={saveMutation.isPending}
                variant="outline"
                className="self-center border-[var(--border)] hover:bg-[var(--table-row-hover)] font-bold text-[var(--text-primary)]"
              >
                Save Draft
              </Button>
            </div>

            <div className="flex gap-4 p-4 border border-[var(--border)] rounded-xl bg-[var(--page-bg)]">
              <div className="flex-1 space-y-1">
                <span className="text-xs font-bold text-[var(--text-primary)] block">Save as Temporary Bill (Dummy Bill)</span>
                <p className="text-xs text-[var(--text-muted)] leading-normal">
                  Creates a temporary invoice (TEMP-2026-07-XXX) for reference/quotation. Does NOT affect stock, customer accounts, or sales statistics.
                </p>
              </div>
              <Button
                onClick={() => handleSaveBill("active", true)}
                disabled={isSubmitting || saveMutation.isPending || !state.partyId || state.items.length === 0}
                variant="outline"
                className="self-center border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary-light)] font-bold"
              >
                {(isSubmitting || saveMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <span>Save as Temporary Bill</span>
              </Button>
            </div>

            <div className="flex gap-4 p-4 border border-[var(--primary-light)] rounded-xl bg-[var(--primary-light)]/30">
              <div className="flex-1 space-y-1">
                <span className="text-xs font-bold text-[var(--text-primary)] block">
                  {mode === "edit" ? "Save & Update Sales Bill" : "Finalize & Generate Invoice"}
                </span>
                <p className="text-xs text-[var(--text-muted)] leading-normal">
                  {mode === "edit"
                    ? "Saves all updated items, charges, totals, and customer details for this invoice."
                    : "Publishes the invoice. This generates a sequential bill number and registers financial entries."}
                </p>
              </div>
              <Button
                onClick={() => handleSaveBill("active", false)}
                disabled={isSubmitting || saveMutation.isPending || !state.partyId || state.items.length === 0}
                className="self-center bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold"
              >
                {(isSubmitting || saveMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <span>{mode === "edit" ? "Update Sales Bill" : "Generate Invoice"}</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Navigation Buttons */}
      <div className="hidden md:flex flex-wrap justify-between items-center pt-6 border-t border-[var(--border-light)] mt-6 select-none gap-3">
        <Button
          variant="outline"
          disabled={step === 1}
          onClick={() => setStep((s) => Math.max(s - 1, 1))}
          className="border-[var(--border)] text-[var(--text-body)] font-bold"
        >
          Previous Step
        </Button>

        <div className="flex items-center gap-2">
          {step === 5 && (
            <>
              <Button
                onClick={() => handleSaveBill("draft")}
                disabled={isSubmitting || saveMutation.isPending}
                variant="outline"
                className="border-[var(--border)] text-[var(--text-body)] font-bold"
              >
                Save Draft
              </Button>

              <Button
                onClick={() => handleSaveBill("active", true)}
                disabled={isSubmitting || saveMutation.isPending || !state.partyId || state.items.length === 0}
                variant="outline"
                className="border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary-light)] font-bold"
              >
                {(isSubmitting || saveMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <span>Save Temporary</span>
              </Button>

              <Button
                onClick={() => handleSaveBill("active", false)}
                disabled={isSubmitting || saveMutation.isPending || !state.partyId || state.items.length === 0}
                className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold"
              >
                {(isSubmitting || saveMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <span>{mode === "edit" ? "Update Bill" : "Generate Invoice"}</span>
              </Button>
            </>
          )}

          {step < 5 && (
            <Button
              onClick={() => setStep((s) => Math.min(s + 1, 5))}
              disabled={step === 1 && !state.partyId}
              className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold"
            >
              Next Step
            </Button>
          )}
        </div>
      </div>

      {/* ── MOBILE STICKY BOTTOM ACTION BAR ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--card-bg)] border-t border-[var(--border)] p-3 flex items-center justify-between gap-2 shadow-lg">
        <Button
          variant="outline"
          disabled={step === 1}
          onClick={() => setStep((s) => Math.max(s - 1, 1))}
          className="border-[var(--border)] text-[var(--text-body)] font-bold text-xs h-10 px-3"
        >
          Previous
        </Button>

        {step < 5 ? (
          <Button
            onClick={() => setStep((s) => Math.min(s + 1, 5))}
            disabled={step === 1 && !state.partyId}
            className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold text-xs h-10 px-5 flex-1 max-w-[180px]"
          >
            Next Step
          </Button>
        ) : (
          <Button
            onClick={() => handleSaveBill("active", false)}
            disabled={isSubmitting || saveMutation.isPending || !state.partyId || state.items.length === 0}
            className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold text-xs h-10 px-4 flex-1"
          >
            {(isSubmitting || saveMutation.isPending) && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin inline" />}
            <span>{mode === "edit" ? "Update Bill" : "Generate Invoice"}</span>
          </Button>
        )}
      </div>


      {/* Preview Bill Modal */}
      {previewOpen && (
        <Modal
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          title="Bill Preview"
          description={`This is how your ${effectiveType === "kacha" ? "Kaccha Bill" : "Pakka Tax Invoice"} will look when printed.`}
          maxWidth="max-w-4xl"
        >
          <div className="overflow-auto max-h-[75vh] p-2">
            {effectiveType === "kacha" ? <KachaBillTemplate
              bill={previewBillData as any}
              company={companyProfile}
              config={brandConfig}
              exclusions={state.printExclusions}
              logoUrl={getEffectiveLogo(brandData?.brand?.logo_url)}
            /> : <PakkaBillTemplate
              bill={previewBillData as any}
              company={companyProfile}
              config={brandConfig}
              exclusions={state.printExclusions}
              logoUrl={getEffectiveLogo(brandData?.brand?.logo_url)}
            />}
          </div>
        </Modal>
      )}

      {/* Success Modal with Preview, Print, Download options */}
      <PostInvoiceSuccessModal
        open={successModalOpen}
        onOpenChange={setSuccessModalOpen}
        invoice={createdInvoice}
        onCreateAnother={() => {
          setCreatedInvoice(null);
          setStep(1);
          state.setItems([]);
          state.setPartyId("");
          state.setReferenceNo("");
          state.setRemarks("");
        }}
      />
    </div>
  );
}
