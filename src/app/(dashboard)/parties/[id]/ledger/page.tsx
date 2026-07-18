"use client";

import React, { useState } from "react";
import { ArrowLeft, Loader2, Calendar, CreditCard, DollarSign, Receipt, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";

interface Allocation {
  billNo: string;
  amount: number;
}

interface LedgerEntry {
  id?: string;
  date: string;
  particulars: string;
  voucherType: "Opening" | "Purchase" | "Sale" | "Return" | "Payment" | "Advance" | "Write-off";
  voucherNo: string;
  debit: number;
  credit: number;
  balanceStr: string;
  balanceSign: "Dr" | "Cr";
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
  const [filterType, setFilterType] = useState<string>("all");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const { data: partyData, isLoading: partyLoading } = useQuery<Party | null>({
    queryKey: ["party", id],
    queryFn: async () => {
      const res = await fetch(`/api/parties/${id}`);
      if (!res.ok) throw new Error("Failed to load party info");
      const data = await res.json();
      return data.party || null;
    }
  });

  const { data: ledgerResponse, isLoading: ledgerLoading } = useQuery<{ ledger: LedgerEntry[]; remainingAdvance: number }>({
    queryKey: ["ledger", id],
    queryFn: async () => {
      const res = await fetch(`/api/parties/${id}/ledger`);
      if (!res.ok) throw new Error("Failed to load ledger details");
      return res.json();
    }
  });

  const party = partyData || null;
  const ledger = ledgerResponse?.ledger || [];
  const remainingAdvance = ledgerResponse?.remainingAdvance || 0;
  const loading = partyLoading || ledgerLoading;

  const toggleRow = (rowId: string) => {
    setExpandedRows((prev) => ({ ...prev, [rowId]: !prev[rowId] }));
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
  };

  const totalDebits = ledger.reduce((acc, curr) => acc + curr.debit, 0);
  const totalCredits = ledger.reduce((acc, curr) => acc + curr.credit, 0);
  const closingBalanceStr = ledger.length > 0 ? ledger[ledger.length - 1].balanceStr : "₹0.00 Cr";
  const closingBalanceSign = ledger.length > 0 ? ledger[ledger.length - 1].balanceSign : "Cr";

  const filteredLedger = filterType === "all"
    ? ledger
    : ledger.filter((entry) => entry.voucherType.toLowerCase() === filterType.toLowerCase());

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#6366F1]" />
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/parties" className="p-2 hover:bg-[#F1F5F9] rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5 text-[#64748B]" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
              Ledger Account: {party.name}
              <span className="bg-[#EEF2FF] text-[#6366F1] font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                {party.code}
              </span>
            </h1>
            <p className="text-xs text-[#64748B]">
              Chronological statement of purchases, returns, payments, and balances.
            </p>
          </div>
        </div>

        {/* Filter dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">
            Voucher Type:
          </label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-[var(--text-primary)] font-semibold text-xs focus:ring-1 focus:ring-[var(--primary)] outline-none min-w-[140px]"
          >
            <option value="all">All Vouchers</option>
            <option value="purchase">Purchase</option>
            <option value="sale">Sale</option>
            <option value="return">Return</option>
            <option value="payment">Payment</option>
            <option value="advance">Advance</option>
            <option value="write-off">Write-off</option>
          </select>
        </div>
      </div>

      {/* PARTY & SUMMARY CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Profile Details */}
        <div className="lg:col-span-1 bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-3.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-2">Profile Info</h2>
          <div>
            <span className="text-[10px] font-semibold text-[#94A3B8] block">Company Name</span>
            <span className="text-sm font-bold text-[#0F172A]">{party.company_name || "—"}</span>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-[#94A3B8] block">GSTIN</span>
            <span className="text-xs font-mono font-bold uppercase text-[#1E293B]">{party.gstin || "—"}</span>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-[#94A3B8] block">Phone / Mobile</span>
            <span className="text-sm font-semibold text-[#1E293B]">{party.phone || "—"}</span>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-[#94A3B8] block">Payment Terms</span>
            <span className="text-xs font-semibold text-[#1E293B] capitalize">{party.payment_terms?.replace(/_/g, " ") || "—"}</span>
          </div>
        </div>

        {/* Ledger Statistics Cards */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-red-50 rounded-lg text-red-600">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#64748B]">Total Debits (Dr)</span>
              <p className="text-xl font-bold text-[#DC2626]">{formatCurrency(totalDebits)}</p>
              <span className="text-[10px] text-[#94A3B8]">Payments / Returns</span>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-lg text-green-600">
              <Receipt className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#64748B]">Total Credits (Cr)</span>
              <p className="text-xl font-bold text-[#16A34A]">{formatCurrency(totalCredits)}</p>
              <span className="text-[10px] text-[#94A3B8]">Purchases / Invoices</span>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-lg text-[#6366F1]">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#64748B]">Closing Balance</span>
              <p className={`text-xl font-bold ${closingBalanceSign === "Cr" ? "text-emerald-700" : "text-rose-700"}`}>
                {closingBalanceStr}
              </p>
              <span className="text-[10px] text-[#94A3B8]">Net Outstanding</span>
            </div>
          </div>

          {remainingAdvance > 0 && (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm flex items-center gap-4 border-blue-200 bg-blue-50/20">
              <div className="p-3 bg-blue-100 rounded-lg text-[#1D4ED8]">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-[#1D4ED8]">Advance Balance</span>
                <p className="text-xl font-bold text-[#1D4ED8]">{formatCurrency(remainingAdvance)}</p>
                <span className="text-[10px] text-blue-500 font-semibold uppercase tracking-wider">Unsettled</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CUSTOM LEDGER TABLE WITH COLLAPSIBLE ALLOCATIONS */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-xs font-semibold text-[#64748B] uppercase tracking-wider h-11">
                <th className="px-6 py-3 w-16">Link</th>
                <th className="px-6 py-3 w-32">Date</th>
                <th className="px-6 py-3">Particulars</th>
                <th className="px-6 py-3 w-36">Voucher Type</th>
                <th className="px-6 py-3 w-36">Voucher No.</th>
                <th className="px-6 py-3 text-right w-44">Debit (Dr)</th>
                <th className="px-6 py-3 text-right w-44">Credit (Cr)</th>
                <th className="px-6 py-3 text-right w-52">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] bg-white font-medium text-[#374151]">
              {filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-semibold">
                    No ledger entries found matching this filter.
                  </td>
                </tr>
              ) : (
                filteredLedger.map((row, idx) => {
                  const hasAllocations = !!row.allocations && row.allocations.length > 0;
                  const rowId = row.id || `entry-${idx}`;
                  const isExpanded = !!expandedRows[rowId];

                  // Voucher badges style mapping
                  let badgeClass = "bg-slate-100 text-slate-600";
                  if (row.voucherType === "Purchase") badgeClass = "bg-[#DBEAFE] text-[#1D4ED8]";
                  else if (row.voucherType === "Sale") badgeClass = "bg-[#DBEAFE] text-[#1D4ED8]";
                  else if (row.voucherType === "Return") badgeClass = "bg-[#FEF3C7] text-[#D97706]";
                  else if (row.voucherType === "Payment") badgeClass = "bg-[#DCFCE7] text-[#15803D]";
                  else if (row.voucherType === "Advance") badgeClass = "bg-[var(--badge-advance-bg)] text-[var(--badge-advance-text)]";
                  else if (row.voucherType === "Write-off") badgeClass = "bg-[var(--badge-writeoff-bg)] text-[var(--badge-writeoff-text)]";
                  else if (row.voucherType === "Opening") badgeClass = "bg-[#F1F5F9] text-[#64748B]";

                  return (
                    <React.Fragment key={rowId}>
                      <tr className="hover:bg-slate-50/50 transition-colors h-16">
                        <td className="px-6 py-4 align-middle">
                          {hasAllocations ? (
                            <button
                              onClick={() => toggleRow(rowId)}
                              className="p-1 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
                              title="View bill allocations"
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          ) : (
                            <span className="text-slate-300 font-semibold">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 align-middle font-mono text-xs text-slate-500">
                          {formatDate(row.date)}
                        </td>
                        <td className="px-6 py-4 align-middle font-bold text-[#1E293B]">
                          {row.particulars}
                        </td>
                        <td className="px-6 py-4 align-middle">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${badgeClass}`}>
                            {row.voucherType}
                          </span>
                        </td>
                        <td className="px-6 py-4 align-middle font-mono text-xs text-[#64748B]">
                          {row.voucherNo}
                        </td>
                        <td className="px-6 py-4 align-middle text-right font-mono text-xs font-bold text-red-600">
                          {row.debit > 0 ? formatCurrency(row.debit) : "—"}
                        </td>
                        <td className="px-6 py-4 align-middle text-right font-mono text-xs font-bold text-emerald-600">
                          {row.credit > 0 ? formatCurrency(row.credit) : "—"}
                        </td>
                        <td className="px-6 py-4 align-middle text-right">
                          <span className={`inline-flex items-center px-2 py-1 font-mono text-xs font-bold rounded ${
                            row.balanceSign === "Cr" ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"
                          }`}>
                            {row.balanceStr}
                          </span>
                        </td>
                      </tr>

                      {/* Collapsible nested details */}
                      {hasAllocations && isExpanded && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={8} className="px-16 py-3.5 border-t border-[#E5E7EB]">
                            <div className="bg-white border border-[#E5E7EB] rounded-lg p-4 shadow-[var(--shadow-sm)] max-w-xl">
                              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                                Payment Allocations (Linked Bills)
                              </h4>
                              <div className="divide-y divide-slate-100 text-xs">
                                {row.allocations?.map((alloc, aIdx) => (
                                  <div key={aIdx} className="flex justify-between py-2 font-semibold">
                                    <span className="text-slate-600">{alloc.billNo}</span>
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
    </div>
  );
}
