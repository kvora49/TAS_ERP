"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Save, Wallet, Info } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";
import BillAllocationTable, { OutstandingBill } from "@/components/payments/BillAllocationTable";

interface Customer {
  id: string;
  name: string;
  company_name: string | null;
  phone: string | null;
  type: string[];
}

interface BankAccount {
  id: string;
  name: string;
  account_name: string;
  bank_name: string;
  account_number: string;
  is_default?: boolean;
}

interface ReceivePaymentViewProps {
  initialPartyId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ReceivePaymentView({
  initialPartyId = "",
  onSuccess,
  onCancel,
}: ReceivePaymentViewProps) {
  const queryClient = useQueryClient();

  // Form States
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialPartyId);
  const [customerBalance, setCustomerBalance] = useState<string>("₹0.00 Dr");

  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [paymentMode, setPaymentMode] = useState<string>("bank_transfer");
  const [referenceNo, setReferenceNo] = useState<string>("");
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [remarks, setRemarks] = useState<string>("");
  const [allocations, setAllocations] = useState<any[]>([]);

  // Fetch Customers and Bank Accounts
  const { data: initData, isLoading: initLoading, error: initError, refetch } = useQuery<{
    customers: Customer[];
    bankAccounts: BankAccount[];
  }>({
    queryKey: ["payment-receive-init"],
    queryFn: async () => {
      const res = await fetch("/api/payments/receive");
      if (!res.ok) throw new Error("Failed to load customer & bank data");
      return res.json();
    },
  });

  const customers = initData?.customers || [];
  const bankAccounts = initData?.bankAccounts || [];

  // Auto-select default bank account
  useEffect(() => {
    if (bankAccounts.length > 0 && !bankAccountId) {
      const def = bankAccounts.find((b) => b.is_default) || bankAccounts[0];
      if (def) setBankAccountId(def.id);
    }
  }, [bankAccounts, bankAccountId]);

  // Fetch outstanding bills when customer is selected
  const { data: billsData, isLoading: billsLoading } = useQuery<{ bills: OutstandingBill[] }>({
    queryKey: ["outstanding-bills-receive", selectedCustomerId],
    queryFn: async () => {
      if (!selectedCustomerId) return { bills: [] };
      const res = await fetch(`/api/payments/receive?party_id=${selectedCustomerId}`);
      if (!res.ok) throw new Error("Failed to load outstanding sales bills");
      return res.json();
    },
    enabled: !!selectedCustomerId,
  });

  const outstandingBills = billsData?.bills || [];

  // Fetch customer running balance from ledger
  useEffect(() => {
    if (!selectedCustomerId) {
      setCustomerBalance("₹0.00 Dr");
      return;
    }

    fetch(`/api/parties/${selectedCustomerId}/ledger`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.ledger && data.ledger.length > 0) {
          const lastEntry = data.ledger[data.ledger.length - 1];
          setCustomerBalance(lastEntry.balanceStr || "₹0.00 Dr");
        } else {
          setCustomerBalance("₹0.00 Dr");
        }
      })
      .catch(() => setCustomerBalance("₹0.00 Dr"));
  }, [selectedCustomerId]);

  // Submit Receive Payment Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCustomerId) throw new Error("Please select a customer");
      if (amountReceived <= 0 && allocations.length === 0) {
        throw new Error("Please enter a valid amount or select bills to allocate");
      }

      const payload = {
        party_id: selectedCustomerId,
        amount: Number(amountReceived),
        payment_date: paymentDate,
        payment_mode: paymentMode,
        reference_no: referenceNo,
        bank_account_id: bankAccountId,
        remarks,
        allocations,
      };

      const res = await fetch("/api/payments/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to record payment");
      return json;
    },
    onSuccess: () => {
      toast.success("Incoming payment recorded successfully!");
      queryClient.invalidateQueries({ queryKey: ["payments-list-overview"] });
      queryClient.invalidateQueries({ queryKey: ["outstanding-bills-receive"] });
      if (onSuccess) onSuccess();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to record payment");
    },
  });

  return (
    <PageState
      isLoading={initLoading}
      isError={!!initError}
      error={initError?.message}
      onRetry={refetch}
      skeletonVariant="form"
    >
      <div className="space-y-6">
        {/* Card Header & Controls */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-500" />
                Receive Payment (Customer Receipt)
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Record payment received from customer, allocate across open sales bills, or save unallocated excess as Customer Advance.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] border border-[var(--border)] rounded-xl hover:bg-[var(--page-bg)] transition-colors"
                >
                  Cancel
                </button>
              )}
              <AsyncButton
                onClick={() => saveMutation.mutateAsync()}
                variant="primary"
              >
                <Save className="w-4 h-4 mr-1.5" />
                Save & Record Payment
              </AsyncButton>
            </div>
          </div>

          {/* Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Customer Selector */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium text-[var(--text-muted)]">Select Customer *</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
              >
                <option value="">Select Customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.company_name ? `(${c.company_name})` : ""} {c.phone ? `— ${c.phone}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Customer Running Balance Badge */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-muted)]">Current Ledger Balance</label>
              <div className="h-10 px-4 rounded-lg bg-[var(--page-bg)] border border-[var(--border)] flex items-center justify-between text-sm font-semibold text-[var(--text-primary)]">
                <span>Balance:</span>
                <span className="text-[var(--primary)]">{customerBalance}</span>
              </div>
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

            {/* Payment Mode */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-muted)]">Payment Mode *</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
              >
                <option value="bank_transfer">Bank Transfer / NEFT / RTGS</option>
                <option value="upi">UPI / QR Scan</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque / PDC</option>
              </select>
            </div>

            {/* Amount Received */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-muted)]">Amount Received ₹ *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amountReceived || ""}
                onChange={(e) => setAmountReceived(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm font-semibold transition-colors"
              />
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
                      {b.account_name || b.name} ({b.bank_name})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* UTR / Reference No */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-muted)]">Ref / UTR / Cheque No.</label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="e.g. UTR92182019"
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
              />
            </div>

            {/* Remarks */}
            <div className="space-y-1 md:col-span-3">
              <label className="text-xs font-medium text-[var(--text-muted)]">Remarks / Payment Memo</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Internal memo, customer remarks..."
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Bill Allocation Section */}
        {selectedCustomerId && (
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Unpaid Sales Bills ({outstandingBills.length})
              </h2>
            </div>

            {billsLoading ? (
              <div className="py-8 text-center text-xs text-[var(--text-muted)]">Loading unpaid bills...</div>
            ) : outstandingBills.length === 0 ? (
              <div className="p-4 bg-[var(--page-bg)] rounded-xl border border-[var(--border)] text-center text-xs text-[var(--text-muted)]">
                No open unpaid sales bills found for this customer. Entered amount will be saved as an <strong>Unallocated Customer Advance</strong>.
              </div>
            ) : (
              <BillAllocationTable
                bills={outstandingBills}
                paymentAmount={amountReceived}
                onAllocationChange={setAllocations}
              />
            )}
          </div>
        )}
      </div>
    </PageState>
  );
}
