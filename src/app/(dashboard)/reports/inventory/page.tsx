"use client";

import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package, Boxes, WarehouseIcon, Tag } from "lucide-react";
import PageState from "@/components/shared/PageState";
import ReportShell, { ReportFilters } from "@/components/reports/ReportShell";
import ReportKPICard from "@/components/reports/ReportKPICard";
import { ReportBarChart, ReportDonutChart, ChartCard, CHART_COLORS } from "@/components/reports/ReportChart";
import { fmtINR, fmtNum, exportToExcel, getPresetDates } from "@/lib/report-export";
import { cn } from "@/lib/utils";

type InvTab = "valuation" | "warehouse" | "design";

const TABS: { id: InvTab; label: string; icon: React.ReactNode }[] = [
  { id: "valuation", label: "Stock Valuation", icon: <Tag size={13} /> },
  { id: "warehouse", label: "Warehouse Stock", icon: <WarehouseIcon size={13} /> },
  { id: "design", label: "Design Stock", icon: <Package size={13} /> },
];

export default function InventoryReportsPage() {
  const defaultDates = getPresetDates("this_fy");
  const [from, setFrom] = useState(defaultDates.from);
  const [to, setTo] = useState(defaultDates.to);
  const [activeTab, setActiveTab] = useState<InvTab>("valuation");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["report-inventory", activeTab],
    queryFn: async () => {
      const res = await fetch(`/api/reports/inventory?tab=${activeTab}`);
      if (!res.ok) throw new Error("Failed to load inventory report");
      return res.json();
    },
    staleTime: 120_000,
  });

  const handleApply = useCallback((filters: ReportFilters) => {
    setFrom(filters.from);
    setTo(filters.to);
  }, []);

  const handleExportExcel = useCallback(() => {
    if (!data) return;
    if (activeTab === "valuation") {
      exportToExcel(
        [
          { key: "design_number", label: "Design No.", width: 16 },
          { key: "design_name", label: "Design Name", width: 28 },
          { key: "brand", label: "Brand", width: 18 },
          { key: "total_qty", label: "Total Qty", format: "number", width: 14 },
          { key: "total_value", label: "Stock Value (₹)", format: "currency", width: 18 },
        ],
        data.rows ?? [],
        `StockValuation_AsOn_${new Date().toISOString().split("T")[0]}`
      );
    } else if (activeTab === "warehouse") {
      exportToExcel(
        [
          { key: "name", label: "Warehouse / Godown", width: 28 },
          { key: "qty", label: "Total Qty", format: "number", width: 14 },
          { key: "value", label: "Stock Value (₹)", format: "currency", width: 18 },
        ],
        data.rows ?? [],
        `WarehouseStock_${new Date().toISOString().split("T")[0]}`
      );
    } else {
      exportToExcel(
        [
          { key: "design_number", label: "Design No.", width: 16 },
          { key: "design_name", label: "Design Name", width: 28 },
          { key: "brand", label: "Brand", width: 16 },
          { key: "colour", label: "Colour", width: 16 },
          { key: "godown", label: "Godown", width: 18 },
          { key: "quantity", label: "Qty", format: "number", width: 12 },
          { key: "cost_per_piece", label: "Cost/Pc (₹)", format: "currency", width: 14 },
          { key: "value", label: "Value (₹)", format: "currency", width: 16 },
        ],
        data.rows ?? [],
        `DesignStock_${new Date().toISOString().split("T")[0]}`
      );
    }
  }, [data, activeTab]);

  const s = data?.summary ?? {};

  // Chart data
  const brandChart = Object.entries(data?.brandBreakdown ?? {}).map(([name, v]: any) => ({
    name, value: v.value,
  }));
  const warehouseChart = (data?.rows ?? []).map((r: any) => ({ name: r.name ?? r.design_name, total: r.value ?? r.total_value }));

  return (
    <ReportShell
      title="Inventory & Stock"
      infoTooltip="Stock valuation, warehouse-wise stock, and design-level inventory breakdown."
      breadcrumbs={["Reports", "Inventory & Stock"]}
      onApply={handleApply}
      onExportExcel={handleExportExcel}
    >
      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] gap-0.5 -mt-2 print:hidden">
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
        skeletonVariant="table"
        skeletonRows={8}
        skeletonColumns={5}
        isEmpty={!isLoading && (data?.rows ?? []).length === 0}
        emptyTitle="No stock found"
        emptyDescription="No inventory records found. Add finished goods to see stock reports."
      >
        {data && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ReportKPICard label="Total Stock Value" value={s.totalValue ?? 0} color="indigo" icon={<Boxes size={16} />} />
              <ReportKPICard label="Total Quantity" value={s.totalQty ?? 0} format="number" color="blue" icon={<Package size={16} />} />
              <ReportKPICard
                label={activeTab === "warehouse" ? "Total Warehouses" : activeTab === "valuation" ? "Total Designs" : "Total Items"}
                value={s.totalGodowns ?? s.totalDesigns ?? s.totalItems ?? 0}
                format="number"
                color="violet"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main table */}
              <div className="lg:col-span-2 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--table-header-bg)]">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
                    {activeTab === "valuation" ? "Stock by Design" : activeTab === "warehouse" ? "Stock by Warehouse" : "Detailed Design Stock"}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    {activeTab === "valuation" && (
                      <>
                        <thead>
                          <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                            {["#", "Design No.", "Design Name", "Brand", "Total Qty", "Stock Value"].map(h => (
                              <th key={h} className={`py-2.5 px-4 ${["Total Qty","Stock Value"].includes(h) ? "text-right" : ""}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-light)]">
                          {(data.rows ?? []).map((r: any, i: number) => (
                            <tr key={r.design_id} className="hover:bg-[var(--table-row-hover)] h-10">
                              <td className="py-2 px-4 text-[var(--text-faint)]">{i + 1}</td>
                              <td className="py-2 px-4 font-mono font-bold text-[var(--text-primary)]">{r.design_number}</td>
                              <td className="py-2 px-4">{r.design_name}</td>
                              <td className="py-2 px-4 text-[var(--text-muted)]">{r.brand}</td>
                              <td className="py-2 px-4 text-right font-mono">{fmtNum(r.total_qty)}</td>
                              <td className="py-2 px-4 text-right font-mono font-bold text-[var(--primary)]">{fmtINR(r.total_value)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t-2 border-[var(--border)] bg-[var(--table-header-bg)]">
                          <tr>
                            <td colSpan={4} className="py-3 px-4 text-[10px] font-extrabold uppercase text-[var(--text-muted)]">Total</td>
                            <td className="py-3 px-4 text-right font-mono font-bold">{fmtNum(s.totalQty)}</td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-[var(--primary)]">{fmtINR(s.totalValue)}</td>
                          </tr>
                        </tfoot>
                      </>
                    )}

                    {activeTab === "warehouse" && (
                      <>
                        <thead>
                          <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                            {["#", "Warehouse / Godown", "Total Qty", "Stock Value"].map(h => (
                              <th key={h} className={`py-2.5 px-4 ${["Total Qty","Stock Value"].includes(h) ? "text-right" : ""}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-light)]">
                          {(data.rows ?? []).map((r: any, i: number) => (
                            <tr key={r.id} className="hover:bg-[var(--table-row-hover)] h-10">
                              <td className="py-2 px-4 text-[var(--text-faint)]">{i + 1}</td>
                              <td className="py-2 px-4 font-bold text-[var(--text-primary)]">{r.name}</td>
                              <td className="py-2 px-4 text-right font-mono">{fmtNum(r.qty)}</td>
                              <td className="py-2 px-4 text-right font-mono font-bold text-[var(--primary)]">{fmtINR(r.value)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t-2 border-[var(--border)] bg-[var(--table-header-bg)]">
                          <tr>
                            <td colSpan={2} className="py-3 px-4 text-[10px] font-extrabold uppercase text-[var(--text-muted)]">Total</td>
                            <td className="py-3 px-4 text-right font-mono font-bold">{fmtNum(s.totalQty)}</td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-[var(--primary)]">{fmtINR(s.totalValue)}</td>
                          </tr>
                        </tfoot>
                      </>
                    )}

                    {activeTab === "design" && (
                      <>
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
                              <td className="py-2 px-3 font-mono font-bold text-[var(--text-primary)]">{r.design_number}</td>
                              <td className="py-2 px-3 max-w-[100px] truncate">{r.design_name}</td>
                              <td className="py-2 px-3 text-[var(--text-muted)]">{r.brand}</td>
                              <td className="py-2 px-3 text-[var(--text-muted)]">{r.colour}</td>
                              <td className="py-2 px-3 text-[var(--text-muted)]">{r.godown}</td>
                              <td className="py-2 px-3 text-right font-mono">{fmtNum(r.quantity)}</td>
                              <td className="py-2 px-3 text-right font-mono">{fmtINR(r.cost_per_piece)}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-[var(--primary)]">{fmtINR(r.value)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t-2 border-[var(--border)] bg-[var(--table-header-bg)]">
                          <tr>
                            <td colSpan={5} className="py-3 px-3 text-[10px] font-extrabold uppercase text-[var(--text-muted)]">Total</td>
                            <td className="py-3 px-3 text-right font-mono font-bold">{fmtNum(s.totalQty)}</td>
                            <td />
                            <td className="py-3 px-3 text-right font-mono font-bold text-[var(--primary)]">{fmtINR(s.totalValue)}</td>
                          </tr>
                        </tfoot>
                      </>
                    )}
                  </table>
                </div>
              </div>

              {/* Charts sidebar */}
              <div className="space-y-4">
                {activeTab === "valuation" && brandChart.length > 0 && (
                  <ChartCard title="Value by Brand">
                    <ReportDonutChart data={brandChart} height={200} innerRadius={50} outerRadius={78} valueFormat="currency" />
                  </ChartCard>
                )}
                {activeTab === "warehouse" && warehouseChart.length > 0 && (
                  <ChartCard title="Warehouse Stock Value">
                    <ReportBarChart
                      data={warehouseChart}
                      xKey="name"
                      bars={[{ key: "total", label: "Value", color: CHART_COLORS[0] }]}
                      height={220}
                    />
                  </ChartCard>
                )}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-2.5">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Stock Summary</h3>
                  {[
                    { label: "Total Stock Value", value: fmtINR(s.totalValue) },
                    { label: "Total Quantity", value: fmtNum(s.totalQty) + " pcs" },
                    { label: activeTab === "warehouse" ? "Warehouses" : "Designs / Items", value: String(s.totalGodowns ?? s.totalDesigns ?? s.totalItems ?? 0) },
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
