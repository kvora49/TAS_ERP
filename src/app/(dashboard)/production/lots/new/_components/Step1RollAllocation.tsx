"use client";

import { ArrowLeft, Boxes, ChevronRight, Search } from "lucide-react";

interface Roll {
  purchase_roll_id: string;
  roll_number: string;
  shade: string;
  material_name: string;
  supplier_name: string;
  remaining_meters: number;
  allocated_meters: number;
  rate: number;
  colour_id?: string;
}

interface AvailableRoll {
  id: string;
  roll_number: string;
  shade: string | null;
  remaining_meters: number;
  item?: {
    material_type?: { name: string };
    purchase?: { supplier?: { name: string; company_name?: string } };
    rate?: number;
  };
}

interface Props {
  rollSearch: string;
  setRollSearch: (v: string) => void;
  availableRolls: AvailableRoll[];
  loadingRolls: boolean;
  allocatedRolls: Roll[];
  setAllocatedRolls: (rolls: Roll[]) => void;
  onToggleRoll: (roll: AvailableRoll) => void;
  onAllocationChange: (rollId: string, meters: number) => void;
  onRollColourChange?: (rollId: string, colourId: string) => void;
  selectedColours?: Array<{ id: string; colour_name: string }>;
  allocating: boolean;
  onNext: () => void;
}

export default function Step1RollAllocation({
  rollSearch,
  setRollSearch,
  availableRolls,
  loadingRolls,
  allocatedRolls,
  setAllocatedRolls,
  onToggleRoll,
  onAllocationChange,
  onRollColourChange,
  selectedColours = [],
  allocating,
  onNext,
}: Props) {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4 text-[var(--text-primary)]">
      <h3 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border)] pb-3 uppercase tracking-wider flex items-center gap-2">
        <Boxes className="h-4.5 w-4.5 text-[var(--primary)]" />
        Step 1: Roll Allocation
      </h3>

      <div className="space-y-4">
        {/* Search field */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] h-4 w-4" />
          <input
            type="text"
            placeholder="Search purchase rolls by Supplier, Roll number, Fabric, Shade..."
            value={rollSearch}
            onChange={(e) => setRollSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] text-sm transition-colors"
          />
        </div>

        {/* Available search results */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">Available Fabric Rolls</h4>
          {loadingRolls ? (
            <div className="py-6 text-center text-xs text-[var(--text-faint)]">Loading rolls...</div>
          ) : availableRolls.length === 0 ? (
            <div className="py-6 text-center text-xs text-[var(--text-faint)]">No active rolls found matching query.</div>
          ) : (
            <div className="border border-[var(--border)] rounded-lg overflow-hidden max-h-48 overflow-y-auto divide-y divide-[var(--border)] bg-[var(--card-bg)]">
              {availableRolls.map((roll) => {
                const isAllocated = allocatedRolls.some((r) => r.purchase_roll_id === roll.id);
                return (
                  <div key={roll.id} className="p-3 flex items-center justify-between text-xs hover:bg-[var(--table-row-hover)] transition-colors">
                    <div>
                      <span className="font-bold text-[var(--text-primary)] block">
                        Roll #{roll.roll_number} ({roll.item?.material_type?.name})
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        Supplier: {roll.item?.purchase?.supplier?.company_name || roll.item?.purchase?.supplier?.name} • Shade: {roll.shade || "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-[var(--text-secondary)]">{roll.remaining_meters} Mtr remaining</span>
                      <button
                        type="button"
                        onClick={() => onToggleRoll(roll)}
                        className={`px-2.5 py-1 rounded font-bold transition-all text-[10px] uppercase cursor-pointer ${
                          isAllocated
                            ? "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20"
                            : "bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 border border-[var(--primary)]/20"
                        }`}
                      >
                        {isAllocated ? "Deallocate" : "Allocate"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Allocated list */}
        <div className="space-y-2 pt-2">
          <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">Allocated Fabric Consumption</h4>
          {allocatedRolls.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-[var(--border)] rounded-xl text-xs text-[var(--text-faint)]">
              No rolls allocated yet. Please search and allocate fabric rolls above.
            </div>
          ) : (
            <div className="border border-[var(--border)] rounded-lg overflow-hidden overflow-x-auto bg-[var(--card-bg)]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] font-bold text-[var(--text-muted)] uppercase text-[10px]">
                    <th className="p-2.5">Roll details</th>
                    <th className="p-2.5">Supplier</th>
                    {selectedColours.length > 0 && <th className="p-2.5">Mapped Colour</th>}
                    <th className="p-2.5 text-center">Remaining</th>
                    <th className="p-2.5 text-center w-24">Allocated (Mtr)</th>
                    <th className="p-2.5 text-right">Value (INR)</th>
                    <th className="p-2.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] bg-[var(--card-bg)]">
                  {allocatedRolls.map((roll) => (
                    <tr key={roll.purchase_roll_id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                      <td className="p-2.5 font-semibold text-[var(--text-primary)]">
                        Roll #{roll.roll_number} ({roll.shade})
                      </td>
                      <td className="p-2.5 text-[var(--text-muted)]">{roll.supplier_name}</td>
                      {selectedColours.length > 0 && (
                        <td className="p-2.5">
                          <select
                            value={roll.colour_id || ""}
                            onChange={(e) => onRollColourChange?.(roll.purchase_roll_id, e.target.value)}
                            className="h-7 px-2 text-xs border border-[var(--input-border)] rounded bg-[var(--input-bg)] text-[var(--text-primary)]"
                          >
                            <option value="">-- Unmapped / Auto --</option>
                            {selectedColours.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.colour_name}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}
                      <td className="p-2.5 text-center font-mono text-[var(--text-secondary)]">{roll.remaining_meters} Mtr</td>
                      <td className="p-2.5 text-center">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={roll.allocated_meters}
                          onChange={(e) =>
                            onAllocationChange(roll.purchase_roll_id, parseFloat(e.target.value) || 0)
                          }
                          className="w-20 h-8 text-center bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded text-xs"
                        />
                      </td>
                      <td className="p-2.5 text-right font-mono font-semibold text-[var(--text-primary)]">
                        {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
                          roll.allocated_meters * roll.rate
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setAllocatedRolls(
                              allocatedRolls.filter((r) => r.purchase_roll_id !== roll.purchase_roll_id)
                            )
                          }
                          className="text-red-500 hover:text-red-400 font-bold text-[10px]"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-end pt-4 border-t border-[var(--border)]">
        <button
          type="button"
          onClick={onNext}
          disabled={allocating || allocatedRolls.length === 0}
          className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] disabled:opacity-50 text-white font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          {allocating ? "Processing Allocations..." : "Next: Basic Details"}
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
