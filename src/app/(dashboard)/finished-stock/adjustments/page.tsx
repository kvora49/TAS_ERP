"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  RefreshCw,
  Search,
  AlertTriangle,
  Sparkles,
  Trash2,
  Wrench,
  HelpCircle,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Adjustment {
  id: string;
  adjustment_number: string;
  adjustment_type: "damage" | "sample" | "scrap" | "correction" | "other";
  adjustment_date: string;
  size: string;
  quantity_change: number;
  unit_cost: number;
  value_impact: number;
  reason: string;
  remarks?: string;
  attachment_url?: string;
  design: { code?: string; design_number?: string; name: string };
  colour: { colour_name: string; colour_hex?: string };
  godown: { name: string };
}

export default function StockAdjustmentsPage() {
  const [loading, setLoading] = useState(true);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [search, setSearch] = useState("");

  const fetchAdjustments = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/finished-stock/adjustments");
      const data = await res.json();
      if (res.ok && data.adjustments) {
        setAdjustments(data.adjustments);
      } else {
        toast.error(data.error || "Failed to load adjustments");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error. Could not connect to API.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdjustments();
  }, []);

  const formatRupee = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format(value);
  };

  // Helper for rendering adjustment type badge
  const renderTypeBadge = (type: string) => {
    const badges = {
      damage: {
        bg: "bg-[#FEE2E2] text-[#DC2626]",
        icon: AlertTriangle,
        label: "Damage"
      },
      sample: {
        bg: "bg-[#FEF3C7] text-[#D97706]",
        icon: Sparkles,
        label: "Sample"
      },
      scrap: {
        bg: "bg-[#EDE9FE] text-[#7C3AED]",
        icon: Trash2,
        label: "Scrap"
      },
      correction: {
        bg: "bg-[#DCFCE7] text-[#15803D]",
        icon: Wrench,
        label: "Correction"
      },
      other: {
        bg: "bg-slate-100 text-slate-700",
        icon: HelpCircle,
        label: "Other"
      }
    };

    const config = badges[type as keyof typeof badges] || badges.other;
    const Icon = config.icon;

    return (
      <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border border-current/10", config.bg)}>
        <Icon className="h-3 w-3 shrink-0" />
        <span>{config.label}</span>
      </span>
    );
  };

  const filteredAdjustments = adjustments.filter((adj) => {
    const code = (adj.design?.design_number || adj.design?.code || "").toLowerCase();
    const name = (adj.design?.name || "").toLowerCase();
    const ref = (adj.adjustment_number || "").toLowerCase();
    const s = search.toLowerCase();
    return code.includes(s) || name.includes(s) || ref.includes(s);
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B]">
          <Link href="/finished-stock" className="hover:text-[#6366F1] transition-colors">
            Finished Stock
          </Link>
          <span>/</span>
          <span className="text-[#334155]">Adjustments</span>
        </div>
        <button
          onClick={fetchAdjustments}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#6366F1] bg-white border border-[#E2E8F0] px-3 py-1.5 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-all cursor-pointer shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          <span>Sync Logs</span>
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/finished-stock"
            className="p-2 bg-white hover:bg-gray-50 border border-[#E2E8F0] rounded-xl transition-all cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5 text-[#475569]" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight">Stock Adjustments Log</h1>
            <p className="text-sm text-[#64748B]">Audit ledger of stock corrections, damages, samples, and scrap</p>
          </div>
        </div>

        <Link
          href="/finished-stock/adjustments/new"
          className="flex items-center gap-2 text-xs font-bold text-white bg-[#DC2626] hover:bg-[#B91C1C] px-4 py-2.5 rounded-xl transition-all shadow-md shadow-red-200 cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New Adjustment</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 border border-[#E2E8F0] rounded-2xl shadow-sm">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Search by Adjustment No, Design Code or Design Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-[#E2E8F0] rounded-xl text-sm placeholder-[#94A3B8] focus:border-[#C7D2FE] focus:ring-1 focus:ring-[#C7D2FE] outline-none"
          />
        </div>
      </div>

      {/* Adjustments Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs font-semibold text-[#475569]">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#475569] uppercase tracking-wider">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Ref Number</th>
                <th className="py-3 px-4">Godown</th>
                <th className="py-3 px-4">Design</th>
                <th className="py-3 px-4">Colour</th>
                <th className="py-3 px-4 text-center">Size</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4 text-right">Impact Value</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4 w-12 text-center">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-20" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded mx-auto w-6" /></td>
                    <td className="py-4 px-4"><div className="h-5 bg-gray-200 rounded-full w-20" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded ml-auto w-10" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded ml-auto w-16" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded mx-auto w-4" /></td>
                  </tr>
                ))
              ) : filteredAdjustments.length > 0 ? (
                filteredAdjustments.map((adj) => {
                  const isNegative = adj.quantity_change < 0;
                  return (
                    <tr key={adj.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-normal text-[#64748B]">
                        {new Date(adj.adjustment_date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric"
                        })}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#1E293B]">{adj.adjustment_number}</td>
                      <td className="py-3.5 px-4 text-[#334155]">{adj.godown?.name || "N/A"}</td>
                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-bold text-[#1E293B]">{adj.design?.design_number || adj.design?.code}</p>
                          <p className="text-[10px] text-[#94A3B8] font-normal leading-none">{adj.design?.name}</p>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#475569]">
                        {adj.colour?.colour_name || "N/A"}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-[#1E293B]">{adj.size}</td>
                      <td className="py-3.5 px-4">{renderTypeBadge(adj.adjustment_type)}</td>
                      <td className={cn("py-3.5 px-4 text-right font-bold text-sm", isNegative ? "text-[#DC2626]" : "text-[#15803D]")}>
                        {isNegative ? "" : "+"}
                        {adj.quantity_change.toLocaleString()}
                      </td>
                      <td className={cn("py-3.5 px-4 text-right font-bold", isNegative ? "text-[#DC2626]" : "text-[#15803D]")}>
                        {formatRupee(adj.value_impact)}
                      </td>
                      <td className="py-3.5 px-4 font-normal text-[#64748B]">
                        <div>
                          <p className="font-semibold text-[#334155] leading-none mb-0.5">{adj.reason}</p>
                          {adj.remarks && <p className="text-[10px] text-[#94A3B8] leading-none">{adj.remarks}</p>}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {adj.attachment_url ? (
                          <a
                            href={adj.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex text-[#6366F1] hover:text-[#4F46E5] hover:bg-indigo-50 p-1 rounded transition-all cursor-pointer"
                          >
                            <FileText className="h-4 w-4" />
                          </a>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-xs text-gray-400">
                    No adjustments recorded in the database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
