"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import PageState from "@/components/shared/PageState";

interface IncomeItem {
  id: string;
  income_number: string;
  income_type: "scrap_sale" | "machinery_rental" | "commission" | "other";
  income_date: string;
  amount: number;
  notes: string | null;
  bank_account: { id: string; account_name: string } | null;
  party: { id: string; name: string } | null;
}

export default function MiscIncomeTab() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: listData, isLoading, error, refetch } = useQuery<{ income: IncomeItem[] }>({
    queryKey: ["misc-income-list"],
    queryFn: async () => {
      const res = await fetch("/api/misc-income");
      if (!res.ok) throw new Error("Failed to load misc income list");
      return res.json();
    },
  });

  const incomeList = listData?.income || [];

  const filteredIncome = incomeList.filter((inc) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      inc.income_number.toLowerCase().includes(term) ||
      inc.income_type.toLowerCase().includes(term) ||
      (inc.party?.name || "").toLowerCase().includes(term) ||
      (inc.notes || "").toLowerCase().includes(term)
    );
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-faint)]" />
          <input
            type="text"
            placeholder="Search income, party, type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg pl-9 pr-3 h-9 text-xs transition-colors"
          />
        </div>
      </div>

      {/* Misc Income Table */}
      <PageState
        isLoading={isLoading}
        isError={!!error}
        error={error?.message}
        onRetry={refetch}
        isEmpty={filteredIncome.length === 0}
        skeletonVariant="table"
        skeletonRows={8}
        skeletonColumns={7}
        emptyTitle="No Miscellaneous Income Recorded"
        emptyMessage="No non-operating income entries recorded matching your criteria."
      >
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                  <th className="py-3 px-6">Income No.</th>
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-6">Income Type</th>
                  <th className="py-3 px-6">Received From (Party)</th>
                  <th className="py-3 px-6 text-right">Amount (₹)</th>
                  <th className="py-3 px-6">Deposited In</th>
                  <th className="py-3 px-6">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] font-medium text-[var(--text-body)]">
                {filteredIncome.map((inc) => (
                  <tr key={inc.id} className="hover:bg-[var(--table-row-hover)] transition-colors h-14">
                    <td className="py-3 px-6 font-mono font-bold text-[var(--text-primary)]">{inc.income_number}</td>
                    <td className="py-3 px-6 font-mono text-[var(--text-muted)]">
                      {new Date(inc.income_date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3 px-6 font-bold text-[var(--text-primary)] capitalize">
                      {inc.income_type.replace(/_/g, " ")}
                    </td>
                    <td className="py-3 px-6">{inc.party?.name || "—"}</td>
                    <td className="py-3 px-6 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(inc.amount)}
                    </td>
                    <td className="py-3 px-6">{inc.bank_account?.account_name || "Cash"}</td>
                    <td className="py-3 px-6 text-[var(--text-muted)] truncate max-w-[220px]" title={inc.notes || ""}>
                      {inc.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </PageState>
    </div>
  );
}
