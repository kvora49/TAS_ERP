"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import PageState from "@/components/shared/PageState";
import { getFutureProofYearOptions } from "@/lib/utils";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface SalaryEntry {
  id: string;
  salary_month: number;
  salary_year: number;
  base_salary: number;
  allowances: number;
  deductions: number;
  net_salary: number;
  payment_mode: string;
  payment_date: string;
  reference_no: string | null;
  remarks: string | null;
  worker: { id: string; name: string } | null;
}

export default function SalaryTab() {
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<number>(0); // 0 = all
  const [searchTerm, setSearchTerm] = useState<string>("");

  const { data: listData, isLoading, error, refetch } = useQuery<{ salaries: SalaryEntry[] }>({
    queryKey: ["salary-list"],
    queryFn: async () => {
      const res = await fetch("/api/salary");
      if (!res.ok) throw new Error("Failed to load salary records");
      return res.json();
    },
  });

  const allSalaries = listData?.salaries || [];

  const salaries = allSalaries.filter((s) => {
    if (filterMonth > 0 && s.salary_month !== filterMonth) return false;
    if (s.salary_year !== filterYear) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (s.worker?.name || "").toLowerCase().includes(term);
    }
    return true;
  });

  const yearOptions = getFutureProofYearOptions();

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);

  return (
    <div className="space-y-4">
      {/* Top Filter & Sub-feature Links Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-faint)]" />
            <input
              type="text"
              placeholder="Search worker..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg pl-9 pr-3 h-9 text-xs transition-colors"
            />
          </div>

          {/* Year Select */}
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg pl-3 pr-8 h-9 text-xs font-bold transition-colors cursor-pointer"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Month Select */}
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(Number(e.target.value))}
            className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg pl-3 pr-8 h-9 text-xs font-bold transition-colors cursor-pointer"
          >
            <option value={0}>All Months</option>
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>

        {/* Sub-feature Quick Links */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Link
            href="/salary/advances"
            className="px-3 py-2 border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-primary)] text-xs font-bold rounded-lg hover:bg-[var(--page-bg)] transition-colors"
          >
            Advances
          </Link>
          <Link
            href="/salary/process"
            className="px-3 py-2 border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-primary)] text-xs font-bold rounded-lg hover:bg-[var(--page-bg)] transition-colors"
          >
            Bulk Payroll
          </Link>
        </div>
      </div>

      {/* Salary Table */}
      <PageState
        isLoading={isLoading}
        isError={!!error}
        error={error?.message}
        onRetry={refetch}
        isEmpty={salaries.length === 0}
        skeletonVariant="table"
        skeletonRows={8}
        skeletonColumns={8}
        emptyTitle="No Salary Records Found"
        emptyMessage="No worker salary records match the selected year and month filters."
      >
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                  <th className="py-3 px-6">Worker</th>
                  <th className="py-3 px-6">Month / Year</th>
                  <th className="py-3 px-6 text-right">Base Salary</th>
                  <th className="py-3 px-6 text-right">Allowances</th>
                  <th className="py-3 px-6 text-right">Deductions</th>
                  <th className="py-3 px-6 text-right">Net Salary</th>
                  <th className="py-3 px-6">Mode</th>
                  <th className="py-3 px-6">Paid Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] font-medium text-[var(--text-body)]">
                {salaries.map((s) => (
                  <tr key={s.id} className="hover:bg-[var(--table-row-hover)] transition-colors h-14">
                    <td className="py-3 px-6 font-bold text-[var(--text-primary)]">{s.worker?.name || "—"}</td>
                    <td className="py-3 px-6 font-mono">{MONTHS[s.salary_month - 1]} {s.salary_year}</td>
                    <td className="py-3 px-6 text-right font-mono">{fmt(s.base_salary)}</td>
                    <td className="py-3 px-6 text-right font-mono text-emerald-600 dark:text-emerald-400">+{fmt(s.allowances)}</td>
                    <td className="py-3 px-6 text-right font-mono text-rose-600 dark:text-rose-400">-{fmt(s.deductions)}</td>
                    <td className="py-3 px-6 text-right font-bold font-mono text-[var(--text-primary)]">{fmt(s.net_salary)}</td>
                    <td className="py-3 px-6 capitalize">{s.payment_mode.replace(/_/g, " ")}</td>
                    <td className="py-3 px-6 font-mono text-[var(--text-muted)]">
                      {new Date(s.payment_date).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Salary Cards */}
          <div className="md:hidden divide-y divide-[var(--border-light)]">
            {salaries.map((s) => (
              <div key={s.id} className="p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[var(--text-primary)]">{s.worker?.name || "—"}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--table-header-bg)] text-[var(--text-muted)] border border-[var(--border)]">
                    {MONTHS[s.salary_month - 1]} {s.salary_year}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1 text-center bg-[var(--table-header-bg)] rounded-lg p-2 border border-[var(--border-light)]">
                  <div>
                    <p className="text-[9px] uppercase font-bold text-[var(--text-faint)]">Base</p>
                    <p className="text-xs font-mono font-medium text-[var(--text-body)]">{fmt(s.base_salary)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-[var(--text-faint)]">Allowances</p>
                    <p className="text-xs font-mono font-medium text-emerald-600">+{fmt(s.allowances)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-[var(--text-faint)]">Deductions</p>
                    <p className="text-xs font-mono font-medium text-rose-600">-{fmt(s.deductions)}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-1 border-t border-[var(--border-light)] text-xs">
                  <span className="text-[var(--text-muted)] text-[11px] capitalize">
                    {s.payment_mode.replace(/_/g, " ")} · {new Date(s.payment_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                  <div className="text-right">
                    <span className="text-[10px] text-[var(--text-muted)] mr-1.5 uppercase font-bold">Net</span>
                    <span className="font-mono font-bold text-sm text-[var(--text-primary)]">{fmt(s.net_salary)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </PageState>
    </div>
  );
}
