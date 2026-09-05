"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/shared/Badge";
import PageState from "@/components/shared/PageState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ArrowLeft, FileText, XCircle, Pencil } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { DebitNoteModal } from "@/components/modals/DebitNoteModal";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

interface ReturnItem {
  id: string;
  item_type?: string;
  material_type_id: string | null;
  design_id?: string | null;
  colour_id?: string | null;
  size_quantities?: Record<string, number> | null;
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
  design?: {
    id: string;
    design_number: string;
    name: string;
  };
  colour?: {
    id: string;
    colour_name: string;
    colour_hex?: string;
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
    invoice_date?: string;
    grand_total?: number;
  };
  items: ReturnItem[];
}

export default function PurchaseReturnDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const queryClient = useQueryClient();

  // Modals state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [debitNoteModalOpen, setDebitNoteModalOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<{ return: PurchaseReturn }>({
    queryKey: ["purchase-return-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/raw-materials/purchase-returns/${id}`);
      if (!res.ok) throw new Error("Failed to load return details");
      return res.json();
    },
    staleTime: 30_000,
  });

  const pReturn = data?.return;

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
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-return-detail", id] });
      refetch();
    } catch (err: any) {
      toast.error(err.message || "An error occurred during cancellation");
    } finally {
      setCancelling(false);
    }
  };

  const { business, brandConfig, logoUrl } = useCompanyProfile();

  const refDoc = pReturn?.purchase
    ? {
        invoice_number: pReturn.purchase.invoice_no || pReturn.purchase.purchase_number,
        invoice_date: pReturn.purchase.invoice_date || "",
        invoice_amount: pReturn.purchase.grand_total || 0,
        payment_made: 0,
        note_amount: pReturn?.grand_total || 0,
      }
    : null;

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-12">
      <PageState
        isLoading={isLoading}
        isError={!!error}
        error={error instanceof Error ? error.message : "Failed to load purchase return details"}
        onRetry={refetch}
        isEmpty={!pReturn && !isLoading}
        emptyTitle="Purchase Return Not Found"
        emptyDescription="The requested purchase return might have been removed or does not exist."
        skeletonVariant="card"
        skeletonCount={3}
      >
        {pReturn && (
          <div className="space-y-4 sm:space-y-6 print:hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 border-b border-[var(--border)] pb-3 sm:pb-4">
              <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                <Link
                  href="/purchases?tab=returns"
                  className="p-2 hover:bg-[var(--page-bg)] rounded-lg text-[var(--text-muted)] transition-colors shrink-0 active:scale-95"
                  title="Back to Returns"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Link>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] font-mono truncate">
                      {pReturn.return_number}
                    </h1>
                    {pReturn.status === "completed" ? (
                      <Badge variant="green">Completed</Badge>
                    ) : pReturn.status === "cancelled" ? (
                      <Badge variant="red">Cancelled</Badge>
                    ) : (
                      <Badge variant="orange">Pending Approval</Badge>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                    Recorded on {pReturn.return_date} {pReturn.purchase?.purchase_number ? `for PO: ${pReturn.purchase.purchase_number}` : ""}
                  </p>
                </div>
              </div>

              {pReturn.status !== "cancelled" && (
                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                  <Link
                    href={`/purchases/returns/${pReturn.id}/edit`}
                    className="flex-1 sm:flex-initial h-9 px-3.5 border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-secondary)] text-xs font-bold rounded-lg hover:bg-[var(--table-row-hover)] flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit Return
                  </Link>

                  {pReturn.generate_debit_note && pReturn.debit_note_id && (
                    <button
                      type="button"
                      onClick={() => setDebitNoteModalOpen(true)}
                      className="flex-1 sm:flex-initial h-9 px-3.5 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5" /> View Debit Note
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setCancelModalOpen(true)}
                    className="flex-1 sm:flex-initial h-9 px-3.5 border border-red-500/30 bg-[var(--card-bg)] text-red-500 text-xs font-bold rounded-lg hover:bg-red-500/10 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Cancel Return
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Left main content */}
              <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                {/* Supplier & Purchase Info */}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 sm:p-5 shadow-[var(--shadow-sm)] grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Supplier Info</h3>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{pReturn.supplier?.name}</p>
                    {pReturn.supplier?.company_name && (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">{pReturn.supplier.company_name}</p>
                    )}
                    {pReturn.supplier?.gstin && (
                      <p className="text-xs font-mono text-[var(--text-secondary)] mt-1 uppercase">
                        GSTIN: {pReturn.supplier.gstin}
                      </p>
                    )}
                  </div>

                  <div>
                    <h3 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Original Invoice Reference</h3>
                    <p className="text-sm font-bold text-[var(--text-primary)]">PO #{pReturn.purchase?.purchase_number || "Direct"}</p>
                    {pReturn.purchase?.invoice_no && (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">Supplier Inv #: {pReturn.purchase.invoice_no}</p>
                    )}
                    {pReturn.challan_no && (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">Delivery Challan: {pReturn.challan_no}</p>
                    )}
                  </div>
                </div>

                {/* Returned Items */}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden p-4 sm:p-5 space-y-3 sm:space-y-4">
                  <h3 className="text-sm font-bold text-[var(--text-primary)] border-l-4 border-purple-500 pl-2.5">
                    Returned Items Breakdown ({pReturn.items.length})
                  </h3>

                  {/* ── MOBILE: Returned Item Cards ── */}
                  <div className="md:hidden space-y-2.5">
                    {pReturn.items.map((item) => {
                      const itemName =
                        item.item_type === "finished_goods" || item.design
                          ? `${item.design?.design_number || item.design?.name || "Finished Good"}${item.colour?.colour_name ? ` (${item.colour.colour_name})` : ""}`
                          : item.material_type?.name || "Material";
                      const categoryText =
                        item.item_type === "finished_goods"
                          ? "Finished Goods"
                          : item.material_type?.category || item.item_type || "Raw Material";

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
                                {categoryText}
                              </span>
                            </div>
                            <span className="font-mono font-black text-sm text-red-500 shrink-0">
                              {formatCurrency(item.taxable_value)}
                            </span>
                          </div>

                          {item.size_quantities && Object.keys(item.size_quantities).length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {Object.entries(item.size_quantities).map(([sz, q]) => (
                                <span
                                  key={sz}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--border-light)] font-bold"
                                >
                                  {sz}: {q} Pcs
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[var(--border-light)] text-xs">
                            <div>
                              <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Inv Qty</p>
                              <p className="font-medium text-[var(--text-muted)] mt-0.5">{item.invoice_qty} {item.unit}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Returned</p>
                              <p className="font-bold text-red-500 mt-0.5">{item.returned_qty} {item.unit}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Rate</p>
                              <p className="font-mono font-bold text-[var(--text-primary)] mt-0.5">{formatCurrency(item.rate)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ── DESKTOP: Returned Items Table ── */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold">
                          <th className="pb-2">Material / Item</th>
                          <th className="pb-2 text-right">Inv Qty</th>
                          <th className="pb-2 text-right">Returned Qty</th>
                          <th className="pb-2 text-right">Rate</th>
                          <th className="pb-2 text-right">Taxable Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-light)]">
                        {pReturn.items.map((item) => {
                          const itemName =
                            item.item_type === "finished_goods" || item.design
                              ? `${item.design?.design_number || item.design?.name || "Finished Good"}${item.colour?.colour_name ? ` (${item.colour.colour_name})` : ""}`
                              : item.material_type?.name || "Material";
                          const categoryText =
                            item.item_type === "finished_goods"
                              ? "Finished Goods"
                              : item.material_type?.category || item.item_type || "Raw Material";

                          return (
                            <tr key={item.id} className="hover:bg-[var(--table-row-hover)]">
                              <td className="py-3">
                                <span className="font-bold text-[var(--text-primary)] block">{itemName}</span>
                                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block">{categoryText}</span>
                                {item.size_quantities && Object.keys(item.size_quantities).length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {Object.entries(item.size_quantities).map(([sz, q]) => (
                                      <span
                                        key={sz}
                                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--border-light)] font-bold"
                                      >
                                        {sz}: {q} Pcs
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 text-right text-[var(--text-muted)]">
                                {item.invoice_qty} {item.unit}
                              </td>
                              <td className="py-3 text-right font-bold text-red-500">
                                {item.returned_qty} {item.unit}
                              </td>
                              <td className="py-3 text-right font-mono text-[var(--text-secondary)]">{formatCurrency(item.rate)}</td>
                              <td className="py-3 text-right font-mono font-bold text-[var(--text-primary)]">
                                {formatCurrency(item.taxable_value)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right Info Sidebar */}
              <div className="space-y-4 sm:space-y-6">
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 sm:p-5 shadow-[var(--shadow-sm)] space-y-3.5">
                  <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border)] pb-2">
                    Financial Summary
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-[var(--text-muted)]">
                      <span>Taxable Amount</span>
                      <span className="font-mono font-semibold text-[var(--text-primary)]">
                        {formatCurrency(pReturn.total_taxable_value)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-[var(--text-primary)] border-t border-[var(--border)] pt-2.5">
                      <span>Grand Total Return</span>
                      <span className="font-mono font-black text-red-500">{formatCurrency(pReturn.grand_total)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 sm:p-5 shadow-[var(--shadow-sm)] space-y-3">
                  <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border)] pb-2">
                    Return Context
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-[var(--text-muted)] block font-medium">Return Type</span>
                      <span className="font-bold text-[var(--text-primary)] capitalize">{pReturn.return_type.replace("_", " ")}</span>
                    </div>
                    {pReturn.reason && (
                      <div>
                        <span className="text-[var(--text-muted)] block font-medium">Reason for Return</span>
                        <p className="text-[var(--text-body)] bg-[var(--page-bg)] p-2 rounded border border-[var(--border-light)] mt-1">
                          {pReturn.reason}
                        </p>
                      </div>
                    )}
                    {pReturn.remarks && (
                      <div>
                        <span className="text-[var(--text-muted)] block font-medium">Remarks</span>
                        <p className="text-[var(--text-body)] italic">{pReturn.remarks}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </PageState>

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
      {pReturn && pReturn.debit_note_id && (
        <DebitNoteModal
          open={debitNoteModalOpen}
          onClose={() => setDebitNoteModalOpen(false)}
          pReturn={pReturn}
          company={
            business
              ? {
                  name: business.name,
                  address: business.address,
                  gstin: business.gstin,
                  phone: business.phone,
                  email: business.email,
                }
              : undefined
          }
          config={brandConfig}
          logoUrl={logoUrl}
          referenceDoc={refDoc}
        />
      )}
    </div>
  );
}
