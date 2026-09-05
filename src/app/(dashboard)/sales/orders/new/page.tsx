"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  Loader2,
  ShoppingBag,
  DollarSign,
  Package,
} from "lucide-react";
import { toast } from "sonner";

import CreateDesignModal from "@/app/(dashboard)/production/lots/new/_components/CreateDesignModal";
import { SizeQuantityMatrix } from "@/components/shared/SizeQuantityMatrix";
import { formatCurrency } from "@/lib/utils";

interface Party {
  id: string;
  name: string;
  company_name: string | null;
  code: string;
}

interface DesignColour {
  id: string;
  colour_name: string;
}

interface SizeSet {
  id: string;
  name: string;
  sizes: string[];
}

interface Design {
  id: string;
  name: string;
  design_number: string;
  code?: string;
  design_colours: DesignColour[];
  size_set?: SizeSet;
}

interface OrderLineItem {
  key: string;
  design_id: string;
  colour_id: string;
  size_quantities: Record<string, number>;
  total_qty: number;
  unit_rate: number;
  line_amount: number;
}

export default function NewSalesOrderPage() {
  const router = useRouter();

  // Masters
  const [customers, setCustomers] = useState<Party[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [sizeSets, setSizeSets] = useState<SizeSet[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Modal State for On-the-fly Design Creation
  const [createDesignModalOpen, setCreateDesignModalOpen] = useState(false);
  const [targetItemKeyForNewDesign, setTargetItemKeyForNewDesign] = useState<string | null>(null);

  // Form State
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Line items
  const [items, setItems] = useState<OrderLineItem[]>([]);

  // 1. Fetch Masters
  useEffect(() => {
    async function loadMasters() {
      setLoadingInitial(true);
      try {
        const [cRes, dRes, bRes, sRes] = await Promise.all([
          fetch("/api/parties?type=customer"),
          fetch("/api/master-data/designs"),
          fetch("/api/master-data/brands"),
          fetch("/api/master-data/size-sets"),
        ]);

        if (cRes.ok) {
          const cData = await cRes.json();
          setCustomers(cData.parties || []);
        }
        if (dRes.ok) {
          const dData = await dRes.json();
          setDesigns(dData.designs || []);
        }
        if (bRes.ok) {
          const bData = await bRes.json();
          setBrands(bData.brands || []);
        }
        if (sRes.ok) {
          const sData = await sRes.json();
          setSizeSets(sData.sizeSets || []);
        }
      } catch (err) {
        toast.error("Failed to load initial master data");
      } finally {
        setLoadingInitial(false);
      }
    }
    loadMasters();
  }, []);

  // Add a new empty line item
  const handleAddItem = () => {
    const defaultDesign = designs.length > 0 ? designs[0] : null;
    const defaultColour = defaultDesign?.design_colours?.[0]?.id || "";
    const sizes = defaultDesign?.size_set?.sizes || ["S", "M", "L", "XL"];

    const initialSizes: Record<string, number> = {};
    sizes.forEach((sz) => (initialSizes[sz] = 0));

    setItems((prev) => [
      ...prev,
      {
        key: `item-${Date.now()}-${Math.random()}`,
        design_id: defaultDesign?.id || "",
        colour_id: defaultColour,
        size_quantities: initialSizes,
        total_qty: 0,
        unit_rate: 0,
        line_amount: 0,
      },
    ]);
  };

  // Remove line item
  const handleRemoveItem = (key: string) => {
    setItems((prev) => prev.filter((it) => it.key !== key));
  };

  // Handle Design Change for a Row
  const handleDesignChange = (key: string, designId: string) => {
    const targetDesign = designs.find((d) => d.id === designId);
    const defaultColour = targetDesign?.design_colours?.[0]?.id || "";
    const sizes = targetDesign?.size_set?.sizes || ["S", "M", "L", "XL"];

    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it;

        const newSizes: Record<string, number> = {};
        sizes.forEach((sz) => (newSizes[sz] = 0));

        return {
          ...it,
          design_id: designId,
          colour_id: defaultColour,
          size_quantities: newSizes,
          total_qty: 0,
          line_amount: 0,
        };
      })
    );
  };

  // Handle Colour Change
  const handleColourChange = (key: string, colourId: string) => {
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, colour_id: colourId } : it))
    );
  };

  // Handle Size Quantity Change
  const handleSizeQtyChange = (key: string, size: string, qtyVal: string) => {
    const qty = Math.max(0, parseInt(qtyVal, 10) || 0);

    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it;

        const updatedSizes = { ...it.size_quantities, [size]: qty };
        const newTotalQty = Object.values(updatedSizes).reduce((sum, v) => sum + v, 0);
        const newAmount = newTotalQty * Number(it.unit_rate || 0);

        return {
          ...it,
          size_quantities: updatedSizes,
          total_qty: newTotalQty,
          line_amount: newAmount,
        };
      })
    );
  };

  // Handle Unit Rate Change
  const handleUnitRateChange = (key: string, rateVal: string) => {
    const rate = Math.max(0, parseFloat(rateVal) || 0);

    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it;
        const newAmount = it.total_qty * rate;
        return {
          ...it,
          unit_rate: rate,
          line_amount: newAmount,
        };
      })
    );
  };

  // Overall Totals
  const totalOrderQty = items.reduce((sum, it) => sum + it.total_qty, 0);
  const totalOrderValue = items.reduce((sum, it) => sum + it.line_amount, 0);

  // Submit Order Booking
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPartyId) {
      toast.error("Please select a customer");
      return;
    }
    if (items.length === 0) {
      toast.error("Please add at least one design line item");
      return;
    }
    if (totalOrderQty <= 0) {
      toast.error("Please enter item quantities to book the order");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        party_id: selectedPartyId,
        order_date: orderDate,
        expected_delivery: expectedDelivery || null,
        total_amount: totalOrderValue,
        notes: notes || null,
        items: items.map((it) => ({
          design_id: it.design_id,
          colour_id: it.colour_id,
          size_quantities: it.size_quantities,
          total_qty: it.total_qty,
          unit_rate: it.unit_rate,
          line_amount: it.line_amount,
        })),
      };

      const res = await fetch("/api/sales/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create sales order booking");
      }

      toast.success("Sales Order Booking recorded successfully!");
      router.push("/sales/orders");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 text-[var(--primary)] animate-spin" />
        <span className="text-xs font-semibold text-[var(--text-muted)]">Loading Order Booking masters...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmitOrder} className="space-y-4 sm:space-y-6 pb-24 md:pb-12 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 border-b border-[var(--border)] pb-3 sm:pb-4">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => router.push("/sales/orders")}
            className="p-2 border border-[var(--border)] hover:bg-[var(--table-row-hover)] rounded-xl text-[var(--text-body)] cursor-pointer transition-all active:scale-95"
            title="Back to Orders"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              Record Sales Order Booking
            </h1>
            <p className="text-xs text-[var(--text-muted)] font-medium">
              Create an itemized customer booking with design, color, size set quantities, and locked rates
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/sales/orders")}
            className="h-9 px-3.5 border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] text-[var(--text-body)] text-xs font-semibold rounded-lg cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-9 px-4 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white flex items-center gap-2 text-xs font-semibold rounded-lg cursor-pointer shadow-sm active:scale-95 transition-all"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            <span>Save Order Booking</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left 2 Cols: Form & Line Items */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Card 1: Order Header */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 sm:p-5 shadow-[var(--shadow-sm)] space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-light)] pb-2 flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-[var(--primary)]" />
              <span>Customer & Booking Header</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
              {/* Customer */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[var(--text-primary)]">Customer *</label>
                <select
                  value={selectedPartyId}
                  onChange={(e) => setSelectedPartyId(e.target.value)}
                  className="w-full h-10 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors cursor-pointer"
                  required
                >
                  <option value="">Choose Customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.company_name ? `(${c.company_name})` : ""} — [{c.code}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Order Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-primary)]">Order Date *</label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full h-10 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                  required
                />
              </div>

              {/* Expected Delivery */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-primary)]">Expected Delivery Date</label>
                <input
                  type="date"
                  value={expectedDelivery}
                  onChange={(e) => setExpectedDelivery(e.target.value)}
                  className="w-full h-10 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[var(--text-primary)]">Special Instructions / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Packing specifications, dispatch terms, tag instructions..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full h-10 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Multi-Item Booking Grid */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 sm:p-5 shadow-[var(--shadow-sm)] space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-light)] pb-3">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-[var(--primary)]" />
                <h2 className="text-sm font-bold text-[var(--text-primary)]">Order Line Items ({items.length})</h2>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="h-8 px-3 rounded-lg bg-[var(--primary-light)] hover:bg-[var(--primary-light)]/80 text-[var(--primary)] border border-[var(--primary)]/20 flex items-center gap-1.5 text-xs font-bold cursor-pointer active:scale-95 transition-all"
              >
                <Plus size={14} />
                <span>Add Line</span>
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-[var(--text-muted)] gap-2 border-2 border-dashed border-[var(--border)] rounded-xl bg-[var(--page-bg)]">
                <Package className="h-8 w-8 text-[var(--text-faint)]" />
                <span className="text-xs font-semibold">No line items added yet. Tap &quot;+ Add Line&quot; above.</span>
              </div>
            ) : (
              <div className="space-y-3.5 sm:space-y-4">
                {items.map((it, idx) => {
                  const currentDesign = designs.find((d) => d.id === it.design_id);
                  const availableColours = currentDesign?.design_colours || [];
                  const sizes = currentDesign?.size_set?.sizes || ["S", "M", "L", "XL"];

                  return (
                    <div
                      key={it.key}
                      className="p-3 sm:p-4 border border-[var(--border)] rounded-xl bg-[var(--page-bg)] space-y-3 relative hover:border-[var(--primary)]/30 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-light)] pb-2">
                        <span className="text-xs font-bold text-[var(--primary)] font-mono uppercase tracking-wider">
                          Item #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.key)}
                          className="text-red-500 hover:text-red-700 p-1 hover:bg-red-500/10 rounded cursor-pointer transition-colors"
                          title="Remove item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Design & Color Selection */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Design *</label>
                            <button
                              type="button"
                              onClick={() => {
                                setTargetItemKeyForNewDesign(it.key);
                                setCreateDesignModalOpen(true);
                              }}
                              className="text-[10px] font-bold text-[var(--primary)] hover:underline cursor-pointer flex items-center gap-0.5"
                            >
                              <Plus size={10} />
                              <span>Create Design</span>
                            </button>
                          </div>
                          <select
                            value={it.design_id}
                            onChange={(e) => handleDesignChange(it.key, e.target.value)}
                            className="w-full h-10 border border-[var(--input-border)] rounded-xl px-3 text-xs bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors cursor-pointer"
                          >
                            <option value="">Select Design</option>
                            {designs.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name} ({d.design_number})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Colour *</label>
                          <select
                            value={it.colour_id}
                            onChange={(e) => handleColourChange(it.key, e.target.value)}
                            className="w-full h-10 border border-[var(--input-border)] rounded-xl px-3 text-xs bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors cursor-pointer"
                          >
                            <option value="">Select Colour</option>
                            {availableColours.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.colour_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Size Matrix with Autofill */}
                      <div className="pt-1 overflow-x-auto">
                        <SizeQuantityMatrix
                          sizes={sizes}
                          sizeQuantities={it.size_quantities}
                          sizeSetName={currentDesign?.size_set?.name}
                          showAllColorsOption={true}
                          autoFillAllColors={(it as any).apply_all_colors || false}
                          onAutoFillAllColorsChange={(checked) => {
                            if (checked && availableColours.length > 0) {
                              // Duplicate this line item for all available colours of this design
                              const newLines: any[] = [];
                              availableColours.forEach((col: any) => {
                                if (col.id !== it.colour_id) {
                                  newLines.push({
                                    key: `item-${Date.now()}-${Math.random()}`,
                                    design_id: it.design_id,
                                    colour_id: col.id,
                                    size_quantities: { ...it.size_quantities },
                                    total_qty: it.total_qty,
                                    unit_rate: it.unit_rate,
                                    line_amount: it.line_amount,
                                    apply_all_colors: true,
                                  });
                                }
                              });
                              setItems((prev) =>
                                prev.map((item) => (item.key === it.key ? { ...item, apply_all_colors: true } : item)).concat(newLines)
                              );
                              toast.success(`Applied order item to all ${availableColours.length} colours`);
                            }
                          }}
                          onChange={(updatedSizes) => {
                            const newTotalQty = Object.values(updatedSizes).reduce((sum, v) => sum + (Number(v) || 0), 0);
                            const newAmount = newTotalQty * Number(it.unit_rate || 0);

                            setItems((prev) =>
                              prev.map((item) =>
                                item.key === it.key
                                  ? {
                                      ...item,
                                      size_quantities: updatedSizes,
                                      total_qty: newTotalQty,
                                      line_amount: newAmount,
                                    }
                                  : item
                              )
                            );
                          }}
                        />
                      </div>

                      {/* Line Summary (Rate & Amount) */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border-light)]">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-[var(--text-muted)]">Unit Rate (₹):</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={it.unit_rate || ""}
                              onChange={(e) => handleUnitRateChange(it.key, e.target.value)}
                              className="w-24 h-8 px-2 border border-[var(--input-border)] rounded-lg text-xs bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] font-bold transition-colors"
                            />
                          </div>

                          <div className="text-xs font-semibold text-[var(--text-secondary)]">
                            Total: <span className="font-bold text-[var(--primary)] font-mono">{it.total_qty} pcs</span>
                          </div>
                        </div>

                        <div className="text-xs font-bold text-[var(--text-primary)]">
                          Line Total: <span className="text-emerald-600 font-mono">{formatCurrency(it.line_amount)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Desktop Summary Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] space-y-4 sticky top-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-light)] pb-2 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <span>Booking Summary</span>
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center text-[var(--text-muted)]">
                <span className="text-xs font-semibold">Total Line Items:</span>
                <span className="font-bold text-[var(--text-primary)]">{items.length}</span>
              </div>

              <div className="flex justify-between items-center text-[var(--text-muted)]">
                <span className="text-xs font-semibold">Total Order Quantity:</span>
                <span className="font-bold text-[var(--primary)] font-mono">{totalOrderQty} pcs</span>
              </div>

              <div className="border-t border-[var(--border-light)] pt-3 flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Est. Total Booking Value</span>
                <span className="text-xl font-bold text-emerald-600 font-mono">{formatCurrency(totalOrderValue)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full h-11 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white flex items-center justify-center gap-2 font-bold cursor-pointer shadow-sm rounded-xl active:scale-95 transition-all"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              <span>Save Order Booking</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── MOBILE: Floating Sticky Bottom Bar ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--card-bg)] border-t border-[var(--border)] p-3 shadow-[var(--shadow-md)] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <span>{items.length} lines</span>
            <span>•</span>
            <span className="font-bold text-[var(--primary)] font-mono">{totalOrderQty} pcs</span>
          </div>
          <div className="text-base font-black text-emerald-600 font-mono truncate">
            {formatCurrency(totalOrderValue)}
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="h-10 px-5 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer shrink-0"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          <span>Save Booking</span>
        </button>
      </div>

      {/* On-the-fly Create Design Modal */}
      <CreateDesignModal
        open={createDesignModalOpen}
        onOpenChange={setCreateDesignModalOpen}
        brandId={brands[0]?.id || ""}
        sizeSets={sizeSets}
        onDesignCreated={async (newDesignId) => {
          try {
            const dRes = await fetch("/api/master-data/designs");
            if (dRes.ok) {
              const dData = await dRes.json();
              const updatedDesigns = dData.designs || [];
              setDesigns(updatedDesigns);

              if (targetItemKeyForNewDesign) {
                handleDesignChange(targetItemKeyForNewDesign, newDesignId);
              }
            }
          } catch (e) {}
        }}
      />
    </form>
  );
}
