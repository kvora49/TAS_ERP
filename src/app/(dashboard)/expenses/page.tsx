"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Wallet,
  Users,
  ArrowDownLeft,
  AlertCircle,
  Plus,
  ChevronDown,
  FileSpreadsheet,
  Receipt,
  RotateCcw,
} from "lucide-react";

import ExpensesTab from "./_components/ExpensesTab";
import SalaryTab from "./_components/SalaryTab";
import MiscIncomeTab from "./_components/MiscIncomeTab";
import WriteOffsTab from "./_components/WriteOffsTab";

import RecordExpenseModal from "./_components/RecordExpenseModal";
import RecordSalaryModal from "./_components/RecordSalaryModal";
import RecordMiscIncomeModal from "./_components/RecordMiscIncomeModal";
import ReverseWriteOffModal from "./_components/ReverseWriteOffModal";
import { cn } from "@/lib/utils";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function ExpensesHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active Tab State (URL Synced)
  const currentTab = searchParams.get("tab") || "expenses";
  const [activeTab, setActiveTab] = useState<string>(currentTab);

  // Modals State
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddSalary, setShowAddSalary] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [selectedWriteOffId, setSelectedWriteOffId] = useState<string | null>(null);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`/expenses?${params.toString()}`);
  };

  // KPI Overview Data Queries
  const { data: expensesData } = useQuery<{ expenses: any[] }>({
    queryKey: ["expenses-list"],
    queryFn: async () => {
      const res = await fetch("/api/expenses");
      if (!res.ok) return { expenses: [] };
      return res.json();
    },
  });

  const { data: salaryData } = useQuery<{ salaries: any[] }>({
    queryKey: ["salary-list"],
    queryFn: async () => {
      const res = await fetch("/api/salary");
      if (!res.ok) return { salaries: [] };
      return res.json();
    },
  });

  const { data: incomeData } = useQuery<{ income: any[] }>({
    queryKey: ["misc-income-list"],
    queryFn: async () => {
      const res = await fetch("/api/misc-income");
      if (!res.ok) return { income: [] };
      return res.json();
    },
  });

  const { data: writeOffsData } = useQuery<{ writeOffs: any[] }>({
    queryKey: ["write-offs"],
    queryFn: async () => {
      const res = await fetch("/api/payments/write-offs");
      if (!res.ok) return { writeOffs: [] };
      return res.json();
    },
  });

  // Calculate Metrics (Current Month)
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);

  const totalExpensesThisMonth = (expensesData?.expenses || [])
    .filter((e) => new Date(e.expense_date) >= thisMonthStart)
    .reduce((sum, e) => sum + Number(e.amount || 0) + Number(e.gst_amount || 0), 0);

  const totalSalaryThisMonth = (salaryData?.salaries || [])
    .filter((s) => new Date(s.payment_date) >= thisMonthStart)
    .reduce((sum, s) => sum + Number(s.net_salary || 0), 0);

  const totalMiscIncomeThisMonth = (incomeData?.income || [])
    .filter((i) => new Date(i.income_date) >= thisMonthStart)
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);

  const activeWriteOffsTotal = (writeOffsData?.writeOffs || [])
    .filter((wo) => !wo.reversed_at)
    .reduce((sum, wo) => sum + Number(wo.amount || 0), 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header & Main Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-[var(--primary)]" />
            Expenses & Financial Adjustments Hub
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 font-medium">
            Unified workspace for operating expenses, staff salaries, non-operating income, and invoice bad debt write-offs.
          </p>
        </div>

        {/* Primary Action Button Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="px-4 h-9 bg-[var(--primary)] text-white text-xs font-bold rounded-lg hover:bg-[var(--primary-dark)] transition-all flex items-center gap-2 shadow-[var(--shadow-sm)] cursor-pointer outline-none">
            <Plus className="w-4 h-4" />
            <span>Record Transaction</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-80" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-primary)] shadow-lg rounded-xl p-1">
            <DropdownMenuItem
              onClick={() => setShowAddExpense(true)}
              className="flex items-center gap-2 text-xs font-semibold px-3 py-2 cursor-pointer rounded-lg hover:bg-[var(--page-bg)]"
            >
              <Receipt className="w-4 h-4 text-indigo-500" />
              <span>Operating Expense</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowAddSalary(true)}
              className="flex items-center gap-2 text-xs font-semibold px-3 py-2 cursor-pointer rounded-lg hover:bg-[var(--page-bg)]"
            >
              <Users className="w-4 h-4 text-emerald-500" />
              <span>Worker Salary</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowAddIncome(true)}
              className="flex items-center gap-2 text-xs font-semibold px-3 py-2 cursor-pointer rounded-lg hover:bg-[var(--page-bg)]"
            >
              <ArrowDownLeft className="w-4 h-4 text-amber-500" />
              <span>Misc Income Inflow</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── MOBILE: snap-scroll KPI cards ── */}
      <div className="md:hidden flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 scrollbar-none">
        {[
          { label: "Expenses",    value: formatCurrency(totalExpensesThisMonth),  icon: Wallet,      bg: "bg-indigo-500/10",          color: "text-indigo-500" },
          { label: "Salary",      value: formatCurrency(totalSalaryThisMonth),    icon: Users,       bg: "bg-emerald-500/10",         color: "text-emerald-500" },
          { label: "Misc Income", value: formatCurrency(totalMiscIncomeThisMonth),icon: ArrowDownLeft,bg: "bg-amber-500/10",          color: "text-amber-500" },
          { label: "Write-offs",  value: formatCurrency(activeWriteOffsTotal),    icon: AlertCircle, bg: "bg-rose-500/10",            color: "text-rose-500" },
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

      {/* ── DESKTOP: 4-col stat grid ── */}
      <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Expenses */}
        <div className="p-4 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
            <span>Expenses (This Month)</span>
            <Wallet className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-[var(--text-primary)]">
            {formatCurrency(totalExpensesThisMonth)}
          </div>
        </div>

        {/* Salary Paid */}
        <div className="p-4 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
            <span>Salary Paid (This Month)</span>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-[var(--text-primary)]">
            {formatCurrency(totalSalaryThisMonth)}
          </div>
        </div>

        {/* Misc Income */}
        <div className="p-4 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
            <span>Misc Income (This Month)</span>
            <ArrowDownLeft className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalMiscIncomeThisMonth)}
          </div>
        </div>

        {/* Write-offs */}
        <div className="p-4 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
            <span>Active Write-offs</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400">
            {formatCurrency(activeWriteOffsTotal)}
          </div>
        </div>
      </div>{/* end desktop KPI grid */}

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] overflow-x-auto">
        <button
          type="button"
          onClick={() => handleTabChange("expenses")}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all shrink-0 ${
            activeTab === "expenses"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          📂 Operating Expenses
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("salary")}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all shrink-0 ${
            activeTab === "salary"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          👥 Worker Salary & Payroll
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("misc-income")}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all shrink-0 ${
            activeTab === "misc-income"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          💵 Misc Income Inflows
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("write-offs")}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all shrink-0 ${
            activeTab === "write-offs"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          📝 Write-offs & Adjustments
        </button>
      </div>

      {/* Tab Content Rendering */}
      <div>
        {activeTab === "expenses" && <ExpensesTab />}
        {activeTab === "salary" && <SalaryTab />}
        {activeTab === "misc-income" && <MiscIncomeTab />}
        {activeTab === "write-offs" && (
          <WriteOffsTab onOpenReverseModal={(id) => setSelectedWriteOffId(id)} />
        )}
      </div>

      {/* Modals */}
      <RecordExpenseModal
        open={showAddExpense}
        onOpenChange={setShowAddExpense}
      />
      <RecordSalaryModal
        open={showAddSalary}
        onOpenChange={setShowAddSalary}
      />
      <RecordMiscIncomeModal
        open={showAddIncome}
        onOpenChange={setShowAddIncome}
      />
      <ReverseWriteOffModal
        writeOffId={selectedWriteOffId}
        onOpenChange={(open) => {
          if (!open) setSelectedWriteOffId(null);
        }}
      />
    </div>
  );
}

export default function ExpensesHubPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 font-semibold">Loading Expenses...</div>}>
      <ExpensesHubContent />
    </Suspense>
  );
}
