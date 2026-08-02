"use client";

import { ArrowLeft, Boxes, ChevronRight, Info } from "lucide-react";
import { NumericInput } from "@/components/ui/numeric-input";
import { SizeQuantityMatrix } from "@/components/shared/SizeQuantityMatrix";

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
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4 text-[var(--text-primary)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
        <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
          <Boxes className="h-4.5 w-4.5 text-[var(--primary)]" />
          Step 4: Size Set & Quantities
        </h3>
      </div>

      <div className="space-y-4">
        {/* Average meter calculator */}
        <div className="p-4 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl space-y-3">
          <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase flex items-center gap-2">
            <Info size={14} className="text-[var(--primary)]" />
            Auto-estimate Size Quantities from Allocated fabric
          </h4>
          <p className="text-[11px] text-[var(--text-muted)] leading-normal">
            You have allocated <strong className="text-[var(--text-primary)]">{totalAllocatedMeters.toFixed(2)} meters</strong> of fabric. Enter the average fabric requirement per piece to calculate suggested quantity.
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1 max-w-xs">
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1">Average Meter / Pc</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={averageMeter || ""}
                onChange={(e) => setAverageMeter(parseFloat(e.target.value) || 0)}
                placeholder="e.g. 1.6"
                className="w-full h-9 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] px-3 text-xs"
              />
            </div>
            <div className="flex items-end gap-2 h-16 pt-5">
              <button
                type="button"
                onClick={onFetchHistoricalAvg}
                disabled={calculatingAvg}
                className="h-9 px-3 border border-[var(--border)] bg-[var(--primary-light)] text-[var(--primary)] text-xs font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {calculatingAvg ? "Loading..." : "Suggest from History"}
              </button>
              <button
                type="button"
                onClick={onPrefillSizeQuantities}
                disabled={suggestedPieces <= 0}
                className="h-9 px-3 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50"
              >
                Prefill Distribute ({suggestedPieces} Pcs)
              </button>
            </div>
          </div>
        </div>

        {/* Same colours toggle */}
        <div className="flex items-center justify-between bg-[var(--page-bg)] p-2.5 rounded-lg border border-[var(--border)]">
          <span className="text-xs font-bold text-[var(--text-primary)]">Multi-Colour Sizing Config</span>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useSameColours"
              checked={useSameColours}
              onChange={(e) => { setUseSameColours(e.target.checked); setSizeQuantities({}); }}
              className="h-4.5 w-4.5 rounded border-[var(--input-border)] text-[var(--primary)] cursor-pointer"
            />
            <label htmlFor="useSameColours" className="text-xs text-[var(--text-muted)] font-semibold select-none cursor-pointer">
              Use same size quantities for all colours
            </label>
          </div>
        </div>

        {/* Sizing grids */}
        {availableSizes.length === 0 ? (
          <div className="py-6 text-center text-xs text-[var(--text-faint)]">Please select design size set template.</div>
        ) : useSameColours ? (
          <SizeQuantityMatrix
            sizes={availableSizes}
            sizeQuantities={sizeQuantities["all"] || {}}
            showAllColorsOption={true}
            autoFillAllColors={useSameColours}
            onAutoFillAllColorsChange={setUseSameColours}
            onChange={(updated) => {
              setSizeQuantities((prev) => ({ ...prev, "all": updated }));
            }}
          />
        ) : (
          <div className="space-y-4">
            {selectedColours.map((colour) => (
              <div key={colour.id} className="space-y-1.5">
                <h5 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide flex items-center gap-2 px-1">
                  {colour.colour_hex && (
                    <span className="w-3.5 h-3.5 rounded-full border border-white" style={{ backgroundColor: colour.colour_hex }} />
                  )}
                  Colour: {colour.colour_name}
                </h5>
                <SizeQuantityMatrix
                  sizes={availableSizes}
                  sizeQuantities={sizeQuantities[colour.id] || {}}
                  showAllColorsOption={true}
                  autoFillAllColors={useSameColours}
                  onAutoFillAllColorsChange={setUseSameColours}
                  onChange={(updated) => {
                    setSizeQuantities((prev) => ({ ...prev, [colour.id]: updated }));
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-[var(--border)]">
        <button
          type="button"
          onClick={onBack}
          className="border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-[var(--text-primary)] font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          Next: Assign Stages
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
