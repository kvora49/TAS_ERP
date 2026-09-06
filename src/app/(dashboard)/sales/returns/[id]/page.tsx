"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Loader2, FileText, Printer, Trash2, Edit2,
  Building2, ReceiptText, Download, ExternalLink,
  Package, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { CreditNoteModal } from "@/components/modals/CreditNoteModal";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";

interface CreditNote {
  id: string;
  cn_number: string;
  cn_date: string;
  amount: number;
  reason: string | null;
  status?: string;
}

interface Bill {
  id: string;
  bill_number: string;
  bill_date: string;
  grand_total: number;
}

interface Party {
  id: string;
  name: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  billing_address_line1: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_pincode: string | null;
}

interface LedgerEntry {
  id: string;
  item_id: string;
  godown_id: string | null;
  quantity_delta: number;
  value_delta: number;
  design?: { id: string; name: string; design_number: string } | null;
}

interface SalesReturn {
  id: string;
  return_number: string;
  return_date: string;
  return_reason: string | null;
  reason?: string | null;
  taxable_amount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  round_off?: number;
  gst_type?: string;
  grand_total: number;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  original_bill_id: string | null;
  credit_note_id: string | null;
  party?: Party;
  items?: any[];
  bill?: Bill | null;
  credit_note?: CreditNote | CreditNote[] | null;
}

