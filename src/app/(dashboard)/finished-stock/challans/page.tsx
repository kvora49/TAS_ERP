"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  RefreshCw,
  Search,
  ArrowRight,
  TrendingUp,
  Building2,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  ArrowDownLeft,
  ArrowUpRight
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Challan {
  id: string;
  challan_number: string;
  challan_date: string;
  challan_type: "inward" | "outward";
  total_quantity: number;
  total_value: number;
  status: "pending" | "in_transit" | "dispatched" | "received" | "completed" | "cancelled";
  remarks?: string;
  from_godown?: { name: string };
  to_party?: { name: string; company_name?: string };
}

export default function ChallansListPage() {
  const [loading, setLoading] = useState(true);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [search, setSearch] = useState("");

  const fetchChallans = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/finished-stock/challans");
      const data = await res.json();
      if (res.ok && data.challans) {
        setChallans(data.challans);
      } else {
        toast.error(data.error || "Failed to load challans");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error. Could not connect to API.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChallans();
  }, []);

  const formatRupee = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(value);
  };

  const renderTypeBadge = (type: string) => {
    if (type === "inward") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#ECFDF5] text-[#065F46] border border-[#D1FAE5] px-2 py-0.5 rounded-full shrink-0">
          <ArrowDownLeft className="h-3 w-3 shrink-0" />
          <span>Inward</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#EEF2FF] text-[#3730A3] border border-[#E0E7FF] px-2 py-0.5 rounded-full shrink-0">
        <ArrowUpRight className="h-3 w-3 shrink-0" />
        <span>Outward</span>
      </span>
    );
  };

  const renderStatusBadge = (status: string) => {
    const configs = {
      pending: { bg: "bg-amber-50 text-amber-600 border-amber-200", icon: Clock, label: "Pending" },
      in_transit: { bg: "bg-blue-50 text-blue-600 border-blue-200", icon: Truck, label: "In Transit" },
      dispatched: { bg: "bg-indigo-50 text-indigo-600 border-indigo-200", icon: Truck, label: "Dispatched" },
      received: { bg: "bg-teal-50 text-teal-600 border-teal-200", icon: CheckCircle2, label: "Received" },
      completed: { bg: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2, label: "Completed" },
      cancelled: { bg: "bg-slate-50 text-slate-400 border-slate-200", icon: XCircle, label: "Cancelled" }
    };

    const config = configs[status as keyof typeof configs] || configs.pending;
    const Icon = config.icon;

    return (
      <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0", config.bg)}>
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span>{config.label}</span>
      </span>
    );
  };

  const filteredChallans = challans.filter((ch) => {
    const partyName = (ch.to_party?.name || ch.to_party?.company_name || "").toLowerCase();
    const ref = (ch.challan_number || "").toLowerCase();
    const s = search.toLowerCase();
    return partyName.includes(s) || ref.includes(s);
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
          <span className="text-[#334155]">Challans</span>
        </div>
        <button
          onClick={fetchChallans}
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
            <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight">Delivery Challans Log</h1>
            <p className="text-sm text-[#64748B]">Document movements of stock to external partners or customers</p>
          </div>
        </div>

        <Link
          href="/finished-stock/challans/new"
          className="flex items-center gap-2 text-xs font-bold text-white bg-[#15803D] hover:bg-[#166534] px-4 py-2.5 rounded-xl transition-all shadow-md shadow-green-100 cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Create Challan</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 border border-[#E2E8F0] rounded-2xl shadow-sm">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Search by Challan No or Party Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-[#E2E8F0] rounded-xl text-sm placeholder-[#94A3B8] focus:border-[#C7D2FE] focus:ring-1 focus:ring-[#C7D2FE] outline-none"
          />
        </div>
      </div>

      {/* Challans Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs font-semibold text-[#475569]">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#475569] uppercase tracking-wider">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Challan No</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Warehouse</th>
                <th className="py-3 px-4">Party Name</th>
                <th className="py-3 px-4 text-right">Total Qty (Pcs)</th>
                <th className="py-3 px-4 text-right">Total Value</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-20" /></td>
                    <td className="py-4 px-4"><div className="h-5 bg-gray-200 rounded-full w-14" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-20" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded ml-auto w-12" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded ml-auto w-16" /></td>
                    <td className="py-4 px-4"><div className="h-5 bg-gray-200 rounded-full w-20" /></td>
                    <td className="py-4 px-5"><div className="h-6 bg-gray-200 rounded mx-auto w-12" /></td>
                  </tr>
                ))
              ) : filteredChallans.length > 0 ? (
                filteredChallans.map((ch) => (
                  <tr key={ch.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-normal text-[#64748B]">
                      {new Date(ch.challan_date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                      })}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#1E293B]">{ch.challan_number}</td>
                    <td className="py-3.5 px-4">{renderTypeBadge(ch.challan_type)}</td>
                    <td className="py-3.5 px-4 text-[#334155]">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-[#94A3B8]" />
                        <span>{ch.from_godown?.name || "N/A"}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#334155] font-semibold">
                      {ch.to_party?.company_name || ch.to_party?.name}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#1E293B]">
                      {(ch.total_quantity || 0).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#334155]">
                      {formatRupee(ch.total_value)}
                    </td>
                    <td className="py-3.5 px-4">{renderStatusBadge(ch.status)}</td>
                    <td className="py-3.5 px-5 text-center">
                      <Link
                        href={`/finished-stock/challans/${ch.id}`}
                        className="inline-flex items-center justify-center p-1.5 bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#6366F1] hover:border-[#6366F1] rounded-lg transition-all"
                        title="View Details"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-gray-400">
                    No delivery challans recorded in the database.
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
