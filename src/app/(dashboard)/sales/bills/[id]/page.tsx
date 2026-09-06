"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useERPQuery, useERPMutation } from "@/hooks/useERPQuery";
import {
  ArrowLeft,
  Printer,
  Trash2,
  Lock,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Truck,
  User,
  Calendar,
  AlertCircle,
  Loader2,
  FileText,
  Copy,
  Check,
  CheckCircle2,
  MessageSquare,
  Edit2,
  Share2,
} from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { Modal } from "@/components/shared/Modal";
import PageState from "@/components/shared/PageState";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { openWhatsApp, shareInvoiceWithWhatsApp } from "@/lib/utils/whatsapp";
import { shareContent } from "@/lib/share";
import { getPublicBillUrl } from "@/lib/utils/baseUrl";
import { numberToWords } from "@/lib/utils/numberToWords";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PakkaBillTemplate } from "@/components/sales/PakkaBillTemplate";
import { KachaBillTemplate } from "@/components/sales/KachaBillTemplate";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";

interface BillItem {
  id: string;
  item_type?: string;
  material_type_id?: string | null;
  item_name?: string | null;
  design_id?: string | null;
  design_code?: string;
  size?: string;
  colour_id?: string | null;
  colour_name?: string;
  quantity: number;
  rate: number;
  discount_percent: number;
  tax_percent: number;
  amount: number;
  hsn_sac: string | null;
  design?: {
    id: string;
    design_number: string;
    name: string;
  };
  colour?: {
    id: string;
    colour_name: string;
  };
  material_type?: {
    id: string;
    name: string;
    unit?: string;
  };
  rolls?: Array<{
    id?: string;
    roll_number: string;
    meters: number;
    shade?: string;
  }>;
}

interface BillCharge {
  id: string;
  charge_name: string;
  charge_type: "flat" | "per_qty" | "percentage";
  is_taxable: boolean;
  amount: number;
}

interface SaleBill {
  id: string;
  bill_number: string;
  bill_type: "pakka" | "kacha";
  bill_date: string;
  due_date: string;
  payment_terms: string;
  ship_to_same_as_bill_to?: boolean;
  consignee_name?: string | null;
  consignee_address?: string | null;
  consignee_gstin?: string | null;
  consignee_state?: string | null;
  consignee_state_code?: string | null;
  buyer_order_no?: string | null;
  buyer_order_date?: string | null;
  dispatch_doc_no?: string | null;
  delivery_note?: string | null;
  delivery_note_date?: string | null;
  dispatched_through?: string | null;
  destination?: string | null;
  terms_of_delivery?: string | null;
  mode_of_payment?: string | null;
  print_exclusions?: Record<string, boolean>;
  reference_no: string | null;
  billing_address: string | null;
  phone: string | null;
  gstin: string | null;
  gst_treatment: string;
  transporter_name: string | null;
  vehicle_no: string | null;
  salesman: string | null;
  remarks: string | null;
  item_total: number;
  charges_total: number;
  discount_amount: number;
  taxable_amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  round_off: number;
  grand_total: number;
  paid_amount?: number;
  payment_status: "unpaid" | "partial" | "paid" | "overdue";

  status: "draft" | "active" | "cancelled";
  is_temporary?: boolean;
  party: {
    name: string;
    company_name: string | null;
    gstin: string | null;
  };
  items: BillItem[];
  charges: BillCharge[];
}

interface ProfitData {
  cogs: number;
  sale_value: number;
  net_profit: number;
  profit_margin_percent: number;
}

