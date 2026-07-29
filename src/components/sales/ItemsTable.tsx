"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ItemsTableProps {
  state: any;
  designs: any[];
}

export function ItemsTable({ state, designs }: ItemsTableProps) {
  const [selectedDesignId, setSelectedDesignId] = useState("");
  const [selectedColourId, setSelectedColourId] = useState("");
  const [rate, setRate] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [taxPercent, setTaxPercent] = useState<number>(5);
  const [hsnCode, setHsnCode] = useState<string>("6204");

  // Size quantity matrix state: { "28": 10, "30": 15, "32": 20 }
  const [sizeQuantities, setSizeQuantities] = useState<Record<string, number>>({});
  // Fallback single Qty state for non-sized designs
  const [singleQty, setSingleQty] = useState<number>(1);

  // Search & Filter state for Design Select Combobox
  const [designSearch, setDesignSearch] = useState("");
  const [isDesignDropdownOpen, setIsDesignDropdownOpen] = useState(false);

  // Auto-fill states
  const [autoFillAllColors, setAutoFillAllColors] = useState(false);

  const selectedDesign = designs.find((d) => d.id === selectedDesignId);
  const colours = selectedDesign?.design_colours || [];
  const sizes: string[] = selectedDesign?.size_set?.sizes || [];

  // Filtered designs for searchable combobox
  const filteredDesigns = designs.filter((d) => {
    const code = (d.design_number || d.code || "").toLowerCase();
    const name = (d.name || "").toLowerCase();
    const term = designSearch.toLowerCase();
    return code.includes(term) || name.includes(term);
  });

  // Reset & initialize size quantities whenever selected design changes
  useEffect(() => {
    if (selectedDesign) {
      setRate(selectedDesign.sale_price || 0);
      setSelectedColourId(colours[0]?.id || "");

      if (sizes.length > 0) {
        const init: Record<string, number> = {};
        sizes.forEach((s) => {
          init[s] = 0;
        });
        setSizeQuantities(init);
      } else {
        setSizeQuantities({});
        setSingleQty(1);
      }
    } else {
      setSizeQuantities({});
      setRate(0);
    }
  }, [selectedDesignId]);

  // Handle single size input change with optional Auto-Fill all sizes capability
  const handleSizeQtyChange = (changedSize: string, value: number) => {
    const qtyVal = Math.max(0, value);

    setSizeQuantities((prev) => {
      const next = { ...prev, [changedSize]: qtyVal };
      return next;
    });
  };

  // Helper to trigger explicit Auto-Fill across all sizes with value from first size or entered value
  const applyAutoFillAllSizes = (fillValue: number) => {
    if (sizes.length === 0) return;
    const next: Record<string, number> = {};
    sizes.forEach((s) => {
      next[s] = Math.max(0, fillValue);
    });
    setSizeQuantities(next);
  };

  // Calculate total pieces from matrix
  const totalMatrixQty = sizes.length > 0
    ? Object.values(sizeQuantities).reduce((acc, qty) => acc + (Number(qty) || 0), 0)
    : Number(singleQty || 0);

  const handleAddItem = () => {
    if (!selectedDesignId) {
      toast.error("Please select a design");
      return;
    }

    if (totalMatrixQty <= 0) {
      toast.error("Please enter quantity for at least one size");
      return;
    }

    const designCode = selectedDesign?.design_number || selectedDesign?.code || "—";
    const designName = selectedDesign?.name || "—";

    // Determine target colours list based on autoFillAllColors checkbox
    const targetColoursList = autoFillAllColors && colours.length > 0
      ? colours
      : [colours.find((c: any) => c.id === selectedColourId) || { id: selectedColourId || null, colour_name: "Default" }];

    const newItems: any[] = [];

    // Process for each colour in targetColoursList
    targetColoursList.forEach((colObj: any) => {
      const colourId = colObj.id || null;
      const colourName = colObj.colour_name || "Default";

      if (sizes.length > 0) {
        sizes.forEach((sz) => {
          const qtyVal = Number(sizeQuantities[sz] || 0);
          if (qtyVal > 0) {
            const discountFactor = 1 - Number(discountPercent || 0) / 100;
            const lineAmount = qtyVal * Number(rate || 0) * discountFactor;

            newItems.push({
              id: crypto.randomUUID(),
              design_id: selectedDesignId,
              design_code: designCode,
              design_name: designName,
              colour_id: colourId,
              colour_name: colourName,
              size: sz,
              quantity: qtyVal,
              unit: "Pcs",
              rate: Number(rate || 0),
              discount_percent: Number(discountPercent || 0),
              tax_percent: Number(taxPercent || 0),
              amount: lineAmount,
            });
          }
        });
      } else {
        const qtyVal = Number(singleQty || 0);
        if (qtyVal > 0) {
          const discountFactor = 1 - Number(discountPercent || 0) / 100;
          const lineAmount = qtyVal * Number(rate || 0) * discountFactor;

          newItems.push({
            id: crypto.randomUUID(),
            design_id: selectedDesignId,
            design_code: designCode,
            design_name: designName,
            colour_id: colourId,
            colour_name: colourName,
            size: "—",
            quantity: qtyVal,
            unit: "Pcs",
            rate: Number(rate || 0),
            discount_percent: Number(discountPercent || 0),
            tax_percent: Number(taxPercent || 0),
            amount: lineAmount,
          });
        }
      }
    });

    if (newItems.length === 0) return;

    state.setItems((prev: any[]) => {
      const next = [...prev];
      newItems.forEach((newItem) => {
        const existingIndex = next.findIndex(
          (item) =>
            item.design_id === newItem.design_id &&
            ((newItem.colour_id && item.colour_id === newItem.colour_id) || item.colour_name === newItem.colour_name) &&
            String(item.size).trim().toLowerCase() === String(newItem.size).trim().toLowerCase()
        );

        if (existingIndex >= 0) {
          const existing = next[existingIndex];
          const updatedQty = Number(existing.quantity || 0) + Number(newItem.quantity || 0);
          const discountFactor = 1 - Number(existing.discount_percent || 0) / 100;
          const updatedAmount = updatedQty * Number(existing.rate || 0) * discountFactor;

          next[existingIndex] = {
            ...existing,
            quantity: updatedQty,
            amount: updatedAmount,
          };
        } else {
          next.push(newItem);
        }
      });
      return next;
    });

    const addedTotalQty = newItems.reduce((acc, curr) => acc + curr.quantity, 0);
    toast.success(`Added ${addedTotalQty} Pcs to invoice`);

    // Reset size matrix quantities for next entry while preserving design/rate
    if (sizes.length > 0) {
      const resetQty: Record<string, number> = {};
      sizes.forEach((s) => {
        resetQty[s] = 0;
      });
      setSizeQuantities(resetQty);
    } else {
      setSingleQty(1);
    }
  };

  const handleItemQtyChange = (index: number, newQty: number) => {
    const qty = Math.max(1, newQty);
    state.setItems((prev: any[]) => {
      const next = [...prev];
      const target = next[index];
      if (!target) return prev;
      const discountFactor = 1 - Number(target.discount_percent || 0) / 100;
      const amount = qty * Number(target.rate || 0) * discountFactor;
      next[index] = { ...target, quantity: qty, amount };
      return next;
    });
  };

  const handleItemRateChange = (index: number, newRate: number) => {
    const rateVal = Math.max(0, newRate);
    state.setItems((prev: any[]) => {
      const next = [...prev];
      const target = next[index];
      if (!target) return prev;
      const discountFactor = 1 - Number(target.discount_percent || 0) / 100;
      const amount = Number(target.quantity || 0) * rateVal * discountFactor;
      next[index] = { ...target, rate: rateVal, amount };
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    state.setItems((prev: any[]) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6 select-none">
      {/* 1. Design & Configuration Selection Header */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          {/* SEARCHABLE DESIGN COMBOBOX DROPDOWN */}
          <div className="md:col-span-2 space-y-1 relative">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Design <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDesignDropdownOpen(!isDesignDropdownOpen)}
                className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs font-semibold text-left flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
              >
                <span className="truncate text-[var(--text-primary)]">
                  {selectedDesign
                    ? `${selectedDesign.design_number || selectedDesign.code} - ${selectedDesign.name}`
                    : "-- Select Design --"}
                </span>
                <span className="text-[var(--text-faint)] text-[10px]">▼</span>
              </button>

              {isDesignDropdownOpen && (
                <div className="absolute z-50 top-11 left-0 right-0 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-xl p-2 space-y-2 max-h-64 overflow-y-auto">
                  <input
                    type="text"
                    placeholder="Search Design Code or Name..."
                    value={designSearch}
                    onChange={(e) => setDesignSearch(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-[var(--page-bg)] text-[var(--text-primary)] border border-[var(--border)] rounded-lg outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
                    autoFocus
                  />
                  <div className="space-y-1">
                    {filteredDesigns.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          setSelectedDesignId(d.id);
                          setIsDesignDropdownOpen(false);
                          setDesignSearch("");
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                          d.id === selectedDesignId ? "bg-[var(--primary-light)] text-[var(--primary)] font-bold" : "hover:bg-[var(--table-row-hover)] text-[var(--text-body)]"
                        }`}
                      >
                        <span className="font-mono font-bold text-[var(--primary)]">
                          {d.design_number || d.code}
                        </span>
                        <span className="truncate ml-2 text-[var(--text-body)]">{d.name}</span>
                      </button>
                    ))}
                    {filteredDesigns.length === 0 && (
                      <div className="p-3 text-center text-xs text-[var(--text-faint)]">
                        No designs found matching &quot;{designSearch}&quot;
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Colour
              </label>
              {colours.length > 0 && (
                <label className="flex items-center gap-1 cursor-pointer text-[10px] text-indigo-600 font-bold">
                  <input
                    type="checkbox"
                    checked={autoFillAllColors}
                    onChange={(e) => setAutoFillAllColors(e.target.checked)}
                    className="h-3 w-3 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>All Colours</span>
                </label>
              )}
            </div>
            <select
              value={selectedColourId}
              onChange={(e) => setSelectedColourId(e.target.value)}
              disabled={!selectedDesignId}
              className="w-full h-10 px-3 bg-[var(--input-bg)] text-[var(--text-primary)] border border-[var(--input-border)] rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)] disabled:bg-[var(--page-bg)] disabled:opacity-75"
            >
              <option value="">-- Select Colour --</option>
              {colours.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.colour_name}
                </option>
              ))}
            </select>
          </div>

          {/* Rate / Unit Price Input */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
              Unit Rate (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
            />
          </div>

          {/* HSN Code */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
              HSN Code
            </label>
            <input
              type="text"
              value={hsnCode}
              onChange={(e) => setHsnCode(e.target.value)}
              placeholder="6204"
              className="w-full h-10 px-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-center text-[var(--text-primary)] focus:outline-none"
            />
          </div>

          {/* GST % */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
              GST %
            </label>
            <input
              type="number"
              min="0"
              max="28"
              value={taxPercent}
              onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
              placeholder="12"
              className="w-full h-10 px-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-center text-[var(--text-primary)] focus:outline-none"
            />
          </div>
        </div>

        {/* 2. Sizing & Quantity Matrix Box */}
        {selectedDesignId && (
          <div className="space-y-3 pt-2">
            {sizes.length > 0 ? (
              <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] overflow-hidden shadow-[var(--shadow-sm)]">
                <div className="px-4 py-2.5 bg-[var(--table-header-bg)] border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                    <Layers size={13} className="text-[var(--primary)]" />
                    Standard Size Quantities {autoFillAllColors ? "(Applies to ALL Colours)" : "(Applies to Selected Colour)"}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const firstQty = Number(sizeQuantities[sizes[0]] || 0);
                        applyAutoFillAllSizes(firstQty);
                        toast.info(`Filled all sizes with ${firstQty} Pcs`);
                      }}
                      className="h-7 px-2.5 rounded bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title="Copy first size quantity to all sizes"
                    >
                      <span>⚡ Auto-Fill All Sizes</span>
                    </button>

                    {selectedDesign?.size_set?.name && (
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {selectedDesign.size_set.name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-center border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 font-bold text-slate-700">
                        <th className="py-2.5 px-4 text-left font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200 min-w-[100px]">
                          SIZE
                        </th>
                        {sizes.map((s) => (
                          <th key={s} className="py-2.5 px-3 border-r border-slate-200 min-w-[84px] text-slate-800 font-bold">
                            {s}
                          </th>
                        ))}
                        <th className="py-2.5 px-4 font-bold text-slate-900 bg-slate-100 min-w-[90px]">
                          TOTAL / COLOUR
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-3 px-4 text-left font-bold text-slate-600 border-r border-slate-200">
                          Qty (Pcs)
                        </td>
                        {sizes.map((s) => (
                          <td key={s} className="p-2 border-r border-slate-200">
                            <input
                              type="number"
                              min="0"
                              value={sizeQuantities[s] ?? 0}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleSizeQtyChange(s, parseInt(e.target.value, 10) || 0)}
                              className="w-20 h-9 px-2 text-center border border-slate-200 rounded-md font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </td>
                        ))}
                        <td className="py-3 px-4 font-extrabold text-indigo-700 text-sm bg-indigo-50/50">
                          {totalMatrixQty}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between gap-4">
                <span className="text-xs font-bold text-slate-600 uppercase">Quantity (Pcs)</span>
                <input
                  type="number"
                  min="1"
                  value={singleQty}
                  onChange={(e) => setSingleQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-24 h-9 px-3 border border-slate-200 rounded-md text-xs font-bold text-center text-slate-800 focus:outline-none"
                />
              </div>
            )}

            {/* Add Button Row */}
            <div className="flex items-center justify-end gap-3 pt-1">
              <span className="text-xs text-slate-500">
                Line Total: <strong className="text-slate-900 font-bold">₹{(totalMatrixQty * rate * (1 - discountPercent / 100)).toFixed(2)}</strong> ({totalMatrixQty} Pcs)
              </span>
              <Button
                type="button"
                onClick={handleAddItem}
                disabled={!selectedDesignId || totalMatrixQty <= 0 || rate < 0}
                className="bg-[#6366F1] hover:bg-[#4F46E5] text-white flex items-center justify-center gap-1.5 h-10 px-5 font-bold shadow-md shadow-indigo-600/10 cursor-pointer"
              >
                <Plus size={16} />
                <span>Add Items to Invoice</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Added Line Items Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600 uppercase tracking-wider text-[11px]">
              <th className="p-3.5 pl-4">Design Code</th>
              <th className="p-3.5">Design Name</th>
              <th className="p-3.5">Colour</th>
              <th className="p-3.5">Size</th>
              <th className="p-3.5 text-right">Qty</th>
              <th className="p-3.5 text-right">Rate</th>
              <th className="p-3.5 text-right">Disc %</th>
              <th className="p-3.5 text-right">Tax %</th>
              <th className="p-3.5 text-right">Total</th>
              <th className="p-3.5 text-center">Remove</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {state.items.map((it: any, index: number) => {
              const matchedDesign = designs.find((d) => d.id === it.design_id);
              const designCode = (it.design_code && it.design_code !== "—") ? it.design_code : (matchedDesign?.design_number || matchedDesign?.code || "—");
              const designName = (it.design_name && it.design_name !== "—") ? it.design_name : (matchedDesign?.name || "—");
              const colourName = (it.colour_name && it.colour_name !== "Default") ? it.colour_name : (matchedDesign?.design_colours?.find((c: any) => c.id === it.colour_id)?.colour_name || "Default");

              return (
                <tr key={it.id || index} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3 pl-4 font-mono font-bold text-indigo-600">{designCode}</td>
                  <td className="p-3 font-semibold text-slate-800">{designName}</td>
                  <td className="p-3 text-slate-600">{colourName}</td>
                  <td className="p-3 font-bold text-slate-700">
                    <span className="inline-block bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                      {it.size}
                    </span>
                  </td>
                  <td className="p-2 text-right">
                    <input
                      type="number"
                      min="1"
                      value={it.quantity}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleItemQtyChange(index, parseInt(e.target.value, 10) || 1)}
                      className="w-16 h-8 px-2 text-right border border-slate-200 rounded font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                    />
                  </td>
                  <td className="p-2 text-right">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.rate}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleItemRateChange(index, parseFloat(e.target.value) || 0)}
                      className="w-20 h-8 px-2 text-right border border-slate-200 rounded font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                    />
                  </td>
                  <td className="p-3 text-right text-slate-600">{it.discount_percent}%</td>
                  <td className="p-3 text-right text-slate-600">{it.tax_percent}%</td>
                  <td className="p-3 text-right font-extrabold text-slate-900">₹{(Number(it.amount) || 0).toFixed(2)}</td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="p-1 hover:bg-red-50 text-red-500 rounded-md transition-colors cursor-pointer"
                      title="Remove Line"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {state.items.length === 0 && (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-400 font-semibold">
                  No items added yet. Select a design and enter quantities in the size matrix above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
