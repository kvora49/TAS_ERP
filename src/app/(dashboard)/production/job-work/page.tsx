"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Factory,
  ClipboardList,
  BookOpen,
  CreditCard,
  Plus,
  Search,
  ChevronRight,
  IndianRupee,
  Download,
  CheckCircle,
  Clock,
  Eye,
  Filter,
  Calendar,
  Building2,
  User,
  Phone,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  Printer,
  X,
  CheckSquare,
  Square,
  SlidersHorizontal,
  Edit,
  Trash2,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "sonner";
import WorkerAvatar from "@/components/shared/WorkerAvatar";
import { DueDateBadge } from "@/components/shared/DueDateBadge";
import { NumericInput } from "@/components/ui/numeric-input";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Worker {
  id: string;
  name: string;
  worker_id: string;
  phone?: string | null;
  type: string;
}

interface Lot {
  id: string;
  lot_number: string;
}

interface JobWorkEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  due_date?: string | null;
  qty_out: number;
  job_work_rate: number;
  total_job_work_amount: number;
  paid_amount: number;
  payment_status: "unpaid" | "partial" | "paid";
  lot_id: string;
  lot?: { lot_number: string };
  stage?: { stage_name: string };
  worker?: { id: string; name: string; worker_id: string };
}

interface LedgerRow {
  id: string;
  date: string;
  entry_type: "stage_entry" | "payment";
  ref_no: string;
  lot_id: string | null;
  lot_number: string;
  stage_name: string;
  qty: number | null;
  rate: number | null;
  amount: number;
  balance: number;
  payment_status?: string;
  bank_name?: string | null;
}

interface JobWorkPayment {
  id: string;
  payment_number: string;
  payment_date: string;
  payment_mode: string;
  reference_no: string | null;
  paid_amount: number;
  bank_name: string | null;
  account_name: string | null;
  remarks: string | null;
  status: string;
  worker?: { id: string; name: string; worker_id: string };
}

interface UnpaidEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  lot_number: string;
  stage_name: string;
  total_amount: number;
  paid_amount: number;
  outstanding: number;
  amount_to_apply: number;
  selected: boolean;
}

