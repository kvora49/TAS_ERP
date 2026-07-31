"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/shared/Modal";
import { Search, Loader2, Check, Scissors } from "lucide-react";
import { toast } from "sonner";

export interface SelectedRollInfo {
  purchase_roll_id: string;
  roll_number: string;
  meters: number;
  shade?: string;
  width?: number;
  material_type_id: string;
  material_name: string;
  rate?: number;
}

interface SelectFabricRollsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (selectedRolls: SelectedRollInfo[]) => void;
}

export function SelectFabricRollsModal({
  open,
  onOpenChange,
  onConfirm,
}: SelectFabricRollsModalProps) {
  const [loading, setLoading] = useState(false);
  const [rolls, setRolls] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedMap, setSelectedMap] = useState<Record<string, { meters: number; roll: any }>>({});

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetch("/api/production/lots/available-rolls")
        .then((res) => res.json())
        .then((data) => {
          setRolls(data.rolls || []);
          setLoading(false);
        })
        .catch((err) => {
          toast.error("Failed to load fabric rolls: " + err.message);
          setLoading(false);
        });
    } else {
      setSelectedMap({});
      setSearch("");
    }
  }, [open]);

  const filteredRolls = rolls.filter((r) => {
    if (!search) return true;
    const term = search.toLowerCase();
    const rollNo = (r.roll_number || "").toLowerCase();
    const shade = (r.shade || "").toLowerCase();
    const matName = (r.item?.material_type?.name || "").toLowerCase();
    return rollNo.includes(term) || shade.includes(term) || matName.includes(term);
  });

  const toggleSelect = (roll: any) => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (next[roll.id]) {
        delete next[roll.id];
      } else {
        next[roll.id] = {
          meters: Number(roll.remaining_meters || 0),
          roll,
        };
      }
      return next;
    });
  };

  const handleMetersChange = (rollId: string, meters: number, maxMeters: number) => {
    const validMeters = Math.max(0.01, Math.min(meters, maxMeters));
    setSelectedMap((prev) => {
      if (!prev[rollId]) return prev;
      return {
        ...prev,
        [rollId]: {
          ...prev[rollId],
          meters: validMeters,
        },
      };
    });
  };

  const handleDone = () => {
    const selectedList = Object.values(selectedMap);
    if (selectedList.length === 0) {
      toast.error("Please select at least one roll to sell");
      return;
    }

    const formatted: SelectedRollInfo[] = selectedList.map(({ meters, roll }) => ({
      purchase_roll_id: roll.id,
      roll_number: roll.roll_number,
      meters: Number(meters),
      shade: roll.shade || undefined,
      width: roll.width || undefined,
      material_type_id: roll.item?.material_type?.id || "",
      material_name: roll.item?.material_type?.name || "Fabric",
      rate: roll.item?.rate || 0,
    }));

    onConfirm(formatted);
    onOpenChange(false);
  };

  const totalSelectedMeters = Object.values(selectedMap).reduce(
    (sum, item) => sum + Number(item.meters || 0),
    0
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Select Fabric Rolls to Sell"
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4">
        {/* Search Header */}
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Roll No, Shade, or Material Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-xs font-semibold focus:outline-none"
          />
        </div>

        {/* Content Table / List */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mb-2 text-[#6366F1]" />
            <p className="text-xs font-bold">Loading available fabric rolls in stock...</p>
          </div>
        ) : filteredRolls.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No fabric rolls found in inventory matching search criteria.
          </div>
        ) : (
          <div className="max-h-[350px] overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
            {filteredRolls.map((roll) => {
              const isSelected = !!selectedMap[roll.id];
              const selMeters = selectedMap[roll.id]?.meters ?? Number(roll.remaining_meters || 0);

              return (
                <div
                  key={roll.id}
                  className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    isSelected ? "bg-indigo-50/50" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start gap-3 cursor-pointer" onClick={() => toggleSelect(roll)}>
                    <div
                      className={`h-5 w-5 rounded border flex items-center justify-center mt-0.5 transition-colors ${
                        isSelected
                          ? "bg-[#6366F1] border-[#6366F1] text-white"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">Roll #{roll.roll_number}</span>
                        {roll.shade && (
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 font-mono text-[10px] rounded font-semibold">
                            Shade: {roll.shade}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                        {roll.item?.material_type?.name || "Raw Material"} • Avail:{" "}
                        <strong className="text-slate-900 font-mono">{roll.remaining_meters}m</strong>
                      </p>
                    </div>
                  </div>

                  {/* Meter Input when Selected */}
                  {isSelected && (
                    <div className="flex items-center gap-2 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
                      <label className="text-[10px] font-bold uppercase text-slate-500">Meters to sell:</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={roll.remaining_meters}
                        value={selMeters}
                        onChange={(e) =>
                          handleMetersChange(
                            roll.id,
                            parseFloat(e.target.value) || 0,
                            Number(roll.remaining_meters)
                          )
                        }
                        className="w-24 h-8 px-2 rounded border border-indigo-300 bg-white text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <span className="text-xs text-slate-400 font-mono">/ {roll.remaining_meters}m</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Summary & Action */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <div>
            <span className="text-xs text-slate-500 font-medium block">
              Selected Rolls: <strong className="text-slate-900 font-mono">{Object.keys(selectedMap).length}</strong>
            </span>
            <span className="text-xs text-slate-500 font-medium block">
              Total Quantity: <strong className="text-indigo-600 font-mono">{totalSelectedMeters.toFixed(2)} Meters</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={handleDone}
            disabled={Object.keys(selectedMap).length === 0}
            className="px-4 py-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            <Scissors className="h-4 w-4" />
            <span>Add Selected Rolls to Bill</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
