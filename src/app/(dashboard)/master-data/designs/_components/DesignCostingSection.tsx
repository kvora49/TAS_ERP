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
} from "lucide-react";
import AsyncButton from "@/components/shared/AsyncButton";
import { formatCurrency, cn } from "@/lib/utils";

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

export default function DesignCostingSection({ designId, onSave }: { designId: string; onSave?: () => void }) {
  const queryClient = useQueryClient();

  const [fabricItems, setFabricItems] = useState<FabricCostItem[]>([]);
  const [trimItems, setTrimItems] = useState<TrimCostItem[]>([]);
  const [processItems, setProcessItems] = useState<ProcessCostItem[]>([]);

  const [wastagePercent, setWastagePercent] = useState<number>(0);
  const [freightPerPiece, setFreightPerPiece] = useState<number>(0);
  const [overheadPercent, setOverheadPercent] = useState<number>(0);
  const [targetMarginPercent, setTargetMarginPercent] = useState<number>(30);
  const [notes, setNotes] = useState<string>("");
  const [importingLot, setImportingLot] = useState<boolean>(false);

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

  const loadAutoPopulatedCosting = async () => {
    if (!designId) return;
    setImportingLot(true);
    try {
      const res = await fetch(`/api/master-data/designs/costing/auto-populate?design_id=${designId}`);
      const json = await res.json();
      if (res.ok) {
        if (json.fabric_items?.length) setFabricItems(json.fabric_items);
        if (json.trims_items?.length) setTrimItems(json.trims_items);
        if (json.process_items?.length) setProcessItems(json.process_items);
        if (json.overheads) {
          setWastagePercent(json.overheads.wastage_percent ?? 0);
          setFreightPerPiece(json.overheads.freight_per_piece ?? 0);
          setOverheadPercent(json.overheads.overhead_percent ?? 0);
          setTargetMarginPercent(json.profit_margin_percent ?? 30);
        }
        if (json.has_lots) {
          toast.success(`Auto-populated BOM from ${json.lot_count} production lot(s)`);
        } else {
          toast.info("No production lot data found. Starting with a blank BOM template.");
        }
      }
    } catch (err) {
      console.error("Auto-populate error:", err);
    } finally {
      setImportingLot(false);
    }
  };

  useEffect(() => {
    const costings = costingData?.costings || [];
    if (costings.length > 0) {
      const active = costings.find((c: any) => c.is_active) || costings[0];
      setFabricItems(active.fabric_items || []);
      setTrimItems(active.trims_items || []);
      setProcessItems(active.process_items || []);
      if (active.overheads) {
        setWastagePercent(active.overheads.wastage_percent ?? 0);
        setFreightPerPiece(active.overheads.freight_per_piece ?? 0);
        setOverheadPercent(active.overheads.overhead_percent ?? 0);
        setTargetMarginPercent(active.profit_margin_percent ?? active.overheads.profit_margin_percent ?? 30);
      }
      if (active.notes) setNotes(active.notes);
    } else if (costingData && !isLoading) {
      loadAutoPopulatedCosting();
    }
  }, [costingData, isLoading, designId]);

  const handleImportFromProductionLot = async () => {
    await loadAutoPopulatedCosting();
  };

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
      toast.success("Design BOM Costing updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["design-costing-detail", designId] });
      onSave?.();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save costing");
    },
  });

  // Calculate totals
  const totalFabricCost = useMemo(() => {
    return fabricItems.reduce((acc, curr) => acc + (curr.total || 0), 0);
  }, [fabricItems]);

  const totalTrimsCost = useMemo(() => {
    return trimItems.reduce((acc, curr) => acc + (curr.total || 0), 0);
  }, [trimItems]);

  const totalProcessCost = useMemo(() => {
    return processItems.reduce((acc, curr) => acc + (curr.total || 0), 0);
  }, [processItems]);

  const directMaterialCost = totalFabricCost + totalTrimsCost;
  const wastageCost = directMaterialCost * (wastagePercent / 100);
  const overheadPercentageCost = (directMaterialCost + totalProcessCost) * (overheadPercent / 100);
  const totalOverheadsCost = wastageCost + overheadPercentageCost + freightPerPiece;
  const totalBOMCostPerPiece = directMaterialCost + totalProcessCost + totalOverheadsCost;
  const suggestedSalePrice = targetMarginPercent < 100
    ? totalBOMCostPerPiece / (1 - (targetMarginPercent / 100))
    : totalBOMCostPerPiece * 1.3;

  // Handlers for dynamic rows
  const addFabricRow = () => {
    setFabricItems([
      ...fabricItems,
      { id: Math.random().toString(), fabric_name: "", consumption: 1, unit: "mtr", rate: 0, total: 0 },
    ]);
  };

  const updateFabricRow = (index: number, field: keyof FabricCostItem, value: any) => {
    const updated = [...fabricItems];
    const item = { ...updated[index], [field]: value };
    item.total = (Number(item.consumption) || 0) * (Number(item.rate) || 0);
    updated[index] = item;
    setFabricItems(updated);
  };

  const removeFabricRow = (index: number) => {
    setFabricItems(fabricItems.filter((_, idx) => idx !== index));
  };

  const addTrimRow = () => {
    setTrimItems([
      ...trimItems,
      { id: Math.random().toString(), trim_name: "", quantity: 1, rate: 0, total: 0 },
    ]);
  };

  const updateTrimRow = (index: number, field: keyof TrimCostItem, value: any) => {
    const updated = [...trimItems];
    const item = { ...updated[index], [field]: value };
    item.total = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
    updated[index] = item;
    setTrimItems(updated);
  };

  const removeTrimRow = (index: number) => {
    setTrimItems(trimItems.filter((_, idx) => idx !== index));
  };

  const addProcessRow = () => {
    setProcessItems([
      ...processItems,
      { id: Math.random().toString(), process_name: "", worker_type: "Job Worker", rate_per_piece: 0, total: 0 },
    ]);
  };

  const updateProcessRow = (index: number, field: keyof ProcessCostItem, value: any) => {
    const updated = [...processItems];
    const item = { ...updated[index], [field]: value };
    item.total = Number(item.rate_per_piece) || 0;
    updated[index] = item;
    setProcessItems(updated);
  };

  const removeProcessRow = (index: number) => {
    setProcessItems(processItems.filter((_, idx) => idx !== index));
  };

  const inputClass = `
    bg-[var(--input-bg)]
    border border-[var(--input-border)]
    text-[var(--text-primary)]
    placeholder:text-[var(--text-faint)]
    focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)] focus:border-transparent
    rounded-lg px-2.5 h-8 text-xs font-semibold
    transition-colors
  `;

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-3.5 sm:p-5 shadow-[var(--shadow-sm)] space-y-4">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-light)] pb-3">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Calculator className="h-4 w-4 text-amber-500" />
            <span>Design Costing Calculator</span>
          </h2>
          <p className="text-[11px] sm:text-xs text-[var(--text-muted)] mt-0.5">
            Bill of Materials (BOM), accessories, processes & profit margin
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleImportFromProductionLot}
            disabled={importingLot}
            className="h-8 sm:h-9 px-3 rounded-xl text-xs font-semibold text-[var(--primary)] bg-[var(--page-bg)] border border-[var(--border)] hover:bg-[var(--table-row-hover)] transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <Layers className={cn("h-3.5 w-3.5", importingLot && "animate-spin")} />
            <span>Import Lot</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="hidden sm:inline-flex h-8 sm:h-9 px-3 rounded-xl text-xs font-semibold text-[var(--text-secondary)] bg-[var(--page-bg)] border border-[var(--border)] hover:bg-[var(--table-row-hover)] transition-all cursor-pointer items-center gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print</span>
          </button>

          <AsyncButton
            variant="primary"
            onClick={() => saveCostingMutation.mutateAsync()}
            isLoading={saveCostingMutation.isPending}
            className="h-8 sm:h-9 px-3.5 rounded-xl text-xs font-bold"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save</span>
          </AsyncButton>
        </div>
      </div>

      {/* KPI Cards Grid (Compact 2x3 or 3x2 on mobile, 6-col on lg) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
        <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-2.5 sm:p-3">
          <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase truncate">Fabric Cost</p>
          <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate mt-0.5">
            {formatCurrency(totalFabricCost)}
          </h3>
        </div>

        <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-2.5 sm:p-3">
          <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase truncate">Trims Cost</p>
          <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate mt-0.5">
            {formatCurrency(totalTrimsCost)}
          </h3>
        </div>

        <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-2.5 sm:p-3">
          <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase truncate">Labor / Process</p>
          <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate mt-0.5">
            {formatCurrency(totalProcessCost)}
          </h3>
        </div>

        <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-2.5 sm:p-3">
          <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase truncate">Overheads</p>
          <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate mt-0.5">
            {formatCurrency(totalOverheadsCost)}
          </h3>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 sm:p-3">
          <p className="text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase truncate">Total Cost / Pc</p>
          <h3 className="text-sm sm:text-base font-extrabold text-amber-700 dark:text-amber-400 truncate mt-0.5">
            {formatCurrency(totalBOMCostPerPiece)}
          </h3>
        </div>

        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 sm:p-3">
          <p className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 uppercase truncate">Target Price</p>
          <h3 className="text-sm sm:text-base font-extrabold text-emerald-700 dark:text-emerald-400 truncate mt-0.5">
            {formatCurrency(suggestedSalePrice)}
          </h3>
        </div>
      </div>

      {/* 4 Costing Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. Fabric Cost Table */}
        <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
              1. Fabric & Raw Materials
            </h3>
            <button
              type="button"
              onClick={addFabricRow}
              className="text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer flex items-center gap-1"
            >
              <Plus size={13} /> Add Row
            </button>
          </div>

          {/* Mobile Cards View (block md:hidden) - Zero horizontal cut-off */}
          <div className="block md:hidden space-y-2">
            {fabricItems.length === 0 ? (
              <p className="text-xs text-[var(--text-faint)] italic py-2 text-center">No fabric rows added</p>
            ) : (
              fabricItems.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="bg-[var(--card-bg)] p-2.5 rounded-lg border border-[var(--border)] space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Fabric/Material Name"
                      value={item.fabric_name}
                      onChange={(e) => updateFabricRow(idx, "fabric_name", e.target.value)}
                      className={`${inputClass} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() => removeFabricRow(idx)}
                      className="w-7 h-7 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center shrink-0 cursor-pointer"
                      title="Remove row"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 items-center text-xs">
                    <div>
                      <span className="text-[9px] font-bold text-[var(--text-muted)] block">Qty</span>
                      <input
                        type="number"
                        step="0.01"
                        value={item.consumption}
                        onChange={(e) => updateFabricRow(idx, "consumption", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} w-full`}
                      />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-[var(--text-muted)] block">Rate (₹)</span>
                      <input
                        type="number"
                        step="1"
                        value={item.rate}
                        onChange={(e) => updateFabricRow(idx, "rate", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} w-full`}
                      />
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-bold text-[var(--text-muted)] block">Cost</span>
                      <span className="font-bold text-[var(--text-primary)] text-xs block py-1">
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View (hidden md:block) */}
          <div className="hidden md:block overflow-x-auto">
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
                        className={`${inputClass} w-full`}
                      />
                    </td>
                    <td className="py-1.5 pr-1">
                      <input
                        type="number"
                        step="0.01"
                        value={item.consumption}
                        onChange={(e) => updateFabricRow(idx, "consumption", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} w-full`}
                      />
                    </td>
                    <td className="py-1.5 pr-1">
                      <select
                        value={item.unit}
                        onChange={(e) => updateFabricRow(idx, "unit", e.target.value)}
                        className={`${inputClass} w-full px-1`}
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
                        className={`${inputClass} w-full`}
                      />
                    </td>
                    <td className="py-1.5 text-right font-bold text-[var(--text-primary)]">
                      {formatCurrency(item.total)}
                    </td>
                    <td className="py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeFabricRow(idx)}
                        className="text-red-500 hover:text-red-700 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between pt-2 border-t border-[var(--border)] font-bold text-xs">
            <span className="text-[var(--text-secondary)]">Total Fabric:</span>
            <span className="text-[var(--primary)]">{formatCurrency(totalFabricCost)}</span>
          </div>
        </div>

        {/* 2. Trims Cost Table */}
        <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
              2. Trims & Accessories
            </h3>
            <button
              type="button"
              onClick={addTrimRow}
              className="text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer flex items-center gap-1"
            >
              <Plus size={13} /> Add Row
            </button>
          </div>

          {/* Mobile Cards View (block md:hidden) */}
          <div className="block md:hidden space-y-2">
            {trimItems.length === 0 ? (
              <p className="text-xs text-[var(--text-faint)] italic py-2 text-center">No trims added</p>
            ) : (
              trimItems.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="bg-[var(--card-bg)] p-2.5 rounded-lg border border-[var(--border)] space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Trim Name (e.g. Button, Zipper)"
                      value={item.trim_name}
                      onChange={(e) => updateTrimRow(idx, "trim_name", e.target.value)}
                      className={`${inputClass} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() => removeTrimRow(idx)}
                      className="w-7 h-7 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center shrink-0 cursor-pointer"
                      title="Remove row"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 items-center text-xs">
                    <div>
                      <span className="text-[9px] font-bold text-[var(--text-muted)] block">Qty</span>
                      <input
                        type="number"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => updateTrimRow(idx, "quantity", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} w-full`}
                      />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-[var(--text-muted)] block">Rate (₹)</span>
                      <input
                        type="number"
                        step="0.5"
                        value={item.rate}
                        onChange={(e) => updateTrimRow(idx, "rate", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} w-full`}
                      />
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-bold text-[var(--text-muted)] block">Cost</span>
                      <span className="font-bold text-[var(--text-primary)] text-xs block py-1">
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View (hidden md:block) */}
          <div className="hidden md:block overflow-x-auto">
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
                        className={`${inputClass} w-full`}
                      />
                    </td>
                    <td className="py-1.5 pr-1">
                      <input
                        type="number"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => updateTrimRow(idx, "quantity", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} w-full`}
                      />
                    </td>
                    <td className="py-1.5 pr-1">
                      <input
                        type="number"
                        step="0.5"
                        value={item.rate}
                        onChange={(e) => updateTrimRow(idx, "rate", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} w-full`}
                      />
                    </td>
                    <td className="py-1.5 text-right font-bold text-[var(--text-primary)]">
                      {formatCurrency(item.total)}
                    </td>
                    <td className="py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeTrimRow(idx)}
                        className="text-red-500 hover:text-red-700 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between pt-2 border-t border-[var(--border)] font-bold text-xs">
            <span className="text-[var(--text-secondary)]">Total Trims:</span>
            <span className="text-[var(--primary)]">{formatCurrency(totalTrimsCost)}</span>
          </div>
        </div>

        {/* 3. Labor Operations Table */}
        <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
              3. Labor Operations
            </h3>
            <button
              type="button"
              onClick={addProcessRow}
              className="text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer flex items-center gap-1"
            >
              <Plus size={13} /> Add Row
            </button>
          </div>

          {/* Mobile Cards View (block md:hidden) */}
          <div className="block md:hidden space-y-2">
            {processItems.length === 0 ? (
              <p className="text-xs text-[var(--text-faint)] italic py-2 text-center">No operations added</p>
            ) : (
              processItems.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="bg-[var(--card-bg)] p-2.5 rounded-lg border border-[var(--border)] space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Operation (e.g. Stitching, QC)"
                      value={item.process_name}
                      onChange={(e) => updateProcessRow(idx, "process_name", e.target.value)}
                      className={`${inputClass} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() => removeProcessRow(idx)}
                      className="w-7 h-7 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center shrink-0 cursor-pointer"
                      title="Remove row"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[9px] font-bold text-[var(--text-muted)] block">Worker Type</span>
                      <input
                        type="text"
                        placeholder="Worker/Role"
                        value={item.worker_type}
                        onChange={(e) => updateProcessRow(idx, "worker_type", e.target.value)}
                        className={`${inputClass} w-full`}
                      />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-[var(--text-muted)] block">Rate / Pc (₹)</span>
                      <input
                        type="number"
                        step="1"
                        value={item.rate_per_piece}
                        onChange={(e) => updateProcessRow(idx, "rate_per_piece", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} w-full font-bold text-[var(--text-primary)]`}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View (hidden md:block) */}
          <div className="hidden md:block overflow-x-auto">
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
                        className={`${inputClass} w-full`}
                      />
                    </td>
                    <td className="py-1.5 pr-1">
                      <input
                        type="text"
                        value={item.worker_type}
                        onChange={(e) => updateProcessRow(idx, "worker_type", e.target.value)}
                        className={`${inputClass} w-full`}
                      />
                    </td>
                    <td className="py-1.5 pr-1">
                      <input
                        type="number"
                        step="1"
                        value={item.rate_per_piece}
                        onChange={(e) => updateProcessRow(idx, "rate_per_piece", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} w-full text-right font-bold`}
                      />
                    </td>
                    <td className="py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeProcessRow(idx)}
                        className="text-red-500 hover:text-red-700 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between pt-2 border-t border-[var(--border)] font-bold text-xs">
            <span className="text-[var(--text-secondary)]">Total Labor:</span>
            <span className="text-[var(--primary)]">{formatCurrency(totalProcessCost)}</span>
          </div>
        </div>

        {/* 4. Overheads & Profit Target */}
        <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-3.5 space-y-2.5">
          <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
            4. Overheads & Margin
          </h3>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-[10px] font-bold text-[var(--text-muted)] block mb-0.5">Wastage (%)</label>
              <input
                type="number"
                value={wastagePercent}
                onChange={(e) => setWastagePercent(parseFloat(e.target.value) || 0)}
                className={`${inputClass} w-full`}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[var(--text-muted)] block mb-0.5">Freight (₹/pc)</label>
              <input
                type="number"
                value={freightPerPiece}
                onChange={(e) => setFreightPerPiece(parseFloat(e.target.value) || 0)}
                className={`${inputClass} w-full`}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[var(--text-muted)] block mb-0.5">Overhead (%)</label>
              <input
                type="number"
                value={overheadPercent}
                onChange={(e) => setOverheadPercent(parseFloat(e.target.value) || 0)}
                className={`${inputClass} w-full`}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[var(--text-muted)] block mb-0.5">Margin (%)</label>
              <input
                type="number"
                value={targetMarginPercent}
                onChange={(e) => setTargetMarginPercent(parseFloat(e.target.value) || 0)}
                className={`${inputClass} w-full font-bold text-[var(--primary)]`}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-[var(--text-muted)] block mb-0.5">Costing Remarks</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add costing notes or scope details..."
              rows={2}
              className={`${inputClass} w-full h-auto py-1.5 resize-none`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
