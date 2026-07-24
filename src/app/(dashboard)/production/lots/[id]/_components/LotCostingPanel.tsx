"use client";

import { useState } from "react";
import { Shirt, Layers, Settings, DollarSign } from "lucide-react";
import { toast } from "sonner";

interface LotRoll {
  id: string;
  allocated_meters: number;
  purchase_roll?: {
    roll_number: string;
    shade?: string;
    item?: { material_type?: { name: string; unit?: string; }; rate?: number; };
  };
}

interface StageEntry {
  id: string;
  qty_in?: number;
  qty_out?: number;
  wastage_qty?: number;
  job_work_rate?: number;
  stage?: { stage_name: string; };
  worker?: { name: string; };
}

interface Props {
  lotId: string;
  lotRolls: LotRoll[];
  stageEntries: StageEntry[];
  accessoryCost: number;
  otherCost: number;
  savedAccessoryCost: number;
  savedOtherCost: number;
  totalQty: number;
  onCostSaved: () => void;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(val);

export function LotCostingPanel({
  lotId, lotRolls, stageEntries,
  accessoryCost, otherCost,
  savedAccessoryCost, savedOtherCost,
  totalQty, onCostSaved,
}: Props) {
  const [accCost, setAccCost] = useState(accessoryCost);
  const [othCost, setOthCost] = useState(otherCost);
  const [saving, setSaving] = useState(false);

  const totalFabricCost = lotRolls.reduce((acc, curr) => {
    const rate = Number(curr.purchase_roll?.item?.rate || 0);
    return acc + (Number(curr.allocated_meters || 0) * rate);
  }, 0);

  const totalLaborCost = stageEntries.reduce((acc, curr) => {
    return acc + (Number(curr.job_work_rate || 0) * Number(curr.qty_out || 0));
  }, 0);

  const totalLotCost = totalFabricCost + totalLaborCost + Number(savedAccessoryCost || 0) + Number(savedOtherCost || 0);
  const perPieceCost = totalQty > 0 ? (totalLotCost / totalQty) : 0;

  const handleSaveCosts = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/production/lots/${lotId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessory_cost: accCost, other_cost: othCost }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update costing details");
      }
      toast.success("Costing details updated successfully!");
      onCostSaved();
    } catch (err: any) {
      toast.error(err.message || "Error updating costing details");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
      {/* Left: Detail Cards */}
      <div className="lg:col-span-2 space-y-6">

        {/* Fabric Cost */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 uppercase tracking-wider flex items-center gap-2">
            <Shirt className="h-4 w-4 text-indigo-600" />
            1. Allocated Fabric Cost
          </h3>
          {lotRolls.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">No fabric rolls allocated to this production lot.</div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase text-[9px]">
                    <th className="p-2.5">Roll identifier</th>
                    <th className="p-2.5 text-center">Allocated (Mtr)</th>
                    <th className="p-2.5 text-right">Purchase Rate (Mtr)</th>
                    <th className="p-2.5 text-right">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lotRolls.map((roll) => {
                    const rate = Number(roll.purchase_roll?.item?.rate || 0);
                    const cost = Number(roll.allocated_meters || 0) * rate;
                    return (
                      <tr key={roll.id}>
                        <td className="p-2.5 font-semibold text-slate-700">
                          Roll #{roll.purchase_roll?.roll_number} ({roll.purchase_roll?.shade}) - {roll.purchase_roll?.item?.material_type?.name}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-slate-700">
                          {roll.allocated_meters} {roll.purchase_roll?.item?.material_type?.unit || "Mtr"}
                        </td>
                        <td className="p-2.5 text-right font-mono text-slate-600">{formatCurrency(rate)}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-800">{formatCurrency(cost)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50/50 font-bold">
                    <td className="p-2.5 text-slate-800">Total Fabric Cost</td>
                    <td className="p-2.5 text-center font-mono">{lotRolls.reduce((a, b) => a + Number(b.allocated_meters), 0).toFixed(1)} Mtr</td>
                    <td className="p-2.5" />
                    <td className="p-2.5 text-right font-mono text-indigo-700">{formatCurrency(totalFabricCost)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Labor Cost */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 uppercase tracking-wider flex items-center gap-2">
            <Layers className="h-4 w-4 text-green-600" />
            2. Production Labor / Job-Work Cost
          </h3>
          {stageEntries.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">No stage entries logged with labor costs.</div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase text-[9px]">
                    <th className="p-2.5">Stage</th>
                    <th className="p-2.5">Worker Name</th>
                    <th className="p-2.5 text-center">Qty Produced</th>
                    <th className="p-2.5 text-right">Job-Work Rate</th>
                    <th className="p-2.5 text-right">Subtotal Labor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stageEntries.map((entry) => {
                    const qty = Number(entry.qty_out || 0);
                    const rate = Number(entry.job_work_rate || 0);
                    return (
                      <tr key={entry.id}>
                        <td className="p-2.5 font-semibold text-slate-700">{entry.stage?.stage_name}</td>
                        <td className="p-2.5 text-slate-500">{entry.worker?.name || "General"}</td>
                        <td className="p-2.5 text-center font-mono font-bold text-slate-700">{qty} pcs</td>
                        <td className="p-2.5 text-right font-mono text-slate-600">{formatCurrency(rate)}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-800">{formatCurrency(qty * rate)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50/50 font-bold">
                    <td className="p-2.5 text-slate-800" colSpan={2}>Total Labor Cost</td>
                    <td className="p-2.5 text-center font-mono">{stageEntries.reduce((a, b) => a + Number(b.qty_out || 0), 0)} pcs</td>
                    <td className="p-2.5" />
                    <td className="p-2.5 text-right font-mono text-green-700">{formatCurrency(totalLaborCost)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Accessory & Other Costs Editor */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 uppercase tracking-wider flex items-center gap-2">
            <Settings className="h-4 w-4 text-amber-600" />
            3. Accessory &amp; Other Custom Costs
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="accessory-cost" className="block text-[10px] font-bold text-slate-500 uppercase">Accessory Costs (INR)</label>
              <input
                id="accessory-cost" type="number" min="0" step="0.01"
                value={accCost || ""}
                onChange={(e) => setAccCost(parseFloat(e.target.value) || 0)}
                placeholder="e.g. Buttons, thread, labels"
                className="w-full h-10 rounded-lg border border-slate-200 px-3 text-xs focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="other-cost" className="block text-[10px] font-bold text-slate-500 uppercase">Other / Transport Costs (INR)</label>
              <input
                id="other-cost" type="number" min="0" step="0.01"
                value={othCost || ""}
                onChange={(e) => setOthCost(parseFloat(e.target.value) || 0)}
                placeholder="e.g. Packing, logistics"
                className="w-full h-10 rounded-lg border border-slate-200 px-3 text-xs focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="button" onClick={handleSaveCosts} disabled={saving}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Custom Costs"}
            </button>
          </div>
        </div>
      </div>

      {/* Right: Summary */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-5">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 uppercase tracking-wider flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-indigo-600" />
            Overall Lot Costing
          </h3>
          <div className="space-y-3 text-xs">
            {[
              { label: "Fabric Consumption Cost:", val: formatCurrency(totalFabricCost) },
              { label: "Total Labor Cost:", val: formatCurrency(totalLaborCost) },
              { label: "Accessory Cost:", val: formatCurrency(savedAccessoryCost || 0) },
              { label: "Other Costs:", val: formatCurrency(savedOtherCost || 0) },
            ].map(({ label, val }) => (
              <div key={label} className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">{label}</span>
                <span className="font-semibold text-slate-800 font-mono">{val}</span>
              </div>
            ))}
            <div className="flex justify-between py-3 border-b border-slate-200 text-sm font-black bg-indigo-50/20 px-2 rounded">
              <span className="text-indigo-900">Total Lot Cost:</span>
              <span className="text-indigo-700 font-mono">{formatCurrency(totalLotCost)}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-slate-200 text-sm font-black bg-emerald-50/20 px-2 rounded">
              <span className="text-emerald-900">Per-Piece Cost:</span>
              <span className="text-emerald-700 font-mono">{formatCurrency(perPieceCost)} / pc</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
