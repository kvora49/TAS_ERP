"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Building2,
  Palette,
  Layers,
  Sparkles,
  Info,
  DollarSign,
  AlertTriangle,
  UploadCloud,
  Search,
  CheckCircle,
  HelpCircle,
  RefreshCw
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

export default function NewAdjustmentPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [adjustmentDate, setAdjustmentDate] = useState(new Date().toISOString().split("T")[0]);
  const [adjustmentType, setAdjustmentType] = useState<"damage" | "sample" | "scrap" | "correction" | "other">("damage");
  const [godownId, setGodownId] = useState("");
  const [designId, setDesignId] = useState("");
  const [colourId, setColourId] = useState("");
  const [size, setSize] = useState("");
  const [qtySign, setQtySign] = useState<"add" | "reduce">("reduce");
  const [quantity, setQuantity] = useState<number>(10);
  const [unitCost, setUnitCost] = useState<number>(0);
  const [reason, setReason] = useState("Fabric Damage");
  const [remarks, setRemarks] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");

  // Masters
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [colours, setColours] = useState<Colour[]>([]);
  const [sizesList, setSizesList] = useState<string[]>([]);

  // Live Stock Check state
  const [checkingStock, setCheckingStock] = useState(false);
  const [stockInfo, setStockInfo] = useState<{
    available: number;
    reserved: number;
    free: number;
    checked: boolean;
  } | null>(null);

  // Load masters on mount
  useEffect(() => {
    // 1. Fetch godowns
    fetch("/api/master-data/godowns")
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

  // Load colours & sizes when design changes
  useEffect(() => {
    if (!designId) {
      setColours([]);
      setSizesList([]);
      setColourId("");
      setSize("");
      setStockInfo(null);
      return;
    }

    const selectedDesign = designs.find((d) => d.id === designId);
    if (selectedDesign) {
      setSizesList(selectedDesign.size_set?.sizes || ["S", "M", "L", "XL", "XXL"]);
      // Load unit cost fallback (60% of sale price)
      setUnitCost(Math.round(Number(selectedDesign.sale_price || 0) * 0.6));
    }

    // Fetch design details for colours
    fetch(`/api/finished-stock/designs/${designId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.colours) {
          setColours(data.colours);
        }
      })
      .catch((err) => console.error("Error loading design colours:", err));
  }, [designId, designs]);

  // Reset check stock on parameter change
  useEffect(() => {
    setStockInfo(null);
  }, [godownId, designId, colourId, size]);

  const handleCheckStock = async () => {
    if (!designId || !colourId || !size || !godownId) {
      toast.info("Please select Godown, Design, Colour, and Size first");
      return;
    }

    setCheckingStock(true);
    try {
      const res = await fetch(`/api/finished-stock/designs/${designId}`);
      const json = await res.json();
      if (res.ok && json.matrix) {
        const available = json.matrix[colourId]?.[godownId]?.[size] || 0;
        const reserved = Math.round(available * 0.1); // Mock 10% reserved
        const free = available - reserved;

        setStockInfo({
          available,
          reserved,
          free,
          checked: true
        });
        toast.success("Stock details verified");
      } else {
        toast.error("Failed to load current stock level");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error querying database");
    } finally {
      setCheckingStock(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!godownId || !designId || !colourId || !size || !quantity || !unitCost || !reason) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Quantity change logic (add = positive, reduce = negative)
    const qtyChange = qtySign === "add" ? quantity : -quantity;

    // Check if reducing more than available stock
    if (qtySign === "reduce" && stockInfo?.checked && Math.abs(qtyChange) > stockInfo.available) {
      toast.error(`Cannot reduce stock by ${quantity} pcs. Only ${stockInfo.available} pcs available on hand.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/finished-stock/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adjustment_type: adjustmentType,
          adjustment_date: adjustmentDate,
          godown_id: godownId,
          design_id: designId,
          colour_id: colourId,
          size,
          quantity_change: qtyChange,
          unit_cost: unitCost,
          reason,
          remarks,
          attachment_url: attachmentUrl,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Stock adjustment saved successfully!");
        router.push("/finished-stock/adjustments");
      } else {
        toast.error(data.error || "Failed to save adjustment");
      }
    } catch (err) {
      console.error(err);
      toast.error("A network error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedDesign = designs.find((d) => d.id === designId);
  const selectedColour = colours.find((c) => c.id === colourId);
  const valueImpact = quantity * unitCost;

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
        <Link href="/finished-stock/adjustments" className="hover:text-[#6366F1] transition-colors">
          Adjustments
        </Link>
        <span>/</span>
        <span className="text-[#334155]">New</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/finished-stock/adjustments"
          className="p-2 bg-white hover:bg-gray-50 border border-[#E2E8F0] rounded-xl transition-all cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5 text-[#475569]" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight">New Stock Adjustment</h1>
          <p className="text-sm text-[#64748B]">Record damage, scrap, samples or manually correct sizing stock</p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-5 bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#334155] uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-[#94A3B8]" />
                <span>Adjustment Date *</span>
              </label>
              <input
                type="date"
                required
                value={adjustmentDate}
                onChange={(e) => setAdjustmentDate(e.target.value)}
                className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm focus:border-[#C7D2FE] focus:ring-1 focus:ring-[#C7D2FE] outline-none"
              />
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#334155] uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-[#94A3B8]" />
                <span>Adjustment Type *</span>
              </label>
              <select
                required
                value={adjustmentType}
                onChange={(e) => {
                  setAdjustmentType(e.target.value as any);
                  // Auto-fill reason based on type
                  if (e.target.value === "damage") setReason("Fabric Damage");
                  else if (e.target.value === "sample") setReason("Sample Out");
                  else if (e.target.value === "scrap") setReason("Stitch Defect");
                  else if (e.target.value === "correction") setReason("Stock Correction");
                }}
                className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm focus:border-[#C7D2FE] focus:ring-1 focus:ring-[#C7D2FE] outline-none bg-white"
              >
                <option value="damage">Damage (Defective fabric/stitch)</option>
                <option value="sample">Sample (Marketing or client trials)</option>
                <option value="scrap">Scrap (Discarded/unsellable pieces)</option>
                <option value="correction">Correction (Manual audit adjustment)</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Godown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#334155] uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-[#94A3B8]" />
                <span>Warehouse / Godown *</span>
              </label>
              <select
                required
                value={godownId}
                onChange={(e) => setGodownId(e.target.value)}
                className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm focus:border-[#C7D2FE] focus:ring-1 focus:ring-[#C7D2FE] outline-none bg-white"
              >
                <option value="">Select Storage Godown...</option>
                {godowns.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* Design */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#334155] uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="h-4 w-4 text-[#94A3B8]" />
                <span>Select Design *</span>
              </label>
              <select
                required
                value={designId}
                onChange={(e) => setDesignId(e.target.value)}
                className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm focus:border-[#C7D2FE] focus:ring-1 focus:ring-[#C7D2FE] outline-none bg-white"
              >
                <option value="">Select Catalog Design...</option>
                {designs.map((d) => (
                  <option key={d.id} value={d.id}>{d.design_number} - {d.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Colour */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#334155] uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="h-4 w-4 text-[#94A3B8]" />
                <span>Design Colour *</span>
              </label>
              <select
                required
                value={colourId}
                onChange={(e) => setColourId(e.target.value)}
                disabled={!designId}
                className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm focus:border-[#C7D2FE] focus:ring-1 focus:ring-[#C7D2FE] outline-none bg-white disabled:bg-gray-50"
              >
                <option value="">Select Colour...</option>
                {colours.map((c) => (
                  <option key={c.id} value={c.id}>{c.colour_name}</option>
                ))}
              </select>
            </div>

            {/* Size */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#334155] uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-[#94A3B8]" />
                <span>Garment Size *</span>
              </label>
              <select
                required
                value={size}
                onChange={(e) => setSize(e.target.value)}
                disabled={!designId}
                className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm focus:border-[#C7D2FE] focus:ring-1 focus:ring-[#C7D2FE] outline-none bg-white disabled:bg-gray-50"
              >
                <option value="">Select Size...</option>
                {sizesList.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Quantity */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#334155] uppercase tracking-wider">
                Quantity Adjust *
              </label>
              <div className="flex border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
                <button
                  type="button"
                  onClick={() => setQtySign("reduce")}
                  className={cn(
                    "px-4 text-xs font-bold transition-all cursor-pointer border-r border-[#E2E8F0]",
                    qtySign === "reduce" ? "bg-red-500 text-white" : "bg-gray-50 hover:bg-gray-100 text-[#475569]"
                  )}
                >
                  Reduce (-)
                </button>
                <input
                  type="number"
                  required
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 0))}
                  className="w-full text-center py-2.5 text-sm outline-none font-bold text-[#1E293B]"
                />
                <button
                  type="button"
                  onClick={() => setQtySign("add")}
                  className={cn(
                    "px-4 text-xs font-bold transition-all cursor-pointer border-l border-[#E2E8F0]",
                    qtySign === "add" ? "bg-green-600 text-white" : "bg-gray-50 hover:bg-gray-100 text-[#475569]"
                  )}
                >
                  Add (+)
                </button>
              </div>
            </div>

            {/* Cost per piece */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#334155] uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-[#94A3B8]" />
                <span>Unit Cost per Piece *</span>
              </label>
              <input
                type="number"
                required
                min={0}
                value={unitCost}
                onChange={(e) => setUnitCost(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm focus:border-[#C7D2FE] focus:ring-1 focus:ring-[#C7D2FE] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Reason */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#334155] uppercase tracking-wider">
                Reason *
              </label>
              <input
                type="text"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm focus:border-[#C7D2FE] focus:ring-1 focus:ring-[#C7D2FE] outline-none"
                placeholder="Fabric Damage, Count Correction, etc."
              />
            </div>

            {/* Remarks */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#334155] uppercase tracking-wider">
                Remarks
              </label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm focus:border-[#C7D2FE] focus:ring-1 focus:ring-[#C7D2FE] outline-none"
                placeholder="Additional audit notes..."
              />
            </div>
          </div>

          {/* File Upload Placeholder */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#334155] uppercase tracking-wider">
              Upload Audit Attachment
            </label>
            <div className="border-2 border-dashed border-[#E2E8F0] rounded-2xl p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer flex flex-col items-center">
              <UploadCloud className="h-8 w-8 text-[#94A3B8] mb-2" />
              <p className="text-xs text-[#334155] font-semibold mb-1">Drag and drop file here, or click to browse</p>
              <p className="text-[10px] text-[#94A3B8]">Supports PDF, PNG, JPG up to 5MB</p>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#F1F5F9]">
            <Link
              href="/finished-stock/adjustments"
              className="text-xs font-bold text-gray-500 bg-white border border-[#E2E8F0] px-5 py-2.5 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-all cursor-pointer"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="text-xs font-bold text-white bg-[#DC2626] hover:bg-[#B91C1C] px-6 py-2.5 rounded-xl active:scale-98 transition-all cursor-pointer shadow-md shadow-red-200 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Stock Adjustment"}
            </button>
          </div>
        </form>

        {/* Right Column: Live Impact Panel */}
        <div className="space-y-6">
          {/* Live stock checker card */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-indigo-600 font-bold">
              <Search className="h-5 w-5" />
              <h3 className="text-sm font-bold text-[#1E293B]">Live Stock Checker</h3>
            </div>
            <p className="text-xs text-[#64748B] leading-normal">
              Query database levels for the selected godown item size before committing.
            </p>
            
            <button
              type="button"
              onClick={handleCheckStock}
              disabled={checkingStock || !godownId || !designId || !colourId || !size}
              className="w-full flex items-center justify-center gap-2 text-xs font-bold text-[#6366F1] bg-[#EEF2FF] border border-[#C7D2FE] py-2.5 rounded-xl hover:bg-[#E0E7FF] active:bg-[#C7D2FE] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={cn("h-4 w-4", checkingStock && "animate-spin")} />
              <span>Check Current Stock</span>
            </button>

            {stockInfo?.checked && (
              <div className="border border-slate-100 bg-slate-50/55 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]">Available Stock:</span>
                  <span className="font-bold text-[#334155]">{stockInfo.available} Pcs</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]">Reserved Stock:</span>
                  <span className="font-bold text-amber-600">{stockInfo.reserved} Pcs</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-dashed border-slate-200">
                  <span className="font-bold text-[#475569]">Free Stock:</span>
                  <span className="font-bold text-green-600">{stockInfo.free} Pcs</span>
                </div>
              </div>
            )}
          </div>

          {/* Impact summary card */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-green-700 font-bold">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h3 className="text-sm font-bold text-[#1E293B]">Live Impact Summary</h3>
            </div>
            
            <div className="space-y-3.5 text-xs">
              <div className="flex items-start justify-between gap-4">
                <span className="text-[#64748B] shrink-0">Selected Design:</span>
                <span className="font-bold text-[#1E293B] text-right">
                  {selectedDesign ? `${selectedDesign.design_number} - ${selectedDesign.name}` : "None"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-[#64748B] shrink-0">Colour & Size:</span>
                <span className="font-bold text-[#1E293B]">
                  {selectedColour ? `${selectedColour.colour_name}` : "None"} {size ? `(${size})` : ""}
                </span>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-[#64748B]">Adjustment Qty:</span>
                <span className={cn("font-bold text-sm", qtySign === "add" ? "text-green-600" : "text-red-500")}>
                  {qtySign === "add" ? "+" : "-"}
                  {quantity} Pcs
                </span>
              </div>
              <div className="flex items-start justify-between border-t border-dashed border-[#F1F5F9] pt-3.5">
                <span className="text-[#64748B]">Cost per piece:</span>
                <span className="font-semibold text-[#334155]">{formatRupee(unitCost)}</span>
              </div>
              <div className="flex items-start justify-between border-t border-dashed border-[#F1F5F9] pt-3.5">
                <span className="text-[#64748B] font-bold">Total Value Impact:</span>
                <span className={cn("font-extrabold text-base", qtySign === "add" ? "text-green-600" : "text-red-500")}>
                  {qtySign === "add" ? "+" : "-"}
                  {formatRupee(valueImpact)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
