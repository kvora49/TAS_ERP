"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { Badge, BadgeVariant } from "@/components/shared/Badge";
import { Search, Plus, Boxes, Layers, TrendingDown, AlertTriangle, ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
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

interface Stats {
  totalItems: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  movementCount: number;
}

export default function StockOverviewPage() {
  const router = useRouter();
  const [activeView, setActiveView] = useState<"summary" | "entries">("summary");
  const [search, setSearch] = useState("");
  const [godownFilter, setGodownFilter] = useState("");

  const { data: stockSummaryData, isLoading: summaryLoading } = useQuery<StockSummary[]>({
    queryKey: ["stock", "summary", godownFilter],
    queryFn: async () => {
      const res = await fetch(`/api/raw-materials/stock?view=summary&godown_id=${godownFilter}`);
      if (!res.ok) throw new Error("Failed to fetch stock summary");
      const data = await res.json();
      return data.stock || [];
    }
  });

  const { data: stockEntriesData, isLoading: entriesLoading } = useQuery<StockEntry[]>({
    queryKey: ["stock", "entries", godownFilter],
    queryFn: async () => {
      const res = await fetch(`/api/raw-materials/stock?view=entries&godown_id=${godownFilter}`);
      if (!res.ok) throw new Error("Failed to fetch stock entries");
      const data = await res.json();
      return data.entries || [];
    }
  });

  const { data: statsData, isLoading: statsLoading } = useQuery<Stats | null>({
    queryKey: ["stock", "stats"],
    queryFn: async () => {
      const res = await fetch("/api/raw-materials/stock/stats");
      if (!res.ok) throw new Error("Failed to fetch stock stats");
      const data = await res.json();
      return data.stats || null;
    }
  });

  const { data: catChartDataVal, isLoading: catLoading } = useQuery<any[]>({
    queryKey: ["stock", "chart", "category"],
    queryFn: async () => {
      const res = await fetch("/api/raw-materials/stock/chart/category");
      if (!res.ok) throw new Error("Failed to fetch category chart data");
      const data = await res.json();
      return data.chartData || [];
    }
  });

  const { data: moveChartDataVal, isLoading: moveLoading } = useQuery<any[]>({
    queryKey: ["stock", "chart", "movement"],
    queryFn: async () => {
      const res = await fetch("/api/raw-materials/stock/chart/movement");
      if (!res.ok) throw new Error("Failed to fetch movement chart data");
      const data = await res.json();
      return data.chartData || [];
    }
  });

  const { data: godownsData, isLoading: godownsLoading } = useQuery<any[]>({
    queryKey: ["godowns"],
    queryFn: async () => {
      const res = await fetch("/api/master-data/godowns");
      if (!res.ok) throw new Error("Failed to fetch godowns");
      const data = await res.json();
      return data.godowns || [];
    }
  });

  const stockSummary = stockSummaryData || [];
  const stockEntries = stockEntriesData || [];
  const stats = statsData || null;
  const catChartData = catChartDataVal || [];
  const moveChartData = moveChartDataVal || [];
  const godowns = godownsData || [];

  const loading = summaryLoading || entriesLoading || statsLoading || catLoading || moveLoading || godownsLoading;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
  };

  // Filter lists in memory for search
  const filteredSummary = stockSummary.filter((s) => {
    const sLower = search.toLowerCase();
    return (
      s.material_type?.name?.toLowerCase().includes(sLower) ||
      s.godown?.name?.toLowerCase().includes(sLower) ||
      s.material_type?.category?.toLowerCase().includes(sLower)
    );
  });

  const filteredEntries = stockEntries.filter((e) => {
    const sLower = search.toLowerCase();
    return (
      e.stock_entry_number.toLowerCase().includes(sLower) ||
      e.godown?.name?.toLowerCase().includes(sLower) ||
      (e.reference_no && e.reference_no.toLowerCase().includes(sLower)) ||
      (e.remarks && e.remarks.toLowerCase().includes(sLower))
    );
  });

  // Recharts colors
  const COLORS = ["#6366F1", "#16A34A", "#D97706", "#EC4899", "#8B5CF6", "#3B82F6"];

  const summaryColumns: DataTableColumn<StockSummary>[] = [
    {
      key: "material",
      header: "Raw Material",
      render: (row) => (
        <div>
          <span className="font-bold text-[#0F172A] block">{row.material_type?.name || "—"}</span>
          <span className="text-[10px] text-[#64748B] uppercase tracking-wider">
            {row.material_type?.category?.replace("_", " ") || "—"}
          </span>
        </div>
      ),
    },
    {
      key: "godown",
      header: "Godown Location",
      render: (row) => <span className="font-semibold text-slate-700">{row.godown?.name || "—"}</span>,
    },
    {
      key: "current_stock",
      header: "Available Qty",
      render: (row) => (
        <span className="font-bold">
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
          <Badge variant={variant} className="font-bold text-[10px]">
            {label}
          </Badge>
        );
      },
    },
    {
      key: "unit_cost",
      header: "Unit Cost",
      width: "120px",
      render: (row) => <span className="font-mono text-xs font-semibold">{formatCurrency(row.unit_cost)}</span>,
    },
    {
      key: "stock_value",
      header: "Stock Value",
      width: "140px",
      render: (row) => <span className="font-mono text-xs font-bold text-[#0F172A]">{formatCurrency(row.stock_value)}</span>,
    },
  ];

  const entryColumns: DataTableColumn<StockEntry>[] = [
    {
      key: "stock_entry_number",
      header: "Stock Entry ID",
      width: "150px",
      render: (row) => (
        <Link
          href={`/raw-materials/stock/${row.id}`}
          className="font-mono font-bold text-xs text-[#6366F1] hover:underline"
        >
          {row.stock_entry_number}
        </Link>
      ),
    },
    {
      key: "posting_date",
      header: "Posting Date",
      width: "120px",
      render: (row) => <span className="font-mono text-xs font-semibold">{row.posting_date}</span>,
    },
    {
      key: "entry_type",
      header: "Type",
      width: "110px",
      render: (row) => {
        let variant: BadgeVariant = "gray";
        if (row.entry_type === "stock_in") variant = "green";
        else if (row.entry_type === "stock_out") variant = "red";
        return (
          <Badge variant={variant} className="capitalize text-[10px] font-bold">
            {row.entry_type.replace("_", " ")}
          </Badge>
        );
      },
    },
    {
      key: "godown",
      header: "Godown Location",
      render: (row) => <span className="font-semibold text-slate-700">{row.godown?.name || "—"}</span>,
    },
    {
      key: "reference_no",
      header: "Ref Doc",
      width: "130px",
      render: (row) => <span className="font-mono text-xs text-[#64748B]">{row.reference_no || "—"}</span>,
    },
    {
      key: "remarks",
      header: "Remarks",
      render: (row) => <span className="text-xs text-[#64748B] truncate max-w-[200px] block">{row.remarks || "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "100px",
      render: (row) => (
        <Badge variant={row.status === "active" ? "green" : "red"} className="capitalize text-[10px] font-bold">
          {row.status}
        </Badge>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Stock Overview"
        subtitle="Monitor current godown levels, check low stock alerts, and track stock transfers."
        actionLabel="Add Stock Entry"
        onAction={() => router.push("/raw-materials/stock/new")}
      />

      {/* 5 STAT CARDS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-[#EEF2FF] rounded-lg text-[#6366F1] shrink-0">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Total Items</span>
            <p className="text-lg font-black text-slate-800 mt-0.5">{stats ? stats.totalItems : "0"}</p>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-[#F0FDF4] rounded-lg text-[#16A34A] shrink-0">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Stock Value</span>
            <p className="text-lg font-black text-[#16A34A] mt-0.5">{stats ? formatCurrency(stats.totalValue) : "₹0.00"}</p>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-[#FEF9C3] rounded-lg text-[#D97706] shrink-0">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Low Stock</span>
            <p className="text-lg font-black text-[#D97706] mt-0.5">{stats ? stats.lowStockCount : "0"}</p>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-[#FEF2F2] rounded-lg text-[#DC2626] shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Out of Stock</span>
            <p className="text-lg font-black text-[#DC2626] mt-0.5">{stats ? stats.outOfStockCount : "0"}</p>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-[#F5F3FF] rounded-lg text-[#7C3AED] shrink-0">
            <ArrowLeftRight className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Movements (Mo)</span>
            <p className="text-lg font-black text-slate-800 mt-0.5">{stats ? stats.movementCount : "0"}</p>
          </div>
        </div>
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Value Donut */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm lg:col-span-1 flex flex-col">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-[#F1F5F9] pb-2 mb-3">
            Value by Category (₹)
          </h3>
          <div className="h-52 flex-1 relative">
            {catChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-400 italic">
                No stock value recorded.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={catChartData}
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {catChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip formatter={(value: any) => formatCurrency(value)} />
                  <Legend iconSize={8} layout="horizontal" align="center" verticalAlign="bottom" wrapperStyle={{ fontSize: 9 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Movements Bar Chart */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm lg:col-span-2 flex flex-col">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-[#F1F5F9] pb-2 mb-3">
            Inward vs Outward Movement over time (Qty)
          </h3>
          <div className="h-52 flex-1">
            {moveChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-400 italic">
                No movements recorded in the last 6 months.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={moveChartData}>
                  <XAxis dataKey="name" stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                  <ChartTooltip />
                  <Legend iconSize={8} verticalAlign="bottom" wrapperStyle={{ fontSize: 9 }} />
                  <Bar dataKey="inward" name="Inward (Qty)" fill="#16A34A" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outward" name="Outward (Qty)" fill="#DC2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white border border-[#E2E8F0] p-4 rounded-xl shadow-sm">
        {/* Toggle Summary vs Entries */}
        <div className="flex bg-[#F1F5F9] p-1 rounded-lg w-full md:w-auto">
          <button
            onClick={() => setActiveView("summary")}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${activeView === "summary" ? "bg-white text-[#0F172A] shadow-sm font-bold" : "text-[#64748B] hover:text-[#0F172A]"
              }`}
          >
            Running Summary
          </button>
          <button
            onClick={() => setActiveView("entries")}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${activeView === "entries" ? "bg-white text-[#0F172A] shadow-sm font-bold" : "text-[#64748B] hover:text-[#0F172A]"
              }`}
          >
            Stock Entries
          </button>
        </div>

        {/* Godown Filter & Search */}
        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
          <select
            value={godownFilter}
            onChange={(e) => setGodownFilter(e.target.value)}
            className="w-full md:w-44 px-3 py-1.5 border border-[#CBD5E1] rounded-lg text-xs bg-white focus:ring-1 focus:ring-[#6366F1]"
          >
            <option value="">All Godowns</option>
            {godowns.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search material, category, entries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 border border-[#CBD5E1] rounded-lg text-xs bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#6366F1]"
            />
          </div>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
        {activeView === "summary" ? (
          <DataTable
            columns={summaryColumns}
            data={filteredSummary}
            isLoading={loading}
            total={filteredSummary.length}
            page={1}
            perPage={10000}
            onPageChange={() => { }}
            emptyMessage="No inventory items found."
          />
        ) : (
          <DataTable
            columns={entryColumns}
            data={filteredEntries}
            isLoading={loading}
            total={filteredEntries.length}
            page={1}
            perPage={10000}
            onPageChange={() => { }}
            emptyMessage="No stock entry transaction history found."
          />
        )}
      </div>
    </div>
  );
}
