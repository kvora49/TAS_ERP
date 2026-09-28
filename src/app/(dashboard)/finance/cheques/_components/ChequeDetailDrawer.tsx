"use client";

import React from "react";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  FileText,
  Landmark,
  User,
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  Printer,
  Calendar,
  CreditCard,
  Building2,
  Receipt
} from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { ChequeLeafCard } from "./ChequeLeafCard";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Allocation {
  billId?: string;
  billNumber?: string;
  billType?: string;
  allocatedAmount?: number;
  totalAmount?: number;
}

interface ChequeDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cheque: any;
  onDeposit?: (cheque: any) => void;
  onClear?: (cheque: any) => void;
  onBounce?: (cheque: any) => void;
  onCancel?: (cheque: any) => void;
  onDelete?: (cheque: any) => void;
}

export function ChequeDetailDrawer({
  open,
  onOpenChange,
  cheque,
  onDeposit,
  onClear,
  onBounce,
  onCancel,
  onDelete,
}: ChequeDetailDrawerProps) {
  if (!cheque) return null;

  const isReceived = cheque.direction === "received";
  const allocations: Allocation[] = Array.isArray(cheque.allocations) ? cheque.allocations : [];
  const isBillWise = cheque.settlement_type === "bill_wise" && allocations.length > 0;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Cheque #${cheque.cheque_number}`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6 pt-2 text-xs">
        {/* Visual Realistic Cheque Card */}
        <ChequeLeafCard cheque={cheque} />

        {/* Lifecycle Stepper */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--page-bg)] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Lifecycle & Banking Audit Trail
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              cheque.status === "cleared"
                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
                : cheque.status === "deposited"
                ? "bg-sky-500/10 text-sky-500 border border-sky-500/30"
                : cheque.status === "bounced"
                ? "bg-red-500/10 text-red-500 border border-red-500/30"
                : cheque.status === "cancelled"
                ? "bg-slate-500/10 text-slate-400 border border-slate-500/30"
                : "bg-amber-500/10 text-amber-500 border border-amber-500/30"
            }`}>
              {cheque.status}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Step 1: Booked / In Hand */}
            <div className="p-3 rounded-xl border border-[var(--border-light)] bg-[var(--card-bg)] space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>1. {isReceived ? "Received In Hand" : "Cheque Issued"}</span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                Date: <strong className="text-[var(--text-primary)]">{formatDate(cheque.cheque_date)}</strong>
              </p>
              {cheque.due_date && (
                <p className="text-[11px] text-[var(--text-muted)]">
                  PDC Due: <strong className="text-amber-600 dark:text-amber-400">{formatDate(cheque.due_date)}</strong>
                </p>
              )}
            </div>

            {/* Step 2: Deposited */}
            <div className={`p-3 rounded-xl border ${
              cheque.deposited_date || cheque.status === "deposited" || cheque.status === "cleared"
                ? "border-[var(--border-light)] bg-[var(--card-bg)] text-sky-600 dark:text-sky-400"
                : "border-dashed border-[var(--border)] bg-[var(--page-bg)] text-[var(--text-muted)] opacity-60"
            } space-y-1`}>
              <div className="flex items-center gap-1.5 font-bold">
                {cheque.deposited_date || cheque.status === "deposited" || cheque.status === "cleared" ? (
                  <CheckCircle2 className="w-4 h-4 text-sky-500" />
                ) : (
                  <Clock className="w-4 h-4" />
                )}
                <span>2. {isReceived ? "Deposited in Bank" : "Deposited / Presented"}</span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                {cheque.deposited_date ? (
                  <>Date: <strong className="text-[var(--text-primary)]">{formatDate(cheque.deposited_date)}</strong></>
                ) : (
                  <span>{isReceived ? "Awaiting bank deposit" : "Awaiting presentation"}</span>
                )}
              </p>
              {cheque.received_account && (
                <p className="text-[10px] text-[var(--text-muted)] truncate">
                  A/C: {cheque.received_account.name || cheque.received_account.bank_name}
                </p>
              )}
            </div>

            {/* Step 3: Cleared or Bounced */}
            <div className={`p-3 rounded-xl border ${
              cheque.status === "cleared"
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                : cheque.status === "bounced"
                ? "border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400"
                : "border-dashed border-[var(--border)] bg-[var(--page-bg)] text-[var(--text-muted)] opacity-60"
            } space-y-1`}>
              <div className="flex items-center gap-1.5 font-bold">
                {cheque.status === "cleared" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : cheque.status === "bounced" ? (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                ) : (
                  <Clock className="w-4 h-4" />
                )}
                <span>3. {cheque.status === "bounced" ? "Dishonored (Bounced)" : "Realized / Cleared"}</span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                {cheque.cleared_date ? (
                  <>Cleared: <strong className="text-[var(--text-primary)]">{formatDate(cheque.cleared_date)}</strong></>
                ) : cheque.status === "bounced" ? (
                  <span className="text-red-500 font-semibold">{cheque.bounce_reason || "Dishonored by Bank"}</span>
                ) : (
                  <span>Pending clearance</span>
                )}
              </p>
              {cheque.status === "bounced" && Number(cheque.bounce_charges || 0) > 0 && (
                <p className="text-[10px] text-red-500 font-bold">
                  Penalty: {formatCurrency(cheque.bounce_charges)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Settlement & Bill Allocations */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Settlement Allocation Breakdown
            </span>
            <span className="text-[11px] font-bold text-[var(--primary)] bg-[var(--primary-light)] px-2.5 py-0.5 rounded-full">
              {isBillWise ? "Bill-Wise Allocation" : "On-Account / Advance Ledger Settlement"}
            </span>
          </div>

          {isBillWise ? (
            <div className="overflow-x-auto rounded-xl border border-[var(--border-light)]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border-light)] text-[var(--text-muted)] font-bold">
                    <th className="p-3">Bill / Invoice #</th>
                    <th className="p-3">Bill Type</th>
                    <th className="p-3 text-right">Total Bill (₹)</th>
                    <th className="p-3 text-right">Allocated Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-light)]">
                  {allocations.map((alloc, idx) => (
                    <tr key={idx} className="hover:bg-[var(--table-row-hover)]">
                      <td className="p-3 font-bold text-[var(--text-primary)] font-mono">
                        {alloc.billNumber || alloc.billId || "—"}
                      </td>
                      <td className="p-3 capitalize font-semibold text-[var(--text-secondary)]">
                        {(alloc.billType || "bill").replace(/_/g, " ")}
                      </td>
                      <td className="p-3 text-right font-mono text-[var(--text-muted)]">
                        {alloc.totalAmount ? formatCurrency(alloc.totalAmount) : "—"}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(alloc.allocatedAmount || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl border border-[var(--border-light)] bg-[var(--page-bg)] flex items-start gap-2.5">
              <Receipt className="w-4 h-4 text-[var(--primary)] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-[var(--text-primary)] text-xs">
                  On-Account Payment / Advance
                </span>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  This cheque is not earmarked against specific invoice numbers. When cleared, it directly credits (or debits) the party ledger balance as an advance payment.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Banking & Ledger Realization Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Settlement Bank Account
            </span>
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-[var(--primary)]" />
              <span className="font-bold text-[var(--text-primary)] text-xs">
                {cheque.received_account?.name || cheque.received_account?.bank_name || "Company Safe / In Hand"}
              </span>
            </div>
            {cheque.received_account?.account_number && (
              <p className="text-[11px] font-mono text-[var(--text-muted)]">
                A/C: {cheque.received_account.account_number}
              </p>
            )}
          </div>

          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Financial Voucher Linkage
            </span>
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-bold text-[var(--text-primary)] text-xs">
                {cheque.payment?.payment_number ? `Voucher: ${cheque.payment.payment_number}` : "Auto-created on clearance"}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              {cheque.status === "cleared" ? "Reflected in Party Ledger Statement" : "Contingent / Not realized in bank yet"}
            </p>
          </div>
        </div>

        {/* Remarks / Memo */}
        {cheque.remarks && (
          <div className="p-3 rounded-xl border border-[var(--border-light)] bg-[var(--page-bg)] space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Internal Remarks / Notes
            </span>
            <p className="text-xs text-[var(--text-secondary)] italic">
              {cheque.remarks}
            </p>
          </div>
        )}

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 h-9 rounded-xl border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-xs font-bold text-[var(--text-secondary)] flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>Print Advice Slip</span>
          </button>

          <div className="flex items-center gap-2">
            {cheque.status === "pending" && onDeposit && (
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onDeposit(cheque);
                }}
                className="px-3.5 h-9 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/30 text-xs font-bold transition-all cursor-pointer"
              >
                {isReceived ? "Deposit to Bank" : "Mark as Deposited"}
              </button>
            )}

            {(cheque.status === "pending" || cheque.status === "deposited") && onClear && (
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onClear(cheque);
                }}
                className="px-4 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                Clear Cheque
              </button>
            )}

            {(cheque.status === "pending" || cheque.status === "deposited" || cheque.status === "cleared") && onBounce && (
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onBounce(cheque);
                }}
                className="px-3.5 h-9 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 text-xs font-bold transition-all cursor-pointer"
              >
                Record Bounce
              </button>
            )}

            {cheque.status === "pending" && onCancel && (
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onCancel(cheque);
                }}
                className="px-3.5 h-9 rounded-xl border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-xs font-bold text-[var(--text-muted)] transition-all cursor-pointer"
              >
                Cancel Cheque
              </button>
            )}

            {(cheque.status === "cancelled" || cheque.status === "bounced") && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onDelete(cheque);
                }}
                className="px-3.5 h-9 rounded-xl border border-red-500/30 hover:bg-red-500/10 text-red-500 text-xs font-bold transition-all cursor-pointer"
              >
                Delete Record
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
