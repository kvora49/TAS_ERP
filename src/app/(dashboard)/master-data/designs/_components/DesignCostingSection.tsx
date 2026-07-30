"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Calculator,
  Plus,
  Trash2,
  Save,
  Printer,
  Layers,
  ChevronDown
} from "lucide-react";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";
import { formatCurrency } from "@/lib/utils";

interface FabricCostItem {
  id: string;
  fabric_name: string;
  consumption: number;
  unit: string;
  rate: number;
  total: number;
}

interface TrimCostItem {
  id: string;
  trim_name: string;
  quantity: number;
  rate: number;
  total: number;
}

interface ProcessCostItem {
  id: string;
  process_name: string;
  worker_type: string;
  rate_per_piece: number;
  total: number;
}

const DEFAULT_FABRIC_ITEMS: FabricCostItem[] = [
  { id: "1", fabric_name: "Cotton Denim 12oz", consumption: 1.3, unit: "mtr", rate: 180, total: 234 },
  { id: "2", fabric_name: "Pocketing Fabric", consumption: 0.25, unit: "mtr", rate: 45, total: 11.25 },
];

const DEFAULT_TRIM_ITEMS: TrimCostItem[] = [
  { id: "1", trim_name: "Metal Zipper 7 inch", quantity: 1, rate: 12, total: 12 },
  { id: "2", trim_name: "Brand Metal Buttons", quantity: 4, rate: 3.5, total: 14 },
  { id: "3", trim_name: "Main Label & Wash Care", quantity: 1, rate: 4, total: 4 },
  { id: "4", trim_name: "Polybag Packaging", quantity: 1, rate: 3, total: 3 },
];

const DEFAULT_PROCESS_ITEMS: ProcessCostItem[] = [
  { id: "1", process_name: "Cutting", worker_type: "In-House", rate_per_piece: 12, total: 12 },
  { id: "2", process_name: "Stitching", worker_type: "Contractor", rate_per_piece: 65, total: 65 },
  { id: "3", process_name: "Washing / Dyeing", worker_type: "Specialist", rate_per_piece: 35, total: 35 },
  { id: "4", process_name: "Finishing & Ironing", worker_type: "In-House", rate_per_piece: 8, total: 8 },
  { id: "5", process_name: "Tagging & Packing", worker_type: "In-House", rate_per_piece: 5, total: 5 },
];

