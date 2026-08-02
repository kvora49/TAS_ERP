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

export default function RawMaterialStockPage() {
  const router = useRouter();
  const { lowStockAlerts, itemsPerPage, formatAppDate, formatAppCurrency } = useGeneralSettings();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [godownFilter, setGodownFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"summary" | "entries">("summary");

  // React Query fetch Stock Summary
  const { data: stockData, isLoading: loadingSummary, error: summaryError } = useQuery<{ stock: StockSummary[] }>({
    queryKey: ["raw-material-stock-summary", godownFilter],
    staleTime: 30_000,
    queryFn: async () => {
      const gId = godownFilter === "all" ? "" : godownFilter;
      const res = await fetch(`/api/raw-materials/stock?view=summary&godown_id=${gId}`);
      if (!res.ok) throw new Error("Failed to load stock summary");
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
  const entriesList = entriesData?.entries || [];

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
      <PageHeader
        title="Raw Material Inventory Stock"
        subtitle="Real-time raw material balances, fabric inventory roll logs, and stock movements."
        actionLabel="Direct Stock Entry / Adjustment"
        onAction={() => router.push("/stock/raw-materials/new")}
      />

      {/* KPI STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-[#6366F1] rounded-lg">
            <Boxes className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Total Raw Stock Value</span>
            <p className="text-xl font-extrabold text-[#0F172A] mt-0.5">{formatCurrency(totalStockValue)}</p>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Active Material Types</span>
            <p className="text-xl font-extrabold text-[#0F172A] mt-0.5">{totalItemsCount} Types</p>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Low Stock Alerts</span>
            <p className="text-xl font-extrabold text-amber-600 mt-0.5">{lowStockCount} Items</p>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
            <TrendingDown className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Out of Stock</span>
            <p className="text-xl font-extrabold text-rose-600 mt-0.5">{outOfStockCount} Items</p>
          </div>
        </div>
      </div>

      {/* VISUAL CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm lg:col-span-2">
          <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-4">Stock Valuation Breakdown by Material Category</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData}>
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(v) => `₹${v / 1000}k`} />
                <ChartTooltip formatter={(value: any) => [formatCurrency(Number(value)), "Stock Value"]} />
                <Bar dataKey="value" fill="#6366F1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-4">Category Distribution Share</h3>
          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip formatter={(value: any) => [formatCurrency(Number(value)), "Stock Value"]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* FILTER & TAB CONTROLS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-[#E2E8F0] p-4 rounded-xl shadow-sm">
        <div className="flex items-center gap-2 bg-[#F1F5F9] p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("summary")}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
              activeTab === "summary" ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            Summary Inventory Balances
          </button>
          <button
            onClick={() => setActiveTab("entries")}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
              activeTab === "entries" ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            Stock Movement Registers
          </button>
        </div>

        {activeTab === "summary" && (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
              <input
                type="text"
                placeholder="Search raw material..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-[#CBD5E1] rounded-lg text-xs focus:ring-2 focus:ring-[#6366F1] focus:outline-none"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-[#CBD5E1] rounded-lg text-xs font-semibold text-[#334155] bg-white focus:ring-2 focus:ring-[#6366F1]"
            >
              <option value="all">All Categories</option>
              <option value="fabric">Fabric</option>
              <option value="accessory">Accessory</option>
              <option value="packaging">Packaging</option>
            </select>
          </div>
        )}
      </div>

      {/* DATA TABLES */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
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
      </div>
    </div>
  );
}
