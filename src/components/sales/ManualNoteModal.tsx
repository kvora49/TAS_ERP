"use client";

import React, { useState, useEffect } from "react";
import { useReportQuery } from "@/hooks/useReportQuery";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateReports } from "@/lib/report-cache";
import RecordedTaxFields, { emptyRecordedTax, taxInputPayload } from "@/components/forms/RecordedTaxFields";
import { Modal } from "@/components/shared/Modal";
import AsyncButton from "@/components/shared/AsyncButton";
import { toast } from "sonner";
import { FileText, Calendar, DollarSign, User, AlertCircle, Building2 } from "lucide-react";

interface Party {
  id: string;
  name: string;
  company_name: string | null;
  type: string[];
}

interface ManualNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType?: "credit_note" | "debit_note";
  initialPartyId?: string;
  initialPartyType?: "customer" | "supplier" | "worker";
  onSuccess?: () => void;
}

const REASON_CATEGORIES = [
  "Rate Difference / Price Correction",
  "Fabric Damage / Quality Deduction",
  "Shortage / Piece Count Adjustment",
  "Volume Rebate / Special Discount",
  "Labor / Piece-Rate Adjustment",
  "Manual Ledger Correction",
];

export function ManualNoteModal({
  open,
  onOpenChange,
  initialType = "credit_note",
  initialPartyId,
  initialPartyType = "customer",
  onSuccess,
}: ManualNoteModalProps) {
  const [noteType, setNoteType] = useState<"credit_note" | "debit_note">(initialType);
  const [partyType, setPartyType] = useState<"customer" | "supplier" | "worker">(initialPartyType);
  const [selectedPartyId, setSelectedPartyId] = useState<string>(initialPartyId || "");
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState<string>("");
  const [reasonCategory, setReasonCategory] = useState<string>(REASON_CATEGORIES[0]);
  const [remarks, setRemarks] = useState<string>("");

  const queryClient = useQueryClient();
  const [tax, setTax] = useState(emptyRecordedTax);
  const { data: parties = [], isLoading: loadingParties } = useReportQuery<Party[]>({
    queryKey: ["manual-note-parties", partyType], enabled: open,
    queryFn: async () => { const response = await fetch(`/api/parties?type=${partyType}`); if (!response.ok) throw new Error("Failed to load parties"); return (await response.json()).parties || []; },
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setNoteType(initialType);
      setTax(emptyRecordedTax);
      if (initialPartyId) setSelectedPartyId(initialPartyId);
      if (initialPartyType) setPartyType(initialPartyType);
    }
  }, [open, initialType, initialPartyId, initialPartyType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartyId) {
      toast.error("Please select a party");
      return;
    }
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = noteType === "credit_note" ? "/api/sales/credit-notes" : "/api/sales/debit-notes";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          party_id: selectedPartyId,
          note_type: noteType,
          date,
          dn_date: date,
          cn_date: date,
          amount: numAmount,
          ...taxInputPayload(tax),
          reason: `${reasonCategory}${remarks ? ": " + remarks : ""}`,
          is_manual: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to issue note");
      }

      const noteName = noteType === "credit_note" ? "Credit Note" : "Debit Note";
      toast.success(`${noteName} of ₹${numAmount.toLocaleString("en-IN")} issued successfully!`);
      
      void invalidateReports(queryClient);
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to process request");
    } finally {
      setSubmitting(false);
    }
  };

  const isCredit = noteType === "credit_note";

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isCredit ? "Issue Manual Credit Note" : "Issue Manual Debit Note"}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Toggle Note Type */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--page-bg)] rounded-xl border border-[var(--border)]">
          <button
            type="button"
            onClick={() => setNoteType("credit_note")}
            className={`py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              isCredit
                ? "bg-[var(--primary)] text-[var(--text-on-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            Credit Note (CN)
          </button>
          <button
            type="button"
            onClick={() => setNoteType("debit_note")}
            className={`py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              !isCredit
                ? "bg-[var(--primary)] text-[var(--text-on-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            Debit Note (DN)
          </button>
        </div>

        {/* Party Category Tabs */}
        {!initialPartyId && (
          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">
              Party Category
            </label>
            <div className="flex gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPartyType("customer")}
                className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  partyType === "customer"
                    ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                    : "border-[var(--border)] text-[var(--text-muted)]"
                }`}
              >
                Customers
              </button>
              <button
                type="button"
                onClick={() => setPartyType("supplier")}
                className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  partyType === "supplier"
                    ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                    : "border-[var(--border)] text-[var(--text-muted)]"
                }`}
              >
                Suppliers
              </button>
              <button
                type="button"
                onClick={() => setPartyType("worker")}
                className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  partyType === "worker"
                    ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                    : "border-[var(--border)] text-[var(--text-muted)]"
                }`}
              >
                Job Workers / Karigars
              </button>
            </div>
          </div>
        )}

        {/* Select Party */}
        <div>
          <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">
            Select Party *
          </label>
          <select
            required
            disabled={loadingParties}
            value={selectedPartyId}
            onChange={(e) => setSelectedPartyId(e.target.value)}
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg px-3 h-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
          >
            <option value="">{loadingParties ? "Loading parties..." : "-- Choose Party --"}</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.company_name ? `(${p.company_name})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Date & Amount */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">
              Issue Date *
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg px-3 h-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">
              Amount (₹) *
            </label>
            <input
              type="number"
              min="1"
              step="0.01"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg px-3 h-10 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
            />
          </div>
        </div>

        <RecordedTaxFields value={tax} onChange={setTax} />

        {/* Reason Category */}
        <div>
          <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">
            Reason / Category *
          </label>
          <select
            value={reasonCategory}
            onChange={(e) => setReasonCategory(e.target.value)}
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg px-3 h-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
          >
            {REASON_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Remarks */}
        <div>
          <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">
            Remarks / Additional Details
          </label>
          <textarea
            rows={2}
            placeholder="Specify bill ref, damage description, rate difference details..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 border border-[var(--border)] rounded-lg text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--table-row-hover)]"
          >
            Cancel
          </button>
          <AsyncButton
            type="submit"
            isLoading={submitting}
            variant="primary"
            className="px-6 py-2 text-sm font-bold"
          >
            {isCredit ? "Issue Credit Note" : "Issue Debit Note"}
          </AsyncButton>
        </div>
      </form>
    </Modal>
  );
}
