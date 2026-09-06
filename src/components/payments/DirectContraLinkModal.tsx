"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Link as LinkIcon, Info } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import AsyncButton from "@/components/shared/AsyncButton";

interface DirectContraLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DirectContraLinkModal({
  open,
  onOpenChange,
}: DirectContraLinkModalProps) {
  const queryClient = useQueryClient();

  const [sourcePartyId, setSourcePartyId] = useState<string>("");
  const [sourceBillId, setSourceBillId] = useState<string>("");
  const [targetPartyId, setTargetPartyId] = useState<string>("");
  const [targetBillId, setTargetBillId] = useState<string>("");
  const [targetBillType, setTargetBillType] = useState<string>("purchase_bill");
  const [linkedAmount, setLinkedAmount] = useState<number>(0);
  const [remarks, setRemarks] = useState<string>("");

  // Reset local state when modal opens
  useEffect(() => {
    if (open) {
      setSourcePartyId("");
      setSourceBillId("");
      setTargetPartyId("");
      setTargetBillId("");
      setLinkedAmount(0);
      setRemarks("");
    }
  }, [open]);

  // Fetch workspace parties
  const { data: workspaceData } = useQuery<{ parties: any[] }>({
    queryKey: ["payments-workspace-init"],
    queryFn: async () => {
      const res = await fetch("/api/payments");
      if (!res.ok) throw new Error("Failed to load parties");
      return res.json();
    },
    enabled: open,
  });

  const parties = workspaceData?.parties || [];
  const customers = parties.filter((p) => p.type?.includes("customer"));
  const suppliersAndWorkers = parties.filter((p) => p.type?.includes("supplier") || p.type?.includes("worker"));

  // Fetch source customer bills
  const { data: sourceBillsData } = useQuery<{ bills: any[] }>({
    queryKey: ["source-customer-bills", sourcePartyId],
    queryFn: async () => {
      if (!sourcePartyId) return { bills: [] };
      const res = await fetch(`/api/payments?party_id=${sourcePartyId}`);
      if (!res.ok) throw new Error("Failed to load customer bills");
      return res.json();
    },
    enabled: open && !!sourcePartyId,
  });

  // Fetch target supplier/worker bills
  const { data: targetBillsData } = useQuery<{ bills: any[] }>({
    queryKey: ["target-supplier-bills", targetPartyId],
    queryFn: async () => {
      if (!targetPartyId) return { bills: [] };
      const res = await fetch(`/api/payments?party_id=${targetPartyId}`);
      if (!res.ok) throw new Error("Failed to load supplier bills");
      return res.json();
    },
    enabled: open && !!targetPartyId,
  });

  const sourceBills = sourceBillsData?.bills || [];
  const targetBills = targetBillsData?.bills || [];

  const selectedSourceBill = sourceBills.find((b) => b.id === sourceBillId);
  const selectedTargetBill = targetBills.find((b) => b.id === targetBillId);

  // Auto-set suggested link amount when target bill is selected
  useEffect(() => {
    if (selectedTargetBill) {
      setTargetBillType(selectedTargetBill.bill_type || "purchase_bill");
      if (selectedSourceBill) {
        setLinkedAmount(Math.min(selectedSourceBill.outstanding, selectedTargetBill.outstanding));
      } else {
        setLinkedAmount(selectedTargetBill.outstanding);
      }
    }
  }, [sourceBillId, targetBillId, selectedSourceBill, selectedTargetBill]);

  // Direct Link Mutation
  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!sourcePartyId) throw new Error("Please select a Customer (Source Party)");
      if (!targetPartyId) throw new Error("Please select a Supplier / Worker (Target Party)");
      if (linkedAmount <= 0) throw new Error("Please enter a valid linked amount");

      const payload = {
        action: "direct_contra_link",
        source_party_id: sourcePartyId,
        source_bill_id: sourceBillId || null,
        target_party_id: targetPartyId,
        target_bill_id: targetBillId || null,
        target_bill_type: targetBillType,
        linked_amount: Number(linkedAmount),
        remarks,
      };

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to execute direct contra link");
      return data;
    },
    onSuccess: () => {
      toast.success("Direct Customer-to-Supplier Contra Link executed successfully");
      queryClient.invalidateQueries({ queryKey: ["payments-list"] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to link payments");
    },
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Direct Customer-to-Supplier Contra Link"
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6">
        {/* Info Banner */}
        <div className="p-3 bg-[var(--primary-light)] border border-[var(--primary)]/30 rounded-xl flex items-start gap-2 text-xs text-[var(--text-primary)]">
          <Info className="w-4 h-4 text-[var(--primary)] shrink-0 mt-0.5" />
          <div>
            <strong>Direct Contra Settlement:</strong> Links an incoming customer payment or credit directly to pay off a supplier or job worker invoice without creating duplicate bank/cash transactions. Both party ledgers update automatically.
          </div>
        </div>

        {/* Source & Target Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Source Customer */}
          <div className="p-4 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--primary)] flex items-center gap-1.5">
              <span>Source (Customer)</span>
            </h4>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-muted)]">Customer *</label>
              <select
                value={sourcePartyId}
                onChange={(e) => {
                  setSourcePartyId(e.target.value);
                  setSourceBillId("");
                }}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
              >
                <option value="">Select Customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.company_name ? `(${c.company_name})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {sourcePartyId && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--text-muted)]">Select Sale Bill (Optional)</label>
                <select
                  value={sourceBillId}
                  onChange={(e) => setSourceBillId(e.target.value)}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
                >
                  <option value="">All Open Bills / General Advance</option>
                  {sourceBills.map((b) => (
                    <option key={b.id} value={b.id}>
                      Bill #{b.invoice_number} (Outstanding: ₹{b.outstanding.toLocaleString("en-IN")})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Right: Target Supplier / Worker */}
          <div className="p-4 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--primary)] flex items-center gap-1.5">
              <span>Target (Supplier / Job Worker)</span>
            </h4>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-muted)]">Supplier / Worker *</label>
              <select
                value={targetPartyId}
                onChange={(e) => {
                  setTargetPartyId(e.target.value);
                  setTargetBillId("");
                }}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
              >
                <option value="">Select Supplier / Worker...</option>
                {suppliersAndWorkers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.company_name ? `(${s.company_name})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {targetPartyId && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--text-muted)]">Select Bill to Pay *</label>
                <select
                  value={targetBillId}
                  onChange={(e) => setTargetBillId(e.target.value)}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
                >
                  <option value="">Select Unpaid Bill...</option>
                  {targetBills.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.invoice_number} ({b.bill_type}) — ₹{b.outstanding.toLocaleString("en-IN")}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Transfer Amount & Remarks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-muted)]">Direct Transfer / Linked Amount ₹ *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={linkedAmount || ""}
              onChange={(e) => setLinkedAmount(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm font-semibold transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-muted)]">Remarks / Contra Memo</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Direct customer transfer to vendor"
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center sm:justify-end gap-2 sm:gap-3 border-t border-[var(--border)] pt-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto px-4 h-10 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--page-bg)] transition-colors text-center"
          >
            Cancel
          </button>
          <AsyncButton
            onClick={() => linkMutation.mutateAsync()}
            variant="primary"
            className="w-full sm:w-auto justify-center text-xs font-bold"
          >
            Execute Direct Contra Link
          </AsyncButton>
        </div>
      </div>
    </Modal>
  );
}
