"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Truck,
  RotateCw,
  Search,
  ArrowLeft,
  Info,
  ShieldAlert,
  HelpCircle,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { IRP_ERROR_CODE_MAP } from "@/lib/einvoice/constants";

// Living Error Handling Matrix Data (Section 13)
const LIVING_ERROR_MATRIX = [
  {
    code: "2150",
    meaning: "Duplicate IRN: Invoice number already registered in financial year",
    friendly: "This invoice number has already been registered on the GST portal.",
    caughtLocally: true,
    rule: "Local database uniqueness check",
  },
  {
    code: "2174",
    meaning: "Invalid Supplier GSTIN",
    friendly: "Your company GSTIN in Settings > Company Profile is invalid or malformed.",
    caughtLocally: true,
    rule: "GSTIN Mod-36 Luhn check",
  },
  {
    code: "2175",
    meaning: "Invalid Recipient (Buyer) GSTIN",
    friendly: "Customer GSTIN is invalid or failed checksum validation.",
    caughtLocally: true,
    rule: "GSTIN Mod-36 Luhn check",
  },
  {
    code: "2176",
    meaning: "Recipient GSTIN cancelled / inactive on portal",
    friendly: "The customer's GSTIN is marked inactive or cancelled on the GST Portal.",
    caughtLocally: false,
    rule: "Requires live GST portal lookup",
  },
  {
    code: "2180",
    meaning: "Invalid Place of Supply (POS) State Code",
    friendly: "Selected Place of Supply does not match any valid Indian state or UT.",
    caughtLocally: true,
    rule: "State code master lookup",
  },
  {
    code: "2181",
    meaning: "Supplier PIN code does not match State",
    friendly: "Company PIN code does not correspond to the company state.",
    caughtLocally: true,
    rule: "PIN vs State prefix check",
  },
  {
    code: "2182",
    meaning: "Buyer PIN code does not match State",
    friendly: "Buyer PIN code does not correspond to the recipient state.",
    caughtLocally: true,
    rule: "PIN vs State prefix check",
  },
  {
    code: "2201",
    meaning: "Invoice date in future",
    friendly: "Invoice date cannot be in the future.",
    caughtLocally: true,
    rule: "Strict date range validator",
  },
  {
    code: "2202",
    meaning: "Invoice older than 30 days for AATO >= ₹10 Cr",
    friendly: "Invoices for businesses with turnover >= ₹10 Cr must be reported within 30 days.",
    caughtLocally: true,
    rule: "30-day cutoff evaluation",
  },
  {
    code: "2203",
    meaning: "Invalid document number format",
    friendly: "Invoice number must be <= 16 characters containing only alphanumeric, / or -.",
    caughtLocally: true,
    rule: "Invoice number regex check",
  },
  {
    code: "2250",
    meaning: "Missing or empty HSN code on line item",
    friendly: "One or more line items is missing an HSN code.",
    caughtLocally: true,
    rule: "Item-level HSN presence check",
  },
  {
    code: "2251",
    meaning: "HSN code < 6 digits for turnover > ₹5 Cr",
    friendly: "HSN code must have at least 6 digits for businesses with turnover exceeding ₹5 Cr.",
    caughtLocally: true,
    rule: "Turnover bracket HSN length rule",
  },
  {
    code: "2252",
    meaning: "HSN code < 4 digits for turnover <= ₹5 Cr",
    friendly: "HSN code must have at least 4 digits.",
    caughtLocally: true,
    rule: "Minimum 4-digit HSN check",
  },
  {
    code: "2260",
    meaning: "Tax calculation mismatch",
    friendly: "Tax amount does not equal taxable value multiplied by tax rate.",
    caughtLocally: true,
    rule: "Tax reconciliation with ₹1.00 tolerance",
  },
  {
    code: "2261",
    meaning: "Intra-state invoice charging IGST",
    friendly: "Intra-state sales must charge equal CGST and SGST, not IGST.",
    caughtLocally: true,
    rule: "Place of Supply tax parity rule",
  },
  {
    code: "2262",
    meaning: "Inter-state invoice charging CGST/SGST",
    friendly: "Inter-state sales must charge IGST, not CGST or SGST.",
    caughtLocally: true,
    rule: "Place of Supply tax parity rule",
  },
  {
    code: "2300",
    meaning: "24-Hour cancellation window expired",
    friendly: "E-invoices can only be cancelled on the IRP within 24 hours of generation.",
    caughtLocally: true,
    rule: "Client-side cancellation timer check",
  },
  {
    code: "2302",
    meaning: "Active E-Way bill linked to IRN",
    friendly: "The linked E-Way Bill must be cancelled before cancelling this e-invoice.",
    caughtLocally: true,
    rule: "Linked E-Way Bill check",
  },
];

