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
  Info,
  CheckCircle2,
  ListPlus,
  Boxes,
} from "lucide-react";
import { toast } from "sonner";

interface Godown {
  id: string;
  name: string;
}

interface MaterialType {
  id: string;
  name: string;
  category: string;
  unit: string;
}

interface TransferItemRow {
  key: string;
  material_type_id: string;
  unit: string;
  available_stock: number;
  quantity: number;
  unit_cost: number;
  total_value: number;
}

export default function NewRawMaterialTransferPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Form Header State
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split("T")[0]);
  const [fromGodownId, setFromGodownId] = useState("");
  const [toGodownId, setToGodownId] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [reason, setReason] = useState("Stock Rebalancing");
  const [status, setStatus] = useState<"pending" | "in_transit" | "completed">("completed");
  const [remarks, setRemarks] = useState("");

  // Masters & Stock
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [materials, setMaterials] = useState<MaterialType[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({}); // key: `${godownId}_${materialId}`

  // Line items state
  const [items, setItems] = useState<TransferItemRow[]>([
    {
      key: `item-${Date.now()}-0`,
      material_type_id: "",
      unit: "meter",
      available_stock: 0,
      quantity: 1,
      unit_cost: 0,
      total_value: 0,
    },
  ]);

  // Load masters on mount
  useEffect(() => {
    // 1. Fetch godowns
    fetch("/api/master-data/godowns")
      .then((res) => res.json())
      .then((data) => {
        if (data.godowns) setGodowns(data.godowns);
      })
      .catch((err) => console.error(err));

    // 2. Fetch raw materials master
    fetch("/api/master-data/raw-materials")
      .then((res) => res.json())
      .then((data) => {
        if (data.materials) setMaterials(data.materials);
        else if (data.materialTypes) setMaterials(data.materialTypes);
      })
      .catch((err) => console.error(err));
  }, []);

  // Fetch stock summary when source godown changes
  useEffect(() => {
    if (!fromGodownId) {
      setStockMap({});
      return;
    }
    fetch(`/api/raw-materials/stock?view=summary&godown_id=${fromGodownId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.stock) {
          const map: Record<string, number> = {};
          data.stock.forEach((st: any) => {
            map[st.material_type_id] = Number(st.current_stock || 0);
          });
          setStockMap(map);

          // Update available stock for current items
          setItems((prev) =>
            prev.map((it) => ({
              ...it,
              available_stock: map[it.material_type_id] || 0,
            }))
          );
        }
      })
      .catch((err) => console.error(err));
  }, [fromGodownId]);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        key: `item-${Date.now()}-${Math.random()}`,
        material_type_id: "",
        unit: "meter",
        available_stock: 0,
        quantity: 1,
        unit_cost: 0,
        total_value: 0,
      },
    ]);
  };

  const handleRemoveItem = (key: string) => {
    if (items.length === 1) {
      toast.info("At least one item row is required");
      return;
    }
    setItems((prev) => prev.filter((it) => it.key !== key));
  };

  const handleMaterialChange = (key: string, materialId: string) => {
    const selectedMat = materials.find((m) => m.id === materialId);
    const avail = stockMap[materialId] || 0;

    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it;
        return {
          ...it,
          material_type_id: materialId,
          unit: selectedMat?.unit || "meter",
          available_stock: avail,
          total_value: it.quantity * it.unit_cost,
        };
      })
    );
  };

  const handleItemPropChange = (
    key: string,
    field: "quantity" | "unit_cost",
    value: string
  ) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it;
        const valNum = Math.max(0, parseFloat(value) || 0);
        const updated = { ...it, [field]: valNum };
        updated.total_value = updated.quantity * updated.unit_cost;
        return updated;
      })
    );
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

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.material_type_id || it.quantity <= 0) {
        toast.error(`Please select material and valid quantity for row #${i + 1}`);
        return;
      }
      if (it.quantity > it.available_stock) {
        toast.warning(
          `Row #${i + 1}: Requested quantity (${it.quantity}) exceeds available stock (${it.available_stock}) in source godown.`
        );
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/raw-materials/transfers", {
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
            material_type_id: it.material_type_id,
            unit: it.unit,
            quantity: it.quantity,
            unit_cost: it.unit_cost,
            total_value: it.total_value,
          })),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Raw Material Transfer registered successfully!");
        router.push("/stock/raw-materials");
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

  const totalQty = items.reduce((sum, it) => sum + (it.quantity || 0), 0);
  const totalValue = items.reduce((sum, it) => sum + (it.total_value || 0), 0);

  const formatRupee = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
        <Link href="/stock/raw-materials" className="hover:text-[var(--primary)] transition-colors">
          Raw Material Stock
        </Link>
        <span>/</span>
        <span className="text-[var(--text-primary)]">New Godown Transfer</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/stock/raw-materials"
          className="p-2 bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] border border-[var(--border)] rounded-xl transition-all cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5 text-[var(--text-secondary)]" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            New Raw Material & Accessories Transfer
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Move fabric rolls, yarn, thread, and accessories between godowns in a single step
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Form Header & Items Table */}
        <div className="lg:col-span-3 space-y-6">
          {/* Header Panel */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-[var(--shadow-sm)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border)] pb-2 flex items-center gap-2">
              <Building2 className="h-4.5 w-4.5 text-[var(--primary)]" />
              <span>Transfer Header Details</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Transfer Date *
                </label>
                <input
                  type="date"
                  required
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none"
                />
              </div>

              {/* Source Godown */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Source Godown *
                </label>
                <select
                  required
                  value={fromGodownId}
                  onChange={(e) => setFromGodownId(e.target.value)}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none"
                >
                  <option value="">Select Source Godown...</option>
                  {godowns.map((g) => (
                    <option key={g.id} value={g.id} disabled={g.id === toGodownId}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination Godown */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Destination Godown *
                </label>
                <select
                  required
                  value={toGodownId}
                  onChange={(e) => setToGodownId(e.target.value)}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none"
                >
                  <option value="">Select Destination Godown...</option>
                  {godowns.map((g) => (
                    <option key={g.id} value={g.id} disabled={g.id === fromGodownId}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Ref Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Reference No
                </label>
                <input
                  type="text"
                  placeholder="e.g. TRF-RM-102"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none"
                />
              </div>

              {/* Reason */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Reason for Transfer *
                </label>
                <select
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none"
                >
                  <option value="Stock Rebalancing">Stock Rebalancing</option>
                  <option value="Production Requirement">Production Requirement</option>
                  <option value="Godown Consolidation">Godown Consolidation</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none font-semibold"
                >
                  <option value="completed">Completed (Moved immediately)</option>
                  <option value="pending">Pending (Deducted from Source)</option>
                </select>
              </div>
            </div>

            {/* Remarks */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Remarks
              </label>
              <textarea
                rows={1.5}
                placeholder="Additional instructions..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none resize-none"
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-sm)] overflow-hidden">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <ListPlus className="h-4.5 w-4.5 text-[var(--primary)]" />
                <span>Materials & Accessories Grid</span>
              </h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1.5 text-xs font-bold text-[var(--primary)] bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 px-3.5 py-2 rounded-xl hover:bg-indigo-100 transition-all cursor-pointer shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Add Material Row</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs font-semibold text-[var(--text-body)]">
                <thead>
                  <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    <th className="py-3 px-4 w-8 text-center">#</th>
                    <th className="py-3 px-4 w-64">Material / Accessory Name</th>
                    <th className="py-3 px-3 w-28 text-center bg-slate-50/50 dark:bg-slate-900/30">Available</th>
                    <th className="py-3 px-3 w-28 text-center">Qty</th>
                    <th className="py-3 px-3 w-20 text-center">Unit</th>
                    <th className="py-3 px-3 w-28 text-right">Unit Rate (₹)</th>
                    <th className="py-3 px-4 w-32 text-right">Total Value</th>
                    <th className="py-3 px-4 w-12 text-center">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {items.map((it, idx) => (
                    <tr key={it.key} className="hover:bg-[var(--table-row-hover)]">
                      <td className="py-3.5 px-4 text-center text-[var(--text-muted)] font-bold">{idx + 1}</td>
                      <td className="py-3 px-2">
                        <select
                          required
                          value={it.material_type_id}
                          onChange={(e) => handleMaterialChange(it.key, e.target.value)}
                          className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-2 py-1.5 text-xs outline-none"
                        >
                          <option value="">Select Material / Accessory...</option>
                          {materials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.category})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-2 text-center bg-slate-50/30 dark:bg-slate-900/20 text-[var(--text-primary)] font-bold">
                        {it.available_stock.toLocaleString()} <span className="text-[10px] text-[var(--text-muted)] font-normal">{it.unit}</span>
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          required
                          min={0.01}
                          step="any"
                          value={it.quantity}
                          onChange={(e) => handleItemPropChange(it.key, "quantity", e.target.value)}
                          className="w-full text-center bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-2 py-1.5 text-xs outline-none font-bold text-[var(--text-primary)]"
                        />
                      </td>
                      <td className="py-3 px-2 text-center font-semibold text-[var(--text-muted)]">
                        {it.unit}
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          required
                          min={0}
                          step="any"
                          value={it.unit_cost}
                          onChange={(e) => handleItemPropChange(it.key, "unit_cost", e.target.value)}
                          className="w-full text-right bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-2 py-1.5 text-xs outline-none"
                        />
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-[var(--primary)] text-xs">
                        {formatRupee(it.total_value)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.key)}
                          className="text-[var(--text-muted)] hover:text-red-500 p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all cursor-pointer"
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

        {/* Right Column: Total Summary Sidebar Panel */}
        <div className="space-y-6">
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--shadow-sm)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border)] pb-2 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span>Transfer Summary</span>
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Items Count:</span>
                <span className="font-bold text-[var(--text-primary)]">{items.length} rows</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Total Qty:</span>
                <span className="font-bold text-sm text-[var(--text-primary)]">
                  {totalQty.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-dashed border-[var(--border)] pt-3.5">
                <span className="text-[var(--text-muted)] font-bold">Total Valuation:</span>
                <span className="font-extrabold text-base text-emerald-600 dark:text-emerald-400">
                  {formatRupee(totalValue)}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] py-3 rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-50"
            >
              {submitting ? "Saving Transfer..." : "Save Raw Material Transfer"}
            </button>
            <Link
              href="/stock/raw-materials"
              className="w-full flex items-center justify-center text-xs font-bold text-[var(--text-secondary)] bg-[var(--card-bg)] border border-[var(--border)] py-3 rounded-xl hover:bg-[var(--table-row-hover)] transition-all cursor-pointer text-center"
            >
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
