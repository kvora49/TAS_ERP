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
  const totalOutflowVal = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "outflow")
        .reduce((acc, curr) => acc + Number(curr.amount || 0), 0),
    [transactions]
  );
  const totalInflowVal = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "inflow")
        .reduce((acc, curr) => acc + Number(curr.amount || 0), 0),
    [transactions]
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
  const category = account?.account_category || (account?.type === "cash" ? "kacha" : "pakka");

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Breadcrumbs Navigation */}
      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)] select-none">
        <Link href="/" className="hover:text-[var(--primary)] transition-colors">
          Dashboard
        </Link>
        <ChevronRight size={12} className="text-[var(--text-faint)]" />
        <Link href="/master-data" className="hover:text-[var(--primary)] transition-colors">
          Master Data
        </Link>
        <ChevronRight size={12} className="text-[var(--text-faint)]" />
        <Link href="/master-data/banks-upi" className="hover:text-[var(--primary)] transition-colors">
          Banks & UPI
        </Link>
        <ChevronRight size={12} className="text-[var(--text-faint)]" />
        <span className="text-[var(--text-primary)] font-bold truncate max-w-[150px] sm:max-w-none">
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
        emptyDescription="This bank or UPI account could not be retrieved from the database."
      >
        {account && (
          <>
            {/* Header App Bar */}
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[var(--primary-light)] rounded-2xl border border-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)] shrink-0 font-black text-xl shadow-xs">
                    {account.type === "bank" ? (
                      <CreditCard size={24} />
                    ) : account.type === "upi" ? (
                      <QrCode size={24} />
                    ) : (
                      <Wallet size={24} />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <h1 className="text-lg sm:text-xl font-black text-[var(--text-primary)] tracking-tight">
                        {account.name}
                      </h1>
                      {account.is_default && (
                        <span className="bg-[var(--primary-light)] text-[var(--primary)] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[var(--primary)]/20 uppercase">
                          Default
                        </span>
                      )}
                      {/* Nature Badge */}
                      {category === "pakka" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                          🏷️ Pakka
                        </span>
                      ) : category === "kacha" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          📝 Kaccha
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                          🔄 Both
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                          account.is_active
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                        }`}
                      >
                        {account.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 text-xs text-[var(--text-muted)] font-medium">
                      {account.sub_label && (
                        <span className="text-[var(--text-secondary)]">{account.sub_label}</span>
                      )}
                      {account.type === "bank" && account.bank_name && (
                        <span>Bank: <strong className="text-[var(--text-primary)]">{account.bank_name}</strong></span>
                      )}
                      {account.type === "upi" && account.upi_id && (
                        <span className="font-mono text-[var(--primary)]">{account.upi_id}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <button
                    onClick={() => router.push(`/master-data/banks-upi`)}
                    className="h-9 px-3.5 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-[var(--text-body)] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <ArrowLeft size={13} />
                    <span>Back to List</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ── 2x2 Responsive KPI Grid ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
              {/* Card 1: Book Balance */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-3.5 sm:p-4 shadow-sm flex items-center gap-3">
                <div className="p-2.5 sm:p-3 bg-[var(--primary-light)] rounded-xl text-[var(--primary)] shrink-0">
                  <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider truncate">
                    Book Balance
                  </span>
                  <span className="text-sm sm:text-base font-black text-[var(--text-primary)] truncate block">
                    {formatCurrency(currentApproxBalance)}
                  </span>
                </div>
              </div>

              {/* Card 2: Opening Balance */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-3.5 sm:p-4 shadow-sm flex items-center gap-3">
                <div className="p-2.5 sm:p-3 bg-[var(--table-header-bg)] rounded-xl text-[var(--text-muted)] shrink-0">
                  <Layers className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider truncate">
                    Opening Bal
                  </span>
                  <span className="text-sm sm:text-base font-black text-[var(--text-secondary)] truncate block">
                    {formatCurrency(account.opening_balance)}
                  </span>
                </div>
              </div>

              {/* Card 3: Total Inflows */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-3.5 sm:p-4 shadow-sm flex items-center gap-3">
                <div className="p-2.5 sm:p-3 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0">
                  <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider truncate">
                    Total Inflows
                  </span>
                  <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 truncate block">
                    {formatCurrency(totalInflowVal)}
                  </span>
                </div>
              </div>

              {/* Card 4: Total Outflows */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-3.5 sm:p-4 shadow-sm flex items-center gap-3">
                <div className="p-2.5 sm:p-3 bg-rose-500/10 rounded-xl text-rose-600 dark:text-rose-400 shrink-0">
                  <ArrowDownLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider truncate">
                    Total Outflows
                  </span>
                  <span className="text-sm sm:text-base font-black text-rose-600 dark:text-rose-400 truncate block">
                    {formatCurrency(totalOutflowVal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Sleek Segmented Subtabs Bar */}
            <div className="flex items-center gap-1 p-1 bg-[var(--table-header-bg)] border border-[var(--border)] rounded-xl w-fit overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab("transactions")}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeTab === "transactions"
                    ? "bg-[var(--card-bg)] text-[var(--primary)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                <History size={13} />
                <span>Transaction History</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--input-bg)] text-[var(--text-muted)]">
                  {totalTransactions}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("credentials")}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeTab === "credentials"
                    ? "bg-[var(--card-bg)] text-[var(--primary)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                <CreditCard size={13} />
                <span>Account Credentials</span>
              </button>
            </div>

            {/* Tab 1: Transaction History */}
            {activeTab === "transactions" && (
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm p-4 sm:p-5 space-y-4">
                {/* Search & Type Filters */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-faint)]" />
                    <input
                      type="text"
                      value={txSearch}
                      onChange={(e) => {
                        setTxSearch(e.target.value);
                        setTxPage(1);
                      }}
                      placeholder="Search voucher ref, party name, mode..."
                      className="w-full h-9 pl-9 pr-3 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-colors"
                    />
                  </div>

                  <div className="flex items-center gap-1 p-0.5 bg-[var(--table-header-bg)] border border-[var(--border)] rounded-lg">
                    <button
                      onClick={() => {
                        setTxTypeFilter("all");
                        setTxPage(1);
                      }}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md cursor-pointer transition-all ${
                        txTypeFilter === "all"
                          ? "bg-[var(--card-bg)] text-[var(--text-primary)] shadow-xs"
                          : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => {
                        setTxTypeFilter("inflow");
                        setTxPage(1);
                      }}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md cursor-pointer transition-all ${
                        txTypeFilter === "inflow"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black shadow-xs"
                          : "text-[var(--text-muted)] hover:text-emerald-500"
                      }`}
                    >
                      + Inflows
                    </button>
                    <button
                      onClick={() => {
                        setTxTypeFilter("outflow");
                        setTxPage(1);
                      }}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md cursor-pointer transition-all ${
                        txTypeFilter === "outflow"
                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 font-black shadow-xs"
                          : "text-[var(--text-muted)] hover:text-rose-500"
                      }`}
                    >
                      - Outflows
                    </button>
                  </div>
                </div>

                {/* ── MOBILE: Transaction Card List ── */}
                <div className="block md:hidden space-y-2.5">
                  {paginatedTransactions.length === 0 ? (
                    <div className="py-12 text-center text-xs text-[var(--text-muted)] bg-[var(--page-bg)] rounded-xl border border-dashed border-[var(--border)]">
                      No transactions match the selected criteria.
                    </div>
                  ) : (
                    paginatedTransactions.map((t) => {
                      const isInflow = t.type === "inflow";
                      return (
                        <div
                          key={t.id}
                          className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-3.5 space-y-2 shadow-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                              {t.ref_no}
                            </span>
                            <span
                              className={`text-xs font-black font-mono px-2 py-0.5 rounded-md ${
                                isInflow
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {isInflow ? "+" : "-"}{formatCurrency(t.amount)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-[var(--text-secondary)] truncate">
                              {t.partyName}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)] font-mono">
                              {new Date(t.date).toLocaleDateString()}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[var(--border-light)] text-[var(--text-muted)]">
                            <span>{t.details}</span>
                            <span className="uppercase text-[10px] font-bold px-1.5 py-0.5 bg-[var(--input-bg)] border border-[var(--border)] rounded text-[var(--text-secondary)]">
                              {t.mode}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* ── DESKTOP: Transaction Table ── */}
                <div className="hidden md:block overflow-hidden rounded-xl border border-[var(--border)]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        <th className="py-3 px-4 w-36">Date</th>
                        <th className="py-3 px-4">Ref / Voucher</th>
                        <th className="py-3 px-4">Party Details</th>
                        <th className="py-3 px-4">Description</th>
                        <th className="py-3 px-4 w-28">Mode</th>
                        <th className="py-3 px-4 text-right w-36">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] text-xs text-[var(--text-body)]">
                      {paginatedTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-[var(--text-muted)]">
                            No transactions recorded for this account.
                          </td>
                        </tr>
                      ) : (
                        paginatedTransactions.map((t) => {
                          const isInflow = t.type === "inflow";
                          return (
                            <tr
                              key={t.id}
                              className="hover:bg-[var(--table-row-hover)] transition-colors"
                            >
                              <td className="py-3 px-4 font-mono text-[var(--text-secondary)]">
                                {new Date(t.date).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-4 font-bold font-mono text-[var(--text-primary)]">
                                {t.ref_no}
                              </td>
                              <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">
                                {t.partyName}
                              </td>
                              <td className="py-3 px-4 text-[var(--text-muted)]">
                                {t.details}
                              </td>
                              <td className="py-3 px-4">
                                <span className="uppercase text-[10px] font-bold px-2 py-0.5 bg-[var(--input-bg)] border border-[var(--border)] rounded text-[var(--text-secondary)]">
                                  {t.mode}
                                </span>
                              </td>
                              <td
                                className={`py-3 px-4 text-right font-mono font-bold ${
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
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border)] text-xs">
                    <span className="text-[var(--text-muted)]">
                      Page <strong className="text-[var(--text-primary)]">{txPage}</strong> of{" "}
                      <strong className="text-[var(--text-primary)]">{totalPages}</strong> ({filteredTransactions.length} records)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                        disabled={txPage === 1}
                        className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] text-[var(--text-body)] hover:bg-[var(--table-row-hover)] disabled:opacity-40 cursor-pointer"
                        title="Previous Page"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        onClick={() => setTxPage((p) => Math.min(totalPages, p + 1))}
                        disabled={txPage === totalPages}
                        className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] text-[var(--text-body)] hover:bg-[var(--table-row-hover)] disabled:opacity-40 cursor-pointer"
                        title="Next Page"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Account Credentials */}
            {activeTab === "credentials" && (
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-5 sm:p-6 shadow-sm space-y-6 max-w-2xl">
                {isBank ? (
                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-[var(--text-primary)] border-b border-[var(--border)] pb-2.5 uppercase tracking-wider">
                      Bank Details & Credentials
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs font-semibold">
                      <div className="p-3 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl space-y-1">
                        <span className="text-[var(--text-muted)] block font-bold uppercase tracking-wider text-[10px]">
                          Bank Name
                        </span>
                        <span className="text-sm font-bold text-[var(--text-primary)]">
                          {account.bank_name || "—"}
                        </span>
                      </div>

                      <div className="p-3 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl space-y-1">
                        <span className="text-[var(--text-muted)] block font-bold uppercase tracking-wider text-[10px]">
                          Branch Location
                        </span>
                        <span className="text-sm font-bold text-[var(--text-primary)]">
                          {account.branch || "—"}
                        </span>
                      </div>

                      <div className="p-3 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl space-y-1 relative">
                        <span className="text-[var(--text-muted)] block font-bold uppercase tracking-wider text-[10px]">
                          Account Number
                        </span>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-[var(--text-primary)] font-mono">
                            {account.account_number || "—"}
                          </span>
                          {account.account_number && (
                            <button
                              onClick={() => copyToClipboard(account.account_number!, "Account Number")}
                              className="p-1 text-[var(--text-muted)] hover:text-[var(--primary)] cursor-pointer"
                              title="Copy"
                            >
                              {copiedField === "Account Number" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="p-3 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl space-y-1 relative">
                        <span className="text-[var(--text-muted)] block font-bold uppercase tracking-wider text-[10px]">
                          IFSC Code
                        </span>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-[var(--text-primary)] font-mono">
                            {account.ifsc || "—"}
                          </span>
                          {account.ifsc && (
                            <button
                              onClick={() => copyToClipboard(account.ifsc!, "IFSC Code")}
                              className="p-1 text-[var(--text-muted)] hover:text-[var(--primary)] cursor-pointer"
                              title="Copy"
                            >
                              {copiedField === "IFSC Code" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-[var(--text-primary)] border-b border-[var(--border)] pb-2.5 uppercase tracking-wider">
                      UPI / Payment Channel Credentials
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs font-semibold">
                      <div className="p-3 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl space-y-1">
                        <span className="text-[var(--text-muted)] block font-bold uppercase tracking-wider text-[10px]">
                          UPI ID / VPA Handle
                        </span>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-[var(--text-primary)] font-mono">
                            {account.upi_id || "—"}
                          </span>
                          {account.upi_id && (
                            <button
                              onClick={() => copyToClipboard(account.upi_id!, "UPI ID")}
                              className="p-1 text-[var(--text-muted)] hover:text-[var(--primary)] cursor-pointer"
                              title="Copy"
                            >
                              {copiedField === "UPI ID" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="p-3 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl space-y-1">
                        <span className="text-[var(--text-muted)] block font-bold uppercase tracking-wider text-[10px]">
                          UPI Service Provider
                        </span>
                        <span className="text-sm font-bold text-[var(--text-primary)] uppercase">
                          {account.upi_provider || "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </PageState>
    </div>
  );
}
