"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  worker_id?: string;
  phone?: string | null;
  type?: string;
}

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string;
  account_number: string;
}

export default function RecordJobWorkPaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const initialWorkerId = searchParams.get("worker_id") || "";

  // Page States
  const [selectedPayeeId, setSelectedPayeeId] = useState<string>(initialWorkerId);
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

  // Fetch initial workers list and bank accounts
  const { data: initData, isLoading: initLoading, error: initError } = useQuery({
    queryKey: ["job-work-payment-make-init"],
    queryFn: async () => {
      const [workersRes, banksRes] = await Promise.all([
        fetch("/api/workers"),
        fetch("/api/master-data/banks-upi"),
      ]);

      const workersData = await workersRes.json();
      const banksData = await banksRes.json();

      return {
        payees: (workersData.workers || []).map((w: any) => ({
          id: w.id,
          name: w.name,
          worker_id: w.worker_id,
          phone: w.phone,
          type: "worker",
        })) as Payee[],
        bankAccounts: (banksData.accounts || []).map((b: any) => ({
          id: b.id,
          account_name: b.account_name || b.name,
          bank_name: b.bank_name || b.type || "Bank",
          account_number: b.account_number || "",
        })) as BankAccount[],
      };
    },
  });

  const payees = initData?.payees || [];
  const bankAccounts = initData?.bankAccounts || [];

  // Fetch outstanding stage entries when worker is selected
  const { data: billsData, isLoading: billsLoading } = useQuery<{ bills: OutstandingBill[] }>({
    queryKey: ["outstanding-worker-stage-entries", selectedPayeeId],
    queryFn: async () => {
      if (!selectedPayeeId) return { bills: [] };
      const res = await fetch(`/api/production/stage-entries?worker_id=${selectedPayeeId}&limit=500`);
      if (!res.ok) throw new Error("Failed to load worker stage entries");
      const data = await res.json();
      const entriesList = data.entries || [];

      // Filter unpaid / partial entries
      const outstanding: OutstandingBill[] = entriesList
        .filter((e: any) => e.payment_status !== "paid" && Number(e.total_job_work_amount || 0) > 0)
        .map((e: any) => {
          const total = Number(e.total_job_work_amount || 0);
          const paid = Number(e.paid_amount || 0);
          return {
            id: e.id,
            invoice_number: e.entry_number,
            invoice_date: e.entry_date,
            due_date: e.entry_date,
            total,
            outstanding: Math.max(0, total - paid),
            bill_type: "job_work_entry" as const,
          };
        });

      return { bills: outstanding };
    },
    enabled: !!selectedPayeeId,
  });

  const outstandingBills = billsData?.bills || [];

  // Fetch payee balance & details when selectedPayeeId changes
  useEffect(() => {
    if (!selectedPayeeId) {
      setSelectedPayee(null);
      setPayeeBalance("₹0.00 Cr");
      setPayeeBalanceSign("Cr");
      return;
    }

    const payee = payees.find((p) => p.id === selectedPayeeId) || null;
    setSelectedPayee(payee);

    fetch(`/api/production/job-work/ledger/${selectedPayeeId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.stats) {
          const out = Number(data.stats.currentOutstanding || 0);
          const formatted = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(out);
          setPayeeBalance(`${formatted} Cr`);
          setPayeeBalanceSign("Cr");
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
      const res = await fetch("/api/production/job-work/payments", {
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
      queryClient.invalidateQueries({ queryKey: ["job-work-entries-list"] });
      queryClient.invalidateQueries({ queryKey: ["worker-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["job-work-payments-list"] });
      router.push("/production/job-work?tab=payments");
    },
    onError: (err: any) => {
      toast.error(err.message || "An error occurred while saving payment.");
    },
  });

  const handleSave = async () => {
    if (!selectedPayeeId) {
      toast.error("Please select a Job Worker.");
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
      worker_id: selectedPayeeId,
      payment_date: paymentDate,
      payment_mode: paymentMode,
      reference_no: referenceNo || null,
      paid_amount: amountPaid,
      bank_account_id: paymentMode === "cash" ? null : bankAccountId,
      remarks: remarks || null,
      entries: allocations.map((a) => ({
        stage_entry_id: a.billId,
        amount_to_apply: a.allocatedAmount,
      })),
    };

    await savePaymentMutation.mutateAsync(payload);
  };

  const totalAllocated = allocations.reduce((sum, curr) => sum + curr.allocatedAmount, 0);
  const unallocatedAmount = Math.max(0, amountPaid - totalAllocated);

  return (
    <PageState isLoading={initLoading} error={initError?.message}>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap border-b border-[var(--border)] pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/production/job-work"
              className="p-2 hover:bg-[var(--card-bg)] rounded-lg transition-colors border border-[var(--border)] shadow-[var(--shadow-sm)]"
            >
              <ArrowLeft className="h-5 w-5 text-[var(--text-muted)]" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                Make Supplier / Worker Payment
              </h1>
              <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                PAYMENTS & FINANCE / OUTGOING PAYMENTS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-xs font-bold border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--card-bg)] h-9 rounded-lg px-4"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <AsyncButton
              onClick={handleSave}
              className="flex items-center gap-1.5 text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white h-9 rounded-lg px-4 shadow-md shadow-[var(--primary)]/20 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              Save & Record
            </AsyncButton>
          </div>
        </div>

        {/* 3-Column Top Form Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Payee Details Card */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] space-y-4">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-light)] pb-2">
              Payee Details
            </h2>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)]">Select Supplier / Worker *</label>
              <select
                value={selectedPayeeId}
                onChange={(e) => setSelectedPayeeId(e.target.value)}
                className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-xs font-bold focus:ring-1 focus:ring-[var(--primary)] outline-none w-full"
              >
                <option value="" className="bg-[var(--card-bg)]">-- Choose Payee --</option>
                {payees.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[var(--card-bg)]">
                    {p.name} [WORKER]
                  </option>
                ))}
              </select>
            </div>

            {selectedPayee && (
              <div className="grid grid-cols-2 gap-4 pt-2 text-xs">
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase">Contact Person</span>
                  <span className="font-bold text-[var(--text-primary)]">{selectedPayee.name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase">Phone</span>
                  <span className="font-bold text-[var(--text-primary)]">{selectedPayee.phone || "—"}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-[var(--border-light)]">
                  <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase">Current Ledger Balance</span>
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
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] space-y-4">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-light)] pb-2">
              Payment Details
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)]">Payment Date *</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-xs font-bold focus:ring-1 focus:ring-[var(--primary)] outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)]">Payment Mode *</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-xs font-bold focus:ring-1 focus:ring-[var(--primary)] outline-none"
                >
                  <option value="bank_transfer" className="bg-[var(--card-bg)]">Bank Transfer</option>
                  <option value="upi" className="bg-[var(--card-bg)]">UPI</option>
                  <option value="cash" className="bg-[var(--card-bg)]">Cash</option>
                  <option value="cheque" className="bg-[var(--card-bg)]">Cheque</option>
                  <option value="neft" className="bg-[var(--card-bg)]">NEFT</option>
                  <option value="rtgs" className="bg-[var(--card-bg)]">RTGS</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)]">Reference / UTR No.</label>
                <input
                  type="text"
                  value={referenceNo}
                  placeholder="e.g. UTR12345"
                  onChange={(e) => setReferenceNo(e.target.value)}
                  className="h-9 text-xs font-semibold rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] px-3 py-1 outline-none focus:ring-1 focus:ring-[var(--primary)] w-full"
                />
              </div>

              {paymentMode !== "cash" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[var(--text-secondary)]">Source Account *</label>
                  <select
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-xs font-bold focus:ring-1 focus:ring-[var(--primary)] outline-none"
                  >
                    {bankAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id} className="bg-[var(--card-bg)]">
                        {acc.account_name} ({acc.bank_name})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)]">Amount Paid (₹) *</label>
              <input
                type="number"
                placeholder="0.00"
                value={amountPaid || ""}
                onChange={(e) => setAmountPaid(Math.max(0, parseFloat(e.target.value) || 0))}
                className="h-9 text-xs font-bold text-[var(--primary)] border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-1 outline-none focus:ring-1 focus:ring-[var(--primary)] w-full rounded-lg"
              />
            </div>
          </div>

          {/* Additional Details Card */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] space-y-4">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-light)] pb-2">
              Additional Details
            </h2>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)]">Cheque / UTR Ref Date</label>
              <input
                type="date"
                value={refDate}
                onChange={(e) => setRefDate(e.target.value)}
                className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-xs font-bold focus:ring-1 focus:ring-[var(--primary)] outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)]">Remarks / Notes</label>
              <textarea
                value={remarks}
                rows={3}
                placeholder="Write any additional details here..."
                onChange={(e) => setRemarks(e.target.value)}
                className="p-3 text-xs font-medium rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:ring-1 focus:ring-[var(--primary)] outline-none w-full resize-none"
              />
            </div>
          </div>
        </div>

        {/* Outstanding Invoices Section */}
        {selectedPayeeId && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--border-light)] pb-2">
              <h3 className="text-sm font-extrabold text-[var(--text-primary)]">
                Allocate to Outstanding Invoices / Job Work
              </h3>
              <span className="text-xs text-[var(--text-muted)] font-semibold bg-[var(--page-bg)] px-2 py-0.5 rounded-full border border-[var(--border)]">
                {outstandingBills.length} Items Outstanding
              </span>
            </div>

            <div className="bg-[var(--primary-light)] border border-[var(--primary)]/20 text-[var(--primary)] p-4 rounded-xl text-xs font-semibold leading-relaxed flex gap-2.5 items-start">
              <CheckCircle className="h-4.5 w-4.5 shrink-0 text-[var(--primary)] mt-0.5" />
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

        {/* Payment Outflow Summary card */}
        <div className="flex justify-end pt-4">
          <div className="bg-[var(--card-bg)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] w-full max-w-sm space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] border-b border-[var(--border-light)] pb-2">
              Payment Outflow Summary
            </h3>
            <div className="space-y-2 text-xs font-semibold">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Total Outflow:</span>
                <span className="text-sm font-extrabold text-[var(--text-primary)]">₹{amountPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Allocated to Items:</span>
                <span className="text-sm font-bold text-emerald-600">₹{totalAllocated.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">To Advance Outflow:</span>
                <span className="text-sm font-bold text-[var(--primary)]">₹{unallocatedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t border-[var(--border-light)] pt-2 flex justify-between">
                <span className="text-[var(--text-muted)]">Mode:</span>
                <span className="uppercase text-[11px] font-bold text-amber-600">{paymentMode.replace(/_/g, " ")}</span>
              </div>
              {paymentMode !== "cash" && bankAccountId && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Source Bank:</span>
                  <span className="truncate max-w-[180px] text-[var(--text-secondary)]">
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
