"use client";

import React from "react";
import { Landmark, ShieldCheck, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { numberToWords } from "@/lib/utils/numberToWords";
import { formatCurrency, formatDate } from "@/lib/utils";

interface ChequeLeafCardProps {
  cheque: {
    cheque_number: string;
    direction: "received" | "issued";
    bank_name: string;
    account_no?: string | null;
    cheque_date: string;
    due_date?: string | null;
    amount: number;
    status: "pending" | "deposited" | "cleared" | "bounced" | "cancelled";
    party?: {
      name: string;
      company_name?: string | null;
    } | null;
    settlement_type?: string;
  };
}

export function ChequeLeafCard({ cheque }: ChequeLeafCardProps) {
  const isReceived = cheque.direction === "received";
  const partyDisplayName = cheque.party?.company_name || cheque.party?.name || "Bearer / On Account";
  const amountWords = numberToWords(Number(cheque.amount || 0)).toUpperCase() + " RUPEES ONLY";

  // Format date into individual digits if possible
  const rawDate = cheque.cheque_date ? new Date(cheque.cheque_date) : new Date();
  const dStr = String(rawDate.getDate()).padStart(2, "0");
  const mStr = String(rawDate.getMonth() + 1).padStart(2, "0");
  const yStr = String(rawDate.getFullYear());
  const dateChars = (dStr + mStr + yStr).split("");

  const statusStyles = {
    pending: "text-amber-500 border-amber-500/40 bg-amber-500/10",
    deposited: "text-sky-500 border-sky-500/40 bg-sky-500/10",
    cleared: "text-emerald-500 border-emerald-500/40 bg-emerald-500/10",
    bounced: "text-red-500 border-red-500/40 bg-red-500/10",
    cancelled: "text-slate-400 border-slate-500/40 bg-slate-500/10",
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] shadow-[var(--shadow-md)] p-5 sm:p-6 transition-all select-none">
      {/* Background Bank Guilloche Pattern Overlay */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none bg-[radial-gradient(#6366F1_1px,transparent_1px)] [background-size:16px_16px]" />

      {/* Status Watermark Stamp */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none rotate-[-15deg] opacity-20 dark:opacity-25 z-0">
        <div className={`px-6 py-2 border-4 border-dashed rounded-2xl text-2xl sm:text-3xl font-black uppercase tracking-widest ${statusStyles[cheque.status]}`}>
          {cheque.status}
        </div>
      </div>

      <div className="relative z-10 space-y-4">
        {/* Top Bar: Bank Logo & Date Cells */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-light)] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary-light)] flex items-center justify-center text-[var(--primary)] shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base text-[var(--text-primary)] tracking-tight">
                  {cheque.bank_name}
                </span>
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isReceived ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                }`}>
                  {isReceived ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                  {isReceived ? "RECEIVED" : "ISSUED"}
                </span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)] font-mono">
                CTS-2010 COMPLIANT CHEQUE
              </span>
            </div>
          </div>

          {/* Date Grid */}
          <div className="flex flex-col items-end">
            <span className="text-[9px] uppercase tracking-wider font-bold text-[var(--text-muted)] mb-1">
              Date (DD-MM-YYYY)
            </span>
            <div className="flex items-center gap-1">
              {dateChars.map((char, idx) => (
                <div
                  key={idx}
                  className={`w-6 h-7 rounded border border-[var(--border)] flex items-center justify-center font-mono text-xs font-bold text-[var(--text-primary)] bg-[var(--page-bg)] ${
                    idx === 1 || idx === 3 ? "mr-1" : ""
                  }`}
                >
                  {char}
                </div>
              ))}
            </div>
            {cheque.due_date && cheque.due_date !== cheque.cheque_date && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
                PDC Due: {formatDate(cheque.due_date)}
              </span>
            )}
          </div>
        </div>

        {/* Middle Section: Payee & Amount Words */}
        <div className="space-y-3 pt-1">
          {/* Payee */}
          <div className="flex items-baseline gap-2 border-b border-dashed border-[var(--border)] pb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] shrink-0">
              Pay to:
            </span>
            <span className="text-sm sm:text-base font-bold text-[var(--text-primary)] font-serif italic tracking-wide truncate">
              {partyDisplayName}
            </span>
            <span className="text-[11px] text-[var(--text-muted)] ml-auto shrink-0 font-serif italic">
              Or Bearer
            </span>
          </div>

          {/* Rupees in Words + Rupees Box */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="md:col-span-3 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Rupees (In Words):
              </span>
              <div className="p-2 rounded-lg bg-[var(--page-bg)] border border-[var(--border-light)] text-xs font-semibold text-[var(--text-primary)] italic leading-relaxed">
                {amountWords}
              </div>
            </div>

            {/* Amount in Box */}
            <div className="md:col-span-1 flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Amount (₹)
              </span>
              <div className="h-11 px-3.5 rounded-xl bg-[var(--page-bg)] border-2 border-[var(--primary)] flex items-center justify-between font-mono font-black text-sm sm:text-base text-[var(--text-primary)] shadow-inner">
                <span className="text-xs text-[var(--text-muted)]">₹</span>
                <span>{Number(cheque.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Account No, Signatory, MICR */}
        <div className="pt-3 border-t border-[var(--border-light)] flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)]">
              Account Number
            </span>
            <div className="font-mono text-xs font-bold text-[var(--text-primary)] bg-[var(--page-bg)] px-2.5 py-1 rounded-md border border-[var(--border-light)] inline-block">
              {cheque.account_no || "XXXX-XXXX-XXXX"}
            </div>
          </div>

          <div className="text-right">
            <div className="w-32 sm:w-40 border-b border-dashed border-[var(--text-muted)] pb-1 mb-1 text-center">
              <span className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] font-bold">
                {isReceived ? "Drawer Signature" : "Authorized Signatory"}
              </span>
            </div>
            <span className="text-[10px] font-bold text-[var(--text-secondary)]">
              {isReceived ? partyDisplayName : "TAS ERP Authority"}
            </span>
          </div>
        </div>

        {/* Cheque MICR Strip */}
        <div className="mt-3 pt-2 border-t border-[var(--border-light)] flex items-center justify-center font-mono text-[11px] sm:text-xs tracking-widest text-[var(--text-muted)] bg-[var(--page-bg)] py-1.5 rounded-lg border border-[var(--border)]">
          <span>⑈ {cheque.cheque_number.padStart(6, "0")} ⑈ 400240012⑈ 001234⑈ 10</span>
        </div>
      </div>
    </div>
  );
}
