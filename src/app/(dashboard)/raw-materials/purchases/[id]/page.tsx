"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/shared/Badge";
import { RecordPaymentModal } from "@/components/forms/RecordPaymentModal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ArrowLeft, Loader2, CreditCard, Calendar, Printer, Pencil, Trash2, Download, AlertCircle, FileText } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface PurchaseItem {
  id: string;
  material_type_id: string;
  hsn_sac: string | null;
  unit: string;
  quantity: number;
  rate: number;
  discount_percent: number;
  taxable_value: number;
  gst_percent: number;
  gst_amount: number;
  amount: number;
  material_type?: {
    name: string;
    category: string;
  };
}

interface Payment {
  id: string;
  payment_date: string;
  payment_mode: string;
  reference_no: string | null;
  paid_amount: number;
  remarks: string | null;
}

interface Supplier {
  id: string;
  name: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_pincode: string | null;
}

interface Purchase {
  id: string;
  purchase_number: string;
  invoice_no: string;
  invoice_date: string;
  due_date: string | null;
  payment_terms: string;
  transporter: string | null;
  place_of_supply: string | null;
  gst_type: "with_gst" | "without_gst" | "reverse_charge";
  notes: string | null;
  subtotal: number;
  total_taxable_value: number;
  total_gst_amount: number;
  freight: number;
  loading_unloading: number;
  other_charges: number;
  total_other_charges: number;
  grand_total: number;
  amount_in_words: string | null;
  paid_amount: number;
  payment_status: "unpaid" | "partial" | "paid" | "cancelled";
  status: "active" | "draft" | "cancelled";
  attachments: string[];
  supplier?: Supplier;
  items: PurchaseItem[];
  payments: Payment[];
}