export default function UnifiedJobWorkPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // Active Tab: 'entries' | 'ledger' | 'payments'
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"entries" | "ledger" | "payments">(
    tabParam === "ledger" ? "ledger" : tabParam === "payments" ? "payments" : "entries"
  );

  // Sync state if query param changes
  useEffect(() => {
    if (tabParam === "ledger") setActiveTab("ledger");
    else if (tabParam === "payments") setActiveTab("payments");
    else if (tabParam === "entries") setActiveTab("entries");
  }, [tabParam]);

  // Record Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(
    searchParams.get("action") === "record-payment"
  );

  // Tab 1: Entries Filters State
  const [entriesSearch, setEntriesSearch] = useState("");
  const debouncedEntriesSearch = useDebounce(entriesSearch, 300);
  const [entriesWorkerFilter, setEntriesWorkerFilter] = useState("all");
  const [entriesStageFilter, setEntriesStageFilter] = useState("all");
  const [entriesLotFilter, setEntriesLotFilter] = useState("all");
  const [entriesStatusFilter, setEntriesStatusFilter] = useState("all");
  const [entriesStartDate, setEntriesStartDate] = useState("");
  const [entriesEndDate, setEntriesEndDate] = useState("");
  const [entriesPage, setEntriesPage] = useState(1);

  // Stage Entry Modal & Delete States
  const [detailModalEntry, setDetailModalEntry] = useState<JobWorkEntry | null>(null);
  const [deleteConfirmEntry, setDeleteConfirmEntry] = useState<JobWorkEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState(false);

  const handleDeleteEntry = async () => {
    if (!deleteConfirmEntry) return;
    setDeletingEntry(true);
    try {
      const res = await fetch(`/api/production/stage-entries/${deleteConfirmEntry.id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to delete stage entry");

      toast.success("Stage entry deleted successfully!");
      setDeleteConfirmEntry(null);
      queryClient.invalidateQueries({ queryKey: ["job-work-entries-list"] });
      queryClient.invalidateQueries({ queryKey: ["worker-ledger"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete stage entry");
    } finally {
      setDeletingEntry(false);
    }
  };

  // Tab 2: Ledger State
  const initialWorkerId = searchParams.get("worker_id") || "";
  const [selectedLedgerWorkerId, setSelectedLedgerWorkerId] = useState(initialWorkerId);
  const [ledgerSearch, setLedgerSearch] = useState("");

  // Tab 3: Payments Log State
  const [paymentsSearch, setPaymentsSearch] = useState("");

  // -------------------------------------------------------------
  // Data Queries
  // -------------------------------------------------------------
  const { data: workersData } = useQuery<{ workers: Worker[] }>({
    queryKey: ["workers-list-all"],
    queryFn: async () => {
      const res = await fetch("/api/workers");
      return res.json();
    },
  });
  const workers = workersData?.workers || [];

  const { data: lotsData } = useQuery<{ lots: Lot[] }>({
    queryKey: ["lots-list-all"],
    queryFn: async () => {
      const res = await fetch("/api/production/lots");
      return res.json();
    },
  });
  const lots = lotsData?.lots || [];

  // 1. Entries Query
  const { data: entriesData, isLoading: loadingEntries } = useQuery({
    queryKey: [
      "job-work-entries-list",
      entriesWorkerFilter,
      entriesStageFilter,
      entriesLotFilter,
      entriesStatusFilter,
      debouncedEntriesSearch,
      entriesStartDate,
      entriesEndDate,
    ],
    queryFn: async () => {
      const wParam = entriesWorkerFilter !== "all" ? `&worker_id=${entriesWorkerFilter}` : "";
      const sParam = entriesStageFilter !== "all" ? `&stage_id=${entriesStageFilter}` : "";
      const lParam = entriesLotFilter !== "all" ? `&lot_id=${entriesLotFilter}` : "";
      const stParam = entriesStatusFilter !== "all" ? `&payment_status=${entriesStatusFilter}` : "";
      const searchParam = debouncedEntriesSearch ? `&search=${encodeURIComponent(debouncedEntriesSearch)}` : "";
      const sdParam = entriesStartDate ? `&startDate=${entriesStartDate}` : "";
      const edParam = entriesEndDate ? `&endDate=${entriesEndDate}` : "";

      const res = await fetch(
        `/api/production/stage-entries?limit=500${wParam}${sParam}${lParam}${stParam}${searchParam}${sdParam}${edParam}`
      );
      return res.json();
    },
  });
  const jobWorkEntries: JobWorkEntry[] = entriesData?.entries || [];

  // 2. Selected Worker Ledger Query
  const { data: selectedLedgerData, isLoading: loadingLedger } = useQuery({
    queryKey: ["worker-ledger", selectedLedgerWorkerId],
    queryFn: async () => {
      if (!selectedLedgerWorkerId) return null;
      const res = await fetch(`/api/production/job-work/ledger/${selectedLedgerWorkerId}`);
      if (!res.ok) throw new Error("Failed to fetch worker ledger");
      return res.json();
    },
    enabled: !!selectedLedgerWorkerId,
  });

  const selectedWorkerInfo = selectedLedgerData?.worker || null;
  const workerLedgerRows: LedgerRow[] = selectedLedgerData?.ledger || [];
  const workerStats = selectedLedgerData?.stats || {
    totalJobWorkAmount: 0,
    totalPaidAmount: 0,
    currentOutstanding: 0,
    totalEntries: 0,
  };

  // 3. Payments Query
  const { data: paymentsData, isLoading: loadingPayments } = useQuery({
    queryKey: ["job-work-payments-list"],
    queryFn: async () => {
      const res = await fetch("/api/production/job-work/payments");
      return res.json();
    },
  });
  const paymentsList: JobWorkPayment[] = paymentsData?.payments || [];

  // Financial Stats Calculation across entries
  const globalStats = useMemo(() => {
    let totalBilled = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    jobWorkEntries.forEach((e) => {
      const amt = Number(e.total_job_work_amount || 0);
      const paid = Number(e.paid_amount || 0);
      totalBilled += amt;
      totalPaid += paid;
      totalOutstanding += Math.max(0, amt - paid);
    });

    return { totalBilled, totalPaid, totalOutstanding };
  }, [jobWorkEntries]);

  // Set default selected ledger worker if none selected
  useEffect(() => {
    if (!selectedLedgerWorkerId && workers.length > 0) {
      setSelectedLedgerWorkerId(workers[0].id);
    }
  }, [workers, selectedLedgerWorkerId]);

  // Open modal pre-selected for worker
  const handleOpenPaymentModal = (workerIdToPay?: string) => {
    if (workerIdToPay) {
      setModalWorkerId(workerIdToPay);
    }
    setIsPaymentModalOpen(true);
  };

  // -------------------------------------------------------------
  // Record Payment Modal Logic (Multi-entry adjustment)
  // -------------------------------------------------------------
  const [modalWorkerId, setModalWorkerId] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().substring(0, 10));
  const [paymentMode, setPaymentMode] = useState("bank_transfer");
  const [referenceNo, setReferenceNo] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [upiId, setUpiId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [totalPaidAmountInput, setTotalPaidAmountInput] = useState(0);
  const [unpaidEntries, setUnpaidEntries] = useState<UnpaidEntry[]>([]);
  const [loadingUnpaidEntries, setLoadingUnpaidEntries] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Bank & UPI accounts query
  const { data: accountsData } = useQuery({
    queryKey: ["banks-upi-list-modal"],
    queryFn: async () => {
      const res = await fetch("/api/master-data/banks-upi");
      return res.json();
    },
  });
  const bankAccounts = accountsData?.accounts || [];
  const bankOptions = bankAccounts.filter((b: any) => b.type === "bank");
  const upiOptions = bankAccounts.filter((b: any) => b.type === "upi");

  // Fetch unpaid entries when modalWorkerId changes
  useEffect(() => {
    if (!modalWorkerId) {
      setUnpaidEntries([]);
      return;
    }

    async function fetchUnpaid() {
      setLoadingUnpaidEntries(true);
      try {
        const res = await fetch(`/api/production/stage-entries?worker_id=${modalWorkerId}&limit=500`);
        const data = await res.json();
        const entriesList: JobWorkEntry[] = data.entries || [];

        // Filter for unpaid or partial entries with positive total_job_work_amount
        const filtered = entriesList.filter(
          (e) => e.payment_status !== "paid" && Number(e.total_job_work_amount || 0) > 0
        );

        const mapped: UnpaidEntry[] = filtered.map((e) => {
          const tot = Number(e.total_job_work_amount || 0);
          const pd = Number(e.paid_amount || 0);
          const out = Math.max(0, tot - pd);
          return {
            id: e.id,
            entry_number: e.entry_number,
            entry_date: e.entry_date,
            lot_number: e.lot?.lot_number || "—",
            stage_name: e.stage?.stage_name || "—",
            total_amount: tot,
            paid_amount: pd,
            outstanding: out,
            amount_to_apply: out, // default to full outstanding
            selected: true,
          };
        });

        setUnpaidEntries(mapped);

        // Auto-calculate sum of selected amounts
        const sumOut = mapped.reduce((acc, curr) => acc + curr.outstanding, 0);
        setTotalPaidAmountInput(sumOut);
      } catch (err) {
        console.error("Failed to fetch unpaid entries:", err);
      } finally {
        setLoadingUnpaidEntries(false);
      }
    }

    fetchUnpaid();
  }, [modalWorkerId]);

  // Recalculate total amount when individual entries amount_to_apply or selected changes
  const handleToggleEntrySelect = (id: string) => {
    setUnpaidEntries((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextSelected = !item.selected;
          return {
            ...item,
            selected: nextSelected,
            amount_to_apply: nextSelected ? item.outstanding : 0,
          };
        }
        return item;
      })
    );
  };

  const handleEntryAmountChange = (id: string, val: number) => {
    setUnpaidEntries((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const safeVal = Math.min(item.outstanding, Math.max(0, val));
          return {
            ...item,
            amount_to_apply: safeVal,
            selected: safeVal > 0,
          };
        }
        return item;
      })
    );
  };

  // Re-sum total paid amount input based on selected entries
  useEffect(() => {
    const sum = unpaidEntries
      .filter((e) => e.selected)
      .reduce((acc, curr) => acc + (curr.amount_to_apply || 0), 0);
    setTotalPaidAmountInput(sum);
  }, [unpaidEntries]);

  // Auto-distribute total payment amount across selected entries
  const handleAutoDistributeAmount = (newTotal: number) => {
    setTotalPaidAmountInput(newTotal);
    let remaining = newTotal;

    setUnpaidEntries((prev) =>
      prev.map((item) => {
        if (remaining <= 0) {
          return { ...item, amount_to_apply: 0, selected: false };
        }
        const applied = Math.min(item.outstanding, remaining);
        remaining -= applied;
        return {
          ...item,
          amount_to_apply: applied,
          selected: applied > 0,
        };
      })
    );
  };

  const handleBankSelect = (id: string) => {
    setBankAccountId(id);
    const selected = bankOptions.find((b: any) => b.id === id);
    if (selected) {
      setBankName(selected.bank_name || selected.name);
      setAccountName(selected.account_number ? `A/C ...${selected.account_number.slice(-4)}` : selected.name);
    }
  };

  const handleUpiSelect = (id: string) => {
    setUpiId(id);
    const selected = upiOptions.find((b: any) => b.id === id);
    if (selected) {
      setBankName("UPI Payment");
      setAccountName(selected.name || selected.upi_id || "UPI");
    }
  };

  const handleSubmitPaymentModal = async () => {
    if (!modalWorkerId) {
      toast.error("Please select a worker");
      return;
    }
    if (!paymentDate) {
      toast.error("Please select payment date");
      return;
    }
    if (totalPaidAmountInput <= 0) {
      toast.error("Payment amount must be greater than zero");
      return;
    }

    const selectedEntries = unpaidEntries.filter((e) => e.selected && e.amount_to_apply > 0);
    if (selectedEntries.length === 0) {
      toast.error("Please select at least one stage entry to apply payment against");
      return;
    }

    setSubmittingPayment(true);
    try {
      const payload = {
        worker_id: modalWorkerId,
        payment_date: paymentDate,
        payment_mode: paymentMode,
        reference_no: referenceNo || null,
        paid_amount: totalPaidAmountInput,
        bank_name: bankName || null,
        account_name: accountName || null,
        bank_account_id: bankAccountId || null,
        upi_id: upiId || null,
        remarks: remarks || null,
        entries: selectedEntries.map((e) => ({
          stage_entry_id: e.id,
          amount_to_apply: e.amount_to_apply,
        })),
      };

      const res = await fetch("/api/production/job-work/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to record payment");

      toast.success("Job Work payment recorded successfully!");
      setIsPaymentModalOpen(false);

      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ["job-work-entries-list"] });
      queryClient.invalidateQueries({ queryKey: ["worker-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["job-work-payments-list"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment");
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Helper currency formatter
  function formatCurrency(val: number) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val || 0);
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E7EB] pb-4">
        <div>
          <nav className="flex items-center gap-2 text-xs font-semibold text-[#64748B] mb-1 select-none">
            <Link href="/" className="hover:text-[#6366F1] transition-colors">
              Dashboard
            </Link>
            <ChevronRight size={12} className="text-[#94A3B8]" />
            <span className="text-[#374151]">Production</span>
            <ChevronRight size={12} className="text-[#94A3B8]" />
            <span className="text-[#0F172A] font-bold">Job Work</span>
          </nav>
          <h1 className="text-xl font-extrabold text-[#0F172A] flex items-center gap-2">
            <Factory className="text-[#6366F1]" size={24} />
            <span>Job Work Workspace</span>
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Log job work output, manage worker ledgers, and release multi-entry payout adjustments.
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-3">
          <Link
            href="/production/stage-entries/new"
            className="h-10 px-5 rounded-xl bg-[#5B63D3] hover:bg-[#4F55C3] text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-indigo-100/50 transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={16} />
            <span>+ Add Stage Entry</span>
          </Link>

          <Link
            href="/production/job-work/record-payment"
            className="h-10 px-5 rounded-xl bg-[#5B63D3] hover:bg-[#4F55C3] text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-indigo-100/50 transition-all active:scale-95 cursor-pointer"
          >
            <CreditCard size={16} />
            <span>Record Job Work Payment</span>
          </Link>
        </div>
      </div>

      {/* ── MOBILE: snap-scroll KPI cards ── */}
      <div className="md:hidden flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 scrollbar-none">
        {[
          { label: "Total Billed",    value: formatCurrency(globalStats.totalBilled),       icon: ClipboardList, bg: "bg-[var(--primary-light)]",  color: "text-[var(--primary)]" },
          { label: "Total Payouts",   value: formatCurrency(globalStats.totalPaid),          icon: CheckCircle,   bg: "bg-emerald-500/10",           color: "text-emerald-600" },
          { label: "Outstanding",     value: formatCurrency(globalStats.totalOutstanding),   icon: IndianRupee,   bg: "bg-rose-500/10",              color: "text-rose-600" },
          { label: "Active Workers",  value: `${workers.length}`,                            icon: User,          bg: "bg-blue-500/10",              color: "text-blue-600" },
        ].map(({ label, value, icon: Icon, bg, color }) => (
          <div key={label} className="snap-start shrink-0 w-[152px] bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3 shadow-[var(--shadow-sm)] flex items-center gap-2.5">
            <div className={cn("p-2 rounded-lg shrink-0", bg)}><Icon className={cn("h-4 w-4", color)} /></div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider truncate">{label}</p>
              <p className={cn("text-xs font-black mt-0.5 truncate", color)}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── DESKTOP: existing 4-col KPI grid ── */}
      <div className="hidden md:grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Total Job Work Billed</p>
            <h3 className="text-lg font-extrabold text-[var(--text-primary)] mt-1">{formatCurrency(globalStats.totalBilled)}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center font-bold"><ClipboardList size={20} /></div>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Total Payouts Released</p>
            <h3 className="text-lg font-extrabold text-emerald-600 mt-1">{formatCurrency(globalStats.totalPaid)}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold"><CheckCircle size={20} /></div>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Net Outstanding Payable</p>
            <h3 className="text-lg font-extrabold text-rose-600 mt-1">{formatCurrency(globalStats.totalOutstanding)}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold"><IndianRupee size={20} /></div>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Active Workers</p>
            <h3 className="text-lg font-extrabold text-[var(--text-primary)] mt-1">{workers.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold"><User size={20} /></div>
        </div>
      </div>

      {/* Tabs Container Header */}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
        <div className="flex items-center border-b border-[var(--border)] bg-[var(--table-header-bg)] px-4 pt-3 gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab("entries")}
            className={`px-4 py-2.5 rounded-t-lg text-xs font-bold transition-all flex items-center gap-2 border-b-2 ${
              activeTab === "entries"
                ? "bg-white text-[#6366F1] border-[#6366F1] shadow-2xs"
                : "text-[#64748B] hover:text-[#0F172A] border-transparent"
            }`}
          >
            <ClipboardList size={15} />
            <span>Job Work Entries Log</span>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-indigo-50 text-[#6366F1] text-[10px] font-extrabold">
              {jobWorkEntries.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("ledger")}
            className={`px-4 py-2.5 rounded-t-lg text-xs font-bold transition-all flex items-center gap-2 border-b-2 ${
              activeTab === "ledger"
                ? "bg-white text-[#6366F1] border-[#6366F1] shadow-2xs"
                : "text-[#64748B] hover:text-[#0F172A] border-transparent"
            }`}
          >
            <BookOpen size={15} />
            <span>Worker Ledgers</span>
          </button>

          <button
            onClick={() => setActiveTab("payments")}
            className={`px-4 py-2.5 rounded-t-lg text-xs font-bold transition-all flex items-center gap-2 border-b-2 ${
              activeTab === "payments"
                ? "bg-white text-[#6366F1] border-[#6366F1] shadow-2xs"
                : "text-[#64748B] hover:text-[#0F172A] border-transparent"
            }`}
          >
            <CreditCard size={15} />
            <span>Payment Log History</span>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-extrabold">
              {paymentsList.length}
            </span>
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: JOB WORK ENTRIES LOG */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "entries" && (
          <div className="p-5 space-y-4">
            {/* Filters Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 bg-slate-50/70 p-3 rounded-xl border border-[#E5E7EB]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" size={14} />
                <input
                  type="text"
                  placeholder="Search Entry #, Lot #..."
                  value={entriesSearch}
                  onChange={(e) => setEntriesSearch(e.target.value)}
                  className="w-full pl-8 pr-3 h-9 bg-white border border-[#CBD5E1] rounded-lg text-xs font-medium outline-none focus:ring-1 focus:ring-[#6366F1]"
                />
              </div>

              <select
                value={entriesWorkerFilter}
                onChange={(e) => setEntriesWorkerFilter(e.target.value)}
                className="h-9 bg-white border border-[#CBD5E1] rounded-lg px-3 text-xs font-medium outline-none"
              >
                <option value="all">All Workers</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.worker_id})
                  </option>
                ))}
              </select>

              <select
                value={entriesLotFilter}
                onChange={(e) => setEntriesLotFilter(e.target.value)}
                className="h-9 bg-white border border-[#CBD5E1] rounded-lg px-3 text-xs font-medium outline-none"
              >
                <option value="all">All Lots</option>
                {lots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.lot_number}
                  </option>
                ))}
              </select>

              <select
                value={entriesStatusFilter}
                onChange={(e) => setEntriesStatusFilter(e.target.value)}
                className="h-9 bg-white border border-[#CBD5E1] rounded-lg px-3 text-xs font-medium outline-none"
              >
                <option value="all">All Payment Statuses</option>
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={entriesStartDate}
                  onChange={(e) => setEntriesStartDate(e.target.value)}
                  className="w-1/2 h-9 bg-white border border-[#CBD5E1] rounded-lg px-2 text-xs font-medium outline-none"
                />
                <input
                  type="date"
                  value={entriesEndDate}
                  onChange={(e) => setEntriesEndDate(e.target.value)}
                  className="w-1/2 h-9 bg-white border border-[#CBD5E1] rounded-lg px-2 text-xs font-medium outline-none"
                />
              </div>
            </div>

            {/* Entries Table */}
            {loadingEntries ? (
              <div className="py-16 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1] mx-auto" />
                <p className="text-xs text-slate-500 mt-2 font-medium">Loading entries...</p>
              </div>
            ) : jobWorkEntries.length === 0 ? (
              <div className="py-16 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <ClipboardList className="mx-auto text-slate-300 h-10 w-10 mb-2" />
                <p className="text-sm font-bold text-slate-700">No Job Work Entries Found</p>
                <p className="text-xs text-slate-500 mt-0.5">Log stage entries or adjust filter criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-[#E5E7EB] text-[#475569] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Entry #</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Lot No</th>
                      <th className="py-3 px-4">Stage</th>
                      <th className="py-3 px-4">Worker</th>
                      <th className="py-3 px-4 text-right">Processed Qty</th>
                      <th className="py-3 px-4 text-right">Rate</th>
                      <th className="py-3 px-4 text-right">Total Amount</th>
                      <th className="py-3 px-4 text-right">Paid Amount</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Due Counter</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] font-medium text-[#0F172A]">
                    {jobWorkEntries.map((e) => {
                      const tot = Number(e.total_job_work_amount || 0);
                      const pd = Number(e.paid_amount || 0);
                      const isPaid = e.payment_status === "paid";
                      const isPartial = e.payment_status === "partial";

                      return (
                        <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-bold text-[#6366F1]">{e.entry_number}</td>
                          <td className="py-3 px-4 text-[#64748B]">{e.entry_date}</td>
                          <td className="py-3 px-4 font-semibold">{e.lot?.lot_number || "—"}</td>
                          <td className="py-3 px-4">{e.stage?.stage_name || "—"}</td>
                          <td className="py-3 px-4 font-semibold text-slate-800">
                            {e.worker?.name || "—"}
                            {e.worker?.worker_id ? (
                              <span className="text-[10px] text-slate-400 font-mono block">
                                {e.worker.worker_id}
                              </span>
                            ) : null}
                          </td>
                          <td className="py-3 px-4 text-right font-bold">{e.qty_out?.toLocaleString("en-IN")} Pcs</td>
                          <td className="py-3 px-4 text-right">₹{Number(e.job_work_rate || 0).toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-extrabold">{formatCurrency(tot)}</td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-600">{formatCurrency(pd)}</td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                isPaid
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : isPartial
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-rose-50 text-rose-700 border border-rose-200"
                              }`}
                            >
                              {e.payment_status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <DueDateBadge
                              dueDate={e.due_date}
                              isCompleted={isPaid}
                              type="job_work"
                            />
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* 1. View Entry Detail (Eye Icon) */}
                              <button
                                onClick={() => setDetailModalEntry(e)}
                                title="View Stage Entry Detail"
                                className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                              >
                                <Eye size={16} />
                              </button>

                              {/* 2. View Worker Ledger (User Icon) */}
                              {e.worker?.id && (
                                <button
                                  onClick={() => {
                                    setSelectedLedgerWorkerId(e.worker!.id);
                                    setActiveTab("ledger");
                                  }}
                                  title="View Worker Ledger"
                                  className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 transition-colors"
                                >
                                  <User size={16} />
                                </button>
                              )}

                              {/* 3. Record Payment (Credit Card Icon) */}
                              {e.worker?.id && !isPaid && (
                                <Link
                                  href={`/production/job-work/record-payment?worker_id=${e.worker.id}`}
                                  title="Record Payment for Worker"
                                  className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                                >
                                  <CreditCard size={16} />
                                </Link>
                              )}

                              {/* 4. Edit Entry (Pencil Icon) */}
                              <Link
                                href={`/production/stage-entries/${e.id}/edit`}
                                title="Edit Stage Entry"
                                className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 transition-colors"
                              >
                                <Edit size={16} />
                              </Link>

                              {/* 5. Delete Entry (Trash Icon) */}
                              <button
                                onClick={() => setDeleteConfirmEntry(e)}
                                title="Delete Stage Entry"
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: WORKER LEDGERS STATEMENT VIEW */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "ledger" && (
          <div className="p-5 grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Column: Worker Selector List */}
            <div className="lg:col-span-1 border-r border-[#E5E7EB] pr-4 space-y-3">
              <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Select Worker</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" size={14} />
                <input
                  type="text"
                  placeholder="Search worker..."
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  className="w-full pl-8 pr-3 h-8 bg-slate-50 border border-[#CBD5E1] rounded-lg text-xs font-medium outline-none"
                />
              </div>

              <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
                {workers
                  .filter((w) => w.name.toLowerCase().includes(ledgerSearch.toLowerCase()) || w.worker_id.toLowerCase().includes(ledgerSearch.toLowerCase()))
                  .map((w) => {
                    const isSelected = w.id === selectedLedgerWorkerId;
                    return (
                      <button
                        key={w.id}
                        onClick={() => setSelectedLedgerWorkerId(w.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                          isSelected
                            ? "bg-indigo-50/80 border-[#6366F1] shadow-2xs"
                            : "bg-white border-[#E5E7EB] hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <WorkerAvatar name={w.name} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs font-bold truncate ${isSelected ? "text-[#6366F1]" : "text-[#0F172A]"}`}>
                              {w.name}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono truncate">{w.worker_id}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Right Column: Running Statement View */}
            <div className="lg:col-span-3 space-y-4">
              {loadingLedger ? (
                <div className="py-20 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1] mx-auto" />
                  <p className="text-xs text-slate-500 mt-2 font-medium">Loading worker statement...</p>
                </div>
              ) : selectedWorkerInfo ? (
                <>
                  {/* Worker Statement Header */}
                  <div className="bg-slate-50 border border-[#E5E7EB] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <WorkerAvatar name={selectedWorkerInfo.name} size="md" />
                      <div>
                        <h2 className="text-base font-extrabold text-[#0F172A]">{selectedWorkerInfo.name}</h2>
                        <div className="flex items-center gap-3 text-xs text-[#64748B] mt-0.5">
                          <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                            {selectedWorkerInfo.worker_id}
                          </span>
                          {selectedWorkerInfo.phone && <span>📞 {selectedWorkerInfo.phone}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-4">
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Total Billed</p>
                        <p className="text-xs font-extrabold text-slate-800">{formatCurrency(workerStats.totalJobWorkAmount)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Total Paid</p>
                        <p className="text-xs font-extrabold text-emerald-600">{formatCurrency(workerStats.totalPaidAmount)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Net Balance Due</p>
                        <p className="text-sm font-extrabold text-rose-600">{formatCurrency(workerStats.currentOutstanding)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Running Ledger Statement Table */}
                  {workerLedgerRows.length === 0 ? (
                    <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <p className="text-xs font-semibold text-slate-600">No ledger transactions recorded for this worker.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-[#E5E7EB] text-[#475569] font-bold uppercase tracking-wider">
                          <tr>
                            <th className="py-3 px-4">Date</th>
                            <th className="py-3 px-4">Ref / Entry #</th>
                            <th className="py-3 px-4">Lot / Stage</th>
                            <th className="py-3 px-4">Type</th>
                            <th className="py-3 px-4 text-right">Debit (Billed)</th>
                            <th className="py-3 px-4 text-right">Credit (Paid)</th>
                            <th className="py-3 px-4 text-right">Running Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5E7EB] font-medium text-[#0F172A]">
                          {workerLedgerRows.map((row) => {
                            const isEntry = row.entry_type === "stage_entry";
                            return (
                              <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-3 px-4 text-[#64748B]">{row.date}</td>
                                <td className="py-3 px-4 font-bold text-[#6366F1]">{row.ref_no}</td>
                                <td className="py-3 px-4">
                                  {row.lot_number ? `${row.lot_number} - ${row.stage_name}` : row.stage_name || "—"}
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      isEntry ? "bg-slate-100 text-slate-800" : "bg-emerald-50 text-emerald-700"
                                    }`}
                                  >
                                    {isEntry ? "Job Work Output" : "Payment Released"}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right font-bold">
                                  {isEntry ? formatCurrency(row.amount) : "—"}
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-emerald-600">
                                  {!isEntry ? formatCurrency(row.amount) : "—"}
                                </td>
                                <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                                  {formatCurrency(row.balance)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-20 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-500">Select a worker from the list on the left to view statement.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: PAYMENT HISTORY LOG */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "payments" && (
          <div className="p-5 space-y-4">
            {loadingPayments ? (
              <div className="py-16 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1] mx-auto" />
                <p className="text-xs text-slate-500 mt-2 font-medium">Loading payments history...</p>
              </div>
            ) : paymentsList.length === 0 ? (
              <div className="py-16 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <CreditCard className="mx-auto text-slate-300 h-10 w-10 mb-2" />
                <p className="text-sm font-bold text-slate-700">No Job Work Payments Recorded</p>
                <p className="text-xs text-slate-500 mt-0.5">Click &quot;+ Record Job Work Payment&quot; to record a payment.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-[#E5E7EB] text-[#475569] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Payment #</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Worker</th>
                      <th className="py-3 px-4">Payment Mode</th>
                      <th className="py-3 px-4">Ref # / Account</th>
                      <th className="py-3 px-4 text-right">Amount Paid</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] font-medium text-[#0F172A]">
                    {paymentsList.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-bold text-[#6366F1]">{p.payment_number}</td>
                        <td className="py-3 px-4 text-[#64748B]">{p.payment_date}</td>
                        <td className="py-3 px-4 font-bold">{p.worker?.name || "—"}</td>
                        <td className="py-3 px-4 capitalize font-semibold">{p.payment_mode.replace("_", " ")}</td>
                        <td className="py-3 px-4 text-slate-500 font-mono">
                          {p.reference_no || p.account_name || "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-emerald-600">
                          {formatCurrency(Number(p.paid_amount || 0))}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {p.status || "success"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* STAGE ENTRY QUICK DETAILS MODAL */}
      {/* ------------------------------------------------------------- */}
      {detailModalEntry && (
        <Dialog open={!!detailModalEntry} onOpenChange={() => setDetailModalEntry(null)}>
          <DialogContent className="max-w-xl bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-5 shadow-2xl">
            <DialogHeader className="border-b border-[#E5E7EB] pb-3 flex flex-row items-center justify-between">
              <DialogTitle className="text-base font-extrabold text-[#0F172A] flex items-center gap-2">
                <ClipboardList className="text-[#6366F1]" size={20} />
                <span>Stage Entry Details: {detailModalEntry.entry_number}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Entry Date</span>
                  <span className="font-bold text-slate-900">{detailModalEntry.entry_date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Payment Status</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase mt-0.5 ${
                      detailModalEntry.payment_status === "paid"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : detailModalEntry.payment_status === "partial"
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-rose-50 text-rose-700 border border-rose-200"
                    }`}
                  >
                    {detailModalEntry.payment_status}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Production Lot #</span>
                  <span className="font-extrabold text-[#6366F1]">{detailModalEntry.lot?.lot_number || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Production Stage</span>
                  <span className="font-bold text-slate-800">{detailModalEntry.stage?.stage_name || "—"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border border-slate-200 bg-white">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Assigned Worker</span>
                  <span className="font-bold text-slate-900">{detailModalEntry.worker?.name || "—"}</span>
                  {detailModalEntry.worker?.worker_id && (
                    <span className="text-[10px] text-slate-400 font-mono block">{detailModalEntry.worker.worker_id}</span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Processed Quantity</span>
                  <span className="font-extrabold text-slate-900 text-sm">{detailModalEntry.qty_out?.toLocaleString("en-IN")} Pcs</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Piece Rate (₹)</span>
                  <span className="font-bold text-slate-800">₹{Number(detailModalEntry.job_work_rate || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Total Job Amount</span>
                  <span className="font-extrabold text-slate-900 text-sm">{formatCurrency(Number(detailModalEntry.total_job_work_amount || 0))}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Paid Amount</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(Number(detailModalEntry.paid_amount || 0))}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Outstanding Balance</span>
                  <span className="font-bold text-rose-600">
                    {formatCurrency(Math.max(0, Number(detailModalEntry.total_job_work_amount || 0) - Number(detailModalEntry.paid_amount || 0)))}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#E5E7EB]">
              <Link
                href={`/production/stage-entries/${detailModalEntry.id}`}
                className="text-xs font-bold text-[#6366F1] hover:underline flex items-center gap-1"
              >
                <span>Open Full Entry Page & Timeline</span>
                <ChevronRight size={14} />
              </Link>

              <button
                onClick={() => setDetailModalEntry(null)}
                className="h-9 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ------------------------------------------------------------- */}
      {/* STAGE ENTRY DELETE CONFIRMATION DIALOG */}
      {/* ------------------------------------------------------------- */}
      {deleteConfirmEntry && (
        <Dialog open={!!deleteConfirmEntry} onOpenChange={() => setDeleteConfirmEntry(null)}>
          <DialogContent className="max-w-md bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-extrabold text-rose-600 flex items-center gap-2">
                <Trash2 size={20} />
                <span>Delete Stage Entry</span>
              </DialogTitle>
            </DialogHeader>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Are you sure you want to delete stage entry <strong className="text-slate-900">{deleteConfirmEntry.entry_number}</strong>?
              This action cannot be undone and will update lot balance calculations.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5E7EB]">
              <button
                onClick={() => setDeleteConfirmEntry(null)}
                className="h-9 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                onClick={handleDeleteEntry}
                disabled={deletingEntry}
                className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
              >
                {deletingEntry ? "Deleting..." : "Delete Entry"}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
