"use client";

import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package, Boxes, Warehouse as WarehouseIcon, Tag, Layers } from "lucide-react";
import PageState from "@/components/shared/PageState";
import ReportShell, { ReportFilters } from "@/components/reports/ReportShell";
import ReportKPICard from "@/components/reports/ReportKPICard";
import { ReportDonutChart, ChartCard } from "@/components/reports/ReportChart";
import StockCategoryFilter, { StockCategory } from "@/components/reports/StockCategoryFilter";
import { fmtINR, fmtNum, exportMultiSheetExcel, getPresetDates } from "@/lib/report-export";
import { cn } from "@/lib/utils";
import Link from "next/link";

import FilterSelect from "@/components/reports/filters/FilterSelect";
import FilterPills from "@/components/reports/filters/FilterPills";
import BillTypeFilter, { BillType } from "@/components/reports/BillTypeFilter";

type InvTab = "valuation" | "warehouse" | "design";

const TABS: { id: InvTab; label: string; icon: React.ReactNode }[] = [
  { id: "valuation", label: "Stock Valuation", icon: <Tag size={13} /> },
  { id: "warehouse", label: "Warehouse Stock", icon: <WarehouseIcon size={13} /> },
  { id: "design", label: "Design Stock", icon: <Package size={13} /> },
];

const STOCK_STATUS_OPTIONS = [
  { id: "all", label: "All Items" },
  { id: "in_stock", label: "In Stock", badgeClass: "bg-emerald-600 text-white shadow-xs font-semibold" },
  { id: "low_stock", label: "Low Stock", badgeClass: "bg-amber-600 text-white shadow-xs font-semibold" },
  { id: "out_of_stock", label: "Out of Stock", badgeClass: "bg-rose-600 text-white shadow-xs font-semibold" },
];

