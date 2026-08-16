"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { Badge, BadgeVariant } from "@/components/shared/Badge";
import { Search, Plus, Boxes, Layers, TrendingDown, AlertTriangle, ArrowLeftRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface StockSummary {
  id: string;
  material_type_id: string;
  godown_id: string;
  opening_stock: number;
  inward_qty: number;
  outward_qty: number;
  current_stock: number;
  unit_cost: number;
  stock_value: number;
  status: "in_stock" | "low_stock" | "out_of_stock";
  material_type?: {
    name: string;
    category: string;
    unit: string;
    reorder_level: number;
  };
  godown?: {
    name: string;
  };
}

interface StockEntry {
  id: string;
  stock_entry_number: string;
  entry_type: "stock_in" | "stock_out" | "adjustment";
  posting_date: string;
  reference_no: string | null;
  remarks: string | null;
  grand_total: number;
  status: "active" | "cancelled";
  godown?: {
    name: string;
  };
}

import { useGeneralSettings } from "@/hooks/useGeneralSettings";
import { useChartTheme } from "@/hooks/useChartTheme";

export default function RawMaterialStockPage() {
  const router = useRouter();
  const { lowStockAlerts, itemsPerPage, formatAppDate, formatAppCurrency } = useGeneralSettings();
  const chartTheme = useChartTheme();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [godownFilter, setGodownFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"summary" | "rolls" | "entries">("summary");

  // React Query fetch Stock Summary
  const { data: stockData, isLoading: loadingSummary, error: summaryError } = useQuery<{ stock: StockSummary[] }>({
    queryKey: ["raw-material-stock-summary", godownFilter],
    staleTime: 0,
    queryFn: async () => {
      const gId = godownFilter === "all" ? "" : godownFilter;
      const res = await fetch(`/api/raw-materials/stock?view=summary&godown_id=${gId}`);
      if (!res.ok) throw new Error("Failed to load stock summary");
      return res.json();
    },
  });

  // React Query fetch Fabric Rolls
  const { data: rollsData, isLoading: loadingRolls, error: rollsError } = useQuery<{ rolls: any[] }>({
    queryKey: ["raw-material-fabric-rolls", gradeFilter, search],
    staleTime: 10_000,
    enabled: activeTab === "rolls",
    queryFn: async () => {
      const gParam = gradeFilter ? encodeURIComponent(gradeFilter) : "";
      const sParam = search ? encodeURIComponent(search) : "";
      const res = await fetch(`/api/production/lots/available-rolls?grade=${gParam}&search=${sParam}`);
      if (!res.ok) throw new Error("Failed to load fabric rolls");
      return res.json();
    },
  });

  // React Query fetch Stock Entries
  const { data: entriesData, isLoading: loadingEntries, error: entriesError } = useQuery<{ entries: StockEntry[] }>({
    queryKey: ["raw-material-stock-entries"],
    staleTime: 30_000,
    enabled: activeTab === "entries",
    queryFn: async () => {
      const res = await fetch(`/api/raw-materials/stock?view=entries`);
      if (!res.ok) throw new Error("Failed to load stock entries");
      return res.json();
    },
  });

  const stockList = stockData?.stock || [];
  const rollsList = rollsData?.rolls || [];
  const entriesList = entriesData?.entries || [];

  // Extract unique grades from rolls for the grade filter dropdown
  const uniqueRollGrades = Array.from(
    new Set(
      rollsList
        .map((r: any) => (r.grade || r.item?.grade || "").trim())
        .filter(Boolean)
    )
  );

  const formatCurrency = (val: number) => {
    return formatAppCurrency(val);
  };

  // Aggregated KPIs
  const totalStockValue = stockList.reduce((sum, item) => sum + (item.stock_value || 0), 0);
  const totalItemsCount = stockList.length;
  const lowStockCount = stockList.filter((item) => item.status === "low_stock").length;
  const outOfStockCount = stockList.filter((item) => item.status === "out_of_stock").length;

  // Chart Data preparation
  const categoryData = stockList.reduce((acc: any[], item) => {
    const cat = item.material_type?.category || "Unassigned";
    const existing = acc.find((c) => c.name === cat);
    if (existing) {
      existing.value += item.stock_value || 0;
    } else {
      acc.push({ name: cat, value: item.stock_value || 0 });
    }
    return acc;
  }, []);

  const COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6", "#3B82F6"];

  const filteredStock = stockList.filter((item) => {
    const nameMatch = item.material_type?.name?.toLowerCase().includes(search.toLowerCase());
    const catMatch = categoryFilter === "all" || item.material_type?.category === categoryFilter;
    return nameMatch && catMatch;
  });

  const columns: DataTableColumn<StockSummary>[] = [
    {
      key: "material_name",
      header: "Material / Fabric Name",
      width: "240px",
      render: (row) => (
        <div
          className="cursor-pointer group"
          onClick={() => row.material_type_id && router.push(`/master-data/raw-materials/${row.material_type_id}`)}
        >
          <span className="font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors block">
            {row.material_type?.name || "—"}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block">
            {row.material_type?.category || "—"}
          </span>
        </div>
      ),
    },
    {
      key: "godown",
      header: "Godown Location",
      width: "160px",
      render: (row) => (
        <span className="font-semibold text-xs text-[var(--text-body)] whitespace-nowrap">
          {row.godown?.name || "Main Warehouse"}
        </span>
      ),
    },
    {
      key: "current_stock",
      header: "Available Stock",
      width: "150px",
      render: (row) => (
        <span className="font-bold text-[var(--text-primary)] whitespace-nowrap">
          {row.current_stock} {row.material_type?.unit || "meter"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Stock Alert",
      width: "120px",
      render: (row) => {
        let variant: BadgeVariant = "green";
        let label = "In Stock";
        if (row.status === "out_of_stock") {
          variant = "red";
          label = "Out of Stock";
        } else if (row.status === "low_stock") {
          variant = "orange";
          label = "Low Stock";
        }
        return (
          <Badge variant={variant} className="font-bold text-[10px] whitespace-nowrap">
            {label}
          </Badge>
        );
      },
    },
    {
      key: "unit_cost",
      header: "Unit Cost",
      width: "130px",
      render: (row) => <span className="font-mono text-xs font-semibold text-[var(--text-body)] whitespace-nowrap">{formatCurrency(row.unit_cost)}</span>,
    },
    {
      key: "stock_value",
      header: "Stock Value",
      width: "150px",
      render: (row) => <span className="font-mono text-xs font-bold text-[var(--text-primary)] whitespace-nowrap">{formatCurrency(row.stock_value)}</span>,
    },
    {
      key: "actions",
      header: "Action",
      width: "180px",
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (row.material_type_id) {
              router.push(`/master-data/raw-materials/${row.material_type_id}`);
            }
          }}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#EEF2FF] dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
        >
          View Details & Aging <ChevronRight className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  const rollColumns: DataTableColumn<any>[] = [
    {
      key: "roll_number",
      header: "Roll No",
      width: "120px",
      render: (row) => (
        <span className="font-mono font-bold text-[var(--primary)] bg-[var(--primary-light)] px-2.5 py-1 rounded-md text-xs">
          #{row.roll_number}
        </span>
      ),
    },
    {
      key: "material_name",
      header: "Material / Fabric",
      width: "200px",
      render: (row) => (
        <div>
          <span className="font-bold text-[var(--text-primary)] block">
            {row.item?.material_type?.name || "Fabric"}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block">
            {row.item?.material_type?.category || "Fabric"}
          </span>
        </div>
      ),
    },
    {
      key: "design_name",
      header: "Design Name",
      width: "160px",
      render: (row) => {
        const des = row.design_name || row.item?.design_name;
        return des ? (
          <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] rounded-md font-semibold">
            {des}
          </span>
        ) : (
          <span className="text-[var(--text-faint)] text-xs">—</span>
        );
      },
    },
    {
      key: "grade",
      header: "Grade",
      width: "130px",
      render: (row) => {
        const g = row.grade || row.item?.grade || "Fresh";
        return (
          <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-md text-xs font-bold">
            {g}
          </span>
        );
      },
    },
    {
      key: "meters",
      header: "Available / Total",
      width: "160px",
      render: (row) => (
        <div className="font-mono text-xs">
          <span className="font-bold text-[var(--text-primary)]">{row.remaining_meters}m</span>
          <span className="text-[var(--text-muted)] text-[11px] ml-1">/ {row.meters}m</span>
        </div>
      ),
    },
    {
      key: "shade",
      header: "Shade & Specs",
      width: "140px",
      render: (row) => (
        <div className="text-xs text-[var(--text-body)]">
          {row.shade && <span className="font-semibold block">Shade: {row.shade}</span>}
          {row.width && <span className="text-[10px] text-[var(--text-muted)] block">Width: {row.width}&quot;</span>}
          {!row.shade && !row.width && <span className="text-[var(--text-faint)]">—</span>}
        </div>
      ),
    },
    {
      key: "godown",
      header: "Godown",
      width: "140px",
      render: (row) => (
        <span className="text-xs text-[var(--text-body)] font-medium">
          {row.item?.purchase?.godown?.name || "Main Godown"}
        </span>
      ),
    },
    {
      key: "purchase",
      header: "Purchase Ref",
      width: "160px",
      render: (row) => (
        <div>
          <span className="font-mono text-xs text-[var(--primary)] font-semibold block">
            {row.item?.purchase?.purchase_number || "—"}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] truncate block">
            {row.item?.purchase?.supplier?.company_name || row.item?.purchase?.supplier?.name || "—"}
          </span>
        </div>
      ),
    },
  ];

  const entryColumns: DataTableColumn<StockEntry>[] = [
    {
      key: "stock_entry_number",
      header: "Stock Entry ID",
      width: "220px",
      render: (row) => (
        <Link
          href={`/stock/raw-materials/${row.id}`}
          className="font-mono font-bold text-xs text-[#6366F1] hover:underline whitespace-nowrap"
        >
          {row.stock_entry_number}
        </Link>
      ),
    },
    {
      key: "posting_date",
      header: "Posting Date",
      width: "120px",
      render: (row) => <span className="font-mono text-xs font-semibold whitespace-nowrap">{formatDate(row.posting_date)}</span>,
    },
    {
      key: "entry_type",
      header: "Movement Type",
      width: "140px",
      render: (row) => {
        let variant: BadgeVariant = "blue";
        if (row.entry_type === "stock_in") variant = "green";
        if (row.entry_type === "stock_out") variant = "red";

        return (
          <Badge variant={variant} className="uppercase text-[10px] font-bold">
            {row.entry_type.replace("_", " ")}
          </Badge>
        );
      },
    },
    {
      key: "godown",
      header: "Target Godown",
      width: "160px",
      render: (row) => <span className="text-xs text-[#334155] font-semibold">{row.godown?.name || "Main Godown"}</span>,
    },
    {
      key: "grand_total",
      header: "Valuation Amount",
      width: "140px",
      render: (row) => <span className="font-mono text-xs font-bold text-[#0F172A]">{formatCurrency(row.grand_total)}</span>,
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Raw Material Inventory Stock</h1>
          <p className="text-xs text-[var(--text-muted)]">Real-time raw material balances, fabric inventory roll logs, and stock movements.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/stock/raw-materials/transfers/new"
            className="flex items-center gap-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-md"
          >
            <ArrowLeftRight className="h-4 w-4" />
            <span>Godown Transfer</span>
          </Link>
          <button
            onClick={() => router.push("/stock/raw-materials/new")}
            className="flex items-center gap-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span>Direct Stock Entry / Adjustment</span>
          </button>
        </div>
      </div>

      {/* ── MOBILE: snap-scroll KPI cards ── */}
      <div className="md:hidden flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 scrollbar-none">
        {[
          { label: "Stock Value",  value: formatCurrency(totalStockValue), icon: Boxes,         bg: "bg-[var(--primary-light)]", color: "text-[var(--primary)]" },
          { label: "Mat. Types",   value: `${totalItemsCount} Types`,       icon: Layers,        bg: "bg-emerald-500/10",          color: "text-emerald-600" },
          { label: "Low Stock",    value: `${lowStockCount} Items`,          icon: AlertTriangle, bg: "bg-amber-500/10",            color: "text-amber-600" },
          { label: "Out of Stock", value: `${outOfStockCount} Items`,        icon: TrendingDown,  bg: "bg-rose-500/10",             color: "text-rose-600" },
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

      {/* ── DESKTOP: 4-col KPI stat grid ── */}
      <div className="hidden md:grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)] flex items-center gap-4">
          <div className="p-3 bg-[var(--primary-light)] text-[var(--primary)] rounded-lg"><Boxes className="h-6 w-6" /></div>
          <div>
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Total Raw Stock Value</span>
            <p className="text-xl font-extrabold text-[var(--text-primary)] mt-0.5">{formatCurrency(totalStockValue)}</p>
          </div>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)] flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-lg"><Layers className="h-6 w-6" /></div>
          <div>
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Active Material Types</span>
            <p className="text-xl font-extrabold text-[var(--text-primary)] mt-0.5">{totalItemsCount} Types</p>
          </div>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)] flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 text-amber-600 rounded-lg"><AlertTriangle className="h-6 w-6" /></div>
          <div>
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Low Stock Alerts</span>
            <p className="text-xl font-extrabold text-amber-600 mt-0.5">{lowStockCount} Items</p>
          </div>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)] flex items-center gap-4">
          <div className="p-3 bg-rose-500/10 text-rose-600 rounded-lg"><TrendingDown className="h-6 w-6" /></div>
          <div>
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Out of Stock</span>
            <p className="text-xl font-extrabold text-rose-600 mt-0.5">{outOfStockCount} Items</p>
          </div>
        </div>
      </div>

      {/* VISUAL CHARTS SECTION - desktop only to avoid overwhelming mobile */}
      <div className="hidden md:grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] lg:col-span-2">
          <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-4">Stock Valuation Breakdown by Material Category</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData}>
                <XAxis dataKey="name" stroke={chartTheme.axisText} fontSize={11} />
                <YAxis stroke={chartTheme.axisText} fontSize={11} tickFormatter={(v) => `₹${v / 1000}k`} />
                <ChartTooltip
                  formatter={(value: any) => [formatCurrency(Number(value)), "Stock Value"]}
                  contentStyle={{
                    backgroundColor: chartTheme.tooltipBg,
                    borderColor: chartTheme.tooltipBorder,
                    color: chartTheme.text,
                  }}
                />
                <Bar dataKey="value" fill="#6366F1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)]">
          <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-4">Category Distribution Share</h3>
          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip
                  formatter={(value: any) => [formatCurrency(Number(value)), "Stock Value"]}
                  contentStyle={{
                    backgroundColor: chartTheme.tooltipBg,
                    borderColor: chartTheme.tooltipBorder,
                    color: chartTheme.text,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* FILTER & TAB CONTROLS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[var(--card-bg)] border border-[var(--border)] p-4 rounded-xl shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-2 bg-[var(--page-bg)] p-1 rounded-lg w-full sm:w-auto overflow-x-auto">
          <button onClick={() => setActiveTab("summary")}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all shrink-0 ${
              activeTab === "summary" ? "bg-[var(--card-bg)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >Summary Balances</button>
          <button onClick={() => setActiveTab("rolls")}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all shrink-0 ${
              activeTab === "rolls" ? "bg-[var(--card-bg)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >Fabric Rolls Tracking</button>
          <button onClick={() => setActiveTab("entries")}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all shrink-0 ${
              activeTab === "entries" ? "bg-[var(--card-bg)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >Stock Movements</button>
        </div>

        {activeTab === "summary" && (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-faint)]" />
              <input type="text" placeholder="Search raw material..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-xs focus:ring-2 focus:ring-[var(--input-focus)] focus:outline-none"
              />
            </div>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[var(--input-focus)]"
            >
              <option value="all">All Categories</option>
              <option value="fabric">Fabric</option>
              <option value="accessory">Accessory</option>
              <option value="packaging">Packaging</option>
            </select>
          </div>
        )}

        {activeTab === "rolls" && (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-faint)]" />
              <input
                type="text"
                placeholder="Search by Design, Roll No, Material..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-xs focus:ring-2 focus:ring-[var(--input-focus)] focus:outline-none"
              />
            </div>
            <div className="w-full sm:w-48">
              <input
                type="text"
                placeholder="Filter by Grade..."
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[var(--input-focus)] focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── MOBILE: stock card list ── */}
      {activeTab === "summary" ? (
        <div className="md:hidden space-y-3">
          {filteredStock.map((row) => {
            let statusBg = "bg-emerald-500/10"; let statusColor = "text-emerald-600"; let statusLabel = "In Stock";
            if (row.status === "low_stock") { statusBg = "bg-amber-500/10"; statusColor = "text-amber-600"; statusLabel = "Low Stock"; }
            if (row.status === "out_of_stock") { statusBg = "bg-rose-500/10"; statusColor = "text-rose-600"; statusLabel = "Out of Stock"; }
            return (
              <div key={row.id}
                className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden active:bg-[var(--table-row-hover)] cursor-pointer transition-colors"
                onClick={() => row.material_type_id && router.push(`/master-data/raw-materials/${row.material_type_id}`)}
              >
                <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                  <div className="min-w-0 mr-2">
                    <p className="font-semibold text-[var(--text-primary)] text-sm truncate">{row.material_type?.name || "—"}</p>
                    <p className="text-[11px] text-[var(--text-muted)] capitalize mt-0.5">{row.material_type?.category} &bull; {row.material_type?.unit}</p>
                  </div>
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0", statusBg, statusColor)}>{statusLabel}</span>
                </div>
                <div className="grid grid-cols-3 border-t border-[var(--border-light)] mx-4 py-2">
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Current</p>
                    <p className="text-xs font-bold mt-0.5 text-[var(--text-primary)]">{row.current_stock} {row.material_type?.unit}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Unit Cost</p>
                    <p className="text-xs font-bold mt-0.5 text-[var(--text-body)]">{formatCurrency(row.unit_cost)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Value</p>
                    <p className="text-xs font-bold mt-0.5 text-[var(--text-primary)]">{formatCurrency(row.stock_value)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between px-4 pb-3 border-t border-[var(--border-light)] pt-2">
                  <span className="text-[11px] text-[var(--text-muted)]">{row.godown?.name || "Main Godown"}</span>
                  <button type="button"
                    onClick={(e) => { e.stopPropagation(); row.material_type_id && router.push(`/master-data/raw-materials/${row.material_type_id}`); }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--primary-light)] text-[var(--primary)] text-[11px] font-bold rounded-lg"
                  >View Details <ChevronRight className="w-3 h-3" /></button>
                </div>
              </div>
            );
          })}
        </div>
      ) : activeTab === "rolls" ? (
        <div className="md:hidden space-y-3">
          {rollsList.map((row) => {
            const g = row.grade || row.item?.grade || "Fresh";
            const des = row.design_name || row.item?.design_name;
            return (
              <div key={row.id} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-[var(--primary)] bg-[var(--primary-light)] px-2 py-0.5 rounded">
                    Roll #{row.roll_number}
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded text-[10px] font-bold">
                    Grade: {g}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-[var(--text-primary)] text-sm">{row.item?.material_type?.name || "Fabric"}</p>
                  {des && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-0.5">
                      Design: <strong>{des}</strong>
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-[var(--border-light)] pt-2 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase">Available</span>
                    <p className="font-mono font-bold text-[var(--text-primary)]">{row.remaining_meters}m <span className="text-[var(--text-muted)] font-normal">/ {row.meters}m</span></p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase">Godown</span>
                    <p className="font-medium text-[var(--text-body)] truncate">{row.item?.purchase?.godown?.name || "Main Godown"}</p>
                  </div>
                </div>
              </div>
            );
          })}
          {rollsList.length === 0 && !loadingRolls && (
            <div className="py-8 text-center text-xs text-[var(--text-muted)]">No fabric rolls found matching filter.</div>
          )}
        </div>
      ) : (
        <div className="md:hidden space-y-3">
          {entriesList.map((row) => (
            <Link key={row.id} href={`/stock/raw-materials/${row.id}`}
              className="block bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden active:bg-[var(--table-row-hover)] transition-colors"
            >
              <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                <span className="font-mono font-black text-[var(--primary)] text-sm">{row.stock_entry_number}</span>
                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                  row.entry_type === "stock_in" ? "bg-emerald-500/10 text-emerald-600" :
                  row.entry_type === "stock_out" ? "bg-rose-500/10 text-rose-500" :
                  "bg-blue-500/10 text-blue-600"
                )}>{row.entry_type.replace("_", " ")}</span>
              </div>
              <div className="grid grid-cols-3 border-t border-[var(--border-light)] mx-4 py-2">
                <div>
                  <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Date</p>
                  <p className="text-xs font-bold mt-0.5 text-[var(--text-primary)]">{formatDate(row.posting_date)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Godown</p>
                  <p className="text-xs font-semibold mt-0.5 text-[var(--text-body)] truncate">{row.godown?.name || "Main"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Value</p>
                  <p className="text-xs font-bold mt-0.5 text-[var(--text-primary)]">{formatCurrency(row.grand_total)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── DESKTOP: Data Tables ── */}
      <div className="hidden md:block bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
        {activeTab === "summary" ? (
          <DataTable
            columns={columns}
            data={filteredStock}
            isLoading={loadingSummary}
            total={filteredStock.length}
            page={1}
            perPage={1000}
            onPageChange={() => {}}
            onRowClick={(row) => row.material_type_id && router.push(`/master-data/raw-materials/${row.material_type_id}`)}
            emptyMessage="No raw material stock records found."
          />
        ) : activeTab === "rolls" ? (
          <DataTable
            columns={rollColumns}
            data={rollsList}
            isLoading={loadingRolls}
            total={rollsList.length}
            page={1}
            perPage={1000}
            onPageChange={() => {}}
            emptyMessage="No fabric rolls found in inventory matching search/grade filter."
          />
        ) : (
          <DataTable
            columns={entryColumns}
            data={entriesList}
            isLoading={loadingEntries}
            total={entriesList.length}
            page={1}
            perPage={1000}
            onPageChange={() => {}}
            emptyMessage="No stock entry movements recorded."
          />
        )}
      </div>{/* end desktop table */}
    </div>
  );
}