export default function DesignCostingSection({ designId }: { designId: string }) {
  const queryClient = useQueryClient();

  const [fabricItems, setFabricItems] = useState<FabricCostItem[]>(DEFAULT_FABRIC_ITEMS);
  const [trimItems, setTrimItems] = useState<TrimCostItem[]>(DEFAULT_TRIM_ITEMS);
  const [processItems, setProcessItems] = useState<ProcessCostItem[]>(DEFAULT_PROCESS_ITEMS);

  const [wastagePercent, setWastagePercent] = useState<number>(3);
  const [freightPerPiece, setFreightPerPiece] = useState<number>(10);
  const [overheadPercent, setOverheadPercent] = useState<number>(5);
  const [targetMarginPercent, setTargetMarginPercent] = useState<number>(30);
  const [notes, setNotes] = useState<string>("");

  // Fetch Costing for designId
  const { data: costingData, isLoading } = useQuery({
    queryKey: ["design-costing-detail", designId],
    queryFn: async () => {
      if (!designId) return { costings: [] };
      const res = await fetch(`/api/master-data/designs/costing?design_id=${designId}`);
      if (!res.ok) return { costings: [] };
      return res.json();
    },
    enabled: !!designId,
  });

  useEffect(() => {
    const costings = costingData?.costings || [];
    if (costings.length > 0) {
      const active = costings.find((c: any) => c.is_active) || costings[0];
      if (active.fabric_items?.length) setFabricItems(active.fabric_items);
      if (active.trims_items?.length) setTrimItems(active.trims_items);
      if (active.process_items?.length) setProcessItems(active.process_items);
      if (active.overheads) {
        setWastagePercent(active.overheads.wastage_percent ?? 3);
        setFreightPerPiece(active.overheads.freight_per_piece ?? 10);
        setOverheadPercent(active.overheads.overhead_percent ?? 5);
        setTargetMarginPercent(active.profit_margin_percent ?? 30);
      }
      if (active.notes) setNotes(active.notes);
    }
  }, [costingData]);

  const saveCostingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/master-data/designs/costing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          design_id: designId,
          fabric_items: fabricItems,
          trims_items: trimItems,
          process_items: processItems,
          overheads: {
            wastage_percent: wastagePercent,
            freight_per_piece: freightPerPiece,
            overhead_percent: overheadPercent,
          },
          total_fabric_cost: totalFabricCost,
          total_trims_cost: totalTrimsCost,
          total_process_cost: totalProcessCost,
          total_overheads_cost: totalOverheadsCost,
          total_cost_per_piece: totalBOMCostPerPiece,
          suggested_sale_price: suggestedSalePrice,
          profit_margin_percent: targetMarginPercent,
          notes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save costing");
      return json;
    },
    onSuccess: () => {
      toast.success("Design costing saved successfully!");
      queryClient.invalidateQueries({ queryKey: ["design-costing-detail", designId] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const totalFabricCost = useMemo(() => {
    return fabricItems.reduce((acc, item) => acc + (Number(item.consumption) * Number(item.rate) || 0), 0);
  }, [fabricItems]);

  const totalTrimsCost = useMemo(() => {
    return trimItems.reduce((acc, item) => acc + (Number(item.quantity) * Number(item.rate) || 0), 0);
  }, [trimItems]);

  const totalProcessCost = useMemo(() => {
    return processItems.reduce((acc, item) => acc + (Number(item.rate_per_piece) || 0), 0);
  }, [processItems]);

  const rawSubtotal = totalFabricCost + totalTrimsCost + totalProcessCost;
  const wastageCost = (rawSubtotal * (wastagePercent || 0)) / 100;
  const overheadCost = (rawSubtotal * (overheadPercent || 0)) / 100;
  const totalOverheadsCost = wastageCost + overheadCost + (freightPerPiece || 0);
  const totalBOMCostPerPiece = rawSubtotal + totalOverheadsCost;

  const suggestedSalePrice = useMemo(() => {
    if (targetMarginPercent >= 100) return totalBOMCostPerPiece * 2;
    return totalBOMCostPerPiece / (1 - (targetMarginPercent || 0) / 100);
  }, [totalBOMCostPerPiece, targetMarginPercent]);

  const updateFabricRow = (index: number, field: keyof FabricCostItem, value: any) => {
    setFabricItems((prev) => {
      const copy = [...prev];
      const row = { ...copy[index], [field]: value };
      row.total = (Number(row.consumption) || 0) * (Number(row.rate) || 0);
      copy[index] = row;
      return copy;
    });
  };

  const addFabricRow = () => {
    setFabricItems((prev) => [
      ...prev,
      { id: Date.now().toString(), fabric_name: "New Fabric", consumption: 1, unit: "mtr", rate: 0, total: 0 },
    ]);
  };

  const removeFabricRow = (index: number) => {
    setFabricItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateTrimRow = (index: number, field: keyof TrimCostItem, value: any) => {
    setTrimItems((prev) => {
      const copy = [...prev];
      const row = { ...copy[index], [field]: value };
      row.total = (Number(row.quantity) || 0) * (Number(row.rate) || 0);
      copy[index] = row;
      return copy;
    });
  };

  const addTrimRow = () => {
    setTrimItems((prev) => [
      ...prev,
      { id: Date.now().toString(), trim_name: "New Accessory", quantity: 1, rate: 0, total: 0 },
    ]);
  };

  const removeTrimRow = (index: number) => {
    setTrimItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateProcessRow = (index: number, field: keyof ProcessCostItem, value: any) => {
    setProcessItems((prev) => {
      const copy = [...prev];
      const row = { ...copy[index], [field]: value };
      row.total = Number(row.rate_per_piece) || 0;
      copy[index] = row;
      return copy;
    });
  };

  const addProcessRow = () => {
    setProcessItems((prev) => [
      ...prev,
      { id: Date.now().toString(), process_name: "New Operation", worker_type: "In-House", rate_per_piece: 0, total: 0 },
    ]);
  };

  const removeProcessRow = (index: number) => {
    setProcessItems((prev) => prev.filter((_, i) => i !== index));
  };

  const inputClass = `
    bg-[var(--input-bg)]
    border border-[var(--input-border)]
    text-[var(--text-primary)]
    placeholder:text-[var(--text-faint)]
    focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent
    rounded-lg px-3 h-10 text-xs
    transition-colors
  `;

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-[var(--shadow-sm)] space-y-6">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-light)] pb-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Calculator className="h-5 w-5 text-amber-500" />
            <span>Design Costing Calculator</span>
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            BOM raw material, accessories, labor rates, overheads, and target selling price for this design
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[var(--text-body)] bg-[var(--page-bg)] border border-[var(--border)] hover:bg-[var(--card-bg)] transition-all cursor-pointer"
          >
            <Printer className="h-4 w-4 inline mr-1" /> Print
          </button>
          <AsyncButton
            variant="primary"
            onClick={() => saveCostingMutation.mutateAsync()}
            className="px-4 py-2 rounded-xl text-xs font-semibold"
          >
            <Save className="h-4 w-4 inline mr-1" /> Save Costing
          </AsyncButton>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-3.5">
          <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Fabric Cost</p>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">{formatCurrency(totalFabricCost)}</h3>
        </div>
        <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-3.5">
          <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Trims Cost</p>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">{formatCurrency(totalTrimsCost)}</h3>
        </div>
        <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-3.5">
          <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Labor Operations</p>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">{formatCurrency(totalProcessCost)}</h3>
        </div>
        <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-3.5">
          <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Overheads</p>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">{formatCurrency(totalOverheadsCost)}</h3>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl p-3.5">
          <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase">Total Cost / Piece</p>
          <h3 className="text-xl font-extrabold text-amber-700 dark:text-amber-300">{formatCurrency(totalBOMCostPerPiece)}</h3>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl p-3.5">
          <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">Target Price</p>
          <h3 className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300">{formatCurrency(suggestedSalePrice)}</h3>
        </div>
      </div>

      {/* 4 Costing Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 1. Fabric Cost Table */}
        <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">1. Fabric & Raw Materials</h3>
            <button onClick={addFabricRow} className="text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer">
              + Add Row
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-muted)] uppercase font-semibold">
                  <th className="pb-1.5">Material</th>
                  <th className="pb-1.5 w-20">Qty</th>
                  <th className="pb-1.5 w-16">Unit</th>
                  <th className="pb-1.5 w-20">Rate</th>
                  <th className="pb-1.5 w-20 text-right">Cost</th>
                  <th className="pb-1.5 w-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-light)]">
                {fabricItems.map((item, idx) => (
                  <tr key={item.id || idx}>
                    <td className="py-1.5 pr-1">
                      <input
                        type="text"
                        value={item.fabric_name}
                        onChange={(e) => updateFabricRow(idx, "fabric_name", e.target.value)}
                        className={`${inputClass} w-full h-8`}
                      />
                    </td>
                    <td className="py-1.5 pr-1">
                      <input
                        type="number"
                        step="0.01"
                        value={item.consumption}
                        onChange={(e) => updateFabricRow(idx, "consumption", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} w-full h-8`}
                      />
                    </td>
                    <td className="py-1.5 pr-1">
                      <select
                        value={item.unit}
                        onChange={(e) => updateFabricRow(idx, "unit", e.target.value)}
                        className={`${inputClass} w-full h-8 px-1`}
                      >
                        <option value="mtr">mtr</option>
                        <option value="kg">kg</option>
                      </select>
                    </td>
                    <td className="py-1.5 pr-1">
                      <input
                        type="number"
                        step="1"
                        value={item.rate}
                        onChange={(e) => updateFabricRow(idx, "rate", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} w-full h-8`}
                      />
                    </td>
                    <td className="py-1.5 text-right font-bold">{formatCurrency(item.total)}</td>
                    <td className="py-1.5 text-center">
                      <button onClick={() => removeFabricRow(idx)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between pt-2 border-t border-[var(--border)] font-bold text-xs">
            <span>Total Fabric:</span>
            <span className="text-[var(--primary)]">{formatCurrency(totalFabricCost)}</span>
          </div>
        </div>

        {/* 2. Trims Cost Table */}
        <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">2. Trims & Accessories</h3>
            <button onClick={addTrimRow} className="text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer">
              + Add Row
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-muted)] uppercase font-semibold">
                  <th className="pb-1.5">Item</th>
                  <th className="pb-1.5 w-20">Qty/Pcs</th>
                  <th className="pb-1.5 w-20">Rate</th>
                  <th className="pb-1.5 w-20 text-right">Cost</th>
                  <th className="pb-1.5 w-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-light)]">
                {trimItems.map((item, idx) => (
                  <tr key={item.id || idx}>
                    <td className="py-1.5 pr-1">
                      <input
                        type="text"
                        value={item.trim_name}
                        onChange={(e) => updateTrimRow(idx, "trim_name", e.target.value)}
                        className={`${inputClass} w-full h-8`}
                      />
                    </td>
                    <td className="py-1.5 pr-1">
                      <input
                        type="number"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => updateTrimRow(idx, "quantity", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} w-full h-8`}
                      />
                    </td>
                    <td className="py-1.5 pr-1">
                      <input
                        type="number"
                        step="0.5"
                        value={item.rate}
                        onChange={(e) => updateTrimRow(idx, "rate", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} w-full h-8`}
                      />
                    </td>
                    <td className="py-1.5 text-right font-bold">{formatCurrency(item.total)}</td>
                    <td className="py-1.5 text-center">
                      <button onClick={() => removeTrimRow(idx)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between pt-2 border-t border-[var(--border)] font-bold text-xs">
            <span>Total Trims:</span>
            <span className="text-[var(--primary)]">{formatCurrency(totalTrimsCost)}</span>
          </div>
        </div>

        {/* 3. Labor Operations Table */}
        <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">3. Labor Operations</h3>
            <button onClick={addProcessRow} className="text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer">
              + Add Row
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-muted)] uppercase font-semibold">
                  <th className="pb-1.5">Operation</th>
                  <th className="pb-1.5 w-24">Worker Type</th>
                  <th className="pb-1.5 w-24 text-right">Rate / Pcs</th>
                  <th className="pb-1.5 w-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-light)]">
                {processItems.map((item, idx) => (
                  <tr key={item.id || idx}>
                    <td className="py-1.5 pr-1">
                      <input
                        type="text"
                        value={item.process_name}
                        onChange={(e) => updateProcessRow(idx, "process_name", e.target.value)}
                        className={`${inputClass} w-full h-8`}
                      />
                    </td>
                    <td className="py-1.5 pr-1">
                      <input
                        type="text"
                        value={item.worker_type}
                        onChange={(e) => updateProcessRow(idx, "worker_type", e.target.value)}
                        className={`${inputClass} w-full h-8`}
                      />
                    </td>
                    <td className="py-1.5 pr-1">
                      <input
                        type="number"
                        step="1"
                        value={item.rate_per_piece}
                        onChange={(e) => updateProcessRow(idx, "rate_per_piece", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} w-full h-8 text-right font-bold`}
                      />
                    </td>
                    <td className="py-1.5 text-center">
                      <button onClick={() => removeProcessRow(idx)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between pt-2 border-t border-[var(--border)] font-bold text-xs">
            <span>Total Labor:</span>
            <span className="text-[var(--primary)]">{formatCurrency(totalProcessCost)}</span>
          </div>
        </div>

        {/* 4. Overheads & Profit Target */}
        <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">4. Overheads & Profit Target</h3>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[11px] text-[var(--text-muted)] block mb-0.5">Wastage (%)</label>
              <input
                type="number"
                value={wastagePercent}
                onChange={(e) => setWastagePercent(parseFloat(e.target.value) || 0)}
                className={`${inputClass} w-full`}
              />
            </div>
            <div>
              <label className="text-[11px] text-[var(--text-muted)] block mb-0.5">Freight (₹/pcs)</label>
              <input
                type="number"
                value={freightPerPiece}
                onChange={(e) => setFreightPerPiece(parseFloat(e.target.value) || 0)}
                className={`${inputClass} w-full`}
              />
            </div>
            <div>
              <label className="text-[11px] text-[var(--text-muted)] block mb-0.5">Overheads (%)</label>
              <input
                type="number"
                value={overheadPercent}
                onChange={(e) => setOverheadPercent(parseFloat(e.target.value) || 0)}
                className={`${inputClass} w-full`}
              />
            </div>
            <div>
              <label className="text-[11px] text-[var(--text-muted)] block mb-0.5">Profit Margin (%)</label>
              <input
                type="number"
                value={targetMarginPercent}
                onChange={(e) => setTargetMarginPercent(parseFloat(e.target.value) || 0)}
                className={`${inputClass} w-full font-bold text-[var(--primary)]`}
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-[var(--text-muted)] block mb-0.5">Costing Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add costing notes or remarks..."
              rows={2}
              className={`${inputClass} w-full h-auto py-1.5`}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