export default function EInvoiceOperationsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["einvoice-operations-stats"],
    queryFn: async () => {
      const res = await fetch("/api/settings/einvoice-operations");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load operations metrics");
      }
      return res.json();
    },
    refetchInterval: 30_000, // Refresh every 30s for live ops monitoring
  });

  const reconcileMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/cron/einvoice-reconcile", { method: "POST" });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Reconciliation failed");
      return resData;
    },
    onSuccess: (resData) => {
      toast.success(resData.message || "Reconciliation run completed successfully!");
      queryClient.invalidateQueries({ queryKey: ["einvoice-operations-stats"] });
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to execute reconciliation");
    },
  });

  const metrics = data?.metrics || {
    registered: 0,
    pending: 0,
    failed: 0,
    cancelled: 0,
    totalWithIrn: 0,
    activeEwbs: 0,
    failureRate: 0,
    successRate: 100,
  };

  const health = data?.health || {
    status: "healthy",
    message: "All Systems Operational",
  };

  const recentErrors = data?.recentErrors || [];

  const filteredMatrix = LIVING_ERROR_MATRIX.filter(
    (item) =>
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.meaning.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.friendly.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <PageState
      isLoading={isLoading}
      isError={!!error}
      error={error ? (error as Error).message : undefined}
      onRetry={refetch}
      skeletonVariant="stats"
      skeletonCount={4}
    >
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 text-left">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
            <Link href="/settings" className="hover:text-[var(--primary)] transition-colors">
              Settings
            </Link>
            <span>/</span>
            <span className="text-[var(--text-primary)]">E-Invoice Operations</span>
          </div>

          <div className="flex items-center gap-2">
            <AsyncButton
              onClick={() => reconcileMutation.mutateAsync()}
              variant="outline"
              className="text-xs font-bold text-[var(--primary)] border-[var(--primary)]/30 hover:bg-[var(--primary-light)]"
            >
              <RotateCw className="size-3.5 mr-1.5" />
              <span>Run Nightly Reconciliation Now</span>
            </AsyncButton>
          </div>
        </div>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="p-2 bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] border border-[var(--border)] rounded-xl transition-all cursor-pointer text-[var(--text-muted)] active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                E-Invoice Operations &amp; Reconciliation Console
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-muted)]">
                Live statutory monitoring, timeout reconciliation, failure spike detection, and living IRP error matrix
              </p>
            </div>
          </div>
        </div>

        {/* Health & Anomaly Alert Banner (Requirement 12) */}
        <div
          className={cn(
            "p-4 rounded-2xl border shadow-[var(--shadow-sm)] flex items-start gap-3.5 transition-all",
            health.status === "healthy" && "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
            health.status === "data_quality_spike" && "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300",
            health.status === "irp_outage" && "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
          )}
        >
          {health.status === "healthy" && <CheckCircle2 className="size-5 shrink-0 mt-0.5 text-emerald-500" />}
          {health.status === "data_quality_spike" && <AlertTriangle className="size-5 shrink-0 mt-0.5 text-amber-500" />}
          {health.status === "irp_outage" && <ShieldAlert className="size-5 shrink-0 mt-0.5 text-rose-500" />}
          <div className="space-y-0.5">
            <div className="text-xs font-bold uppercase tracking-wider">
              {health.status === "healthy" && "Status: All Systems Operational"}
              {health.status === "data_quality_spike" && "Alert: High Failure Rate Detected (Data Quality Alert)"}
              {health.status === "irp_outage" && "Alert: Potential Government IRP Outage / Gateway Failure"}
            </div>
            <p className="text-xs leading-relaxed opacity-90">{health.message}</p>
          </div>
        </div>

        {/* KPI Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-sm)] space-y-1">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
              Registered IRNs
            </span>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {metrics.registered.toLocaleString()}
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">Legally signed &amp; active</span>
          </div>

          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-sm)] space-y-1">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
              Pending Reconcile
            </span>
            <div className="text-2xl font-bold text-amber-500 font-mono">
              {metrics.pending.toLocaleString()}
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">&gt;30m awaiting status</span>
          </div>

          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-sm)] space-y-1">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
              Failed / Blocked
            </span>
            <div className="text-2xl font-bold text-rose-500 font-mono">
              {metrics.failed.toLocaleString()}
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">Requires user correction</span>
          </div>

          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-sm)] space-y-1">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
              Active E-Way Bills
            </span>
            <div className="text-2xl font-bold text-[var(--primary)] font-mono">
              {metrics.activeEwbs.toLocaleString()}
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">Invoices + Challans</span>
          </div>

          <div className="col-span-2 lg:col-span-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-sm)] space-y-1">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
              Success Rate
            </span>
            <div className="text-2xl font-bold text-[var(--text-primary)] font-mono">
              {metrics.successRate}%
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">
              {metrics.failureRate > 0 ? `${metrics.failureRate}% failure rate` : "Zero failure rate"}
            </span>
          </div>
        </div>

        {/* Recent Error Audit Logs Table */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-[var(--primary)]" />
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Live Operations Exception Log (<code className="font-mono text-xs">einvoice_error_log</code>)
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Continuous audit trail of validation exceptions and IRP error payloads
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs font-semibold text-[var(--text-body)]">
              <thead>
                <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Error Code</th>
                  <th className="py-3 px-4">Message</th>
                  <th className="py-3 px-4">Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-light)]">
                {recentErrors.length > 0 ? (
                  recentErrors.map((err: any) => (
                    <tr key={err.id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                      <td className="py-3 px-4 text-xs font-mono text-[var(--text-muted)] whitespace-nowrap">
                        {err.occurred_at ? format(new Date(err.occurred_at), "dd MMM yyyy, HH:mm:ss") : "—"}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[var(--text-primary)]">
                        {err.invoice_id?.substring(0, 8) || "e-invoice"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-xs text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                          {err.irp_error_code || "UNKNOWN"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-[var(--text-body)] max-w-md truncate" title={err.friendly_message}>
                        {err.friendly_message || "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--page-bg)] border border-[var(--border)] text-[var(--text-muted)]">
                          {err.raw_response?.includes("local") ? "Pre-Validation Gap" : "IRP Response"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-[var(--text-faint)]">
                      Zero operational errors recorded. All generation attempts have completed cleanly.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 13: Living Error Handling Reference Matrix */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="size-4 text-[var(--primary)]" />
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Section 13 — Living IRP Error Handling Reference
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Government IRP error codes mapped to user-friendly messages and Phase 2 local validation status
                </p>
              </div>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 size-3.5 text-[var(--text-faint)]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search error code or rule..."
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg pl-8 pr-3 h-8 text-xs transition-colors"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs font-semibold text-[var(--text-body)]">
              <thead>
                <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  <th className="py-3 px-4 w-24">IRP Code</th>
                  <th className="py-3 px-4">Government Meaning</th>
                  <th className="py-3 px-4">TAS Friendly Message</th>
                  <th className="py-3 px-4 text-center">Caught by Local Validation?</th>
                  <th className="py-3 px-4">Validation Engine Rule</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-light)]">
                {filteredMatrix.map((item) => (
                  <tr key={item.code} className="hover:bg-[var(--table-row-hover)] transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-xs text-[var(--primary)]">
                      {item.code}
                    </td>
                    <td className="py-3 px-4 text-xs text-[var(--text-primary)]">
                      {item.meaning}
                    </td>
                    <td className="py-3 px-4 text-xs text-[var(--text-muted)]">
                      {item.friendly}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.caughtLocally ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="size-3" /> Yes (Local)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                          <Info className="size-3" /> Live IRP Only
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[11px] font-mono text-[var(--text-muted)]">
                      {item.rule}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageState>
  );
}
