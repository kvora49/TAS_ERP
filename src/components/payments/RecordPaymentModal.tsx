"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Wallet, Calendar, FileText, CheckCircle, Info } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import AsyncButton from "@/components/shared/AsyncButton";
import BillAllocationTable, { OutstandingBill } from "@/components/payments/BillAllocationTable";

interface Party {
  id: string;
  name: string;
  company_name: string | null;
  phone: string | null;
  type: string[];
}

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string;
  account_number: string;
  is_default?: boolean;
}

interface RecordPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDirection?: "received" | "paid";
  defaultPartyId?: string;
}

export default function RecordPaymentModal({
  open,
  onOpenChange,
  defaultDirection = "received",
  defaultPartyId = "",
}: RecordPaymentModalProps) {
  const queryClient = useQueryClient();

  const [direction, setDirection] = useState<"received" | "paid">(defaultDirection);
  const [selectedPartyId, setSelectedPartyId] = useState<string>(defaultPartyId);
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [paymentMode, setPaymentMode] = useState<string>("bank_transfer");
  const [referenceNo, setReferenceNo] = useState<string>("");
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [amount, setAmount] = useState<number>(0);
  const [remarks, setRemarks] = useState<string>("");
  const [allocations, setAllocations] = useState<any[]>([]);

  // Update direction / party when modal opens with props
  useEffect(() => {
    if (open) {
      setDirection(defaultDirection);
      if (defaultPartyId) setSelectedPartyId(defaultPartyId);
    }
  }, [open, defaultDirection, defaultPartyId]);

  // Fetch initial master data (Parties & Bank accounts)
  const { data: workspaceData } = useQuery<{ parties: Party[]; bankAccounts: BankAccount[] }>({
    queryKey: ["payments-workspace-init"],
    queryFn: async () => {
      const res = await fetch("/api/payments");
      if (!res.ok) throw new Error("Failed to load payment options");
      return res.json();
    },
    enabled: open,
  });

  const parties = workspaceData?.parties || [];
  const bankAccounts = workspaceData?.bankAccounts || [];

  // Filter parties based on payment direction
  const filteredParties = parties.filter((p) => {
    if (direction === "received") {
      return p.type?.includes("customer");
    }
    return p.type?.includes("supplier") || p.type?.includes("worker");
  });

  // Auto-select default bank account
  useEffect(() => {
    if (bankAccounts.length > 0 && !bankAccountId) {
      const def = bankAccounts.find((b) => b.is_default) || bankAccounts[0];
      if (def) setBankAccountId(def.id);
    }
  }, [bankAccounts, bankAccountId]);

  // Fetch outstanding bills and available credits when party changes
  const { data: partyDetails, isLoading: billsLoading } = useQuery<{
    bills: OutstandingBill[];
    creditNotes: any[];
    debitNotes: any[];
    advances: any[];
  }>({
    queryKey: ["party-outstanding", selectedPartyId],
    queryFn: async () => {
      if (!selectedPartyId) return { bills: [], creditNotes: [], debitNotes: [], advances: [] };
      const res = await fetch(`/api/payments?party_id=${selectedPartyId}`);
      if (!res.ok) throw new Error("Failed to load party bills");
      return res.json();
    },
    enabled: open && !!selectedPartyId,
  });

  const outstandingBills = partyDetails?.bills || [];
  const advances = partyDetails?.advances || [];
  const totalAdvancesAvailable = advances.reduce((sum, a) => sum + Number(a.remaining_amount || 0), 0);

  // Submit payment mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPartyId) throw new Error("Please select a party");
      if (amount <= 0 && allocations.length === 0) throw new Error("Please enter a valid payment amount or select bills to allocate");

      const payload = {
        action: "record_payment",
        direction,
        party_id: selectedPartyId,
        payment_date: paymentDate,
        payment_mode: paymentMode,
        reference_no: referenceNo,
        bank_account_id: bankAccountId,
        amount: Number(amount),
        remarks,
        allocations,
      };

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment");
      return data;
    },
    onSuccess: () => {
      toast.success(direction === "received" ? "Payment received successfully" : "Payment recorded successfully");
      queryClient.invalidateQueries({ queryKey: ["payments-list"] });
      queryClient.invalidateQueries({ queryKey: ["party-outstanding"] });
      onOpenChange(false);
      // Reset form
      setAmount(0);
      setRemarks("");
      setReferenceNo("");
      setAllocations([]);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to record payment");
    },
  });

  const selectedParty = parties.find((p) => p.id === selectedPartyId);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={direction === "received" ? "Record Incoming Payment (Customer)" : "Record Outward Payment (Supplier / Worker)"}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-6">
        {/* Toggle Direction */}
        <div className="flex items-center gap-2 p-1 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl max-w-xs">
          <button
            type="button"
            onClick={() => {
              setDirection("received");
              setSelectedPartyId("");
              setAllocations([]);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              direction === "received"
                ? "bg-[var(--primary)] text-white shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            Receive Payment
          </button>
          <button
            type="button"
            onClick={() => {
              setDirection("paid");
              setSelectedPartyId("");
              setAllocations([]);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              direction === "paid"
                ? "bg-[var(--primary)] text-white shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            Make Payment
          </button>
        </div>

        {/* Form Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Select Party */}
          <div className="space-y-1 md:col-span-1">
            <label className="text-xs font-medium text-[var(--text-muted)]">
              {direction === "received" ? "Customer *" : "Supplier / Worker *"}
            </label>
            <select
              value={selectedPartyId}
              onChange={(e) => {
                setSelectedPartyId(e.target.value);
                setAllocations([]);
              }}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
            >
              <option value="">Select Party...</option>
              {filteredParties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.company_name ? `(${p.company_name})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Date */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-muted)]">Payment Date *</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
            />
          </div>

          {/* Amount Paid / Received */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-muted)]">
              Amount ({direction === "received" ? "Received" : "Paid"}) ₹ *
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount || ""}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm font-semibold transition-colors"
            />
          </div>

          {/* Payment Mode */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-muted)]">Payment Mode *</label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
            >
              <option value="bank_transfer">Bank Transfer / NEFT / IMPS</option>
              <option value="upi">UPI / QR Code</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque / PDC</option>
            </select>
          </div>

          {/* Bank Account */}
          {paymentMode !== "cash" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-muted)]">Bank Account *</label>
              <select
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
              >
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.account_name} ({b.bank_name})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Reference / UTR Number */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-muted)]">Ref / UTR / Cheque No.</label>
            <input
              type="text"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="e.g. UTR129381928"
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
            />
          </div>
        </div>

        {/* Available Advance Credit Alert Banner */}
        {totalAdvancesAvailable > 0 && (
          <div className="p-3 bg-[var(--primary-light)] border border-[var(--primary)]/30 rounded-xl flex items-center justify-between text-xs text-[var(--text-primary)]">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[var(--primary)] shrink-0" />
              <span>
                Available Unallocated Advance for {selectedParty?.name}:{" "}
                <strong className="font-semibold">₹{totalAdvancesAvailable.toLocaleString("en-IN")}</strong>
              </span>
            </div>
            <span className="text-[var(--text-muted)] italic">Will automatically offer settlement option</span>
          </div>
        )}

        {/* Bill Allocation Section */}
        {selectedPartyId && (
          <div className="space-y-2 border-t border-[var(--border)] pt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Bill Allocation ({outstandingBills.length} Unpaid Obligations)
              </h4>
            </div>

            {billsLoading ? (
              <div className="py-6 text-center text-xs text-[var(--text-muted)]">Loading unpaid bills...</div>
            ) : outstandingBills.length === 0 ? (
              <div className="p-4 bg-[var(--page-bg)] rounded-xl border border-[var(--border)] text-center text-xs text-[var(--text-muted)]">
                No open unpaid bills found for this party. Entered amount will be saved as an <strong>Unallocated Advance</strong>.
              </div>
            ) : (
              <BillAllocationTable
                bills={outstandingBills}
                paymentAmount={amount}
                onAllocationChange={setAllocations}
              />
            )}
          </div>
        )}

        {/* Remarks */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text-muted)]">Remarks / Notes</label>
          <input
            type="text"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Payment reference, notes..."
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
          />
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] pt-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 h-10 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--page-bg)] transition-colors"
          >
            Cancel
          </button>
          <AsyncButton
            onClick={() => submitMutation.mutateAsync()}
            variant="primary"
          >
            Save & Record Payment
          </AsyncButton>
        </div>
      </div>
    </Modal>
  );
}
