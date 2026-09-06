"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Building2,
  Users,
  Plus,
  Trash2,
  RefreshCw,
  Info,
  DollarSign,
  Truck,
  CheckCircle2,
  ListPlus
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Godown {
  id: string;
  name: string;
}

interface Party {
  id: string;
  name: string;
  company_name?: string;
  party_type: string;
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

interface ChallanItemInput {
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

export default function NewChallanPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Header Details
  const [challanDate, setChallanDate] = useState(new Date().toISOString().split("T")[0]);
  const [challanType, setChallanType] = useState<"inward" | "outward">("outward");
  const [fromGodownId, setFromGodownId] = useState("");
  const [toPartyId, setToPartyId] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [transporter, setTransporter] = useState("");
  const [lrAwbNo, setLrAwbNo] = useState("");
  const [ewayBillNo, setEwayBillNo] = useState("");
  const [status, setStatus] = useState<"pending" | "in_transit" | "dispatched" | "received">("pending");
  const [remarks, setRemarks] = useState("");

  // Masters
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);

  // Items State
  const [items, setItems] = useState<ChallanItemInput[]>([
    {
      design_id: "",
      colour_id: "",
      size: "",
      quantity: 10,
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

    // 2. Fetch parties
    fetch("/api/parties")
      .then((res) => res.json())
      .then((data) => {
        if (data.parties) {
          setParties(data.parties);
        }
      })
      .catch((err) => console.error("Error loading parties:", err));

    // 3. Fetch designs
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
        quantity: 10,
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
      toast.info("At least one item row is required");
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

    // Load colours and average cost fallback
    try {
      const res = await fetch(`/api/finished-stock/designs/${designId}`);
      const data = await res.json();
      if (res.ok) {
        const current = [...items];
        if (current[index].design_id === designId) {
          if (data.colours) {
            current[index].coloursList = data.colours;
          }
          if (Number(data.overallAvgCost || 0) > 0 && current[index].unit_cost <= 0) {
            current[index].unit_cost = Math.round(Number(data.overallAvgCost));
            current[index].total_value = current[index].quantity * current[index].unit_cost;
          }
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

    if (!fromGodownId || !toPartyId || !challanDate || !challanType) {
      toast.error("Please fill in all header details");
      return;
    }

    // Validate items
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.design_id || !it.colour_id || !it.size || !it.quantity || !it.unit_cost) {
        toast.error(`Please complete all fields on item row #${i + 1}`);
        return;
      }
      
      // Stock check only for outward challans
      if (challanType === "outward" && ["dispatched", "received", "completed"].includes(status)) {
        if (it.quantity > it.available_stock) {
          toast.error(`Row #${i + 1}: Requested quantity (${it.quantity}) exceeds available stock (${it.available_stock} pcs) in godown.`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/finished-stock/challans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challan_date: challanDate,
          challan_type: challanType,
          from_godown_id: fromGodownId,
          to_party_id: toPartyId,
          reference_no: referenceNo,
          transporter,
          lr_awb_no: lrAwbNo,
          eway_bill_no: ewayBillNo,
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
        toast.success("Delivery Challan saved successfully!");
        router.push("/finished-stock/challans");
      } else {
        toast.error(data.error || "Failed to save challan");
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
    <div className="p-3.5 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
        <Link href="/finished-stock" className="hover:text-[var(--primary)] transition-colors">
          Finished Stock
        </Link>
        <span>/</span>
        <Link href="/finished-stock/challans" className="hover:text-[var(--primary)] transition-colors">
          Challans
        </Link>
        <span>/</span>
        <span className="text-[var(--text-primary)] font-bold">New</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <Link
            href="/finished-stock/challans"
            className="p-2 bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] border border-[var(--border)] rounded-xl transition-all cursor-pointer shrink-0"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-[var(--text-secondary)]" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight truncate">Create Delivery Challan</h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] truncate">Issue inward/outward delivery challans for garments stock movements</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Left Side: Challan Header Details & Items Table */}
        <div className="lg:col-span-3 space-y-4 sm:space-y-6">
          {/* Header Panel */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 sm:p-6 shadow-[var(--shadow-sm)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border-light)] pb-2 flex items-center gap-2">
              <Building2 className="h-4.5 w-4.5 text-[var(--primary)]" />
              <span>Challan Header Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
              {/* Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Challan Date *
                </label>
                <input
                  type="date"
                  required
                  value={challanDate}
                  onChange={(e) => setChallanDate(e.target.value)}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none"
                />
              </div>

              {/* Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Challan Type *
                </label>
                <select
                  required
                  value={challanType}
                  onChange={(e) => {
                    setChallanType(e.target.value as any);
                    setItems(items.map(it => ({ ...it, available_stock: 0 })));
                  }}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none font-bold text-[var(--primary)]"
                >
                  <option value="outward">Outward (Dispatch to client)</option>
                  <option value="inward">Inward (Returns or dye house)</option>
                </select>
              </div>

              {/* Godown */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Storage Godown *
                </label>
                <select
                  required
                  value={fromGodownId}
                  onChange={(e) => {
                    setFromGodownId(e.target.value);
                    setItems(items.map(it => ({ ...it, available_stock: 0 })));
                  }}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none"
                >
                  <option value="">Select Warehouse...</option>
                  {godowns.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              {/* Party */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Receiver Party *
                </label>
                <select
                  required
                  value={toPartyId}
                  onChange={(e) => setToPartyId(e.target.value)}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none"
                >
                  <option value="">Select Party...</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>{p.company_name || p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
              {/* Ref No */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Reference / PO No
                </label>
                <input
                  type="text"
                  placeholder="e.g. PO-89021"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none"
                />
              </div>

              {/* Transporter */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Transporter Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. V-Trans Logistics"
                  value={transporter}
                  onChange={(e) => setTransporter(e.target.value)}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none"
                />
              </div>

              {/* LR/AWB No */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  LR / Docket No
                </label>
                <input
                  type="text"
                  placeholder="e.g. LR-449102"
                  value={lrAwbNo}
                  onChange={(e) => setLrAwbNo(e.target.value)}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none"
                />
              </div>

              {/* E-way Bill No */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  E-way Bill No
                </label>
                <input
                  type="text"
                  placeholder="e.g. 541092819281"
                  value={ewayBillNo}
                  onChange={(e) => setEwayBillNo(e.target.value)}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Initial Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none font-semibold"
                >
                  <option value="pending">Pending (Created - no stock changes)</option>
                  <option value="in_transit">In Transit (Dispatched - no stock changes)</option>
                  <option value="dispatched">Dispatched (Outward stock deducted)</option>
                  <option value="received">Received / Completed (Stock updated)</option>
                </select>
              </div>

              {/* Remarks */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Remarks
                </label>
                <input
                  type="text"
                  placeholder="Notes for party/transporter..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[var(--input-focus)] outline-none"
                />
              </div>
            </div>
          </div>

          {/* Items Table Panel */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-sm)] overflow-hidden space-y-4 p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-[var(--border-light)] pb-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <ListPlus className="h-4.5 w-4.5 text-[var(--primary)]" />
                <span>Challan Garment Items</span>
              </h3>
              <button
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Add Item Row</span>
              </button>
            </div>

            {/* ── MOBILE: Dedicated Garment Item Cards (md:hidden) ── */}
            <div className="md:hidden space-y-3">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-3.5 space-y-3 shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      Item #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(idx)}
                      className="text-[var(--text-muted)] hover:text-rose-500 p-1 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Design select */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Design *</label>
                    <select
                      required
                      value={item.design_id}
                      onChange={(e) => handleDesignChange(idx, e.target.value)}
                      className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg px-2.5 py-2 text-xs outline-none"
                    >
                      <option value="">Select Design...</option>
                      {designs.map((d) => (
                        <option key={d.id} value={d.id}>{d.design_number} - {d.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Colour and Size */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Colour *</label>
                      <select
                        required
                        value={item.colour_id}
                        onChange={(e) => handleItemPropertyChange(idx, "colour_id", e.target.value)}
                        disabled={!item.design_id}
                        className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg px-2.5 py-2 text-xs outline-none disabled:opacity-50"
                      >
                        <option value="">Colour...</option>
                        {item.coloursList.map((c) => (
                          <option key={c.id} value={c.id}>{c.colour_name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Size *</label>
                      <select
                        required
                        value={item.size}
                        onChange={(e) => handleItemPropertyChange(idx, "size", e.target.value)}
                        disabled={!item.design_id}
                        className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg px-2.5 py-2 text-xs outline-none disabled:opacity-50 text-center"
                      >
                        <option value="">Size...</option>
                        {item.sizesList.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Stock, Qty, Cost */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--border-light)]">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-[var(--text-muted)]">
                        <span>Quantity (Pcs)</span>
                        {challanType === "outward" && (
                          <span className="text-emerald-600 dark:text-emerald-400">Avail: {item.available_stock}</span>
                        )}
                      </div>
                      <input
                        type="number"
                        required
                        min={1}
                        max={(challanType === "outward" && ["dispatched", "received", "completed"].includes(status)) ? item.available_stock : undefined}
                        value={item.quantity}
                        onChange={(e) => handleItemPropertyChange(idx, "quantity", e.target.value)}
                        className="w-full text-center bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg px-2 py-1.5 text-xs font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Cost/Pc (₹)</label>
                      <input
                        type="number"
                        required
                        min={0}
                        value={item.unit_cost}
                        onChange={(e) => handleItemPropertyChange(idx, "unit_cost", e.target.value)}
                        className="w-full text-right bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg px-2 py-1.5 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-[var(--border-light)]">
                    <span className="text-[var(--text-muted)]">Line Total:</span>
                    <span className="font-mono font-bold text-[var(--primary)] text-sm">{formatRupee(item.total_value)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* ── DESKTOP: Full Table (hidden md:block) ── */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full border-collapse text-left text-xs font-semibold text-[var(--text-body)]">
                <thead>
                  <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    <th className="py-3 px-4 w-8 text-center">#</th>
                    <th className="py-3 px-4 w-48">Design</th>
                    <th className="py-3 px-4 w-36">Colour</th>
                    <th className="py-3 px-3 w-24 text-center">Size</th>
                    {challanType === "outward" && <th className="py-3 px-3 w-28 text-center bg-[var(--page-bg)]">Available</th>}
                    <th className="py-3 px-3 w-28 text-center">Qty (Pcs)</th>
                    <th className="py-3 px-3 w-28 text-right">Cost/Pc (₹)</th>
                    <th className="py-3 px-4 w-32 text-right">Total Value</th>
                    <th className="py-3 px-4 w-12 text-center">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[var(--table-row-hover)] transition-colors">
                      <td className="py-3.5 px-4 text-center text-[var(--text-faint)] font-bold">{idx + 1}</td>
                      <td className="py-3 px-2">
                        <select
                          required
                          value={item.design_id}
                          onChange={(e) => handleDesignChange(idx, e.target.value)}
                          className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-2 py-1.5 text-xs outline-none"
                        >
                          <option value="">Select Design...</option>
                          {designs.map((d) => (
                            <option key={d.id} value={d.id}>{d.design_number} - {d.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-2">
                        <select
                          required
                          value={item.colour_id}
                          onChange={(e) => handleItemPropertyChange(idx, "colour_id", e.target.value)}
                          disabled={!item.design_id}
                          className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-2 py-1.5 text-xs outline-none disabled:opacity-50"
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
                          className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-2 py-1.5 text-xs outline-none text-center disabled:opacity-50"
                        >
                          <option value="">Size</option>
                          {item.sizesList.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      {challanType === "outward" && (
                        <td className="py-3 px-2 text-center bg-[var(--page-bg)]/40 text-[var(--text-primary)] font-bold">
                          {item.available_stock.toLocaleString()} <span className="text-[10px] text-[var(--text-muted)] font-normal">pcs</span>
                        </td>
                      )}
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          required
                          min={1}
                          max={(challanType === "outward" && ["dispatched", "received", "completed"].includes(status)) ? item.available_stock : undefined}
                          value={item.quantity}
                          onChange={(e) => handleItemPropertyChange(idx, "quantity", e.target.value)}
                          className="w-full text-center bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-2 py-1.5 text-xs outline-none font-bold text-[var(--text-primary)]"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          required
                          min={0}
                          value={item.unit_cost}
                          onChange={(e) => handleItemPropertyChange(idx, "unit_cost", e.target.value)}
                          className="w-full text-right bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-2 py-1.5 text-xs outline-none"
                        />
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-[var(--primary)] font-mono text-xs">
                        {formatRupee(item.total_value)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="text-[var(--text-muted)] hover:text-rose-500 p-1.5 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
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
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 sm:p-5 shadow-[var(--shadow-sm)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border-light)] pb-2 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <span>Challan Impact</span>
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Total Items:</span>
                <span className="font-bold text-[var(--text-primary)]">{items.length} rows</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Total Quantity (Pcs):</span>
                <span className="font-bold font-mono text-sm text-[var(--text-primary)]">{totalQty.toLocaleString()} Pcs</span>
              </div>
              <div className="flex items-center justify-between border-t border-dashed border-[var(--border)] pt-3.5">
                <span className="text-[var(--text-muted)] font-bold">Aggregate Value:</span>
                <span className="font-extrabold font-mono text-base text-emerald-600 dark:text-emerald-400">{formatRupee(totalVal)}</span>
              </div>
            </div>

            <div className="border border-emerald-500/20 bg-emerald-500/10 rounded-xl p-3 flex gap-2.5">
              <Info className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-[10px] text-emerald-900 dark:text-emerald-300 leading-normal font-semibold">
                <strong className="block mb-0.5">Stock Timing Rule:</strong>
                - Outward: Stock deducted immediately on Dispatched/Completed.<br />
                - Inward: Stock added immediately on Received/Completed.
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 py-3 rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Delivery Challan"}
            </button>
            <Link
              href="/finished-stock/challans"
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
