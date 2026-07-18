"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, X, Calendar, Wallet, CheckCircle, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import AsyncButton from "@/components/shared/AsyncButton";
import PageState from "@/components/shared/PageState";
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
  account_name: string;
  bank_name: string;
  account_number: string;
}

export default function ReceivePaymentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Page States
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerBalance, setCustomerBalance] = useState<string>("₹0.00 Dr");
  const [customerBalanceSign, setCustomerBalanceSign] = useState<"Dr" | "Cr">("Dr");

  // Form Fields
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [paymentMode, setPaymentMode] = useState<string>("bank_transfer");
  const [referenceNo, setReferenceNo] = useState<string>("");
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [remarks, setRemarks] = useState<string>( "");
  const [refDate, setRefDate] = useState<string>("");
  
  // Allocations state
  const [allocations, setAllocations] = useState<any[]>([]);

  // Fetch initial customers and bank accounts
  const { data: initData, isLoading: initLoading, error: initError } = useQuery<{
    customers: Customer[];
    bankAccounts: BankAccount[];
  }>({
    queryKey: ["payment-receive-init"],
    queryFn: async () => {
      const res = await fetch("/api/payments/receive");
      if (!res.ok) throw new Error("Failed to load initial form data");
      return res.json();
    },
  });

  const customers = initData?.customers || [];
  const bankAccounts = initData?.bankAccounts || [];

  // Fetch outstanding bills when customer is selected
  const { data: billsData, isLoading: billsLoading } = useQuery<{ bills: OutstandingBill[] }>({
    queryKey: ["outstanding-bills", selectedCustomerId],
    queryFn: async () => {
      if (!selectedCustomerId) return { bills: [] };
      const res = await fetch(`/api/payments/receive?party_id=${selectedCustomerId}`);
      if (!res.ok) throw new Error("Failed to load outstanding bills");
      return res.json();
    },
    enabled: !!selectedCustomerId,
  });

  const outstandingBills = billsData?.bills || [];

  // Fetch customer ledger to get precise running balance
  useEffect(() => {
    if (!selectedCustomerId) {
      setSelectedCustomer(null);
      setCustomerBalance("₹0.00 Dr");
      setCustomerBalanceSign("Dr");
      return;
    }

    const customer = customers.find((c) => c.id === selectedCustomerId) || null;
    setSelectedCustomer(customer);

    fetch(`/api/parties/${selectedCustomerId}/ledger`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.ledger && data.ledger.length > 0) {
          const lastEntry = data.ledger[data.ledger.length - 1];
          setCustomerBalance(lastEntry.balanceStr);
          setCustomerBalanceSign(lastEntry.balanceSign);
        } else {
          setCustomerBalance("₹0.00 Dr");
          setCustomerBalanceSign("Dr");
        }
      })
      .catch(() => {
        setCustomerBalance("₹0.00 Dr");
        setCustomerBalanceSign("Dr");
      });
  }, [selectedCustomerId, customers]);

  // Set default bank account if available
  useEffect(() => {
    if (bankAccounts.length > 0 && !bankAccountId) {
      setBankAccountId(bankAccounts[0].id);
    }
  }, [bankAccounts, bankAccountId]);

  // Save payment mutation
  const savePaymentMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/payments/receive", {
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
    onSuccess: (data) => {
      toast.success("Payment recorded successfully!");
      queryClient.invalidateQueries({ queryKey: ["ledger", selectedCustomerId] });
      queryClient.invalidateQueries({ queryKey: ["outstanding-bills", selectedCustomerId] });
      router.push(`/parties/${selectedCustomerId}/ledger`);
    },
    onError: (err: any) => {
      toast.error(err.message || "An error occurred while saving.");
    },
  });

  const handleSave = async () => {
    if (!selectedCustomerId) {
      toast.error("Please select a customer.");
      return;
    }
    if (amountReceived <= 0) {
      toast.error("Amount received must be greater than zero.");
      return;
    }
    if (!paymentDate) {
      toast.error("Please enter a payment date.");
      return;
    }

    const payload = {
      party_id: selectedCustomerId,
      amount: amountReceived,
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
  const unallocatedAmount = Math.max(0, amountReceived - totalAllocated);

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
                Receive Customer Payment
              </h1>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                Payments & Finance / Customer Inflow
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-xs font-bold border-[#CBD5E1] text-[#64748B] hover:bg-[#F8FAFC] h-9 rounded-lg px-4"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <AsyncButton
              onClick={handleSave}
              className="flex items-center gap-1.5 text-xs font-bold bg-[#6366F1] hover:bg-[#4F46E5] text-white h-9 rounded-lg px-4 shadow-md shadow-[#6366F1]/20"
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
              Party Details
            </h2>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600">Select Customer *</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold focus:ring-1 focus:ring-[var(--primary)] outline-none w-full"
              >
                <option value="">-- Choose Customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name ? `${c.company_name} (${c.name})` : c.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedCustomer && (
              <div className="grid grid-cols-2 gap-4 pt-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Contact Person</span>
                  <span className="font-bold text-slate-800">{selectedCustomer.name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Phone</span>
                  <span className="font-bold text-slate-800">{selectedCustomer.phone || "—"}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Current Ledger Balance</span>
                  <span
                    className={`text-sm font-extrabold ${
                      customerBalanceSign === "Cr" ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {customerBalance}
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
                  <label className="text-xs font-bold text-slate-600">Deposit Account *</label>
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
              <label className="text-xs font-bold text-slate-600">Amount Received (₹) *</label>
              <input
                type="number"
                placeholder="0.00"
                value={amountReceived || ""}
                onChange={(e) => setAmountReceived(Math.max(0, parseFloat(e.target.value) || 0))}
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

        {/* Outstanding Bills Table Section */}
        {selectedCustomerId && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-extrabold text-slate-800">
                Allocate to Outstanding Invoices
              </h3>
              <span className="text-xs text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-full">
                {outstandingBills.length} Invoices Outstanding
              </span>
            </div>

            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl text-xs font-semibold leading-relaxed flex gap-2.5 items-start">
              <CheckCircle className="h-4.5 w-4.5 shrink-0 text-blue-600 mt-0.5" />
              <p>
                Select one or more invoices below and allocate the received amount. Any unallocated amount will automatically be saved as an advance payment for the customer.
              </p>
            </div>

            {billsLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
              </div>
            ) : (
              <BillAllocationTable
                bills={outstandingBills}
                paymentAmount={amountReceived}
                onAllocationChange={(allocs) => setAllocations(allocs)}
              />
            )}
          </div>
        )}

        {/* Payment Summary bottom-right sticky-style card */}
        <div className="flex justify-end pt-4">
          <div className="bg-white text-slate-800 border border-gray-200 rounded-xl p-5 shadow-sm w-full max-w-sm space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 border-b border-gray-100 pb-2">
              Payment Inflow Summary
            </h3>
            <div className="space-y-2 text-xs font-semibold">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Inflow:</span>
                <span className="text-sm font-extrabold text-slate-900">₹{amountReceived.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Allocated to Invoices:</span>
                <span className="text-sm font-bold text-emerald-600">₹{totalAllocated.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">To Advance Balance:</span>
                <span className="text-sm font-bold text-blue-600">₹{unallocatedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t border-gray-100 pt-2 flex justify-between">
                <span className="text-slate-500">Mode:</span>
                <span className="uppercase text-[11px] font-bold text-amber-600">{paymentMode.replace(/_/g, " ")}</span>
              </div>
              {paymentMode !== "cash" && bankAccountId && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Deposit Bank:</span>
                  <span className="truncate max-w-[180px] text-slate-700">
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
