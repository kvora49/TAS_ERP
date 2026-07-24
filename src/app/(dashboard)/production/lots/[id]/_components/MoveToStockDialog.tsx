"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Calculator, PieChart, Layers, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface Godown { id: string; name: string; }
interface LotRoll {
  id: string;
  purchase_roll_id: string;
  allocated_meters: number;
  purchase_roll?: { roll_number: string; shade?: string; };
}

interface Props {
  open: boolean;
  onClose: () => void;
  lotId: string;
  designCode?: string;
  totalQty: number;
  godowns: Godown[];
  lotRolls: LotRoll[];
  avgMetersPerPiece?: number;
  onSuccess: () => void;
}

export function MoveToStockDialog({
  open,
  onClose,
  lotId,
  designCode,
  totalQty,
  godowns,
  lotRolls,
  avgMetersPerPiece,
  onSuccess,
}: Props) {
  const [targetGodownId, setTargetGodownId] = useState("");
  const [rollUsages, setRollUsages] = useState<Record<string, number>>({});
  const [allocationMode, setAllocationMode] = useState<"proportional" | "fifo" | "full">("proportional");
  const [moving, setMoving] = useState(false);

  const totalAllocatedMeters = lotRolls.reduce((acc, r) => acc + Number(r.allocated_meters || 0), 0);
  
  // Default avg meters per piece from props or historical ratio or fallback 1.2m
  const defaultAvg = avgMetersPerPiece && avgMetersPerPiece > 0
    ? avgMetersPerPiece
    : totalQty > 0 && totalAllocatedMeters > 0
    ? Number((totalAllocatedMeters / totalQty).toFixed(3))
    : 1.2;

  const [avgMeters, setAvgMeters] = useState<number>(defaultAvg);

  // Helper function to calculate roll usages based on strategy
  const calculateRollUsages = useCallback(
    (mode: "proportional" | "fifo" | "full", currentAvg: number) => {
      if (lotRolls.length === 0) return {};

      const targetConsumption = Math.min(
        totalAllocatedMeters,
        Number((totalQty * (currentAvg || 1.2)).toFixed(2))
      );

      const result: Record<string, number> = {};

      if (mode === "proportional") {
        // Distribute proportionally based on each roll's allocated share
        const overallRatio = totalAllocatedMeters > 0 ? targetConsumption / totalAllocatedMeters : 0;
        lotRolls.forEach((r) => {
          const allocated = Number(r.allocated_meters || 0);
          const used = Math.min(allocated, Number((allocated * overallRatio).toFixed(2)));
          result[r.purchase_roll_id] = used;
        });
      } else if (mode === "fifo") {
        // Sequential filling: Roll 1 full, then Roll 2...
        let remaining = targetConsumption;
        lotRolls.forEach((r) => {
          const allocated = Number(r.allocated_meters || 0);
          const used = Math.min(allocated, Math.max(0, remaining));
          result[r.purchase_roll_id] = Number(used.toFixed(2));
          remaining -= used;
        });
      } else if (mode === "full") {
        // 100% usage on all rolls
        lotRolls.forEach((r) => {
          result[r.purchase_roll_id] = Number(r.allocated_meters || 0);
        });
      }

      return result;
    },
    [lotRolls, totalQty, totalAllocatedMeters]
  );

  // Sync auto-calculated roll usages when dialog opens or parameters change
  useEffect(() => {
    if (open && lotRolls.length > 0) {
      setRollUsages(calculateRollUsages(allocationMode, avgMeters));
    }
  }, [open, lotRolls, totalQty, avgMeters, allocationMode, calculateRollUsages]);

  if (!open) return null;

  const calculatedTotalUsed = Object.values(rollUsages).reduce((a, b) => a + Number(b || 0), 0);
  const calculatedReturnMeters = Math.max(0, totalAllocatedMeters - calculatedTotalUsed);

  const handleStrategyChange = (mode: "proportional" | "fifo" | "full") => {
    setAllocationMode(mode);
    setRollUsages(calculateRollUsages(mode, avgMeters));
  };

  const handleConfirm = async () => {
    if (!targetGodownId) { toast.error("Please select a target godown"); return; }
    setMoving(true);
    try {
      const res = await fetch(`/api/production/lots/${lotId}/move-to-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          design_number: designCode,
          godown_id: targetGodownId,
          rolls_usage: Object.entries(rollUsages).map(([rollId, used]) => ({
            purchase_roll_id: rollId,
            used_meters: Number(used),
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to move lot to finished stock");
      }
      toast.success("Lot successfully moved to Finished Stock!");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Error moving lot to stock");
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-lg w-full p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2">
          Move Lot to Finished Stock
        </h3>
        <p className="text-xs text-slate-500 leading-normal">
          Finalizing production lot for <strong className="font-bold text-slate-900">{totalQty} pieces</strong> of design{" "}
          <strong className="font-bold text-slate-900">{designCode}</strong>. Select target godown and verify fabric consumption distribution.
        </p>

        <div className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="move-godown" className="block text-[10px] font-bold text-slate-500 uppercase">Target Finished Goods Godown <span className="text-red-500">*</span></label>
            <select
              id="move-godown"
              value={targetGodownId}
              onChange={(e) => setTargetGodownId(e.target.value)}
              className="w-full h-9 rounded border border-slate-200 px-3 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
            >
              <option value="">-- Select Target Godown --</option>
              {godowns.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          {/* Auto Consumption Calculation Box */}
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-lg p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-indigo-900 flex items-center gap-1.5">
                <Calculator size={14} className="text-indigo-600" />
                Fabric Consumption Calculator
              </span>
              <span className="text-[10px] font-bold text-indigo-600 bg-white px-2 py-0.5 rounded border border-indigo-200">
                {totalQty} Pcs
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Avg Meter / Pc</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  value={avgMeters}
                  onChange={(e) => setAvgMeters(parseFloat(e.target.value) || 0)}
                  className="w-full h-7 border border-indigo-200 rounded px-2 bg-white text-xs font-bold text-indigo-900 focus:outline-none"
                />
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Est. Fabric Used</span>
                <span className="font-bold text-slate-800 h-7 flex items-center">
                  {calculatedTotalUsed.toFixed(2)} m
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Return to Stock</span>
                <span className="font-bold text-emerald-700 h-7 flex items-center">
                  {calculatedReturnMeters.toFixed(2)} m
                </span>
              </div>
            </div>
          </div>

          {lotRolls.length > 0 && (
            <div className="space-y-2.5 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Allocated Fabric Rolls Usage</label>
                <span className="text-[10px] text-slate-400">Total Allocated: {totalAllocatedMeters}m</span>
              </div>

              {/* Strategy Preset Switch Buttons */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-lg border border-slate-200 text-[11px]">
                <button
                  type="button"
                  onClick={() => handleStrategyChange("proportional")}
                  className={`flex-1 py-1 px-2 rounded font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    allocationMode === "proportional"
                      ? "bg-white text-indigo-600 shadow-sm border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Distribute consumption proportionally based on each roll's allocated share"
                >
                  <PieChart size={12} />
                  Proportional
                </button>
                <button
                  type="button"
                  onClick={() => handleStrategyChange("fifo")}
                  className={`flex-1 py-1 px-2 rounded font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    allocationMode === "fifo"
                      ? "bg-white text-indigo-600 shadow-sm border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Sequential filling: Consume roll #1 first before moving to roll #2"
                >
                  <Layers size={12} />
                  Roll 1 First
                </button>
                <button
                  type="button"
                  onClick={() => handleStrategyChange("full")}
                  className={`flex-1 py-1 px-2 rounded font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    allocationMode === "full"
                      ? "bg-white text-indigo-600 shadow-sm border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Mark all allocated rolls as 100% consumed"
                >
                  <CheckCircle size={12} />
                  100% Full
                </button>
              </div>
              
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {lotRolls.map((r) => {
                  const usedVal = rollUsages[r.purchase_roll_id] ?? r.allocated_meters;
                  const returnVal = Math.max(0, Number(r.allocated_meters || 0) - Number(usedVal || 0));
                  return (
                    <div key={r.id} className="flex items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <div className="text-xs">
                        <span className="font-semibold text-slate-800 block">
                          Roll #{r.purchase_roll?.roll_number} {r.purchase_roll?.shade ? `(${r.purchase_roll.shade})` : ""}
                        </span>
                        {returnVal > 0 ? (
                          <span className="text-[10px] text-emerald-600 font-medium block">
                            ↩ Returns {returnVal.toFixed(2)}m back to fabric stock
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium block">
                            100% Consumed
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max={r.allocated_meters}
                          value={usedVal}
                          onChange={(e) =>
                            setRollUsages({
                              ...rollUsages,
                              [r.purchase_roll_id]: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-20 h-8 text-right px-2 border border-slate-200 rounded text-xs bg-white font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <span className="text-[10px] text-slate-400 font-bold">/ {r.allocated_meters}m</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="h-9 px-4 border border-slate-200 rounded text-xs font-bold hover:bg-slate-50 cursor-pointer">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={moving || !targetGodownId}
            className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            {moving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {moving ? "Moving to Finished Stock..." : "Confirm & Move Lot to Stock"}
          </button>
        </div>
      </div>
    </div>
  );
}
