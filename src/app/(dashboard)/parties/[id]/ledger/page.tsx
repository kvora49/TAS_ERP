"use client";

import React, { useState } from "react";
import { ArrowLeft, Loader2, Calendar, CreditCard, DollarSign, Receipt, ChevronDown, ChevronUp, Plus } from "lucide-react";
import Link from "next/link";
import { useERPQuery } from "@/hooks/useERPQuery";
import { formatDate, cn } from "@/lib/utils";
import { ManualNoteModal } from "@/components/sales/ManualNoteModal";

interface Allocation {
  billNo: string;
  amount: number;
}

interface LedgerEntry {
  id?: string;
  date: string;
  particulars: string;
  voucherType: "Opening" | "Purchase" | "Sale" | "Return" | "Payment" | "Advance" | "Write-off" | "Job Work" | "Salary";
  voucherNo: string;
  debit: number;
  credit: number;
  balanceStr: string;
  balanceSign: "Dr" | "Cr";
  billCategory?: "pakka" | "kacha" | "both";
  billTypeName?: string;
  allocations?: Allocation[];
}

interface Party {
  id: string;
  code: string;
  name: string;
  company_name: string | null;
  type: string[];
  phone: string | null;
  gstin: string | null;
  payment_terms: string;
  credit_limit: number;
  opening_balance: number;
  status: string;
}

