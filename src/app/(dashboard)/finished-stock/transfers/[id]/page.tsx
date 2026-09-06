"use client";

import React from "react";
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
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatCurrency } from "@/lib/utils";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";

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
  const { id } = params;
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<{
    transfer: Transfer;
    items: TransferItem[];
  }>({
    queryKey: ["stock-transfer", id],
    queryFn: async () => {
      const res = await fetch(`/api/finished-stock/transfers/${id}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to load transfer details");
      }
      return res.json();
    },
    staleTime: 30_000,
  });

  const transfer = data?.transfer || null;
  const items = data?.items || [];

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: "in_transit" | "completed" | "cancelled") => {
      const res = await fetch(`/api/finished-stock/transfers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to update status");
      return resData;
    },
    onSuccess: (resData, newStatus) => {
      toast.success(`Transfer status updated to ${newStatus}`);
      queryClient.invalidateQueries({ queryKey: ["stock-transfer", id] });
      queryClient.invalidateQueries({ queryKey: ["finished-stock"] });
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || "Could not update status");
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

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Breadcrumb and Refresh */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
          <Link href="/finished-stock" className="hover:text-[var(--primary)] transition-colors">
            Finished Stock
          </Link>
          <span>/</span>
          <Link href="/finished-stock/operations?tab=transfers" className="hover:text-[var(--primary)] transition-colors">
            Transfers
          </Link>
          <span>/</span>
          <span className="text-[var(--text-primary)] font-mono">{transfer?.transfer_number || "Detail"}</span>
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
      <div className="flex items-center gap-3">
        <Link
          href="/finished-stock/operations?tab=transfers"
          className="p-2 bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] border border-[var(--border)] rounded-xl transition-all cursor-pointer text-[var(--text-muted)] active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight truncate">
            {transfer?.transfer_number || "Stock Transfer"}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] truncate">
            Reason: <strong className="text-[var(--text-primary)]">{transfer?.reason || "Stock Rebalance"}</strong>
          </p>
        </div>
      </div>

      <PageState
        isLoading={isLoading}
        isError={!!error}
        error={error instanceof Error ? error.message : "Failed to load transfer"}
        onRetry={refetch}
        isEmpty={!transfer && !isLoading}
        emptyTitle="Transfer Not Found"
        emptyDescription="The requested transfer shipment could not be located."
        skeletonVariant="card"
        skeletonCount={4}
      >
        {transfer && (
          <div className="space-y-4 sm:space-y-6">
            {/* Quick Summary Panels */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-sm)] space-y-1.5">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Status</span>
                <div>{renderStatusBadge(transfer.status)}</div>
              </div>
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-sm)] space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Route</span>
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                  <Building2 className="h-4 w-4 text-[var(--primary)] shrink-0" />
                  <span className="truncate">{transfer.from_godown?.name}</span>
                  <ArrowRight className="h-3 w-3 text-[var(--text-faint)] shrink-0" />
                  <span className="truncate">{transfer.to_godown?.name}</span>
                </div>
              </div>
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-sm)] space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Total Quantity</span>
                <h4 className="text-base font-extrabold text-[var(--text-primary)] font-mono">{transfer.total_quantity} pcs</h4>
              </div>
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-sm)] space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Total Value</span>
                <h4 className="text-base font-extrabold text-emerald-500 font-mono">{formatCurrency(transfer.total_value)}</h4>
              </div>
            </div>

            {/* Main Details Section */}
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-sm)] overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-[var(--border)] flex items-center gap-2">
                <Boxes className="h-5 w-5 text-[var(--text-muted)]" />
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">Stock Movements Breakdown</h3>
                  <p className="text-xs text-[var(--text-muted)]">Sizing details of garment rows moved in this transfer</p>
                </div>
              </div>

              {/* ── MOBILE: Transfer Item Cards ── */}
              <div className="md:hidden divide-y divide-[var(--border-light)] p-3 space-y-2.5">
                {items.length === 0 ? (
                  <p className="text-xs text-[var(--text-faint)] text-center py-6">No items in this transfer.</p>
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

              {/* ── DESKTOP: Transfer Items Table ── */}
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
                          No items in this transfer.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Resolutions Footer Bar */}
            {(transfer.status === "pending" || transfer.status === "in_transit") && (
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 sm:p-5 shadow-[var(--shadow-sm)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Truck className="h-4.5 w-4.5 text-[var(--primary)]" />
                    <span>Pending Transfer Resolution Action</span>
                  </h4>
                  <p className="text-xs text-[var(--text-muted)]">Update status of this stock shipment as it progresses</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <AsyncButton
                    onClick={() => updateStatusMutation.mutateAsync("cancelled")}
                    variant="destructive"
                    className="text-xs font-bold"
                  >
                    Cancel Transfer
                  </AsyncButton>
                  {transfer.status === "pending" && (
                    <AsyncButton
                      onClick={() => updateStatusMutation.mutateAsync("in_transit")}
                      variant="outline"
                      className="text-xs font-bold text-blue-500 border-blue-500/30 hover:bg-blue-500/10"
                    >
                      Mark In Transit
                    </AsyncButton>
                  )}
                  <AsyncButton
                    onClick={() => updateStatusMutation.mutateAsync("completed")}
                    variant="primary"
                    className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Mark Completed
                  </AsyncButton>
                </div>
              </div>
            )}

            {/* Cancellation/Completed indicator info */}
            {(transfer.status === "cancelled" || transfer.status === "completed") && (
              <div
                className={cn(
                  "rounded-2xl p-4 flex gap-3 text-xs border shadow-[var(--shadow-sm)]",
                  transfer.status === "completed"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                    : "bg-slate-500/10 border-slate-500/30 text-[var(--text-muted)]"
                )}
              >
                {transfer.status === "completed" ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
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
        )}
      </PageState>
    </div>
  );
}
