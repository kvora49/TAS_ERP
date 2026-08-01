"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  IndianRupee,
  TrendingUp,
  UserCircle,
  Wallet,
  Plus,
  ShoppingCart,
  Factory,
  CreditCard,
  Receipt,
  BarChart3,
  TrendingDown,
  ArrowUpRight,
  Loader2,
  Building2,
  Smartphone,
  AlertTriangle,
  Bell,
  ChevronRight,
} from "lucide-react";
import { DueDateBadge } from "@/components/shared/DueDateBadge";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useAppStore } from "@/store";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface KPIMetric {
  value: number;
  change: number;
  positive: boolean;
}

interface DashboardData {
  kpis: {
    totalStockValue: KPIMetric;
    todaySales: KPIMetric;
    thisMonthSales: KPIMetric;
    pendingDues: KPIMetric;
    cashInHand: KPIMetric;
  };
  productionDonut: { name: string; value: number; color: string }[];
  lowStockAlerts: { name: string; category: string; qty: string; reorder: string }[];
  upcomingPayments: { desc: string; date: string; amount: number; type: string }[];
  salesChart: { date: string; sales: number }[];
  godownStock: { name: string; pieces: number; value: number }[];
  bankBalances: any[];
}

import { useGeneralSettings } from "@/hooks/useGeneralSettings";

