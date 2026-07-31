"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/shared/Badge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ArrowLeft, Loader2, Calendar, FileText, CheckCircle2, XCircle, Download, AlertTriangle, Pencil } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { DebitNoteModal } from "@/components/modals/DebitNoteModal";
import { useRouter } from "next/navigation";

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
  const router = useRouter();

  const [pReturn, setPReturn] = useState<PurchaseReturn | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [debitNoteModalOpen, setDebitNoteModalOpen] = useState(false);

  const fetchReturnDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/raw-materials/purchase-returns/${id}`);
      if (!res.ok) throw new Error("Failed to load return details");
      const data = await res.json();
      setPReturn(data.return);
    } catch (err: any) {
      toast.error(err.message || "Could not fetch details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturnDetails();
  }, [id]);

  const handleCancel = async () => {
    try {
      setCancelling(true);
      const res = await fetch(`/api/raw-materials/purchase-returns/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to cancel return");
      }

      toast.success("Purchase return cancelled successfully");
      setCancelModalOpen(false);
      fetchReturnDetails();
    } catch (err: any) {
      toast.error(err.message || "An error occurred during cancellation");
    } finally {
      setCancelling(false);
    }
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
          <Link href="/purchases?tab=returns" className="p-2 hover:bg-[#F1F5F9] rounded-lg transition-colors">
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

        {pReturn.status !== "cancelled" && (
          <div className="flex items-center gap-3">
            <Link
              href={`/purchases/returns/${pReturn.id}/edit`}
              className="px-4 py-2 border border-[#CBD5E1] bg-white text-[#475569] text-xs font-bold rounded-lg hover:bg-[#F8FAFC] flex items-center gap-2 transition-all"
            >
              <Pencil className="h-4 w-4" /> Edit Return
            </Link>

            {pReturn.generate_debit_note && pReturn.debit_note_id && (
              <button
                onClick={() => setDebitNoteModalOpen(true)}
                className="px-4 py-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all shadow-sm"
              >
                <FileText className="h-4 w-4" /> View Debit Note
              </button>
            )}

            <button
              onClick={() => setCancelModalOpen(true)}
              className="px-4 py-2 border border-red-200 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 flex items-center gap-2 transition-all"
            >
              <XCircle className="h-4 w-4" /> Cancel Return
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Supplier & Purchase Info */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Supplier Info</h3>
              <p className="text-sm font-bold text-[#0F172A]">{pReturn.supplier?.name}</p>
              {pReturn.supplier?.company_name && (
                <p className="text-xs text-[#64748B]">{pReturn.supplier.company_name}</p>
              )}
              {pReturn.supplier?.gstin && (
                <p className="text-xs font-mono text-[#475569] mt-1">GSTIN: {pReturn.supplier.gstin}</p>
              )}
            </div>

            <div>
              <h3 className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Original Invoice Reference</h3>
              <p className="text-sm font-bold text-[#0F172A]">PO #{pReturn.purchase?.purchase_number || "Direct"}</p>
              {pReturn.purchase?.invoice_no && (
                <p className="text-xs text-[#64748B]">Supplier Inv #: {pReturn.purchase.invoice_no}</p>
              )}
              {pReturn.challan_no && (
                <p className="text-xs text-[#64748B]">Delivery Challan: {pReturn.challan_no}</p>
              )}
            </div>
          </div>

          {/* Returned Items Table */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden p-5">
            <h3 className="text-sm font-bold text-[#0F172A] mb-4">Returned Items Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[#64748B] font-bold">
                    <th className="pb-2">Material / Item</th>
                    <th className="pb-2 text-right">Inv Qty</th>
                    <th className="pb-2 text-right">Returned Qty</th>
                    <th className="pb-2 text-right">Rate</th>
                    <th className="pb-2 text-right">Taxable Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {pReturn.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3">
                        <span className="font-bold text-[#0F172A] block">{item.material_type?.name || "Raw Material"}</span>
                        <span className="text-[10px] text-[#64748B]">{item.material_type?.category}</span>
                      </td>
                      <td className="py-3 text-right text-[#64748B]">
                        {item.invoice_qty} {item.unit}
                      </td>
                      <td className="py-3 text-right font-bold text-red-600">
                        {item.returned_qty} {item.unit}
                      </td>
                      <td className="py-3 text-right font-mono">{formatCurrency(item.rate)}</td>
                      <td className="py-3 text-right font-mono font-bold text-[#0F172A]">
                        {formatCurrency(item.taxable_value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Info Sidebar */}
        <div className="space-y-6">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider border-b border-[#E2E8F0] pb-2">
              Financial Summary
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-[#64748B]">
                <span>Taxable Amount</span>
                <span className="font-mono font-semibold text-[#0F172A]">
                  {formatCurrency(pReturn.total_taxable_value)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold text-[#0F172A] border-t border-[#E2E8F0] pt-2">
                <span>Grand Total Return</span>
                <span className="font-mono text-red-600">{formatCurrency(pReturn.grand_total)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider border-b border-[#E2E8F0] pb-2">
              Return Context
            </h3>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-[#64748B] block font-medium">Return Type</span>
                <span className="font-bold text-[#0F172A] capitalize">{pReturn.return_type.replace("_", " ")}</span>
              </div>
              {pReturn.reason && (
                <div>
                  <span className="text-[#64748B] block font-medium">Reason for Return</span>
                  <p className="text-[#374151] bg-[#F8FAFC] p-2 rounded border border-[#E2E8F0] mt-1">
                    {pReturn.reason}
                  </p>
                </div>
              )}
              {pReturn.remarks && (
                <div>
                  <span className="text-[#64748B] block font-medium">Remarks</span>
                  <p className="text-[#374151] italic">{pReturn.remarks}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        open={cancelModalOpen}
        onOpenChange={setCancelModalOpen}
        title="Cancel Purchase Return"
        description="Are you sure you want to cancel this return transaction? Stock quantities will be adjusted back."
        confirmText="Confirm Cancel"
        loading={cancelling}
        onConfirm={handleCancel}
      />

      {/* Debit Note Modal */}
      {pReturn.debit_note_id && (
        <DebitNoteModal
          open={debitNoteModalOpen}
          onClose={() => setDebitNoteModalOpen(false)}
          pReturn={pReturn}
        />
      )}
    </div>
  );
}
