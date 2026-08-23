"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Package,
  Scissors,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  ExternalLink,
  Tag,
  AlertTriangle,
  History,
  CheckCircle2,
} from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";
import ProgressBar from "@/components/shared/ProgressBar";

interface RollPassportModalProps {
  rollId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RollTimelineEvent {
  id: string;
  type: "purchase_inward" | "lot_allocation" | "direct_sale" | "cutting_return" | "purchase_return" | "adjustment";
  date: string;
  title: string;
  description: string;
  quantityDelta: number;
  runningBalance?: number;
  referenceId?: string;
  referenceType?: string;
  referenceLabel?: string;
  metadata?: Record<string, any>;
}

interface RollPassportData {
  roll: {
    id: string;
    roll_number: string;
    shade: string | null;
    width: number | null;
    weight_value: number | null;
    weight_unit: string | null;
    comment: string | null;
    initial_meters: number;
    remaining_meters: number;
    consumed_meters: number;
    utilization_pct: number;
    status: "in_stock" | "partially_used" | "exhausted";
    rate: number;
    material: {
      id: string;
      name: string;
      unit: string;
      category: string;
    };
    purchase: {
      id: string;
      invoice_no: string | null;
      invoice_date: string | null;
      supplier_name: string | null;
      supplier_phone: string | null;
      godown_name: string | null;
      godown_id: string | null;
    };
    allocations_count: number;
    sales_count: number;
  };
  timeline: RollTimelineEvent[];
}

export function RollPassportModal({ rollId, open, onOpenChange }: RollPassportModalProps) {
  const router = useRouter();

  const { data, isLoading, error, refetch } = useQuery<RollPassportData>({
    queryKey: ["roll-passport", rollId],
    queryFn: async () => {
      if (!rollId) throw new Error("No roll selected");
      const res = await fetch(`/api/raw-materials/rolls/${rollId}/timeline`);
      if (!res.ok) throw new Error("Failed to fetch roll lifecycle data");
      return res.json();
    },
    enabled: !!rollId && open,
    staleTime: 30_000,
  });

  const roll = data?.roll;
  const timeline = data?.timeline || [];

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "in_stock":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            In Stock (Available)
          </span>
        );
      case "partially_used":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Partially Allocated
          </span>
        );
      case "exhausted":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-500/10 text-[var(--text-muted)] border border-[var(--border)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]" />
            Fully Consumed / 0m
          </span>
        );
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case "purchase_inward":
        return (
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 flex items-center justify-center shrink-0 shadow-sm">
            <Package size={16} />
          </div>
        );
      case "lot_allocation":
        return (
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/25 flex items-center justify-center shrink-0 shadow-sm">
            <Scissors size={16} />
          </div>
        );
      case "direct_sale":
        return (
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/25 flex items-center justify-center shrink-0 shadow-sm">
            <ArrowUpRight size={16} />
          </div>
        );
      case "purchase_return":
        return (
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/25 flex items-center justify-center shrink-0 shadow-sm">
            <ArrowUpRight size={16} />
          </div>
        );
      case "cutting_return":
      case "sales_return":
        return (
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 flex items-center justify-center shrink-0 shadow-sm">
            <ArrowDownLeft size={16} />
          </div>
        );
      default:
        return (
          <div className="w-9 h-9 rounded-xl bg-slate-500/10 text-[var(--text-muted)] border border-[var(--border)] flex items-center justify-center shrink-0 shadow-sm">
            <History size={16} />
          </div>
        );
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={roll ? `Roll Passport — ${roll.roll_number}` : "Roll Lifecycle Passport"}
      maxWidth="max-w-2xl"
    >
      {isLoading ? (
        <div className="py-16 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[var(--text-muted)]">Loading roll audit trail & lifecycle...</p>
        </div>
      ) : error || !roll ? (
        <div className="py-12 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <p className="text-sm font-bold text-[var(--text-primary)]">Unable to load roll passport</p>
          <p className="text-xs text-[var(--text-muted)]">{error?.toString() || "Roll data not found"}</p>
          <button
            onClick={() => refetch()}
            className="px-3 py-1.5 bg-[var(--primary-light)] text-[var(--primary)] rounded-lg text-xs font-bold cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-5 text-[var(--text-primary)]">
          {/* Header Summary Banner */}
          <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-2xl p-4 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-base font-black text-[var(--primary)] bg-[var(--card-bg)] px-3 py-1.5 rounded-xl border border-[var(--border)] shadow-sm">
                  {roll.roll_number}
                </span>
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">{roll.material.name}</h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
                    {roll.shade && (
                      <span className="flex items-center gap-1 font-semibold text-[var(--text-secondary)]">
                        <Tag size={12} className="text-[var(--text-faint)]" /> Shade: {roll.shade}
                      </span>
                    )}
                    {roll.purchase.godown_name && (
                      <span className="flex items-center gap-1 font-semibold text-[var(--text-secondary)]">
                        <Building2 size={12} className="text-[var(--text-faint)]" /> {roll.purchase.godown_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>{getStatusBadge(roll.status)}</div>
            </div>

            {/* Consumption Progress Gauge */}
            <div className="space-y-1.5 pt-2.5 border-t border-[var(--border)]">
              <div className="flex justify-between text-xs font-bold select-none">
                <span className="text-[var(--text-muted)] uppercase tracking-wider text-[10px]">
                  Fabric Consumption
                </span>
                <span className="text-[var(--text-primary)] font-mono">
                  {roll.consumed_meters.toLocaleString()} / {roll.initial_meters.toLocaleString()}{" "}
                  {roll.material.unit} ({roll.utilization_pct}%)
                </span>
              </div>
              <ProgressBar value={roll.consumed_meters} total={roll.initial_meters} showText={false} barHeight="h-2" />
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3 space-y-0.5">
              <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider">
                Initial Received
              </span>
              <span className="text-sm font-black font-mono text-[var(--text-primary)]">
                {roll.initial_meters.toLocaleString()} <span className="text-[10px] font-normal text-[var(--text-muted)]">{roll.material.unit}</span>
              </span>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3 space-y-0.5">
              <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider">
                Allocated / Used
              </span>
              <span className="text-sm font-black font-mono text-blue-500">
                {roll.consumed_meters.toLocaleString()} <span className="text-[10px] font-normal text-[var(--text-muted)]">{roll.material.unit}</span>
              </span>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3 space-y-0.5">
              <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider">
                Remaining Stock
              </span>
              <span className={`text-sm font-black font-mono ${roll.remaining_meters > 0 ? "text-emerald-500" : "text-[var(--text-muted)]"}`}>
                {roll.remaining_meters.toLocaleString()} <span className="text-[10px] font-normal text-[var(--text-muted)]">{roll.material.unit}</span>
              </span>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3 space-y-0.5">
              <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider">
                Unit Cost
              </span>
              <span className="text-sm font-black font-mono text-[var(--primary)]">
                ₹{roll.rate.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Chronological Audit Trail Timeline */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <History size={14} className="text-[var(--primary)]" />
                Roll Lifecycle & Audit Trail ({timeline.length} Events)
              </h4>
            </div>

            <div className="space-y-3">
              {timeline.map((event, idx) => {
                const isLast = idx === timeline.length - 1;
                return (
                  <div key={event.id || idx} className="flex items-start gap-3">
                    {/* Left Column: Icon Node + Vertical Line Connector */}
                    <div className="flex flex-col items-center shrink-0 self-stretch pt-0.5">
                      {getEventIcon(event.type)}
                      {!isLast && <div className="w-0.5 flex-1 bg-[var(--border)] my-1 min-h-[24px]" />}
                    </div>

                    {/* Right Column: Event Content Card */}
                    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 flex-1 shadow-sm space-y-2 hover:border-[var(--primary)]/40 transition-colors">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          {event.title}
                        </span>
                        <span className="text-[11px] font-mono text-[var(--text-muted)]">
                          {formatDate(event.date)}
                        </span>
                      </div>

                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {event.description}
                      </p>

                      <div className="flex flex-wrap items-center justify-between pt-1.5 border-t border-[var(--border)] text-[11px]">
                        <div className="flex items-center gap-2">
                          {event.referenceType === "production_lot" && event.referenceId && (
                            <Link
                              href={`/production/lots/${event.referenceId}`}
                              onClick={() => onOpenChange(false)}
                              className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline font-semibold"
                            >
                              <span>Open Lot Profile</span>
                              <ExternalLink size={11} />
                            </Link>
                          )}
                          {event.referenceType === "purchase" && event.referenceId && (
                            <Link
                              href={`/purchases`}
                              onClick={() => onOpenChange(false)}
                              className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline font-semibold"
                            >
                              <span>Purchase Details</span>
                              <ExternalLink size={11} />
                            </Link>
                          )}
                          {event.referenceType === "sale_bill" && event.referenceId && (
                            <Link
                              href={`/sales/bills`}
                              onClick={() => onOpenChange(false)}
                              className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline font-semibold"
                            >
                              <span>Sale Bill</span>
                              <ExternalLink size={11} />
                            </Link>
                          )}
                        </div>

                        <div className="flex items-center gap-2 font-mono ml-auto">
                          <span
                            className={`font-bold ${
                              event.quantityDelta > 0 ? "text-emerald-500" : "text-rose-500"
                            }`}
                          >
                            {event.quantityDelta > 0 ? "+" : ""}
                            {event.quantityDelta.toLocaleString()} {roll.material.unit}
                          </span>
                          {event.runningBalance !== undefined && (
                            <span className="text-[var(--text-muted)] text-[10px]">
                              (Bal: {event.runningBalance.toLocaleString()} {roll.material.unit})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
