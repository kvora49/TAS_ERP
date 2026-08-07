"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSalesBill } from "@/hooks/useSalesBill";
import { CustomerSection } from "./CustomerSection";
import { ItemsTable } from "./ItemsTable";
import { TotalsPanel } from "./TotalsPanel";
import { BillValidation } from "./BillValidation";
import { useERPQuery, useERPMutation } from "@/hooks/useERPQuery";
import { toast } from "sonner";
import WizardHeader from "@/components/shared/WizardHeader";
import { PostInvoiceSuccessModal, CreatedInvoiceInfo } from "./PostInvoiceSuccessModal";
import { useGeneralSettings } from "@/hooks/useGeneralSettings";

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

  // Initialize unified state hook
  const { state, totals, loading: loadingBill } = useSalesBill(billId);

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
                rate: Number(price || stk.designs?.sale_price || 0),
                unit: "Pcs",
                discount_percent: 0,
                tax_percent: 0,
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
  }, [mode]);

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
      invalidates: [["sales-bills"], ["sales-bill-detail", billId]],
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
      transporter_name: showEway ? (state.transporterName || null) : null,
      vehicle_no: showEway ? (state.vehicleNo || null) : null,
      salesman: state.salesman || null,
      remarks: state.remarks || null,
      is_temporary: isTemporary,
      items: state.items.map((it: any) => ({
        item_type: it.item_type || (it.material_type_id ? "fabric" : "finished_goods"),
        design_id: it.design_id || null,
        material_type_id: it.material_type_id || null,
        item_name: it.item_name || null,
        colour_id: it.colour_id || null,
        size: it.size || null,
        quantity: it.quantity,
        unit: it.unit || "Pcs",
        rate: it.rate,
        discount_percent: it.discount_percent || 0,
        tax_percent: it.tax_percent || 0,
        amount: it.amount,
        cost_per_piece: it.cost_per_piece || 0,
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
    { title: "Review & Save", description: "Final validation & publish" },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-6 pb-20 md:pb-6 bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-sm)]">

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
            Step {step} of 4: {steps[step - 1].title}
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
          <div className="space-y-6">
            <BillValidation state={state} />

            <div className="border border-[var(--border)] rounded-xl p-6 bg-[var(--card-bg)] space-y-6">
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider font-mono">Review & E-Way Details</h3>
              
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
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[10px] text-[var(--text-muted)] uppercase font-mono font-bold tracking-wider">
                      <th className="py-2 px-3">Design</th>
                      <th className="py-2 px-3">Colour</th>
                      <th className="py-2 px-3">Size</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3 text-right">Rate</th>
                      <th className="py-2 px-3 text-right">Dis %</th>
                      <th className="py-2 px-3 text-right">Tax %</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] font-medium text-[var(--text-primary)]">
                    {state.items.map((it: any, idx: number) => {
                      const design = designs.find((d: any) => d.id === it.design_id);
                      const colour = design?.design_colours?.find((c: any) => c.id === it.colour_id);
                      return (
                        <tr key={idx} className="hover:bg-[var(--table-row-hover)] transition-colors">
                          <td className="py-2 px-3 text-[var(--primary)] font-mono font-bold">{design?.design_number || "Unknown"}</td>
                          <td className="py-2 px-3 text-[var(--text-secondary)]">{colour?.colour_name || "—"}</td>
                          <td className="py-2 px-3 font-mono">{it.size}</td>
                          <td className="py-2 px-3 text-right font-mono">{it.quantity}</td>
                          <td className="py-2 px-3 text-right font-mono">₹{it.rate}</td>
                          <td className="py-2 px-3 text-right font-mono">{it.discount_percent}%</td>
                          <td className="py-2 px-3 text-right font-mono">{it.tax_percent}%</td>
                          <td className="py-2 px-3 text-right font-mono font-bold">₹{it.amount}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-4 space-y-2">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest block font-mono">Financial Summary</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-semibold">
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] font-bold block uppercase">Sub Total</span>
                    <span className="text-xs font-bold text-[var(--text-primary)] font-mono">₹{totals.sub_total.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] font-bold block uppercase">Taxable Amount</span>
                    <span className="text-xs font-bold text-[var(--text-primary)] font-mono">₹{totals.taxable_amount.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] font-bold block uppercase">GST Total</span>
                    <span className="text-xs font-bold text-[var(--text-primary)] font-mono">₹{(totals.cgst + totals.sgst + totals.igst).toFixed(2)}</span>
                  </div>
                  <div className="bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-lg p-2 flex flex-col justify-center">
                    <span className="text-[9px] text-[var(--primary)] font-bold block uppercase">Grand Total</span>
                    <span className="text-sm font-black text-indigo-700 dark:text-indigo-300 font-mono">₹{totals.grand_total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* E-way details toggle and inputs */}
              <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-[var(--text-primary)] block">Generate E-Way Bill details</span>
                    <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider leading-normal">
                      Include e-way transport and vehicle details with this invoice
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showEway}
                      onChange={(e) => setShowEway(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--primary)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--primary)]"></div>
                  </label>
                </div>

                {showEway && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[var(--border-light)] animate-in slide-in-from-top-2 duration-150">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">Transporter Name</label>
                      <input
                        type="text"
                        value={state.transporterName}
                        onChange={(e) => state.setTransporterName(e.target.value)}
                        className="w-full h-9 rounded-lg border border-[var(--input-border)] px-3 text-xs focus:ring-1 focus:ring-[var(--input-focus)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] transition-colors"
                        placeholder="e.g. VRL Logistics"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">Vehicle Number</label>
                      <input
                        type="text"
                        value={state.vehicleNo}
                        onChange={(e) => state.setVehicleNo(e.target.value)}
                        className="w-full h-9 rounded-lg border border-[var(--input-border)] px-3 text-xs focus:ring-1 focus:ring-[var(--input-focus)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] transition-colors"
                        placeholder="e.g. GJ-01-XX-1234"
                      />
                    </div>
                  </div>
                )}
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
          {step === 4 && (
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

          {step < 4 && (
            <Button
              onClick={() => setStep((s) => Math.min(s + 1, 4))}
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

        {step < 4 ? (
          <Button
            onClick={() => setStep((s) => Math.min(s + 1, 4))}
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
