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

interface SalesBillEditorProps {
  mode: "create" | "edit";
  billId?: string;
  type?: "pakka" | "kacha";
}

export function SalesBillEditor({ mode, billId, type = "pakka" }: SalesBillEditorProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);

  const [showEway, setShowEway] = useState(false);

  // Initialize unified state hook
  const { state, totals, loading: loadingBill } = useSalesBill(billId);

  // Set default type if creating
  useEffect(() => {
    if (mode === "create") {
      state.setGstTreatment(type === "pakka" ? "regular" : "exempt");
    }
  }, [mode, type]);

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

  // Create / Update mutations
  const saveMutation = useERPMutation(
    async (payload: any) => {
      const url = mode === "create" ? "/api/sales/bills" : `/api/sales/bills/${billId}`;
      const method = mode === "create" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save invoice");
      }
      return res.json();
    },
    {
      successMessage: mode === "create" ? "Invoice generated successfully!" : "Invoice updated successfully!",
      invalidates: [["sales-bills"], ["sales-bill-detail", billId]],
      onSuccess: () => {
        router.push("/sales/bills");
        router.refresh();
      },
    }
  );

  const handleSaveBill = (saveStatus: "active" | "draft") => {
    if (state.items.length === 0) {
      toast.error("Please add at least one item to proceed");
      return;
    }

    const payload = {
      bill_type: type,
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
      items: state.items.map((it: any) => ({
        design_id: it.design_id,
        colour_id: it.colour_id,
        size: it.size,
        quantity: it.quantity,
        unit: it.unit || "Pcs",
        rate: it.rate,
        discount_percent: it.discount_percent || 0,
        tax_percent: it.tax_percent || 0,
        amount: it.amount,
        cost_per_piece: it.cost_per_piece || 0,
        description: it.description || null,
        hsn_sac: it.hsn_sac || null,
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

  if (loadingBill || loadingParties || loadingDesigns) {
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
    <div className="space-y-6 max-w-5xl mx-auto p-6 bg-white border border-[#E5E7EB] rounded-2xl shadow-sm">
      {/* Back button and title */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/sales/bills")}
          className="border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft size={16} className="mr-1.5" />
          <span>Back</span>
        </Button>
        <div>
          <h1 className="text-xl font-bold text-slate-800 capitalize">
            {mode} {type} Invoice
          </h1>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
            Step {step} of 4: {steps[step - 1].title}
          </p>
        </div>
      </div>

      <WizardHeader steps={steps} currentStep={step} />

      <div className="pt-6 border-t border-slate-100 min-h-[300px]">
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

            <div className="border border-[#E2E8F0] rounded-xl p-6 bg-white space-y-6">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-mono">Review & E-Way Details</h3>
              
              {/* Invoice Overview */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Invoice Overview</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Customer</span>
                    <span className="text-xs font-bold text-slate-800 capitalize">
                      {parties.find((p: any) => p.id === state.partyId)?.name || "Unknown"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">GSTIN</span>
                    <span className="text-xs font-bold text-slate-800 font-mono">
                      {state.gstin || "URP"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Bill Date</span>
                    <span className="text-xs font-bold text-slate-800 font-mono">
                      {state.billDate}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Payment Terms</span>
                    <span className="text-xs font-bold text-slate-800">
                      {state.paymentTerms || "None Listed"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Table Overview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 p-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Items In Invoice ({state.items.length})</span>
                </div>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200 text-[10px] text-slate-400 uppercase font-mono font-bold tracking-wider">
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
                  <tbody>
                    {state.items.map((it: any, idx: number) => {
                      const design = designs.find((d: any) => d.id === it.design_id);
                      const colour = design?.design_colours?.find((c: any) => c.id === it.colour_id);
                      return (
                        <tr key={idx} className="border-b border-slate-100 font-medium">
                          <td className="py-2 px-3 text-indigo-600 font-mono font-bold">{design?.design_number || "Unknown"}</td>
                          <td className="py-2 px-3 text-slate-600">{colour?.colour_name || "—"}</td>
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
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Financial Summary</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Sub Total</span>
                    <span className="text-xs font-bold text-slate-800 font-mono">₹{totals.sub_total.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Taxable Amount</span>
                    <span className="text-xs font-bold text-slate-800 font-mono">₹{totals.taxable_amount.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">GST Total</span>
                    <span className="text-xs font-bold text-slate-800 font-mono">₹{(totals.cgst + totals.sgst + totals.igst).toFixed(2)}</span>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2 flex flex-col justify-center">
                    <span className="text-[9px] text-[#6366F1] font-bold block uppercase">Grand Total</span>
                    <span className="text-sm font-black text-indigo-700 font-mono">₹{totals.grand_total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* E-way details toggle and inputs */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 block">Generate E-Way Bill details</span>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-normal">
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
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {showEway && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200/60 animate-in slide-in-from-top-2 duration-150">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider font-mono">Transporter Name</label>
                      <input
                        type="text"
                        value={state.transporterName}
                        onChange={(e) => state.setTransporterName(e.target.value)}
                        className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:ring-1 focus:ring-indigo-500 bg-white"
                        placeholder="e.g. VRL Logistics"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider font-mono">Vehicle Number</label>
                      <input
                        type="text"
                        value={state.vehicleNo}
                        onChange={(e) => state.setVehicleNo(e.target.value)}
                        className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:ring-1 focus:ring-indigo-500 bg-white"
                        placeholder="e.g. GJ-01-XX-1234"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-4 p-4 border border-[#E2E8F0] rounded-xl bg-slate-50">
              <div className="flex-1 space-y-1">
                <span className="text-xs font-bold text-slate-700 block">Save as Draft</span>
                <p className="text-xs text-slate-500 leading-normal">
                  Keeps the invoice in draft status so it won&apos;t impact general ledgers or statistics yet.
                </p>
              </div>
              <Button
                onClick={() => handleSaveBill("draft")}
                disabled={saveMutation.isPending}
                variant="outline"
                className="self-center border-slate-300 hover:bg-slate-100 font-bold"
              >
                Save Draft
              </Button>
            </div>

            <div className="flex gap-4 p-4 border border-indigo-100 rounded-xl bg-indigo-50/50">
              <div className="flex-1 space-y-1">
                <span className="text-xs font-bold text-slate-800 block">Finalize & Generate Invoice</span>
                <p className="text-xs text-slate-500 leading-normal">
                  Publishes the invoice. This generates a sequential bill number and registers financial entries.
                </p>
              </div>
              <Button
                onClick={() => handleSaveBill("active")}
                disabled={saveMutation.isPending || !state.partyId || state.items.length === 0}
                className="self-center bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold"
              >
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <span>Generate Invoice</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Navigation Buttons */}
      <div className="flex justify-between items-center pt-6 border-t border-slate-100 mt-6 select-none">
        <Button
          variant="outline"
          disabled={step === 1}
          onClick={() => setStep((s) => Math.max(s - 1, 1))}
          className="border-slate-200 text-slate-600 font-bold"
        >
          Previous Step
        </Button>

        {step < 4 ? (
          <Button
            onClick={() => setStep((s) => Math.min(s + 1, 4))}
            disabled={step === 1 && !state.partyId}
            className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold"
          >
            Next Step
          </Button>
        ) : null}
      </div>
    </div>
  );
}
