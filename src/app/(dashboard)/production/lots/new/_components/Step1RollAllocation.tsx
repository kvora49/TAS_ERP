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
  allocating,
  onNext,
}: Props) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
      <h3 className="text-sm font-bold text-[#0F172A] border-b border-[#F3F4F6] pb-3 uppercase tracking-wider flex items-center gap-2">
        <Boxes className="h-4.5 w-4.5 text-[#6366F1]" />
        Step 1: Roll Allocation
      </h3>

      <div className="space-y-4">
        {/* Search field */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search purchase rolls by Supplier, Roll number, Fabric, Shade..."
            value={rollSearch}
            onChange={(e) => setRollSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-lg border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
          />
        </div>

        {/* Available search results */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Available Fabric Rolls</h4>
          {loadingRolls ? (
            <div className="py-6 text-center text-xs text-slate-400">Loading rolls...</div>
          ) : availableRolls.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">No active rolls found matching query.</div>
          ) : (
            <div className="border border-slate-100 rounded-lg overflow-hidden max-h-48 overflow-y-auto divide-y divide-slate-100">
              {availableRolls.map((roll) => {
                const isAllocated = allocatedRolls.some((r) => r.purchase_roll_id === roll.id);
                return (
                  <div key={roll.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50">
                    <div>
                      <span className="font-bold text-slate-800 block">
                        Roll #{roll.roll_number} ({roll.item?.material_type?.name})
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Supplier: {roll.item?.purchase?.supplier?.company_name || roll.item?.purchase?.supplier?.name} • Shade: {roll.shade || "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-slate-700">{roll.remaining_meters} Mtr remaining</span>
                      <button
                        type="button"
                        onClick={() => onToggleRoll(roll)}
                        className={`px-2.5 py-1 rounded font-bold transition-all text-[10px] uppercase cursor-pointer ${
                          isAllocated
                            ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100"
                            : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100"
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
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Allocated Fabric Consumption</h4>
          {allocatedRolls.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
              No rolls allocated yet. Please search and allocate fabric rolls above.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase text-[10px]">
                    <th className="p-2.5">Roll details</th>
                    <th className="p-2.5">Supplier</th>
                    <th className="p-2.5 text-center">Remaining</th>
                    <th className="p-2.5 text-center w-24">Allocated (Mtr)</th>
                    <th className="p-2.5 text-right">Value (INR)</th>
                    <th className="p-2.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allocatedRolls.map((roll) => (
                    <tr key={roll.purchase_roll_id}>
                      <td className="p-2.5 font-semibold text-slate-700">
                        Roll #{roll.roll_number} ({roll.shade})
                      </td>
                      <td className="p-2.5 text-slate-500">{roll.supplier_name}</td>
                      <td className="p-2.5 text-center font-mono">{roll.remaining_meters} Mtr</td>
                      <td className="p-2.5 text-center">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={roll.allocated_meters}
                          onChange={(e) =>
                            onAllocationChange(roll.purchase_roll_id, parseFloat(e.target.value) || 0)
                          }
                          className="w-20 h-8 text-center border border-slate-200 rounded text-xs"
                        />
                      </td>
                      <td className="p-2.5 text-right font-mono font-semibold">
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
                          className="text-red-500 hover:text-red-700 font-bold text-[10px]"
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
      <div className="flex justify-end pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={onNext}
          disabled={allocating || allocatedRolls.length === 0}
          className="bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 text-white font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          {allocating ? "Processing Allocations..." : "Next: Basic Details"}
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
