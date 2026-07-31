"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/shared/Badge";
import { RecordPaymentModal } from "@/components/forms/RecordPaymentModal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ArrowLeft, Loader2, CreditCard, Calendar, Printer, Pencil, Trash2, Download, AlertCircle, FileText } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface PurchaseRoll {
  id: string;
  roll_number: string;
  meters: number;
  shade: string;
  comment?: string | null;
  width?: number | null;
  weight_unit?: string | null;
  weight_value?: number | null;
  remaining_meters?: number;
}

interface PurchaseItem {
  id: string;
  material_type_id?: string | null;
  design_id?: string | null;
  colour_id?: string | null;
  size_quantities?: Record<string, number>;
  other_item_name?: string | null;
  other_category?: string | null;
  hsn_sac: string | null;
  unit: string;
  quantity: number;
  rate: number;
  discount_percent: number;
  taxable_value: number;
  gst_percent: number;
  gst_amount: number;
  amount: number;
  item_type?: string;
  rolls?: PurchaseRoll[];
  material_type?: {
    name: string;
    category: string;
  };
  design?: {
    design_number: string;
    name: string;
  };
  colour?: {
    colour_name: string;
  };
}

interface Payment {
  id: string;
  payment_date: string;
  payment_mode: string;
  reference_no: string | null;
  amount: number;
  bank?: { bank_name: string } | null;
}

interface PurchaseDetail {
  id: string;
  purchase_number: string;
  invoice_no: string;
  invoice_date: string;
  gst_type: string;
  payment_terms_days: number;
  due_date: string;
  subtotal: number;
  total_taxable_value: number;
  total_gst_amount: number;
  freight: number;
  loading_unloading: number;
  other_charges: number;
  total_other_charges: number;
  grand_total: number;
  paid_amount: number;
  payment_status: "unpaid" | "partial" | "paid" | "cancelled";
  status: string;
  notes?: string | null;
  supplier?: {
    id: string;
    name: string;
    company_name?: string | null;
    phone?: string | null;
    email?: string | null;
    gstin?: string | null;
    billing_address_line1?: string | null;
    billing_address_line2?: string | null;
    billing_city?: string | null;
    billing_state?: string | null;
    billing_pincode?: string | null;
  };
  godown?: {
    name: string;
  };
  items: PurchaseItem[];
  payments: Payment[];
}

