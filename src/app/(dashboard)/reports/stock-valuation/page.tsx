"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Package, Archive } from "lucide-react";
import PageState from "@/components/shared/PageState";

export default function StockValuationPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["report-stock-valuation"],
    queryFn: async () => {
      const res = await fetch("/api/reports/stock-valuation");
      if (!res.ok) throw new Error("Failed to load report");
      return res.json();
    },
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n || 0);
  const fmtQty = (n: number, unit: string) =>
    `${new Intl.NumberFormat("en-IN").format(n || 0)} ${unit}`;

  return (
    <PageState isLoading={isLoading} error={error?.message}>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Stock Valuation Report</h1>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Reports / Inventory Reports — As of {data?.asOf || "today"}
            </p>
          </div>
        </div>

        {data && (
          <div className="space-y-5">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-slate-100 rounded-lg"><Package className="h-6 w-6 text-slate-600" /></div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Raw Material Value</span>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">{fmt(data.totalRMValue)}</p>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-blue-50 rounded-lg"><Archive className="h-6 w-6 text-blue-600" /></div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Finished Goods Value</span>
                  <p className="text-xl font-bold text-blue-600 mt-0.5">{fmt(data.totalFGValue)}</p>
                </div>
              </div>
              <div className="bg-slate-900 text-white border border-slate-800 rounded-xl p-5 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total Inventory Value</span>
                <p className="text-2xl font-extrabold mt-0.5">{fmt(data.totalValue)}</p>
              </div>
            </div>

            {/* Items Table */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-gray-200 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-3 px-6">Item Name</th>
                      <th className="py-3 px-6">Category</th>
                      <th className="py-3 px-6 text-right">Qty in Stock</th>
                      <th className="py-3 px-6 text-right">Unit Cost</th>
                      <th className="py-3 px-6 text-right">Total Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium text-slate-700">
                    {(data.items || []).length === 0 ? (
                      <tr><td colSpan={5} className="py-10 text-center text-slate-400">No stock items found.</td></tr>
                    ) : (
                      (data.items || []).map((item: any) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 h-12">
                          <td className="py-3 px-6 font-bold text-slate-900">{item.name}</td>
                          <td className="py-3 px-6">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                              item.category === "Raw Material"
                                ? "bg-amber-50 text-amber-700 border-amber-100"
                                : "bg-blue-50 text-blue-700 border-blue-100"
                            }`}>{item.category}</span>
                          </td>
                          <td className="py-3 px-6 text-right font-mono">{fmtQty(item.quantity, item.unit)}</td>
                          <td className="py-3 px-6 text-right font-mono">{fmt(item.unit_cost)}</td>
                          <td className="py-3 px-6 text-right font-bold font-mono text-slate-900">{fmt(item.total_value)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-300 bg-slate-50 font-bold text-xs">
                    <tr>
                      <td colSpan={4} className="py-3 px-6 uppercase tracking-wide text-slate-500">Total Inventory Value</td>
                      <td className="py-3 px-6 text-right font-mono font-extrabold text-slate-900">{fmt(data.totalValue)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageState>
  );
}
