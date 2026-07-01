"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Building2,
  Plus,
  Trash2,
  RefreshCw,
  Info,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  ListPlus
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Godown {
  id: string;
  name: string;
}

interface Design {
  id: string;
  design_number: string;
  name: string;
  sale_price: number;
  size_set?: { name: string; sizes: string[] };
}

interface Colour {
  id: string;
  colour_name: string;
  colour_hex?: string;
}

interface TransferItemInput {
  design_id: string;
  colour_id: string;
  size: string;
  quantity: number;
  available_stock: number;
  unit_cost: number;
  total_value: number;
  coloursList: Colour[];
  sizesList: string[];
}

export default function NewTransferPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Form Header State
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split("T")[0]);
  const [fromGodownId, setFromGodownId] = useState("");
  const [toGodownId, setToGodownId] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [reason, setReason] = useState("Stock Rebalancing");
  const [status, setStatus] = useState<"pending" | "in_transit" | "completed">("pending");
  const [remarks, setRemarks] = useState("");

  // Masters
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);

  // Form Items State
  const [items, setItems] = useState<TransferItemInput[]>([
    {
      design_id: "",
      colour_id: "",
      size: "",
      quantity: 1,
      available_stock: 0,
      unit_cost: 0,
      total_value: 0,
      coloursList: [],
      sizesList: []
    }
  ]);

  // Load masters on mount
  useEffect(() => {
    // 1. Fetch godowns
    fetch("/api/raw-materials/stock?view=summary")
      .then((res) => res.json())
      .then((data) => {
        if (data.godowns) {
          setGodowns(data.godowns);
        } else {
          setGodowns([
            { id: "g1", name: "Main Godown" },
            { id: "g2", name: "Godown A" },
          ]);
        }
      })
      .catch(() => {
        setGodowns([
          { id: "g1", name: "Main Godown" },
          { id: "g2", name: "Godown A" },
        ]);
      });

    // 2. Fetch designs
    fetch("/api/finished-stock/designs")
      .then((res) => res.json())
      .then((data) => {
        if (data.designs) {
          setDesigns(data.designs);
        }
      })
      .catch((err) => console.error("Error loading designs:", err));
  }, []);

  const handleAddRow = () => {
    setItems([
      ...items,
      {
        design_id: "",
        colour_id: "",
        size: "",
        quantity: 1,
        available_stock: 0,
        unit_cost: 0,
        total_value: 0,
        coloursList: [],
        sizesList: []
      }
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (items.length === 1) {
      toast.info("At least one transfer item row is required");
      return;
    }
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleDesignChange = async (index: number, designId: string) => {
    const selectedDesign = designs.find((d) => d.id === designId);
    const updated = [...items];
    updated[index].design_id = designId;
    updated[index].colour_id = "";
    updated[index].size = "";
    updated[index].available_stock = 0;
    
    if (selectedDesign) {
      updated[index].sizesList = selectedDesign.size_set?.sizes || ["S", "M", "L", "XL", "XXL"];
      updated[index].unit_cost = Math.round(Number(selectedDesign.sale_price || 0) * 0.6);
      updated[index].total_value = updated[index].quantity * updated[index].unit_cost;
    } else {
      updated[index].sizesList = [];
      updated[index].unit_cost = 0;
      updated[index].total_value = 0;
    }

    setItems(updated);

    if (!designId) return;

    // Load colours
    try {
      const res = await fetch(`/api/finished-stock/designs/${designId}`);
      const data = await res.json();
      if (res.ok && data.colours) {
        const current = [...items];
        // Double check design_id hasn't changed since request
        if (current[index].design_id === designId) {
          current[index].coloursList = data.colours;
          setItems(current);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleItemPropertyChange = async (
    index: number,
    field: "colour_id" | "size" | "quantity" | "unit_cost",
    value: any
  ) => {
    const updated = [...items];
    
    if (field === "quantity") {
      updated[index].quantity = Math.max(1, parseInt(value, 10) || 0);
      updated[index].total_value = updated[index].quantity * updated[index].unit_cost;
    } else if (field === "unit_cost") {
      updated[index].unit_cost = Math.max(0, parseFloat(value) || 0);
      updated[index].total_value = updated[index].quantity * updated[index].unit_cost;
    } else {
      updated[index][field] = value;
    }

    setItems(updated);

    // Fetch stock level if godown, design, colour, and size are selected
    const item = updated[index];
    if ((field === "colour_id" || field === "size") && fromGodownId && item.design_id && item.colour_id && item.size) {
      try {
        const res = await fetch(`/api/finished-stock/designs/${item.design_id}`);
        const json = await res.json();
        if (res.ok && json.matrix) {
          const qty = json.matrix[item.colour_id]?.[fromGodownId]?.[item.size] || 0;
          const current = [...items];
          current[index].available_stock = qty;
          setItems(current);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fromGodownId || !toGodownId || !transferDate || !reason) {
      toast.error("Please fill in all header details");
      return;
    }

    if (fromGodownId === toGodownId) {
      toast.error("Source and destination godowns must be different");
      return;
    }

    // Validate items
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.design_id || !it.colour_id || !it.size || !it.quantity || !it.unit_cost) {
        toast.error(`Please complete all fields on item row #${i + 1}`);
        return;
      }
      if (it.quantity > it.available_stock) {
        toast.error(`Row #${i + 1}: Requested quantity (${it.quantity}) exceeds available stock (${it.available_stock} pcs) in source godown.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/finished-stock/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transfer_date: transferDate,
          from_godown_id: fromGodownId,
          to_godown_id: toGodownId,
          reference_no: referenceNo,
          reason,
          remarks,
          status,
          items: items.map((it) => ({
            design_id: it.design_id,
            colour_id: it.colour_id,
            size: it.size,
            quantity: it.quantity,
            unit_cost: it.unit_cost,
            total_value: it.total_value,
          })),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Stock transfer registered successfully!");
        router.push("/finished-stock/transfers");
      } else {
        toast.error(data.error || "Failed to create transfer");
      }
    } catch (err) {
      console.error(err);
      toast.error("A network error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Summaries
  const totalQty = items.reduce((acc, it) => acc + (it.quantity || 0), 0);
  const totalVal = items.reduce((acc, it) => acc + (it.total_value || 0), 0);

  const formatRupee = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B]">
        <Link href="/finished-stock" className="hover:text-[#6366F1] transition-colors">
          Finished Stock
        </Link>
        <span>/</span>
        <Link href="/finished-stock/transfers" className="hover:text-[#6366F1] transition-colors">
          Transfers
        </Link>
        <span>/</span>
        <span className="text-[#334155]">New</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/finished-stock/transfers"
          className="p-2 bg-white hover:bg-gray-50 border border-[#E2E8F0] rounded-xl transition-all cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5 text-[#475569]" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight">New Stock Transfer</h1>
          <p className="text-sm text-[#64748B]">Transfer finished garments between warehouse godowns</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Side: Form Header & Items Table */}
        <div className="lg:col-span-3 space-y-6">
          {/* Header Panel */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#1E293B] border-b border-[#F1F5F9] pb-2 flex items-center gap-2">
              <Building2 className="h-4.5 w-4.5 text-[#6366F1]" />
              <span>Transfer Details</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#334155] uppercase tracking-wider">
                  Transfer Date *
                </label>
                <input
                  type="date"
                  required
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2 text-sm focus:border-[#C7D2FE] outline-none"
                />
              </div>

              {/* Source Godown */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#334155] uppercase tracking-wider">
                  Source Godown *
                </label>
                <select
                  required
                  value={fromGodownId}
                  onChange={(e) => {
                    setFromGodownId(e.target.value);
                    // Reset stocks on godown change
                    setItems(items.map(it => ({ ...it, available_stock: 0 })));
                  }}
                  className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm focus:border-[#C7D2FE] outline-none bg-white"
                >
                  <option value="">Select Source...</option>
                  {godowns.map((g) => (
                    <option key={g.id} value={g.id} disabled={g.id === toGodownId}>{g.name}</option>
                  ))}
                </select>
              </div>

              {/* Destination Godown */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#334155] uppercase tracking-wider">
                  Destination Godown *
                </label>
                <select
                  required
                  value={toGodownId}
                  onChange={(e) => setToGodownId(e.target.value)}
                  className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm focus:border-[#C7D2FE] outline-none bg-white"
                >
                  <option value="">Select Destination...</option>
                  {godowns.map((g) => (
                    <option key={g.id} value={g.id} disabled={g.id === fromGodownId}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Ref Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#334155] uppercase tracking-wider">
                  Reference No
                </label>
                <input
                  type="text"
                  placeholder="e.g. EB-10029"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2 text-sm focus:border-[#C7D2FE] outline-none"
                />
              </div>

              {/* Reason */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#334155] uppercase tracking-wider">
                  Reason for Transfer *
                </label>
                <select
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm focus:border-[#C7D2FE] outline-none bg-white"
                >
                  <option value="Stock Rebalancing">Stock Rebalancing</option>
                  <option value="Sales Order">Sales Order Fulfillment</option>
                  <option value="Godown Consolidation">Godown Consolidation</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#334155] uppercase tracking-wider">
                  Initial Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm focus:border-[#C7D2FE] outline-none bg-white font-semibold text-slate-800"
                >
                  <option value="pending">Pending (Stock deducted from Source)</option>
                  <option value="in_transit">In Transit (Stock deducted, in route)</option>
                  <option value="completed">Completed (Added directly to Dest)</option>
                </select>
              </div>
            </div>

            {/* Remarks */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#334155] uppercase tracking-wider">
                Remarks
              </label>
              <textarea
                rows={1.5}
                placeholder="Additional delivery instructions..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2 text-sm focus:border-[#C7D2FE] outline-none resize-none"
              />
            </div>
          </div>

          {/* Items Table Panel */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1E293B] flex items-center gap-2">
                <ListPlus className="h-4.5 w-4.5 text-[#6366F1]" />
                <span>Transfer Items Grid</span>
              </h3>
              <button
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-1.5 text-xs font-bold text-[#6366F1] bg-[#EEF2FF] border border-[#C7D2FE] px-3.5 py-2 rounded-xl hover:bg-[#E0E7FF] transition-all cursor-pointer shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Add Item Row</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs font-semibold text-[#475569]">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#475569] uppercase tracking-wider">
                    <th className="py-3 px-4 w-8 text-center">#</th>
                    <th className="py-3 px-4 w-48">Design</th>
                    <th className="py-3 px-4 w-36">Colour</th>
                    <th className="py-3 px-3 w-24 text-center">Size</th>
                    <th className="py-3 px-3 w-28 text-center bg-slate-50/50">Available</th>
                    <th className="py-3 px-3 w-28 text-center">Qty (Pcs)</th>
                    <th className="py-3 px-3 w-28 text-right">Cost/Pc (₹)</th>
                    <th className="py-3 px-4 w-32 text-right">Total Value</th>
                    <th className="py-3 px-4 w-12 text-center">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/20">
                      <td className="py-3.5 px-4 text-center text-[#94A3B8] font-bold">{idx + 1}</td>
                      <td className="py-3 px-2">
                        <select
                          required
                          value={item.design_id}
                          onChange={(e) => handleDesignChange(idx, e.target.value)}
                          className="w-full border border-[#E2E8F0] rounded-xl px-2 py-1.5 text-xs outline-none bg-white"
                        >
                          <option value="">Select Design...</option>
                          {designs.map((d) => (
                            <option key={d.id} value={d.id}>{d.design_number}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-2">
                        <select
                          required
                          value={item.colour_id}
                          onChange={(e) => handleItemPropertyChange(idx, "colour_id", e.target.value)}
                          disabled={!item.design_id}
                          className="w-full border border-[#E2E8F0] rounded-xl px-2 py-1.5 text-xs outline-none bg-white disabled:bg-gray-50"
                        >
                          <option value="">Colour...</option>
                          {item.coloursList.map((c) => (
                            <option key={c.id} value={c.id}>{c.colour_name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-2">
                        <select
                          required
                          value={item.size}
                          onChange={(e) => handleItemPropertyChange(idx, "size", e.target.value)}
                          disabled={!item.design_id}
                          className="w-full border border-[#E2E8F0] rounded-xl px-2 py-1.5 text-xs outline-none bg-white text-center disabled:bg-gray-50"
                        >
                          <option value="">Size</option>
                          {item.sizesList.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-2 text-center bg-slate-50/30 text-[#1E293B] font-bold">
                        {item.available_stock.toLocaleString()} <span className="text-[10px] text-[#64748B] font-normal">pcs</span>
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          required
                          min={1}
                          max={item.available_stock || undefined}
                          value={item.quantity}
                          onChange={(e) => handleItemPropertyChange(idx, "quantity", e.target.value)}
                          className="w-full text-center border border-[#E2E8F0] rounded-xl px-2 py-1.5 text-xs outline-none font-bold text-[#1E293B]"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          required
                          min={0}
                          value={item.unit_cost}
                          onChange={(e) => handleItemPropertyChange(idx, "unit_cost", e.target.value)}
                          className="w-full text-right border border-[#E2E8F0] rounded-xl px-2 py-1.5 text-xs outline-none"
                        />
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-[#6366F1] text-xs">
                        {formatRupee(item.total_value)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="text-[#94A3B8] hover:text-[#EF4444] p-1.5 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Total Summary Sidebar Panel */}
        <div className="space-y-6">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#1E293B] border-b border-[#F1F5F9] pb-2 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span>Impact Summary</span>
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Total Items Count:</span>
                <span className="font-bold text-[#1E293B]">{items.length} rows</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Total Quantity (Pcs):</span>
                <span className="font-bold text-sm text-[#1E293B]">{totalQty.toLocaleString()} Pcs</span>
              </div>
              <div className="flex items-center justify-between border-t border-dashed border-[#F1F5F9] pt-3.5">
                <span className="text-[#64748B] font-bold">Aggregate Value:</span>
                <span className="font-extrabold text-base text-[#15803D]">{formatRupee(totalVal)}</span>
              </div>
            </div>

            <div className="border border-amber-100 bg-amber-50/50 rounded-xl p-3 flex gap-2.5">
              <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-[10px] text-amber-800 leading-normal font-semibold">
                <strong className="block mb-0.5">Inventory Timing Rule:</strong>
                Stock is deducted from source immediately. Destination godown receives stock only when updated to Completed.
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 text-xs font-bold text-white bg-[#6366F1] hover:bg-[#4F46E5] py-3 rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-100 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Stock Transfer"}
            </button>
            <Link
              href="/finished-stock/transfers"
              className="w-full flex items-center justify-center text-xs font-bold text-[#475569] bg-white border border-[#E2E8F0] py-3 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-all cursor-pointer text-center"
            >
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
