"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Landmark,
  User,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  Calendar,
  AlertCircle
} from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import AsyncButton from "@/components/shared/AsyncButton";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Party {
  id: string;
  name: string;
  company_name: string | null;
  type: string[];
}

interface BankAccount {
  id: string;
  name?: string;
  bank_name?: string;
  account_number?: string;
  type?: string;
  account_category?: string;
  current_balance?: number;
}

interface OutstandingBill {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total: number;
  paid: number;
  outstanding: number;
  bill_type: string;
}

interface NewChequeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDirection?: "received" | "issued";
  parties: Party[];
  bankAccounts: BankAccount[];
  onSave: (payload: any) => Promise<any>;
}

export function NewChequeModal({
  open,
  onOpenChange,
  defaultDirection = "received",
  parties,
  bankAccounts,
  onSave,
}: NewChequeModalProps) {
  const [direction, setDirection] = useState<"received" | "issued">(defaultDirection);
  const [partyId, setPartyId] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [companyBankAccountId, setCompanyBankAccountId] = useState("");
  const [remarks, setRemarks] = useState("");

  // Settlement Mode: 'bill_wise' vs 'on_account'
  const [settlementMode, setSettlementMode] = useState<"on_account" | "bill_wise">("on_account");
  const [outstandingBills, setOutstandingBills] = useState<OutstandingBill[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [selectedBillAllocations, setSelectedBillAllocations] = useState<Record<string, number>>({});

  useEffect(() => {
    setDirection(defaultDirection);
  }, [defaultDirection]);

  // Reset allocations when party or direction changes
  useEffect(() => {
    setSelectedBillAllocations({});
    if (!partyId) {
      setOutstandingBills([]);
      return;
    }

    let isMounted = true;
    setLoadingBills(true);
    fetch(`/api/finance/cheques/outstanding-bills?party_id=${partyId}&direction=${direction}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          setOutstandingBills(data.bills || []);
          setLoadingBills(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load bills:", err);
        if (isMounted) setLoadingBills(false);
      });

    return () => {
      isMounted = false;
    };
  }, [partyId, direction]);

  // Compute allocated totals
  const totalAllocated = useMemo(() => {
    return Object.values(selectedBillAllocations).reduce((sum, val) => sum + (Number(val) || 0), 0);
  }, [selectedBillAllocations]);

  const chequeNumAmount = Number(amount || 0);
  const unallocatedAmount = Math.max(0, chequeNumAmount - totalAllocated);

  // Auto-allocate FIFO
  const handleAutoAllocate = () => {
    if (chequeNumAmount <= 0) {
      toast.error("Please enter a cheque amount first to auto-allocate.");
      return;
    }

    let remaining = chequeNumAmount;
    const newAllocations: Record<string, number> = {};

    for (const bill of outstandingBills) {
      if (remaining <= 0) break;
      const alloc = Math.min(bill.outstanding, remaining);
      if (alloc > 0) {
        newAllocations[bill.id] = alloc;
        remaining -= alloc;
      }
    }

    setSelectedBillAllocations(newAllocations);
    toast.success(`Allocated across ${Object.keys(newAllocations).length} bills.`);
  };

  const handleToggleBill = (bill: OutstandingBill) => {
    setSelectedBillAllocations((prev) => {
      const next = { ...prev };
      if (next[bill.id] !== undefined) {
        delete next[bill.id];
      } else {
        const remainingToAllocate = Math.max(0, chequeNumAmount - totalAllocated);
        const alloc = remainingToAllocate > 0 ? Math.min(bill.outstanding, remainingToAllocate) : bill.outstanding;
        next[bill.id] = alloc;
      }
      return next;
    });
  };

  const handleAllocationAmountChange = (billId: string, maxOutstanding: number, valueStr: string) => {
    const val = Number(valueStr);
    if (isNaN(val) || val < 0) return;
    const clamped = Math.min(val, maxOutstanding);
    setSelectedBillAllocations((prev) => ({
      ...prev,
      [billId]: clamped,
    }));
  };

  const handleSubmit = async () => {
    if (!chequeNumber.trim()) {
      toast.error("Cheque number is required.");
      return;
    }
    if (!bankName.trim()) {
      toast.error("Cheque bank name is required.");
      return;
    }
    if (!chequeDate) {
      toast.error("Cheque date is required.");
      return;
    }
    if (chequeNumAmount <= 0) {
      toast.error("Please enter a valid cheque amount greater than zero.");
      return;
    }

    if (direction === "issued" && !companyBankAccountId) {
      toast.error("Please select which Company Bank Account this cheque is issued from.");
      return;
    }

    // Build allocations array
    const allocationsArray =
      settlementMode === "bill_wise"
        ? Object.entries(selectedBillAllocations)
            .filter(([_, amt]) => Number(amt) > 0)
            .map(([billId, amt]) => {
              const bill = outstandingBills.find((b) => b.id === billId);
              return {
                billId,
                billNumber: bill?.invoice_number || billId,
                billType: bill?.bill_type || "sale_bill",
                allocatedAmount: Number(amt),
                totalAmount: bill?.total || 0,
              };
            })
        : [];

    const payload = {
      cheque_number: chequeNumber.trim(),
      direction,
      party_id: partyId || null,
      bank_name: bankName.trim(),
      account_no: accountNo.trim() || null,
      cheque_date: chequeDate,
      due_date: dueDate || null,
      amount: chequeNumAmount,
      received_account_id: companyBankAccountId || null,
      remarks: remarks.trim() || null,
      settlement_type: settlementMode,
      allocations: allocationsArray,
    };

    await onSave(payload);
    onOpenChange(false);
  };

  const filteredParties = parties.filter((p) => {
    if (direction === "received") return p.type?.includes("customer");
    return p.type?.includes("supplier") || p.type?.includes("worker");
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Record Cheque / PDC Entry"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 pt-2 text-xs">
        {/* Direction Switch */}
        <div className="grid grid-cols-2 gap-2 bg-[var(--page-bg)] p-1.5 rounded-xl border border-[var(--border)]">
          <button
            type="button"
            onClick={() => {
              setDirection("received");
              setPartyId("");
            }}
            className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              direction === "received"
                ? "bg-[var(--card-bg)] text-[var(--text-primary)] shadow-sm border border-[var(--border)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" />
            <span>Received (From Customer)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDirection("issued");
              setPartyId("");
            }}
            className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              direction === "issued"
                ? "bg-[var(--card-bg)] text-[var(--text-primary)] shadow-sm border border-[var(--border)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-blue-500" />
            <span>Issued (To Supplier / Worker)</span>
          </button>
        </div>

        {/* Party Selector & Cheque Amount */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {direction === "received" ? "Customer / Drawer Party" : "Supplier / Worker Payee"}
            </label>
            <select
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-xs transition-colors cursor-pointer"
            >
              <option value="">Select Party...</option>
              {filteredParties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.company_name ? `(${p.company_name})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Cheque Amount (₹) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-xs font-mono font-bold transition-colors"
            />
          </div>
        </div>

        {/* Cheque Identifiers: Number, Cheque Date, PDC Due Date */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Cheque Number *
            </label>
            <input
              type="text"
              placeholder="6-digit MICR no."
              value={chequeNumber}
              onChange={(e) => setChequeNumber(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-xs font-mono font-bold transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Cheque Date *
            </label>
            <input
              type="date"
              value={chequeDate}
              onChange={(e) => setChequeDate(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-xs transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              PDC Due / Release Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-xs transition-colors"
            />
          </div>
        </div>

        {/* Drawee Bank Name & Account Number */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {direction === "received" ? "Customer's Bank Name *" : "Drawee Bank Name *"}
            </label>
            <input
              type="text"
              placeholder="e.g. HDFC Bank, SBI, ICICI"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-xs transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Drawee Account Number
            </label>
            <input
              type="text"
              placeholder="e.g. 50100982348"
              value={accountNo}
              onChange={(e) => setAccountNo(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-xs font-mono transition-colors"
            />
          </div>
        </div>

        {/* Company Bank Account Linkage */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {direction === "issued" ? "Issued From Company Bank Account *" : "Assigned Company Settlement Bank (Optional)"}
          </label>
          <select
            value={companyBankAccountId}
            onChange={(e) => setCompanyBankAccountId(e.target.value)}
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-xs transition-colors cursor-pointer"
          >
            <option value="">{direction === "issued" ? "Select Account..." : "Hold in Company Safe / In Hand"}</option>
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name || b.bank_name} {b.account_number ? `(${b.account_number})` : ""} · Bal: ₹{Number(b.current_balance || 0).toLocaleString("en-IN")}
              </option>
            ))}
          </select>
        </div>

        {/* Settlement Mode Toggle: On-Account vs Bill-Wise */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--page-bg)] p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-light)] pb-2.5">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[var(--text-primary)] text-xs">
                Settlement Treatment
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">
                (How this cheque affects accounting)
              </span>
            </div>

            <div className="flex items-center gap-1 bg-[var(--card-bg)] p-1 rounded-xl border border-[var(--border)]">
              <button
                type="button"
                onClick={() => setSettlementMode("on_account")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  settlementMode === "on_account"
                    ? "bg-[var(--primary)] text-white shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                On-Account (Advance)
              </button>
              <button
                type="button"
                onClick={() => setSettlementMode("bill_wise")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  settlementMode === "bill_wise"
                    ? "bg-[var(--primary)] text-white shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                Settle Specific Invoices
              </button>
            </div>
          </div>

          {/* Conditional Content based on Settlement Mode */}
          {settlementMode === "on_account" ? (
            <div className="p-3 rounded-xl bg-[var(--card-bg)] border border-[var(--border-light)] text-[11px] text-[var(--text-muted)] space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>On-Account Settlement Selected</span>
              </div>
              <p>
                No specific bills are linked to this cheque. When cleared, 100% of the cheque amount (
                <strong className="text-[var(--text-primary)] font-mono font-bold">
                  {formatCurrency(chequeNumAmount)}
                </strong>
                ) will be booked as an advance credit/debit directly to the party ledger.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[var(--text-secondary)]">
                  Outstanding Bills for Selected Party ({outstandingBills.length})
                </span>
                <button
                  type="button"
                  onClick={handleAutoAllocate}
                  disabled={outstandingBills.length === 0 || chequeNumAmount <= 0}
                  className="px-2.5 py-1 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white text-xs font-bold flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Auto-Allocate (FIFO)</span>
                </button>
              </div>

              {loadingBills ? (
                <div className="p-6 text-center text-xs text-[var(--text-muted)]">
                  Loading outstanding bills...
                </div>
              ) : outstandingBills.length === 0 ? (
                <div className="p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border-light)] text-center text-[11px] text-[var(--text-muted)]">
                  {partyId ? "No unpaid bills found for this party. You can still proceed with On-Account settlement." : "Select a party above to view their outstanding bills."}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[var(--border-light)] bg-[var(--card-bg)] max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border-light)] text-[var(--text-muted)] font-bold sticky top-0">
                        <th className="p-2.5 text-center w-8">#</th>
                        <th className="p-2.5">Bill No.</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5 text-right">Outstanding</th>
                        <th className="p-2.5 text-right w-32">Allocate (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-light)]">
                      {outstandingBills.map((bill) => {
                        const isAllocated = selectedBillAllocations[bill.id] !== undefined;
                        const allocatedVal = selectedBillAllocations[bill.id] || 0;
                        return (
                          <tr key={bill.id} className="hover:bg-[var(--table-row-hover)]">
                            <td className="p-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={isAllocated}
                                onChange={() => handleToggleBill(bill)}
                                className="rounded border-[var(--input-border)] text-[var(--primary)] focus:ring-[var(--input-focus)] cursor-pointer"
                              />
                            </td>
                            <td className="p-2.5 font-bold font-mono text-[var(--text-primary)]">
                              {bill.invoice_number}
                            </td>
                            <td className="p-2.5 text-[var(--text-muted)]">
                              {formatDate(bill.invoice_date)}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-[var(--text-primary)]">
                              {formatCurrency(bill.outstanding)}
                            </td>
                            <td className="p-2.5 text-right">
                              <input
                                type="number"
                                min="0"
                                max={bill.outstanding}
                                value={allocatedVal || ""}
                                disabled={!isAllocated}
                                onChange={(e) =>
                                  handleAllocationAmountChange(bill.id, bill.outstanding, e.target.value)
                                }
                                placeholder="0.00"
                                className="w-full text-right bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)] rounded-md px-2 py-1 text-xs font-mono font-bold disabled:opacity-40"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Allocation Summary */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--border-light)] text-[11px] font-semibold">
                <span className="text-[var(--text-muted)]">
                  Total Allocated:{" "}
                  <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatCurrency(totalAllocated)}
                  </strong>
                </span>
                <span className="text-[var(--text-muted)]">
                  Unallocated (Advance):{" "}
                  <strong className="text-amber-600 dark:text-amber-400 font-mono">
                    {formatCurrency(unallocatedAmount)}
                  </strong>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Remarks */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Remarks / Internal Memo
          </label>
          <input
            type="text"
            placeholder="e.g. Received against Diwali orders or Advance for fabric batch"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-xs transition-colors"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 h-9 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--table-row-hover)] transition-all cursor-pointer"
          >
            Cancel
          </button>
          <AsyncButton
            onClick={handleSubmit}
            variant="primary"
            className="h-9 px-5 text-xs font-bold justify-center"
          >
            Record Cheque Entry
          </AsyncButton>
        </div>
      </div>
    </Modal>
  );
}
