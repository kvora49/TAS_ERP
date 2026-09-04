"use client";

import { ArrowLeft, Boxes, ChevronRight, Package, Search, Trash2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AllocatedRoll {
  purchase_roll_id: string;
  roll_number: string;
  shade: string;
  material_name: string;
  supplier_name: string;
  godown_name?: string;
  remaining_meters: number;
  allocated_meters: number;
  rate: number;
  colour_id?: string;
}

export interface AvailableRoll {
  id: string;
  roll_number: string;
  shade: string | null;
  remaining_meters: number;
  item?: {
    material_type?: { name: string };
    purchase?: {
      supplier?: { name: string; company_name?: string };
      godown?: { name: string };
    };
    rate?: number;
  };
}

export interface AvailableAccessory {
  id: string;
  item_name: string;
  unit: string;
  godown_id: string;
  godown_name: string;
  supplier_name: string;
  available_qty: number;
  unit_rate: number;
  material_type_id: string;
  purchase_id?: string;
}

export interface AllocatedAccessory {
  purchase_item_id: string;
  item_name: string;
  unit: string;
  godown_id: string;
  godown_name: string;
  supplier_name: string;
  available_qty: number;
  allocated_qty: number;
  unit_rate: number;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  // Sub-tab state
  step1SubTab: "rolls" | "accessories";
  setStep1SubTab: (tab: "rolls" | "accessories") => void;

  // Rolls
  rollSearch: string;
  setRollSearch: (v: string) => void;
  availableRolls: AvailableRoll[];
  loadingRolls: boolean;
  allocatedRolls: AllocatedRoll[];
  setAllocatedRolls: (rolls: AllocatedRoll[]) => void;
  onToggleRoll: (roll: AvailableRoll) => void;
  onAllocationChange: (rollId: string, meters: number) => void;
  onRollColourChange?: (rollId: string, colourId: string) => void;
  selectedColours?: Array<{ id: string; colour_name: string }>;
  allocating: boolean;

  // Accessories
  accessorySearch: string;
  setAccessorySearch: (v: string) => void;
  availableAccessories: AvailableAccessory[];
  loadingAccessories: boolean;
  allocatedAccessories: AllocatedAccessory[];
  setAllocatedAccessories: (items: AllocatedAccessory[]) => void;
  onToggleAccessory: (item: AvailableAccessory) => void;
  onAccessoryQtyChange: (itemId: string, qty: number) => void;

  onNext: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Step1RollAllocation({
  step1SubTab,
  setStep1SubTab,
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
  accessorySearch,
  setAccessorySearch,
  availableAccessories,
  loadingAccessories,
  allocatedAccessories,
  setAllocatedAccessories,
  onToggleAccessory,
  onAccessoryQtyChange,
  onNext,
}: Props) {
  const fmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  const fmtQty = (n: number, unit: string) => `${n.toLocaleString("en-IN")} ${unit}`;

  const totalRollValue = allocatedRolls.reduce((s, r) => s + r.allocated_meters * r.rate, 0);
  const totalAccValue = allocatedAccessories.reduce((s, a) => s + a.allocated_qty * a.unit_rate, 0);
  const grandTotal = totalRollValue + totalAccValue;

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4 text-[var(--text-primary)]">
      {/* Header */}
      <h3 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border)] pb-3 uppercase tracking-wider flex items-center gap-2">
        <Boxes className="h-4.5 w-4.5 text-[var(--primary)]" />
        Step 1: Material Allocation
      </h3>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-[var(--page-bg)] rounded-lg p-1 w-fit">
        <button
          type="button"
          onClick={() => setStep1SubTab("rolls")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
            step1SubTab === "rolls"
              ? "bg-[var(--card-bg)] text-[var(--primary)] shadow-sm border border-[var(--border)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          <Boxes size={12} />
          Fabric Rolls
          {allocatedRolls.length > 0 && (
            <span className="bg-[var(--primary)] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {allocatedRolls.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setStep1SubTab("accessories")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
            step1SubTab === "accessories"
              ? "bg-[var(--card-bg)] text-[var(--primary)] shadow-sm border border-[var(--border)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          <Package size={12} />
          Accessories
          <span className="text-[10px] text-[var(--text-faint)] font-normal">(Optional)</span>
          {allocatedAccessories.length > 0 && (
            <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {allocatedAccessories.length}
            </span>
          )}
        </button>
      </div>

      {/* ── FABRIC ROLLS TAB ── */}
      {step1SubTab === "rolls" && (
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] h-4 w-4" />
            <input
              type="text"
              placeholder="Search purchase rolls by Supplier, Roll number, Fabric, Shade..."
              value={rollSearch}
              onChange={(e) => setRollSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent text-sm transition-colors"
            />
          </div>

          {/* Available Rolls */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">Available Fabric Rolls</h4>
            {loadingRolls ? (
              <div className="py-6 text-center text-xs text-[var(--text-faint)]">Loading rolls...</div>
            ) : availableRolls.length === 0 ? (
              <div className="py-6 text-center text-xs text-[var(--text-faint)]">
                No active rolls found matching query.
              </div>
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
                          Supplier: {roll.item?.purchase?.supplier?.company_name || roll.item?.purchase?.supplier?.name} · Godown: {roll.item?.purchase?.godown?.name || "Main Godown"} · Shade: {roll.shade || "—"}
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
        </div>
      )}

      {/* ── ACCESSORIES TAB ── */}
      {step1SubTab === "accessories" && (
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] h-4 w-4" />
            <input
              type="text"
              placeholder="Search accessories by name, supplier, godown..."
              value={accessorySearch}
              onChange={(e) => setAccessorySearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent text-sm transition-colors"
            />
          </div>

          {/* Available Accessories */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">Available Accessories in Stock</h4>
            {loadingAccessories ? (
              <div className="py-6 text-center text-xs text-[var(--text-faint)]">Loading accessories...</div>
            ) : availableAccessories.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-[var(--border)] rounded-xl text-xs text-[var(--text-faint)]">
                No accessory stock found.{" "}
                <span className="block mt-1 text-[var(--text-faint)]">
                  Purchase accessories in Raw Materials → Purchases (Accessories tab) first.
                </span>
              </div>
            ) : (
              <div className="border border-[var(--border)] rounded-lg overflow-hidden max-h-48 overflow-y-auto divide-y divide-[var(--border)] bg-[var(--card-bg)]">
                {availableAccessories.map((item) => {
                  const isAllocated = allocatedAccessories.some((a) => a.purchase_item_id === item.id);
                  return (
                    <div key={item.id} className="p-3 flex items-center justify-between text-xs hover:bg-[var(--table-row-hover)] transition-colors">
                      <div>
                        <span className="font-bold text-[var(--text-primary)] block">{item.item_name}</span>
                        <span className="text-[10px] text-[var(--text-muted)]">
                          Supplier: {item.supplier_name} · Godown: {item.godown_name} · Rate: {fmt.format(item.unit_rate)}/{item.unit}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-[var(--text-secondary)]">
                          {fmtQty(item.available_qty, item.unit)} avail.
                        </span>
                        <button
                          type="button"
                          onClick={() => onToggleAccessory(item)}
                          className={`px-2.5 py-1 rounded font-bold transition-all text-[10px] uppercase cursor-pointer ${
                            isAllocated
                              ? "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20"
                              : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20"
                          }`}
                        >
                          {isAllocated ? "Remove" : "Allocate"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── UNIFIED ALLOCATED MATERIALS TABLE ── */}
      <div className="space-y-2 pt-2">
        <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">
          📦 Allocated Materials
        </h4>

        {allocatedRolls.length === 0 && allocatedAccessories.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-[var(--border)] rounded-xl text-xs text-[var(--text-faint)]">
            No materials allocated yet. Use the tabs above to allocate fabric rolls or accessories.
          </div>
        ) : (
          <div className="border border-[var(--border)] rounded-lg overflow-hidden overflow-x-auto bg-[var(--card-bg)]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] font-bold text-[var(--text-muted)] uppercase text-[10px]">
                  <th className="p-2.5">Type</th>
                  <th className="p-2.5">Item</th>
                  <th className="p-2.5">Supplier</th>
                  <th className="p-2.5">Godown</th>
                  {selectedColours.length > 0 && <th className="p-2.5">Mapped Colour</th>}
                  <th className="p-2.5 text-center">Available / Remaining</th>
                  <th className="p-2.5 text-center w-28">Qty / Meters</th>
                  <th className="p-2.5 text-right">Value (INR)</th>
                  <th className="p-2.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] bg-[var(--card-bg)]">

                {/* ── Fabric Roll Rows ── */}
                {allocatedRolls.map((roll) => (
                  <tr key={roll.purchase_roll_id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                    <td className="p-2.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--primary)]/10 text-[var(--primary)]">
                        <Boxes size={10} /> Roll
                      </span>
                    </td>
                    <td className="p-2.5 font-semibold text-[var(--text-primary)]">
                      Roll #{roll.roll_number}
                      {roll.shade && roll.shade !== "—" && (
                        <span className="text-[var(--text-muted)] font-normal"> ({roll.shade})</span>
                      )}
                    </td>
                    <td className="p-2.5 text-[var(--text-muted)]">{roll.supplier_name}</td>
                    <td className="p-2.5 text-[var(--text-muted)]">{roll.godown_name || "Main Godown"}</td>
                    {selectedColours.length > 0 && (
                      <td className="p-2.5">
                        <select
                          value={roll.colour_id || ""}
                          onChange={(e) => onRollColourChange?.(roll.purchase_roll_id, e.target.value)}
                          className="h-8.5 py-1 px-2.5 text-xs border border-[var(--input-border)] rounded-lg bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)] min-w-[140px] leading-normal cursor-pointer"
                        >
                          <option value="">-- Unmapped / Auto --</option>
                          {selectedColours.map((c) => (
                            <option key={c.id} value={c.id}>{c.colour_name}</option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td className="p-2.5 text-center font-mono text-[var(--text-secondary)]">{roll.remaining_meters} Mtr</td>
                    <td className="p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={roll.allocated_meters}
                          onChange={(e) => onAllocationChange(roll.purchase_roll_id, parseFloat(e.target.value) || 0)}
                          className="w-20 h-8 text-center bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded text-xs focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
                        />
                        <span className="text-[var(--text-faint)] text-[10px]">Mtr</span>
                      </div>
                    </td>
                    <td className="p-2.5 text-right font-mono font-semibold text-[var(--text-primary)]">
                      {fmt.format(roll.allocated_meters * roll.rate)}
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => setAllocatedRolls(allocatedRolls.filter((r) => r.purchase_roll_id !== roll.purchase_roll_id))}
                        className="text-red-500 hover:text-red-400 cursor-pointer"
                        title="Remove roll"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}

                {/* ── Accessory Rows ── */}
                {allocatedAccessories.map((acc) => (
                  <tr key={acc.purchase_item_id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                    <td className="p-2.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                        <Package size={10} /> Acc
                      </span>
                    </td>
                    <td className="p-2.5 font-semibold text-[var(--text-primary)]">{acc.item_name}</td>
                    <td className="p-2.5 text-[var(--text-muted)]">{acc.supplier_name}</td>
                    <td className="p-2.5 text-[var(--text-muted)]">{acc.godown_name}</td>
                    {selectedColours.length > 0 && <td className="p-2.5 text-[var(--text-faint)]">—</td>}
                    <td className="p-2.5 text-center font-mono text-[var(--text-secondary)]">
                      {fmtQty(acc.available_qty, acc.unit)} avail.
                    </td>
                    <td className="p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          max={acc.available_qty}
                          value={acc.allocated_qty}
                          onChange={(e) => onAccessoryQtyChange(acc.purchase_item_id, parseFloat(e.target.value) || 0)}
                          className="w-20 h-8 text-center bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded text-xs focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
                        />
                        <span className="text-[var(--text-faint)] text-[10px]">{acc.unit}</span>
                      </div>
                    </td>
                    <td className="p-2.5 text-right font-mono font-semibold text-[var(--text-primary)]">
                      {fmt.format(acc.allocated_qty * acc.unit_rate)}
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => setAllocatedAccessories(allocatedAccessories.filter((a) => a.purchase_item_id !== acc.purchase_item_id))}
                        className="text-red-500 hover:text-red-400 cursor-pointer"
                        title="Remove accessory"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* ── Totals Footer ── */}
              <tfoot>
                <tr className="bg-[var(--table-header-bg)] border-t-2 border-[var(--border)] text-xs font-bold">
                  <td colSpan={selectedColours.length > 0 ? 6 : 5} className="p-2.5 text-[var(--text-muted)]">
                    <span className="text-[var(--primary)]">Fabric:</span>{" "}
                    <span className="text-[var(--text-primary)]">{fmt.format(totalRollValue)}</span>
                    {"  "}
                    <span className="text-emerald-600">Accessories:</span>{" "}
                    <span className="text-[var(--text-primary)]">{fmt.format(totalAccValue)}</span>
                  </td>
                  <td className="p-2.5 text-right text-[var(--text-primary)]" colSpan={3}>
                    Total Budget: {fmt.format(grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-end pt-4 border-t border-[var(--border)]">
        <button
          type="button"
          onClick={onNext}
          disabled={allocating || (allocatedRolls.length === 0 && allocatedAccessories.length === 0)}
          className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] disabled:opacity-50 text-white font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          {allocating ? "Processing Allocations..." : "Next: Basic Details"}
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
