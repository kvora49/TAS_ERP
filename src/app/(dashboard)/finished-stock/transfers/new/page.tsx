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
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { SizeQuantityMatrix } from "@/components/shared/SizeQuantityMatrix";

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

interface TransferMatrixRow {
  key: string;
  design_id: string;
  colour_id: string;
  size_quantities: Record<string, number>;
  stock_matrix: Record<string, number>; // available stock per size in source godown
  unit_cost: number;
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

  // Form Items State (Matrix Rows)
  const [rows, setRows] = useState<TransferMatrixRow[]>([
    {
      key: `row-${Date.now()}-0`,
      design_id: "",
      colour_id: "",
      size_quantities: {},
      stock_matrix: {},
      unit_cost: 0,
      coloursList: [],
      sizesList: [],
    },
  ]);

  // Load masters on mount
  useEffect(() => {
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
    setRows((prev) => [
      ...prev,
      {
        key: `row-${Date.now()}-${Math.random()}`,
        design_id: "",
        colour_id: "",
        size_quantities: {},
        stock_matrix: {},
        unit_cost: 0,
        coloursList: [],
        sizesList: [],
      },
    ]);
  };

  const handleRemoveRow = (key: string) => {
    if (rows.length === 1) {
      toast.info("At least one transfer item row is required");
      return;
    }
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  const handleDesignChange = async (key: string, designId: string) => {
    const selectedDesign = designs.find((d) => d.id === designId);
    const sizes = selectedDesign?.size_set?.sizes || ["S", "M", "L", "XL", "XXL"];
    const defaultUnitCost = selectedDesign ? Math.round(Number(selectedDesign.sale_price || 0) * 0.6) : 0;

    const initialSizes: Record<string, number> = {};
    sizes.forEach((sz) => (initialSizes[sz] = 0));

    setRows((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        return {
          ...row,
          design_id: designId,
          colour_id: "",
          sizesList: sizes,
          size_quantities: initialSizes,
          stock_matrix: {},
          unit_cost: defaultUnitCost,
          coloursList: [],
        };
      })
    );

    if (!designId) return;

    // Load design colours and average cost fallback
    try {
      const res = await fetch(`/api/finished-stock/designs/${designId}`);
      const data = await res.json();
      if (res.ok) {
        const fetchedCost = Number(data.overallAvgCost || 0) > 0 ? Number(data.overallAvgCost) : defaultUnitCost;
        setRows((prev) =>
          prev.map((row) => {
            if (row.key !== key) return row;
            return {
              ...row,
              coloursList: data.colours || [],
              unit_cost: row.unit_cost > 0 ? row.unit_cost : fetchedCost,
            };
          })
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleColourChange = async (key: string, colourId: string) => {
    const row = rows.find((r) => r.key === key);
    if (!row) return;

    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, colour_id: colourId, stock_matrix: {} } : r))
    );

    if (!colourId || !row.design_id || !fromGodownId) return;

    // Fetch live stock matrix for fromGodownId + designId + colourId
    try {
      const res = await fetch(`/api/finished-stock/designs/${row.design_id}`);
      const json = await res.json();
      if (res.ok && json.matrix) {
        const availableMap: Record<string, number> = {};
        row.sizesList.forEach((sz) => {
          availableMap[sz] = json.matrix[colourId]?.[fromGodownId]?.[sz] || 0;
        });

        setRows((prev) =>
          prev.map((r) => {
            if (r.key !== key) return r;
            return { ...r, stock_matrix: availableMap };
          })
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSizeQuantitiesChange = (key: string, updatedQuantities: Record<string, number>) => {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, size_quantities: updatedQuantities } : row))
    );
  };

  const handleUnitCostChange = (key: string, val: string) => {
    const cost = Math.max(0, parseFloat(val) || 0);
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, unit_cost: cost } : row))
    );
  };

  // Submit Handler
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

    // Expand matrix rows into individual transfer items
    const transferItemsPayload: Array<{
      design_id: string;
      colour_id: string;
      size: string;
      quantity: number;
      unit_cost: number;
      total_value: number;
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.design_id || !row.colour_id) {
        toast.error(`Please select Design and Colour for Row #${i + 1}`);
        return;
      }

      let rowQty = 0;
      Object.entries(row.size_quantities).forEach(([sz, qty]) => {
        const numQty = Number(qty) || 0;
        if (numQty > 0) {
          rowQty += numQty;
          const avail = row.stock_matrix[sz] || 0;
          if (numQty > avail) {
            toast.warning(
              `Row #${i + 1}: Transfer qty for size ${sz} (${numQty} pcs) exceeds available stock (${avail} pcs) in source godown.`
            );
          }

          transferItemsPayload.push({
            design_id: row.design_id,
            colour_id: row.colour_id,
            size: sz,
            quantity: numQty,
            unit_cost: row.unit_cost,
            total_value: numQty * row.unit_cost,
          });
        }
      });

      if (rowQty === 0) {
        toast.error(`Row #${i + 1}: Please enter at least 1 piece across sizes`);
        return;
      }
    }

    if (transferItemsPayload.length === 0) {
      toast.error("No valid transfer items entered");
      return;
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
          items: transferItemsPayload,
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

  // Grand Summaries
  let grandTotalQty = 0;
  let grandTotalValue = 0;

  rows.forEach((row) => {
    const rowQty = Object.values(row.size_quantities).reduce(
      (sum, v) => sum + (Number(v) || 0),
      0
    );
    grandTotalQty += rowQty;
    grandTotalValue += rowQty * row.unit_cost;
  });

  const formatRupee = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
        <Link href="/finished-stock" className="hover:text-[var(--primary)] transition-colors">
          Finished Stock
        </Link>
        <span>/</span>
        <Link href="/finished-stock/transfers" className="hover:text-[var(--primary)] transition-colors">
          Transfers
        </Link>
        <span>/</span>
        <span className="text-[var(--text-primary)]">New</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/finished-stock/transfers"
            className="p-2 bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] border border-[var(--border)] rounded-xl transition-all cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5 text-[var(--text-secondary)]" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">New Stock Transfer</h1>
            <p className="text-sm text-[var(--text-muted)]">Transfer finished garments between warehouse godowns with size matrix distribution</p>
          </div>
        </div>

        {/* Exclusion Banner Badge */}
        <div className="hidden md:flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl px-3.5 py-2 text-xs text-indigo-800 dark:text-indigo-300 font-semibold">
          <ShieldAlert className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>Finished Stock Only (Raw Materials & Accessories Excluded)</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Side: Form Header & Size Matrix Rows */}
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
                  onChange={(e) => {
                    setFromGodownId(e.target.value);
                    // Refresh stock matrix for all rows
                    rows.forEach((r) => {
                      if (r.key && r.colour_id) handleColourChange(r.key, r.colour_id);
                    });
                  }}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none"
                >
                  <option value="">Select Source...</option>
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
                  <option value="">Select Destination...</option>
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
                  placeholder="e.g. EB-10029"
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
                  <option value="Sales Order">Sales Order Fulfillment</option>
                  <option value="Godown Consolidation">Godown Consolidation</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Initial Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none font-semibold"
                >
                  <option value="pending">Pending (Stock deducted from Source)</option>
                  <option value="in_transit">In Transit (Stock deducted, in route)</option>
                  <option value="completed">Completed (Added directly to Dest)</option>
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
                placeholder="Additional delivery instructions..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none resize-none"
              />
            </div>
          </div>

          {/* Size Matrix Items List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <ListPlus className="h-4.5 w-4.5 text-[var(--primary)]" />
                <span>Transfer Line Items (Size Matrix)</span>
              </h3>
              <button
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-1.5 text-xs font-bold text-[var(--primary)] bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 px-3.5 py-2 rounded-xl hover:bg-indigo-100 transition-all cursor-pointer shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Add Design Row</span>
              </button>
            </div>

            {rows.map((row, idx) => {
              const rowTotalQty = Object.values(row.size_quantities).reduce(
                (sum, v) => sum + (Number(v) || 0),
                0
              );
              const rowTotalValue = rowTotalQty * row.unit_cost;

              return (
                <div
                  key={row.key}
                  className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--shadow-sm)] space-y-4 relative"
                >
                  <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-full bg-[var(--page-bg)] border border-[var(--border)] text-xs font-bold text-[var(--text-secondary)] flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                        Design Line Item #{idx + 1}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveRow(row.key)}
                      className="text-[var(--text-muted)] hover:text-red-500 p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Design Selection */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        Design *
                      </label>
                      <select
                        required
                        value={row.design_id}
                        onChange={(e) => handleDesignChange(row.key, e.target.value)}
                        className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-xs outline-none"
                      >
                        <option value="">Select Design...</option>
                        {designs.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.design_number} - {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Colour Selection */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        Colour *
                      </label>
                      <select
                        required
                        value={row.colour_id}
                        onChange={(e) => handleColourChange(row.key, e.target.value)}
                        disabled={!row.design_id}
                        className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-xs outline-none disabled:opacity-50"
                      >
                        <option value="">Select Colour...</option>
                        {row.coloursList.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.colour_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Unit Cost */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        Unit Cost (₹/Pc) *
                      </label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={row.unit_cost}
                        onChange={(e) => handleUnitCostChange(row.key, e.target.value)}
                        className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-xs outline-none font-bold"
                      />
                    </div>
                  </div>

                  {/* Stock Availability Matrix Banner (if colour & godown selected) */}
                  {fromGodownId && row.colour_id && row.sizesList.length > 0 && (
                    <div className="bg-[var(--table-header-bg)] border border-[var(--border)] rounded-xl p-3 space-y-1.5">
                      <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                        Source Godown Available Stock per Size:
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {row.sizesList.map((sz) => (
                          <span
                            key={sz}
                            className="text-[10px] font-mono font-bold px-2 py-0.5 bg-[var(--card-bg)] border border-[var(--border)] rounded text-[var(--text-primary)]"
                          >
                            {sz}: <span className="text-emerald-600 dark:text-emerald-400">{row.stock_matrix[sz] || 0} Pcs</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Size Quantity Matrix Component */}
                  {row.sizesList.length > 0 && (
                    <SizeQuantityMatrix
                      sizes={row.sizesList}
                      sizeQuantities={row.size_quantities}
                      onChange={(updated) => handleSizeQuantitiesChange(row.key, updated)}
                    />
                  )}

                  {/* Row Total Summary Footer */}
                  <div className="flex items-center justify-end gap-6 pt-2 text-xs border-t border-[var(--border)]">
                    <span className="text-[var(--text-muted)]">
                      Total Quantity: <strong className="text-[var(--text-primary)]">{rowTotalQty} Pcs</strong>
                    </span>
                    <span className="text-[var(--text-muted)]">
                      Row Total Value: <strong className="text-[var(--primary)]">{formatRupee(rowTotalValue)}</strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Total Summary Sidebar Panel */}
        <div className="space-y-6">
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--shadow-sm)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border)] pb-2 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span>Transfer Impact Summary</span>
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Total Designs:</span>
                <span className="font-bold text-[var(--text-primary)]">{rows.length} design(s)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Total Garment Qty:</span>
                <span className="font-bold text-sm text-[var(--text-primary)]">
                  {grandTotalQty.toLocaleString()} Pcs
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-dashed border-[var(--border)] pt-3.5">
                <span className="text-[var(--text-muted)] font-bold">Aggregate Value:</span>
                <span className="font-extrabold text-base text-emerald-600 dark:text-emerald-400">
                  {formatRupee(grandTotalValue)}
                </span>
              </div>
            </div>

            <div className="border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/30 rounded-xl p-3 flex gap-2.5">
              <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-[10px] text-amber-900 dark:text-amber-300 leading-normal font-semibold">
                <strong className="block mb-0.5">Finished Stock Rule:</strong>
                Transfers apply exclusively to finished garments. Raw materials (fabric rolls) and accessories (zips, buttons, labels) are excluded and managed in raw material stock modules.
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] py-3 rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-50"
            >
              {submitting ? "Saving Transfer..." : "Save Stock Transfer"}
            </button>
            <Link
              href="/finished-stock/transfers"
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
