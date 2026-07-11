"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  User,
  CheckCircle,
  IndianRupee,
  Calendar,
  Building2,
  Lock,
  Plus,
  Trash2,
  FileText,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import WorkerAvatar from "@/components/shared/WorkerAvatar";
import LotSummaryPanel from "@/components/shared/LotSummaryPanel";

interface Worker {
  id: string;
  name: string;
  worker_id: string;
  type: string;
  phone: string;
  default_rate: number;
}

interface StageEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  qty_out: number;
  job_work_rate: number;
  total_job_work_amount: number;
  paid_amount: number;
  payment_status: string;
  lot?: { lot_number: string };
  stage?: { stage_name: string };
}

interface PaymentEntryInput {
  stage_entry_id: string;
  entry_number: string;
  lot_number: string;
  stage_name: string;
  total_amount: number;
  outstanding: number;
  amount_to_apply: number;
  selected: boolean;
}

export default function RecordPaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Selected Worker ID
  const [workerId, setWorkerId] = useState(searchParams.get("worker_id") || "");

  // Section 3: Payment Details
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().substring(0, 10));
  const [paymentMode, setPaymentMode] = useState("bank_transfer");
  const [referenceNo, setReferenceNo] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [paidAmount, setPaidAmount] = useState(0);

  const [bankAccountId, setBankAccountId] = useState("");
  const [upiId, setUpiId] = useState("");

  const { data: accountsData } = useQuery({
    queryKey: ["banks-upi-list-jobwork"],
    queryFn: async () => {
      const res = await fetch("/api/master-data/banks-upi");
      return res.json();
    },
  });

  const bankAccounts = accountsData?.accounts || [];
  const bankOptions = bankAccounts.filter((b: any) => b.type === "bank");
  const upiOptions = bankAccounts.filter((b: any) => b.type === "upi");

  const handleSelectBankAccount = (id: string) => {
    setBankAccountId(id);
    const selected = bankOptions.find((b: any) => b.id === id);
    if (selected) {
      setBankName(selected.bank_name || selected.name);
      setAccountName(selected.account_number ? `A/C ...${selected.account_number.slice(-4)}` : selected.name);
    } else {
      setBankName("");
      setAccountName("");
    }
  };

  const handleSelectUpiAccount = (id: string) => {
    setUpiId(id);
    const selected = upiOptions.find((u: any) => u.id === id);
    if (selected) {
      setBankName(selected.name);
      setAccountName(selected.upi_id || "UPI");
    } else {
      setBankName("");
      setAccountName("");
    }
  };

  const handlePaymentModeChange = (mode: string) => {
    setPaymentMode(mode);
    setBankAccountId("");
    setUpiId("");
    if (mode === "cash") {
      setBankName("Cash Register");
      setAccountName("Cash");
    } else {
      setBankName("");
      setAccountName("");
    }
  };

  // Selected table entries
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntryInput[]>([]);

  // Filters for Select Entries Section
  const [lotFilter, setLotFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [saving, setSaving] = useState(false);

  // Queries
  const { data: workersData } = useQuery<{ workers: Worker[] }>({
    queryKey: ["workers-list-all"],
    queryFn: async () => {
      const res = await fetch("/api/workers");
      return res.json();
    },
  });

  // Query: Fetch worker outstanding entries
  const { data: entriesData, isLoading: loadingEntries } = useQuery({
    queryKey: ["worker-outstanding-entries", workerId],
    queryFn: async () => {
      if (!workerId) return null;
      // Fetch all entries for this worker
      const res = await fetch(`/api/production/job-work/list?worker_id=${workerId}`);
      if (!res.ok) throw new Error("Failed to fetch worker entries");
      return res.json();
    },
    enabled: !!workerId,
  });

  // Query: Fetch worker ledger to get outstanding balance & recent payments
  const { data: ledgerData } = useQuery({
    queryKey: ["worker-ledger-payment", workerId],
    queryFn: async () => {
      if (!workerId) return null;
      const res = await fetch(`/api/production/job-work/ledger/${workerId}`);
      if (!res.ok) throw new Error("Failed to fetch ledger");
      return res.json();
    },
    enabled: !!workerId,
  });

  const workers = workersData?.workers || [];
  const selectedWorker = workers.find((w) => w.id === workerId);
  const rawEntries: StageEntry[] = entriesData?.entries || [];
  const recentPayments = ledgerData?.ledger?.filter((row: any) => row.entry_type === "payment") || [];
  const currentOutstanding = ledgerData?.stats?.currentOutstanding || 0;

  // Initialize selectable entries when raw entries load
  useEffect(() => {
    if (rawEntries.length > 0) {
      const unpaidOrPartial = rawEntries.filter((e) => e.payment_status !== "paid");
      const mapped = unpaidOrPartial.map((e) => {
        const total = parseFloat(e.total_job_work_amount as any || 0);
        const paid = parseFloat(e.paid_amount as any || 0);
        const outstanding = total - paid;
        return {
          stage_entry_id: e.id,
          entry_number: e.entry_number,
          lot_number: e.lot?.lot_number || "",
          stage_name: e.stage?.stage_name || "",
          total_amount: total,
          outstanding,
          amount_to_apply: 0,
          selected: false,
        };
      });
      setPaymentEntries(mapped);
    } else {
      setPaymentEntries([]);
    }
  }, [entriesData?.entries]);

  // Toggle selection on a row
  const toggleRow = (index: number) => {
    const updated = [...paymentEntries];
    const row = updated[index];
    row.selected = !row.selected;
    if (row.selected) {
      // auto-fill amount to apply
      row.amount_to_apply = row.outstanding;
    } else {
      row.amount_to_apply = 0;
    }
    setPaymentEntries(updated);

    // Sync total paid amount input to sum of selected applied amounts
    const totalApplied = updated
      .filter((r) => r.selected)
      .reduce((acc, curr) => acc + curr.amount_to_apply, 0);
    setPaidAmount(totalApplied);
  };

  // Handle manual change of amount to apply
  const handleAmountToApplyChange = (index: number, val: number) => {
    const updated = [...paymentEntries];
    const row = updated[index];
    row.amount_to_apply = Math.min(val, row.outstanding); // limit to outstanding
    setPaymentEntries(updated);

    const totalApplied = updated
      .filter((r) => r.selected)
      .reduce((acc, curr) => acc + curr.amount_to_apply, 0);
    setPaidAmount(totalApplied);
  };

  // Sync paid amount input manually if user overrides
  const handlePaidAmountOverride = (val: number) => {
    setPaidAmount(val);

    // Distribute paid amount across selected rows in order
    let remaining = val;
    const updated = paymentEntries.map((row) => {
      if (!row.selected) return row;
      const applied = Math.min(remaining, row.outstanding);
      remaining -= applied;
      return {
        ...row,
        amount_to_apply: applied,
      };
    });
    setPaymentEntries(updated);
  };

  // Submit payment
  const handleSavePayment = async () => {
    if (!workerId || paidAmount <= 0) {
      toast.error("Please select a worker and enter a positive payment amount");
      return;
    }

    const selectedRows = paymentEntries.filter((r) => r.selected && r.amount_to_apply > 0);
    if (selectedRows.length === 0) {
      toast.error("Please select at least one stage entry to pay");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        worker_id: workerId,
        payment_date: paymentDate,
        payment_mode: paymentMode,
        reference_no: referenceNo,
        paid_amount: paidAmount,
        bank_name: bankName,
        account_name: accountName,
        bank_account_id: ["bank_transfer", "cheque"].includes(paymentMode) ? (bankAccountId || null) : null,
        upi_id: paymentMode === "upi" ? (upiId || null) : null,
        remarks,
        entries: selectedRows.map((r) => ({
          stage_entry_id: r.stage_entry_id,
          amount_to_apply: r.amount_to_apply,
        })),
      };

      const res = await fetch("/api/production/job-work/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to record payment");

      toast.success("Payment recorded and ledger updated successfully");
      router.push(`/production/job-work/ledger/${workerId}`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to save payment");
    } finally {
      setSaving(false);
    }
  };

  // Unique lots and stages for sub-filters
  const lotOptions = Array.from(new Set(paymentEntries.map((e) => e.lot_number).filter(Boolean)));
  const stageOptions = Array.from(new Set(paymentEntries.map((e) => e.stage_name).filter(Boolean)));

  // Filter selectable table entries
  const filteredEntries = paymentEntries.filter((e) => {
    const matchesLot = lotFilter === "all" || e.lot_number === lotFilter;
    const matchesStage = stageFilter === "all" || e.stage_name === stageFilter;
    const matchesSearch =
      e.entry_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.lot_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.stage_name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesLot && matchesStage && matchesSearch;
  });

  const totalSelectedCount = paymentEntries.filter((r) => r.selected).length;
  const totalSelectedApplied = paymentEntries
    .filter((r) => r.selected)
    .reduce((acc, curr) => acc + curr.amount_to_apply, 0);

  // Formatting helpers
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
  };

  // Summaries
  const paymentSummaryItems = [
    { label: "Worker Name", value: selectedWorker?.name || "—" },
    { label: "Selected Entries", value: `${totalSelectedCount} entries` },
    { label: "Applied Amount", value: formatCurrency(totalSelectedApplied), isQuantity: true },
    { label: "Payment Amount", value: formatCurrency(paidAmount) },
    {
      label: "Remaining Outstanding",
      value: (
        <span className="text-[#DC2626] font-semibold">
          {formatCurrency(Math.max(currentOutstanding - paidAmount, 0))}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 select-none max-w-[1400px] mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[#64748B] font-semibold uppercase tracking-wider">
        <Link href="/" className="hover:text-[#6366F1] transition-colors">
          Production
        </Link>
        <ChevronRight size={12} className="text-[#94A3B8]" />
        <Link href="/production/job-work/list" className="hover:text-[#6366F1] transition-colors">
          Job Work
        </Link>
        <ChevronRight size={12} className="text-[#94A3B8]" />
        {workerId ? (
          <Link href={`/production/job-work/ledger/${workerId}`} className="hover:text-[#6366F1] transition-colors">
            Worker Ledger
          </Link>
        ) : (
          <span className="text-[#64748B]">Worker Ledger</span>
        )}
        <ChevronRight size={12} className="text-[#94A3B8]" />
        <span className="text-[#374151]">Record Payment</span>
      </nav>

      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (workerId) router.push(`/production/job-work/ledger/${workerId}`);
              else router.push("/production/job-work/list");
            }}
            className="w-9 h-9 border border-[#E5E7EB] rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#0F172A] hover:bg-[#F9FAFB] transition-colors cursor-pointer bg-white"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">Record Job Work Payment</h2>
            <p className="text-xs text-[#64748B]">Issue payments and clear worker outstanding accounts</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSavePayment}
          disabled={saving || paidAmount <= 0}
          className="bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 text-white font-semibold text-sm px-5 h-10 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#6366F1]/10"
        >
          <CheckCircle size={16} />
          Save Payment
        </button>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Sections */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Select Worker */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[#EEF2FF] text-[#6366F1] font-bold text-xs flex items-center justify-center">
                1
              </span>
              <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">Select Worker</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-end">
              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Worker / Tailor <span className="text-red-500">*</span>
                </label>
                <select
                  value={workerId}
                  onChange={(e) => {
                    setWorkerId(e.target.value);
                    setPaymentEntries([]);
                  }}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                >
                  <option value="">Select Worker</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Worker Type</label>
                <input
                  type="text"
                  value={selectedWorker ? selectedWorker.type.replace("_", " ") : "—"}
                  disabled
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-gray-50 px-3 text-sm capitalize text-[#64748B]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Phone</label>
                <input
                  type="text"
                  value={selectedWorker ? selectedWorker.phone || "—" : "—"}
                  disabled
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-gray-50 px-3 text-sm text-[#64748B]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase font-mono">Rate (Per Pc)</label>
                <input
                  type="text"
                  value={selectedWorker ? `₹${selectedWorker.default_rate.toFixed(2)}` : "—"}
                  disabled
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-gray-50 px-3 text-sm text-[#64748B] font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Outstanding</label>
                <input
                  type="text"
                  value={formatCurrency(currentOutstanding)}
                  disabled
                  className="w-full h-10 rounded-lg border border-[#FEF2F2] bg-[#FEF2F2] px-3 text-sm font-bold text-[#DC2626]"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Select Entries to Pay */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[#DBEAFE] text-[#1D4ED8] font-bold text-xs flex items-center justify-center">
                2
              </span>
              <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">
                Select Entries to Pay
              </h3>
            </div>

            {/* Sub filters */}
            <div className="flex flex-wrap items-center gap-3 bg-[#F9FAFB] p-3 rounded-lg border border-[#E5E7EB]">
              <select
                value={lotFilter}
                onChange={(e) => setLotFilter(e.target.value)}
                className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-xs w-[130px]"
              >
                <option value="all">All Lots</option>
                {lotOptions.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>

              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-xs w-[130px]"
              >
                <option value="all">All Stages</option>
                {stageOptions.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Search entries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs flex-1"
              />
            </div>

            {/* Table */}
            <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-xs font-bold text-[#64748B] uppercase">
                    <th className="py-2 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={paymentEntries.length > 0 && paymentEntries.every((e) => e.selected)}
                        onChange={(e) => {
                          const val = e.target.checked;
                          const updated = paymentEntries.map((row) => ({
                            ...row,
                            selected: val,
                            amount_to_apply: val ? row.outstanding : 0,
                          }));
                          setPaymentEntries(updated);
                          setPaidAmount(updated.reduce((acc, curr) => acc + curr.amount_to_apply, 0));
                        }}
                        className="rounded text-[#6366F1]"
                      />
                    </th>
                    <th className="py-2 px-3">Entry No.</th>
                    <th className="py-2 px-3">Lot No.</th>
                    <th className="py-2 px-3">Stage</th>
                    <th className="py-2 px-3 text-right">Total JW</th>
                    <th className="py-2 px-3 text-right">Outstanding</th>
                    <th className="py-2 px-3 text-right w-28">Amount to Apply</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] text-sm">
                  {loadingEntries ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-[#64748B]">
                        Loading entries...
                      </td>
                    </tr>
                  ) : filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-[#64748B]">
                        No outstanding entries for this worker.
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map((row, idx) => {
                      const absoluteIdx = paymentEntries.findIndex((e) => e.stage_entry_id === row.stage_entry_id);
                      return (
                        <tr key={row.stage_entry_id} className={`hover:bg-[#F9FAFB] ${row.selected ? "bg-[#EFF6FF]" : ""}`}>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={() => toggleRow(absoluteIdx)}
                              className="rounded text-[#6366F1]"
                            />
                          </td>
                          <td className="py-2 px-3 font-mono text-xs">{row.entry_number}</td>
                          <td className="py-2 px-3 font-mono text-xs text-[#6366F1] font-bold">{row.lot_number}</td>
                          <td className="py-2 px-3 text-xs font-semibold">{row.stage_name}</td>
                          <td className="py-2 px-3 text-right">₹{row.total_amount.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-bold text-red-600">₹{row.outstanding.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              disabled={!row.selected}
                              value={row.amount_to_apply || ""}
                              onChange={(e) => handleAmountToApplyChange(absoluteIdx, parseFloat(e.target.value) || 0)}
                              className="w-24 h-8 px-2 border rounded-lg text-right text-xs focus:ring-1 focus:ring-[#6366F1]"
                              placeholder="0.00"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Payment Details */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[#F0FDF4] text-[#16A34A] font-bold text-xs flex items-center justify-center">
                3
              </span>
              <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">
                Payment Details
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Payment Date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => handlePaymentModeChange(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI / Digital</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Ref No / TXN ID</label>
                <input
                  type="text"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none"
                  placeholder="e.g. TXN-123456"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Paid Amount</label>
                <input
                  type="number"
                  min="0"
                  value={paidAmount || ""}
                  onChange={(e) => handlePaidAmountOverride(parseFloat(e.target.value) || 0)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none font-bold text-[#0F172A]"
                  placeholder="0.00"
                />
              </div>

              {["bank_transfer", "cheque"].includes(paymentMode) && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Bank Account *</label>
                    <select
                      value={bankAccountId}
                      onChange={(e) => handleSelectBankAccount(e.target.value)}
                      className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none"
                    >
                      <option value="">Select Bank Account</option>
                      {bankOptions.map((b: any) => (
                        <option key={b.id} value={b.id}>
                          {b.bank_name || b.name} ({b.account_number ? b.account_number.slice(-4) : "—"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Bank Name</label>
                    <input
                      type="text"
                      readOnly
                      value={bankName}
                      className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-slate-50 px-3 text-sm focus:outline-none text-[#64748B]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Account Details</label>
                    <input
                      type="text"
                      readOnly
                      value={accountName}
                      className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-slate-50 px-3 text-sm focus:outline-none text-[#64748B]"
                    />
                  </div>
                </>
              )}

              {paymentMode === "upi" && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">UPI Endpoint *</label>
                    <select
                      value={upiId}
                      onChange={(e) => handleSelectUpiAccount(e.target.value)}
                      className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none"
                    >
                      <option value="">Select UPI ID</option>
                      {upiOptions.map((u: any) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.upi_id || "—"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">UPI Name</label>
                    <input
                      type="text"
                      readOnly
                      value={bankName}
                      className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-slate-50 px-3 text-sm focus:outline-none text-[#64748B]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">UPI Address</label>
                    <input
                      type="text"
                      readOnly
                      value={accountName}
                      className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-slate-50 px-3 text-sm focus:outline-none text-[#64748B]"
                    />
                  </div>
                </>
              )}

              {paymentMode === "cash" && (
                <div className="sm:col-span-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Register</label>
                    <input
                      type="text"
                      readOnly
                      value={bankName}
                      className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-slate-50 px-3 text-sm focus:outline-none text-[#64748B]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Method</label>
                    <input
                      type="text"
                      readOnly
                      value={accountName}
                      className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-slate-50 px-3 text-sm focus:outline-none text-[#64748B]"
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Remarks / Notes</label>
              <textarea
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                maxLength={250}
                className="w-full rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm resize-none focus:outline-none"
                placeholder="Enter remarks..."
              />
              <span className="text-[10px] text-[#94A3B8] font-bold block text-right mt-1">
                {remarks.length} / 250 characters
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Sideboards */}
        <div className="space-y-6">
          {/* Payment Summary */}
          <LotSummaryPanel title="Payment Summary" items={paymentSummaryItems} />

          {/* Recent Payments list */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[#0F172A] border-b border-[#F3F4F6] pb-3 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileText className="h-4.5 w-4.5 text-[#6366F1]" />
              Recent Payments
            </h3>

            {recentPayments.length === 0 ? (
              <span className="text-xs text-[#94A3B8] italic block py-4 text-center">No recent payments</span>
            ) : (
              <div className="space-y-3 mt-2 max-h-56 overflow-y-auto">
                {recentPayments.slice(0, 5).map((pay: any) => (
                  <div key={pay.id} className="flex justify-between items-center py-2 border-b border-[#F3F4F6] last:border-0 text-xs">
                    <div>
                      <span className="font-bold text-[#374151] font-mono">{pay.ref_no}</span>
                      <p className="text-[#94A3B8] mt-0.5">{pay.date}</p>
                    </div>
                    <span className="font-bold text-[#15803D]">{formatCurrency(Math.abs(pay.amount))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Note Card */}
          <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-4 flex gap-3">
            <CheckCircle className="h-5 w-5 text-[#1D4ED8] shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-bold text-[#1D4ED8] block">Payment Note</span>
              <p className="text-[11px] text-[#374151] leading-relaxed mt-1">
                After saving, the payment will be recorded in the ledger and linked back to the selected stage entries. This will update their outstanding balances.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
