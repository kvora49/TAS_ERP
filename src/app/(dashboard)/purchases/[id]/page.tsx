"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/shared/Badge";
import PageState from "@/components/shared/PageState";
import { RecordPaymentModal } from "@/components/forms/RecordPaymentModal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ArrowLeft, CreditCard, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

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
  const queryClient = useQueryClient();

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<{ purchase: PurchaseDetail }>({
    queryKey: ["purchase-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/raw-materials/purchases/${id}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("Purchase invoice not found");
        throw new Error("Failed to load purchase invoice");
      }
      return res.json();
    },
    staleTime: 30_000,
  });

  const purchase = data?.purchase;

  const handleConfirmCancel = async () => {
    setCancelLoading(true);
    try {
      const res = await fetch(`/api/raw-materials/purchases/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to cancel invoice");
      }
      toast.success("Purchase invoice cancelled successfully");
      setCancelOpen(false);
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-detail", id] });
      refetch();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setCancelLoading(false);
    }
  };

  const outstanding = purchase ? Math.max(0, purchase.grand_total - purchase.paid_amount) : 0;

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-6">
      <PageState
        isLoading={isLoading}
        isError={!!error}
        error={error instanceof Error ? error.message : "Failed to load purchase details"}
        onRetry={refetch}
        isEmpty={!purchase && !isLoading}
        emptyTitle="Purchase Bill Not Found"
        emptyDescription="The requested purchase bill might have been removed or does not exist."
        skeletonVariant="card"
        skeletonCount={3}
      >
        {purchase && (
          <>
            {/* Top Bar / Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 border-b border-[var(--border)] pb-3 sm:pb-4">
              <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => router.push("/purchases")}
                  className="p-2 hover:bg-[var(--page-bg)] rounded-lg text-[var(--text-muted)] transition-colors shrink-0 active:scale-95"
                  title="Back to Purchases"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg sm:text-xl font-extrabold text-[var(--text-primary)] font-mono truncate">
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
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                    Recorded on {purchase.invoice_date} {purchase.invoice_no ? `• Ref: ${purchase.invoice_no}` : ""}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                {purchase.status !== "cancelled" && (
                  <>
                    <Link
                      href={`/purchases/${purchase.id}/edit`}
                      className="flex-1 sm:flex-initial h-9 px-3.5 text-xs font-bold text-[var(--text-secondary)] bg-[var(--card-bg)] border border-[var(--border)] rounded-lg hover:bg-[var(--table-row-hover)] flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit Invoice
                    </Link>
                    {outstanding > 0 && (
                      <button
                        type="button"
                        onClick={() => setPaymentModalOpen(true)}
                        className="flex-1 sm:flex-initial h-9 px-3.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                      >
                        <CreditCard className="h-3.5 w-3.5" /> Record Payment
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setCancelOpen(true)}
                      className="flex-1 sm:flex-initial h-9 px-3.5 text-xs font-bold text-red-500 bg-[var(--card-bg)] border border-red-500/30 hover:bg-red-500/10 rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Cancel
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Left Column: Supplier, Items, Payments */}
              <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                {/* Supplier Info */}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 sm:p-5 shadow-[var(--shadow-sm)] grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h2 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Supplier Details</h2>
                    <span className="text-sm font-extrabold text-[var(--text-primary)] block">{purchase.supplier?.name}</span>
                    {purchase.supplier?.company_name && (
                      <span className="text-xs text-[var(--text-muted)] block mt-0.5">{purchase.supplier.company_name}</span>
                    )}
                    {purchase.supplier?.gstin && (
                      <span className="text-xs font-mono font-bold text-[var(--text-secondary)] block mt-1 uppercase">
                        GSTIN: {purchase.supplier.gstin}
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Billing Address</h2>
                    {purchase.supplier?.billing_address_line1 ? (
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {purchase.supplier.billing_address_line1}
                        {purchase.supplier.billing_address_line2 && `, ${purchase.supplier.billing_address_line2}`}
                        <br />
                        {purchase.supplier.billing_city}, {purchase.supplier.billing_state} - {purchase.supplier.billing_pincode}
                      </p>
                    ) : (
                      <p className="text-xs text-[var(--text-faint)] italic">No address provided</p>
                    )}
                  </div>
                </div>

                {/* Items Section */}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden p-4 sm:p-5 space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] border-l-4 border-[var(--primary)] pl-2.5">
                      Items Purchased ({purchase.items?.length || 0})
                    </h2>
                  </div>

                  {/* ── MOBILE: Item Cards ── */}
                  <div className="md:hidden space-y-2.5">
                    {purchase.items?.map((item) => {
                      const itemName =
                        item.item_type === "finished_goods"
                          ? `${item.design?.design_number || item.design?.name || "Finished Good"} ${item.colour?.colour_name ? `(${item.colour.colour_name})` : ""}`
                          : item.item_type === "others"
                          ? item.other_item_name || "Other Item"
                          : item.material_type?.name || "—";

                      const categoryName =
                        item.item_type === "finished_goods"
                          ? "Finished Goods"
                          : item.item_type === "others"
                          ? item.other_category?.replace("_", " ") || "Expense / Asset"
                          : item.material_type?.category || "Raw Material";

                      return (
                        <div
                          key={item.id}
                          className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-3 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="font-bold text-[var(--text-primary)] text-sm block leading-snug">
                                {itemName}
                              </span>
                              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                                {categoryName}
                              </span>
                            </div>
                            <span className="font-mono font-black text-sm text-[var(--primary)] shrink-0">
                              {formatCurrency(item.amount)}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[var(--border-light)] text-xs">
                            <div>
                              <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Qty</p>
                              <p className="font-bold text-[var(--text-primary)] mt-0.5">{item.quantity} {item.unit}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Rate</p>
                              <p className="font-mono font-bold text-[var(--text-secondary)] mt-0.5">{formatCurrency(item.rate)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Taxable</p>
                              <p className="font-mono font-bold text-[var(--text-primary)] mt-0.5">{formatCurrency(item.taxable_value)}</p>
                            </div>
                          </div>

                          {(purchase.gst_type === "with_gst" || item.discount_percent > 0 || item.hsn_sac) && (
                            <div className="flex items-center flex-wrap gap-2 text-[11px] text-[var(--text-muted)] pt-1">
                              {item.hsn_sac && (
                                <span className="font-mono bg-[var(--card-bg)] px-1.5 py-0.5 rounded border border-[var(--border-light)]">
                                  HSN: {item.hsn_sac}
                                </span>
                              )}
                              {item.discount_percent > 0 && (
                                <span className="font-mono bg-[var(--card-bg)] px-1.5 py-0.5 rounded border border-[var(--border-light)]">
                                  Disc: {item.discount_percent}%
                                </span>
                              )}
                              {purchase.gst_type === "with_gst" && (
                                <span className="font-mono bg-[var(--card-bg)] px-1.5 py-0.5 rounded border border-[var(--border-light)]">
                                  GST {item.gst_percent}% ({formatCurrency(item.gst_amount)})
                                </span>
                              )}
                            </div>
                          )}

                          {item.rolls && item.rolls.length > 0 && (
                            <div className="pt-1.5 border-t border-[var(--border-light)]">
                              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                                Rolls ({item.rolls.length}):
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {item.rolls.map((r) => (
                                  <span
                                    key={r.id}
                                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--card-bg)] border border-[var(--border)] text-[var(--text-secondary)]"
                                  >
                                    #{r.roll_number}: <strong>{r.meters}m</strong> {r.shade ? `(${r.shade})` : ""}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* ── DESKTOP: Line Items Table ── */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold">
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
                            <tr className="border-b border-[var(--border-light)] align-middle hover:bg-[var(--table-row-hover)]">
                              <td className="py-3 pr-2">
                                <span className="font-bold text-[var(--text-primary)]">
                                  {item.item_type === "finished_goods"
                                    ? `${item.design?.design_number || item.design?.name || "Finished Good"} ${item.colour?.colour_name ? `(${item.colour.colour_name})` : ""}`
                                    : item.item_type === "others"
                                    ? item.other_item_name || "Other Item"
                                    : item.material_type?.name || "—"}
                                </span>
                                <span className="text-[10px] text-[var(--text-muted)] block uppercase tracking-wider">
                                  {item.item_type === "finished_goods"
                                    ? "Finished Goods"
                                    : item.item_type === "others"
                                    ? item.other_category?.replace("_", " ") || "Expense / Asset"
                                    : item.material_type?.category || "—"}
                                </span>
                              </td>
                              <td className="py-3 pr-2 font-mono text-[10px] text-[var(--text-muted)]">{item.hsn_sac || "—"}</td>
                              <td className="py-3 pr-2 text-right font-medium text-[var(--text-secondary)]">
                                {item.quantity} {item.unit}
                              </td>
                              <td className="py-3 pr-2 text-right font-mono font-semibold text-[var(--text-primary)]">
                                {formatCurrency(item.rate)}
                              </td>
                              <td className="py-3 pr-2 text-right font-mono text-[var(--text-muted)]">
                                {item.discount_percent}%
                              </td>
                              <td className="py-3 pr-2 text-right font-mono font-semibold text-[var(--text-secondary)]">
                                {formatCurrency(item.taxable_value)}
                              </td>
                              {purchase.gst_type === "with_gst" && (
                                <>
                                  <td className="py-3 pr-2 text-right font-mono text-[var(--text-muted)]">
                                    {item.gst_percent}%
                                  </td>
                                  <td className="py-3 pr-2 text-right font-mono text-[var(--text-muted)]">
                                    {formatCurrency(item.gst_amount)}
                                  </td>
                                </>
                              )}
                              <td className="py-3 text-right font-mono font-bold text-[var(--text-primary)]">
                                {formatCurrency(item.amount)}
                              </td>
                            </tr>
                            {item.rolls && item.rolls.length > 0 && (
                              <tr>
                                <td colSpan={purchase.gst_type === "with_gst" ? 9 : 7} className="pb-3 pt-1 px-2 bg-[var(--page-bg)] rounded-lg">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mr-1">Roll Breakdown:</span>
                                    {item.rolls.map((r) => (
                                      <span key={r.id} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--card-bg)] border border-[var(--border)] text-[var(--text-secondary)]">
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
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] p-4 sm:p-5 space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] border-l-4 border-emerald-500 pl-2.5">
                      Payment History ({purchase.payments?.length || 0})
                    </h2>
                    {purchase.status !== "cancelled" && outstanding > 0 && (
                      <button
                        type="button"
                        onClick={() => setPaymentModalOpen(true)}
                        className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
                      >
                        + Add Payment
                      </button>
                    )}
                  </div>

                  {purchase.payments && purchase.payments.length > 0 ? (
                    <>
                      {/* ── MOBILE: Payment cards ── */}
                      <div className="md:hidden space-y-2">
                        {purchase.payments.map((p) => (
                          <div
                            key={p.id}
                            className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-3 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs text-[var(--text-primary)] capitalize">
                                  {p.payment_mode}
                                </span>
                                <span className="text-[10px] text-[var(--text-muted)] font-mono">
                                  {p.payment_date}
                                </span>
                              </div>
                              <p className="text-[10px] text-[var(--text-faint)] truncate mt-0.5">
                                {p.bank?.bank_name ? `Bank: ${p.bank.bank_name}` : "Direct"}
                                {p.reference_no ? ` • Ref: ${p.reference_no}` : ""}
                              </p>
                            </div>
                            <span className="font-mono font-bold text-sm text-emerald-600 shrink-0">
                              {formatCurrency(p.amount)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* ── DESKTOP: Payment Table ── */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold">
                              <th className="pb-2">Date</th>
                              <th className="pb-2">Mode</th>
                              <th className="pb-2">Ref / Txn No.</th>
                              <th className="pb-2">Bank</th>
                              <th className="pb-2 text-right">Amount (₹)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {purchase.payments.map((p) => (
                              <tr key={p.id} className="border-b border-[var(--border-light)] hover:bg-[var(--table-row-hover)]">
                                <td className="py-2.5 font-mono text-[var(--text-secondary)]">{p.payment_date}</td>
                                <td className="py-2.5 font-semibold capitalize text-[var(--text-primary)]">{p.payment_mode}</td>
                                <td className="py-2.5 font-mono text-[var(--text-muted)]">{p.reference_no || "—"}</td>
                                <td className="py-2.5 text-[var(--text-secondary)]">{p.bank?.bank_name || "Cash / Direct"}</td>
                                <td className="py-2.5 text-right font-mono font-bold text-emerald-600">
                                  {formatCurrency(p.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="p-4 bg-[var(--page-bg)] rounded-lg text-center text-xs text-[var(--text-muted)]">
                      No payment transactions recorded for this invoice yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Financial Breakdown & Metadata */}
              <div className="space-y-4 sm:space-y-6">
                {/* Financial Summary Card */}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 sm:p-5 shadow-[var(--shadow-sm)] space-y-3.5">
                  <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border)] pb-2">
                    Financial Breakdown
                  </h2>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-[var(--text-muted)]">
                      <span>Subtotal (Items)</span>
                      <span className="font-mono font-semibold text-[var(--text-primary)]">{formatCurrency(purchase.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-[var(--text-muted)]">
                      <span>Taxable Amount</span>
                      <span className="font-mono font-semibold text-[var(--text-primary)]">{formatCurrency(purchase.total_taxable_value)}</span>
                    </div>
                    {purchase.gst_type === "with_gst" && (
                      <div className="flex justify-between text-[var(--text-muted)]">
                        <span>Total GST Amount</span>
                        <span className="font-mono font-semibold text-[var(--text-primary)]">{formatCurrency(purchase.total_gst_amount)}</span>
                      </div>
                    )}
                    {purchase.freight > 0 && (
                      <div className="flex justify-between text-[var(--text-muted)]">
                        <span>Freight / Shipping</span>
                        <span className="font-mono text-[var(--text-secondary)]">{formatCurrency(purchase.freight)}</span>
                      </div>
                    )}
                    {purchase.loading_unloading > 0 && (
                      <div className="flex justify-between text-[var(--text-muted)]">
                        <span>Loading / Unloading</span>
                        <span className="font-mono text-[var(--text-secondary)]">{formatCurrency(purchase.loading_unloading)}</span>
                      </div>
                    )}
                    {purchase.other_charges > 0 && (
                      <div className="flex justify-between text-[var(--text-muted)]">
                        <span>Other Charges</span>
                        <span className="font-mono text-[var(--text-secondary)]">{formatCurrency(purchase.other_charges)}</span>
                      </div>
                    )}

                    <div className="border-t border-[var(--border)] pt-2.5 flex justify-between items-center text-sm">
                      <span className="font-bold text-[var(--text-primary)]">Grand Total</span>
                      <span className="font-mono font-extrabold text-base text-[var(--primary)]">
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

                {/* Metadata Card */}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 sm:p-5 shadow-[var(--shadow-sm)] space-y-3">
                  <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border)] pb-2">
                    Invoice Meta
                  </h2>
                  <div className="space-y-2 text-xs text-[var(--text-muted)]">
                    <div>
                      <span className="block font-medium">Godown Location:</span>
                      <span className="font-bold text-[var(--text-primary)]">{purchase.godown?.name || "Main Godown"}</span>
                    </div>
                    <div>
                      <span className="block font-medium">Payment Terms:</span>
                      <span className="font-bold text-[var(--text-primary)]">{purchase.payment_terms_days} Days</span>
                    </div>
                    <div>
                      <span className="block font-medium">Due Date:</span>
                      <span className="font-bold text-[var(--text-primary)] font-mono">{purchase.due_date || "—"}</span>
                    </div>
                    {purchase.notes && (
                      <div>
                        <span className="block font-medium">Notes / Remarks:</span>
                        <p className="text-[var(--text-body)] italic bg-[var(--page-bg)] p-2 rounded border border-[var(--border-light)] mt-1">
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
                queryClient.invalidateQueries({ queryKey: ["purchases"] });
                queryClient.invalidateQueries({ queryKey: ["purchase-detail", id] });
                refetch();
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
          </>
        )}
      </PageState>
    </div>
  );
}
