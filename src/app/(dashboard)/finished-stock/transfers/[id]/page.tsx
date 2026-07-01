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
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TransferItem {
  id: string;
  size: string;
  quantity: number;
  unit_cost: number;
  total_value: number;
  design: { code?: string; design_number?: string; name: string };
  colour: { colour_name: string; colour_hex?: string };
}

interface Transfer {
  id: string;
  transfer_number: string;
  transfer_date: string;
  reference_no?: string;
  reason: string;
  total_quantity: number;
  total_value: number;
  status: "pending" | "in_transit" | "completed" | "cancelled";
  remarks?: string;
  from_godown: { name: string };
  to_godown: { name: string };
}

export default function TransferDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [items, setItems] = useState<TransferItem[]>([]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/finished-stock/transfers/${params.id}`);
      const data = await res.json();
      if (res.ok && data.transfer) {
        setTransfer(data.transfer);
        setItems(data.items);
      } else {
        toast.error(data.error || "Failed to load transfer details");
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

  const handleUpdateStatus = async (newStatus: "in_transit" | "completed" | "cancelled") => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/finished-stock/transfers/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.transfer) {
        toast.success(`Transfer status updated to ${newStatus}`);
        setTransfer(data.transfer);
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

  const renderStatusBadge = (status: string) => {
    const configs = {
      pending: {
        bg: "bg-amber-50 text-amber-600 border-amber-200",
        icon: Clock,
        label: "Pending"
      },
      in_transit: {
        bg: "bg-blue-50 text-blue-600 border-blue-200",
        icon: MapPin,
        label: "In Transit"
      },
      completed: {
        bg: "bg-green-50 text-green-700 border-green-200",
        icon: CheckCircle2,
        label: "Completed"
      },
      cancelled: {
        bg: "bg-slate-50 text-slate-400 border-slate-200",
        icon: XCircle,
        label: "Cancelled"
      }
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
          <Link href="/finished-stock/transfers" className="hover:text-[#6366F1] transition-colors">
            Transfers
          </Link>
          <span>/</span>
          <span className="text-[#334155]">{transfer?.transfer_number || "Detail"}</span>
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
          href="/finished-stock/transfers"
          className="p-2 bg-white hover:bg-gray-50 border border-[#E2E8F0] rounded-xl transition-all cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5 text-[#475569]" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight">{transfer?.transfer_number || "Stock Transfer"}</h1>
          <p className="text-sm text-[#64748B]">Reason: <strong className="text-[#334155]">{transfer?.reason}</strong></p>
        </div>
      </div>

      {/* Quick Summary Panels */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#E2E8F0] h-20 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm space-y-1.5">
            <span className="text-[10px] font-bold text-[#94A3B8] uppercase">Status</span>
            <div>{renderStatusBadge(transfer?.status || "")}</div>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm space-y-1">
            <span className="text-[10px] font-bold text-[#94A3B8] uppercase">Route</span>
            <div className="flex items-center gap-2 text-xs font-bold text-[#334155]">
              <Building2 className="h-4 w-4 text-[#6366F1]" />
              <span>{transfer?.from_godown?.name}</span>
              <ArrowRight className="h-3 w-3 text-slate-400" />
              <span>{transfer?.to_godown?.name}</span>
            </div>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm space-y-1">
            <span className="text-[10px] font-bold text-[#94A3B8] uppercase">Total Quantity</span>
            <h4 className="text-base font-extrabold text-[#1E293B]">{transfer?.total_quantity} pcs</h4>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm space-y-1">
            <span className="text-[10px] font-bold text-[#94A3B8] uppercase">Total Value</span>
            <h4 className="text-base font-extrabold text-green-700">{formatRupee(transfer?.total_value || 0)}</h4>
          </div>
        </div>
      )}

      {/* Main Details Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#E2E8F0] flex items-center gap-2">
          <Boxes className="h-5 w-5 text-[#94A3B8]" />
          <div>
            <h3 className="text-base font-bold text-[#1E293B]">Stock Movements Grid</h3>
            <p className="text-xs text-[#64748B]">Sizing details of garment rows moved in this transfer</p>
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
                    No items in this transfer.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Resolutions Footer Bar */}
      {!loading && transfer && (transfer.status === "pending" || transfer.status === "in_transit") && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-[#1E293B] flex items-center gap-1.5">
              <Truck className="h-4.5 w-4.5 text-[#6366F1]" />
              <span>Pending Transfer Resolution Action</span>
            </h4>
            <p className="text-xs text-[#64748B]">Update status of this stock shipment as it progresses</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleUpdateStatus("cancelled")}
              disabled={updating}
              className="text-xs font-bold text-[#DC2626] bg-red-50 border border-red-200 px-4 py-2.5 rounded-xl hover:bg-red-100/70 active:bg-red-100 transition-all cursor-pointer shadow-sm disabled:opacity-50"
            >
              Cancel Transfer
            </button>
            {transfer.status === "pending" && (
              <button
                onClick={() => handleUpdateStatus("in_transit")}
                disabled={updating}
                className="text-xs font-bold text-[#3B82F6] bg-blue-50 border border-blue-200 px-4 py-2.5 rounded-xl hover:bg-blue-100/70 active:bg-blue-100 transition-all cursor-pointer shadow-sm disabled:opacity-50"
              >
                Mark In Transit
              </button>
            )}
            <button
              onClick={() => handleUpdateStatus("completed")}
              disabled={updating}
              className="text-xs font-bold text-white bg-[#16A34A] hover:bg-[#15803D] px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-md shadow-green-100 disabled:opacity-50"
            >
              Mark Completed
            </button>
          </div>
        </div>
      )}

      {/* Cancellation/Completed indicator info */}
      {!loading && transfer && (transfer.status === "cancelled" || transfer.status === "completed") && (
        <div className={cn(
          "rounded-2xl p-4.5 flex gap-3 text-xs border shadow-sm",
          transfer.status === "completed" ? "bg-green-50 border-green-200 text-green-800" : "bg-slate-50 border-slate-200 text-slate-600"
        )}>
          {transfer.status === "completed" ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <div className="leading-normal font-semibold">
                <strong>Shipment Completed:</strong> Stock has been successfully debited from {transfer.from_godown?.name} and credited to {transfer.to_godown?.name}. This shipment is now locked.
              </div>
            </>
          ) : (
            <>
              <XCircle className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
              <div className="leading-normal font-semibold">
                <strong>Shipment Cancelled:</strong> This transfer was cancelled. Any stock previously deducted from the source godown ({transfer.from_godown?.name}) has been reversed and credited back.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