export default function DashboardPage() {
  const user = useAppStore((state) => state.user);
  const filters = useAppStore((state) => state.filters);
  const queryClient = useQueryClient();
  const { lowStockAlerts: isLowStockAlertsEnabled, formatAppCurrency } = useGeneralSettings();

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<DashboardData | null>({
    queryKey: ["dashboard", filters.brandId, filters.dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard?brandId=${filters.brandId}&dateRange=${filters.dateRange}`);
      if (!res.ok) throw new Error("Failed to load dashboard data");
      const result = await res.json();
      return result;
    },
    enabled: !!user,
  });

  const data = dashboardData || null;
  const loading = dashboardLoading;

  const { data: receivablesReminders } = useQuery({
    queryKey: ["reminders-summary", "receivables"],
    queryFn: async () => {
      const res = await fetch("/api/reminders?type=bills");
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user,
  });

  const { data: payablesReminders } = useQuery({
    queryKey: ["reminders-summary", "payables"],
    queryFn: async () => {
      const res = await fetch("/api/reminders?type=payables");
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (user) {
      const supabase = createClient();
      const channel = supabase
        .channel(`realtime:dashboard:${user.businessId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "bank_accounts",
            filter: `business_id=eq.${user.businessId}`,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, queryClient]);

  const formatCurrency = (val: number) => {
    return formatAppCurrency(val);
  };

  if (loading || !data) {
    return (
      <div className="space-y-6 select-none animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-[var(--card-bg)] rounded-xl p-5 border border-[var(--border)] shadow-[var(--shadow-sm)] flex items-start justify-between">
              <div className="space-y-3 w-full">
                <div className="h-2.5 w-2/3 bg-[var(--border)] rounded" />
                <div className="h-6 w-1/2 bg-[var(--border)] rounded" />
                <div className="h-2 w-3/4 bg-[var(--border)] rounded" />
              </div>
              <div className="w-12 h-12 rounded-xl bg-[var(--border)] shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { kpis, productionDonut, lowStockAlerts, upcomingPayments, salesChart, godownStock, bankBalances } = data;

  return (
    <div className="space-y-6">
      {/* Row 1: KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title="Total Stock Value"
          value={formatCurrency(kpis.totalStockValue.value)}
          change={kpis.totalStockValue.change}
          positive={kpis.totalStockValue.positive}
          icon={ShoppingBag}
          iconBgClass="bg-[#EEF2FF] text-[#6366F1] dark:bg-[#1E1B4B] dark:text-[#818CF8]"
        />

        <KPICard
          title="Today's Sales"
          value={formatCurrency(kpis.todaySales.value)}
          change={kpis.todaySales.change}
          positive={kpis.todaySales.positive}
          icon={IndianRupee}
          iconBgClass="bg-[#F0FDF4] text-[#16A34A] dark:bg-[#064E3B] dark:text-[#4ADE80]"
        />

        <KPICard
          title={
            filters.dateRange === "today"
              ? "Today's Sales"
              : filters.dateRange === "this_week"
              ? "This Week Sales"
              : filters.dateRange === "last_month"
              ? "Last Month Sales"
              : filters.dateRange === "this_year"
              ? "This Year Sales"
              : "This Month Sales"
          }
          value={formatCurrency(kpis.thisMonthSales.value)}
          change={kpis.thisMonthSales.change}
          positive={kpis.thisMonthSales.positive}
          icon={TrendingUp}
          iconBgClass="bg-[#FFF7ED] text-[#EA580C] dark:bg-[#431407] dark:text-[#FB923C]"
        />

        <KPICard
          title="Pending Dues"
          value={formatCurrency(kpis.pendingDues.value)}
          change={kpis.pendingDues.change}
          positive={kpis.pendingDues.positive}
          icon={UserCircle}
          iconBgClass="bg-[#FEF9C3] text-[#D97706] dark:bg-[#451A03] dark:text-[#FBBF24]"
          inverseColorDirection={true}
        />

        <KPICard
          title="Cash in Hand"
          value={formatCurrency(kpis.cashInHand.value)}
          change={kpis.cashInHand.change}
          positive={kpis.cashInHand.positive}
          icon={Wallet}
          iconBgClass="bg-[#FDF2F8] text-[#DB2777] dark:bg-[#500724] dark:text-[#F472B6]"
        />
      </div>

      {/* Row 2: Production Donut & Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Production Status Donut */}
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] shadow-[var(--shadow-sm)] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Production Stages</h3>
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">
              Lots Distribution
            </span>
          </div>

          <div className="h-56 relative flex items-center justify-center my-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={productionDonut}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {productionDonut.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${value} Lots`, "Count"]}
                  contentStyle={{
                    background: "#0F172A",
                    color: "#F8FAFC",
                    borderRadius: "8px",
                    border: "1px solid #334155",
                    fontSize: "11px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Inner Label */}
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                Total Lots
              </span>
              <span className="text-2xl font-extrabold text-[var(--text-primary)] mt-0.5">
                {productionDonut.reduce((sum, item) => sum + item.value, 0)}
              </span>
            </div>
          </div>

          {/* Donut Legend */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
            {productionDonut.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5 font-medium">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[var(--text-primary)]">{item.name}</span>
                <span className="text-[var(--text-muted)] font-bold">({item.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] shadow-[var(--shadow-sm)] p-5 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-3">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Low Stock Alerts</h3>
            <span className="h-6 px-2 rounded-md bg-[#FEE2E2] dark:bg-[#450A0A] text-[#DC2626] dark:text-[#FCA5A5] text-[10px] font-bold uppercase flex items-center justify-center">
              Action Required
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)] space-y-3">
            {isLowStockAlertsEnabled && Array.isArray(lowStockAlerts) && lowStockAlerts.length > 0 ? (
              lowStockAlerts.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between pt-3 first:pt-0 gap-3">
                  <div className="flex items-start gap-2.5 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] dark:bg-[#451A03] text-[#D97706] dark:text-[#FBBF24] flex items-center justify-center shrink-0">
                      <AlertTriangle size={15} />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                        {item.name}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mt-0.5">
                        {item.category}
                      </p>
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap shrink-0">
                    <p className="text-xs font-bold text-[#DC2626] dark:text-[#FCA5A5]">{item.qty}</p>
                    <p className="text-[10px] text-[var(--text-muted)] font-medium leading-none mt-0.5">
                      Limit: {item.reorder}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-[var(--text-muted)] italic">
                {!isLowStockAlertsEnabled ? "Low stock alerts are disabled in general settings" : "No low stock alerts"}
              </div>
            )}
          </div>
        </div>

        {/* Overdue & Reminders Widget */}
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] shadow-[var(--shadow-sm)] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-[var(--primary)]" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Overdue & Payment Reminders</h3>
            </div>
            <Link
              href="/reminders"
              className="text-[11px] font-bold text-[var(--primary)] hover:underline flex items-center gap-0.5"
            >
              <span>Hub</span>
              <ChevronRight size={12} />
            </Link>
          </div>

          <div className="space-y-3">
            {/* Customer Receivables Summary */}
            <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/50 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-amber-700 dark:text-amber-300 tracking-wider block">
                  Customer Receivables
                </span>
                <span className="text-xs font-bold text-[var(--text-primary)] mt-0.5 block">
                  {receivablesReminders?.stats?.total_overdue || 0} Bills Overdue
                </span>
              </div>
              <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                {formatCurrency(receivablesReminders?.stats?.total_outstanding || 0)}
              </span>
            </div>

            {/* Vendor Payables Summary */}
            <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/50 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-indigo-700 dark:text-indigo-300 tracking-wider block">
                  Supplier Payables
                </span>
                <span className="text-xs font-bold text-[var(--text-primary)] mt-0.5 block">
                  {payablesReminders?.stats?.total_overdue || 0} Bills Pending
                </span>
              </div>
              <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                {formatCurrency(payablesReminders?.stats?.total_outstanding || 0)}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--border)] mt-3">
            <Link
              href="/reminders"
              className="w-full py-2 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Bell size={13} />
              <span>Manage All Reminders & Schedules</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Row 3: Sales Trend & Balances */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend Line Chart */}
        <div className="lg:col-span-2 bg-[var(--card-bg)] rounded-xl border border-[var(--border)] shadow-[var(--shadow-sm)] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-3">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Sales Trend</h3>
            <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              May 2026
            </div>
          </div>

          <div className="h-56 w-full my-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--text-muted)", fontSize: 10, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `₹${val / 1000}k`}
                  tick={{ fill: "var(--text-muted)", fontSize: 10, fontWeight: 600 }}
                  dx={-10}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), "Sales"]}
                  contentStyle={{
                    background: "#0F172A",
                    color: "#F8FAFC",
                    borderRadius: "8px",
                    border: "1px solid #334155",
                    fontSize: "11px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#6366F1"
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 1, fill: "var(--card-bg)" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bank & Cash Balances / Godowns */}
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] shadow-[var(--shadow-sm)] p-5 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-2.5">
            <h3 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border)] pb-2">
              Godown Stock Value
            </h3>
            <div className="space-y-2">
              {godownStock.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <span className="text-[var(--text-primary)] font-semibold truncate max-w-[130px]">
                    {item.name}
                  </span>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-[var(--text-primary)]">
                      {formatCurrency(item.value)}
                    </p>
                    <p className="text-[9px] text-[var(--text-muted)] font-bold uppercase mt-0.5">
                      {item.pieces} pieces
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5 mt-2">
            <h3 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border)] pb-2">
              Accounts Balance
            </h3>
            <div className="space-y-2 overflow-y-auto max-h-[140px] divide-y divide-[var(--border)]">
              {bankBalances.map((item, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center text-xs pt-2 first:pt-0"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                        item.type === "bank"
                          ? "bg-[#DBEAFE] dark:bg-[#1E3A5F] text-[#1D4ED8] dark:text-[#93C5FD]"
                          : "bg-[#EDE9FE] dark:bg-[#2E1065] text-[#7C3AED] dark:text-[#C4B5FD]"
                      )}
                    >
                      {item.type === "bank" ? (
                        <Building2 size={13} />
                      ) : (
                        <Smartphone size={13} />
                      )}
                    </span>
                    <div className="overflow-hidden">
                      <p className="font-bold text-[var(--text-primary)] truncate">
                        {item.name}
                      </p>
                      <p className="text-[9px] text-[var(--text-muted)] font-bold uppercase truncate">
                        {item.type === "bank"
                          ? item.bank_name || "Bank Account"
                          : item.upi_provider || "UPI"}
                      </p>
                    </div>
                  </div>
                  <span className="font-extrabold text-[var(--text-primary)] shrink-0 text-right">
                    {formatCurrency(item.opening_balance)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Quick Actions */}
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] shadow-[var(--shadow-sm)] p-5">
        <h3 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border)] pb-2.5 mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <QuickActionCard
            label="Add Sale"
            subtitle="Create Bill"
            icon={ShoppingCart}
            iconColorClass="text-[#2563EB] dark:text-[#60A5FA]"
            iconBgClass="bg-[#EFF6FF] dark:bg-[#1E3A5F]"
            href="/sales/bills/new"
          />
          <QuickActionCard
            label="New Lot"
            subtitle="Start Batch"
            icon={Factory}
            iconColorClass="text-[#7C3AED] dark:text-[#C4B5FD]"
            iconBgClass="bg-[#F5F3FF] dark:bg-[#2E1065]"
            href="/production/lots/new"
          />
          <QuickActionCard
            label="Receive Payment"
            subtitle="Party Receipt"
            icon={CreditCard}
            iconColorClass="text-[#16A34A] dark:text-[#4ADE80]"
            iconBgClass="bg-[#F0FDF4] dark:bg-[#064E3B]"
            href="/payments/receive"
          />
          <QuickActionCard
            label="Record Expense"
            subtitle="General Voucher"
            icon={Receipt}
            iconColorClass="text-[#EA580C] dark:text-[#FB923C]"
            iconBgClass="bg-[#FFF7ED] dark:bg-[#431407]"
            href="/expenses/new"
          />
          <QuickActionCard
            label="Scan QR Code"
            subtitle="PWA Scanner"
            icon={BarChart3}
            iconColorClass="text-[#0D9488] dark:text-[#2DD4BF]"
            iconBgClass="bg-[#CCFBF1] dark:bg-[#134E4A]"
            href="/scan"
          />
          <QuickActionCard
            label="Party Ledger"
            subtitle="View Statement"
            icon={UserCircle}
            iconColorClass="text-[#D97706] dark:text-[#FBBF24]"
            iconBgClass="bg-[#FEF3C7] dark:bg-[#451A03]"
            href="/parties"
          />
        </div>
      </div>
    </div>
  );
}