export default function SalesReturnDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [sReturn, setSReturn] = useState<SalesReturn | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cnModalOpen, setCnModalOpen] = useState(false);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/returns/${id}`);
      if (!res.ok) throw new Error("Failed to load return details");
      const data = await res.json();
      setSReturn(data.return);
      setLedgerEntries(data.ledgerEntries || []);
    } catch (err: any) {
      toast.error(err.message || "Error loading return details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/sales/returns/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete return");
      toast.success(data.message || "Sales return deleted. Stock reversed.");
      router.push("/sales/returns");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(val);

  const { business, brandConfig, logoUrl } = useCompanyProfile();

  const creditNote = sReturn?.credit_note
    ? Array.isArray(sReturn.credit_note)
      ? sReturn.credit_note[0]
      : sReturn.credit_note
    : null;

  const refDoc = sReturn?.bill ? {
    invoice_number: sReturn.bill.bill_number,
    invoice_date: sReturn.bill.bill_date || "",
    invoice_amount: sReturn.bill.grand_total || 0,
    payment_made: (sReturn.bill as any)?.paid_amount || (sReturn.bill as any)?.received_amount || 0,
    note_amount: creditNote?.amount || sReturn.grand_total || 0,
  } : null;

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (!sReturn) {
    return (
      <div className="p-6 text-center text-sm font-semibold text-red-500">
        Sales return not found or could not be loaded.
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-6xl mx-auto pb-12">
      <div className="space-y-4 sm:space-y-6 print:hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[var(--border)] pb-4 gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Link href="/sales/returns" className="p-2 hover:bg-[var(--table-row-hover)] rounded-lg transition-colors text-[var(--text-muted)] border border-[var(--border)] bg-[var(--card-bg)] shrink-0">
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-xl font-bold text-[var(--text-primary)]">
                  Sales Return: {sReturn.return_number}
                </h1>
                <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  {sReturn.status}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                Processed on {sReturn.return_date} · Customer:{" "}
                <span className="font-semibold text-[var(--text-primary)]">{sReturn.party?.name}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end self-end sm:self-auto w-full sm:w-auto ml-auto gap-1.5 sm:gap-2 flex-wrap">
            {creditNote && (
              <button
                onClick={() => setCnModalOpen(true)}
                className="h-8 sm:h-9 px-2.5 sm:px-3.5 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Credit Note Voucher</span>
              </button>
            )}
            <Link
              href={`/sales/returns/${id}/edit`}
              className="h-8 sm:h-9 px-2.5 sm:px-3.5 text-xs font-bold text-[var(--text-primary)] bg-[var(--card-bg)] border border-[var(--border)] rounded-lg hover:bg-[var(--table-row-hover)] flex items-center gap-1.5 transition-all shrink-0"
            >
              <Edit2 className="h-3.5 w-3.5" />
              <span>Edit</span>
            </Link>
            <button
              onClick={() => setDeleteOpen(true)}
              className="h-8 sm:h-9 px-2.5 sm:px-3.5 text-xs font-bold text-rose-500 bg-rose-500/10 border border-rose-500/30 rounded-lg hover:bg-rose-500/20 flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Original Bill Reference */}
          {sReturn.bill ? (
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)]">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3 flex items-center gap-2">
                <ReceiptText className="h-4 w-4" />
                Original Sales Bill Reference
              </h2>
              <div className="flex items-center justify-between">
                <div>
                  <Link
                    href={`/sales/bills/${sReturn.bill.id}`}
                    className="text-[var(--primary)] font-bold text-sm font-mono hover:underline flex items-center gap-1.5"
                  >
                    {sReturn.bill.bill_number}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">Dated: {sReturn.bill.bill_date}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[var(--text-muted)]">Bill Value</p>
                  <p className="font-bold text-[var(--text-primary)] font-mono">{formatCurrency(sReturn.bill.grand_total)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-200/60 rounded-xl p-4 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  No original sales bill linked (Direct Return).
                </p>
              </div>
              <Link
                href={`/sales/returns/${id}/edit`}
                className="text-xs font-bold text-[var(--primary)] hover:underline"
              >
                Link Original Bill
              </Link>
            </div>
          )}

          {/* Customer Info */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)]">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Customer Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-extrabold text-[var(--text-primary)]">{sReturn.party?.name}</p>
                {sReturn.party?.company_name && (
                  <p className="text-xs text-[var(--text-muted)]">{sReturn.party.company_name}</p>
                )}
                {sReturn.party?.gstin && (
                  <p className="text-xs font-mono font-bold text-[var(--text-secondary)] mt-1">
                    GSTIN: {sReturn.party.gstin}
                  </p>
                )}
              </div>
              <div className="text-xs text-[var(--text-muted)] space-y-0.5">
                {sReturn.party?.phone && <p>📞 {sReturn.party.phone}</p>}
                {sReturn.party?.email && <p>✉️ {sReturn.party.email}</p>}
                {sReturn.party?.billing_city && (
                  <p>
                    📍 {sReturn.party.billing_address_line1}, {sReturn.party.billing_city},{" "}
                    {sReturn.party.billing_state} - {sReturn.party.billing_pincode}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Returned Items from stock ledger */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
            <div className="p-5 border-b border-[var(--border)]">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
                <Package className="h-4 w-4 text-[var(--primary)]" />
                Items Returned to Inventory Stock
              </h2>
            </div>
            {(() => {
              const displayList = (sReturn.items && sReturn.items.length > 0) ? sReturn.items : ledgerEntries;
              if (displayList.length === 0) {
                return (
                  <div className="p-8 text-center text-xs text-[var(--text-faint)] italic">
                    No stock movement entries found for this return.
                  </div>
                );
              }
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold">
                        <th className="p-3">Design / Product</th>
                        <th className="p-3 text-right">Qty Returned</th>
                        <th className="p-3 text-right">Credit Value (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {displayList.map((entry: any, idx: number) => {
                        const dName = entry.design?.name || entry.item_name || (entry.design ? entry.design.design_number : "Returned Product");
                        const dCode = entry.design?.design_number || entry.design_code || entry.article_no || "";
                        const colour = entry.colour?.colour_name || entry.colour_name || entry.colour || "";
                        const qty = entry.returned_qty || entry.quantity || Math.abs(entry.quantity_delta || 0);
                        const val = entry.amount || Math.abs(entry.value_delta || 0) || (qty * Number(entry.rate || entry.unit_rate || 0));
                        const sq = entry.size_quantities;
                        const hasSq = sq && typeof sq === "object" && Object.keys(sq).length > 0;
                        const sqEntries = hasSq ? Object.entries(sq).filter(([_, q]) => Number(q) > 0) : [];

                        return (
                          <tr key={entry.id || idx} className="hover:bg-[var(--table-row-hover)]">
                            <td className="p-3">
                              <p className="font-bold text-[var(--text-primary)]">{dName}</p>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                                {dCode && <span className="text-[var(--text-muted)] font-mono">Art: {dCode}</span>}
                                {colour && colour !== "Standard" && <span className="text-[var(--text-muted)]">Col: {colour}</span>}
                                {entry.size && entry.size !== "—" && <span className="font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.2 rounded border border-indigo-200">Size: {entry.size}</span>}
                              </div>
                              {sqEntries.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {sqEntries.map(([s, q]) => (
                                    <span key={s} className="px-1.5 py-0.5 text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-[var(--text-primary)] rounded border border-[var(--border)]">
                                      {s}: {String(q)} pcs
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-600">
                              +{qty} {entry.unit || "pcs"}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-[var(--text-primary)]">
                              {formatCurrency(val)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>

          {/* Return Reason */}
          {sReturn.return_reason && (
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)]">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                Reason for Return
              </h2>
              <p className="text-sm text-[var(--text-primary)] font-medium">{sReturn.return_reason}</p>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Financial Summary */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Financial Summary
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)] font-semibold">Return Date:</span>
                <span className="font-mono font-bold text-[var(--text-primary)]">{sReturn.return_date}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)] font-semibold">Taxable Amount:</span>
                <span className="font-mono font-semibold text-[var(--text-primary)]">{formatCurrency(sReturn.taxable_amount || sReturn.grand_total)}</span>
              </div>
              {sReturn.cgst ? (
                <div className="flex justify-between text-xs text-[var(--text-muted)]">
                  <span>CGST:</span>
                  <span className="font-mono">{formatCurrency(sReturn.cgst)}</span>
                </div>
              ) : null}
              {sReturn.sgst ? (
                <div className="flex justify-between text-xs text-[var(--text-muted)]">
                  <span>SGST:</span>
                  <span className="font-mono">{formatCurrency(sReturn.sgst)}</span>
                </div>
              ) : null}
              {sReturn.igst ? (
                <div className="flex justify-between text-xs text-[var(--text-muted)]">
                  <span>IGST:</span>
                  <span className="font-mono">{formatCurrency(sReturn.igst)}</span>
                </div>
              ) : null}
              {sReturn.gst_type === "without_gst" && (
                <div className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 p-2 rounded border border-amber-200 dark:border-amber-900">
                  Kaccha Return (No GST)
                </div>
              )}
              {sReturn.round_off ? (
                <div className="flex justify-between text-xs text-[var(--text-faint)]">
                  <span>Round Off:</span>
                  <span className="font-mono">{sReturn.round_off > 0 ? `+${sReturn.round_off}` : sReturn.round_off}</span>
                </div>
              ) : null}
              <div className="border-t border-[var(--border)] my-2" />
              <div className="flex justify-between items-center bg-rose-500/10 border border-rose-200/50 p-3 rounded-lg">
                <span className="font-bold text-rose-600 text-sm">Total Return Value:</span>
                <span className="font-mono font-black text-rose-600 text-lg">
                  {formatCurrency(sReturn.grand_total)}
                </span>
              </div>
            </div>
          </div>

          {/* Credit Note Panel */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Credit Note
            </h2>
            {creditNote ? (
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-[var(--text-muted)]">CN Number:</span>
                  <span className="font-mono font-bold text-[var(--primary)]">{creditNote.cn_number}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-[var(--text-muted)]">Date:</span>
                  <span className="font-mono text-[var(--text-primary)]">{creditNote.cn_date}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-[var(--text-muted)]">Amount:</span>
                  <span className="font-mono font-bold text-emerald-600">{formatCurrency(creditNote.amount)}</span>
                </div>
                {creditNote.reason && (
                  <div className="bg-[var(--page-bg)] p-2.5 rounded border border-[var(--border)] text-[10px] text-[var(--text-muted)]">
                    {creditNote.reason}
                  </div>
                )}
                <div className="border-t border-[var(--border)] pt-3 space-y-2">
                  <button
                    onClick={() => setCnModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-white bg-[#6366F1] hover:bg-[#4F46E5] rounded-lg transition-all shadow-sm cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Open Credit Note Voucher
                  </button>
                  <button
                    onClick={() => setCnModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-[var(--text-primary)] bg-[var(--page-bg)] border border-[var(--border)] hover:bg-[var(--table-row-hover)] rounded-lg transition-all cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Print / Download A4 PDF
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-faint)] italic text-center py-3">
                No credit note linked to this return.
              </p>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Activity</h2>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[var(--text-muted)]">Return recorded on <strong>{sReturn.return_date}</strong></span>
              </div>
              {creditNote && (
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span className="text-[var(--text-muted)]">Credit Note <strong>{creditNote.cn_number}</strong> issued</span>
                </div>
              )}
              {ledgerEntries.length > 0 && (
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-[var(--text-muted)]">{ledgerEntries.length} stock entries restored to inventory</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      </div>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Sales Return"
        description={`Are you sure you want to delete return ${sReturn.return_number}? This will cancel the linked credit note ${creditNote?.cn_number || ""} and reverse all stock entries added to the godown.`}
        confirmText="Delete & Reverse Stock"
        loading={deleting}
        onConfirm={handleDelete}
      />

      {/* Credit Note Modal */}
      {creditNote && (
        <CreditNoteModal
          open={cnModalOpen}
          onClose={() => setCnModalOpen(false)}
          creditNote={{
            cn_number: creditNote.cn_number,
            cn_date: creditNote.cn_date,
            amount: Number(creditNote.amount || sReturn.grand_total),
            taxable_amount: (creditNote as any).taxable_amount || (sReturn as any).taxable_amount || 0,
            cgst: (creditNote as any).cgst || (sReturn as any).cgst || 0,
            sgst: (creditNote as any).sgst || (sReturn as any).sgst || 0,
            igst: (creditNote as any).igst || (sReturn as any).igst || 0,
            round_off: (creditNote as any).round_off || (sReturn as any).round_off || 0,
            reason: creditNote.reason || sReturn.return_reason || sReturn.reason || "Sales Return",
            party: sReturn.party,
            return: {
              return_number: sReturn.return_number,
              return_date: sReturn.return_date,
              bill: sReturn.bill ? { bill_number: sReturn.bill.bill_number, bill_date: sReturn.bill.bill_date } : null,
            },
          }}
          items={(sReturn.items && sReturn.items.length > 0) ? sReturn.items : ledgerEntries}
          company={business ? {
            name: business.name,
            address: business.address,
            gstin: business.gstin,
            phone: business.phone,
            email: business.email,
          } : undefined}
          config={brandConfig}
          logoUrl={logoUrl}
          referenceDoc={refDoc}
        />
      )}
    </div>
  );
}
