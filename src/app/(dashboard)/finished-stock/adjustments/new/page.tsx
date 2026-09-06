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

    // Fetch design details for colours and unit cost fallback
    fetch(`/api/finished-stock/designs/${designId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.colours) {
          setColours(data.colours);
        }
        if (Number(data.overallAvgCost || 0) > 0) {
          setUnitCost((prev) => (prev > 0 ? prev : Math.round(Number(data.overallAvgCost))));
        }
      })
      .catch((err) => console.error("Error loading design details:", err));
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
    <div className="p-3.5 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
        <Link href="/finished-stock" className="hover:text-[var(--primary)] transition-colors">
          Finished Stock
        </Link>
        <span>/</span>
        <Link href="/finished-stock/adjustments" className="hover:text-[var(--primary)] transition-colors">
          Adjustments
        </Link>
        <span>/</span>
        <span className="text-[var(--text-primary)] font-bold">New</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <Link
            href="/finished-stock/adjustments"
            className="p-2 bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] border border-[var(--border)] rounded-xl transition-all cursor-pointer shrink-0"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-[var(--text-secondary)]" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight truncate">Record Stock Adjustment</h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] truncate">Record damage, scrap, samples or correct finished garment stock</p>
          </div>
        </div>

        {/* Exclusion Banner Badge */}
        <div className="flex items-center gap-2 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 rounded-xl px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs text-amber-800 dark:text-amber-300 font-semibold self-start sm:self-auto">
          <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>Finished Stock Only</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column: Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-4 sm:space-y-5 bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 sm:p-6 shadow-[var(--shadow-sm)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {/* Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-[var(--text-muted)]" />
                <span>Adjustment Date *</span>
              </label>
              <input
                type="date"
                required
                value={adjustmentDate}
                onChange={(e) => setAdjustmentDate(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none"
              />
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-[var(--text-muted)]" />
                <span>Adjustment Type *</span>
              </label>
              <select
                required
                value={adjustmentType}
                onChange={(e) => {
                  setAdjustmentType(e.target.value as any);
                  if (e.target.value === "damage") setReason("Fabric Damage");
                  else if (e.target.value === "sample") setReason("Sample Out");
                  else if (e.target.value === "scrap") setReason("Stitch Defect");
                  else if (e.target.value === "correction") setReason("Stock Correction");
                }}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none"
              >
                <option value="damage">Damage (Defective fabric/stitch)</option>
                <option value="sample">Sample (Marketing or client trials)</option>
                <option value="scrap">Scrap (Discarded/unsellable pieces)</option>
                <option value="correction">Correction (Manual audit adjustment)</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {/* Godown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-[var(--text-muted)]" />
                <span>Warehouse / Godown *</span>
              </label>
              <select
                required
                value={godownId}
                onChange={(e) => setGodownId(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none"
              >
                <option value="">Select Storage Godown...</option>
                {godowns.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* Design */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="h-4 w-4 text-[var(--text-muted)]" />
                <span>Select Design *</span>
              </label>
              <select
                required
                value={designId}
                onChange={(e) => setDesignId(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none"
              >
                <option value="">Select Catalog Design...</option>
                {designs.map((d) => (
                  <option key={d.id} value={d.id}>{d.design_number} - {d.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {/* Colour */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="h-4 w-4 text-[var(--text-muted)]" />
                <span>Design Colour *</span>
              </label>
              <select
                required
                value={colourId}
                onChange={(e) => setColourId(e.target.value)}
                disabled={!designId}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none disabled:opacity-50"
              >
                <option value="">Select Colour...</option>
                {colours.map((c) => (
                  <option key={c.id} value={c.id}>{c.colour_name}</option>
                ))}
              </select>
            </div>

            {/* Size */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-[var(--text-muted)]" />
                <span>Garment Size *</span>
              </label>
              <select
                required
                value={size}
                onChange={(e) => setSize(e.target.value)}
                disabled={!designId}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none disabled:opacity-50"
              >
                <option value="">Select Size...</option>
                {sizesList.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {/* Quantity */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                Quantity Adjust *
              </label>
              <div className="flex border border-[var(--input-border)] rounded-xl overflow-hidden shadow-xs bg-[var(--input-bg)]">
                <button
                  type="button"
                  onClick={() => setQtySign("reduce")}
                  className={cn(
                    "px-4 text-xs font-bold transition-all cursor-pointer border-r border-[var(--input-border)]",
                    qtySign === "reduce" ? "bg-rose-600 text-white" : "bg-[var(--page-bg)] hover:bg-[var(--table-row-hover)] text-[var(--text-secondary)]"
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
                  className="w-full text-center py-2.5 text-sm outline-none font-bold font-mono bg-transparent text-[var(--text-primary)]"
                />
                <button
                  type="button"
                  onClick={() => setQtySign("add")}
                  className={cn(
                    "px-4 text-xs font-bold transition-all cursor-pointer border-l border-[var(--input-border)]",
                    qtySign === "add" ? "bg-emerald-600 text-white" : "bg-[var(--page-bg)] hover:bg-[var(--table-row-hover)] text-[var(--text-secondary)]"
                  )}
                >
                  Add (+)
                </button>
              </div>
            </div>

            {/* Cost per piece */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-[var(--text-muted)]" />
                <span>Unit Cost per Piece *</span>
              </label>
              <input
                type="number"
                required
                min={0}
                value={unitCost}
                onChange={(e) => setUnitCost(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] font-mono font-bold rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {/* Reason */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                Reason *
              </label>
              <input
                type="text"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none"
                placeholder="Fabric Damage, Count Correction, etc."
              />
            </div>

            {/* Remarks */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                Remarks
              </label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none"
                placeholder="Additional audit notes..."
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-3 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 sm:gap-3 border-t border-[var(--border-light)]">
            <Link
              href="/finished-stock/adjustments"
              className="w-full sm:w-auto text-xs font-bold text-[var(--text-secondary)] bg-[var(--card-bg)] border border-[var(--border)] px-5 py-2.5 rounded-xl hover:bg-[var(--table-row-hover)] transition-all cursor-pointer text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 px-6 py-2.5 rounded-xl active:scale-98 transition-all cursor-pointer shadow-md disabled:opacity-50 text-center"
            >
              {submitting ? "Saving..." : "Save Stock Adjustment"}
            </button>
          </div>
        </form>

        {/* Right Column: Live Impact Panel */}
        <div className="space-y-4 sm:space-y-6">
          {/* Live stock checker card */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 sm:p-5 shadow-[var(--shadow-sm)] space-y-4">
            <div className="flex items-center gap-2 text-[var(--primary)] font-bold">
              <Search className="h-5 w-5" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Live Stock Checker</h3>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-normal">
              Query current stock level for selected design and size before committing.
            </p>
            
            <button
              type="button"
              onClick={handleCheckStock}
              disabled={checkingStock || !godownId || !designId || !colourId || !size}
              className="w-full flex items-center justify-center gap-2 text-xs font-bold text-[var(--primary)] bg-[var(--primary-light)] border border-[var(--primary)]/30 py-2.5 rounded-xl hover:bg-[var(--primary-light)]/80 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={cn("h-4 w-4", checkingStock && "animate-spin")} />
              <span>Check Current Stock</span>
            </button>

            {stockInfo?.checked && (
              <div className="border border-[var(--border-light)] bg-[var(--page-bg)]/70 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Available Stock:</span>
                  <span className="font-bold font-mono text-[var(--text-primary)]">{stockInfo.available} Pcs</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Reserved Stock:</span>
                  <span className="font-bold font-mono text-amber-600 dark:text-amber-400">{stockInfo.reserved} Pcs</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-dashed border-[var(--border)]">
                  <span className="font-bold text-[var(--text-secondary)]">Free Stock:</span>
                  <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">{stockInfo.free} Pcs</span>
                </div>
              </div>
            )}
          </div>

          {/* Impact summary card */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 sm:p-5 shadow-[var(--shadow-sm)] space-y-4">
            <div className="flex items-center gap-2 text-emerald-600 font-bold">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Live Impact Summary</h3>
            </div>
            
            <div className="space-y-3.5 text-xs">
              <div className="flex items-start justify-between gap-4">
                <span className="text-[var(--text-muted)] shrink-0">Selected Design:</span>
                <span className="font-bold text-[var(--text-primary)] text-right">
                  {selectedDesign ? `${selectedDesign.design_number} - ${selectedDesign.name}` : "None"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-[var(--text-muted)] shrink-0">Colour & Size:</span>
                <span className="font-bold text-[var(--text-primary)]">
                  {selectedColour ? `${selectedColour.colour_name}` : "None"} {size ? `(${size})` : ""}
                </span>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-[var(--text-muted)]">Adjustment Qty:</span>
                <span className={cn("font-bold font-mono text-sm", qtySign === "add" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                  {qtySign === "add" ? "+" : "-"}
                  {quantity} Pcs
                </span>
              </div>
              <div className="flex items-start justify-between border-t border-dashed border-[var(--border)] pt-3.5">
                <span className="text-[var(--text-muted)]">Cost per piece:</span>
                <span className="font-semibold font-mono text-[var(--text-secondary)]">{formatRupee(unitCost)}</span>
              </div>
              <div className="flex items-start justify-between border-t border-dashed border-[var(--border)] pt-3.5">
                <span className="text-[var(--text-muted)] font-bold">Total Value Impact:</span>
                <span className={cn("font-extrabold font-mono text-base", qtySign === "add" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
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
