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
} from "lucide-react";
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

export default function DashboardPage() {
  const user = useAppStore((state) => state.user);
  const filters = useAppStore((state) => state.filters);
  const queryClient = useQueryClient();

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<DashboardData | null>({
    queryKey: ["dashboard", filters.brandId, filters.dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard?brandId=${filters.brandId}&dateRange=${filters.dateRange}`);
      if (!res.ok) throw new Error("Failed to load dashboard data");
      const result = await res.json();
      return result;
    },
    enabled: !!user
  });

  const data = dashboardData || null;
  const loading = dashboardLoading;

  useEffect(() => {
    if (user) {
      // Setup Supabase Realtime channel to auto-update metrics on sales/stock changes
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
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  if (loading || !data) {
    return (
      <div className="space-y-6 select-none animate-pulse">
        {/* Row 1: KPI Cards Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-[var(--shadow-sm)] flex items-start justify-between">
              <div className="space-y-3 w-full">
                <div className="h-2.5 w-2/3 bg-slate-200 rounded" />
                <div className="h-6 w-1/2 bg-slate-300 rounded" />
                <div className="h-2 w-3/4 bg-slate-200 rounded" />
              </div>
              <div className="w-12 h-12 rounded-xl bg-slate-200 shrink-0" />
            </div>
          ))}
        </div>

        {/* Row 2: Production Donut & Lists Skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Donut Chart Box */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-[var(--shadow-sm)] p-5 h-72 flex flex-col justify-between">
            <div className="h-4 w-1/3 bg-slate-200 rounded" />
            <div className="w-36 h-36 rounded-full border-8 border-slate-200 mx-auto my-3 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-slate-100" />
            </div>
            <div className="h-4 w-2/3 bg-slate-200 rounded mx-auto" />
          </div>

          {/* Low Stock Alerts Box */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-[var(--shadow-sm)] p-5 h-72 flex flex-col">
            <div className="h-4 w-1/3 bg-slate-200 rounded mb-4" />
            <div className="space-y-4 flex-1">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="flex gap-2 items-center w-full">
                    <div className="w-8 h-8 bg-slate-200 rounded-lg shrink-0" />
                    <div className="space-y-1.5 w-full">
                      <div className="h-3 w-1/2 bg-slate-200 rounded" />
                      <div className="h-2 w-1/3 bg-slate-100 rounded" />
                    </div>
                  </div>
                  <div className="w-12 h-4 bg-slate-200 rounded shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Payments Box */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-[var(--shadow-sm)] p-5 h-72 flex flex-col">
            <div className="h-4 w-1/3 bg-slate-200 rounded mb-4" />
            <div className="space-y-4 flex-1">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="space-y-1.5 w-full">
                    <div className="h-3 w-1/2 bg-slate-200 rounded" />
                    <div className="h-2.5 w-1/3 bg-slate-100 rounded" />
                  </div>
                  <div className="w-16 h-5 bg-slate-200 rounded shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3: Sales Trend & Balances */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-[#E5E7EB] shadow-[var(--shadow-sm)] p-5 h-72 flex flex-col justify-between">
            <div className="h-4 w-1/4 bg-slate-200 rounded" />
            <div className="w-full h-44 bg-slate-100 rounded border border-dashed border-slate-200 flex items-end p-2 gap-4">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="bg-slate-200 rounded w-full" style={{ height: `${20 + i * 10}%` }} />
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-[var(--shadow-sm)] p-5 h-72 flex flex-col">
            <div className="h-4 w-1/3 bg-slate-200 rounded mb-4" />
            <div className="space-y-4 flex-1">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="h-3 w-1/2 bg-slate-200 rounded" />
                  <div className="h-3.5 w-1/4 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { kpis, productionDonut, lowStockAlerts, upcomingPayments, salesChart, godownStock, bankBalances } = data;

  return (
    <div className="space-y-6">
      {/* Row 1: KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Total Stock Value */}
        <KPICard
          title="Total Stock Value"
          value={formatCurrency(kpis.totalStockValue.value)}
          change={kpis.totalStockValue.change}
          positive={kpis.totalStockValue.positive}
          icon={ShoppingBag}
          iconBgClass="bg-[#EEF2FF] text-[#6366F1]"
        />

        {/* KPI 2: Today's Sales */}
        <KPICard
          title="Today's Sales"
          value={formatCurrency(kpis.todaySales.value)}
          change={kpis.todaySales.change}
          positive={kpis.todaySales.positive}
          icon={IndianRupee}
          iconBgClass="bg-[#F0FDF4] text-[#16A34A]"
        />

        {/* KPI 3: This Month Sales */}
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
          iconBgClass="bg-[#FFF7ED] text-[#EA580C]"
        />

        {/* KPI 4: Pending Dues */}
        <KPICard
          title="Pending Dues"
          value={formatCurrency(kpis.pendingDues.value)}
          change={kpis.pendingDues.change}
          positive={kpis.pendingDues.positive}
          icon={UserCircle}
          iconBgClass="bg-[#FEF9C3] text-[#D97706]"
          inverseColorDirection={true} // dues increasing is negative
        />

        {/* KPI 5: Cash in Hand */}
        <KPICard
          title="Cash in Hand"
          value={formatCurrency(kpis.cashInHand.value)}
          change={kpis.cashInHand.change}
          positive={kpis.cashInHand.positive}
          icon={Wallet}
          iconBgClass="bg-[#FDF2F8] text-[#DB2777]"
        />
      </div>

      {/* Row 2: Production Donut & Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Production Status Donut */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-[var(--shadow-sm)] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6]">
            <h3 className="text-sm font-bold text-[#0F172A]">Production Stages</h3>
            <span className="text-[10px] uppercase font-bold text-[#64748B] tracking-wider">
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
                    background: "#0F1629",
                    color: "white",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Inner Label */}
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                Total Lots
              </span>
              <span className="text-2xl font-extrabold text-[#0F172A] mt-0.5">
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
                <span className="text-[#374151]">{item.name}</span>
                <span className="text-[#64748B] font-bold">({item.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-[var(--shadow-sm)] p-5 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6] mb-3">
            <h3 className="text-sm font-bold text-[#0F172A]">Low Stock Alerts</h3>
            <span className="h-6 px-2 rounded-md bg-[#FEE2E2] text-[#DC2626] text-[10px] font-bold uppercase flex items-center justify-center">
              Action Required
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#F3F4F6] space-y-3">
            {lowStockAlerts.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between pt-3 first:pt-0 gap-3">
                <div className="flex items-start gap-2.5 overflow-hidden">
                  <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0">
                    <AlertTriangle size={15} />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-[#0F172A] truncate">
                      {item.name}
                    </p>
                    <p className="text-[10px] text-[#64748B] font-semibold uppercase tracking-wider mt-0.5">
                      {item.category}
                    </p>
                  </div>
                </div>
                <div className="text-right whitespace-nowrap shrink-0">
                  <p className="text-xs font-bold text-[#DC2626]">{item.qty}</p>
                  <p className="text-[10px] text-[#94A3B8] font-medium leading-none mt-0.5">
                    Limit: {item.reorder}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Payments */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-[var(--shadow-sm)] p-5 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6] mb-3">
            <h3 className="text-sm font-bold text-[#0F172A]">Upcoming Outflows</h3>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
              Due Next 10 Days
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#F3F4F6] space-y-3">
            {upcomingPayments.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between pt-3 first:pt-0 gap-3">
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-[#0F172A] truncate">
                    {item.desc}
                  </p>
                  <p className="text-[10px] text-[#64748B] font-semibold uppercase tracking-wider mt-0.5">
                    {item.date}
                  </p>
                </div>
                <div className="text-right whitespace-nowrap shrink-0">
                  <p className="text-xs font-bold text-[#374151]">
                    {formatCurrency(item.amount)}
                  </p>
                  <span
                    className={cn(
                      "inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mt-0.5 leading-none",
                      item.type === "cheque"
                        ? "bg-[#EDE9FE] text-[#7C3AED]"
                        : "bg-[#FEF3C7] text-[#D97706]"
                    )}
                  >
                    {item.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Sales Trend & Balances */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend Line Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E5E7EB] shadow-[var(--shadow-sm)] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6] mb-3">
            <h3 className="text-sm font-bold text-[#0F172A]">Sales Trend</h3>
            <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
              May 2026
            </div>
          </div>

          <div className="h-56 w-full my-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#94A3B8", fontSize: 10, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `₹${val / 1000}k`}
                  tick={{ fill: "#94A3B8", fontSize: 10, fontWeight: 600 }}
                  dx={-10}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), "Sales"]}
                  contentStyle={{
                    background: "#0F1629",
                    color: "white",
                    borderRadius: "8px",
                    border: "none",
                    fontSize: "11px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#6366F1"
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 1, fill: "white" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bank & Cash Balances / Godowns */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-[var(--shadow-sm)] p-5 flex flex-col justify-between gap-4">
          {/* Godown Stock Summary */}
          <div className="flex flex-col gap-2.5">
            <h3 className="text-sm font-bold text-[#0F172A] border-b border-[#F3F4F6] pb-2">
              Godown Stock Value
            </h3>
            <div className="space-y-2">
              {godownStock.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <span className="text-[#374151] font-semibold truncate max-w-[130px]">
                    {item.name}
                  </span>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-[#0F172A]">
                      {formatCurrency(item.value)}
                    </p>
                    <p className="text-[9px] text-[#94A3B8] font-bold uppercase mt-0.5">
                      {item.pieces} pieces
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cash & Bank Balances */}
          <div className="flex flex-col gap-2.5 mt-2">
            <h3 className="text-sm font-bold text-[#0F172A] border-b border-[#F3F4F6] pb-2">
              Accounts Balance
            </h3>
            <div className="space-y-2 overflow-y-auto max-h-[140px] divide-y divide-[#F3F4F6]">
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
                          ? "bg-[#DBEAFE] text-[#1D4ED8]"
                          : "bg-[#EDE9FE] text-[#7C3AED]"
                      )}
                    >
                      {item.type === "bank" ? (
                        <Building2 size={13} />
                      ) : (
                        <Smartphone size={13} />
                      )}
                    </span>
                    <div className="overflow-hidden">
                      <p className="font-bold text-[#374151] truncate">
                        {item.name}
                      </p>
                      <p className="text-[9px] text-[#94A3B8] font-bold uppercase truncate">
                        {item.type === "bank"
                          ? item.bank_name || "Bank Account"
                          : item.upi_provider || "UPI"}
                      </p>
                    </div>
                  </div>
                  <span className="font-extrabold text-[#0F172A] shrink-0 text-right">
                    {formatCurrency(item.opening_balance)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Quick Actions */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-[var(--shadow-sm)] p-5">
        <h3 className="text-sm font-bold text-[#0F172A] border-b border-[#F3F4F6] pb-2.5 mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <QuickActionCard
            label="Add Sale"
            subtitle="New Invoice"
            icon={Plus}
            iconColorClass="text-[#6366F1]"
            iconBgClass="bg-[#EEF2FF]"
            href="/sales/bills/new"
          />
          <QuickActionCard
            label="Add Purchase"
            subtitle="Raw Materials"
            icon={ShoppingCart}
            iconColorClass="text-[#16A34A]"
            iconBgClass="bg-[#F0FDF4]"
            href="/raw-materials/purchases/new"
          />
          <QuickActionCard
            label="Create Lot"
            subtitle="Production Job"
            icon={Factory}
            iconColorClass="text-[#EA580C]"
            iconBgClass="bg-[#FFF7ED]"
            href="/production/lots/new"
          />
          <QuickActionCard
            label="Add Payment"
            subtitle="Ledger Settle"
            icon={CreditCard}
            iconColorClass="text-[#D97706]"
            iconBgClass="bg-[#FFFBEB]"
            href="/production/job-work/record-payment"
          />
          <QuickActionCard
            label="Add Expense"
            subtitle="Daily Outflows"
            icon={Receipt}
            iconColorClass="text-[#DC2626]"
            iconBgClass="bg-[#FEF2F2]"
            href="/expenses/new"
          />
          <QuickActionCard
            label="View Reports"
            subtitle="P&L / GST Summary"
            icon={BarChart3}
            iconColorClass="text-[#7C3AED]"
            iconBgClass="bg-[#F5F3FF]"
            href="/reports/production"
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
  // Determine if this is a negative change metric
  const isWorse = inverseColorDirection ? positive : !positive;

  return (
    <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-[var(--shadow-sm)] flex items-start justify-between select-none">
      <div className="space-y-2">
        <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider block">
          {title}
        </span>
        <h4 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
          {value}
        </h4>
        {change !== 0 && (
          <div className="flex items-center gap-1.5 mt-0.5 leading-none">
            {isWorse ? (
              <TrendingDown size={14} className="text-[#DC2626]" />
            ) : (
              <TrendingUp size={14} className="text-[#15803D]" />
            )}
            <span
              className={cn(
                "text-[11px] font-bold",
                isWorse ? "text-[#DC2626]" : "text-[#15803D]"
              )}
            >
              {isWorse ? "-" : "+"}
              {change}%
            </span>
            <span className="text-[10px] text-[#94A3B8] font-medium uppercase tracking-wide">
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
      className="bg-white rounded-xl p-4 border border-[#E5E7EB] flex items-center gap-3 cursor-pointer hover:border-[#6366F1] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 select-none group"
    >
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors group-hover:bg-[#6366F1]/10", iconBgClass)}>
        <Icon className={cn("h-4.5 w-4.5 transition-transform group-hover:scale-110", iconColorClass)} />
      </div>
      <div className="overflow-hidden leading-tight">
        <p className="text-xs font-extrabold text-[#0F172A] truncate">
          {label}
        </p>
        <p className="text-[9px] text-[#64748B] font-bold uppercase tracking-wider truncate mt-0.5">
          {subtitle}
        </p>
      </div>
    </Link>
  );
}
