"use client";

import React from "react";
import { Layers, Zap } from "lucide-react";
import { NumericInput } from "@/components/ui/numeric-input";
import { toast } from "sonner";

interface SizeQuantityMatrixProps {
  sizes: string[];
  sizeQuantities: Record<string, number>;
  onChange: (updatedQuantities: Record<string, number>) => void;
  autoFillAllColors?: boolean;
  onAutoFillAllColorsChange?: (checked: boolean) => void;
  showAllColorsOption?: boolean;
  colourCount?: number;
  sizeSetName?: string;
  className?: string;
  readOnly?: boolean;
  availableStock?: Record<string, number>;
  allowNegativeStock?: boolean;
}

export function SizeQuantityMatrix({
  sizes,
  sizeQuantities,
  onChange,
  autoFillAllColors = false,
  onAutoFillAllColorsChange,
  showAllColorsOption = false,
  colourCount = 1,
  sizeSetName,
  className = "",
  readOnly = false,
  availableStock,
  allowNegativeStock = true,
}: SizeQuantityMatrixProps) {
  if (!sizes || sizes.length === 0) return null;

  const handleSizeChange = (size: string, val: number) => {
    let qtyVal = Math.max(0, val);
    if (allowNegativeStock === false && availableStock && availableStock[size] !== undefined) {
      const maxAvail = Math.max(0, availableStock[size]);
      if (qtyVal > maxAvail) {
        qtyVal = maxAvail;
        toast.warning(`Cannot exceed available stock of ${maxAvail} Pcs for size ${size}`);
      }
    }
    const updated = { ...sizeQuantities, [size]: qtyVal };
    onChange(updated);
  };

  const handleAutoFillAllSizes = () => {
    const firstSize = sizes[0];
    const fillValue = Number(sizeQuantities[firstSize] || 0);
    const updated: Record<string, number> = {};
    sizes.forEach((s) => {
      let val = Math.max(0, fillValue);
      if (allowNegativeStock === false && availableStock && availableStock[s] !== undefined) {
        val = Math.min(val, Math.max(0, availableStock[s]));
      }
      updated[s] = val;
    });
    onChange(updated);
    toast.info(`Auto-filled sizes with up to ${fillValue} Pcs`);
  };

  const totalPcs = Object.values(sizeQuantities).reduce(
    (sum, val) => sum + (Number(val) || 0),
    0
  );

  const totalAvailPcs = availableStock
    ? Object.values(availableStock).reduce((sum, val) => sum + (Number(val) || 0), 0)
    : null;

  return (
    <div
      className={`bg-[var(--card-bg)] rounded-xl border border-[var(--border)] overflow-hidden shadow-[var(--shadow-sm)] ${className}`}
    >
      {/* Header bar */}
      <div className="px-4 py-2.5 bg-[var(--table-header-bg)] border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
          <Layers size={13} className="text-[var(--primary)]" />
          Standard Size Quantities{" "}
          {showAllColorsOption && autoFillAllColors
            ? "(Applies to ALL Colours)"
            : "(Applies to Selected Colour)"}
        </span>

        <div className="flex items-center gap-2">
          {!readOnly && (
            <button
              type="button"
              onClick={handleAutoFillAllSizes}
              className="h-7 px-2.5 rounded bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
              title="Copy first size quantity to all sizes"
            >
              <Zap size={11} className="text-amber-500 fill-amber-500" />
              <span>Auto-Fill All Sizes</span>
            </button>
          )}

          {(showAllColorsOption || !!onAutoFillAllColorsChange) && (
            <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-1 rounded border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors">
              <input
                type="checkbox"
                checked={autoFillAllColors}
                onChange={(e) => {
                  const isChecked = e.target.checked;
                  onAutoFillAllColorsChange && onAutoFillAllColorsChange(isChecked);
                  if (isChecked && totalPcs > 0 && colourCount && colourCount > 1) {
                    toast.info(`Applied ${totalPcs} Pcs each across ${colourCount} colours (${totalPcs * colourCount} Pcs Grand Total)`);
                  }
                }}
                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span>Apply to All Colours</span>
            </label>
          )}

          {sizeSetName && (
            <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800">
              {sizeSetName}
            </span>
          )}

          {totalAvailPcs !== null && (
            <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
              Stock Avail: {totalAvailPcs} Pcs
            </span>
          )}

          <span className="text-[10px] font-mono font-bold text-[var(--text-primary)] bg-[var(--page-bg)] px-2.5 py-0.5 rounded border border-[var(--border)]">
            {autoFillAllColors && colourCount && colourCount > 1 ? (
              <>
                <span className="text-[var(--primary)]">{totalPcs} Pcs each</span>
                <span className="text-[var(--text-muted)] font-normal ml-1">
                  across {colourCount} colours ({totalPcs * colourCount} Pcs Total)
                </span>
              </>
            ) : (
              <>Total: {totalPcs} Pcs</>
            )}
          </span>
        </div>
      </div>

      {/* Grid of size input boxes */}
      <div className="p-3 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 bg-[var(--card-bg)]">
        {sizes.map((sz) => {
          const hasAvail = availableStock && availableStock[sz] !== undefined;
          const avail = hasAvail ? availableStock![sz] : undefined;
          const isOutOfStock = allowNegativeStock === false && hasAvail && (avail ?? 0) <= 0;

          return (
            <div key={sz} className="space-y-1">
              <div className="flex flex-col items-center bg-[var(--page-bg)] py-1 px-1 rounded border border-[var(--border)]">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">
                  {sz}
                </span>
                {hasAvail && (
                  <span
                    className={`text-[9px] font-semibold font-mono tracking-tight leading-none mt-0.5 ${
                      (avail ?? 0) > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-500 dark:text-rose-400"
                    }`}
                  >
                    {(avail ?? 0) > 0 ? `Avail: ${avail}` : "0 avail"}
                  </span>
                )}
              </div>
              <NumericInput
                min="0"
                max={allowNegativeStock === false && hasAvail ? Math.max(0, avail ?? 0) : undefined}
                placeholder="0"
                readOnly={readOnly}
                disabled={readOnly || isOutOfStock}
                value={sizeQuantities[sz] !== undefined ? sizeQuantities[sz] : ""}
                onChange={(e) => handleSizeChange(sz, Number(e.target.value || 0))}
                className={`w-full h-8 px-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-xs text-center font-bold text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--input-focus)] ${
                  isOutOfStock ? "opacity-50 cursor-not-allowed bg-[var(--page-bg)]" : ""
                }`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