export default function SaleBillDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;

  const [copied, setCopied] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  const { data, isPending: loading, isError, error, refetch } = useERPQuery(
    ["sales-bill-detail", id as string],
    async () => {
      const res = await fetch(`/api/sales/bills/${id}`);
      if (!res.ok) throw new Error("Failed to fetch bill details");
      return res.json();
    },
    { enabled: !!id }
  );

  const { data: generalSettingsData } = useERPQuery(
    ["general-settings"],
    async () => {
      const res = await fetch("/api/settings/general");
      if (!res.ok) return null;
      return res.json();
    },
    { staleTime: 60_000 }
  );

  const enableKachaBilling = generalSettingsData?.settings?.enable_kacha_billing ?? true;

  const { getEffectiveLogo, business } = useCompanyProfile();

  const bill: SaleBill | null = data?.bill ?? null;
  const profit: ProfitData | null = data?.profit ?? null;
  const brand = data?.brand ?? null;
  const brandConfig = data?.brandConfig ?? null;

  const companyProfile = {
    name: brand?.name || business?.name || "",
    address: brand?.address || business?.address || "",
    gstin: brand?.gstin || business?.gstin || "",
    pan: brand?.pan || "",
    phone: brand?.phone || business?.phone || "",
    email: brand?.email || (business as any)?.email || "",
  };
  const logoUrl = getEffectiveLogo(brand?.logo_url);

  const cancelMutation = useERPMutation(
    async () => {
      const res = await fetch(`/api/sales/bills/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to cancel bill");
      }
    },
    {
      successMessage: "Bill cancelled successfully",
      invalidates: [
        ["sales-bills"],
        ["sales-bill-detail", id as string],
        ["finished-stock"],
        ["designs-list"],
        ["design-detail-filters"],
        ["godowns-list"],
        ["dashboard-stats"],
        ["raw-materials-stock"],
        ["raw-materials"],
      ],
      onSuccess: () => {
        router.push("/sales/bills");
        router.refresh();
      },
    }
  );

  const handleCancelBill = () => {
    setIsCancelOpen(true);
  };

  const handleConfirmCancel = () => {
    cancelMutation.mutate(undefined);
  };

  const handleCopyWords = () => {
    if (!bill) return;
    navigator.clipboard.writeText(numberToWords(bill.grand_total));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cancelling = cancelMutation.isPending;

  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [converting, setConverting] = useState(false);

  const handleConfirmConvert = async (targetType: "pakka" | "kacha") => {
    setConverting(true);
    try {
      const res = await fetch(`/api/sales/bills/${id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_bill_type: targetType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to convert bill");

      toast.success(json.message || "Converted to official invoice!");
      setConvertModalOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setConverting(false);
    }
  };

  if (loading || isError || !bill) {
    return (
      <PageState
        isLoading={loading}
        isError={isError}
        error={error instanceof Error ? error.message : "Failed to load bill"}
        onRetry={refetch}
        isEmpty={!loading && !bill}
        emptyTitle="Bill Not Found"
        emptyMessage="The requested sales bill does not exist or has been deleted."
        emptyAction={
          <Link href="/sales/bills" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            Go Back to List
          </Link>
        }
        skeletonVariant="form"
      >
        <></>
      </PageState>
    );
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR"
    }).format(val);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "green";
      case "cancelled":
        return "red";
      case "draft":
        return "gray";
      default:
        return "gray";
    }
  };

  const amountInWords = numberToWords(bill.grand_total);

  const handleWhatsAppShare = () => {
    if (!bill) return;
    const formattedTotal = bill.grand_total.toLocaleString("en-IN", { minimumFractionDigits: 2 });
    const billDate = new Date(bill.bill_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const billUrl = getPublicBillUrl(bill.id);
    const partyName = (bill.party?.company_name || bill.party?.name || "Customer").trim();
    const msg = `Dear ${partyName},\n\nPlease find your invoice ${bill.bill_number} for ₹${formattedTotal} dated ${billDate}.\n\nView/Download Invoice:\n${billUrl}\n\nThank you for your business!`;
    const targetPhone = (bill as any).phone || (bill.party as any)?.phone || "";
    shareInvoiceWithWhatsApp({
      phone: targetPhone,
      text: msg,
      billId: bill.id,
      fileName: `Invoice-${bill.bill_number}.pdf`,
    });
  };

  const handleNativeShare = async () => {
    if (!bill) return;
    const formattedTotal = bill.grand_total.toLocaleString("en-IN", { minimumFractionDigits: 2 });
    const billDate = new Date(bill.bill_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const billUrl = getPublicBillUrl(bill.id);
    const partyName = (bill.party?.company_name || bill.party?.name || "Customer").trim();

    await shareContent({
      title: `Invoice ${bill.bill_number}`,
      text: `Tax Invoice ${bill.bill_number} for ${partyName} - ₹${formattedTotal} (${billDate})`,
      url: billUrl,
    });
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 pb-20 md:pb-0">
      {/* ── MOBILE APP HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[var(--border)] pb-4 gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <Link href="/sales/bills"
            className="p-2 rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--card-bg)] transition-colors shrink-0"
          ><ArrowLeft className="h-4 w-4" /></Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-black text-[var(--text-primary)] font-mono">{bill.bill_number}</h1>
              <Badge variant={getStatusColor(bill.status)} className="uppercase tracking-wider text-[10px]">{bill.status}</Badge>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Date: {new Date(bill.bill_date).toLocaleDateString("en-IN")}</p>
          </div>
        </div>

        {/* Action Header — accessible on both mobile and desktop, right-aligned */}
        <div className="flex items-center justify-end self-end sm:self-auto w-full sm:w-auto ml-auto gap-1.5 sm:gap-2 select-none flex-wrap">
          {bill.is_temporary && (
            <button onClick={() => setConvertModalOpen(true)}
              className="h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-lg text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
            ><CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span>Convert</span></button>
          )}

          {bill.status !== "cancelled" && (
            <Link href={`/sales/bills/${bill.id}/edit`}
              className="h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-lg text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Edit</span>
            </Link>
          )}

          <button onClick={handleNativeShare}
            className="h-8 sm:h-9 px-2.5 sm:px-3.5 border border-[var(--border)] rounded-lg text-xs font-semibold text-[var(--text-primary)] bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Share via native sheet or copy link"
          >
            <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[var(--primary)]" />
            <span className="hidden sm:inline">Share</span>
          </button>

          <button onClick={handleWhatsAppShare}
            className="h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-lg text-xs font-bold text-white bg-[#25D366] hover:bg-[#1ebe5d] transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
          ><MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden sm:inline">WhatsApp</span></button>

          <button onClick={() => window.open(`/sales/bills/${bill.id}/print`, "_blank")}
            className="h-8 sm:h-9 px-2.5 sm:px-3.5 border border-[var(--border)] rounded-lg text-xs font-semibold text-[var(--text-primary)] bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] transition-colors flex items-center gap-1.5 cursor-pointer"
          ><Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Print</span></button>

          {bill.status !== "cancelled" && (
            <button disabled={cancelling} onClick={handleCancelBill}
              className="h-8 sm:h-9 px-2.5 sm:px-3.5 border border-rose-500/30 rounded-lg text-xs font-semibold text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            ><Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Cancel</span></button>
          )}
        </div>
      </div>

      {/* ── HERO SUMMARY CARD (Mobile & Desktop) ── */}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-sm)] space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center sm:text-left">
          <div className="p-3 rounded-xl bg-[var(--page-bg)] border border-[var(--border-light)]">
            <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider block">Grand Total</span>
            <span className="text-base sm:text-xl font-black text-[var(--primary)] mt-0.5 block">₹{bill.grand_total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="p-3 rounded-xl bg-[var(--page-bg)] border border-[var(--border-light)]">
            <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider block">Paid Amount</span>
            <span className="text-base sm:text-xl font-black text-emerald-600 mt-0.5 block">₹{Number(bill.paid_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="p-3 rounded-xl bg-[var(--page-bg)] border border-[var(--border-light)]">
            <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider block">Balance Due</span>
            <span className={cn("text-base sm:text-xl font-black mt-0.5 block", (bill.grand_total - Number(bill.paid_amount || 0)) > 0 ? "text-amber-500" : "text-[var(--text-muted)]")}>
              ₹{Math.max(0, bill.grand_total - Number(bill.paid_amount || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[var(--page-bg)] border border-[var(--border-light)] flex flex-col justify-center items-center sm:items-start">
            <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider block mb-1">Due Counter</span>
            <span className="text-xs font-bold text-[var(--text-primary)]">
              {(() => {
                if (bill.due_date) {
                  const due = new Date(bill.due_date);
                  if (!isNaN(due.getTime()) && due.getFullYear() > 1970) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    due.setHours(0, 0, 0, 0);
                    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 3600 * 24));
                    if (diffDays < 0) return `${Math.abs(diffDays)} Days Overdue`;
                    if (diffDays === 0) return "Due Today";
                    return `${diffDays} Days Left (${due.toLocaleDateString("en-IN")})`;
                  }
                }
                return bill.payment_terms || "Net 15 Days";
              })()}
            </span>
          </div>
        </div>
      </div>


      {/* Temporary Bill Banner Notice */}
      {bill.is_temporary && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 shrink-0 font-bold">
              ⚡
            </div>
            <div>
              <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wider">Temporary Bill / Estimate Notice</h4>
              <p className="text-xs text-purple-700 font-medium">
                This bill exists purely for reference/quotation. It has not affected inventory stock, sales revenue, or customer ledgers.
              </p>
            </div>
          </div>
          <button
            onClick={() => setConvertModalOpen(true)}
            className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition-colors cursor-pointer shrink-0 shadow-sm"
          >
            Convert to Official Invoice
          </button>
        </div>
      )}

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Columns (Col Span 2): Bill Details & Items */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Section 1: Parties details */}
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-5 shadow-[var(--shadow-sm)] grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border-light)] pb-1 flex items-center gap-1.5">
                <User className="h-4 w-4 text-[var(--primary)]" />
                <span>Billed To</span>
              </span>
              <span className="font-bold text-sm text-[var(--text-primary)]">{bill.party?.name}</span>
              {bill.party?.company_name && (
                <span className="text-xs text-[var(--text-secondary)]">{bill.party.company_name}</span>
              )}
              {bill.billing_address && (
                <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-xs">{bill.billing_address}</p>
              )}
              {bill.phone && <span className="text-xs text-[var(--text-muted)]">Mobile: {bill.phone}</span>}
              {bill.gstin && <span className="text-xs text-emerald-600 font-semibold">GSTIN: {bill.gstin}</span>}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border-light)] pb-1 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-[var(--primary)]" />
                <span>Invoice Details</span>
              </span>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs text-[var(--text-secondary)]">
                <span className="text-[var(--text-muted)]">Invoice Date:</span>
                <span className="font-semibold text-[var(--text-primary)]">{new Date(bill.bill_date).toLocaleDateString("en-IN")}</span>

                <span className="text-[var(--text-muted)]">Due Date:</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {bill.due_date && !isNaN(new Date(bill.due_date).getTime()) && new Date(bill.due_date).getFullYear() > 1970
                    ? new Date(bill.due_date).toLocaleDateString("en-IN")
                    : "—"}
                </span>

                <span className="text-[var(--text-muted)]">Payment Terms:</span>
                <span className="font-semibold capitalize text-[var(--text-primary)]">{bill.payment_terms ? bill.payment_terms.replace("_", " ") : "—"}</span>

                <span className="text-[var(--text-muted)]">GST Treatment:</span>
                <span className="font-semibold capitalize text-[var(--text-primary)]">{bill.gst_treatment}</span>

                {bill.reference_no && (
                  <>
                    <span className="text-[var(--text-muted)]">Reference No:</span>
                    <span className="font-semibold font-mono text-[var(--text-primary)]">{bill.reference_no}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Transport & Remarks */}
          {(bill.transporter_name || bill.vehicle_no || bill.remarks) && (
            <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-5 shadow-[var(--shadow-sm)] grid grid-cols-1 md:grid-cols-2 gap-6">
              {(bill.transporter_name || bill.vehicle_no) && (
                <div className="flex flex-col gap-2 text-xs">
                  <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border-light)] pb-1 flex items-center gap-1.5">
                    <Truck className="h-4 w-4 text-[var(--primary)]" />
                    <span>Transport details</span>
                  </span>
                  <div className="grid grid-cols-2 gap-y-2 text-[var(--text-secondary)]">
                    <span className="text-[var(--text-muted)]">Transporter:</span>
                    <span className="font-semibold text-[var(--text-primary)]">{bill.transporter_name || "N/A"}</span>

                    <span className="text-[var(--text-muted)]">Vehicle No:</span>
                    <span className="font-semibold text-[var(--text-primary)]">{bill.vehicle_no || "N/A"}</span>
                  </div>
                </div>
              )}

              {bill.remarks && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border-light)] pb-1">
                    Internal Remarks
                  </span>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed italic bg-[var(--page-bg)] border border-[var(--border-light)] rounded-lg p-2.5">
                    {bill.remarks}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Section 3: Items Table */}
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] shadow-[var(--shadow-sm)] overflow-hidden flex flex-col">
            <h3 className="px-5 py-4 border-b border-[var(--border-light)] text-sm font-bold text-[var(--text-primary)]">
              Items Invoiced ({bill.items.length})
            </h3>
            {/* Mobile View: Item Cards (md:hidden) */}
            <div className="md:hidden divide-y divide-[var(--border)]">
              {bill.items.map((it, idx) => {
                const gross = it.quantity * it.rate;
                const netTaxable = gross * (1 - it.discount_percent / 100);
                const itemGst = netTaxable * (it.tax_percent / 100);
                const totalAmount = netTaxable + itemGst;

                return (
                  <div key={it.id} className="p-3.5 space-y-2 bg-[var(--card-bg)]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-[var(--page-bg)] border border-[var(--border)] text-[10px] font-bold text-[var(--text-muted)] flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          {it.item_type === "fabric" || it.material_type_id || it.material_type ? (
                            <>
                              <span className="font-bold text-xs text-[var(--text-primary)] block truncate">
                                {it.material_type?.name || it.item_name || "Raw Material Fabric"}
                              </span>
                              {it.rolls && it.rolls.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {it.rolls.map((r: any, rIdx: number) => (
                                    <span key={rIdx} className="px-1.5 py-0.5 bg-[var(--primary-light)] border border-[var(--primary)]/20 rounded text-[10px] font-mono font-bold text-[var(--primary)]">
                                      Roll #{r.roll_number}: {r.meters}m{r.shade ? ` (${r.shade})` : ""}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="font-bold text-xs text-[var(--text-primary)] block truncate">
                                {it.design?.design_number || it.design_code || "Design"} {it.design?.name ? `— ${it.design.name}` : ""}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[var(--text-muted)]">
                                <span>Size: <strong className="text-[var(--text-secondary)]">{it.size || "Free"}</strong></span>
                                <span>·</span>
                                <span>Colour: <strong className="text-[var(--text-secondary)]">{it.colour?.colour_name || it.colour_name || "—"}</strong></span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <span className="font-bold font-mono text-sm text-[var(--primary)] shrink-0">
                        ₹{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Rates & Qty breakdown */}
                    <div className="grid grid-cols-3 text-center border-t border-[var(--border-light)] pt-1.5 text-xs">
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)] uppercase block">Qty</span>
                        <span className="font-bold text-[var(--text-primary)] font-mono">
                          {it.quantity} {it.item_type === "fabric" || it.material_type_id ? "M" : "Pcs"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)] uppercase block">Rate</span>
                        <span className="font-bold text-[var(--text-primary)] font-mono">
                          ₹{it.rate.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)] uppercase block">Tax</span>
                        <span className="font-semibold text-blue-600 font-mono">
                          {it.tax_percent}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Full Table (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--border)] text-left text-xs">
                <thead className="bg-[var(--table-header-bg)] text-[var(--text-muted)] font-bold uppercase tracking-wider select-none">
                  <tr>
                    <th className="px-5 py-3">#</th>
                    <th className="px-5 py-3">Item Details</th>
                    <th className="px-5 py-3 text-center">Qty</th>
                    <th className="px-5 py-3 text-right">Rate</th>
                    <th className="px-5 py-3 text-center">Disc (%)</th>
                    <th className="px-5 py-3 text-center">Tax</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-sm bg-[var(--card-bg)] text-[var(--text-primary)]">
                  {bill.items.map((it, idx) => {
                    const gross = it.quantity * it.rate;
                    const netTaxable = gross * (1 - it.discount_percent / 100);
                    const itemGst = netTaxable * (it.tax_percent / 100);
                    const totalAmount = netTaxable + itemGst;

                    return (
                      <tr key={it.id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                        <td className="px-5 py-4 text-xs text-[var(--text-muted)] font-semibold">{idx + 1}</td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col">
                            {it.item_type === "fabric" || it.material_type_id || it.material_type ? (
                              <>
                                <span className="font-semibold text-[var(--text-primary)]">
                                  {it.material_type?.name || it.item_name || "Raw Material Fabric"}
                                </span>
                                {it.rolls && it.rolls.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {it.rolls.map((r: any, rIdx: number) => (
                                      <span key={rIdx} className="px-1.5 py-0.5 bg-[var(--primary-light)] border border-[var(--primary)]/20 rounded text-[10px] font-mono font-bold text-[var(--primary)]">
                                        Roll #{r.roll_number}: {r.meters}m{r.shade ? ` (${r.shade})` : ""}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                <span className="font-semibold">{it.design?.design_number || it.design_code || "Unknown Design"} ({it.size})</span>
                                <span className="text-[10px] text-[var(--text-faint)] font-mono">Colour: {it.colour?.colour_name || it.colour_name || "—"}</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">{it.quantity} {it.item_type === "fabric" || it.material_type_id ? "Meters" : "Pcs"}</td>
                        <td className="px-5 py-4 text-right">₹{it.rate.toFixed(2)}</td>
                        <td className="px-5 py-4 text-center">{it.discount_percent}%</td>
                        <td className="px-5 py-4 text-center">
                          <span className="px-2 py-0.5 bg-[var(--primary-light)] text-[var(--primary)] rounded text-[10px] font-semibold">
                            {it.tax_percent}%
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-semibold">
                          ₹{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Totals Summary & Conditional Profit Margin Panel */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Bill Totals Summary Card */}
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-5 shadow-[var(--shadow-sm)] flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] mb-2 pb-2 border-b border-[var(--border-light)]">
              <FileText className="h-4.5 w-4.5 text-[var(--primary)]" />
              <span>Bill Totals</span>
            </h3>

            <div className="flex flex-col gap-2.5 text-xs text-[var(--text-secondary)]">
              <div className="flex items-center justify-between">
                <span>Gross Item Value</span>
                <span className="font-semibold text-[var(--text-primary)]">{formatCurrency(bill.item_total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Charges Total</span>
                <span className="font-semibold text-[var(--text-primary)]">{formatCurrency(bill.charges_total)}</span>
              </div>
              {bill.discount_amount > 0 && (
                <div className="flex items-center justify-between text-red-500 font-semibold">
                  <span>Overall Discount</span>
                  <span>-{formatCurrency(bill.discount_amount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-[var(--border-light)] pt-2 text-xs">
                <span>Taxable Amount</span>
                <span className="font-semibold text-[var(--text-primary)]">{formatCurrency(bill.taxable_amount)}</span>
              </div>
              {bill.cgst > 0 && (
                <div className="flex items-center justify-between">
                  <span>CGST</span>
                  <span>{formatCurrency(bill.cgst)}</span>
                </div>
              )}
              {bill.sgst > 0 && (
                <div className="flex items-center justify-between">
                  <span>SGST</span>
                  <span>{formatCurrency(bill.sgst)}</span>
                </div>
              )}
              {bill.igst > 0 && (
                <div className="flex items-center justify-between">
                  <span>IGST</span>
                  <span>{formatCurrency(bill.igst)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-b border-[var(--border-light)] pb-2 text-[10px] text-[var(--text-muted)]">
                <span>Round Off</span>
                <span>{bill.round_off >= 0 ? "+" : ""}{formatCurrency(bill.round_off)}</span>
              </div>
              <div className="flex items-center justify-between py-1 text-sm">
                <span className="font-semibold text-[var(--text-primary)]">Grand Total</span>
                <span className="text-lg font-bold text-[var(--primary)]">{formatCurrency(bill.grand_total)}</span>
              </div>

              {/* Amount in words */}
              <div className="bg-emerald-500/10 rounded-lg p-3 mt-2 border border-emerald-500/20 relative flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Amount in Words</span>
                  <span className="text-xs font-semibold text-emerald-600 leading-relaxed">{amountInWords}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyWords}
                  className="text-emerald-600 hover:bg-emerald-500/20 p-1 rounded transition-colors shrink-0 cursor-pointer"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Conditional RLS/Role-Protected Profit Margin Card */}
          {profit && (
            <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-5 shadow-[var(--shadow-sm)] flex flex-col gap-4 animate-fadeIn">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border-light)] pb-3">
                <Lock className="h-4.5 w-4.5 text-emerald-600" />
                <span>Profit Margin & COGS</span>
              </h3>

              <div className="flex flex-col gap-3.5 text-xs text-[var(--text-secondary)]">
                <div className="flex justify-between items-center">
                  <span>Cost of Goods Sold (COGS)</span>
                  <span className="font-semibold text-[var(--text-primary)]">{formatCurrency(profit.cogs)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span>Net Sale Value (Post-Tax)</span>
                  <span className="font-semibold text-[var(--text-primary)]">{formatCurrency(profit.sale_value)}</span>
                </div>

                <div className="flex justify-between items-center border-t border-[var(--border-light)] pt-3">
                  <span className="font-medium text-[var(--text-primary)]">Net Profit Amount</span>
                  <span className={`font-bold text-sm ${profit.net_profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {formatCurrency(profit.net_profit)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-medium text-[var(--text-primary)]">Net Profit Margin (%)</span>
                  <span
                    className={`font-extrabold text-sm px-2.5 py-0.5 rounded-full flex items-center gap-1 ${profit.profit_margin_percent >= 15
                        ? "bg-emerald-500/10 text-emerald-600"
                        : profit.profit_margin_percent >= 5
                          ? "bg-amber-500/10 text-amber-600"
                          : "bg-red-500/10 text-red-500"
                      }`}
                  >
                    {profit.profit_margin_percent >= 0 ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    <span>{profit.profit_margin_percent.toFixed(2)}%</span>
                  </span>
                </div>

                {/* Secure Badge */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5 text-[10px] text-blue-500 font-medium leading-normal flex items-start gap-2">
                  <Lock className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                  <span>
                    Secure RLS Panel. This detailed cost and margin information is encrypted and accessible only to authorized Administrators and Owners.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PRINT-ONLY AREA */}
      <div id="print-area" className="hidden print:block text-slate-900 bg-white p-0 w-full font-sans">
        <style dangerouslySetInnerHTML={{
          __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            #print-area, #print-area * {
              visibility: visible;
            }
            #print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
          }
        `}} />
        {(() => {
          const rawItems = bill.items || (bill as any).sale_bill_items || (bill as any).items_data || [];
          const normalizedItems = rawItems.map((it: any, idx: number) => {
            const isFabric = it.item_type === "fabric" || !!it.material_type || !!it.material_type_id || !!it.raw_material_type_id || (it.unit && /met(er|re)|mtr/i.test(it.unit));
            const designName = it.design?.name || it.design_name || "";
            const matName = it.material_type?.name || it.material_name || "";
            const itemName = it.item_name || it.name || it.title || designName || matName || (it.description ? it.description.split("\n")[0] : `Item #${idx + 1}`);
            const articleNo = it.design?.design_number || it.design_code || it.article_no || it.design_number || "";
            const colourName = it.colour?.colour_name || it.colour_name || it.colour || it.color || "";
            const hsnCode = it.hsn_sac || it.design?.hsn_sac || it.material_type?.hsn_sac || (it.material_type as any)?.hsn_code || it.hsn || "—";
            const qty = Number(it.quantity || it.qty || 0);
            const rate = Number(it.rate || 0);
            const disc = Number(it.discount_percent || 0);
            const tax = Number(it.tax_percent || 0);
            const amt = Number(it.amount || (qty * rate * (1 - disc / 100)) || 0);

            return {
              ...it,
              id: it.id || `item-${idx}`,
              item_type: isFabric ? "fabric" : "finished_goods",
              item_name: itemName,
              design_code: articleNo,
              colour_name: colourName,
              hsn_sac: hsnCode,
              quantity: qty,
              rate: rate,
              discount_percent: disc,
              tax_percent: tax,
              amount: amt,
              unit: it.unit || (isFabric ? "MTR" : "PCS"),
              size_quantities: it.size_quantities || (it.size ? { [it.size]: qty } : null),
              rolls: it.rolls || [],
            };
          });

          const billData = {
            ...bill,
            item_total: Number(bill.item_total),
            charges_total: Number(bill.charges_total || 0),
            discount_amount: Number(bill.discount_amount || 0),
            taxable_amount: Number(bill.taxable_amount),
            cgst: Number(bill.cgst),
            sgst: Number(bill.sgst),
            igst: Number(bill.igst),
            round_off: Number(bill.round_off || 0),
            grand_total: Number(bill.grand_total),
            items: normalizedItems,
          };

          return bill.bill_type === "kacha" ? (
            <KachaBillTemplate
              bill={billData}
              company={companyProfile}
              config={brandConfig}
              exclusions={bill.print_exclusions || {}}
              logoUrl={logoUrl}
            />
          ) : (
            <PakkaBillTemplate
              bill={billData}
              company={companyProfile}
              config={brandConfig}
              exclusions={bill?.print_exclusions || {}}
              logoUrl={logoUrl}
            />
          );
        })()}
      </div>

      <ConfirmDialog
        open={isCancelOpen}
        onOpenChange={setIsCancelOpen}
        title="Cancel Bill"
        description="Are you sure you want to cancel/soft-delete this bill? Stock adjustments will be reversed."
        onConfirm={handleConfirmCancel}
        confirmText="Yes, Cancel Bill"
        cancelText="Keep Bill"
      />

      {/* Convert Temporary Bill Modal */}
      <Modal
        open={convertModalOpen}
        onOpenChange={setConvertModalOpen}
        title="Convert Temporary Bill to Official Invoice"
        description="Select the official invoice type to assign a sequential bill number and trigger stock & account ledgers."
        maxWidth="max-w-md"
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-[var(--text-body)]">
            Converting temporary bill <strong className="font-mono text-[var(--primary)]">{bill?.bill_number}</strong> will convert it into a posted official bill.
          </p>

          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--text-primary)]">Select Official Bill Type:</label>
            <div className={cn("grid gap-3", enableKachaBilling ? "grid-cols-2" : "grid-cols-1")}>
              <button
                type="button"
                onClick={() => handleConfirmConvert("pakka")}
                disabled={converting}
                className="p-3 border border-green-200 bg-green-50/50 hover:bg-green-100 rounded-xl text-left font-bold text-xs text-green-800 transition-all cursor-pointer flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span>PAKKA (Tax Invoice)</span>
                  {converting && <Loader2 className="h-3 w-3 animate-spin text-green-600" />}
                </div>
                <span className="text-[10px] font-normal text-green-600">Assigns INV-YYYY-MM-XXX</span>
              </button>

              {enableKachaBilling && (
                <button
                  type="button"
                  onClick={() => handleConfirmConvert("kacha")}
                  disabled={converting}
                  className="p-3 border border-amber-200 bg-amber-50/50 hover:bg-amber-100 rounded-xl text-left font-bold text-xs text-amber-800 transition-all cursor-pointer flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <span>KACHA (Estimate)</span>
                    {converting && <Loader2 className="h-3 w-3 animate-spin text-amber-600" />}
                  </div>
                  <span className="text-[10px] font-normal text-amber-600">Assigns KAC-YYYY-MM-XXX</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end pt-2">
            <button
              type="button"
              disabled={converting}
              onClick={() => setConvertModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-xs font-bold text-[var(--text-body)] hover:bg-[var(--page-bg)] cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
      {/* ── MOBILE: STICKY BOTTOM ACTION BAR ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--card-bg)] border-t border-[var(--border)] p-2.5 flex items-center justify-around gap-2 shadow-lg">
        <button onClick={handleWhatsAppShare}
          className="flex-1 h-10 rounded-xl bg-[#25D366] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-98"
        ><MessageSquare className="h-4 w-4" /><span>WhatsApp</span></button>

        <button onClick={() => window.open(`/sales/bills/${bill.id}/print`, "_blank")}
          className="h-10 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--page-bg)] text-[var(--text-primary)] font-bold text-xs flex items-center justify-center gap-1 cursor-pointer active:scale-98"
        ><Printer className="h-4 w-4" /><span className="text-[11px]">Print</span></button>

        {bill.is_temporary ? (
          <button onClick={() => setConvertModalOpen(true)}
            className="flex-1 h-10 rounded-xl bg-purple-600 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer active:scale-98"
          ><CheckCircle2 className="h-4 w-4" /><span>Convert</span></button>
        ) : bill.status !== "cancelled" ? (
          <Link href={`/sales/bills/${bill.id}/edit`}
            className="flex-1 h-10 rounded-xl bg-[var(--primary)] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 shadow-sm"
          ><Edit2 className="h-4 w-4" /><span>Edit Bill</span></Link>
        ) : null}
      </div>
    </div>
  );
}
