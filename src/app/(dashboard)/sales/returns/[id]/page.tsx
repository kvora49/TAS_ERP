"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Loader2, FileText, RefreshCw, Printer, Trash2,
  CheckCircle2, Building2, Calendar, ReceiptText, Download, ExternalLink,
  Package, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/shared/Badge";

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
  grand_total: number;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  original_bill_id: string | null;
  credit_note_id: string | null;
  party?: Party;
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

  const creditNote = sReturn?.credit_note
    ? Array.isArray(sReturn.credit_note)
      ? sReturn.credit_note[0]
      : sReturn.credit_note
    : null;

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#6366F1]" />
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
    <div className="p-6 space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
        <div className="flex items-center gap-3">
          <Link href="/sales/returns" className="p-2 hover:bg-[#F1F5F9] rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5 text-[#64748B]" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[#0F172A]">
                Return Details: {sReturn.return_number}
              </h1>
              <span className="px-2.5 py-0.5 bg-[#DCFCE7] text-[#15803D] rounded-full text-[10px] font-bold uppercase tracking-wider">
                {sReturn.status}
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Processed on {sReturn.return_date} · Customer:{" "}
              <span className="font-semibold text-[#0F172A]">{sReturn.party?.name}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {creditNote && (
            <Link
              href={`/sales/credit-notes/${creditNote.id}/print`}
              target="_blank"
              className="px-3.5 py-1.5 text-xs font-bold text-[#6366F1] bg-[#EEF2FF] border border-[#C7D2FE] rounded-lg hover:bg-[#E0E7FF] flex items-center gap-1.5 transition-all"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Credit Note
            </Link>
          )}
          <button
            onClick={() => setDeleteOpen(true)}
            className="px-3.5 py-1.5 text-xs font-bold text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 flex items-center gap-1.5 transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Return
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Original Bill Reference */}
          {sReturn.bill ? (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-3 flex items-center gap-2">
                <ReceiptText className="h-4 w-4" />
                Original Sales Bill
              </h2>
              <div className="flex items-center justify-between">
                <div>
                  <Link
                    href={`/sales/bills/${sReturn.bill.id}`}
                    className="text-[#6366F1] font-bold text-sm font-mono hover:underline flex items-center gap-1.5"
                  >
                    {sReturn.bill.bill_number}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                  <p className="text-xs text-[#64748B] mt-0.5">Dated: {sReturn.bill.bill_date}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#64748B]">Bill Value</p>
                  <p className="font-bold text-[#0F172A] font-mono">{formatCurrency(sReturn.bill.grand_total)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-xs font-semibold text-amber-700">
                No original sales bill linked to this return.
              </p>
            </div>
          )}

          {/* Customer Info */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Customer Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-extrabold text-[#0F172A]">{sReturn.party?.name}</p>
                {sReturn.party?.company_name && (
                  <p className="text-xs text-[#64748B]">{sReturn.party.company_name}</p>
                )}
                {sReturn.party?.gstin && (
                  <p className="text-xs font-mono font-bold text-[#1E293B] mt-1">
                    GSTIN: {sReturn.party.gstin}
                  </p>
                )}
              </div>
              <div className="text-xs text-[#64748B] space-y-0.5">
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
          <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-[#F1F5F9]">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] flex items-center gap-2">
                <Package className="h-4 w-4" />
                Items Returned to Stock
              </h2>
            </div>
            {ledgerEntries.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 italic">
                No stock movement entries found for this return.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-[#E2E8F0] text-[#64748B] font-bold">
                      <th className="p-3">Design</th>
                      <th className="p-3 text-right">Qty Returned</th>
                      <th className="p-3 text-right">Credit Value (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerEntries.map((entry) => (
                      <tr key={entry.id} className="border-b border-[#F1F5F9] last:border-0">
                        <td className="p-3">
                          <p className="font-bold text-[#0F172A]">
                            {entry.design?.name || "—"}
                          </p>
                          {entry.design?.design_number && (
                            <p className="text-[10px] text-[#64748B] font-mono">{entry.design.design_number}</p>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-700">
                          +{Math.abs(entry.quantity_delta)} pcs
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-[#0F172A]">
                          {formatCurrency(Math.abs(entry.value_delta))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Return Reason */}
          {sReturn.return_reason && (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-2">
                Reason for Return
              </h2>
              <p className="text-sm text-[#0F172A] font-medium">{sReturn.return_reason}</p>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Financial Summary */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
              Financial Summary
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-[#64748B] font-semibold">Return Date:</span>
                <span className="font-mono font-bold text-[#0F172A]">{sReturn.return_date}</span>
              </div>
              <div className="border-t border-[#E2E8F0] my-2" />
              <div className="flex justify-between items-center bg-rose-50 border border-rose-100 p-3 rounded-lg">
                <span className="font-bold text-[#DC2626] text-sm">Total Return Value:</span>
                <span className="font-mono font-black text-[#DC2626] text-lg">
                  {formatCurrency(sReturn.grand_total)}
                </span>
              </div>
            </div>
          </div>

          {/* Credit Note Panel */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Credit Note
            </h2>
            {creditNote ? (
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-[#64748B]">CN Number:</span>
                  <span className="font-mono font-bold text-[#6366F1]">{creditNote.cn_number}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-[#64748B]">Date:</span>
                  <span className="font-mono text-[#0F172A]">{creditNote.cn_date}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-[#64748B]">Amount:</span>
                  <span className="font-mono font-bold text-[#16A34A]">{formatCurrency(creditNote.amount)}</span>
                </div>
                {creditNote.reason && (
                  <div className="bg-slate-50 p-2.5 rounded border border-[#E2E8F0] text-[10px] text-[#64748B]">
                    {creditNote.reason}
                  </div>
                )}
                <div className="border-t border-[#E2E8F0] pt-3">
                  <Link
                    href={`/sales/credit-notes/${creditNote.id}/print`}
                    target="_blank"
                    className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-white bg-[#6366F1] hover:bg-[#4F46E5] rounded-lg transition-all shadow-sm"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download / Print Credit Note
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic text-center py-3">
                No credit note linked to this return.
              </p>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Activity</h2>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                <span className="text-[#64748B]">Return recorded on</span>
                <span className="font-semibold text-[#0F172A]">{sReturn.return_date}</span>
              </div>
              {creditNote && (
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-[#6366F1] shrink-0"></span>
                  <span className="text-[#64748B]">Credit Note</span>
                  <span className="font-mono font-semibold text-[#6366F1]">{creditNote.cn_number}</span>
                  <span className="text-[#64748B]">issued</span>
                </div>
              )}
              {ledgerEntries.length > 0 && (
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                  <span className="text-[#64748B]">
                    {ledgerEntries.length} stock entries restored to inventory
                  </span>
                </div>
              )}
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
    </div>
  );
}
