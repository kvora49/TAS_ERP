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
import { cn, formatCurrency } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { triggerHaptic } from "@/lib/haptics";
import { PullToRefresh } from "@/components/shared/PullToRefresh";

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
  salesChart: { date: string; sales: number }[];
  godownStock: { name: string; pieces: number; value: number }[];
  bankBalances: any[];
  remindersSummary?: {
    receivables: { total_overdue: number; total_outstanding: number };
    payables: { total_overdue: number; total_outstanding: number };
  };
}

import { useGeneralSettings } from "@/hooks/useGeneralSettings";
import { useChartTheme } from "@/hooks/useChartTheme";
import PageState from "@/components/shared/PageState";
import { motion } from "framer-motion";
import { staggerContainer, cardVariants, hoverLift } from "@/lib/animations";
import { useExperienceProfile } from "@/components/experience/NavigationExperienceProvider";

export default function DashboardPage() {
  const user = useAppStore((state) => state.user);
  const filters = useAppStore((state) => state.filters);
  const queryClient = useQueryClient();
  const chartTheme = useChartTheme();
  const { lowStockAlerts: isLowStockAlertsEnabled, formatAppCurrency } = useGeneralSettings();
  const [mobileTab, setMobileTab] = useState<"overview" | "alerts" | "accounts">("overview");

  const brandId = filters?.brandId || "all";
  const dateRange = filters?.dateRange || "this_month";

  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    isError,
    error,
    refetch,
  } = useQuery<DashboardData | null>({
    queryKey: ["dashboard", brandId, dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard?brandId=${encodeURIComponent(brandId)}&dateRange=${encodeURIComponent(dateRange)}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to load dashboard data");
      }
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
    enabled: !!user && !dashboardData?.remindersSummary,
  });

  const { data: payablesReminders } = useQuery({
    queryKey: ["reminders-summary", "payables"],
    queryFn: async () => {
      const res = await fetch("/api/reminders?type=payables");
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user && !dashboardData?.remindersSummary,
  });

  useEffect(() => {
    if (user?.businessId) {
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
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "sale_bills",
            filter: `business_id=eq.${user.businessId}`,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "finished_stock",
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
  }, [user?.businessId, queryClient]);

  return (
    <PageState
      isLoading={loading}
      isError={isError}
      error={error?.message}
      onRetry={refetch}
      isEmpty={!data}
      skeletonVariant="stats"
      skeletonCount={5}
    >
      {data && (() => {
        const { kpis, productionDonut, lowStockAlerts, salesChart, godownStock, bankBalances } = data;

        return (
          <div>
            {/* ══════════════════════════════════════════════════════════════════
                MOBILE VIEW (< md): Tab-Based Zero-Excess-Scroll Layout
                ══════════════════════════════════════════════════════════════════ */}
            <div className="md:hidden">
              <PullToRefresh
                onRefresh={async () => {
                  triggerHaptic("success");
                  await refetch();
                  toast.success("Dashboard refreshed");
                }}
                className="space-y-4"
              >
              {/* 1. Responsive Multi-Row KPI Grid (No horizontal scrolling) */}
              <div className="grid grid-cols-2 min-[540px]:grid-cols-3 gap-2.5">
                <MobileKPICard
                  title="Total Stock"
                  value={formatCurrency(kpis.totalStockValue.value)}
                  change={kpis.totalStockValue.change}
                  positive={kpis.totalStockValue.positive}
                  icon={ShoppingBag}
                  iconBgClass="bg-[var(--primary-light)] text-[var(--primary)]"
                />
                <MobileKPICard
                  title="Today's Sales"
                  value={formatCurrency(kpis.todaySales.value)}
                  change={kpis.todaySales.change}
                  positive={kpis.todaySales.positive}
                  icon={IndianRupee}
                  iconBgClass="bg-[var(--badge-green-bg)] text-[var(--badge-green-text)]"
                />
                <MobileKPICard
                  title="Period Sales"
                  value={formatCurrency(kpis.thisMonthSales.value)}
                  change={kpis.thisMonthSales.change}
                  positive={kpis.thisMonthSales.positive}
                  icon={TrendingUp}
                  iconBgClass="bg-[var(--badge-orange-bg)] text-[var(--badge-orange-text)]"
                />
                <MobileKPICard
                  title="Pending Dues"
                  value={formatCurrency(kpis.pendingDues.value)}
                  change={kpis.pendingDues.change}
                  positive={kpis.pendingDues.positive}
                  icon={UserCircle}
                  iconBgClass="bg-[var(--badge-red-bg)] text-[var(--badge-red-text)]"
                  inverseColorDirection={true}
                />
                <div className="col-span-2 min-[540px]:col-span-1">
                  <MobileKPICard
                    title="Cash in Hand"
                    value={formatCurrency(kpis.cashInHand.value)}
                    change={kpis.cashInHand.change}
                    positive={kpis.cashInHand.positive}
                    icon={Wallet}
                    iconBgClass="bg-[var(--badge-purple-bg)] text-[var(--badge-purple-text)]"
                  />
                </div>
              </div>

              {/* 2. Segmented Mobile Tabs */}
              <div className="flex p-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-xs select-none">
                {[
                  { id: "overview", label: "Overview" },
                  {
                    id: "alerts",
                    label: `Alerts ${lowStockAlerts?.length ? `(${lowStockAlerts.length})` : ""}`,
                  },
                  { id: "accounts", label: "Accounts" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic("selection");
                      setMobileTab(tab.id as any);
                    }}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-xs font-bold transition-all text-center cursor-pointer touch-ripple",
                      mobileTab === tab.id
                        ? "bg-[var(--primary)] text-white shadow-xs"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* 3. Tab Content Panels with Horizontal Swipe */}
              <motion.div
                key={mobileTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -60) {
                    // Swiped Left -> go next
                    if (mobileTab === "overview") {
                      triggerHaptic("selection");
                      setMobileTab("alerts");
                    } else if (mobileTab === "alerts") {
                      triggerHaptic("selection");
                      setMobileTab("accounts");
                    }
                  } else if (info.offset.x > 60) {
                    // Swiped Right -> go prev
                    if (mobileTab === "accounts") {
                      triggerHaptic("selection");
                      setMobileTab("alerts");
                    } else if (mobileTab === "alerts") {
                      triggerHaptic("selection");
                      setMobileTab("overview");
                    }
                  }
                }}
                className="space-y-4 touch-pan-y"
              >
                {/* ── Tab: Overview ── */}
                {mobileTab === "overview" && (
                  <div className="space-y-4">
                    {/* Sales Trend Chart */}
                    <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-sm)] p-4">
                      <div className="flex items-center justify-between pb-2.5 border-b border-[var(--border)] mb-2">
                        <h3 className="text-xs font-bold text-[var(--text-primary)]">Sales Trend</h3>
                        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                          {dateRange.replace("_", " ")}
                        </span>
                      </div>
                      <div className="h-40 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={salesChart}>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                            <XAxis
                              dataKey="date"
                              tickLine={false}
                              axisLine={false}
                              tick={{ fill: chartTheme.axisText, fontSize: 9, fontWeight: 600 }}
                              dy={6}
                            />
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(val) => `₹${val / 1000}k`}
                              tick={{ fill: chartTheme.axisText, fontSize: 9, fontWeight: 600 }}
                              dx={-6}
                            />
                            <Tooltip
                              formatter={(value) => [formatCurrency(Number(value)), "Sales"]}
                              contentStyle={{
                                background: chartTheme.tooltipBg,
                                color: chartTheme.text,
                                borderRadius: "8px",
                                border: `1px solid ${chartTheme.tooltipBorder}`,
                                fontSize: "11px",
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="sales"
                              stroke="var(--primary)"
                              strokeWidth={2.5}
                              dot={false}
                              activeDot={{ r: 5 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* 2x2 Quick Actions Tile Grid */}
                    <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-sm)] p-4">
                      <h3 className="text-xs font-bold text-[var(--text-primary)] pb-2.5 mb-3 border-b border-[var(--border)]">
                        Quick Actions
                      </h3>
                      <div className="grid grid-cols-2 gap-2.5">
                        <QuickActionCard
                          label="Add Sale"
                          subtitle="Create Bill"
                          icon={ShoppingCart}
                          iconColorClass="text-[var(--primary)]"
                          iconBgClass="bg-[var(--primary-light)]"
                          href="/sales/bills/new"
                        />
                        <QuickActionCard
                          label="New Lot"
                          subtitle="Start Batch"
                          icon={Factory}
                          iconColorClass="text-[var(--badge-purple-text)]"
                          iconBgClass="bg-[var(--badge-purple-bg)]"
                          href="/production/lots/new"
                        />
                        <QuickActionCard
                          label="Receive"
                          subtitle="Payment"
                          icon={CreditCard}
                          iconColorClass="text-[var(--badge-green-text)]"
                          iconBgClass="bg-[var(--badge-green-bg)]"
                          href="/payments/receive"
                        />
                        <QuickActionCard
                          label="Scan QR"
                          subtitle="PWA Scanner"
                          icon={BarChart3}
                          iconColorClass="text-emerald-500"
                          iconBgClass="bg-emerald-500/10"
                          href="/scan"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Tab: Alerts ── */}
                {mobileTab === "alerts" && (
                  <div className="space-y-4">
                    {/* Low Stock Alerts Card */}
                    <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-sm)] p-4">
                      <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-3">
                        <h3 className="text-xs font-bold text-[var(--text-primary)]">Low Stock Alerts</h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[var(--badge-red-bg)] text-[var(--badge-red-text)]">
                          Action Required
                        </span>
                      </div>
                      <div className="divide-y divide-[var(--border)] space-y-2.5">
                        {isLowStockAlertsEnabled && Array.isArray(lowStockAlerts) && lowStockAlerts.length > 0 ? (
                          lowStockAlerts.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between pt-2.5 first:pt-0 gap-3">
                              <div className="flex items-center gap-2.5 overflow-hidden">
                                <div className="w-8 h-8 rounded-xl bg-[var(--badge-orange-bg)] text-[var(--badge-orange-text)] flex items-center justify-center shrink-0">
                                  <AlertTriangle size={15} />
                                </div>
                                <div className="overflow-hidden">
                                  <p className="text-xs font-bold text-[var(--text-primary)] truncate">{item.name}</p>
                                  <p className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-wider">{item.category}</p>
                                </div>
                              </div>
                              <div className="text-right whitespace-nowrap shrink-0">
                                <p className="text-xs font-bold text-[var(--badge-red-text)]">{item.qty}</p>
                                <p className="text-[10px] text-[var(--text-muted)] font-medium leading-none mt-0.5">Limit: {item.reorder}</p>
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

                    {/* Overdue Reminders Card (Dark mode safe tokens) */}
                    <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-sm)] p-4 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                        <div className="flex items-center gap-2">
                          <Bell className="h-4 w-4 text-[var(--primary)]" />
                          <h3 className="text-xs font-bold text-[var(--text-primary)]">Payment Reminders</h3>
                        </div>
                        <Link href="/reminders" className="text-[11px] font-bold text-[var(--primary)] hover:underline flex items-center gap-0.5">
                          <span>Hub</span>
                          <ChevronRight size={12} />
                        </Link>
                      </div>

                      <div className="p-3 bg-[var(--badge-orange-bg)] border border-[var(--badge-orange-text)]/20 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase text-[var(--badge-orange-text)] tracking-wider block">
                            Customer Receivables
                          </span>
                          <span className="text-xs font-bold text-[var(--text-primary)] mt-0.5 block">
                            {data.remindersSummary?.receivables?.total_overdue ?? receivablesReminders?.stats?.total_overdue ?? 0} Bills Overdue
                          </span>
                        </div>
                        <span className="text-sm font-extrabold text-[var(--badge-orange-text)] font-mono">
                          {formatCurrency(data.remindersSummary?.receivables?.total_outstanding ?? receivablesReminders?.stats?.total_outstanding ?? 0)}
                        </span>
                      </div>

                      <div className="p-3 bg-[var(--badge-blue-bg)] border border-[var(--badge-blue-text)]/20 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase text-[var(--badge-blue-text)] tracking-wider block">
                            Supplier Payables
                          </span>
                          <span className="text-xs font-bold text-[var(--text-primary)] mt-0.5 block">
                            {data.remindersSummary?.payables?.total_overdue ?? payablesReminders?.stats?.total_overdue ?? 0} Bills Pending
                          </span>
                        </div>
                        <span className="text-sm font-extrabold text-[var(--badge-blue-text)] font-mono">
                          {formatCurrency(data.remindersSummary?.payables?.total_outstanding ?? payablesReminders?.stats?.total_outstanding ?? 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Tab: Accounts ── */}
                {mobileTab === "accounts" && (
                  <div className="space-y-4">
                    {/* Bank Balances */}
                    <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-sm)] p-4">
                      <h3 className="text-xs font-bold text-[var(--text-primary)] border-b border-[var(--border)] pb-2 mb-3">
                        Accounts Balance
                      </h3>
                      <div className="space-y-2.5 divide-y divide-[var(--border)]">
                        {bankBalances.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs pt-2.5 first:pt-0">
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              <span className="w-8 h-8 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0">
                                {item.type === "bank" ? <Building2 size={14} /> : item.type === "cash" ? <Wallet size={14} /> : <Smartphone size={14} />}
                              </span>
                              <div className="overflow-hidden">
                                <p className="font-bold text-[var(--text-primary)] truncate">{item.name}</p>
                                <p className="text-[9px] text-[var(--text-muted)] font-bold uppercase truncate">
                                  {item.type === "bank" ? item.bank_name || "Bank Account" : item.type === "cash" ? "Cash in Hand" : item.upi_provider || "UPI"}
                                </p>
                              </div>
                            </div>
                            <span className="font-extrabold text-[var(--text-primary)] font-mono shrink-0 text-right">
                              {formatCurrency(item.current_balance ?? item.opening_balance ?? 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Godown Stock */}
                    <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-sm)] p-4">
                      <h3 className="text-xs font-bold text-[var(--text-primary)] border-b border-[var(--border)] pb-2 mb-3">
                        Godown Stock Value
                      </h3>
                      <div className="space-y-2">
                        {godownStock.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="text-[var(--text-primary)] font-semibold truncate max-w-[150px]">{item.name}</span>
                            <div className="text-right shrink-0">
                              <p className="font-bold text-[var(--text-primary)]">{formatCurrency(item.value)}</p>
                              <p className="text-[9px] text-[var(--text-muted)] font-bold uppercase">{item.pieces} pcs</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </PullToRefresh>
          </div>

            {/* ══════════════════════════════════════════════════════════════════
                DESKTOP VIEW (>= md): Full Responsive Grid
                ══════════════════════════════════════════════════════════════════ */}
            <div className="hidden md:block space-y-6">
              {/* Row 1: KPI Cards Grid */}
              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
              >
                <KPICard
                  title="Total Stock Value"
                  value={formatCurrency(kpis.totalStockValue.value)}
                  change={kpis.totalStockValue.change}
                  positive={kpis.totalStockValue.positive}
                  icon={ShoppingBag}
                  iconBgClass="bg-[var(--primary-light)] text-[var(--primary)]"
                />

                <KPICard
                  title="Today's Sales"
                  value={formatCurrency(kpis.todaySales.value)}
                  change={kpis.todaySales.change}
                  positive={kpis.todaySales.positive}
                  icon={IndianRupee}
                  iconBgClass="bg-[var(--badge-green-bg)] text-[var(--badge-green-text)]"
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
                  iconBgClass="bg-[var(--badge-orange-bg)] text-[var(--badge-orange-text)]"
                />

                <KPICard
                  title="Pending Dues"
                  value={formatCurrency(kpis.pendingDues.value)}
                  change={kpis.pendingDues.change}
                  positive={kpis.pendingDues.positive}
                  icon={UserCircle}
                  iconBgClass="bg-[var(--badge-red-bg)] text-[var(--badge-red-text)]"
                  inverseColorDirection={true}
                />

                <KPICard
                  title="Cash in Hand"
                  value={formatCurrency(kpis.cashInHand.value)}
                  change={kpis.cashInHand.change}
                  positive={kpis.cashInHand.positive}
                  icon={Wallet}
                  iconBgClass="bg-[var(--badge-purple-bg)] text-[var(--badge-purple-text)]"
                />
              </motion.div>

              {/* Row 2: Quick Actions */}
              <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] shadow-[var(--shadow-sm)] p-5">
                <h3 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border)] pb-2.5 mb-4">
                  Quick Actions
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  <QuickActionCard
                    label="Add Sale"
                    subtitle="Create Bill"
                    icon={ShoppingCart}
                    iconColorClass="text-[var(--primary)]"
                    iconBgClass="bg-[var(--primary-light)]"
                    href="/sales/bills/new"
                  />
                  <QuickActionCard
                    label="New Lot"
                    subtitle="Start Batch"
                    icon={Factory}
                    iconColorClass="text-[var(--badge-purple-text)]"
                    iconBgClass="bg-[var(--badge-purple-bg)]"
                    href="/production/lots/new"
                  />
                  <QuickActionCard
                    label="Receive Payment"
                    subtitle="Party Receipt"
                    icon={CreditCard}
                    iconColorClass="text-[var(--badge-green-text)]"
                    iconBgClass="bg-[var(--badge-green-bg)]"
                    href="/payments/receive"
                  />
                  <QuickActionCard
                    label="Record Expense"
                    subtitle="General Voucher"
                    icon={Receipt}
                    iconColorClass="text-[var(--badge-orange-text)]"
                    iconBgClass="bg-[var(--badge-orange-bg)]"
                    href="/expenses/new"
                  />
                  <QuickActionCard
                    label="Scan QR Code"
                    subtitle="PWA Scanner"
                    icon={BarChart3}
                    iconColorClass="text-emerald-500"
                    iconBgClass="bg-emerald-500/10"
                    href="/scan"
                  />
                  <QuickActionCard
                    label="Party Ledger"
                    subtitle="View Statement"
                    icon={UserCircle}
                    iconColorClass="text-[var(--badge-orange-text)]"
                    iconBgClass="bg-[var(--badge-orange-bg)]"
                    href="/parties"
                  />
                </div>
              </div>

              {/* Row 3: Production Donut & Lists */}
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
                    {productionDonut.length > 0 ? (
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
                              background: chartTheme.tooltipBg,
                              color: chartTheme.text,
                              borderRadius: "8px",
                              border: `1px solid ${chartTheme.tooltipBorder}`,
                              fontSize: "11px",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="w-36 h-36 rounded-full border-2 border-dashed border-[var(--border)] flex items-center justify-center">
                        <span className="text-[11px] font-semibold text-[var(--text-muted)] text-center px-2">
                          No active lots
                        </span>
                      </div>
                    )}

                    {/* Inner Label */}
                    {productionDonut.length > 0 && (
                      <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                        <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                          Total Lots
                        </span>
                        <span className="text-2xl font-extrabold text-[var(--text-primary)] mt-0.5">
                          {productionDonut.reduce((sum, item) => sum + item.value, 0)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Donut Legend */}
                  {productionDonut.length > 0 && (
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
                  )}
                </div>

                {/* Low Stock Alerts */}
                <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] shadow-[var(--shadow-sm)] p-5 flex flex-col">
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-3">
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">Low Stock Alerts</h3>
                    <span className="h-6 px-2 rounded-md bg-[var(--badge-red-bg)] text-[var(--badge-red-text)] text-[10px] font-bold uppercase flex items-center justify-center">
                      Action Required
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)] space-y-3">
                    {isLowStockAlertsEnabled && Array.isArray(lowStockAlerts) && lowStockAlerts.length > 0 ? (
                      lowStockAlerts.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between pt-3 first:pt-0 gap-3">
                          <div className="flex items-start gap-2.5 overflow-hidden">
                            <div className="w-8 h-8 rounded-lg bg-[var(--badge-orange-bg)] text-[var(--badge-orange-text)] flex items-center justify-center shrink-0">
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
                            <p className="text-xs font-bold text-[var(--badge-red-text)]">{item.qty}</p>
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
                    <div className="p-3 bg-[var(--badge-orange-bg)] border border-[var(--badge-orange-text)]/20 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase text-[var(--badge-orange-text)] tracking-wider block">
                          Customer Receivables
                        </span>
                        <span className="text-xs font-bold text-[var(--text-primary)] mt-0.5 block">
                          {data.remindersSummary?.receivables?.total_overdue ?? receivablesReminders?.stats?.total_overdue ?? 0} Bills Overdue
                        </span>
                      </div>
                      <span className="text-sm font-extrabold text-[var(--badge-orange-text)] font-mono">
                        {formatCurrency(data.remindersSummary?.receivables?.total_outstanding ?? receivablesReminders?.stats?.total_outstanding ?? 0)}
                      </span>
                    </div>

                    {/* Vendor Payables Summary */}
                    <div className="p-3 bg-[var(--badge-blue-bg)] border border-[var(--badge-blue-text)]/20 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase text-[var(--badge-blue-text)] tracking-wider block">
                          Supplier Payables
                        </span>
                        <span className="text-xs font-bold text-[var(--text-primary)] mt-0.5 block">
                          {data.remindersSummary?.payables?.total_overdue ?? payablesReminders?.stats?.total_overdue ?? 0} Bills Pending
                        </span>
                      </div>
                      <span className="text-sm font-extrabold text-[var(--badge-blue-text)] font-mono">
                        {formatCurrency(data.remindersSummary?.payables?.total_outstanding ?? payablesReminders?.stats?.total_outstanding ?? 0)}
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

              {/* Row 4: Sales Trend & Balances */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sales Trend Line Chart */}
                <div className="lg:col-span-2 bg-[var(--card-bg)] rounded-xl border border-[var(--border)] shadow-[var(--shadow-sm)] p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-3">
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">Sales Trend</h3>
                    <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                      {dateRange === "today"
                        ? "Today"
                        : dateRange === "this_week"
                        ? "This Week"
                        : dateRange === "last_month"
                        ? "Last Month"
                        : dateRange === "this_year"
                        ? "Fiscal Year"
                        : new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </div>
                  </div>

                  <div className="h-56 w-full my-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={salesChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: chartTheme.axisText, fontSize: 10, fontWeight: 600 }}
                          dy={10}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(val) => `₹${val / 1000}k`}
                          tick={{ fill: chartTheme.axisText, fontSize: 10, fontWeight: 600 }}
                          dx={-10}
                        />
                        <Tooltip
                          formatter={(value) => [formatCurrency(Number(value)), "Sales"]}
                          contentStyle={{
                            background: chartTheme.tooltipBg,
                            color: chartTheme.text,
                            borderRadius: "8px",
                            border: `1px solid ${chartTheme.tooltipBorder}`,
                            fontSize: "11px",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="sales"
                          stroke="var(--primary)"
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
                            <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[var(--primary-light)] text-[var(--primary)]">
                              {item.type === "bank" ? (
                                <Building2 size={13} />
                              ) : item.type === "cash" ? (
                                <Wallet size={13} />
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
                                  : item.type === "cash"
                                  ? "Cash in Hand"
                                  : item.upi_provider || "UPI"}
                              </p>
                            </div>
                          </div>
                          <span className="font-extrabold text-[var(--text-primary)] shrink-0 text-right">
                            {formatCurrency(item.current_balance ?? item.opening_balance ?? 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </PageState>
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
    <motion.div
      variants={cardVariants}
      whileHover={hoverLift.hover}
      className="bg-[var(--card-bg)] rounded-xl p-5 border border-[var(--border)] shadow-[var(--shadow-sm)] flex items-start justify-between select-none cursor-default"
    >
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
    </motion.div>
  );
}

// Subcomponents helper - Mobile KPI Card (Snap Horizontal Carousel)
function MobileKPICard({
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
    <div className="w-full bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-3 shadow-xs flex flex-col justify-between select-none">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-extrabold text-[var(--text-muted)] uppercase tracking-wider truncate">
          {title}
        </span>
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", iconBgClass)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="mt-2.5">
        <div className="text-base font-black text-[var(--text-primary)] tracking-tight truncate">
          {value}
        </div>
        {change !== 0 && (
          <div className="flex items-center gap-1 mt-0.5">
            <span
              className={cn(
                "text-[10px] font-bold",
                isWorse ? "text-[var(--badge-red-text)]" : "text-[var(--badge-green-text)]"
              )}
            >
              {isWorse ? "-" : "+"}
              {change}%
            </span>
            <span className="text-[9px] text-[var(--text-faint)] font-medium">vs mo</span>
          </div>
        )}
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