export default function InventoryReportsPage() {
  const defaultDates = getPresetDates("this_fy");
  const [from, setFrom] = useState(defaultDates.from);
  const [to, setTo] = useState(defaultDates.to);
  const [activeTab, setActiveTab] = useState<InvTab>("valuation");
  const [category, setCategory] = useState<StockCategory>("all");
  const [billType, setBillType] = useState<BillType>("all");
  const [godownId, setGodownId] = useState("all");
  const [brandId, setBrandId] = useState("all");
  const [stockStatus, setStockStatus] = useState("all");

  // Fetch Godowns
  const { data: godownsData } = useQuery({
    queryKey: ["master-data-godowns-list"],
    queryFn: async () => {
      const res = await fetch("/api/master-data/godowns");
      if (!res.ok) return { godowns: [] };
      return res.json();
    },
    staleTime: 300_000,
  });

  // Fetch Brands
  const { data: brandsData } = useQuery({
    queryKey: ["master-data-brands-list"],
    queryFn: async () => {
      const res = await fetch("/api/master-data/brands");
      if (!res.ok) return { brands: [] };
      return res.json();
    },
    staleTime: 300_000,
  });

  const godownOptions = (godownsData?.godowns ?? []).map((g: any) => ({
    label: g.name,
    value: g.id,
  }));

  const brandOptions = (brandsData?.brands ?? []).map((b: any) => ({
    label: b.name,
    value: b.id,
  }));

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["report-inventory-v3", activeTab, category, billType, godownId, brandId, stockStatus],
    queryFn: async () => {
      const params = new URLSearchParams({ tab: activeTab, category });
      if (billType !== "all") params.set("bill_type", billType);
      if (godownId !== "all") params.set("godown_id", godownId);
      if (brandId !== "all") params.set("brand_id", brandId);
      if (stockStatus !== "all") params.set("stock_status", stockStatus);
      const res = await fetch(`/api/reports/inventory?${params}`);
      if (!res.ok) throw new Error("Failed to load inventory report");
      return res.json();
    },
    staleTime: 60_000,
  });

  const handleApply = useCallback((filters: ReportFilters) => {
    setFrom(filters.from);
    setTo(filters.to);
  }, []);

  const handleExportExcel = useCallback(() => {
    if (!data) return;
    const fgRows = (data.fgRows ?? []).map((r: any) => ({ ...r, category: "Finished Goods" }));
    const rmRows = (data.rmRows ?? []).map((r: any) => ({ ...r, design_number: "-", brand: r.category, category: r.item_type }));
    const valRows = [...fgRows, ...rmRows];
    exportMultiSheetExcel(
      [
        {
          name: "Stock Valuation",
          columns: [
            { key: "category", label: "Item Type", width: 18 },
            { key: "design_number", label: "Code / No.", width: 16 },
            { key: "design_name", label: "Name", width: 28 },
            { key: "brand", label: "Brand / Category", width: 18 },
            { key: "total_qty", label: "Total Qty", format: "number" as const, width: 14 },
            { key: "total_value", label: "Stock Value (Rs.)", format: "currency" as const, width: 20 },
          ],
          rows: valRows,
        },
        {
          name: "Warehouse Stock",
          columns: [
            { key: "code", label: "Code", width: 12 },
            { key: "name", label: "Godown", width: 24 },
            { key: "address", label: "Location", width: 24 },
            { key: "fg_qty", label: "FG Qty", format: "number" as const, width: 12 },
            { key: "rm_qty", label: "RM Qty", format: "number" as const, width: 12 },
            { key: "qty", label: "Total Qty", format: "number" as const, width: 14 },
            { key: "value", label: "Total Value (Rs.)", format: "currency" as const, width: 20 },
          ],
          rows: (activeTab === "warehouse" ? data.rows : []) ?? [],
        },
        {
          name: "Design Stock",
          columns: [
            { key: "design_number", label: "Design No.", width: 16 },
            { key: "design_name", label: "Design Name", width: 28 },
            { key: "brand", label: "Brand", width: 18 },
            { key: "colour", label: "Colour", width: 14 },
            { key: "godown", label: "Godown", width: 18 },
            { key: "quantity", label: "Stock Qty", format: "number" as const, width: 14 },
            { key: "cost_per_piece", label: "Cost/Piece (Rs.)", format: "currency" as const, width: 18 },
            { key: "value", label: "Total Value (Rs.)", format: "currency" as const, width: 20 },
          ],
          rows: (activeTab === "design" ? data.rows : []) ?? [],
        },
      ],
      `InventoryReport_${activeTab}_${category}_${new Date().toISOString().split("T")[0]}`
    );
  }, [data, activeTab, category, billType]);

  const s = data?.summary ?? {};

  const brandChart = Object.entries(data?.brandBreakdown ?? {}).map(([name, v]: [string, any]) => ({
    name, value: Number(v.value),
  }));

  const warehouseChart = (data?.rows ?? []).map((r: any) => ({
    name: r.name,
    value: Number(r.value),
  }));

  return (
    <ReportShell
      title="Inventory & Stock"
      infoTooltip="Stock valuation across finished goods, raw materials & accessories, godown breakdown, and design variant levels."
      breadcrumbs={["Reports", "Inventory & Stock"]}
      onApply={handleApply}
      onExportExcel={handleExportExcel}
      extraFilters={
        <div className="flex flex-wrap items-center gap-3">
          {activeTab === "valuation" && (
            <BillTypeFilter value={billType} onChange={setBillType} />
          )}
          <FilterSelect
            label="Godown"
            value={godownId}
            onChange={setGodownId}
            options={godownOptions}
            placeholder="All Warehouses"
          />
          <FilterSelect
            label="Brand"
            value={brandId}
            onChange={setBrandId}
            options={brandOptions}
            placeholder="All Brands"
          />
          <FilterPills
            label="Stock Status"
            value={stockStatus}
            onChange={setStockStatus}
            options={STOCK_STATUS_OPTIONS}
          />
          <div className="flex items-center gap-1.5 ml-auto">
            <StockCategoryFilter value={category} onChange={setCategory} />
          </div>
        </div>
      }
    >
      {/* Sub Tabs */}
      <div className="flex border-b border-[var(--border)] gap-1 -mt-2 print:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-5 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer",
              activeTab === t.id
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-body)]"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <PageState
        isLoading={isLoading}
        isError={!!error}
        error={(error as any)?.message}
        onRetry={refetch}
        skeletonVariant="stats"
        skeletonCount={4}
      >
        {data && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <ReportKPICard label="Total Stock Value" value={s.totalValue} color="emerald" icon={<Tag size={16} />} />
              <ReportKPICard label="Pakka Stock Value" value={s.pakkaStockValue ?? 0} color="blue" icon={<Tag size={16} />} />
              <ReportKPICard label="Kaccha Stock Value" value={s.kachaStockValue ?? 0} color="amber" icon={<Tag size={16} />} />
              <ReportKPICard label="Finished Goods Qty" value={s.totalFGQty ?? 0} format="number" color="indigo" icon={<Package size={16} />} />
              <ReportKPICard label="Raw Material Qty" value={s.totalRMQty ?? 0} format="number" color="violet" icon={<Boxes size={16} />} />
              <ReportKPICard label="Accessories Qty" value={s.totalAccQty ?? 0} format="number" color="violet" icon={<Layers size={16} />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content Area */}
              <div className="lg:col-span-2 space-y-6">

                {/* ── TAB 1: STOCK VALUATION ── */}
                {activeTab === "valuation" && (
                  <div className="space-y-6">
                    {/* Finished Goods Table */}
                    {(category === "all" || category === "finished_goods") && (
                      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--table-header-bg)] flex justify-between items-center">
                          <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-primary)]">
                            Finished Goods Stock (by Design)
                          </h3>
                          <span className="text-xs font-mono text-[var(--text-muted)]">{s.totalDesigns ?? 0} Designs</span>
                        </div>
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                                {["#", "Design No.", "Design Name", "Brand", "Total Qty", "Stock Value"].map(h => (
                                  <th key={h} className={`py-2.5 px-4 ${["Total Qty","Stock Value"].includes(h) ? "text-right" : ""}`}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-light)]">
                              {(data.fgRows ?? []).map((r: any, i: number) => (
                                <tr key={r.design_id} className="hover:bg-[var(--table-row-hover)] h-10">
                                  <td className="py-2 px-4 text-[var(--text-faint)]">{i + 1}</td>
                                  <td className="py-2 px-4 font-mono font-bold text-[var(--primary)]">
                                    {r.design_id && r.design_id !== "unknown" ? (
                                      <Link href={`/finished-stock/designs/${r.design_id}`} className="hover:underline">
                                        {r.design_number}
                                      </Link>
                                    ) : (
                                      r.design_number
                                    )}
                                  </td>
                                  <td className="py-2 px-4 font-semibold text-[var(--text-primary)]">{r.design_name}</td>
                                  <td className="py-2 px-4 text-[var(--text-muted)]">{r.brand}</td>
                                  <td className="py-2 px-4 text-right font-mono">{fmtNum(r.total_qty)}</td>
                                  <td className="py-2 px-4 text-right font-mono font-bold text-[var(--primary)]">{fmtINR(r.total_value)}</td>
                                </tr>
                              ))}
                              {(data.fgRows ?? []).length === 0 && (
                                <tr><td colSpan={6} className="py-6 text-center text-[var(--text-muted)]">No finished goods stock records found.</td></tr>
                              )}
                            </tbody>
                            <tfoot className="border-t-2 border-[var(--border)] bg-[var(--table-header-bg)] font-bold">
                              <tr>
                                <td colSpan={4} className="py-3 px-4 text-[10px] uppercase text-[var(--text-muted)]">Total Finished Goods</td>
                                <td className="py-3 px-4 text-right font-mono">{fmtNum(s.totalFGQty)}</td>
                                <td className="py-3 px-4 text-right font-mono text-[var(--primary)]">{fmtINR(s.totalFGValue)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                        {/* Mobile Finished Goods Cards */}
                        <div className="md:hidden divide-y divide-[var(--border-light)]">
                          {(data.fgRows ?? []).length === 0 ? (
                            <div className="p-4 text-center text-xs text-[var(--text-muted)]">No finished goods records found.</div>
                          ) : (
                            (data.fgRows ?? []).map((r: any) => (
                              <div key={r.design_id} className="p-3.5 space-y-1.5">
                                <div className="flex items-center justify-between">
                                  {r.design_id && r.design_id !== "unknown" ? (
                                    <Link href={`/finished-stock/designs/${r.design_id}`} className="font-mono font-bold text-xs text-[var(--primary)] hover:underline">
                                      {r.design_number}
                                    </Link>
                                  ) : (
                                    <span className="font-mono font-bold text-xs text-[var(--text-primary)]">{r.design_number}</span>
                                  )}
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--table-header-bg)] text-[var(--text-muted)] border border-[var(--border)]">{r.brand}</span>
                                </div>
                                <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{r.design_name}</p>
                                <div className="flex justify-between items-center pt-1 border-t border-[var(--border-light)] text-xs">
                                  <span className="text-[var(--text-muted)]">{fmtNum(r.total_qty)} pcs</span>
                                  <span className="font-mono font-bold text-[var(--primary)]">{fmtINR(r.total_value)}</span>
                                </div>
                              </div>
                            ))
                          )}
                          <div className="p-3 bg-[var(--table-header-bg)] flex justify-between items-center text-xs font-bold">
                            <span className="text-[var(--text-muted)]">Total FG ({fmtNum(s.totalFGQty)} pcs)</span>
                            <span className="font-mono text-[var(--primary)]">{fmtINR(s.totalFGValue)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Raw Materials & Accessories Table */}
                    {(category === "all" || category === "raw_material" || category === "accessory") && (
                      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--table-header-bg)] flex justify-between items-center">
                          <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-primary)]">
                            Raw Materials & Accessories Stock
                          </h3>
                          <span className="text-xs font-mono text-[var(--text-muted)]">{s.totalRMTypes ?? 0} Materials</span>
                        </div>
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                                {["#", "Material Name", "Category", "Unit", "Total Qty", "Stock Value"].map(h => (
                                  <th key={h} className={`py-2.5 px-4 ${["Total Qty","Stock Value"].includes(h) ? "text-right" : ""}`}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-light)]">
                              {(data.rmRows ?? []).map((r: any, i: number) => (
                                <tr key={r.id} className="hover:bg-[var(--table-row-hover)] h-10">
                                  <td className="py-2 px-4 text-[var(--text-faint)]">{i + 1}</td>
                                  <td className="py-2 px-4 font-bold text-[var(--text-primary)]">{r.name}</td>
                                  <td className="py-2 px-4">
                                    <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border bg-[var(--table-header-bg)] text-[var(--text-muted)] border-[var(--border)] uppercase">
                                      {r.category}
                                    </span>
                                  </td>
                                  <td className="py-2 px-4 text-[var(--text-muted)] capitalize">{r.unit}</td>
                                  <td className="py-2 px-4 text-right font-mono">{fmtNum(r.total_qty)}</td>
                                  <td className="py-2 px-4 text-right font-mono font-bold text-[var(--primary)]">{fmtINR(r.total_value)}</td>
                                </tr>
                              ))}
                              {(data.rmRows ?? []).length === 0 && (
                                <tr><td colSpan={6} className="py-6 text-center text-[var(--text-muted)]">No raw material or accessory stock records found.</td></tr>
                              )}
                            </tbody>
                            <tfoot className="border-t-2 border-[var(--border)] bg-[var(--table-header-bg)] font-bold">
                              <tr>
                                <td colSpan={4} className="py-3 px-4 text-[10px] uppercase text-[var(--text-muted)]">Total Raw Materials & Accessories</td>
                                <td className="py-3 px-4 text-right font-mono">{fmtNum((s.totalRMQty ?? 0) + (s.totalAccQty ?? 0))}</td>
                                <td className="py-3 px-4 text-right font-mono text-[var(--primary)]">{fmtINR((s.totalRMValue ?? 0) + (s.totalAccValue ?? 0))}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                        {/* Mobile RM Cards */}
                        <div className="md:hidden divide-y divide-[var(--border-light)]">
                          {(data.rmRows ?? []).length === 0 ? (
                            <div className="p-4 text-center text-xs text-[var(--text-muted)]">No materials found.</div>
                          ) : (
                            (data.rmRows ?? []).map((r: any) => (
                              <div key={r.id} className="p-3.5 space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs text-[var(--text-primary)] truncate max-w-[65%]">{r.name}</span>
                                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[var(--table-header-bg)] text-[var(--text-muted)] border border-[var(--border)] uppercase">{r.category}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs text-[var(--text-muted)]">
                                  <span>Qty: <strong className="text-[var(--text-primary)] font-mono">{fmtNum(r.total_qty)}</strong> {r.unit}</span>
                                  <span className="font-mono font-bold text-[var(--primary)]">{fmtINR(r.total_value)}</span>
                                </div>
                              </div>
                            ))
                          )}
                          <div className="p-3 bg-[var(--table-header-bg)] flex justify-between items-center text-xs font-bold">
                            <span className="text-[var(--text-muted)]">Total Materials & Acc.</span>
                            <span className="font-mono text-[var(--primary)]">{fmtINR((s.totalRMValue ?? 0) + (s.totalAccValue ?? 0))}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── TAB 2: WAREHOUSE / GODOWN STOCK ── */}
                {activeTab === "warehouse" && (
                  <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--table-header-bg)] flex justify-between items-center">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-primary)]">
                        Warehouse & Godown Stock Breakdown
                      </h3>
                      <span className="text-xs font-mono text-[var(--text-muted)]">{s.totalGodowns ?? 0} Active Godowns</span>
                    </div>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                            {["#", "Warehouse / Godown", "Location", "FG Qty", "RM Qty", "Accessories", "Total Qty", "Stock Value"].map(h => (
                              <th key={h} className={`py-2.5 px-3 ${["FG Qty","RM Qty","Accessories","Total Qty","Stock Value"].includes(h) ? "text-right" : ""}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-light)]">
                          {(data.rows ?? []).map((r: any, i: number) => (
                            <tr key={r.id} className="hover:bg-[var(--table-row-hover)] h-10">
                              <td className="py-2 px-3 text-[var(--text-faint)]">{i + 1}</td>
                              <td className="py-2 px-3 font-bold text-[var(--primary)]">
                                <Link href="/master-data/godowns" className="hover:underline">
                                  {r.name}
                                </Link>
                              </td>
                              <td className="py-2 px-3 text-[var(--text-muted)] max-w-[150px] truncate">{r.address || r.location || "Facility"}</td>
                              <td className="py-2 px-3 text-right font-mono">{fmtNum(r.fg_qty)}</td>
                              <td className="py-2 px-3 text-right font-mono text-[var(--text-muted)]">{fmtNum(r.rm_qty)}</td>
                              <td className="py-2 px-3 text-right font-mono text-[var(--text-muted)]">{fmtNum(r.acc_qty)}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">{fmtNum(r.qty)}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-[var(--primary)]">{fmtINR(r.value)}</td>
                            </tr>
                          ))}
                          {(data.rows ?? []).length === 0 && (
                            <tr><td colSpan={8} className="py-8 text-center text-[var(--text-muted)]">No warehouse stock found.</td></tr>
                          )}
                        </tbody>
                        <tfoot className="border-t-2 border-[var(--border)] bg-[var(--table-header-bg)] font-bold">
                          <tr>
                            <td colSpan={3} className="py-3 px-3 text-[10px] uppercase text-[var(--text-muted)]">Total Across Godowns</td>
                            <td className="py-3 px-3 text-right font-mono">{fmtNum(s.totalFGQty)}</td>
                            <td className="py-3 px-3 text-right font-mono">{fmtNum(s.totalRMQty)}</td>
                            <td className="py-3 px-3 text-right font-mono">{fmtNum(s.totalAccQty)}</td>
                            <td className="py-3 px-3 text-right font-mono">{fmtNum(s.totalQty)}</td>
                            <td className="py-3 px-3 text-right font-mono text-[var(--primary)]">{fmtINR(s.totalValue)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    {/* Mobile Warehouse Cards */}
                    <div className="md:hidden divide-y divide-[var(--border-light)]">
                      {(data.rows ?? []).length === 0 ? (
                        <div className="p-4 text-center text-xs text-[var(--text-muted)]">No warehouse stock found.</div>
                      ) : (
                        (data.rows ?? []).map((r: any) => (
                          <div key={r.id} className="p-3.5 space-y-2">
                            <div className="flex items-center justify-between">
                              <Link href="/master-data/godowns" className="font-bold text-xs text-[var(--primary)] hover:underline">
                                {r.name}
                              </Link>
                              <span className="font-mono font-bold text-xs text-[var(--primary)]">{fmtINR(r.value)}</span>
                            </div>
                            <p className="text-[11px] text-[var(--text-muted)] truncate">{r.address || r.location || "Facility"}</p>
                            <div className="grid grid-cols-4 gap-1 text-center bg-[var(--table-header-bg)] rounded-lg p-2 border border-[var(--border)]">
                              <div>
                                <p className="text-[9px] uppercase font-bold text-[var(--text-faint)]">FG</p>
                                <p className="text-xs font-mono font-semibold text-[var(--text-primary)]">{fmtNum(r.fg_qty)}</p>
                              </div>
                              <div>
                                <p className="text-[9px] uppercase font-bold text-[var(--text-faint)]">RM</p>
                                <p className="text-xs font-mono text-[var(--text-muted)]">{fmtNum(r.rm_qty)}</p>
                              </div>
                              <div>
                                <p className="text-[9px] uppercase font-bold text-[var(--text-faint)]">Acc</p>
                                <p className="text-xs font-mono text-[var(--text-muted)]">{fmtNum(r.acc_qty)}</p>
                              </div>
                              <div>
                                <p className="text-[9px] uppercase font-bold text-[var(--text-faint)]">Total</p>
                                <p className="text-xs font-mono font-bold text-[var(--text-primary)]">{fmtNum(r.qty)}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                      <div className="p-3 bg-[var(--table-header-bg)] flex justify-between items-center text-xs font-bold">
                        <span className="text-[var(--text-muted)]">Total ({fmtNum(s.totalQty)} pcs)</span>
                        <span className="font-mono text-[var(--primary)]">{fmtINR(s.totalValue)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── TAB 3: DESIGN STOCK ── */}
                {activeTab === "design" && (
                  <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--table-header-bg)] flex justify-between items-center">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-primary)]">
                        Detailed Design & Variant Stock
                      </h3>
                      <span className="text-xs font-mono text-[var(--text-muted)]">{s.totalItems ?? 0} Variant Items</span>
                    </div>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                            {["Design No.", "Name", "Brand", "Colour", "Godown", "Qty", "Cost/Pc", "Value"].map(h => (
                              <th key={h} className={`py-2.5 px-3 ${["Qty","Cost/Pc","Value"].includes(h) ? "text-right" : ""}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-light)]">
                          {(data.rows ?? []).map((r: any) => (
                            <tr key={r.id} className="hover:bg-[var(--table-row-hover)] h-10">
                              <td className="py-2 px-3 font-mono font-bold text-[var(--primary)]">
                                {r.design_id ? (
                                  <Link href={`/finished-stock/designs/${r.design_id}`} className="hover:underline">
                                    {r.design_number}
                                  </Link>
                                ) : (
                                  r.design_number
                                )}
                              </td>
                              <td className="py-2 px-3 max-w-[100px] truncate">{r.design_name}</td>
                              <td className="py-2 px-3 text-[var(--text-muted)]">{r.brand}</td>
                              <td className="py-2 px-3 text-[var(--text-muted)]">{r.colour}</td>
                              <td className="py-2 px-3 text-[var(--text-muted)]">
                                <Link href="/master-data/godowns" className="text-[var(--primary)] hover:underline">
                                  {r.godown}
                                </Link>
                              </td>
                              <td className="py-2 px-3 text-right font-mono">{fmtNum(r.quantity)}</td>
                              <td className="py-2 px-3 text-right font-mono">{fmtINR(r.cost_per_piece)}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-[var(--primary)]">{fmtINR(r.value)}</td>
                            </tr>
                          ))}
                          {(data.rows ?? []).length === 0 && (
                            <tr><td colSpan={8} className="py-8 text-center text-[var(--text-muted)]">No design variant stock records found.</td></tr>
                          )}
                        </tbody>
                        <tfoot className="border-t-2 border-[var(--border)] bg-[var(--table-header-bg)] font-bold">
                          <tr>
                            <td colSpan={5} className="py-3 px-3 text-[10px] uppercase text-[var(--text-muted)]">Total Design Variant Stock</td>
                            <td className="py-3 px-3 text-right font-mono">{fmtNum(s.totalQty)}</td>
                            <td />
                            <td className="py-3 px-3 text-right font-mono text-[var(--primary)]">{fmtINR(s.totalValue)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    {/* Mobile Design Variant Stock Cards */}
                    <div className="md:hidden divide-y divide-[var(--border-light)]">
                      {(data.rows ?? []).length === 0 ? (
                        <div className="p-4 text-center text-xs text-[var(--text-muted)]">No design variant stock records found.</div>
                      ) : (
                        (data.rows ?? []).map((r: any) => (
                          <div key={r.id} className="p-3.5 space-y-1.5">
                            <div className="flex items-center justify-between">
                              {r.design_id ? (
                                <Link href={`/finished-stock/designs/${r.design_id}`} className="font-mono font-bold text-xs text-[var(--primary)] hover:underline">
                                  {r.design_number}
                                </Link>
                              ) : (
                                <span className="font-mono font-bold text-xs text-[var(--text-primary)]">{r.design_number}</span>
                              )}
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[var(--table-header-bg)] text-[var(--text-muted)] border border-[var(--border)]">{r.colour}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-[var(--text-primary)] font-medium truncate max-w-[60%]">{r.design_name}</span>
                              <span className="text-[var(--text-muted)]">{r.godown}</span>
                            </div>
                            <div className="flex justify-between items-center pt-1 border-t border-[var(--border-light)] text-xs">
                              <span className="text-[var(--text-muted)]">{fmtNum(r.quantity)} pcs @ {fmtINR(r.cost_per_piece)}</span>
                              <span className="font-mono font-bold text-[var(--primary)]">{fmtINR(r.value)}</span>
                            </div>
                          </div>
                        ))
                      )}
                      <div className="p-3 bg-[var(--table-header-bg)] flex justify-between items-center text-xs font-bold">
                        <span className="text-[var(--text-muted)]">Total Variant Stock ({fmtNum(s.totalQty)} pcs)</span>
                        <span className="font-mono text-[var(--primary)]">{fmtINR(s.totalValue)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar Charts & Summary */}
              <div className="space-y-4">
                {activeTab === "valuation" && brandChart.length > 0 && (
                  <ChartCard title="Valuation by Brand">
                    <ReportDonutChart data={brandChart.filter(b => b.value > 0)} height={200} innerRadius={50} outerRadius={75} valueFormat="currency" />
                  </ChartCard>
                )}

                {activeTab === "warehouse" && warehouseChart.length > 0 && (
                  <ChartCard title="Warehouse Stock Valuation">
                    <ReportDonutChart data={warehouseChart.filter((w: any) => w.value > 0)} height={200} innerRadius={50} outerRadius={75} valueFormat="currency" />
                  </ChartCard>
                )}

                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-2.5 shadow-[var(--shadow-sm)]">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Stock Summary</h3>
                  {[
                    { label: "Total Stock Value", value: fmtINR(s.totalValue) },
                    { label: "Total Combined Quantity", value: fmtNum(s.totalQty) },
                    { label: "Finished Goods Stock", value: `${fmtNum(s.totalFGQty)} pcs (${fmtINR(s.totalFGValue)})` },
                    { label: "Raw Materials Stock", value: `${fmtNum(s.totalRMQty)} units (${fmtINR(s.totalRMValue)})` },
                    { label: "Accessories Stock", value: `${fmtNum(s.totalAccQty)} units (${fmtINR(s.totalAccValue)})` },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between text-xs border-b border-[var(--border-light)] pb-2">
                      <span className="text-[var(--text-muted)]">{r.label}</span>
                      <span className="font-bold font-mono text-[var(--text-primary)]">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </PageState>
    </ReportShell>
  );
}
