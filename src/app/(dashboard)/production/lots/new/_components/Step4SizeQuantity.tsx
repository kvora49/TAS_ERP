"use client";

import { ArrowLeft, Boxes, ChevronRight, Info } from "lucide-react";
import { NumericInput } from "@/components/ui/numeric-input";

interface SelectedColour { id: string; colour_name: string; colour_hex: string | null; }

interface Props {
  availableSizes: string[];
  useSameColours: boolean;
  setUseSameColours: (v: boolean) => void;
  setSizeQuantities: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>;
  sizeQuantities: Record<string, Record<string, number>>;
  selectedColours: SelectedColour[];
  totalAllocatedMeters: number;
  averageMeter: number;
  setAverageMeter: (v: number) => void;
  calculatingAvg: boolean;
  suggestedPieces: number;
  onFetchHistoricalAvg: () => void;
  onPrefillSizeQuantities: () => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step4SizeQuantity({
  availableSizes, useSameColours, setUseSameColours, setSizeQuantities, sizeQuantities,
  selectedColours, totalAllocatedMeters, averageMeter, setAverageMeter,
  calculatingAvg, suggestedPieces, onFetchHistoricalAvg, onPrefillSizeQuantities,
  onNext, onBack,
}: Props) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-3">
        <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
          <Boxes className="h-4.5 w-4.5 text-[#6366F1]" />
          Step 4: Size Set & Quantities
        </h3>
      </div>

      <div className="space-y-4">
        {/* Average meter calculator */}
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
          <h4 className="text-xs font-bold text-slate-600 uppercase flex items-center gap-2">
            <Info size={14} className="text-indigo-600" />
            Auto-estimate Size Quantities from Allocated fabric
          </h4>
          <p className="text-[11px] text-slate-500 leading-normal">
            You have allocated <strong>{totalAllocatedMeters.toFixed(2)} meters</strong> of fabric. Enter the average fabric requirement per piece to calculate suggested quantity.
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1 max-w-xs">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Average Meter / Pc</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={averageMeter || ""}
                onChange={(e) => setAverageMeter(parseFloat(e.target.value) || 0)}
                placeholder="e.g. 1.6"
                className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs"
              />
            </div>
            <div className="flex items-end gap-2 h-16 pt-5">
              <button
                type="button"
                onClick={onFetchHistoricalAvg}
                disabled={calculatingAvg}
                className="h-9 px-3 border border-indigo-200 bg-indigo-50/20 hover:bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {calculatingAvg ? "Loading..." : "Suggest from History"}
              </button>
              <button
                type="button"
                onClick={onPrefillSizeQuantities}
                disabled={suggestedPieces <= 0}
                className="h-9 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50"
              >
                Prefill Distribute ({suggestedPieces} Pcs)
              </button>
            </div>
          </div>
        </div>

        {/* Same colours toggle */}
        <div className="flex items-center justify-between bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
          <span className="text-xs font-bold text-slate-700">Multi-Colour Sizing Config</span>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useSameColours"
              checked={useSameColours}
              onChange={(e) => { setUseSameColours(e.target.checked); setSizeQuantities({}); }}
              className="h-4.5 w-4.5 rounded border-[#E5E7EB] text-[#6366F1]"
            />
            <label htmlFor="useSameColours" className="text-xs text-[#64748B] font-semibold select-none cursor-pointer">
              Use same size quantities for all colours
            </label>
          </div>
        </div>

        {/* Sizing grids */}
        {availableSizes.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">Please select design size set template.</div>
        ) : useSameColours ? (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <h5 className="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 border-b border-slate-200 uppercase tracking-wide">
              Standard Size Quantities (Applies to all selected colours)
            </h5>
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                  <th className="py-2.5 border-r border-slate-200">Size</th>
                  {availableSizes.map((size) => (
                    <th key={size} className="py-2.5 border-r border-slate-200">{size}</th>
                  ))}
                  <th className="py-2.5">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="text-xs">
                  <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/50">
                    Qty (Pcs)
                  </td>
                  {availableSizes.map((size) => (
                    <td key={size} className="py-2.5 px-3 border-r border-slate-200">
                      <NumericInput
                        min="0"
                        value={sizeQuantities["all"]?.[size] || 0}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setSizeQuantities((prev) => ({
                            ...prev,
                            "all": { ...(prev["all"] || {}), [size]: val },
                          }));
                        }}
                        className="w-16 h-8 text-center border border-slate-200 rounded focus:ring-1 focus:ring-[#6366F1]"
                      />
                    </td>
                  ))}
                  <td className="py-2.5 px-3 font-bold text-slate-800 bg-slate-50/50">
                    {Object.values(sizeQuantities["all"] || {}).reduce((a, b) => a + b, 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-4">
            {selectedColours.map((colour) => (
              <div key={colour.id} className="border border-slate-200 rounded-lg overflow-hidden">
                <h5 className="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 border-b border-slate-200 uppercase tracking-wide flex items-center gap-2">
                  {colour.colour_hex && (
                    <span className="w-3.5 h-3.5 rounded-full border border-white" style={{ backgroundColor: colour.colour_hex }} />
                  )}
                  Colour: {colour.colour_name}
                </h5>
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                      <th className="py-2.5 border-r border-slate-200">Size</th>
                      {availableSizes.map((size) => (
                        <th key={size} className="py-2.5 border-r border-slate-200">{size}</th>
                      ))}
                      <th className="py-2.5">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-xs">
                      <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/50">
                        Qty (Pcs)
                      </td>
                      {availableSizes.map((size) => (
                        <td key={size} className="py-2.5 px-3 border-r border-slate-200">
                          <NumericInput
                            min="0"
                            value={sizeQuantities[colour.id]?.[size] || 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              setSizeQuantities((prev) => ({
                                ...prev,
                                [colour.id]: { ...(prev[colour.id] || {}), [size]: val },
                              }));
                            }}
                            className="w-16 h-8 text-center border border-slate-200 rounded focus:ring-1 focus:ring-[#6366F1]"
                          />
                        </td>
                      ))}
                      <td className="py-2.5 px-3 font-bold text-slate-800 bg-slate-50/50">
                        {Object.values(sizeQuantities[colour.id] || {}).reduce((a, b) => a + b, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={onBack}
          className="border border-[#E5E7EB] hover:bg-slate-50 text-slate-700 font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          Next: Assign Stages
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
