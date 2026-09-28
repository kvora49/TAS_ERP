"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  RefreshCw,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  Boxes,
  Truck,
  User,
  ArrowDownLeft,
  ArrowUpRight,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatCurrency } from "@/lib/utils";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";
import { Modal } from "@/components/shared/Modal";
import { format } from "date-fns";

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
  ewb_date?: string;
  ewb_valid_till?: string;
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
  const { id } = params;
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<{
    challan: Challan;
    items: ChallanItem[];
  }>({
    queryKey: ["stock-challan", id],
    queryFn: async () => {
      const res = await fetch(`/api/finished-stock/challans/${id}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to load challan details");
      }
      return res.json();
    },
    staleTime: 30_000,
  });

  const challan = data?.challan || null;
  const items = data?.items || [];

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: Challan["status"]) => {
      const res = await fetch(`/api/finished-stock/challans/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to update status");
      return resData;
    },
    onSuccess: (resData, newStatus) => {
      toast.success(`Challan status updated to ${newStatus}`);
      queryClient.invalidateQueries({ queryKey: ["stock-challan", id] });
      queryClient.invalidateQueries({ queryKey: ["finished-stock"] });
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || "Could not update status");
    },
  });

  const [isEwbModalOpen, setIsEwbModalOpen] = useState(false);
  const [vehicleNo, setVehicleNo] = useState("");
  const [transporterName, setTransporterName] = useState("");
  const [transporterId, setTransporterId] = useState("");
  const [distanceKm, setDistanceKm] = useState(50);

  const generateEwbMutation = useMutation({
    mutationFn: async (payload: {
      vehicle_no?: string;
      transporter_name?: string;
      transporter_id?: string;
      distance_km?: number;
    }) => {
      const res = await fetch(`/api/finished-stock/challans/${id}/eway/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to generate E-Way bill");
      return resData;
    },
    onSuccess: (resData) => {
      toast.success(resData.message || `E-Way Bill #${resData.ewbNo} generated!`);
      queryClient.invalidateQueries({ queryKey: ["stock-challan", id] });
      refetch();
      setIsEwbModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to generate E-Way bill");
    },
  });

  const renderStatusBadge = (status: string) => {
    const configs = {
      pending: {
        bg: "bg-amber-500/10 text-amber-500 border-amber-500/30",
        icon: Clock,
        label: "Pending",
      },
      in_transit: {
        bg: "bg-blue-500/10 text-blue-500 border-blue-500/30",
        icon: MapPin,
        label: "In Transit",
      },
      dispatched: {
        bg: "bg-indigo-500/10 text-indigo-500 border-indigo-500/30",
        icon: Truck,
        label: "Dispatched",
      },
      received: {
        bg: "bg-teal-500/10 text-teal-500 border-teal-500/30",
        icon: CheckCircle2,
        label: "Received",
      },
      completed: {
        bg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
        icon: CheckCircle2,
        label: "Completed",
      },
      cancelled: {
        bg: "bg-slate-500/10 text-slate-400 border-slate-500/30",
        icon: XCircle,
        label: "Cancelled",
      },
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

  const renderTypeBadge = (type: string) => {
    const isInward = type === "inward";
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border shrink-0",
          isInward
            ? "bg-purple-500/10 text-purple-500 border-purple-500/30"
            : "bg-sky-500/10 text-sky-500 border-sky-500/30"
        )}
      >
        {isInward ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
        <span>{isInward ? "Inward Delivery" : "Outward Dispatch"}</span>
      </span>
    );
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Breadcrumbs and Refresh */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
          <Link href="/finished-stock" className="hover:text-[var(--primary)] transition-colors">
            Finished Stock
          </Link>
          <span>/</span>
          <Link href="/finished-stock/operations?tab=challans" className="hover:text-[var(--primary)] transition-colors">
            Challans
          </Link>
          <span>/</span>
          <span className="text-[var(--text-primary)] font-mono">{challan?.challan_number || "Detail"}</span>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] bg-[var(--card-bg)] border border-[var(--border)] px-3 py-1.5 rounded-lg hover:bg-[var(--table-row-hover)] active:scale-95 transition-all cursor-pointer shadow-[var(--shadow-sm)] disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/finished-stock/operations?tab=challans"
            className="p-2 bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] border border-[var(--border)] rounded-xl transition-all cursor-pointer text-[var(--text-muted)] active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight truncate">
              {challan?.challan_number || "Challan Detail"}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] truncate">
              Reference: <strong className="text-[var(--text-primary)]">{challan?.reference_no || "N/A"}</strong>
            </p>
          </div>
        </div>

        {/* E-Way Bill Action / Badge */}
        {challan && challan.challan_type === "outward" && (
          <div className="flex items-center gap-2 shrink-0">
            {challan.eway_bill_no ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-xs">
                <CheckCircle2 className="h-4 w-4" />
                <span>E-Way Bill: {challan.eway_bill_no}</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setVehicleNo(challan.transporter || "");
                  setTransporterName(challan.transporter || "Road Transport");
                  setIsEwbModalOpen(true);
                }}
                disabled={["cancelled"].includes(challan.status)}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-[var(--primary)] hover:opacity-90 text-white shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Truck className="h-4 w-4" />
                <span>Generate E-Way Bill</span>
              </button>
            )}
          </div>
        )}
      </div>

      <PageState
        isLoading={isLoading}
        isError={!!error}
        error={error instanceof Error ? error.message : "Failed to load challan"}
        onRetry={refetch}
        isEmpty={!challan && !isLoading}
        emptyTitle="Challan Not Found"
        emptyDescription="The requested delivery challan could not be located."
        skeletonVariant="card"
        skeletonCount={4}
      >
        {challan && (
          <div className="space-y-4 sm:space-y-6">
            {/* Metadata Overview Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-sm)] space-y-1.5">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Challan Info</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {renderStatusBadge(challan.status)}
                  {renderTypeBadge(challan.challan_type)}
                </div>
              </div>
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-sm)] space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Warehouse / Godown</span>
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                  <Building2 className="h-4 w-4 text-[var(--primary)] shrink-0" />
                  <span className="truncate">{challan.from_godown?.name}</span>
                </div>
              </div>
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-sm)] space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Receiver / Client</span>
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                  <User className="h-4 w-4 text-[var(--primary)] shrink-0" />
                  <span className="truncate">{challan.to_party?.company_name || challan.to_party?.name}</span>
                </div>
              </div>
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-sm)] space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Financial Summary</span>
                <div className="text-xs font-bold text-[var(--text-primary)] leading-normal">
                  <span className="font-mono">{challan.total_quantity.toLocaleString()} pcs</span>
                  <span className="mx-1 text-[var(--text-faint)]">|</span>
                  <span className="text-emerald-500 font-mono">{formatCurrency(challan.total_value)}</span>
                </div>
              </div>
            </div>

            {/* Logistics & Party Panel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* Logistics */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 sm:p-5 shadow-[var(--shadow-sm)] space-y-3">
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider border-b border-[var(--border)] pb-2 flex items-center gap-2">
                  <Truck className="h-4.5 w-4.5 text-[var(--primary)]" />
                  <span>Logistics & Transport</span>
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-[var(--text-muted)] mb-0.5">Transporter Partner:</p>
                    <p className="font-bold text-[var(--text-primary)]">{challan.transporter || "None Listed"}</p>
                  </div>
                  <div>
                    <p className="text-[var(--text-muted)] mb-0.5">LR / AWB Number:</p>
                    <p className="font-bold text-[var(--text-primary)] font-mono">{challan.lr_awb_no || "None Listed"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[var(--text-muted)] mb-1">E-Way Bill Details:</p>
                    {challan.eway_bill_no ? (
                      <div className="bg-[var(--page-bg)] border border-emerald-500/30 rounded-xl p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                            {challan.eway_bill_no}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(challan.eway_bill_no || "");
                              toast.success("E-Way Bill Number copied to clipboard");
                            }}
                            className="p-1 rounded-md hover:bg-[var(--table-row-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                            title="Copy E-Way Bill Number"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-[var(--border-light)] text-[var(--text-muted)]">
                          <div>
                            <span>Generated: </span>
                            <span className="font-semibold text-[var(--text-primary)]">
                              {challan.ewb_date ? format(new Date(challan.ewb_date), "dd MMM yyyy, hh:mm a") : "—"}
                            </span>
                          </div>
                          <div>
                            <span>Valid Till: </span>
                            <span className="font-semibold text-[var(--text-primary)]">
                              {challan.ewb_valid_till ? format(new Date(challan.ewb_valid_till), "dd MMM yyyy, hh:mm a") : "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between mt-1">
                        <p className="font-medium text-[var(--text-faint)]">Not generated yet</p>
                        {challan.challan_type === "outward" && !["cancelled"].includes(challan.status) && (
                          <button
                            type="button"
                            onClick={() => {
                              setVehicleNo(challan.transporter || "");
                              setTransporterName(challan.transporter || "Road Transport");
                              setIsEwbModalOpen(true);
                            }}
                            className="text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer"
                          >
                            + Generate Now
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Party address */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 sm:p-5 shadow-[var(--shadow-sm)] space-y-3">
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider border-b border-[var(--border)] pb-2 flex items-center gap-2">
                  <User className="h-4.5 w-4.5 text-[var(--primary)]" />
                  <span>Contact & Address Info</span>
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-[var(--text-muted)] mb-0.5">Contact Phone:</p>
                    <p className="font-bold text-[var(--text-primary)]">{challan.to_party?.phone || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-[var(--text-muted)] mb-0.5">Billing Address:</p>
                    <p className="font-bold text-[var(--text-primary)] truncate" title={challan.to_party?.billing_address}>
                      {challan.to_party?.billing_address || "N/A"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[var(--text-muted)] mb-0.5">Shipping Address:</p>
                    <p className="font-bold text-[var(--text-primary)] truncate" title={challan.to_party?.shipping_address}>
                      {challan.to_party?.shipping_address || "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Details Section */}
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-sm)] overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-[var(--border)] flex items-center gap-2">
                <Boxes className="h-5 w-5 text-[var(--text-muted)]" />
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">Challan Garment Items Breakdown</h3>
                  <p className="text-xs text-[var(--text-muted)]">Garment details of design items recorded in this challan</p>
                </div>
              </div>

              {/* ── MOBILE: Challan Item Cards ── */}
              <div className="md:hidden divide-y divide-[var(--border-light)] p-3 space-y-2.5">
                {items.length === 0 ? (
                  <p className="text-xs text-[var(--text-faint)] text-center py-6">No items in this challan.</p>
                ) : (
                  items.map((it) => (
                    <div key={it.id} className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-bold text-[var(--text-primary)] text-sm block truncate">
                            {it.design?.design_number || it.design?.code || it.design?.name}
                          </span>
                          <span className="text-xs text-[var(--text-muted)] block truncate">{it.design?.name}</span>
                          <span className="text-[10px] text-[var(--text-faint)]">{it.colour?.colour_name}</span>
                        </div>
                        <span className="font-mono font-bold text-sm text-[var(--primary)] shrink-0">
                          {formatCurrency(it.total_value)}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[var(--border-light)] text-xs">
                        <div>
                          <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase">Size</p>
                          <p className="font-bold text-[var(--text-primary)]">{it.size}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase">Quantity</p>
                          <p className="font-extrabold text-[var(--text-primary)] font-mono">{it.quantity} pcs</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase">Unit Cost</p>
                          <p className="font-mono text-[var(--text-muted)]">{formatCurrency(it.unit_cost)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* ── DESKTOP: Challan Items Table ── */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs font-semibold text-[var(--text-body)]">
                  <thead>
                    <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
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
                  <tbody className="divide-y divide-[var(--border-light)]">
                    {items.length > 0 ? (
                      items.map((it, idx) => (
                        <tr key={it.id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                          <td className="py-3.5 px-4 text-center text-xs text-[var(--text-muted)] font-bold">{idx + 1}</td>
                          <td className="py-3.5 px-4 font-bold text-[var(--text-primary)] font-mono">
                            {it.design?.design_number || it.design?.code}
                          </td>
                          <td className="py-3.5 px-4 text-[var(--text-body)]">{it.design?.name}</td>
                          <td className="py-3.5 px-4 text-[var(--text-secondary)]">{it.colour?.colour_name}</td>
                          <td className="py-3.5 px-4 text-center font-bold text-[var(--text-primary)]">{it.size}</td>
                          <td className="py-3.5 px-4 text-right font-extrabold text-[var(--text-primary)] font-mono">
                            {it.quantity.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-right text-[var(--text-muted)] font-mono">{formatCurrency(it.unit_cost)}</td>
                          <td className="py-3.5 px-4 text-right font-bold text-[var(--primary)] font-mono">
                            {formatCurrency(it.total_value)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-xs text-[var(--text-faint)]">
                          No items in this challan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Resolutions Footer Bar */}
            {!["completed", "cancelled"].includes(challan.status) && (
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 sm:p-5 shadow-[var(--shadow-sm)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Truck className="h-4.5 w-4.5 text-[var(--primary)]" />
                    <span>Challan Processing Action Bar</span>
                  </h4>
                  <p className="text-xs text-[var(--text-muted)]">Update status of this delivery document as stock is moved</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <AsyncButton
                    onClick={() => updateStatusMutation.mutateAsync("cancelled")}
                    variant="destructive"
                    className="text-xs font-bold"
                  >
                    Cancel Challan
                  </AsyncButton>
                  {challan.status === "pending" && (
                    <AsyncButton
                      onClick={() => updateStatusMutation.mutateAsync("in_transit")}
                      variant="outline"
                      className="text-xs font-bold text-blue-500 border-blue-500/30 hover:bg-blue-500/10"
                    >
                      Mark In Transit
                    </AsyncButton>
                  )}
                  {challan.challan_type === "outward" && ["pending", "in_transit"].includes(challan.status) && (
                    <AsyncButton
                      onClick={() => updateStatusMutation.mutateAsync("dispatched")}
                      variant="outline"
                      className="text-xs font-bold text-[var(--primary)] border-[var(--primary)]/30 hover:bg-[var(--primary-light)]"
                    >
                      Dispatch Stock
                    </AsyncButton>
                  )}
                  {["pending", "in_transit", "dispatched"].includes(challan.status) && (
                    <AsyncButton
                      onClick={() => updateStatusMutation.mutateAsync("received")}
                      variant="outline"
                      className="text-xs font-bold text-teal-600 border-teal-500/30 hover:bg-teal-500/10"
                    >
                      Confirm Received
                    </AsyncButton>
                  )}
                  <AsyncButton
                    onClick={() => updateStatusMutation.mutateAsync("completed")}
                    variant="primary"
                    className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Complete Challan
                  </AsyncButton>
                </div>
              </div>
            )}

            {/* Lock/Cancellation/Completed status notes */}
            {["completed", "cancelled"].includes(challan.status) && (
              <div
                className={cn(
                  "rounded-2xl p-4 flex gap-3 text-xs border shadow-[var(--shadow-sm)]",
                  challan.status === "completed"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                    : "bg-slate-500/10 border-slate-500/30 text-[var(--text-muted)]"
                )}
              >
                {challan.status === "completed" ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
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
        )}
      </PageState>

      {/* Generate E-Way Bill Modal */}
      <Modal
        open={isEwbModalOpen}
        onOpenChange={setIsEwbModalOpen}
        title="Generate E-Way Bill (NIC / IRIS Portal)"
        description={`Generate official government E-Way Bill for outward delivery challan #${challan?.challan_number}`}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4 pt-2 text-left">
          <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-3 text-xs text-[var(--text-muted)] flex items-center justify-between">
            <span>
              Consignee:{" "}
              <strong className="text-[var(--text-primary)]">
                {challan?.to_party?.company_name || challan?.to_party?.name || "Recipient"}
              </strong>
            </span>
            <span>
              Total Value:{" "}
              <strong className="text-emerald-500 font-mono">
                {formatCurrency(challan?.total_value || 0)}
              </strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                Vehicle Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                placeholder="e.g. MH01AB1234"
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors uppercase font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                Transporter Name
              </label>
              <input
                type="text"
                value={transporterName}
                onChange={(e) => setTransporterName(e.target.value)}
                placeholder="e.g. VRL Logistics"
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                Transporter ID / GSTIN
              </label>
              <input
                type="text"
                value={transporterId}
                onChange={(e) => setTransporterId(e.target.value.toUpperCase())}
                placeholder="Transporter GSTIN"
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors uppercase font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                Approx. Distance (KM) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={distanceKm}
                onChange={(e) => setDistanceKm(Number(e.target.value))}
                min={1}
                max={4000}
                placeholder="50"
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors font-mono"
              />
            </div>
          </div>

          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
            Note: As per GST E-Way Bill regulations, movement of goods exceeding ₹50,000 requires Part A &amp; Part B generation before transit begins.
          </p>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-light)]">
            <button
              type="button"
              onClick={() => setIsEwbModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--table-row-hover)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <AsyncButton
              onClick={async () => {
                if (!vehicleNo.trim()) {
                  toast.error("Please enter a vehicle number for Part-B transit.");
                  return;
                }
                await generateEwbMutation.mutateAsync({
                  vehicle_no: vehicleNo.trim(),
                  transporter_name: transporterName.trim(),
                  transporter_id: transporterId.trim() || undefined,
                  distance_km: distanceKm || 50,
                });
              }}
              variant="primary"
              className="text-xs font-bold"
            >
              Generate E-Way Bill
            </AsyncButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
