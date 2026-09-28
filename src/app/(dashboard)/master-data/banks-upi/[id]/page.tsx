"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Building2,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  Layers,
  History,
  Clock,
  QrCode,
  CreditCard,
  Wallet,
  Search,
  Copy,
  Check,
  Filter,
  ShieldCheck,
  Star,
  MapPin,
  Calendar,
  Sparkles,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import PageState from "@/components/shared/PageState";
import { toast } from "sonner";

interface Transaction {
  id: string;
  type: "inflow" | "outflow";
  ref_no: string;
  date: string;
  amount: number;
  mode: string;
  details: string;
  partyName: string;
}

interface BankAccount {
  id: string;
  type: "bank" | "upi" | "cash";
  name: string;
  account_category?: "pakka" | "kacha" | "both";
  sub_label: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc: string | null;
  branch: string | null;
  upi_id: string | null;
  upi_provider: string | null;
  is_default: boolean;
  opening_balance: number;
  is_active: boolean;
}

interface BankAccountDetailResponse {
  account: BankAccount;
  transactions: Transaction[];
}

export default function BankAccountDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"transactions" | "credentials">("transactions");

  // Search & Filters for transactions
  const [txSearch, setTxSearch] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState<"all" | "inflow" | "outflow">("all");
  const [txPage, setTxPage] = useState(1);
  const pageSize = 15;

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`Copied ${fieldName} to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const { data: detailData, isLoading, error, refetch } = useQuery<BankAccountDetailResponse>({
    queryKey: ["bank-account-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/banks-upi/${id}`);
      if (!res.ok) throw new Error("Failed to fetch account details");
      return res.json();
    },
    staleTime: 30_000,
  });

  const account = detailData?.account;
  const transactions = useMemo(() => detailData?.transactions || [], [detailData?.transactions]);

  // Compute rollups
  const totalTransactions = transactions.length;
  const inflowTransactions = useMemo(
    () => transactions.filter((t) => t.type === "inflow"),
    [transactions]
  );
  const outflowTransactions = useMemo(
    () => transactions.filter((t) => t.type === "outflow"),
    [transactions]
  );

  const totalInflowVal = useMemo(
    () => inflowTransactions.reduce((acc, curr) => acc + Number(curr.amount || 0), 0),
    [inflowTransactions]
  );
  const totalOutflowVal = useMemo(
    () => outflowTransactions.reduce((acc, curr) => acc + Number(curr.amount || 0), 0),
    [outflowTransactions]
  );

  const currentApproxBalance =
    Number(account?.opening_balance || 0) + totalInflowVal - totalOutflowVal;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  // Filter & paginate transactions
  const filteredTransactions = useMemo(() => {
    const q = txSearch.toLowerCase().trim();
    return transactions.filter((t) => {
      const matchesSearch =
        !q ||
        t.ref_no?.toLowerCase().includes(q) ||
        t.partyName?.toLowerCase().includes(q) ||
        t.details?.toLowerCase().includes(q) ||
        t.mode?.toLowerCase().includes(q);

      const matchesType = txTypeFilter === "all" || t.type === txTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [transactions, txSearch, txTypeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const paginatedTransactions = useMemo(() => {
    const start = (txPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, txPage, pageSize]);

  const isBank = account?.type === "bank";
  const isCash = account?.type === "cash";
  const isUpi = account?.type === "upi";
  const category = account?.account_category || (account?.type === "cash" ? "kacha" : "pakka");

  const getModeBadge = (mode: string) => {
    const m = (mode || "").toLowerCase();
    if (m.includes("upi")) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
          UPI
        </span>
      );
    }
    if (m.includes("cheque") || m.includes("pdc")) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          Cheque
        </span>
      );
    }
    if (m.includes("cash")) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          Cash
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
        {mode || "Bank"}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto pb-12">
      {/* Breadcrumbs Navigation */}
      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)] select-none">
        <Link href="/" className="hover:text-[var(--primary)] transition-colors">
          Dashboard
        </Link>
        <ChevronRight size={13} className="text-[var(--text-faint)]" />
        <Link href="/master-data" className="hover:text-[var(--primary)] transition-colors">
          Master Data
        </Link>
        <ChevronRight size={13} className="text-[var(--text-faint)]" />
        <Link href="/master-data/banks-upi" className="hover:text-[var(--primary)] transition-colors">
          Banks & UPI
        </Link>
        <ChevronRight size={13} className="text-[var(--text-faint)]" />
        <span className="text-[var(--text-primary)] font-bold truncate max-w-[200px] sm:max-w-none">
          {account?.name || "Account Profile"}
        </span>
      </div>

      <PageState
        isLoading={isLoading}
        isError={!!error}
        error={error?.message}
        onRetry={refetch}
        isEmpty={!account}
        skeletonVariant="stats"
        skeletonCount={4}
        emptyTitle="Account Not Found"
        emptyDescription="This bank, UPI, or cash account could not be retrieved from the database."
      >
        {account && (
          <div className="space-y-6">
            {/* ── Executive Account Hero Banner ── */}
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-5 sm:p-7 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                {/* Identity & Badges */}
                <div className="flex items-start gap-4 sm:gap-5">
                  <div
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border flex items-center justify-center shrink-0 font-black shadow-sm ${
                      isBank
                        ? "bg-indigo-500/10 border-indigo-500/25 text-indigo-600 dark:text-indigo-400"
                        : isUpi
                        ? "bg-purple-500/10 border-purple-500/25 text-purple-600 dark:text-purple-400"
                        : "bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {isBank ? (
                      <CreditCard size={28} />
                    ) : isUpi ? (
                      <QrCode size={28} />
                    ) : (
                      <Wallet size={28} />
                    )}
                  </div>

                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight truncate">
                        {account.name}
                      </h1>

                      {account.is_default && (
                        <span className="inline-flex items-center gap-1 bg-[var(--primary-light)] text-[var(--primary)] text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-[var(--primary)]/20 uppercase tracking-wide">
                          <Star size={11} className="fill-[var(--primary)]" />
                          Default Account
                        </span>
                      )}

                      {/* Nature Badge */}
                      {category === "pakka" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                          🏷️ Pakka (Tax Compliant)
                        </span>
                      ) : category === "kacha" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          📝 Kaccha (Internal Register)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                          🔄 Both (Universal)
                        </span>
                      )}

                      {/* Active Status Badge with pulse dot */}
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                          account.is_active
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            account.is_active ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                          }`}
                        />
                        {account.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    {/* Metadata Subtitle Row */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--text-muted)] font-medium pt-0.5">
                      {account.sub_label && (
                        <span className="font-semibold text-[var(--text-secondary)]">
                          {account.sub_label}
                        </span>
                      )}
                      {isBank && account.bank_name && (
                        <span className="flex items-center gap-1">
                          <Building2 size={13} className="text-[var(--text-faint)]" />
                          <span>Bank: <strong className="text-[var(--text-primary)]">{account.bank_name}</strong></span>
                        </span>
                      )}
                      {isBank && account.branch && (
                        <span className="flex items-center gap-1">
                          <MapPin size={13} className="text-[var(--text-faint)]" />
                          <span>Branch: {account.branch}</span>
                        </span>
                      )}
                      {isBank && account.account_number && (
                        <span className="font-mono text-[var(--text-secondary)] bg-[var(--page-bg)] px-2 py-0.5 rounded border border-[var(--border)]">
                          A/C: •••• {account.account_number.slice(-4)}
                        </span>
                      )}
                      {isUpi && account.upi_id && (
                        <span className="font-mono text-[var(--primary)] font-bold bg-[var(--primary-light)] px-2 py-0.5 rounded border border-[var(--primary)]/20">
                          {account.upi_id}
                        </span>
                      )}
                      {isCash && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                          <Wallet size={13} /> Physical Cash Register Drawer
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Back to List Action Button */}
                <div className="flex items-center gap-3 self-start lg:self-center shrink-0">
                  <button
                    onClick={() => router.push(`/master-data/banks-upi`)}
                    className="h-10 px-4 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-[var(--text-body)] text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <ArrowLeft size={14} />
                    <span>Back to Accounts</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ── 4 KPI Financial Metric Cards (Generous Spacing & High Visual Hierarchy) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {/* Card 1: Current Book Balance (Hero Standout) */}
              <div className="bg-[var(--card-bg)] border-2 border-[var(--primary)]/30 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between gap-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                    Current Book Balance
                  </span>
                  <div className="p-2.5 rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
                    <DollarSign size={20} />
                  </div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-[var(--text-primary)]">
                    {formatCurrency(currentApproxBalance)}
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1 font-medium">
                    Live balance across all posted ledger entries
                  </p>
                </div>
              </div>

              {/* Card 2: Opening Balance */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                    Opening Balance
                  </span>
                  <div className="p-2.5 rounded-xl bg-[var(--table-header-bg)] text-[var(--text-muted)]">
                    <Layers size={20} />
                  </div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-[var(--text-secondary)]">
                    {formatCurrency(account.opening_balance)}
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1 font-medium">
                    Initial fiscal period balance
                  </p>
                </div>
              </div>

              {/* Card 3: Total Inflows */}
              <div className="bg-[var(--card-bg)] border border-emerald-500/25 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between gap-3 bg-emerald-500/[0.02]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Total Inflows (Credits)
                  </span>
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <ArrowUpRight size={20} />
                  </div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
                    +{formatCurrency(totalInflowVal)}
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1 font-medium">
                    {inflowTransactions.length} receipt / credit vouchers
                  </p>
                </div>
              </div>

              {/* Card 4: Total Outflows */}
              <div className="bg-[var(--card-bg)] border border-rose-500/25 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between gap-3 bg-rose-500/[0.02]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                    Total Outflows (Debits)
                  </span>
                  <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <ArrowDownLeft size={20} />
                  </div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-rose-600 dark:text-rose-400">
                    -{formatCurrency(totalOutflowVal)}
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1 font-medium">
                    {outflowTransactions.length} payment / debit vouchers
                  </p>
                </div>
              </div>
            </div>

            {/* ── Polished Segmented Subtabs Bar ── */}
            <div className="flex items-center gap-2 p-1.5 bg-[var(--table-header-bg)] border border-[var(--border)] rounded-2xl w-fit overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab("transactions")}
                className={`px-4 py-2 text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center gap-2 ${
                  activeTab === "transactions"
                    ? "bg-[var(--card-bg)] text-[var(--primary)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                <History size={15} />
                <span>Transaction History</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--input-bg)] text-[var(--text-secondary)] border border-[var(--border)]">
                  {totalTransactions}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("credentials")}
                className={`px-4 py-2 text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center gap-2 ${
                  activeTab === "credentials"
                    ? "bg-[var(--card-bg)] text-[var(--primary)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                <CreditCard size={15} />
                <span>Account Credentials & Setup</span>
              </button>
            </div>

            {/* ── TAB 1: TRANSACTION HISTORY ── */}
            {activeTab === "transactions" && (
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm p-5 sm:p-7 space-y-5">
                {/* Search & Filter Controls */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-faint)]" />
                    <input
                      type="text"
                      value={txSearch}
                      onChange={(e) => {
                        setTxSearch(e.target.value);
                        setTxPage(1);
                      }}
                      placeholder="Search voucher ref, party name, mode, or notes..."
                      className="w-full h-11 pl-10 pr-4 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-colors"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 p-1 bg-[var(--table-header-bg)] border border-[var(--border)] rounded-xl self-start md:self-auto">
                    <button
                      onClick={() => {
                        setTxTypeFilter("all");
                        setTxPage(1);
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                        txTypeFilter === "all"
                          ? "bg-[var(--card-bg)] text-[var(--text-primary)] shadow-xs"
                          : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      All Transactions ({totalTransactions})
                    </button>
                    <button
                      onClick={() => {
                        setTxTypeFilter("inflow");
                        setTxPage(1);
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 ${
                        txTypeFilter === "inflow"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black shadow-xs"
                          : "text-[var(--text-muted)] hover:text-emerald-600"
                      }`}
                    >
                      <ArrowUpRight size={13} />
                      <span>Inflows ({inflowTransactions.length})</span>
                    </button>
                    <button
                      onClick={() => {
                        setTxTypeFilter("outflow");
                        setTxPage(1);
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 ${
                        txTypeFilter === "outflow"
                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 font-black shadow-xs"
                          : "text-[var(--text-muted)] hover:text-rose-600"
                      }`}
                    >
                      <ArrowDownLeft size={13} />
                      <span>Outflows ({outflowTransactions.length})</span>
                    </button>
                  </div>
                </div>

                {/* ── MOBILE: Transaction Cards ── */}
                <div className="block md:hidden space-y-3">
                  {paginatedTransactions.length === 0 ? (
                    <div className="py-12 text-center text-xs text-[var(--text-muted)] bg-[var(--page-bg)] rounded-2xl border border-dashed border-[var(--border)]">
                      No transactions recorded or matched for this account.
                    </div>
                  ) : (
                    paginatedTransactions.map((t) => {
                      const isInflow = t.type === "inflow";
                      return (
                        <div
                          key={t.id}
                          className="bg-[var(--page-bg)] border border-[var(--border)] rounded-2xl p-4 space-y-2.5 shadow-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                              {t.ref_no}
                            </span>
                            <span
                              className={`text-xs font-black font-mono px-2.5 py-0.5 rounded-full ${
                                isInflow
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                              }`}
                            >
                              {isInflow ? "+" : "-"}{formatCurrency(t.amount)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-[var(--text-secondary)] truncate">
                              {t.partyName || "Internal / Self Transfer"}
                            </span>
                            <span className="text-[11px] text-[var(--text-muted)] font-mono">
                              {new Date(t.date).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[var(--border-light)] text-[var(--text-muted)]">
                            <span className="truncate pr-2">{t.details || "Ledger posting"}</span>
                            <div>{getModeBadge(t.mode)}</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* ── DESKTOP: Refined Transaction Table (Generous Row Padding & Clear Hierarchy) ── */}
                <div className="hidden md:block overflow-hidden rounded-2xl border border-[var(--border)]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-xs font-extrabold text-[var(--text-muted)] uppercase tracking-wider">
                        <th className="py-4 px-5 w-40">Date</th>
                        <th className="py-4 px-5 w-48">Voucher / Ref #</th>
                        <th className="py-4 px-5">Party Details</th>
                        <th className="py-4 px-5">Description</th>
                        <th className="py-4 px-5 w-32">Payment Mode</th>
                        <th className="py-4 px-5 text-right w-44">Transaction Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] text-xs text-[var(--text-body)]">
                      {paginatedTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-xs text-[var(--text-muted)]">
                            No transactions recorded matching the selected filter criteria.
                          </td>
                        </tr>
                      ) : (
                        paginatedTransactions.map((t) => {
                          const isInflow = t.type === "inflow";
                          return (
                            <tr
                              key={t.id}
                              className="hover:bg-[var(--table-row-hover)] transition-colors group"
                            >
                              <td className="py-4 px-5 font-mono text-[var(--text-secondary)] whitespace-nowrap">
                                {new Date(t.date).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </td>
                              <td className="py-4 px-5">
                                <span className="font-bold font-mono text-[var(--text-primary)] bg-[var(--page-bg)] px-2.5 py-1 rounded-lg border border-[var(--border)] inline-block">
                                  {t.ref_no}
                                </span>
                              </td>
                              <td className="py-4 px-5">
                                <span className="font-bold text-[var(--text-primary)] block">
                                  {t.partyName || "Self / Internal Account Transfer"}
                                </span>
                              </td>
                              <td className="py-4 px-5 text-[var(--text-muted)] max-w-xs truncate">
                                {t.details || "—"}
                              </td>
                              <td className="py-4 px-5 whitespace-nowrap">
                                {getModeBadge(t.mode)}
                              </td>
                              <td
                                className={`py-4 px-5 text-right font-mono font-black text-sm whitespace-nowrap ${
                                  isInflow
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-rose-600 dark:text-rose-400"
                                }`}
                              >
                                {isInflow ? "+" : "-"}{formatCurrency(t.amount)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-3 border-t border-[var(--border)] text-xs">
                    <span className="text-[var(--text-muted)]">
                      Showing Page <strong className="text-[var(--text-primary)]">{txPage}</strong> of{" "}
                      <strong className="text-[var(--text-primary)]">{totalPages}</strong> (
                      {filteredTransactions.length} matching transactions)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                        disabled={txPage === 1}
                        className="px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--page-bg)] text-[var(--text-body)] hover:bg-[var(--table-row-hover)] disabled:opacity-40 cursor-pointer flex items-center gap-1 font-bold transition-all"
                      >
                        <ChevronLeft size={14} />
                        <span>Previous</span>
                      </button>
                      <button
                        onClick={() => setTxPage((p) => Math.min(totalPages, p + 1))}
                        disabled={txPage === totalPages}
                        className="px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--page-bg)] text-[var(--text-body)] hover:bg-[var(--table-row-hover)] disabled:opacity-40 cursor-pointer flex items-center gap-1 font-bold transition-all"
                      >
                        <span>Next</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 2: ACCOUNT CREDENTIALS & BANKING SETUP ── */}
            {activeTab === "credentials" && (
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 shadow-sm space-y-7">
                {isBank ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                          <CreditCard size={18} />
                        </div>
                        <div>
                          <h3 className="text-sm font-extrabold text-[var(--text-primary)] tracking-wide">
                            Official Bank Account Details
                          </h3>
                          <p className="text-xs text-[var(--text-muted)]">
                            Corporate bank coordinates for NEFT, RTGS, IMPS, and Cheque settlements.
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <ShieldCheck size={13} /> Verified Treasury Account
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 text-xs font-semibold">
                      {/* Bank Name */}
                      <div className="p-4 bg-[var(--page-bg)] border border-[var(--border)] rounded-2xl space-y-1.5">
                        <span className="text-[10px] text-[var(--text-muted)] block font-extrabold uppercase tracking-wider">
                          Bank Institution
                        </span>
                        <span className="text-base font-bold text-[var(--text-primary)] block">
                          {account.bank_name || "—"}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          Primary Financial Entity
                        </span>
                      </div>

                      {/* Branch Location */}
                      <div className="p-4 bg-[var(--page-bg)] border border-[var(--border)] rounded-2xl space-y-1.5">
                        <span className="text-[10px] text-[var(--text-muted)] block font-extrabold uppercase tracking-wider">
                          Branch Location
                        </span>
                        <span className="text-base font-bold text-[var(--text-primary)] block">
                          {account.branch || "—"}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          Home Branch Office
                        </span>
                      </div>

                      {/* Account Number */}
                      <div className="p-4 bg-[var(--page-bg)] border border-[var(--border)] rounded-2xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[var(--text-muted)] block font-extrabold uppercase tracking-wider">
                            Account Number
                          </span>
                          {account.account_number && (
                            <button
                              onClick={() => copyToClipboard(account.account_number!, "Account Number")}
                              className="text-[var(--text-muted)] hover:text-[var(--primary)] cursor-pointer p-1 rounded-md hover:bg-[var(--table-row-hover)] transition-colors"
                              title="Copy Account Number"
                            >
                              {copiedField === "Account Number" ? (
                                <Check size={14} className="text-emerald-500" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          )}
                        </div>
                        <span className="text-base font-bold font-mono text-[var(--text-primary)] block tracking-wide">
                          {account.account_number || "—"}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          1-Click Copy enabled
                        </span>
                      </div>

                      {/* IFSC Code */}
                      <div className="p-4 bg-[var(--page-bg)] border border-[var(--border)] rounded-2xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[var(--text-muted)] block font-extrabold uppercase tracking-wider">
                            IFSC Code
                          </span>
                          {account.ifsc && (
                            <button
                              onClick={() => copyToClipboard(account.ifsc!, "IFSC Code")}
                              className="text-[var(--text-muted)] hover:text-[var(--primary)] cursor-pointer p-1 rounded-md hover:bg-[var(--table-row-hover)] transition-colors"
                              title="Copy IFSC Code"
                            >
                              {copiedField === "IFSC Code" ? (
                                <Check size={14} className="text-emerald-500" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          )}
                        </div>
                        <span className="text-base font-bold font-mono text-[var(--text-primary)] block tracking-wide">
                          {account.ifsc || "—"}
                        </span>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                          RTGS / NEFT / IMPS Enabled
                        </span>
                      </div>
                    </div>

                    <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl text-xs text-indigo-950 dark:text-indigo-200 flex items-start gap-3">
                      <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold">Real-time Bank Integration & Voucher Allocation</p>
                        <p className="text-[11px] opacity-80 leading-relaxed">
                          Transactions linked to this bank account immediately reflect in party ledgers, PDC cheques in hand, and general cash flow analytics.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : isUpi ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                          <QrCode size={18} />
                        </div>
                        <div>
                          <h3 className="text-sm font-extrabold text-[var(--text-primary)] tracking-wide">
                            UPI & Payment Channel Credentials
                          </h3>
                          <p className="text-xs text-[var(--text-muted)]">
                            Instant collection handles and QR code payment endpoints.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 text-xs font-semibold">
                      {/* UPI ID */}
                      <div className="p-4 bg-[var(--page-bg)] border border-[var(--border)] rounded-2xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[var(--text-muted)] block font-extrabold uppercase tracking-wider">
                            Virtual Payment Address (VPA) / UPI ID
                          </span>
                          {account.upi_id && (
                            <button
                              onClick={() => copyToClipboard(account.upi_id!, "UPI ID")}
                              className="text-[var(--text-muted)] hover:text-[var(--primary)] cursor-pointer p-1 rounded-md hover:bg-[var(--table-row-hover)] transition-colors"
                              title="Copy UPI ID"
                            >
                              {copiedField === "UPI ID" ? (
                                <Check size={14} className="text-emerald-500" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          )}
                        </div>
                        <span className="text-base font-bold font-mono text-[var(--text-primary)] block">
                          {account.upi_id || "—"}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          Use for instant receipts and billing QR codes
                        </span>
                      </div>

                      {/* Provider */}
                      <div className="p-4 bg-[var(--page-bg)] border border-[var(--border)] rounded-2xl space-y-1.5">
                        <span className="text-[10px] text-[var(--text-muted)] block font-extrabold uppercase tracking-wider">
                          UPI Payment Provider
                        </span>
                        <span className="text-base font-bold text-[var(--text-primary)] uppercase block">
                          {account.upi_provider || "Standard Bank UPI"}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          NPCI Interoperable Payment Rail
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <Wallet size={18} />
                        </div>
                        <div>
                          <h3 className="text-sm font-extrabold text-[var(--text-primary)] tracking-wide">
                            Physical Cash Register & Vault Details
                          </h3>
                          <p className="text-xs text-[var(--text-muted)]">
                            Cash drawer reconciliation, daily physical cash counts, and petty vouchers.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 text-xs font-semibold">
                      <div className="p-4 bg-[var(--page-bg)] border border-[var(--border)] rounded-2xl space-y-1.5">
                        <span className="text-[10px] text-[var(--text-muted)] block font-extrabold uppercase tracking-wider">
                          Register Name
                        </span>
                        <span className="text-base font-bold text-[var(--text-primary)] block">
                          {account.name}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          Physical Drawer Unit
                        </span>
                      </div>

                      <div className="p-4 bg-[var(--page-bg)] border border-[var(--border)] rounded-2xl space-y-1.5">
                        <span className="text-[10px] text-[var(--text-muted)] block font-extrabold uppercase tracking-wider">
                          Register Purpose / Sub-label
                        </span>
                        <span className="text-base font-bold text-[var(--text-secondary)] block">
                          {account.sub_label || "Main Cash Register"}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          Designated Custody
                        </span>
                      </div>

                      <div className="p-4 bg-[var(--page-bg)] border border-[var(--border)] rounded-2xl space-y-1.5">
                        <span className="text-[10px] text-[var(--text-muted)] block font-extrabold uppercase tracking-wider">
                          Accounting Nature
                        </span>
                        <span className="text-base font-bold capitalize text-[var(--text-primary)] block">
                          {category === "kacha"
                            ? "📝 Kaccha Account"
                            : category === "pakka"
                            ? "🏷️ Pakka Account"
                            : "🔄 Both / Universal"}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          Multi-ledger isolation tier
                        </span>
                      </div>
                    </div>

                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl text-xs text-emerald-950 dark:text-emerald-200 flex items-start gap-3">
                      <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold">Physical Cash Tracking Policy</p>
                        <p className="text-[11px] opacity-80 leading-relaxed">
                          Every cash sale, purchase reimbursement, salary disbursement, or petty cash expense recorded against this register automatically updates the physical drawer balance in real-time.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </PageState>
    </div>
  );
}