export default function PurchaseDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;

  const [purchase, setPurchase] = useState<PurchaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/raw-materials/purchases/${id}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("Purchase invoice not found");
        throw new Error("Failed to load purchase invoice");
      }
      const data = await res.json();
      setPurchase(data.purchase);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleConfirmCancel = async () => {
    setCancelLoading(true);
    try {
      const res = await fetch(`/api/raw-materials/purchases/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cancel invoice");
      }
      toast.success("Purchase invoice cancelled successfully");
      setCancelOpen(false);
      fetchDetail();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setCancelLoading(false);
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
      <div className="flex flex-col items-center justify-center p-24 gap-3">
        <Loader2 className="h-8 w-8 text-[#6366F1] animate-spin" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Loading Purchase Details...
        </span>
      </div>
    );
  }

  if (error || !purchase) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <button
          onClick={() => router.push("/purchases")}
          className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-4"
        >
          <ArrowLeft size={14} /> Back to Purchases
        </button>
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-xl text-center space-y-3">
          <AlertCircle className="h-8 w-8 mx-auto text-red-500" />
          <h2 className="text-base font-bold">{error || "Purchase Bill Not Found"}</h2>
          <p className="text-xs text-red-600">The requested purchase bill might have been removed or does not exist.</p>
        </div>
      </div>
    );
  }

  const outstanding = Math.max(0, purchase.grand_total - purchase.paid_amount);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/purchases")}
            className="p-2 hover:bg-[#F1F5F9] rounded-lg text-[#64748B] transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-extrabold text-[#0F172A] font-mono">
                {purchase.purchase_number}
              </h1>
              {purchase.status === "cancelled" ? (
                <Badge variant="red">Cancelled</Badge>
              ) : purchase.payment_status === "paid" ? (
                <Badge variant="green">Paid</Badge>
              ) : purchase.payment_status === "partial" ? (
                <Badge variant="orange">Partial</Badge>
              ) : (
                <Badge variant="red">Unpaid</Badge>
              )}
            </div>
            <p className="text-xs text-[#64748B]">
              Recorded on {purchase.invoice_date} • Supplier Ref: {purchase.invoice_no}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {purchase.status !== "cancelled" && (
            <>
              <Link
                href={`/purchases/${purchase.id}/edit`}
                className="px-3.5 py-1.5 text-xs font-bold text-[#475569] bg-white border border-[#CBD5E1] rounded-lg hover:bg-[#F8FAFC] flex items-center gap-1.5 transition-all"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit Invoice
              </Link>
              {outstanding > 0 && (
                <button
                  onClick={() => setPaymentModalOpen(true)}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <CreditCard className="h-3.5 w-3.5" /> Record Payment
                </button>
              )}
              <button
                onClick={() => setCancelOpen(true)}
                className="px-3.5 py-1.5 text-xs font-bold text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-lg flex items-center gap-1.5 transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" /> Cancel Invoice
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Supplier, Items, Payments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Supplier Info */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h2 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Supplier Details</h2>
              <span className="text-sm font-extrabold text-[#0F172A] block">{purchase.supplier?.name}</span>
              {purchase.supplier?.company_name && (
                <span className="text-xs text-[#64748B] block mt-0.5">{purchase.supplier.company_name}</span>
              )}
              {purchase.supplier?.gstin && (
                <span className="text-xs font-mono font-bold text-[#1E293B] block mt-1 uppercase">
                  GSTIN: {purchase.supplier.gstin}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Billing Address</h2>
              {purchase.supplier?.billing_address_line1 ? (
                <p className="text-xs text-[#1E293B] leading-relaxed">
                  {purchase.supplier.billing_address_line1}
                  {purchase.supplier.billing_address_line2 && `, ${purchase.supplier.billing_address_line2}`}
                  <br />
                  {purchase.supplier.billing_city}, {purchase.supplier.billing_state} - {purchase.supplier.billing_pincode}
                </p>
              ) : (
                <p className="text-xs text-slate-400 italic">No address provided</p>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] mb-4 border-l-4 border-[#6366F1] pl-2.5">
              Items Purchased
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[#64748B] font-bold">
                    <th className="pb-2">Material Type</th>
                    <th className="pb-2 w-[80px]">HSN/SAC</th>
                    <th className="pb-2 w-[80px] text-right">Qty</th>
                    <th className="pb-2 w-[90px] text-right">Rate</th>
                    <th className="pb-2 w-[70px] text-right">Disc (%)</th>
                    <th className="pb-2 w-[100px] text-right">Taxable (₹)</th>
                    {purchase.gst_type === "with_gst" && (
                      <>
                        <th className="pb-2 w-[60px] text-right">GST %</th>
                        <th className="pb-2 w-[90px] text-right">GST Amt</th>
                      </>
                    )}
                    <th className="pb-2 w-[110px] text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {purchase.items?.map((item) => (
                    <React.Fragment key={item.id}>
                      <tr className="border-b border-[#F1F5F9] align-middle">
                        <td className="py-3 pr-2">
                          <span className="font-bold text-[#0F172A]">
                            {item.item_type === "finished_goods"
                              ? `${item.design?.design_number || item.design?.name || "Finished Good"} ${item.colour?.colour_name ? `(${item.colour.colour_name})` : ""}`
                              : item.item_type === "others"
                              ? item.other_item_name || "Other Item"
                              : item.material_type?.name || "—"}
                          </span>
                          <span className="text-[10px] text-[#64748B] block uppercase tracking-wider">
                            {item.item_type === "finished_goods"
                              ? "Finished Goods"
                              : item.item_type === "others"
                              ? item.other_category?.replace("_", " ") || "Expense / Asset"
                              : item.material_type?.category || "—"}
                          </span>
                        </td>
                        <td className="py-3 pr-2 font-mono text-[10px]">{item.hsn_sac || "—"}</td>
                        <td className="py-3 pr-2 text-right font-medium">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="py-3 pr-2 text-right font-mono font-semibold">
                          {formatCurrency(item.rate)}
                        </td>
                        <td className="py-3 pr-2 text-right font-mono text-slate-500">
                          {item.discount_percent}%
                        </td>
                        <td className="py-3 pr-2 text-right font-mono font-semibold">
                          {formatCurrency(item.taxable_value)}
                        </td>
                        {purchase.gst_type === "with_gst" && (
                          <>
                            <td className="py-3 pr-2 text-right font-mono text-slate-500">
                              {item.gst_percent}%
                            </td>
                            <td className="py-3 pr-2 text-right font-mono text-slate-500">
                              {formatCurrency(item.gst_amount)}
                            </td>
                          </>
                        )}
                        <td className="py-3 text-right font-mono font-bold text-[#0F172A]">
                          {formatCurrency(item.amount)}
                        </td>
                      </tr>
                      {item.rolls && item.rolls.length > 0 && (
                        <tr>
                          <td colSpan={purchase.gst_type === "with_gst" ? 9 : 7} className="pb-3 pt-1 px-2 bg-slate-50/50 rounded-lg">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">Roll Breakdown:</span>
                              {item.rolls.map((r) => (
                                <span key={r.id} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-white border border-slate-200 text-slate-700">
                                  Roll #{r.roll_number}: <strong>{r.meters}m</strong> {r.shade ? `(${r.shade})` : ""} {r.remaining_meters !== undefined ? `[Rem: ${r.remaining_meters}m]` : ""}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment History */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] border-l-4 border-[#16A34A] pl-2.5">
                Payment History ({purchase.payments?.length || 0})
              </h2>
              {purchase.status !== "cancelled" && outstanding > 0 && (
                <button
                  onClick={() => setPaymentModalOpen(true)}
                  className="text-xs font-bold text-[#16A34A] hover:underline"
                >
                  + Add Payment
                </button>
              )}
            </div>

            {purchase.payments && purchase.payments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-[#64748B] font-bold">
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Mode</th>
                      <th className="pb-2">Ref / Txn No.</th>
                      <th className="pb-2">Bank</th>
                      <th className="pb-2 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchase.payments.map((p) => (
                      <tr key={p.id} className="border-b border-[#F1F5F9]">
                        <td className="py-2.5 font-mono">{p.payment_date}</td>
                        <td className="py-2.5 font-semibold capitalize">{p.payment_mode}</td>
                        <td className="py-2.5 font-mono text-slate-500">{p.reference_no || "—"}</td>
                        <td className="py-2.5 text-slate-600">{p.bank?.bank_name || "Cash / Direct"}</td>
                        <td className="py-2.5 text-right font-mono font-bold text-emerald-600">
                          {formatCurrency(p.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-lg text-center text-xs text-slate-500">
                No payment transactions recorded for this invoice yet.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Financial Summary Card */}
        <div className="space-y-6">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-[#64748B] uppercase tracking-wider border-b border-[#E2E8F0] pb-2">
              Financial Breakdown
            </h2>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-[#64748B]">
                <span>Subtotal (Items)</span>
                <span className="font-mono font-semibold text-[#0F172A]">{formatCurrency(purchase.subtotal)}</span>
              </div>
              <div className="flex justify-between text-[#64748B]">
                <span>Taxable Amount</span>
                <span className="font-mono font-semibold text-[#0F172A]">{formatCurrency(purchase.total_taxable_value)}</span>
              </div>
              {purchase.gst_type === "with_gst" && (
                <div className="flex justify-between text-[#64748B]">
                  <span>Total GST Amount</span>
                  <span className="font-mono font-semibold text-[#0F172A]">{formatCurrency(purchase.total_gst_amount)}</span>
                </div>
              )}
              {purchase.freight > 0 && (
                <div className="flex justify-between text-[#64748B]">
                  <span>Freight / Shipping</span>
                  <span className="font-mono text-slate-700">{formatCurrency(purchase.freight)}</span>
                </div>
              )}
              {purchase.loading_unloading > 0 && (
                <div className="flex justify-between text-[#64748B]">
                  <span>Loading / Unloading</span>
                  <span className="font-mono text-slate-700">{formatCurrency(purchase.loading_unloading)}</span>
                </div>
              )}
              {purchase.other_charges > 0 && (
                <div className="flex justify-between text-[#64748B]">
                  <span>Other Charges</span>
                  <span className="font-mono text-slate-700">{formatCurrency(purchase.other_charges)}</span>
                </div>
              )}

              <div className="border-t border-[#E2E8F0] pt-3 flex justify-between items-center text-sm">
                <span className="font-bold text-[#0F172A]">Grand Total</span>
                <span className="font-mono font-extrabold text-base text-[#6366F1]">
                  {formatCurrency(purchase.grand_total)}
                </span>
              </div>

              <div className="flex justify-between text-xs pt-1">
                <span className="text-emerald-600 font-medium">Paid Amount</span>
                <span className="font-mono font-bold text-emerald-600">{formatCurrency(purchase.paid_amount)}</span>
              </div>

              <div className="flex justify-between text-xs">
                <span className="text-amber-600 font-bold">Balance Due</span>
                <span className="font-mono font-bold text-amber-600">{formatCurrency(outstanding)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-3">
            <h2 className="text-xs font-bold text-[#64748B] uppercase tracking-wider border-b border-[#E2E8F0] pb-2">
              Invoice Meta
            </h2>
            <div className="space-y-2 text-xs text-[#64748B]">
              <div>
                <span className="block font-medium">Godown Location:</span>
                <span className="font-bold text-[#0F172A]">{purchase.godown?.name || "Main Godown"}</span>
              </div>
              <div>
                <span className="block font-medium">Payment Terms:</span>
                <span className="font-bold text-[#0F172A]">{purchase.payment_terms_days} Days</span>
              </div>
              <div>
                <span className="block font-medium">Due Date:</span>
                <span className="font-bold text-[#0F172A] font-mono">{purchase.due_date || "—"}</span>
              </div>
              {purchase.notes && (
                <div>
                  <span className="block font-medium">Notes / Remarks:</span>
                  <p className="text-slate-700 italic bg-slate-50 p-2 rounded border border-slate-100 mt-1">
                    {purchase.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RECORD PAYMENT MODAL */}
      <RecordPaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        purchase={purchase}
        onSuccess={() => {
          fetchDetail();
        }}
      />

      {/* CANCEL CONFIRM DIALOG */}
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel Purchase Invoice"
        description={`Are you sure you want to cancel ${purchase.purchase_number}? This will reverse inventory stock additions.`}
        confirmText="Confirm Cancel"
        loading={cancelLoading}
        onConfirm={handleConfirmCancel}
      />
    </div>
  );
}
