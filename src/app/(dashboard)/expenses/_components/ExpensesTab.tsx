"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Eye, Copy } from "lucide-react";
import PageState from "@/components/shared/PageState";
import { SwipeableRow } from "@/components/shared/SwipeableRow";
import { toast } from "sonner";

interface Expense {
  id: string;
  expense_number: string;
  expense_date: string;
  amount: number;
  gst_percent: number;
  gst_amount: number;
  vendor_name: string | null;
  vendor_invoice_no: string | null;
  notes: string | null;
  expense_type: { id: string; name: string } | null;
  bank_account: { id: string; account_name: string } | null;
}

export default function ExpensesTab() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: listData, isLoading, error, refetch } = useQuery<{ expenses: Expense[] }>({
    queryKey: ["expenses-list"],
    queryFn: async () => {
      const res = await fetch("/api/expenses");
      if (!res.ok) throw new Error("Failed to load expenses list");
      return res.json();
    },
  });

  const expenses = listData?.expenses || [];

  const filteredExpenses = expenses.filter((exp) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      exp.expense_number.toLowerCase().includes(term) ||
      (exp.expense_type?.name || "").toLowerCase().includes(term) ||
      (exp.vendor_name || "").toLowerCase().includes(term) ||
      (exp.notes || "").toLowerCase().includes(term)
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
            placeholder="Search expenses, vendors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg pl-9 pr-3 h-9 text-xs transition-colors"
          />
        </div>
      </div>

      {/* Expenses Table */}
      <PageState
        isLoading={isLoading}
        isError={!!error}
        error={error?.message}
        onRetry={refetch}
        isEmpty={filteredExpenses.length === 0}
        skeletonVariant="table"
        skeletonRows={8}
        skeletonColumns={9}
        emptyTitle="No Expenses Recorded"
        emptyMessage="No operational or overhead expenses recorded matching your search."
      >
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                  <th className="py-3 px-6">Expense No.</th>
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-6">Category</th>
                  <th className="py-3 px-6">Vendor Name</th>
                  <th className="py-3 px-6 text-right">Taxable (₹)</th>
                  <th className="py-3 px-6 text-right">GST (₹)</th>
                  <th className="py-3 px-6 text-right">Total (₹)</th>
                  <th className="py-3 px-6">Paid From</th>
                  <th className="py-3 px-6 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] font-medium text-[var(--text-body)]">
                {filteredExpenses.map((exp) => {
                  const isPaid = exp.bank_account !== null;
                  const total = Number(exp.amount) + Number(exp.gst_amount || 0);

                  return (
                    <tr key={exp.id} className="hover:bg-[var(--table-row-hover)] transition-colors h-14">
                      <td className="py-3 px-6 font-mono font-bold text-[var(--text-primary)]">{exp.expense_number}</td>
                      <td className="py-3 px-6 font-mono text-[var(--text-muted)]">
                        {new Date(exp.expense_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-6 font-bold text-[var(--text-primary)]">{exp.expense_type?.name || "—"}</td>
                      <td className="py-3 px-6">{exp.vendor_name || "—"}</td>
                      <td className="py-3 px-6 text-right font-mono">{formatCurrency(exp.amount)}</td>
                      <td className="py-3 px-6 text-right font-mono text-[var(--text-muted)]">
                        {formatCurrency(exp.gst_amount)} ({exp.gst_percent}%)
                      </td>
                      <td className="py-3 px-6 text-right font-mono font-bold text-[var(--text-primary)]">
                        {formatCurrency(total)}
                      </td>
                      <td className="py-3 px-6">{exp.bank_account?.account_name || "Cash / Pending"}</td>
                      <td className="py-3 px-6 text-center">
                        {isPaid ? (
                          <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full font-bold text-[10px] uppercase border border-emerald-500/20">
                            Paid
                          </span>
                        ) : (
                          <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2.5 py-1 rounded-full font-bold text-[10px] uppercase border border-rose-500/20">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Expenses Cards */}
          <div className="md:hidden divide-y divide-[var(--border-light)]">
            {filteredExpenses.map((exp) => {
              const isPaid = exp.bank_account !== null;
              const total = Number(exp.amount) + Number(exp.gst_amount || 0);

              return (
                <SwipeableRow
                  key={exp.id}
                  leftAction={{
                    label: "Copy No",
                    bgClass: "bg-indigo-600 text-white",
                    icon: <Copy size={16} />,
                    onAction: () => {
                      navigator.clipboard.writeText(exp.expense_number);
                      toast.info(`Copied ${exp.expense_number}`);
                    },
                  }}
                  rightAction={{
                    label: "Summary",
                    bgClass: "bg-slate-700 text-white",
                    icon: <Eye size={16} />,
                    onAction: () => {
                      toast.info(`Expense ${exp.expense_number}: ${exp.vendor_name || "Direct"} — ${formatCurrency(total)}`);
                    },
                  }}
                >
                  <div className="p-3.5 space-y-2 bg-[var(--card-bg)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-[var(--primary)]">{exp.expense_number}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[var(--table-header-bg)] text-[var(--text-muted)] border border-[var(--border)]">{exp.expense_type?.name || "General"}</span>
                      </div>
                      {isPaid ? (
                        <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold text-[9px] uppercase border border-emerald-500/20">
                          Paid
                        </span>
                      ) : (
                        <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full font-bold text-[9px] uppercase border border-rose-500/20">
                          Pending
                        </span>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-[var(--text-primary)] truncate max-w-[65%]">{exp.vendor_name || "Direct Expense"}</span>
                      <span className="font-mono text-[var(--text-muted)] text-[11px]">
                        {new Date(exp.expense_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t border-[var(--border-light)] text-xs">
                      <span className="text-[var(--text-muted)] text-[11px]">{exp.bank_account?.account_name || "Cash / Pending"}</span>
                      <span className="font-mono font-bold text-sm text-[var(--text-primary)]">{formatCurrency(total)}</span>
                    </div>
                  </div>
                </SwipeableRow>
              );
            })}
          </div>
        </div>
      </PageState>
    </div>
  );
}
