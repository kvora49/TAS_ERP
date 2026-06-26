"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/shared/Badge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ArrowLeft, Loader2, Calendar, FileText, CheckCircle2, XCircle, Download, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface ReturnItem {
  id: string;
  material_type_id: string;
  hsn_sac: string | null;
  unit: string;
  invoice_qty: number;
  returned_qty: number;
  rate: number;
  discount_percent: number;
  taxable_value: number;
  material_type?: {
    name: string;
    category: string;
  };
}

interface PurchaseReturn {
  id: string;
  return_number: string;
  purchase_id: string;
  supplier_id: string;
  return_date: string;
  return_type: string;
  reason: string | null;
  godown_id: string | null;
  challan_no: string | null;
  remarks: string | null;
  total_taxable_value: number;
  grand_total: number;
  generate_debit_note: boolean;
  debit_note_id: string | null;
  attachments: string[];
  status: "pending" | "completed" | "cancelled";
  supplier?: {
    name: string;
    company_name: string | null;
    gstin: string | null;
  };
  purchase?: {
    purchase_number: string;
    invoice_no: string;
  };
  items: ReturnItem[];
}

export default function PurchaseReturnDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [pReturn, setPReturn] = useState<PurchaseReturn | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchReturnDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/raw-materials/purchase-returns/${id}`);
      if (!res.ok) throw new Error("Failed to fetch return details");
      const data = await res.json();
      setPReturn(data.return);
    } catch (err: any) {
      toast.error(err.message || "Error loading purchase return");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturnDetails();
  }, [id]);

  const updateStatus = async (newStatus: "completed" | "cancelled") => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/raw-materials/purchase-returns/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update return status");

      toast.success(`Purchase return marked as ${newStatus}`);
      fetchReturnDetails();
    } catch (err: any) {
      toast.error(err.message || "Error updating status");
    } finally {
      setUpdating(false);
    }
  };

  const handleDebitNoteClick = () => {
    toast.info("Debit Note Financial Module is coming soon!");
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#6366F1]" />
      </div>
    );
  }

  if (!pReturn) {
    return (
      <div className="p-6 text-center text-sm font-semibold text-red-500">
        Purchase return details not found.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
        <div className="flex items-center gap-3">
          <Link href="/raw-materials/purchase-returns" className="p-2 hover:bg-[#F1F5F9] rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5 text-[#64748B]" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[#0F172A]">
                Return Details: {pReturn.return_number}
              </h1>
              {pReturn.status === "completed" ? (
                <Badge variant="green">Completed</Badge>
              ) : pReturn.status === "cancelled" ? (
                <Badge variant="red">Cancelled</Badge>
              ) : (
                <Badge variant="orange">Pending Approval</Badge>
              )}
            </div>
            <p className="text-xs text-[#64748B]">
              Recorded on {pReturn.return_date} for PO: {pReturn.purchase?.purchase_number}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details & Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary Meta Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h2 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Supplier</h2>
              <span className="text-sm font-extrabold text-[#0F172A] block">{pReturn.supplier?.name}</span>
              {pReturn.supplier?.company_name && (
                <span className="text-xs text-[#64748B] block mt-0.5">{pReturn.supplier.company_name}</span>
              )}
              {pReturn.supplier?.gstin && (
                <span className="text-xs font-mono font-bold text-[#1E293B] block mt-1 uppercase">
                  GSTIN: {pReturn.supplier.gstin}
                </span>
              )}
            </div>

            <div>
              <h2 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Return Details</h2>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between font-semibold">
                  <span className="text-[#64748B]">Original Invoice:</span>
                  <Link
                    href={`/raw-materials/purchases/${pReturn.purchase_id}`}
                    className="text-[#6366F1] font-mono hover:underline"
                  >
                    {pReturn.purchase?.purchase_number}
                  </Link>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-[#64748B]">Challan No:</span>
                  <span className="text-[#1E293B] font-mono">{pReturn.challan_no || "—"}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-[#64748B]">Return Category:</span>
                  <span className="text-[#1E293B] capitalize">{pReturn.return_type.replace("_", " ")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Items returned table */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] mb-4 border-l-4 border-[#6366F1] pl-2.5">
              Returned Items
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[#64748B] font-bold">
                    <th className="pb-2">Material Type</th>
                    <th className="pb-2 w-[80px]">HSN</th>
                    <th className="pb-2 w-[100px] text-right">Invoice Qty</th>
                    <th className="pb-2 w-[110px] text-right">Returned Qty</th>
                    <th className="pb-2 w-[100px] text-right">Rate</th>
                    <th className="pb-2 w-[80px] text-right">Disc (%)</th>
                    <th className="pb-2 w-[120px] text-right">Return Value (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {pReturn.items?.map((item) => (
                    <tr key={item.id} className="border-b border-[#F1F5F9] last:border-0 align-middle">
                      <td className="py-3 pr-2">
                        <span className="font-bold text-[#0F172A]">{item.material_type?.name || "—"}</span>
                        <span className="text-[10px] text-[#64748B] block uppercase tracking-wider">
                          {item.material_type?.category || "—"}
                        </span>
                      </td>
                      <td className="py-3 pr-2 font-mono text-[10px]">{item.hsn_sac || "—"}</td>
                      <td className="py-3 pr-2 text-right text-slate-500 font-medium">
                        {item.invoice_qty} {item.unit}
                      </td>
                      <td className="py-3 pr-2 text-right font-extrabold text-[#DC2626]">
                        {item.returned_qty} {item.unit}
                      </td>
                      <td className="py-3 pr-2 text-right font-mono font-semibold">
                        {formatCurrency(item.rate)}
                      </td>
                      <td className="py-3 pr-2 text-right font-mono">{item.discount_percent}%</td>
                      <td className="py-3 text-right font-mono font-extrabold text-[#0F172A]">
                        {formatCurrency(item.taxable_value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Status timeline, Debit note stub, Actions */}
        <div className="space-y-6">
          {/* Return Value Summary */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B] border-b border-[#F1F5F9] pb-2">
              Financial Return Value
            </h2>
            <div className="flex justify-between items-center bg-red-50/50 p-3.5 rounded-lg border border-red-100 font-bold text-red-700">
              <span>Debit Value:</span>
              <span className="font-mono text-lg font-black">{formatCurrency(pReturn.grand_total)}</span>
            </div>
            {pReturn.reason && (
              <div className="bg-slate-50 p-2.5 rounded border border-[#E2E8F0] text-xs text-[#64748B] font-semibold">
                <span className="font-bold text-slate-800 block">Reason:</span>
                {pReturn.reason}
              </div>
            )}
          </div>

          {/* Status Timeline */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B] border-b border-[#F1F5F9] pb-2">
              Workflow Status Timeline
            </h2>

            <div className="relative border-l border-slate-200 pl-5 ml-2 space-y-5 text-xs">
              {/* Step 1 */}
              <div className="relative">
                <span className="absolute -left-[27px] top-0 w-3.5 h-3.5 rounded-full bg-green-500 border border-white flex items-center justify-center">
                  <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                </span>
                <span className="block font-bold text-slate-800">Return Created</span>
                <span className="block text-[10px] text-slate-500">Draft recorded on {pReturn.return_date}</span>
              </div>

              {/* Step 2 */}
              <div className="relative">
                <span
                  className={`absolute -left-[27px] top-0 w-3.5 h-3.5 rounded-full border border-white flex items-center justify-center ${
                    pReturn.status === "completed" ? "bg-green-500" : "bg-slate-200"
                  }`}
                >
                  {pReturn.status === "completed" ? (
                    <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                  )}
                </span>
                <span className="block font-bold text-slate-800">Inventory Adjusted</span>
                <span className="block text-[10px] text-slate-500">
                  {pReturn.status === "completed"
                    ? "Completed: Stock quantities deducted."
                    : "Awaiting approval to adjust stock figures."}
                </span>

                {pReturn.status === "pending" && (
                  <button
                    onClick={() => updateStatus("completed")}
                    disabled={updating}
                    className="mt-2 px-3 py-1.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold rounded text-[10px] transition-all flex items-center gap-1"
                  >
                    {updating && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                    Approve & Deduct Stock
                  </button>
                )}
              </div>

              {/* Step 3 (Only if cancelled) */}
              {pReturn.status === "cancelled" && (
                <div className="relative text-red-600">
                  <span className="absolute -left-[27px] top-0 w-3.5 h-3.5 rounded-full bg-red-500 border border-white flex items-center justify-center">
                    <XCircle className="h-2.5 w-2.5 text-white" />
                  </span>
                  <span className="block font-bold">Return Cancelled</span>
                  <span className="block text-[10px] text-red-500/80">Soft-cancelled and reverted.</span>
                </div>
              )}
            </div>

            {pReturn.status === "pending" && (
              <button
                onClick={() => updateStatus("cancelled")}
                disabled={updating}
                className="w-full mt-2 py-1.5 border border-red-200 hover:bg-red-50 text-red-600 font-bold rounded text-xs transition-colors flex items-center justify-center gap-1"
              >
                Cancel Return
              </button>
            )}
          </div>

          {/* Debit Note Card */}
          {pReturn.generate_debit_note && (
            <div className="bg-[#EEF2FF] border border-[#CBD5E1] rounded-xl p-5 shadow-sm space-y-2">
              <h3 className="text-xs font-bold text-[#4F46E5] uppercase tracking-wider">Debit Note Stub</h3>
              <p className="text-[10px] text-[#64748B]">
                A debit note adjustment has been recorded on the supplier ledger.
              </p>
              <button
                onClick={handleDebitNoteClick}
                className="w-full text-left p-2.5 bg-white border border-[#CBD5E1] rounded-lg text-xs font-bold text-[#6366F1] hover:bg-[#EEF2FF] transition-all flex items-center justify-between"
              >
                <span>Debit Note: DB-2026-{pReturn.return_number.slice(-4)}</span>
                <Download className="h-3.5 w-3.5 text-[#64748B]" />
              </button>
            </div>
          )}

          {/* Attachments */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B] border-b border-[#F1F5F9] pb-2 mb-3">
              Attachments
            </h2>
            {pReturn.attachments?.length === 0 ? (
              <p className="text-slate-400 text-xs italic text-center py-2">No attachments uploaded</p>
            ) : (
              <div className="space-y-2">
                {pReturn.attachments.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-2 bg-slate-50 border border-[#E2E8F0] rounded-lg text-xs font-bold text-[#6366F1] hover:bg-[#EEF2FF] transition-all"
                  >
                    <span className="flex items-center gap-1.5 truncate pr-2">
                      <FileText className="h-4 w-4 text-[#64748B]" />
                      Return Doc {i + 1}
                    </span>
                    <Download className="h-3.5 w-3.5 shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
