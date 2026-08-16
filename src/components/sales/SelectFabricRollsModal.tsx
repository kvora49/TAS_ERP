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
  grade?: string;
  design_name?: string;
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
      grade: roll.grade || roll.item?.grade || undefined,
      design_name: roll.design_name || roll.item?.design_name || undefined,
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
          <Search className="h-4 w-4 absolute left-3 top-3 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search by Roll No, Shade, or Material Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
          />
        </div>

        {/* Content Table / List */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-[var(--text-muted)]">
            <Loader2 className="h-8 w-8 animate-spin mb-2 text-[var(--primary)]" />
            <p className="text-xs font-bold">Loading available fabric rolls in stock...</p>
          </div>
        ) : filteredRolls.length === 0 ? (
          <div className="py-12 text-center text-[var(--text-muted)] text-xs">
            No fabric rolls found in inventory matching search criteria.
          </div>
        ) : (
          <div className="max-h-[350px] overflow-y-auto border border-[var(--border)] rounded-xl divide-y divide-[var(--border)]">
            {filteredRolls.map((roll) => {
              const isSelected = !!selectedMap[roll.id];
              const selMeters = selectedMap[roll.id]?.meters ?? Number(roll.remaining_meters || 0);
              const gradeVal = roll.grade || roll.item?.grade;
              const designVal = roll.design_name || roll.item?.design_name;

              return (
                <div
                  key={roll.id}
                  className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    isSelected ? "bg-[var(--primary-light)]" : "hover:bg-[var(--table-row-hover)]"
                  }`}
                >
                  <div className="flex items-start gap-3 cursor-pointer" onClick={() => toggleSelect(roll)}>
                    <div
                      className={`h-5 w-5 rounded border flex items-center justify-center mt-0.5 transition-colors ${
                        isSelected
                          ? "bg-[var(--primary)] border-[var(--primary)] text-white"
                          : "border-[var(--input-border)] bg-[var(--input-bg)]"
                      }`}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-[var(--text-primary)]">Roll #{roll.roll_number}</span>
                        {gradeVal && (
                          <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] rounded font-bold">
                            Grade: {gradeVal}
                          </span>
                        )}
                        {designVal && (
                          <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] rounded font-semibold">
                            Design: {designVal}
                          </span>
                        )}
                        {roll.shade && (
                          <span className="px-1.5 py-0.5 bg-[var(--page-bg)] text-[var(--text-secondary)] font-mono text-[10px] rounded font-semibold border border-[var(--border)]">
                            Shade: {roll.shade}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5 font-medium">
                        {roll.item?.material_type?.name || "Raw Material"} • Avail:{" "}
                        <strong className="text-[var(--text-primary)] font-mono">{roll.remaining_meters}m</strong>
                        {roll.item?.purchase?.godown?.name && ` • Godown: ${roll.item.purchase.godown.name}`}
                      </p>
                    </div>
                  </div>

                  {/* Meter Input when Selected */}
                  {isSelected && (
                    <div className="flex items-center gap-2 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
                      <label className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Meters to sell:</label>
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
                        className="w-24 h-8 px-2 rounded border border-[var(--input-focus)] bg-[var(--input-bg)] text-xs font-mono font-bold text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
                      />
                      <span className="text-xs text-[var(--text-muted)] font-mono">/ {roll.remaining_meters}m</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Summary & Action */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
          <div>
            <span className="text-xs text-[var(--text-muted)] font-medium block">
              Selected Rolls: <strong className="text-[var(--text-primary)] font-mono">{Object.keys(selectedMap).length}</strong>
            </span>
            <span className="text-xs text-[var(--text-muted)] font-medium block">
              Total Quantity: <strong className="text-[var(--primary)] font-mono">{totalSelectedMeters.toFixed(2)} Meters</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={handleDone}
            disabled={Object.keys(selectedMap).length === 0}
            className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            <Scissors className="h-4 w-4" />
            <span>Add Selected Rolls to Bill</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