export default function PurchaseDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const fetchPurchaseDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/raw-materials/purchases/${id}`);
      if (!res.ok) throw new Error("Failed to fetch purchase details");
      const data = await res.json();
      setPurchase(data.purchase);
    } catch (err: any) {
      toast.error(err.message || "Error loading purchase info");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchaseDetails();
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
      fetchPurchaseDetails();
    } catch (err: any) {
      toast.error(err.message || "Could not cancel invoice");
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
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#6366F1]" />
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="p-6 text-center text-sm font-semibold text-red-500">
        Purchase invoice not found or could not be loaded.
      </div>
    );
  }

  const outstanding = Number(purchase.grand_total) - Number(purchase.paid_amount || 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
        <div className="flex items-center gap-3">
          <Link href="/raw-materials/purchases" className="p-2 hover:bg-[#F1F5F9] rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5 text-[#64748B]" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[#0F172A]">
                Invoice Details: {purchase.purchase_number}
              </h1>
              {purchase.status === "cancelled" ? (
                <Badge variant="red">Cancelled</Badge>
              ) : purchase.payment_status === "paid" ? (
                <Badge variant="green">Fully Paid</Badge>
              ) : purchase.payment_status === "partial" ? (
                <Badge variant="orange">Partially Paid</Badge>
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
                href={`/raw-materials/purchases/${purchase.id}/edit`}
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
                    <tr key={item.id} className="border-b border-[#F1F5F9] last:border-0 align-middle">
                      <td className="py-3 pr-2">
                        <span className="font-bold text-[#0F172A]">{item.material_type?.name || "—"}</span>
                        <span className="text-[10px] text-[#64748B] block uppercase tracking-wider">
                          {item.material_type?.category || "—"}
                        </span>
                      </td>
                      <td className="py-3 pr-2 font-mono text-[10px]">{item.hsn_sac || "—"}</td>
                      <td className="py-3 pr-2 text-right font-medium">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-3 pr-2 text-right font-mono font-semibold">
                        {formatCurrency(item.rate)}
                      </td>
                      <td className="py-3 pr-2 text-right font-mono">{item.discount_percent}%</td>
                      <td className="py-3 pr-2 text-right font-mono font-semibold text-slate-700">
                        {formatCurrency(item.taxable_value)}
                      </td>
                      {purchase.gst_type === "with_gst" && (
                        <>
                          <td className="py-3 pr-2 text-right font-mono">{item.gst_percent}%</td>
                          <td className="py-3 pr-2 text-right font-mono font-semibold text-slate-500">
                            {formatCurrency(item.gst_amount)}
                          </td>
                        </>
                      )}
                      <td className="py-3 text-right font-mono font-extrabold text-[#0F172A]">
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Logs */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] mb-4 border-l-4 border-[#6366F1] pl-2.5">
              Payment Transactions
            </h2>

            {purchase.payments?.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs italic">
                No payments have been recorded for this invoice yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-[#64748B] font-bold">
                      <th className="pb-2">Payment Date</th>
                      <th className="pb-2">Payment Mode</th>
                      <th className="pb-2">Reference No.</th>
                      <th className="pb-2">Remarks</th>
                      <th className="pb-2 text-right">Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchase.payments.map((py) => (
                      <tr key={py.id} className="border-b border-[#F1F5F9] last:border-0 py-2.5">
                        <td className="py-2.5 font-mono text-[10px]">{py.payment_date}</td>
                        <td className="py-2.5 capitalize font-semibold">{py.payment_mode.replace("_", " ")}</td>
                        <td className="py-2.5 font-mono text-[10px] text-[#64748B]">{py.reference_no || "—"}</td>
                        <td className="py-2.5 text-[#64748B]">{py.remarks || "—"}</td>
                        <td className="py-2.5 text-right font-mono font-extrabold text-green-700">
                          {formatCurrency(py.paid_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Calculations, Logistics, Attachments */}
        <div className="space-y-6">
          {/* Calculations panel */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B] border-b border-[#F1F5F9] pb-2">
              Financial Breakdown
            </h2>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-[#64748B] font-semibold">
                <span>Taxable Value:</span>
                <span className="font-mono">{formatCurrency(purchase.total_taxable_value)}</span>
              </div>
              <div className="flex justify-between text-[#64748B] font-semibold">
                <span>GST Tax Value (+):</span>
                <span className="font-mono">{formatCurrency(purchase.total_gst_amount)}</span>
              </div>
              <div className="flex justify-between text-[#64748B] font-semibold">
                <span>Additional Charges (+):</span>
                <span className="font-mono">{formatCurrency(purchase.total_other_charges)}</span>
              </div>

              <div className="border-t border-[#E2E8F0] my-2" />

              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-[#E2E8F0]">
                <span className="font-bold text-[#0F172A]">Grand Total (₹):</span>
                <span className="font-mono font-black text-slate-800">
                  {formatCurrency(purchase.grand_total)}
                </span>
              </div>

              <div className="flex justify-between items-center p-2.5">
                <span className="font-semibold text-green-700">Already Paid:</span>
                <span className="font-mono font-extrabold text-green-700">
                  {formatCurrency(purchase.paid_amount || 0)}
                </span>
              </div>

              <div className="flex justify-between items-center bg-indigo-50 border border-indigo-100 p-2.5 rounded-lg">
                <span className="font-extrabold text-[#4F46E5]">Balance Outstanding:</span>
                <span className="font-mono font-black text-[#4F46E5]">
                  {formatCurrency(outstanding)}
                </span>
              </div>

              {purchase.amount_in_words && (
                <div className="bg-slate-50 p-2.5 rounded border border-[#E2E8F0] text-[10px] text-[#64748B] font-semibold italic">
                  <span className="font-bold uppercase text-[9px] text-[#4F46E5] block not-italic">Amount in Words:</span>
                  {purchase.amount_in_words}
                </div>
              )}
            </div>
          </div>

          {/* Logistics & Other settings */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm space-y-3.5 text-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B] border-b border-[#F1F5F9] pb-2">
              Logistics & Details
            </h2>
            <div className="flex justify-between font-semibold">
              <span className="text-[#64748B]">Payment Terms:</span>
              <span className="text-[#1E293B] capitalize">{purchase.payment_terms.replace("_", " ")}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span className="text-[#64748B]">Due Date:</span>
              <span className="text-[#1E293B] font-mono">{purchase.due_date || "—"}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span className="text-[#64748B]">Transporter:</span>
              <span className="text-[#1E293B]">{purchase.transporter || "—"}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span className="text-[#64748B]">Place of Supply:</span>
              <span className="text-[#1E293B]">{purchase.place_of_supply || "—"}</span>
            </div>
          </div>

          {/* Attachments Section */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B] border-b border-[#F1F5F9] pb-2 mb-3">
              Invoice Attachments
            </h2>
            {purchase.attachments?.length === 0 ? (
              <p className="text-slate-400 text-xs italic text-center py-2">No attachments uploaded</p>
            ) : (
              <div className="space-y-2">
                {purchase.attachments.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-2 bg-slate-50 border border-[#E2E8F0] rounded-lg text-xs font-bold text-[#6366F1] hover:bg-[#EEF2FF] transition-all"
                  >
                    <span className="flex items-center gap-1.5 truncate pr-2">
                      <FileText className="h-4 w-4 text-[#64748B]" />
                      Invoice File {i + 1}
                    </span>
                    <Download className="h-3.5 w-3.5 shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RECORD PAYMENT MODAL */}
      <RecordPaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        purchase={purchase}
        onSuccess={fetchPurchaseDetails}
      />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel Purchase Invoice"
        description={`Are you sure you want to cancel purchase invoice ${purchase.purchase_number}? This will revert any stock entries and mark it cancelled.`}
        confirmText="Cancel Invoice"
        loading={cancelLoading}
        onConfirm={handleConfirmCancel}
      />
    </div>
  );
}
