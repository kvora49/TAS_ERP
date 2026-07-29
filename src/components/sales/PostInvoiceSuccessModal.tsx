"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Eye,
  Printer,
  Download,
  ListOrdered,
  PlusCircle,
  FileText,
} from "lucide-react";
import { Modal } from "@/components/shared/Modal";

export interface CreatedInvoiceInfo {
  id: string;
  bill_number: string;
  party_name?: string;
  grand_total?: number;
  bill_type?: "pakka" | "kacha";
}

interface PostInvoiceSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: CreatedInvoiceInfo | null;
  onCreateAnother?: () => void;
}

export function PostInvoiceSuccessModal({
  open,
  onOpenChange,
  invoice,
  onCreateAnother,
}: PostInvoiceSuccessModalProps) {
  const router = useRouter();

  if (!invoice) return null;

  const formattedTotal = (invoice.grand_total || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const handlePreview = () => {
    onOpenChange(false);
    router.push(`/sales/bills/${invoice.id}`);
  };

  const handlePrint = () => {
    window.open(`/sales/bills/${invoice.id}/print`, "_blank");
  };

  const handleDownload = () => {
    window.open(`/sales/bills/${invoice.id}/print?autoDownload=true`, "_blank");
  };

  const handleGoToList = () => {
    onOpenChange(false);
    router.push("/sales/bills");
  };

  const handleCreateAnother = () => {
    onOpenChange(false);
    if (onCreateAnother) {
      onCreateAnother();
    } else {
      router.push("/sales/bills/new");
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Invoice Generated Successfully"
      description="Select how you would like to proceed with the newly created invoice."
      maxWidth="max-w-xl"
    >
      <div className="space-y-6 pt-2">
        {/* Celebration & Bill Info Header */}
        <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-5 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
            <CheckCircle2 size={28} />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--primary)] bg-[var(--primary-light)] px-2 py-0.5 rounded font-mono">
              {invoice.bill_type === "kacha" ? "Kacha Estimate" : "Tax Invoice"}
            </span>
            <h3 className="text-xl font-bold text-[var(--text-primary)] mt-1 font-mono">
              {invoice.bill_number}
            </h3>
            {invoice.party_name && (
              <p className="text-xs font-semibold text-[var(--text-secondary)] mt-0.5">
                Customer: {invoice.party_name}
              </p>
            )}
            <p className="text-lg font-black text-emerald-500 mt-1">
              ₹{formattedTotal}
            </p>
          </div>
        </div>

        {/* Primary Action Buttons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Preview Button */}
          <button
            onClick={handlePreview}
            className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] hover:border-[var(--primary)] hover:bg-[var(--page-bg)] transition-all flex flex-col items-center justify-center gap-2 group cursor-pointer text-center"
          >
            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-[var(--primary)] group-hover:scale-110 transition-transform">
              <Eye size={20} />
            </div>
            <div>
              <span className="text-xs font-bold text-[var(--text-primary)] block">
                Preview Bill
              </span>
              <span className="text-[10px] text-[var(--text-muted)] font-medium">
                View full invoice
              </span>
            </div>
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] hover:border-[var(--primary)] hover:bg-[var(--page-bg)] transition-all flex flex-col items-center justify-center gap-2 group cursor-pointer text-center"
          >
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500 group-hover:scale-110 transition-transform">
              <Printer size={20} />
            </div>
            <div>
              <span className="text-xs font-bold text-[var(--text-primary)] block">
                Print Bill
              </span>
              <span className="text-[10px] text-[var(--text-muted)] font-medium">
                Print A4 / Thermal
              </span>
            </div>
          </button>

          {/* Download PDF Button */}
          <button
            onClick={handleDownload}
            className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] hover:border-[var(--primary)] hover:bg-[var(--page-bg)] transition-all flex flex-col items-center justify-center gap-2 group cursor-pointer text-center"
          >
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform">
              <Download size={20} />
            </div>
            <div>
              <span className="text-xs font-bold text-[var(--text-primary)] block">
                Download PDF
              </span>
              <span className="text-[10px] text-[var(--text-muted)] font-medium">
                Save to disk
              </span>
            </div>
          </button>
        </div>

        {/* Bottom Secondary Actions */}
        <div className="pt-3 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={handleGoToList}
            className="w-full sm:w-auto px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--page-bg)] text-xs font-bold text-[var(--text-body)] flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <ListOrdered size={15} />
            <span>Go to Sales Bills Directory</span>
          </button>

          <button
            onClick={handleCreateAnother}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
          >
            <PlusCircle size={15} />
            <span>Create Another Invoice</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
