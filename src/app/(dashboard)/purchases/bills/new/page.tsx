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
  Building2,
  Calendar,
  DollarSign,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import CreateDesignModal from "@/app/(dashboard)/production/lots/new/_components/CreateDesignModal";

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(val || 0);
};

interface Party {
  id: string;
  name: string;
  company_name: string | null;
  code: string;
}

interface Godown {
  id: string;
  name: string;
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

interface PurchaseLineItem {
  key: string;
  design_id: string;
  colour_id: string;
  size_quantities: Record<string, number>;
  total_qty: number;
  unit_rate: number;
  line_amount: number;
}

export default function NewPurchaseBillPage() {
  const router = useRouter();

  // Masters
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [sizeSets, setSizeSets] = useState<SizeSet[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Modal State for On-the-fly Design Creation
  const [createDesignModalOpen, setCreateDesignModalOpen] = useState(false);
  const [targetItemKeyForNewDesign, setTargetItemKeyForNewDesign] = useState<string | null>(null);

  // Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedGodownId, setSelectedGodownId] = useState("");
  const [initialPaidAmount, setInitialPaidAmount] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Line items
  const [items, setItems] = useState<PurchaseLineItem[]>([]);

  // 1. Load Masters
  useEffect(() => {
    async function loadMasters() {
      setLoadingInitial(true);
      try {
        const [sRes, gRes, dRes, bRes, ssRes] = await Promise.all([
          fetch("/api/parties?type=supplier"),
          fetch("/api/master-data/godowns"),
          fetch("/api/master-data/designs"),
          fetch("/api/master-data/brands"),
          fetch("/api/master-data/size-sets"),
        ]);

        if (sRes.ok) {
          const sData = await sRes.json();
          setSuppliers(sData.parties || []);
        }
        if (gRes.ok) {
          const gData = await gRes.json();
          setGodowns(gData.godowns || []);
          if (gData.godowns?.length > 0) {
            setSelectedGodownId(gData.godowns[0].id);
          }
        }
        if (dRes.ok) {
          const dData = await dRes.json();
          setDesigns(dData.designs || []);
        }
        if (bRes.ok) {
          const bData = await bRes.json();
          setBrands(bData.brands || []);
        }
        if (ssRes.ok) {
          const ssData = await ssRes.json();
          setSizeSets(ssData.sizeSets || []);
        }
      } catch (err) {
        toast.error("Failed to load initial master data");
      } finally {
        setLoadingInitial(false);
      }
    }
    loadMasters();
  }, []);

  // Add line item
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

  // Design Change
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

  // Colour Change
  const handleColourChange = (key: string, colourId: string) => {
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, colour_id: colourId } : it))
    );
  };

  // Size Quantity Change
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

  // Unit Rate Change
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

  const [gstRate, setGstRate] = useState<number>(5);

  // Totals
  const totalPurchaseQty = items.reduce((sum, it) => sum + it.total_qty, 0);
  const taxableAmount = items.reduce((sum, it) => sum + it.line_amount, 0);
  const taxAmount = (taxableAmount * gstRate) / 100;
  const totalGrandAmount = taxableAmount + taxAmount;
  const paidVal = Number(initialPaidAmount || 0);
  const netPayable = Math.max(0, totalGrandAmount - paidVal);

  // Submit Purchase Bill
  const handleSubmitBill = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSupplierId) {
      toast.error("Please select a supplier");
      return;
    }
    if (items.length === 0) {
      toast.error("Please add at least one design line item");
      return;
    }
    if (totalPurchaseQty <= 0) {
      toast.error("Please enter purchase quantities to record the bill");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        supplier_id: selectedSupplierId,
        invoice_no: supplierInvoiceNo || null,
        invoice_date: invoiceDate,
        godown_id: selectedGodownId || null,
        grand_total: totalGrandAmount,
        paid_amount: paidVal,
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

      const res = await fetch("/api/purchases/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to record purchase bill");
      }

      toast.success("Finished Goods Purchase Bill recorded successfully!");
      router.push("/purchases/bills");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 text-[#6366F1] animate-spin" />
        <span className="text-xs font-semibold text-slate-500">Loading Purchase Bill masters...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmitBill} className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E7EB] pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/purchases/bills")}
            className="p-2 border border-[#E5E7EB] hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Record Purchase Bill</h1>
            <p className="text-xs text-[#64748B] font-medium">
              Record inward finished goods, supplier invoices, godown stock allocation, and payables
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/purchases/bills")}
            className="text-xs font-semibold cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="bg-[#6366F1] hover:bg-[#4F46E5] text-white flex items-center gap-2 text-xs font-semibold cursor-pointer shadow-sm"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            <span>Save Purchase Bill</span>
          </Button>
        </div>
      </div>

      {/* Main Form Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Form Header & Line Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Header */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B] border-b border-[#F1F5F9] pb-2 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#6366F1]" />
              <span>Supplier & Invoice Details</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Supplier */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[#374151]">Supplier *</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full h-10 border border-[#E5E7EB] rounded-lg px-3 text-sm bg-white focus:ring-2 focus:ring-[#6366F1] outline-none cursor-pointer"
                  required
                >
                  <option value="">Choose Supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.company_name ? `(${s.company_name})` : ""} — [{s.code}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Supplier Invoice No */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#374151]">Supplier Invoice No.</label>
                <input
                  type="text"
                  placeholder="e.g. INV-1092"
                  value={supplierInvoiceNo}
                  onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                  className="w-full h-10 border border-[#E5E7EB] rounded-lg px-3 text-sm bg-white focus:ring-2 focus:ring-[#6366F1] outline-none font-mono"
                />
              </div>

              {/* Invoice Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#374151]">Invoice Date *</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full h-10 border border-[#E5E7EB] rounded-lg px-3 text-sm bg-white focus:ring-2 focus:ring-[#6366F1] outline-none"
                  required
                />
              </div>

              {/* Receiving Godown */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#374151]">Receiving Stock Godown *</label>
                <select
                  value={selectedGodownId}
                  onChange={(e) => setSelectedGodownId(e.target.value)}
                  className="w-full h-10 border border-[#E5E7EB] rounded-lg px-3 text-sm bg-white focus:ring-2 focus:ring-[#6366F1] outline-none cursor-pointer"
                  required
                >
                  <option value="">Select Receiving Godown...</option>
                  {godowns.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Initial Paid Amount */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#374151]">Initial Paid Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={initialPaidAmount}
                  onChange={(e) => setInitialPaidAmount(e.target.value === "" ? "" : parseFloat(e.target.value))}
                  className="w-full h-10 border border-[#E5E7EB] rounded-lg px-3 text-sm bg-white focus:ring-2 focus:ring-[#6366F1] outline-none font-semibold text-slate-800"
                />
              </div>

              {/* Remarks */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[#374151]">Remarks / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Shipment terms, transport details, fabric batch notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full h-10 border border-[#E5E7EB] rounded-lg px-3 text-sm bg-white focus:ring-2 focus:ring-[#6366F1] outline-none"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Line Items */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-[#6366F1]" />
                <h2 className="text-sm font-bold text-[#0F172A]">Purchased Garment Line Items</h2>
              </div>
              <Button
                type="button"
                onClick={handleAddItem}
                className="bg-[#EEF2FF] hover:bg-[#E0E7FF] text-[#6366F1] flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              >
                <Plus size={15} />
                <span>Add Design Line Item</span>
              </Button>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-slate-400 gap-2 border-2 border-dashed border-[#E2E8F0] rounded-xl bg-slate-50/50">
                <Package className="h-8 w-8 text-slate-300" />
                <span className="text-xs font-semibold">No line items added yet. Click &quot;+ Add Design Line Item&quot; above.</span>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((it, idx) => {
                  const currentDesign = designs.find((d) => d.id === it.design_id);
                  const availableColours = currentDesign?.design_colours || [];
                  const sizes = currentDesign?.size_set?.sizes || ["S", "M", "L", "XL"];

                  return (
                    <div
                      key={it.key}
                      className="p-4 border border-[#E2E8F0] rounded-xl bg-slate-50/40 space-y-3.5 relative hover:border-[#CBD5E1] transition-all"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-[#E2E8F0] pb-2">
                        <span className="text-xs font-bold text-[#6366F1] font-mono uppercase tracking-wider">
                          Item #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.key)}
                          className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded cursor-pointer transition-colors"
                          title="Remove item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Design & Color */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Design *</label>
                            <button
                              type="button"
                              onClick={() => {
                                setTargetItemKeyForNewDesign(it.key);
                                setCreateDesignModalOpen(true);
                              }}
                              className="text-[10px] font-bold text-[#6366F1] hover:underline cursor-pointer flex items-center gap-0.5"
                            >
                              <Plus size={10} />
                              <span>Create Design</span>
                            </button>
                          </div>
                          <select
                            value={it.design_id}
                            onChange={(e) => handleDesignChange(it.key, e.target.value)}
                            className="w-full h-9 border border-[#D1D5DB] rounded-lg px-2.5 text-xs bg-white focus:ring-1 focus:ring-[#6366F1] outline-none cursor-pointer"
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
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Colour *</label>
                          <select
                            value={it.colour_id}
                            onChange={(e) => handleColourChange(it.key, e.target.value)}
                            className="w-full h-9 border border-[#D1D5DB] rounded-lg px-2.5 text-xs bg-white focus:ring-1 focus:ring-[#6366F1] outline-none cursor-pointer"
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

                      {/* Size Matrix */}
                      <div className="space-y-1.5 pt-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">
                          Size Breakdown Quantities (Pcs)
                        </label>
                        <div className="flex flex-wrap gap-2.5">
                          {sizes.map((sz) => (
                            <div key={sz} className="flex flex-col gap-1 w-16">
                              <span className="text-[10px] font-bold text-slate-600 text-center uppercase bg-white border border-[#E2E8F0] py-0.5 rounded">
                                {sz}
                              </span>
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={it.size_quantities[sz] || ""}
                                onChange={(e) => handleSizeQtyChange(it.key, sz, e.target.value)}
                                className="w-full h-8 text-center border border-[#D1D5DB] rounded text-xs bg-white focus:ring-1 focus:ring-[#6366F1] outline-none font-semibold"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Rate & Line Amount */}
                      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[#E2E8F0]">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-500">Purchase Rate (₹):</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={it.unit_rate || ""}
                              onChange={(e) => handleUnitRateChange(it.key, e.target.value)}
                              className="w-24 h-8 px-2 border border-[#D1D5DB] rounded text-xs bg-white focus:ring-1 focus:ring-[#6366F1] outline-none font-bold text-slate-800"
                            />
                          </div>

                          <div className="text-xs font-semibold text-slate-600">
                            Total Pcs: <span className="font-bold text-[#6366F1] font-mono">{it.total_qty}</span>
                          </div>
                        </div>

                        <div className="text-xs font-bold text-slate-800">
                          Line Total: <span className="text-[#16A34A] font-mono">{formatCurrency(it.line_amount)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Summary Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4 sticky top-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B] border-b border-[#F1F5F9] pb-2 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-[#16A34A]" />
              <span>Purchase Summary</span>
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center text-slate-600">
                <span className="text-xs font-semibold">Total Purchased Line Items:</span>
                <span className="font-bold text-slate-800">{items.length}</span>
              </div>

              <div className="flex justify-between items-center text-slate-600">
                <span className="text-xs font-semibold">Taxable Subtotal:</span>
                <span className="font-bold text-slate-800 font-mono">{formatCurrency(taxableAmount)}</span>
              </div>

              <div className="flex justify-between items-center text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold">GST Tax Rate:</span>
                  <select
                    value={gstRate}
                    onChange={(e) => setGstRate(Number(e.target.value))}
                    className="h-7 text-xs border border-slate-300 rounded px-1.5 bg-white font-bold text-slate-700 outline-none cursor-pointer"
                  >
                    <option value={0}>0% GST</option>
                    <option value={5}>5% GST (Apparel)</option>
                    <option value={12}>12% GST</option>
                    <option value={18}>18% GST</option>
                    <option value={28}>28% GST</option>
                  </select>
                </div>
                <span className="font-bold text-slate-700 font-mono">+{formatCurrency(taxAmount)}</span>
              </div>

              <div className="flex justify-between items-center text-slate-600">
                <span className="text-xs font-semibold">Initial Payment Out:</span>
                <span className="font-bold text-slate-800 font-mono">{formatCurrency(paidVal)}</span>
              </div>

              <div className="border-t border-[#F1F5F9] pt-3 flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Bill Grand Total</span>
                <span className="text-xl font-bold text-[#16A34A] font-mono">{formatCurrency(totalGrandAmount)}</span>
              </div>

              <div className="flex justify-between items-center text-slate-600 pt-1 border-t border-[#F1F5F9]">
                <span className="text-xs font-semibold text-red-600">Net Supplier Outstanding:</span>
                <span className="font-bold text-red-600 font-mono">{formatCurrency(netPayable)}</span>
              </div>
            </div>

            <Button
              type="submit"
              disabled={saving}
              className="w-full h-11 bg-[#6366F1] hover:bg-[#4F46E5] text-white flex items-center justify-center gap-2 font-bold cursor-pointer shadow-sm rounded-lg"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              <span>Save Purchase Bill</span>
            </Button>
          </div>
        </div>
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