export default function PartyLedgerPage({ params }: { params: { id: string } }) {
  const { id } = params;

  // Active Bill Category Tab: 'total' (combined), 'pakka' (tax invoice), 'kacha' (estimate)
  const [activeBillTab, setActiveBillTab] = useState<"total" | "pakka" | "kacha">("total");

  // Voucher Type Sub-Filter
  const [filterType, setFilterType] = useState<string>("all");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteModalType, setNoteModalType] = useState<"credit_note" | "debit_note">("credit_note");

  const { data: partyData, isLoading: partyLoading } = useERPQuery<Party | null>(
    ["party", id],
    async () => {
      const res = await fetch(`/api/parties/${id}`);
      if (!res.ok) throw new Error("Failed to load party info");
      const data = await res.json();
      return data.party || null;
    },
    { skeleton: "card" }
  );

  const { data: ledgerResponse, isLoading: ledgerLoading, refetch: refetchLedger } = useERPQuery<{
    ledger: LedgerEntry[];
    remainingAdvance: number;
  }>(
    ["ledger", id],
    async () => {
      const res = await fetch(`/api/parties/${id}/ledger`);
      if (!res.ok) throw new Error("Failed to load ledger details");
      return res.json();
    },
    { skeleton: "table" }
  );

  const party = partyData || null;
  const rawLedger = ledgerResponse?.ledger || [];
  const remainingAdvance = ledgerResponse?.remainingAdvance || 0;
  const loading = partyLoading || ledgerLoading;

  const toggleRow = (rowId: string) => {
    setExpandedRows((prev) => ({ ...prev, [rowId]: !prev[rowId] }));
  };

  const handleOpenNoteModal = (type: "credit_note" | "debit_note") => {
    setNoteModalType(type);
    setNoteModalOpen(true);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
  };

  const isCustomerOnly = party?.type?.includes("customer") && !party?.type?.includes("supplier") && !party?.type?.includes("worker");

  // 1. Tab Counts
  const totalCount = rawLedger.length;
  const pakkaCount = rawLedger.filter((e) => e.billCategory === "pakka").length;
  const kachaCount = rawLedger.filter((e) => e.billCategory === "kacha").length;

  // 2. Filter entries by Active Bill Tab (Total / Pakka / Kaccha)
  const tabFilteredEntries = rawLedger.filter((entry) => {
    if (activeBillTab === "total") return true;
    if (activeBillTab === "pakka") return entry.billCategory === "pakka" || entry.billCategory === "both";
    if (activeBillTab === "kacha") return entry.billCategory === "kacha" || entry.billCategory === "both";
    return true;
  });

  // 3. Calculate Tab-Specific KPIs
  const totalDebits = tabFilteredEntries.reduce((acc, curr) => acc + curr.debit, 0);
  const totalCredits = tabFilteredEntries.reduce((acc, curr) => acc + curr.credit, 0);

  let netTabBalance = 0;
  if (isCustomerOnly) {
    netTabBalance = tabFilteredEntries.reduce((acc, curr) => acc + (curr.debit - curr.credit), 0);
  } else {
    netTabBalance = tabFilteredEntries.reduce((acc, curr) => acc + (curr.credit - curr.debit), 0);
  }

  const closingBalanceSign = isCustomerOnly
    ? netTabBalance >= 0 ? "Dr" : "Cr"
    : netTabBalance >= 0 ? "Cr" : "Dr";

  const closingBalanceStr = `${formatCurrency(Math.abs(netTabBalance))} ${closingBalanceSign}`;

  // 4. Calculate Dynamic Running Balance per Active Tab
  let runningBal = 0;
  const tabEntriesWithRunningBalance = tabFilteredEntries.map((entry) => {
    if (isCustomerOnly) {
      runningBal += entry.debit - entry.credit;
    } else {
      runningBal += entry.credit - entry.debit;
    }
    const sign = isCustomerOnly
      ? runningBal >= 0 ? "Dr" : "Cr"
      : runningBal >= 0 ? "Cr" : "Dr";

    return {
      ...entry,
      contextBalanceStr: `${formatCurrency(Math.abs(runningBal))} ${sign}`,
      contextBalanceSign: sign,
    };
  });

  // 5. Apply Sub-Filter (Voucher Type)
  const displayLedger = filterType === "all"
    ? tabEntriesWithRunningBalance
    : tabEntriesWithRunningBalance.filter((entry) => (entry.voucherType || "").toLowerCase() === filterType.toLowerCase());

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (!party) {
    return (
      <div className="p-6 text-center text-sm font-semibold text-red-500">
        Party ledger could not be loaded.
      </div>
    );
  }

  const partyTypeCategory = party.type?.includes("supplier")
    ? "supplier"
    : party.type?.includes("worker")
    ? "worker"
    : "customer";

  return (
    <div className="p-6 space-y-6 bg-[var(--page-bg)] min-h-screen text-[var(--text-body)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/parties" className="p-2 hover:bg-[var(--table-row-hover)] rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5 text-[var(--text-muted)]" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              Ledger Account: {party.name}
              <span className="bg-[var(--primary-light)] text-[var(--primary)] font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-[var(--primary)]/20">
                {party.code}
              </span>
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Chronological statement of purchases, returns, payments, credit/debit notes, and balances.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleOpenNoteModal("credit_note")}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={14} /> Issue Credit Note
          </button>
          <button
            onClick={() => handleOpenNoteModal("debit_note")}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={14} /> Issue Debit Note
          </button>
        </div>
      </div>

      {/* PRIMARY TAB CONTROLS & VOUCHER FILTER */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-[var(--card-bg)] border border-[var(--border)] p-3 rounded-xl shadow-[var(--shadow-sm)]">
        {/* 3 Tabs: Total Combined, Pakka Bill, Kaccha Bill */}
        <div className="flex items-center gap-1.5 p-1 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl">
          <button
            onClick={() => setActiveBillTab("total")}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer",
              activeBillTab === "total"
                ? "bg-[var(--card-bg)] text-[var(--primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            )}
          >
            <span>📊 Total (Combined)</span>
            <span className="bg-[var(--border)] text-[var(--text-secondary)] px-1.5 py-0.5 rounded-full text-[10px]">
              {totalCount}
            </span>
          </button>

          <button
            onClick={() => setActiveBillTab("pakka")}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer",
              activeBillTab === "pakka"
                ? "bg-[var(--card-bg)] text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            )}
          >
            <span>📄 Pakka Bill</span>
            <span className="bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
              {pakkaCount}
            </span>
          </button>

          <button
            onClick={() => setActiveBillTab("kacha")}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer",
              activeBillTab === "kacha"
                ? "bg-[var(--card-bg)] text-amber-600 dark:text-amber-400 shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            )}
          >
            <span>📝 Kaccha Bill</span>
            <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
              {kachaCount}
            </span>
          </button>
        </div>

        {/* Voucher Sub-Filter Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--text-muted)]">Voucher Type:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] font-semibold text-xs focus:ring-2 focus:ring-[var(--input-focus)] outline-none min-w-[140px]"
          >
            <option value="all">All Vouchers</option>
            <option value="purchase">Purchase</option>
            <option value="sale">Sale</option>
            <option value="return">Return</option>
            <option value="credit note">Credit Note</option>
            <option value="debit note">Debit Note</option>
            <option value="payment">Payment</option>
            <option value="advance">Advance</option>
            <option value="write-off">Write-off</option>
          </select>
        </div>
      </div>

      {/* PARTY PROFILE & DYNAMIC TAB SUMMARY STATS CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Profile Details */}
        <div className="lg:col-span-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] space-y-3.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Profile Info</h2>
          <div>
            <span className="text-[10px] font-semibold text-[var(--text-faint)] block">Company Name</span>
            <span className="text-sm font-bold text-[var(--text-primary)]">{party.company_name || "—"}</span>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-[var(--text-faint)] block">GSTIN</span>
            <span className="text-xs font-mono font-bold uppercase text-[var(--text-secondary)]">{party.gstin || "—"}</span>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-[var(--text-faint)] block">Phone / Mobile</span>
            <span className="text-sm font-semibold text-[var(--text-secondary)]">{party.phone || "—"}</span>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-[var(--text-faint)] block">Payment Terms</span>
            <span className="text-xs font-semibold text-[var(--text-secondary)] capitalize">{party.payment_terms?.replace(/_/g, " ") || "—"}</span>
          </div>
        </div>

        {/* Dynamic KPI Cards (Updates per Active Tab) — Mobile Snap Scroll + Desktop Grid */}
        <div className="lg:col-span-3 flex md:grid md:grid-cols-3 xl:grid-cols-4 gap-3 overflow-x-auto snap-x snap-mandatory pb-1 md:pb-0 scrollbar-none">
          <div className="snap-start shrink-0 w-[160px] md:w-auto bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 md:p-5 shadow-[var(--shadow-sm)] flex items-center gap-3 md:gap-4">
            <div className="p-2.5 md:p-3 bg-red-50 dark:bg-red-950/40 rounded-lg text-red-600 dark:text-red-400 shrink-0">
              <DollarSign className="h-5 w-5 md:h-6 md:w-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] md:text-xs font-semibold text-[var(--text-muted)] truncate block">Total Debits (Dr)</span>
              <p className="text-sm md:text-xl font-bold text-red-600 dark:text-red-400 truncate">{formatCurrency(totalDebits)}</p>
              <span className="text-[9px] text-[var(--text-faint)] truncate block">
                {activeBillTab === "total" ? "All Payments" : `${activeBillTab.toUpperCase()} Debits`}
              </span>
            </div>
          </div>

          <div className="snap-start shrink-0 w-[160px] md:w-auto bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 md:p-5 shadow-[var(--shadow-sm)] flex items-center gap-3 md:gap-4">
            <div className="p-2.5 md:p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600 dark:text-emerald-400 shrink-0">
              <Receipt className="h-5 w-5 md:h-6 md:w-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] md:text-xs font-semibold text-[var(--text-muted)] truncate block">Total Credits (Cr)</span>
              <p className="text-sm md:text-xl font-bold text-emerald-600 dark:text-emerald-400 truncate">{formatCurrency(totalCredits)}</p>
              <span className="text-[9px] text-[var(--text-faint)] truncate block">
                {activeBillTab === "total" ? "All Purchases" : `${activeBillTab.toUpperCase()} Credits`}
              </span>
            </div>
          </div>

          <div className="snap-start shrink-0 w-[160px] md:w-auto bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 md:p-5 shadow-[var(--shadow-sm)] flex items-center gap-3 md:gap-4">
            <div className="p-2.5 md:p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg text-[var(--primary)] shrink-0">
              <Calendar className="h-5 w-5 md:h-6 md:w-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] md:text-xs font-semibold text-[var(--text-muted)] truncate block">Closing Balance</span>
              <p className={`text-sm md:text-xl font-bold truncate ${closingBalanceSign === "Cr" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {closingBalanceStr}
              </p>
              <span className="text-[9px] text-[var(--text-faint)] capitalize truncate block">{activeBillTab} Outstanding</span>
            </div>
          </div>

          {remainingAdvance > 0 && (
            <div className="snap-start shrink-0 w-[160px] md:w-auto bg-[var(--card-bg)] border border-blue-200 dark:border-blue-900 rounded-xl p-3.5 md:p-5 shadow-[var(--shadow-sm)] flex items-center gap-3 md:gap-4 bg-blue-50/20 dark:bg-blue-950/20">
              <div className="p-2.5 md:p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg text-blue-600 dark:text-blue-400 shrink-0">
                <CreditCard className="h-5 w-5 md:h-6 md:w-6" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] md:text-xs font-semibold text-blue-600 dark:text-blue-400 truncate block">Advance Balance</span>
                <p className="text-sm md:text-xl font-bold text-blue-600 dark:text-blue-400 truncate">{formatCurrency(remainingAdvance)}</p>
                <span className="text-[9px] text-blue-500 font-semibold uppercase tracking-wider block">Unsettled</span>
              </div>
            </div>
          )}
        </div>
      </div>


      {/* ── MOBILE LEDGER TIMELINE CARDS (< md) ── */}
      <div className="md:hidden space-y-3">
        {displayLedger.length === 0 ? (
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-8 text-center text-xs text-[var(--text-muted)] font-semibold">
            No ledger entries found for {activeBillTab.toUpperCase()} tab matching this filter.
          </div>
        ) : (
          displayLedger.map((row, idx) => {
            const hasAllocations = !!row.allocations && row.allocations.length > 0;
            const rowId = row.id || `entry-${idx}`;
            const isExpanded = !!expandedRows[rowId];
            const isPakka = row.billCategory === "pakka";
            const isKacha = row.billCategory === "kacha";

            let badgeClass = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
            if (row.voucherType === "Purchase") badgeClass = "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
            else if (row.voucherType === "Sale") badgeClass = "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300";
            else if (row.voucherType === "Return") badgeClass = "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
            else if (row.voucherType === "Payment") badgeClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";

            return (
              <div key={rowId} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badgeClass}`}>{row.voucherType}</span>
                    {isPakka && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">📄 Pakka</span>}
                    {isKacha && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">📝 Kaccha</span>}
                  </div>
                  <span className="text-[11px] font-mono text-[var(--text-muted)]">{formatDate(row.date)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-[var(--text-primary)]">{row.particulars}</p>
                    <p className="text-[11px] font-mono text-[var(--text-muted)] mt-0.5">Voucher #: {row.voucherNo}</p>
                  </div>
                  {hasAllocations && (
                    <button type="button" onClick={() => toggleRow(rowId)} className="p-1 rounded bg-[var(--page-bg)] text-[var(--text-muted)]">
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 border-t border-[var(--border-light)] pt-2 text-center">
                  <div>
                    <span className="text-[9px] font-bold text-[var(--text-faint)] uppercase">Debit (Dr)</span>
                    <p className="text-xs font-bold text-red-600 mt-0.5">{row.debit > 0 ? formatCurrency(row.debit) : "—"}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-[var(--text-faint)] uppercase">Credit (Cr)</span>
                    <p className="text-xs font-bold text-emerald-600 mt-0.5">{row.credit > 0 ? formatCurrency(row.credit) : "—"}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-[var(--text-faint)] uppercase">Balance</span>
                    <p className="text-xs font-black text-[var(--text-primary)] mt-0.5">{row.balanceStr}</p>
                  </div>
                </div>

                {isExpanded && hasAllocations && (
                  <div className="bg-[var(--page-bg)] p-2.5 rounded-lg border border-[var(--border-light)] space-y-1 text-xs">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block">Allocated Bills:</span>
                    {row.allocations!.map((a, i) => (
                      <div key={i} className="flex justify-between font-mono text-[11px]">
                        <span>{a.billNo}</span>
                        <span className="font-bold">{formatCurrency(a.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }))}
      </div>


      {/* ── DESKTOP LEDGER TABLE (≥ md) ── */}
      <div className="hidden md:block bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
        <div className="overflow-x-auto">

          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider h-11">
                <th className="px-6 py-3 w-12">Link</th>
                <th className="px-6 py-3 w-28">Date</th>
                <th className="px-6 py-3">Particulars</th>
                <th className="px-6 py-3 w-32">Voucher Type</th>
                <th className="px-6 py-3 w-28">Bill Type</th>
                <th className="px-6 py-3 w-32">Voucher No.</th>
                <th className="px-6 py-3 text-right w-36">Debit (Dr)</th>
                <th className="px-6 py-3 text-right w-36">Credit (Cr)</th>
                <th className="px-6 py-3 text-right w-44">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-[var(--card-bg)] font-medium text-[var(--text-body)]">
              {displayLedger.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[var(--text-faint)] font-semibold">
                    No ledger entries found for {activeBillTab.toUpperCase()} tab matching this filter.
                  </td>
                </tr>
              ) : (
                displayLedger.map((row, idx) => {
                  const hasAllocations = !!row.allocations && row.allocations.length > 0;
                  const rowId = row.id || `entry-${idx}`;
                  const isExpanded = !!expandedRows[rowId];

                  // Voucher badges style mapping
                  let badgeClass = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
                  if (row.voucherType === "Purchase") badgeClass = "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
                  else if (row.voucherType === "Sale") badgeClass = "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300";
                  else if (row.voucherType === "Return") badgeClass = "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
                  else if (row.voucherType === "Payment") badgeClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
                  else if (row.voucherType === "Advance") badgeClass = "bg-[var(--badge-advance-bg)] text-[var(--badge-advance-text)]";
                  else if (row.voucherType === "Write-off") badgeClass = "bg-[var(--badge-writeoff-bg)] text-[var(--badge-writeoff-text)]";
                  else if (row.voucherType === "Opening") badgeClass = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";

                  // Bill Category / Distinction Badges
                  const isPakka = row.billCategory === "pakka";
                  const isKacha = row.billCategory === "kacha";

                  return (
                    <React.Fragment key={rowId}>
                      <tr className="hover:bg-[var(--table-row-hover)] transition-colors h-16">
                        <td className="px-6 py-4 align-middle">
                          {hasAllocations ? (
                            <button
                              onClick={() => toggleRow(rowId)}
                              className="p-1 rounded bg-[var(--page-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                              title="View bill allocations"
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          ) : (
                            <span className="text-[var(--text-faint)] font-semibold">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 align-middle font-mono text-xs text-[var(--text-muted)]">
                          {formatDate(row.date)}
                        </td>
                        <td className="px-6 py-4 align-middle font-bold text-[var(--text-primary)]">
                          {row.particulars}
                        </td>
                        <td className="px-6 py-4 align-middle">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${badgeClass}`}>
                            {row.voucherType}
                          </span>
                        </td>
                        {/* DISTINCT KACCHA / PAKKA BADGE */}
                        <td className="px-6 py-4 align-middle">
                          {isPakka ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
                              📄 Pakka
                            </span>
                          ) : isKacha ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                              📝 Kaccha
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              General
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 align-middle font-mono text-xs text-[var(--text-muted)]">
                          {row.voucherNo}
                        </td>
                        <td className="px-6 py-4 align-middle text-right font-mono text-xs font-bold text-red-600 dark:text-red-400">
                          {row.debit > 0 ? formatCurrency(row.debit) : "—"}
                        </td>
                        <td className="px-6 py-4 align-middle text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {row.credit > 0 ? formatCurrency(row.credit) : "—"}
                        </td>
                        <td className="px-6 py-4 align-middle text-right">
                          <span className={`inline-flex items-center px-2 py-1 font-mono text-xs font-bold rounded ${
                            row.contextBalanceSign === "Cr" 
                              ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300" 
                              : "text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300"
                          }`}>
                            {row.contextBalanceStr}
                          </span>
                        </td>
                      </tr>

                      {/* Collapsible nested details */}
                      {hasAllocations && isExpanded && (
                        <tr className="bg-[var(--table-row-hover)]">
                          <td colSpan={9} className="px-16 py-3.5 border-t border-[var(--border)]">
                            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-4 shadow-[var(--shadow-sm)] max-w-xl">
                              <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2.5">
                                Payment Allocations (Linked Bills)
                              </h4>
                              <div className="divide-y divide-[var(--border)] text-xs">
                                {row.allocations?.map((alloc, aIdx) => (
                                  <div key={aIdx} className="flex justify-between py-2 font-semibold">
                                    <span className="text-[var(--text-body)]">{alloc.billNo}</span>
                                    <span className="text-[var(--primary)] font-bold">
                                      {formatCurrency(alloc.amount)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ManualNoteModal
        open={noteModalOpen}
        onOpenChange={setNoteModalOpen}
        initialType={noteModalType}
        initialPartyId={party.id}
        initialPartyType={partyTypeCategory as any}
        onSuccess={() => {
          refetchLedger();
        }}
      />
    </div>
  );
}
