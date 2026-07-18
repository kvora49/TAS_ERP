import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TotalsPanelProps {
  state: any;
  totals: any;
}

export function TotalsPanel({ state, totals }: TotalsPanelProps) {
  const [chargeName, setChargeName] = useState("");
  const [chargeType, setChargeType] = useState<"flat" | "per_qty" | "percentage">("flat");
  const [chargeAmount, setChargeAmount] = useState<number>(0);
  const [isTaxable, setIsTaxable] = useState(true);

  const handleAddCharge = () => {
    if (!chargeName.trim() || chargeAmount <= 0) return;
    const newCharge = {
      charge_name: chargeName,
      charge_type: chargeType,
      amount: chargeAmount,
      is_taxable: isTaxable,
    };
    state.setCharges((prev: any[]) => [...prev, newCharge]);
    setChargeName("");
    setChargeAmount(0);
  };

  const handleRemoveCharge = (index: number) => {
    state.setCharges((prev: any[]) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Charges & Discount Form Panel */}
      <div className="space-y-6">
        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Add Bill Charge / Expense</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Charge Name</label>
              <input
                type="text"
                placeholder="e.g. Courier or Loading"
                value={chargeName}
                onChange={(e) => setChargeName(e.target.value)}
                className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-xs focus:outline-none bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Charge Type</label>
              <select
                value={chargeType}
                onChange={(e) => setChargeType(e.target.value as any)}
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-xs focus:outline-none cursor-pointer"
              >
                <option value="flat">Flat Amount (₹)</option>
                <option value="per_qty">Per Piece Qty (₹/pc)</option>
                <option value="percentage">Percentage of Items (%)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 items-center">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Amount / Rate</label>
              <input
                type="number"
                min="0"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(Number(e.target.value))}
                className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-xs focus:outline-none bg-white"
              />
            </div>

            <div className="flex items-center gap-2 mt-4 select-none cursor-pointer">
              <input
                type="checkbox"
                id="isTaxable"
                checked={isTaxable}
                onChange={(e) => setIsTaxable(e.target.checked)}
                className="rounded text-[#6366F1] focus:ring-[#6366F1]"
              />
              <label htmlFor="isTaxable" className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                Taxable Charge
              </label>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleAddCharge}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center gap-1.5 h-10 text-xs font-bold"
          >
            <Plus size={14} />
            <span>Add Charge</span>
          </Button>
        </div>

        {/* List of Added Charges */}
        {state.charges.length > 0 && (
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-[#F3F4F6] bg-slate-50 font-bold text-slate-600">
                  <th className="p-3">Charge Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-right">Rate/Amt</th>
                  <th className="p-3 text-center">Taxable</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {state.charges.map((c: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-700">{c.charge_name}</td>
                    <td className="p-3 capitalize text-slate-500">{c.charge_type.replace("_", " ")}</td>
                    <td className="p-3 text-right font-mono text-slate-700">
                      {c.charge_type === "percentage" ? `${c.amount}%` : `₹${c.amount}`}
                    </td>
                    <td className="p-3 text-center text-slate-600 font-semibold">{c.is_taxable ? "Yes" : "No"}</td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveCharge(idx)}
                        className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Totals Summary Panel */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-sm space-y-4 max-w-md ml-auto w-full">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
          Invoice Summary Calculations
        </h4>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between text-slate-600 font-medium">
            <span>Items Gross Total:</span>
            <span className="font-semibold text-slate-800">₹{totals.item_total.toFixed(2)}</span>
          </div>

          <div className="flex justify-between text-slate-600 font-medium">
            <span>Extra Charges:</span>
            <span className="font-semibold text-slate-800">₹{totals.charges_total.toFixed(2)}</span>
          </div>

          {/* Invoice Level Discount */}
          <div className="border-t border-dashed border-slate-100 pt-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-600 font-medium">Bill Discount:</span>
              <div className="flex gap-2 items-center">
                <select
                  value={state.discountType || ""}
                  onChange={(e) => state.setDiscountType(e.target.value || null)}
                  className="h-8 px-2 bg-white border border-slate-300 rounded text-xs focus:outline-none"
                >
                  <option value="">No Discount</option>
                  <option value="flat">Flat Amount (₹)</option>
                  <option value="percentage">Percentage (%)</option>
                </select>
                {state.discountType && (
                  <input
                    type="number"
                    min="0"
                    value={state.discountValue}
                    onChange={(e) => state.setDiscountValue(Number(e.target.value))}
                    className="h-8 w-20 px-2 border border-slate-300 rounded text-xs focus:outline-none"
                  />
                )}
              </div>
            </div>
            {totals.discount_amount > 0 && (
              <div className="flex justify-between text-[#DC2626] font-semibold text-xs">
                <span>Discount Amount Applied:</span>
                <span>-₹{totals.discount_amount.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="flex justify-between text-slate-600 font-semibold border-t border-slate-100 pt-3">
            <span>Taxable Amount:</span>
            <span>₹{totals.taxable_amount.toFixed(2)}</span>
          </div>

          {/* Tax Splits details */}
          {state.gstTreatment === "regular" && (
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs space-y-1.5 text-slate-500 font-medium">
              {totals.cgst > 0 && (
                <div className="flex justify-between">
                  <span>CGST:</span>
                  <span>₹{totals.cgst.toFixed(2)}</span>
                </div>
              )}
              {totals.sgst > 0 && (
                <div className="flex justify-between">
                  <span>SGST:</span>
                  <span>₹{totals.sgst.toFixed(2)}</span>
                </div>
              )}
              {totals.igst > 0 && (
                <div className="flex justify-between font-bold text-[#6366F1]">
                  <span>IGST (Interstate):</span>
                  <span>₹{totals.igst.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between text-slate-500 text-xs">
            <span>Round Off Adjustment:</span>
            <span>₹{totals.round_off.toFixed(2)}</span>
          </div>

          <div className="flex justify-between text-lg font-bold text-slate-800 border-t-2 border-slate-200 pt-3">
            <span>Grand Total Due:</span>
            <span className="text-[#6366F1]">₹{totals.grand_total.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
