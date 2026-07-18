"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, X, CheckCircle, Wallet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import AsyncButton from "@/components/shared/AsyncButton";
import PageState from "@/components/shared/PageState";
import BillAllocationTable, { OutstandingBill } from "@/components/payments/BillAllocationTable";

interface Payee {
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
}

export default function MakePaymentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Page States
  const [selectedPayeeId, setSelectedPayeeId] = useState<string>("");
  const [selectedPayee, setSelectedPayee] = useState<Payee | null>(null);
  const [payeeBalance, setPayeeBalance] = useState<string>("₹0.00 Cr");
  const [payeeBalanceSign, setPayeeBalanceSign] = useState<"Dr" | "Cr">("Cr");

  // Form Fields
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [paymentMode, setPaymentMode] = useState<string>("bank_transfer");
  const [referenceNo, setReferenceNo] = useState<string>("");
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [remarks, setRemarks] = useState<string>("");
  const [refDate, setRefDate] = useState<string>("");

  // Allocations state
  const [allocations, setAllocations] = useState<any[]>([]);

  // Fetch initial suppliers/workers list and bank accounts
  const { data: initData, isLoading: initLoading, error: initError } = useQuery<{
    payees: Payee[];
    bankAccounts: BankAccount[];
  }>({
    queryKey: ["payment-make-init"],
    queryFn: async () => {
      const res = await fetch("/api/payments/make");
      if (!res.ok) throw new Error("Failed to load initial form data");
      return res.json();
    },
  });

  const payees = initData?.payees || [];
  const bankAccounts = initData?.bankAccounts || [];

  // Fetch outstanding bills (purchases / bills / job work) when payee is selected
  const { data: billsData, isLoading: billsLoading } = useQuery<{ bills: OutstandingBill[] }>({
    queryKey: ["outstanding-payee-bills", selectedPayeeId],
    queryFn: async () => {
      if (!selectedPayeeId) return { bills: [] };
      const res = await fetch(`/api/payments/make?party_id=${selectedPayeeId}`);
      if (!res.ok) throw new Error("Failed to load outstanding items");
      return res.json();
    },
    enabled: !!selectedPayeeId,
  });

  const outstandingBills = billsData?.bills || [];

  // Fetch payee ledger to get precise running balance
  useEffect(() => {
    if (!selectedPayeeId) {
      setSelectedPayee(null);
      setPayeeBalance("₹0.00 Cr");
      setPayeeBalanceSign("Cr");
      return;
    }

    const payee = payees.find((p) => p.id === selectedPayeeId) || null;
    setSelectedPayee(payee);

    fetch(`/api/parties/${selectedPayeeId}/ledger`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.ledger && data.ledger.length > 0) {
          const lastEntry = data.ledger[data.ledger.length - 1];
          setPayeeBalance(lastEntry.balanceStr);
          setPayeeBalanceSign(lastEntry.balanceSign);
        } else {
          setPayeeBalance("₹0.00 Cr");
          setPayeeBalanceSign("Cr");
        }
      })
      .catch(() => {
        setPayeeBalance("₹0.00 Cr");
        setPayeeBalanceSign("Cr");
      });
  }, [selectedPayeeId, payees]);

  // Set default bank account
  useEffect(() => {
    if (bankAccounts.length > 0 && !bankAccountId) {
      setBankAccountId(bankAccounts[0].id);
    }
  }, [bankAccounts, bankAccountId]);

  // Save payment mutation
  const savePaymentMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/payments/make", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorText = await res.json();
        throw new Error(errorText.error || "Failed to record payment");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Payment recorded successfully!");
      queryClient.invalidateQueries({ queryKey: ["ledger", selectedPayeeId] });
      queryClient.invalidateQueries({ queryKey: ["outstanding-payee-bills", selectedPayeeId] });
      router.push(`/parties/${selectedPayeeId}/ledger`);
    },
    onError: (err: any) => {
      toast.error(err.message || "An error occurred while saving.");
    },
  });

  const handleSave = async () => {
    if (!selectedPayeeId) {
      toast.error("Please select a supplier or worker.");
      return;
    }
    if (amountPaid <= 0) {
      toast.error("Amount paid must be greater than zero.");
      return;
    }
    if (!paymentDate) {
      toast.error("Please enter a payment date.");
      return;
    }

    const payload = {
      party_id: selectedPayeeId,
      amount: amountPaid,
      payment_date: paymentDate,
      payment_mode: paymentMode,
      reference_no: referenceNo,
      bank_account_id: paymentMode === "cash" ? null : bankAccountId,
      remarks,
      allocations,
    };

    await savePaymentMutation.mutateAsync(payload);
  };

  const totalAllocated = allocations.reduce((sum, curr) => sum + curr.allocatedAmount, 0);
  const unallocatedAmount = Math.max(0, amountPaid - totalAllocated);

  return (
    <PageState isLoading={initLoading} error={initError?.message}>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap border-b border-gray-200 pb-4">
          <div className="flex items-center gap-3">
            <Link href="/parties" className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200 shadow-sm">
              <ArrowLeft className="h-5 w-5 text-slate-500" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                Make Supplier / Worker Payment
              </h1>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                Payments & Finance / Outgoing Payments
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-xs font-bold border-gray-300 text-slate-700 hover:bg-white h-9.5 rounded-lg px-4"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <AsyncButton
              onClick={handleSave}
              className="flex items-center gap-1.5 text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white h-9.5 rounded-lg px-4 shadow-[var(--shadow-sm)]"
            >
              <Save className="h-4 w-4" />
              Save & Record
            </AsyncButton>
          </div>
        </div>

        {/* 3-Column Top Form Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Party Details Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
              Payee Details
            </h2>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600">Select Supplier / Worker *</label>
              <select
                value={selectedPayeeId}
                onChange={(e) => setSelectedPayeeId(e.target.value)}
                className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold focus:ring-1 focus:ring-[var(--primary)] outline-none w-full"
              >
                <option value="">-- Choose Payee --</option>
                {payees.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.company_name ? `${p.company_name} (${p.name})` : p.name} {p.type?.includes("worker") ? "[WORKER]" : "[SUPPLIER]"}
                  </option>
                ))}
              </select>
            </div>

            {selectedPayee && (
              <div className="grid grid-cols-2 gap-4 pt-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Contact Person</span>
                  <span className="font-bold text-slate-800">{selectedPayee.name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Phone</span>
                  <span className="font-bold text-slate-800">{selectedPayee.phone || "—"}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Current Ledger Balance</span>
                  <span
                    className={`text-sm font-extrabold ${
                      payeeBalanceSign === "Dr" ? "text-rose-600" : "text-emerald-600"
                    }`}
                  >
                    {payeeBalance}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Payment Details Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
              Payment Details
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600">Payment Date *</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-[var(--input-border)] text-xs font-bold focus:ring-1 focus:ring-[var(--primary)] outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600">Payment Mode *</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold focus:ring-1 focus:ring-[var(--primary)] outline-none"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="neft">NEFT</option>
                  <option value="rtgs">RTGS</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600">Reference / UTR No.</label>
                <input
                  type="text"
                  value={referenceNo}
                  placeholder="e.g. UTR12345"
                  onChange={(e) => setReferenceNo(e.target.value)}
                  className="h-9 text-xs font-semibold rounded-lg border border-[var(--input-border)] bg-transparent px-3 py-1 outline-none focus:ring-1 focus:ring-[var(--primary)] w-full"
                />
              </div>

              {paymentMode !== "cash" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600">Source Account *</label>
                  <select
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold focus:ring-1 focus:ring-[var(--primary)] outline-none"
                  >
                    {bankAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.account_name} ({acc.bank_name})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600">Amount Paid (₹) *</label>
              <input
                type="number"
                placeholder="0.00"
                value={amountPaid || ""}
                onChange={(e) => setAmountPaid(Math.max(0, parseFloat(e.target.value) || 0))}
                className="h-9 text-xs font-bold text-[var(--primary)] border border-[var(--input-border)] bg-transparent px-3 py-1 outline-none focus:ring-1 focus:ring-[var(--primary)] w-full rounded-lg"
              />
            </div>
          </div>

          {/* Additional Details Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
              Additional Details
            </h2>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600">Cheque / UTR Ref Date</label>
              <input
                type="date"
                value={refDate}
                onChange={(e) => setRefDate(e.target.value)}
                className="h-9 px-3 rounded-lg border border-[var(--input-border)] text-xs font-bold focus:ring-1 focus:ring-[var(--primary)] outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600">Remarks / Notes</label>
              <textarea
                value={remarks}
                rows={3}
                placeholder="Write any additional details here..."
                onChange={(e) => setRemarks(e.target.value)}
                className="p-3 text-xs font-medium rounded-lg border border-[var(--input-border)] focus:ring-1 focus:ring-[var(--primary)] outline-none w-full resize-none"
              />
            </div>
          </div>
        </div>

        {/* Outstanding Invoices Section */}
        {selectedPayeeId && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-extrabold text-slate-800">
                Allocate to Outstanding Invoices / Job Work
              </h3>
              <span className="text-xs text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-full">
                {outstandingBills.length} Items Outstanding
              </span>
            </div>

            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl text-xs font-semibold leading-relaxed flex gap-2.5 items-start">
              <CheckCircle className="h-4.5 w-4.5 shrink-0 text-blue-600 mt-0.5" />
              <p>
                Select outstanding bills, purchases, or job work entries below to apply payment. Unallocated amounts will be recorded as an outgoing advance.
              </p>
            </div>

            {billsLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
              </div>
            ) : (
              <BillAllocationTable
                bills={outstandingBills}
                paymentAmount={amountPaid}
                onAllocationChange={(allocs) => setAllocations(allocs)}
              />
            )}
          </div>
        )}

        {/* Payment Summary card */}
        <div className="flex justify-end pt-4">
          <div className="bg-slate-900 text-white border border-slate-800 rounded-xl p-5 shadow-lg w-full max-w-sm space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 border-b border-slate-800 pb-2">
              Payment Outflow Summary
            </h3>
            <div className="space-y-2 text-xs font-semibold">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Outflow:</span>
                <span className="text-sm font-extrabold">₹{amountPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Allocated to Items:</span>
                <span className="text-sm font-bold text-green-400">₹{totalAllocated.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">To Advance Outflow:</span>
                <span className="text-sm font-bold text-blue-400">₹{unallocatedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between">
                <span className="text-slate-400">Mode:</span>
                <span className="uppercase text-[11px] font-bold text-amber-400">{paymentMode.replace(/_/g, " ")}</span>
              </div>
              {paymentMode !== "cash" && bankAccountId && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Source Bank:</span>
                  <span className="truncate max-w-[180px]">
                    {bankAccounts.find((b) => b.id === bankAccountId)?.account_name || "—"}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageState>
  );
}
