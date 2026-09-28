"use client";

import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import {
  ShieldCheck,
  Check,
  Copy,
  Clock,
  Truck,
  Lock,
  XCircle,
  AlertCircle,
  FileCheck2,
} from "lucide-react";
import { CancelEInvoiceModal } from "./CancelEInvoiceModal";
import { Badge } from "@/components/shared/Badge";

interface EInvoiceSuccessCardProps {
  bill: {
    id: string;
    irn?: string | null;
    irn_status?: string | null;
    ack_no?: string | null;
    ack_date?: string | null;
    signed_qr_data?: string | null;
    ewb_no?: string | null;
    ewb_date?: string | null;
    ewb_valid_till?: string | null;
    irn_cancel_reason?: string | null;
    irn_cancelled_at?: string | null;
  };
  onRefetch: () => void;
}

export function EInvoiceSuccessCard({ bill, onRefetch }: EInvoiceSuccessCardProps) {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const irn = bill.irn;
  const isRegistered = bill.irn_status === "registered" && !!irn;
  const isCancelled = bill.irn_status === "cancelled";

  // Check 24-hour statutory cancellation window
  let canCancel = false;
  let hoursRemaining = 0;
  if (isRegistered && bill.ack_date) {
    const diff = (Date.now() - new Date(bill.ack_date).getTime()) / (1000 * 60 * 60);
    if (diff < 24) {
      canCancel = true;
      hoursRemaining = Math.max(0, Math.round((24 - diff) * 10) / 10);
    }
  }

  // Generate QR code data URL from signed_qr_data or IRN
  useEffect(() => {
    const qrSource = bill.signed_qr_data || irn;
    if (qrSource) {
      QRCode.toDataURL(qrSource, {
        width: 140,
        margin: 1,
        color: {
          dark: "#0F172A",
          light: "#FFFFFF",
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error("Failed to generate QR data URL:", err));
    }
  }, [bill.signed_qr_data, irn]);

  const handleCopyIrn = () => {
    if (!irn) return;
    navigator.clipboard.writeText(irn);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isRegistered && !isCancelled) {
    return null;
  }

  return (
    <>
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 sm:p-5 shadow-[var(--shadow-sm)] space-y-4">
        {/* Header Ribbon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                isRegistered
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-500"
              }`}
            >
              {isRegistered ? <ShieldCheck className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  {isRegistered ? "Official GST E-Invoice (IRN Registered)" : "E-Invoice Cancelled"}
                </h3>
                <Badge variant={isRegistered ? "green" : "red"}>
                  {isRegistered ? "Active" : "Cancelled"}
                </Badge>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                {isRegistered
                  ? "Electronically signed and verified by the Indian Goods and Services Tax Network (GSTN)."
                  : `IRN was cancelled: ${bill.irn_cancel_reason || "Statutory Cancellation"}`}
              </p>
            </div>
          </div>

          {/* Action on Right (Cancel Button if within 24h) */}
          {isRegistered && (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {canCancel ? (
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(true)}
                  className="px-3 h-8 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Cancel this IRN on IRP (within 24 hours)"
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>Cancel IRN ({hoursRemaining}h left)</span>
                </button>
              ) : (
                <span className="text-[11px] font-medium text-[var(--text-muted)] bg-[var(--page-bg)] px-2.5 py-1 rounded-md border border-[var(--border-light)]">
                  24h Window Closed (Issue Credit Note)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Content Body: QR Code + Details */}
        <div className="grid grid-cols-1 md:grid-cols-[130px_1fr] gap-4 items-center">
          {/* QR Code Canvas */}
          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-[var(--page-bg)] border border-[var(--border)] shadow-sm shrink-0 self-center">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Signed GST QR Code" className="w-28 h-28 object-contain rounded-lg bg-white p-1" />
            ) : (
              <div className="w-28 h-28 flex items-center justify-center bg-[var(--card-bg)] text-[10px] text-[var(--text-faint)]">
                Generating QR...
              </div>
            )}
            <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider mt-1">
              Signed GST QR
            </span>
          </div>

          {/* IRN & Ack Metadata */}
          <div className="space-y-3 min-w-0">
            {/* IRN Hash Bar */}
            <div className="p-2.5 rounded-xl bg-[var(--page-bg)] border border-[var(--border-light)] flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider block">
                  Invoice Reference Number (IRN)
                </span>
                <span className="text-xs font-mono font-bold text-[var(--text-primary)] break-all select-all block mt-0.5">
                  {irn}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyIrn}
                className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--card-bg)] transition-colors shrink-0 cursor-pointer"
                title="Copy IRN"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>

            {/* Ack No & Ack Date & E-Way Bill */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="p-2 rounded-lg bg-[var(--page-bg)] border border-[var(--border-light)]">
                <span className="text-[10px] font-semibold text-[var(--text-muted)] block">Ack No.</span>
                <span className="text-xs font-mono font-bold text-[var(--text-primary)] mt-0.5 block">
                  {bill.ack_no || "—"}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-[var(--page-bg)] border border-[var(--border-light)]">
                <span className="text-[10px] font-semibold text-[var(--text-muted)] block">Ack Date</span>
                <span className="text-xs font-bold text-[var(--text-primary)] mt-0.5 block">
                  {bill.ack_date
                    ? new Date(bill.ack_date).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </span>
              </div>

              {bill.ewb_no ? (
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <Truck className="h-3 w-3" />
                    <span>E-Way Bill</span>
                  </div>
                  <span className="text-xs font-mono font-black text-emerald-700 dark:text-emerald-300 mt-0.5 block">
                    {bill.ewb_no}
                  </span>
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-[var(--page-bg)] border border-[var(--border-light)] flex items-center gap-1.5 text-[var(--text-muted)]">
                  <Lock className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-[11px] font-semibold">Locked for Edit</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      {isRegistered && (
        <CancelEInvoiceModal
          open={cancelModalOpen}
          onOpenChange={setCancelModalOpen}
          invoiceId={bill.id}
          irn={irn!}
          ackDate={bill.ack_date}
          onSuccess={onRefetch}
        />
      )}
    </>
  );
}
