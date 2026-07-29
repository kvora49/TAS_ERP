"use client";

import React, { useState } from "react";
import { Copy, Check, FileText } from "lucide-react";
import { numberToWords } from "@/lib/utils/numberToWords";
import { cn } from "@/lib/utils";

interface BillSummaryPanelProps {
  itemCount: number;
  itemTotal: number;
  chargesTotal: number;
  subTotal: number;
  discount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst?: number;
  roundOff: number;
  grandTotal: number;
  className?: string;
}

export default function BillSummaryPanel({
  itemCount,
  itemTotal,
  chargesTotal,
  subTotal,
  discount,
  taxableAmount,
  cgst,
  sgst,
  igst = 0,
  roundOff,
  grandTotal,
  className
}: BillSummaryPanelProps) {
  const [copied, setCopied] = useState(false);

  const amountInWordsStr = numberToWords(grandTotal);

  const handleCopy = () => {
    navigator.clipboard.writeText(amountInWordsStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR"
    }).format(val);
  };

  return (
    <div className={cn("bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-5 sticky top-6 shadow-[var(--shadow-sm)] flex flex-col", className)}>
      <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)] mb-4 pb-3 border-b border-[var(--border-light)]">
        <FileText className="h-5 w-5 text-[var(--primary)]" />
        <span>Bill Summary</span>
      </h3>

      <div className="flex flex-col gap-3 text-sm text-[var(--text-body)]">
        {/* Item Total */}
        <div className="flex items-center justify-between">
          <span>Item Total ({itemCount} Item{itemCount !== 1 ? "s" : ""})</span>
          <span className="font-medium text-[var(--text-primary)]">{formatCurrency(itemTotal)}</span>
        </div>

        {/* Charges Total */}
        <div className="flex items-center justify-between">
          <span>Charges Total</span>
          <span className="font-medium text-[var(--text-primary)]">{formatCurrency(chargesTotal)}</span>
        </div>

        {/* Sub Total */}
        <div className="flex items-center justify-between font-medium text-[var(--text-primary)]">
          <span>Sub Total</span>
          <span>{formatCurrency(subTotal)}</span>
        </div>

        {/* Discount */}
        {discount > 0 && (
          <div className="flex items-center justify-between text-red-500 font-medium">
            <span>Discount (Less)</span>
            <span>-{formatCurrency(discount)}</span>
          </div>
        )}

        {/* Taxable Amount */}
        <div className="flex items-center justify-between border-t border-[var(--border-light)] pt-3">
          <span>Taxable Amount</span>
          <span className="font-semibold text-[var(--text-primary)]">{formatCurrency(taxableAmount)}</span>
        </div>

        {/* CGST */}
        {cgst > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span>CGST</span>
            <span>{formatCurrency(cgst)}</span>
          </div>
        )}

        {/* SGST */}
        {sgst > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span>SGST</span>
            <span>{formatCurrency(sgst)}</span>
          </div>
        )}

        {/* IGST */}
        {igst > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span>IGST</span>
            <span>{formatCurrency(igst)}</span>
          </div>
        )}

        {/* Round Off */}
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pb-3 border-b border-[var(--border-light)]">
          <span>Round Off</span>
          <span>{roundOff >= 0 ? "+" : ""}{formatCurrency(roundOff)}</span>
        </div>

        {/* Grand Total */}
        <div className="flex items-center justify-between py-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Grand Total</span>
          <span className="text-xl font-bold text-[var(--primary)]">{formatCurrency(grandTotal)}</span>
        </div>

        {/* Amount in words */}
        <div className="bg-emerald-500/10 rounded-lg p-3 mt-2 border border-emerald-500/20 relative flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Amount in Words</span>
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 leading-relaxed">{amountInWordsStr}</span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 p-1.5 rounded transition-colors shrink-0"
            title="Copy Amount in Words"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
