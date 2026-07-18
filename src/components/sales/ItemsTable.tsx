import React, { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ItemsTableProps {
  state: any;
  designs: any[];
}

export function ItemsTable({ state, designs }: ItemsTableProps) {
  const [selectedDesignId, setSelectedDesignId] = useState("");
  const [selectedColourId, setSelectedColourId] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [rate, setRate] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [taxPercent, setTaxPercent] = useState<number>(5);

  const selectedDesign = designs.find((d) => d.id === selectedDesignId);
  const colours = selectedDesign?.design_colours || [];
  const sizes = selectedDesign?.size_set?.sizes || [];

  useEffect(() => {
    if (selectedDesign) {
      setRate(selectedDesign.sale_price || 0);
      setSelectedColourId(colours[0]?.id || "");
      setSelectedSize(sizes[0] || "");
    }
  }, [selectedDesignId]);

  const handleAddItem = () => {
    if (!selectedDesignId) return;
    const newItem = {
      design_id: selectedDesignId,
      design_code: selectedDesign.design_number,
      design_name: selectedDesign.name,
      colour_id: selectedColourId || null,
      colour_name: colours.find((c: any) => c.id === selectedColourId)?.colour_name || "—",
      size: selectedSize,
      quantity: Number(qty),
      unit: "Pcs",
      rate: Number(rate),
      discount_percent: Number(discountPercent),
      tax_percent: Number(taxPercent),
      amount: Number(qty) * Number(rate) * (1 - Number(discountPercent) / 100),
    };

    state.setItems((prev: any[]) => [...prev, newItem]);
    // Reset add panel
    setSelectedDesignId("");
    setSelectedColourId("");
    setSelectedSize("");
    setQty(1);
    setRate(0);
    setDiscountPercent(0);
  };

  const handleRemoveItem = (index: number) => {
    state.setItems((prev: any[]) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Add Item Form Grid */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 md:grid-cols-7 gap-4 items-end">
        <div className="col-span-2 md:col-span-2 space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Design *</label>
          <select
            value={selectedDesignId}
            onChange={(e) => setSelectedDesignId(e.target.value)}
            className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-xs focus:outline-none"
          >
            <option value="">Select Design</option>
            {designs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.design_number} - {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Colour</label>
          <select
            value={selectedColourId}
            onChange={(e) => setSelectedColourId(e.target.value)}
            className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-xs focus:outline-none"
          >
            {colours.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.colour_name}
              </option>
            ))}
            {colours.length === 0 && <option value="">—</option>}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Size</label>
          <select
            value={selectedSize}
            onChange={(e) => setSelectedSize(e.target.value)}
            className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-xs focus:outline-none"
          >
            {sizes.map((s: string) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            {sizes.length === 0 && <option value="">—</option>}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Qty *</label>
          <input
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-xs focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Rate *</label>
          <input
            type="number"
            min="0"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-xs focus:outline-none"
          />
        </div>

        <Button
          type="button"
          onClick={handleAddItem}
          disabled={!selectedDesignId || qty <= 0 || rate < 0}
          className="bg-[#6366F1] hover:bg-[#4F46E5] text-white flex items-center justify-center gap-1.5 h-10 font-bold"
        >
          <Plus size={14} />
          <span>Add</span>
        </Button>
      </div>

      {/* Line Items Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#F3F4F6] bg-slate-50 font-bold text-slate-600">
              <th className="p-4">Design Code</th>
              <th className="p-4">Design Name</th>
              <th className="p-4">Colour</th>
              <th className="p-4">Size</th>
              <th className="p-4 text-right">Qty</th>
              <th className="p-4 text-right">Rate</th>
              <th className="p-4 text-right">Disc %</th>
              <th className="p-4 text-right">Tax %</th>
              <th className="p-4 text-right">Total</th>
              <th className="p-4 text-center">Remove</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {state.items.map((it: any, index: number) => (
              <tr key={index} className="hover:bg-slate-50">
                <td className="p-4 font-mono font-bold text-slate-700">{it.design_code}</td>
                <td className="p-4 font-semibold text-slate-700">{it.design_name}</td>
                <td className="p-4 text-slate-600">{it.colour_name}</td>
                <td className="p-4 font-bold text-slate-600">{it.size}</td>
                <td className="p-4 text-right font-semibold text-slate-700">{it.quantity}</td>
                <td className="p-4 text-right text-slate-700">₹{it.rate.toFixed(2)}</td>
                <td className="p-4 text-right text-slate-600">{it.discount_percent}%</td>
                <td className="p-4 text-right text-slate-600">{it.tax_percent}%</td>
                <td className="p-4 text-right font-bold text-slate-800">₹{it.amount.toFixed(2)}</td>
                <td className="p-4 text-center">
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="p-1 hover:bg-red-50 text-red-500 rounded-md transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {state.items.length === 0 && (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-400 font-semibold">
                  No items added yet. Complete the form above to add lines.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