// Subcomponents helper - KPI Card
interface KPICardProps {
  title: string;
  value: string;
  change: number;
  positive: boolean;
  icon: React.ComponentType<any>;
  iconBgClass: string;
  inverseColorDirection?: boolean;
}

function KPICard({
  title,
  value,
  change,
  positive,
  icon: Icon,
  iconBgClass,
  inverseColorDirection = false,
}: KPICardProps) {
  const isWorse = inverseColorDirection ? positive : !positive;

  return (
    <div className="bg-[var(--card-bg)] rounded-xl p-5 border border-[var(--border)] shadow-[var(--shadow-sm)] flex items-start justify-between select-none">
      <div className="space-y-2">
        <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
          {title}
        </span>
        <h4 className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
          {value}
        </h4>
        {change !== 0 && (
          <div className="flex items-center gap-1.5 mt-0.5 leading-none">
            {isWorse ? (
              <TrendingDown size={14} className="text-[#DC2626] dark:text-[#FCA5A5]" />
            ) : (
              <TrendingUp size={14} className="text-[#15803D] dark:text-[#4ADE80]" />
            )}
            <span
              className={cn(
                "text-[11px] font-bold",
                isWorse ? "text-[#DC2626] dark:text-[#FCA5A5]" : "text-[#15803D] dark:text-[#4ADE80]"
              )}
            >
              {isWorse ? "-" : "+"}
              {change}%
            </span>
            <span className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-wide">
              VS last month
            </span>
          </div>
        )}
      </div>

      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner", iconBgClass)}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

// Subcomponents helper - Quick Action Card
interface QuickActionProps {
  label: string;
  subtitle: string;
  icon: React.ComponentType<any>;
  iconColorClass: string;
  iconBgClass: string;
  href: string;
}

function QuickActionCard({
  label,
  subtitle,
  icon: Icon,
  iconColorClass,
  iconBgClass,
  href,
}: QuickActionProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (href === "/expenses/new") {
      e.preventDefault();
      toast.info("Expenses recording features are coming soon!");
    }
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      className="bg-[var(--card-bg)] rounded-xl p-4 border border-[var(--border)] flex items-center gap-3 cursor-pointer hover:border-[#6366F1] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 select-none group"
    >
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors group-hover:bg-[#6366F1]/10", iconBgClass)}>
        <Icon className={cn("h-4.5 w-4.5 transition-transform group-hover:scale-110", iconColorClass)} />
      </div>
      <div className="overflow-hidden leading-tight">
        <p className="text-xs font-extrabold text-[var(--text-primary)] truncate">
          {label}
        </p>
        <p className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-wider truncate mt-0.5">
          {subtitle}
        </p>
      </div>
    </Link>
  );
}
