"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Modal } from "@/components/shared/Modal";
import AsyncButton from "@/components/shared/AsyncButton";

interface Party { id: string; name: string; company_name: string | null }
interface BankAccount { id: string; account_name: string; bank_name: string }

interface RecordMiscIncomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RecordMiscIncomeModal({ open, onOpenChange }: RecordMiscIncomeModalProps) {
  const queryClient = useQueryClient();

  const [incomeType, setIncomeType] = useState<string>("scrap_sale");
  const [incomeDate, setIncomeDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState<number>(0);
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [partyId, setPartyId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const { data: formData } = useQuery<{
    parties: Party[];
    bankAccounts: BankAccount[];
  }>({
    queryKey: ["misc-income-form-data"],
    queryFn: async () => {
      const res = await fetch("/api/misc-income?form_data=true");
      if (!res.ok) throw new Error("Failed to load income options");
      return res.json();
    },
    enabled: open,
  });

  const parties = formData?.parties || [];
  const bankAccounts = formData?.bankAccounts || [];

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/misc-income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to save income");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Income recorded successfully!");
      queryClient.invalidateQueries({ queryKey: ["misc-income-list"] });
      onOpenChange(false);
      setIncomeType("scrap_sale");
      setAmount(0);
      setPartyId("");
      setNotes("");
    },
    onError: (err: any) => {
      toast.error(err.message || "An error occurred.");
    },
  });

  const handleSubmit = async () => {
    if (amount <= 0) {
      toast.error("Amount must be greater than zero.");
      return;
    }

    await saveMutation.mutateAsync({
      income_type: incomeType,
      income_date: incomeDate,
      amount,
      received_in_account_id: bankAccountId || null,
      party_id: partyId || null,
      notes,
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Record Miscellaneous Income"
      maxWidth="max-w-lg"
    >
      <div className="space-y-4 text-xs font-semibold">
        {/* Income Type & Date */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--text-muted)]">Income Type *</label>
            <select
              value={incomeType}
              onChange={(e) => setIncomeType(e.target.value)}
              className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg pl-3 pr-8 h-10 text-xs transition-colors cursor-pointer"
            >
              <option value="scrap_sale">Scrap Sale</option>
              <option value="machinery_rental">Machinery Rental</option>
              <option value="commission">Commission</option>
              <option value="other">Other Income</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--text-muted)]">Income Date *</label>
            <input
              type="date"
              value={incomeDate}
              onChange={(e) => setIncomeDate(e.target.value)}
              className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg px-3 h-10 text-xs transition-colors"
            />
          </div>
        </div>

        {/* Amount & Deposited Account */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--text-muted)]">Income Amount (₹) *</label>
            <input
              type="number"
              min="0"
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="0.00"
              className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg px-3 h-10 text-xs font-mono transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--text-muted)]">Deposited In Account</label>
            <select
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg pl-3 pr-8 h-10 text-xs transition-colors cursor-pointer"
            >
              <option value="">Cash</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.account_name || b.bank_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Received From (Party) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[var(--text-muted)]">Received From (Party / Customer - Optional)</label>
          <select
            value={partyId}
            onChange={(e) => setPartyId(e.target.value)}
            className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg pl-3 pr-8 h-10 text-xs transition-colors cursor-pointer"
          >
            <option value="">None / Walk-in Customer</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.company_name ? `(${p.company_name})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[var(--text-muted)]">Notes / Description</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Details about the income source..."
            className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg p-3 text-xs transition-colors"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 h-9 border border-[var(--border)] rounded-lg text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--page-bg)] transition-colors"
          >
            Cancel
          </button>
          <AsyncButton onClick={handleSubmit} variant="primary" className="h-9 px-4 text-xs font-bold">
            Record Income
          </AsyncButton>
        </div>
      </div>
    </Modal>
  );
}
