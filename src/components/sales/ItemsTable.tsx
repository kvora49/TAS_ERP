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

  // Size quantity matrix state: { "28": 10, "30": 15, "32": 20 }
  const [sizeQuantities, setSizeQuantities] = useState<Record<string, number>>({});
  // Fallback single Qty state for non-sized designs
  const [singleQty, setSingleQty] = useState<number>(1);

  const selectedDesign = designs.find((d) => d.id === selectedDesignId);
  const colours = selectedDesign?.design_colours || [];
  const sizes: string[] = selectedDesign?.size_set?.sizes || [];

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
    const colourObj = colours.find((c: any) => c.id === selectedColourId);
    const colourName = colourObj?.colour_name || "Default";

    const newItems: any[] = [];

    if (sizes.length > 0) {
      // Loop through matrix and add entries for each size with qty > 0
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
            colour_id: selectedColourId || null,
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
      // Non-sized item
      const qtyVal = Number(singleQty || 0);
      if (qtyVal > 0) {
        const discountFactor = 1 - Number(discountPercent || 0) / 100;
        const lineAmount = qtyVal * Number(rate || 0) * discountFactor;

        newItems.push({
          id: crypto.randomUUID(),
          design_id: selectedDesignId,
          design_code: designCode,
          design_name: designName,
          colour_id: selectedColourId || null,
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

    if (newItems.length === 0) return;

    state.setItems((prev: any[]) => [...prev, ...newItems]);
    toast.success(`Added ${totalMatrixQty} Pcs to invoice`);

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

  const handleRemoveItem = (index: number) => {
    state.setItems((prev: any[]) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6 select-none">
      {/* 1. Design & Configuration Selection Header */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-2 space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Design <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedDesignId}
              onChange={(e) => setSelectedDesignId(e.target.value)}
              className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">-- Select Design --</option>
              {designs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.design_number || d.code} - {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Colour
            </label>
            <select
              value={selectedColourId}
              onChange={(e) => setSelectedColourId(e.target.value)}
              className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {colours.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.colour_name}
                </option>
              ))}
              {colours.length === 0 && <option value="">Default Colour</option>}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Rate (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={rate || ""}
              onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Disc %
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={discountPercent || ""}
                onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                placeholder="0%"
                className="w-full h-10 px-2 bg-white border border-[#D1D5DB] rounded-lg text-xs text-center focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Tax %
              </label>
              <input
                type="number"
                min="0"
                value={taxPercent || ""}
                onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
                placeholder="5%"
                className="w-full h-10 px-2 bg-white border border-[#D1D5DB] rounded-lg text-xs text-center focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 2. Sizing & Quantity Matrix Box (Exact UI from User Screenshot) */}
        {selectedDesignId && (
          <div className="space-y-3 pt-2">
            {sizes.length > 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-4 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers size={13} className="text-indigo-600" />
                    Standard Size Quantities (Applies to Selected Colour)
                  </span>
                  {selectedDesign?.size_set?.name && (
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                      {selectedDesign.size_set.name}
                    </span>
                  )}
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
                          TOTAL
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
                              onChange={(e) =>
                                setSizeQuantities({
                                  ...sizeQuantities,
                                  [s]: Math.max(0, parseInt(e.target.value, 10) || 0),
                                })
                              }
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
            {state.items.map((it: any, index: number) => (
              <tr key={it.id || index} className="hover:bg-slate-50/80 transition-colors">
                <td className="p-3.5 pl-4 font-mono font-bold text-indigo-600">{it.design_code}</td>
                <td className="p-3.5 font-semibold text-slate-800">{it.design_name}</td>
                <td className="p-3.5 text-slate-600">{it.colour_name}</td>
                <td className="p-3.5 font-bold text-slate-700">
                  <span className="inline-block bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                    {it.size}
                  </span>
                </td>
                <td className="p-3.5 text-right font-bold text-slate-800">{it.quantity} Pcs</td>
                <td className="p-3.5 text-right text-slate-700 font-medium">₹{it.rate.toFixed(2)}</td>
                <td className="p-3.5 text-right text-slate-600">{it.discount_percent}%</td>
                <td className="p-3.5 text-right text-slate-600">{it.tax_percent}%</td>
                <td className="p-3.5 text-right font-extrabold text-slate-900">₹{it.amount.toFixed(2)}</td>
                <td className="p-3.5 text-center">
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
            ))}
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
