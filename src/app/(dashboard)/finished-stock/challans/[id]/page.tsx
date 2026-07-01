"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Building2,
  RefreshCw,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  TrendingUp,
  FileText,
  Boxes,
  Truck,
  ArrowRight,
  User,
  ExternalLink,
  ArrowDownLeft,
  ArrowUpRight
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChallanItem {
  id: string;
  size: string;
  quantity: number;
  unit_cost: number;
  total_value: number;
  design: { code?: string; design_number?: string; name: string };
  colour: { colour_name: string; colour_hex?: string };
}

interface Challan {
  id: string;
  challan_number: string;
  challan_date: string;
  challan_type: "inward" | "outward";
  reference_no?: string;
  remarks?: string;
  transporter?: string;
  lr_awb_no?: string;
  eway_bill_no?: string;
  total_quantity: number;
  total_value: number;
  status: "pending" | "in_transit" | "dispatched" | "received" | "completed" | "cancelled";
  from_godown: { name: string };
  to_party: {
    name: string;
    company_name?: string;
    email?: string;
    phone?: string;
    billing_address?: string;
    shipping_address?: string;
  };
}

export default function ChallanDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [challan, setChallan] = useState<Challan | null>(null);
  const [items, setItems] = useState<ChallanItem[]>([]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/finished-stock/challans/${params.id}`);
      const data = await res.json();
      if (res.ok && data.challan) {
        setChallan(data.challan);
        setItems(data.items);
      } else {
        toast.error(data.error || "Failed to load challan details");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error. Could not connect to API.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [params.id]);

  const handleUpdateStatus = async (newStatus: Challan["status"]) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/finished-stock/challans/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.challan) {
        toast.success(`Challan status updated to ${newStatus}`);
        setChallan(data.challan);
      } else {
        toast.error(data.error || "Failed to update status");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error. Could not update status.");
    } finally {
      setUpdating(false);
      fetchDetail(); // Reload to refresh stock ledger
    }
  };

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
        <span className="inline-flex items-center gap-1 text-xs font-bold bg-[#ECFDF5] text-[#065F46] border border-[#D1FAE5] px-3 py-1 rounded-full shrink-0">
          <ArrowDownLeft className="h-4 w-4 shrink-0" />
          <span>Inward</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold bg-[#EEF2FF] text-[#3730A3] border border-[#E0E7FF] px-3 py-1 rounded-full shrink-0">
        <ArrowUpRight className="h-4 w-4 shrink-0" />
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
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border shrink-0", config.bg)}>
        <Icon className="h-4 w-4 shrink-0" />
        <span>{config.label}</span>
      </span>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B]">
          <Link href="/finished-stock" className="hover:text-[#6366F1] transition-colors">
            Finished Stock
          </Link>
          <span>/</span>
          <Link href="/finished-stock/challans" className="hover:text-[#6366F1] transition-colors">
            Challans
          </Link>
          <span>/</span>
          <span className="text-[#334155]">{challan?.challan_number || "Detail"}</span>
        </div>
        <button
          onClick={fetchDetail}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#6366F1] bg-white border border-[#E2E8F0] px-3 py-1.5 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-all cursor-pointer shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/finished-stock/challans"
          className="p-2 bg-white hover:bg-gray-50 border border-[#E2E8F0] rounded-xl transition-all cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5 text-[#475569]" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight">{challan?.challan_number || "Challan Detail"}</h1>
          <p className="text-sm text-[#64748B]">Reference: <strong className="text-[#334155]">{challan?.reference_no || "N/A"}</strong></p>
        </div>
      </div>

      {/* Metadata Overview Columns */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#E2E8F0] h-20 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm space-y-1.5">
            <span className="text-[10px] font-bold text-[#94A3B8] uppercase">Challan Info</span>
            <div className="flex items-center gap-2">
              {renderStatusBadge(challan?.status || "")}
              {renderTypeBadge(challan?.challan_type || "")}
            </div>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm space-y-1">
            <span className="text-[10px] font-bold text-[#94A3B8] uppercase">Warehouse / Godown</span>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#334155]">
              <Building2 className="h-4 w-4 text-[#6366F1]" />
              <span>{challan?.from_godown?.name}</span>
            </div>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm space-y-1">
            <span className="text-[10px] font-bold text-[#94A3B8] uppercase">Receiver / Client</span>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#334155]">
              <User className="h-4 w-4 text-[#6366F1]" />
              <span className="truncate">{challan?.to_party?.company_name || challan?.to_party?.name}</span>
            </div>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm space-y-1">
            <span className="text-[10px] font-bold text-[#94A3B8] uppercase">Financial Summary</span>
            <div className="text-xs font-bold text-[#334155] leading-normal">
              <span className="text-slate-800">{challan?.total_quantity.toLocaleString()} pcs</span>
              <span className="mx-1 text-slate-300">|</span>
              <span className="text-green-700">{formatRupee(challan?.total_value || 0)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Logistics & Party Panel */}
      {!loading && challan && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Logistics */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider border-b border-[#F1F5F9] pb-2 flex items-center gap-2">
              <Truck className="h-4.5 w-4.5 text-[#6366F1]" />
              <span>Logistics & Transport</span>
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-[#94A3B8] mb-0.5">Transporter Partner:</p>
                <p className="font-bold text-[#334155]">{challan.transporter || "None Listed"}</p>
              </div>
              <div>
                <p className="text-[#94A3B8] mb-0.5">LR / AWB Number:</p>
                <p className="font-bold text-[#334155]">{challan.lr_awb_no || "None Listed"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[#94A3B8] mb-0.5">E-Way Bill Number:</p>
                <p className="font-bold text-[#334155]">{challan.eway_bill_no || "None Listed"}</p>
              </div>
            </div>
          </div>

          {/* Party address */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider border-b border-[#F1F5F9] pb-2 flex items-center gap-2">
              <User className="h-4.5 w-4.5 text-[#6366F1]" />
              <span>Contact & Address Info</span>
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-[#94A3B8] mb-0.5">Contact Phone:</p>
                <p className="font-bold text-[#334155]">{challan.to_party?.phone || "N/A"}</p>
              </div>
              <div>
                <p className="text-[#94A3B8] mb-0.5">Billing Address:</p>
                <p className="font-bold text-[#334155] truncate" title={challan.to_party?.billing_address}>{challan.to_party?.billing_address || "N/A"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[#94A3B8] mb-0.5">Shipping Address:</p>
                <p className="font-bold text-[#334155] truncate" title={challan.to_party?.shipping_address}>{challan.to_party?.shipping_address || "N/A"}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Details Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#E2E8F0] flex items-center gap-2">
          <Boxes className="h-5 w-5 text-[#94A3B8]" />
          <div>
            <h3 className="text-base font-bold text-[#1E293B]">Challan Garment Items List</h3>
            <p className="text-xs text-[#64748B]">Garment details of design items recorded in this challan</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs font-semibold text-[#475569]">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#475569] uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Design Code</th>
                <th className="py-3 px-4">Design Name</th>
                <th className="py-3 px-4">Colour</th>
                <th className="py-3 px-4 text-center">Size</th>
                <th className="py-3 px-4 text-right">Quantity (Pcs)</th>
                <th className="py-3 px-4 text-right">Unit Cost</th>
                <th className="py-3 px-4 text-right">Total Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded mx-auto w-4" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-28" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded mx-auto w-6" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded ml-auto w-12" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded ml-auto w-16" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded ml-auto w-20" /></td>
                  </tr>
                ))
              ) : items.length > 0 ? (
                items.map((it, idx) => (
                  <tr key={it.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4 text-center text-xs text-[#94A3B8] font-bold">{idx + 1}</td>
                    <td className="py-3.5 px-4 font-bold text-[#1E293B]">{it.design?.design_number || it.design?.code}</td>
                    <td className="py-3.5 px-4 font-semibold text-[#475569]">{it.design?.name}</td>
                    <td className="py-3.5 px-4">{it.colour?.colour_name}</td>
                    <td className="py-3.5 px-4 text-center font-bold text-[#1E293B]">{it.size}</td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-[#1E293B]">{it.quantity.toLocaleString()}</td>
                    <td className="py-3.5 px-4 text-right text-[#64748B]">{formatRupee(it.unit_cost)}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#6366F1]">{formatRupee(it.total_value)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-gray-400">
                    No items in this challan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Resolutions Footer Bar */}
      {!loading && challan && !["completed", "cancelled"].includes(challan.status) && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-[#1E293B] flex items-center gap-1.5">
              <Truck className="h-4.5 w-4.5 text-[#6366F1]" />
              <span>Challan Processing Action Bar</span>
            </h4>
            <p className="text-xs text-[#64748B]">Update status of this delivery document as stock is moved</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleUpdateStatus("cancelled")}
              disabled={updating}
              className="text-xs font-bold text-[#DC2626] bg-red-50 border border-red-200 px-3.5 py-2.5 rounded-xl hover:bg-red-100/70 active:bg-red-100 transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel Challan
            </button>
            {challan.status === "pending" && (
              <button
                onClick={() => handleUpdateStatus("in_transit")}
                disabled={updating}
                className="text-xs font-bold text-[#3B82F6] bg-blue-50 border border-blue-200 px-3.5 py-2.5 rounded-xl hover:bg-blue-100/70 active:bg-blue-100 transition-all cursor-pointer disabled:opacity-50"
              >
                Mark In Transit
              </button>
            )}
            {challan.challan_type === "outward" && ["pending", "in_transit"].includes(challan.status) && (
              <button
                onClick={() => handleUpdateStatus("dispatched")}
                disabled={updating}
                className="text-xs font-bold text-[#6366F1] bg-indigo-50 border border-indigo-200 px-3.5 py-2.5 rounded-xl hover:bg-indigo-100/70 active:bg-indigo-100 transition-all cursor-pointer disabled:opacity-50"
              >
                Dispatch Stock
              </button>
            )}
            {["pending", "in_transit", "dispatched"].includes(challan.status) && (
              <button
                onClick={() => handleUpdateStatus("received")}
                disabled={updating}
                className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-3.5 py-2.5 rounded-xl hover:bg-teal-100/70 active:bg-teal-100 transition-all cursor-pointer disabled:opacity-50"
              >
                Confirm Received
              </button>
            )}
            <button
              onClick={() => handleUpdateStatus("completed")}
              disabled={updating}
              className="text-xs font-bold text-white bg-[#15803D] hover:bg-[#166534] px-4.5 py-2.5 rounded-xl transition-all cursor-pointer shadow-md shadow-green-100 disabled:opacity-50"
            >
              Complete Challan
            </button>
          </div>
        </div>
      )}

      {/* Lock/Cancellation/Completed status notes */}
      {!loading && challan && ["completed", "cancelled"].includes(challan.status) && (
        <div className={cn(
          "rounded-2xl p-4.5 flex gap-3 text-xs border shadow-sm",
          challan.status === "completed" ? "bg-green-50 border-green-200 text-green-800" : "bg-slate-50 border-slate-200 text-slate-600"
        )}>
          {challan.status === "completed" ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <div className="leading-normal font-semibold">
                <strong>Challan Completed & Locked:</strong> This delivery is legally closed and verified. Stock balances have been updated and locked.
              </div>
            </>
          ) : (
            <>
              <XCircle className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
              <div className="leading-normal font-semibold">
                <strong>Challan Cancelled:</strong> This delivery document has been voided. Any stock previously deducted (for Outward) or credited (for Inward) has been fully reversed in the ledger.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
