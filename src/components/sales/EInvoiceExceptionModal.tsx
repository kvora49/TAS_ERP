"use client";

import React from "react";
import { Modal } from "@/components/shared/Modal";
import { AlertCircle, AlertTriangle, ArrowRight, Zap, Loader2 } from "lucide-react";
import { EInvoiceValidationError } from "@/lib/einvoice";
import Link from "next/link";

interface EInvoiceExceptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  errors: EInvoiceValidationError[];
  warnings?: EInvoiceValidationError[];
  invoiceId: string;
  onIgnoreAndGenerate?: () => void;
  generating?: boolean;
}

export function EInvoiceExceptionModal({
  open,
  onOpenChange,
  errors,
  warnings = [],
  invoiceId,
  onIgnoreAndGenerate,
  generating = false,
}: EInvoiceExceptionModalProps) {
  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={hasErrors ? "E-Invoice Pre-Validation Exceptions" : "E-Invoice Advisory Notices"}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Header Notice */}
        {hasErrors ? (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
            <div>
              <p className="font-semibold">
                Local Verification Detected {errors.length} Blocking Issue{errors.length !== 1 ? "s" : ""}
                {hasWarnings ? ` and ${warnings.length} Advisory Warning${warnings.length !== 1 ? "s" : ""}` : ""}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                The government IRP portal will reject this invoice due to the blocking items below.
                Please edit the invoice or master data to fix them before submitting.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
            <div>
              <p className="font-semibold">
                {warnings.length} Advisory Notice{warnings.length !== 1 ? "s" : ""} Detected (No Blocking Errors)
              </p>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                These are non-fatal warnings (such as a 4-digit HSN code or an older invoice date).
                You can review them, or click <strong>&quot;Ignore Warnings &amp; Generate&quot;</strong> to submit directly to the IRP.
              </p>
            </div>
          </div>
        )}

        {/* Exceptions & Warnings List */}
        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {/* Blocking Errors Section */}
          {hasErrors && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider block">
                Blocking Errors (Must Fix)
              </span>
              {errors.map((err, idx) => (
                <div
                  key={`${err.code}-${idx}`}
                  className="p-3 rounded-xl border border-red-500/20 bg-red-500/5 flex flex-col gap-1 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      <span className="font-bold text-xs text-red-600 dark:text-red-400 uppercase tracking-wider truncate">
                        {err.field.replace(/_/g, " ")}
                      </span>
                      {err.invoice_line_ref && (
                        <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-red-500/10 text-red-500 shrink-0">
                          Line #{err.invoice_line_ref}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-[var(--text-faint)]">{err.code}</span>
                  </div>

                  <p className="text-xs text-[var(--text-primary)] font-medium mt-0.5 pl-5">
                    {err.message}
                  </p>

                  {err.helpText && (
                    <p className="text-[11px] text-[var(--text-muted)] pl-5 italic flex items-center gap-1">
                      <span>💡 Tip:</span> {err.helpText}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Advisory Warnings Section */}
          {hasWarnings && (
            <div className={`space-y-2 ${hasErrors ? "mt-4 pt-3 border-t border-[var(--border)]" : ""}`}>
              {hasErrors && (
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                  Advisory Warnings (Ignorable)
                </span>
              )}
              {warnings.map((warn, idx) => (
                <div
                  key={`warn-${idx}`}
                  className="p-3 rounded-xl border border-amber-500/25 bg-amber-500/5 flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span className="font-bold text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider truncate">
                        {warn.field.replace(/_/g, " ")}
                      </span>
                      {warn.invoice_line_ref && (
                        <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-amber-500/10 text-amber-600 shrink-0">
                          Line #{warn.invoice_line_ref}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-[var(--text-faint)]">{warn.code}</span>
                  </div>

                  <p className="text-xs text-[var(--text-primary)] font-medium mt-0.5 pl-5">
                    {warn.message}
                  </p>

                  {warn.helpText && (
                    <p className="text-[11px] text-[var(--text-muted)] pl-5 italic flex items-center gap-1">
                      <span>💡 Tip:</span> {warn.helpText}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer CTAs */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--border)] gap-2">
          <button
            type="button"
            disabled={generating}
            onClick={() => onOpenChange(false)}
            className="px-4 h-9 rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--page-bg)] border border-[var(--border)] transition-colors disabled:opacity-50"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <Link
              href={`/sales/bills/${invoiceId}/edit`}
              onClick={() => onOpenChange(false)}
              className={`px-4 h-9 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors ${
                hasErrors
                  ? "text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)]"
                  : "text-[var(--text-primary)] bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-row-hover)]"
              }`}
            >
              <span>Edit Invoice</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>

            {/* Ignorable Warning Action: Only available if there are NO blocking errors */}
            {!hasErrors && hasWarnings && onIgnoreAndGenerate && (
              <button
                type="button"
                disabled={generating}
                onClick={onIgnoreAndGenerate}
                className="px-4 h-9 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {generating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Zap className="h-3.5 w-3.5" />
                )}
                <span>{generating ? "Submitting..." : "Ignore Warnings & Generate"}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
