"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
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
  Check
} from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { toast } from "sonner";
import { numberToWords } from "@/lib/utils/numberToWords";

interface BillItem {
  id: string;
  design_id: string;
  design_code: string;
  size: string;
  colour_id: string | null;
  colour_name: string;
  quantity: number;
  rate: number;
  discount_percent: number;
  tax_percent: number;
  amount: number;
  hsn_sac: string | null;
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
  payment_status: "unpaid" | "partial" | "paid" | "overdue";
  status: "draft" | "active" | "cancelled";
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

  const [bill, setBill] = useState<SaleBill | null>(null);
  const [profit, setProfit] = useState<ProfitData | null>(null);
  const [brand, setBrand] = useState<any>(null);
  const [brandConfig, setBrandConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/sales/bills/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch bill details");
        return res.json();
      })
      .then((data) => {
        if (data.bill) setBill(data.bill);
        if (data.profit) setProfit(data.profit);
        if (data.brand) setBrand(data.brand);
        if (data.brandConfig) setBrandConfig(data.brandConfig);
      })
      .catch((err) => {
        console.error("Error loading bill:", err);
        toast.error("Could not load bill details");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleCancelBill = async () => {
    if (!window.confirm("Are you sure you want to cancel/soft-delete this bill? Stock adjustments will be reversed.")) {
      return;
    }

    setCancelling(true);
    try {
      const res = await fetch(`/api/sales/bills/${id}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cancel bill");
      }

      toast.success("Bill cancelled successfully");
      router.push("/sales/bills");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred");
    } finally {
      setCancelling(false);
    }
  };

  const handleCopyWords = () => {
    if (!bill) return;
    navigator.clipboard.writeText(numberToWords(bill.grand_total));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
        <Loader2 className="h-8 w-8 text-[#6366F1] animate-spin" />
        <span className="text-xs text-[#64748B] font-semibold uppercase tracking-wider">Loading invoice details...</span>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-center gap-3">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <h2 className="text-lg font-bold text-slate-800">Bill Not Found</h2>
        <p className="text-sm text-slate-500">The requested sales bill does not exist or has been deleted.</p>
        <Link href="/sales/bills" className="text-sm font-semibold text-[#6366F1] hover:underline">
          Go Back to List
        </Link>
      </div>
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

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header Navigation & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#E5E7EB] pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/sales/bills"
            className="p-1.5 rounded-lg border border-[#D1D5DB] text-[#64748B] hover:text-[#0F172A] bg-white transition-colors"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </Link>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[#0F172A] font-mono">{bill.bill_number}</h1>
              <Badge variant={getStatusColor(bill.status)} className="uppercase tracking-wider">
                {bill.status}
              </Badge>
              <Badge
                variant={bill.bill_type === "pakka" ? "green" : "orange"}
                className="uppercase tracking-wider text-[10px]"
              >
                {bill.bill_type}
              </Badge>
            </div>
            <p className="text-xs text-[#64748B]">Created on {new Date(bill.bill_date).toLocaleDateString("en-IN")}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 select-none">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 border border-[#D1D5DB] rounded-lg text-xs font-semibold text-[#374151] bg-white hover:bg-[#F9FAFB] transition-colors flex items-center gap-1.5"
          >
            <Printer className="h-4 w-4" />
            <span>Print Invoice</span>
          </button>

          {bill.status === "draft" && (
            <Link
              href={`/sales/bills/${bill.id}/edit`}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-[#6366F1] hover:bg-[#4F46E5] transition-colors"
            >
              Resume Draft
            </Link>
          )}

          {bill.status !== "cancelled" && (
            <button
              disabled={cancelling}
              onClick={handleCancelBill}
              className="px-3.5 py-2 border border-[#FCA5A5] rounded-lg text-xs font-semibold text-[#DC2626] bg-[#FEF2F2] hover:bg-[#FEE2E2] transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              <span>Cancel Bill</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Columns (Col Span 2): Bill Details & Items */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Section 1: Parties details */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider border-b border-[#F3F4F6] pb-1 flex items-center gap-1.5">
                <User className="h-4 w-4 text-[#6366F1]" />
                <span>Billed To</span>
              </span>
              <span className="font-bold text-sm text-[#0F172A]">{bill.party?.name}</span>
              {bill.party?.company_name && (
                <span className="text-xs text-[#475569]">{bill.party.company_name}</span>
              )}
              {bill.billing_address && (
                <p className="text-xs text-[#64748B] leading-relaxed max-w-xs">{bill.billing_address}</p>
              )}
              {bill.phone && <span className="text-xs text-[#64748B]">Mobile: {bill.phone}</span>}
              {bill.gstin && <span className="text-xs text-[#15803D] font-semibold">GSTIN: {bill.gstin}</span>}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider border-b border-[#F3F4F6] pb-1 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-[#6366F1]" />
                <span>Invoice Details</span>
              </span>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs text-[#475569]">
                <span className="text-[#64748B]">Invoice Date:</span>
                <span className="font-semibold">{new Date(bill.bill_date).toLocaleDateString("en-IN")}</span>

                <span className="text-[#64748B]">Due Date:</span>
                <span className="font-semibold">{new Date(bill.due_date).toLocaleDateString("en-IN")}</span>

                <span className="text-[#64748B]">Payment Terms:</span>
                <span className="font-semibold capitalize">{bill.payment_terms.replace("_", " ")}</span>

                <span className="text-[#64748B]">GST Treatment:</span>
                <span className="font-semibold capitalize">{bill.gst_treatment}</span>

                {bill.reference_no && (
                  <>
                    <span className="text-[#64748B]">Reference No:</span>
                    <span className="font-semibold font-mono">{bill.reference_no}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Transport & Remarks */}
          {(bill.transporter_name || bill.vehicle_no || bill.remarks) && (
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
              {(bill.transporter_name || bill.vehicle_no) && (
                <div className="flex flex-col gap-2 text-xs">
                  <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider border-b border-[#F3F4F6] pb-1 flex items-center gap-1.5">
                    <Truck className="h-4 w-4 text-[#6366F1]" />
                    <span>Transport details</span>
                  </span>
                  <div className="grid grid-cols-2 gap-y-2 text-[#475569]">
                    <span className="text-[#64748B]">Transporter:</span>
                    <span className="font-semibold">{bill.transporter_name || "N/A"}</span>

                    <span className="text-[#64748B]">Vehicle No:</span>
                    <span className="font-semibold">{bill.vehicle_no || "N/A"}</span>
                  </div>
                </div>
              )}

              {bill.remarks && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider border-b border-[#F3F4F6] pb-1">
                    Internal Remarks
                  </span>
                  <p className="text-xs text-[#475569] leading-relaxed italic bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                    {bill.remarks}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Section 3: Items Table */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden flex flex-col">
            <h3 className="px-5 py-4 border-b border-[#F3F4F6] text-sm font-bold text-[#0F172A]">
              Items Invoiced ({bill.items.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#E5E7EB] text-left text-xs">
                <thead className="bg-[#F9FAFB] text-[#64748B] font-bold uppercase tracking-wider select-none">
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
                <tbody className="divide-y divide-[#E5E7EB] text-sm bg-white text-[#1E293B]">
                  {bill.items.map((it, idx) => {
                    const gross = it.quantity * it.rate;
                    const netTaxable = gross * (1 - it.discount_percent / 100);
                    const itemGst = netTaxable * (it.tax_percent / 100);
                    const totalAmount = netTaxable + itemGst;

                    return (
                      <tr key={it.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="px-5 py-4 text-xs text-[#64748B] font-semibold">{idx + 1}</td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col">
                            <span className="font-semibold">{it.design_code} ({it.size})</span>
                            <span className="text-[10px] text-[#64748B] font-mono">Colour: {it.colour_name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">{it.quantity} Pcs</td>
                        <td className="px-5 py-4 text-right">₹{it.rate.toFixed(2)}</td>
                        <td className="px-5 py-4 text-center">{it.discount_percent}%</td>
                        <td className="px-5 py-4 text-center">
                          <span className="px-2 py-0.5 bg-[#EEF2FF] text-[#6366F1] rounded text-[10px] font-semibold">
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
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[#0F172A] mb-2 pb-2 border-b border-[#F3F4F6]">
              <FileText className="h-4.5 w-4.5 text-[#6366F1]" />
              <span>Bill Totals</span>
            </h3>

            <div className="flex flex-col gap-2.5 text-xs text-[#475569]">
              <div className="flex items-center justify-between">
                <span>Gross Item Value</span>
                <span className="font-semibold text-[#1E293B]">{formatCurrency(bill.item_total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Charges Total</span>
                <span className="font-semibold text-[#1E293B]">{formatCurrency(bill.charges_total)}</span>
              </div>
              {bill.discount_amount > 0 && (
                <div className="flex items-center justify-between text-[#DC2626] font-semibold">
                  <span>Overall Discount</span>
                  <span>-{formatCurrency(bill.discount_amount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-[#F3F4F6] pt-2 text-xs">
                <span>Taxable Amount</span>
                <span className="font-semibold text-[#1E293B]">{formatCurrency(bill.taxable_amount)}</span>
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
              <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-2 text-[10px] text-[#64748B]">
                <span>Round Off</span>
                <span>{bill.round_off >= 0 ? "+" : ""}{formatCurrency(bill.round_off)}</span>
              </div>
              <div className="flex items-center justify-between py-1 text-sm">
                <span className="font-semibold text-[#0F172A]">Grand Total</span>
                <span className="text-lg font-bold text-[#6366F1]">{formatCurrency(bill.grand_total)}</span>
              </div>

              {/* Amount in words */}
              <div className="bg-[#DCFCE7] rounded-lg p-3 mt-2 border border-[#BBF7D0] relative flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold text-[#15803D] uppercase tracking-wider">Amount in Words</span>
                  <span className="text-xs font-semibold text-[#15803D] leading-relaxed">{amountInWords}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyWords}
                  className="text-[#15803D] hover:bg-[#BBF7D0]/40 p-1 rounded transition-colors shrink-0"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Conditional RLS/Role-Protected Profit Margin Card */}
          {profit && (
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm flex flex-col gap-4 animate-fadeIn">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[#0F172A] border-b border-[#F3F4F6] pb-3">
                <Lock className="h-4.5 w-4.5 text-[#15803D]" />
                <span>Profit Margin & COGS</span>
              </h3>

              <div className="flex flex-col gap-3.5 text-xs text-[#475569]">
                <div className="flex justify-between items-center">
                  <span>Cost of Goods Sold (COGS)</span>
                  <span className="font-semibold text-[#0F172A]">{formatCurrency(profit.cogs)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span>Net Sale Value (Post-Tax)</span>
                  <span className="font-semibold text-[#0F172A]">{formatCurrency(profit.sale_value)}</span>
                </div>

                <div className="flex justify-between items-center border-t border-[#F3F4F6] pt-3">
                  <span className="font-medium">Net Profit Amount</span>
                  <span className={`font-bold text-sm ${profit.net_profit >= 0 ? "text-[#15803D]" : "text-[#DC2626]"}`}>
                    {formatCurrency(profit.net_profit)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-medium">Net Profit Margin (%)</span>
                  <span
                    className={`font-extrabold text-sm px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                      profit.profit_margin_percent >= 15
                        ? "bg-[#DCFCE7] text-[#15803D]"
                        : profit.profit_margin_percent >= 5
                        ? "bg-[#FEF3C7] text-[#D97706]"
                        : "bg-[#FEE2E2] text-[#DC2626]"
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
                <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-2.5 text-[10px] text-[#1E40AF] font-medium leading-normal flex items-start gap-2">
                  <Lock className="h-3.5 w-3.5 text-[#1D4ED8] shrink-0 mt-0.5" />
                  <span>
                    Secure RLS Panel. This detailed cost and margin information is encrypted and accessible only to authorized Administrators and Owners.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PRINT-ONLY AREA WITH 4 SYSTEM LAYOUTS */}
      <div id="print-area" className="hidden print:block text-slate-900 bg-white p-8 w-full font-sans">
        <style dangerouslySetInnerHTML={{ __html: `
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
          // Choose template type: classic, modern, compact, traditional_tax_invoice
          const templateType = bill.bill_type === "pakka"
            ? (brandConfig?.pakka_template_id === "00000000-0000-0000-0000-000000000002" ? "modern" :
               brandConfig?.pakka_template_id === "00000000-0000-0000-0000-000000000003" ? "compact" :
               brandConfig?.pakka_template_id === "00000000-0000-0000-0000-000000000004" ? "traditional" : "classic")
            : (brandConfig?.kacha_template_id === "00000000-0000-0000-0000-000000000002" ? "modern" :
               brandConfig?.kacha_template_id === "00000000-0000-0000-0000-000000000003" ? "compact" :
               brandConfig?.kacha_template_id === "00000000-0000-0000-0000-000000000004" ? "traditional" : "classic");

          const primaryColorVal = brandConfig?.primary_color || "#6366F1";
          const showHsnVal = brandConfig?.show_hsn !== false;
          const showDiscountVal = brandConfig?.show_discount_column !== false;
          const showTransportVal = brandConfig?.show_transport_details !== false;
          const showLogo = !!brand?.logo_url;

          // 1. MODERN LAYOUT
          if (templateType === "modern") {
            return (
              <div className="flex flex-col gap-6 text-sm">
                {/* Accent Color header line */}
                <div style={{ backgroundColor: primaryColorVal }} className="h-3 w-full rounded" />
                
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1">
                    {showLogo && (
                      <img src={brand.logo_url} alt={brand.name} className="h-12 w-auto object-contain self-start mb-2" />
                    )}
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{brand?.name || "Tax Invoice"}</h1>
                    <span className="text-xs text-slate-500 italic">{brandConfig?.header_text || "Premium Quality Clothing"}</span>
                    <span className="text-xs text-slate-500">{brand?.address}</span>
                    {brand?.gstin && <span className="text-xs font-semibold text-slate-700">GSTIN: {brand.gstin}</span>}
                  </div>
                  <div className="text-right flex flex-col gap-1">
                    <span style={{ color: primaryColorVal }} className="text-lg font-extrabold tracking-wider uppercase">INVOICE</span>
                    <span className="text-sm font-mono font-bold text-slate-700">{bill.bill_number}</span>
                    <span className="text-xs text-slate-500">Date: {bill.bill_date}</span>
                    <span className="text-xs text-slate-500">Due: {bill.due_date}</span>
                  </div>
                </div>

                {/* Buyer / Details Grid */}
                <div className="grid grid-cols-2 gap-8 border-t border-b border-slate-100 py-4 text-xs">
                  <div>
                    <span className="font-bold text-slate-600 block mb-1.5">Billed To:</span>
                    <span className="font-bold text-slate-800 text-sm block">{bill.party?.name}</span>
                    <p className="text-slate-500 leading-relaxed mt-1 max-w-xs">{bill.billing_address}</p>
                    {bill.gstin && <span className="font-semibold text-slate-700 block mt-1">GSTIN: {bill.gstin}</span>}
                  </div>
                  {showTransportVal && (bill.transporter_name || bill.vehicle_no) && (
                    <div>
                      <span className="font-bold text-slate-600 block mb-1.5">Shipping & Transport:</span>
                      <div className="grid grid-cols-2 gap-y-1 text-slate-500">
                        <span>Transporter:</span>
                        <span className="font-semibold text-slate-700">{bill.transporter_name || "N/A"}</span>
                        <span>Vehicle No:</span>
                        <span className="font-semibold text-slate-700 font-mono">{bill.vehicle_no || "N/A"}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Items Table */}
                <table className="w-full text-left text-xs mt-2 border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: `${primaryColorVal}10` }}>
                      <th className="p-2.5 font-bold text-slate-700">#</th>
                      <th className="p-2.5 font-bold text-slate-700">Item Name & Size</th>
                      {showHsnVal && <th className="p-2.5 font-bold text-slate-700">HSN</th>}
                      <th className="p-2.5 font-bold text-slate-700 text-center">Qty</th>
                      <th className="p-2.5 font-bold text-slate-700 text-right">Rate</th>
                      {showDiscountVal && <th className="p-2.5 font-bold text-slate-700 text-center">Disc (%)</th>}
                      <th className="p-2.5 font-bold text-slate-700 text-center">GST</th>
                      <th className="p-2.5 font-bold text-slate-700 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bill.items.map((it, idx) => {
                      const gross = it.quantity * it.rate;
                      const net = gross * (1 - it.discount_percent / 100);
                      const tax = net * (it.tax_percent / 100);
                      return (
                        <tr key={it.id} className="text-slate-800">
                          <td className="p-2.5 text-slate-500 font-semibold">{idx + 1}</td>
                          <td className="p-2.5 font-semibold">{it.design_code} ({it.size}) - {it.colour_name}</td>
                          {showHsnVal && <td className="p-2.5 font-mono">{it.hsn_sac || "—"}</td>}
                          <td className="p-2.5 text-center">{it.quantity} Pcs</td>
                          <td className="p-2.5 text-right">₹{it.rate.toFixed(2)}</td>
                          {showDiscountVal && <td className="p-2.5 text-center">{it.discount_percent}%</td>}
                          <td className="p-2.5 text-center">{it.tax_percent}%</td>
                          <td className="p-2.5 text-right font-semibold">₹{(net + tax).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Footer Totals */}
                <div className="flex justify-between items-start mt-6 border-t border-slate-100 pt-4">
                  <div className="max-w-xs flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Terms & Declarations</span>
                    <p className="text-[10px] text-slate-500 leading-normal italic">{brandConfig?.footer_text || "Subject to local jurisdiction only."}</p>
                    {brandConfig?.bank_account && (
                      <div className="text-[10px] text-slate-500 border border-slate-100 rounded p-2.5 bg-slate-50 flex flex-col mt-2">
                        <span className="font-bold text-slate-600 block mb-0.5">Bank Settlement Details</span>
                        <span>Bank: {brandConfig.bank_account.bank_name}</span>
                        <span>A/C No: {brandConfig.bank_account.account_number}</span>
                        <span>IFSC: {brandConfig.bank_account.ifsc_code}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="w-64 flex flex-col gap-2.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Item Subtotal</span>
                      <span className="font-semibold text-slate-800">₹{bill.item_total.toFixed(2)}</span>
                    </div>
                    {bill.charges_total > 0 && (
                      <div className="flex justify-between">
                        <span>Charges Total</span>
                        <span className="font-semibold text-slate-800">₹{bill.charges_total.toFixed(2)}</span>
                      </div>
                    )}
                    {bill.discount_amount > 0 && (
                      <div className="flex justify-between text-red-600 font-semibold">
                        <span>Discount</span>
                        <span>-₹{bill.discount_amount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-slate-800">
                      <span>Taxable Subtotal</span>
                      <span>₹{bill.taxable_amount.toFixed(2)}</span>
                    </div>
                    {(bill.cgst > 0 || bill.sgst > 0) && (
                      <>
                        <div className="flex justify-between">
                          <span>CGST</span>
                          <span>₹{bill.cgst.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>SGST</span>
                          <span>₹{bill.sgst.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    {bill.igst > 0 && (
                      <div className="flex justify-between">
                        <span>IGST</span>
                        <span>₹{bill.igst.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-slate-200 pt-2 font-extrabold text-sm text-slate-800">
                      <span style={{ color: primaryColorVal }}>Total Amount Due</span>
                      <span style={{ color: primaryColorVal }}>₹{bill.grand_total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Signatures */}
                <div className="flex justify-between items-end mt-12 text-xs">
                  <div className="text-slate-400">
                    <p className="border-t border-slate-200 w-36 text-center pt-1 text-slate-500">Customer Signature</p>
                  </div>
                  <div className="text-right flex flex-col items-center">
                    <span className="text-[10px] text-slate-400 font-semibold">For {brand?.name}</span>
                    <div className="h-10" />
                    <p className="border-t border-slate-200 w-44 text-center pt-1 font-semibold text-slate-700">{brandConfig?.signature_name || "Accountant"} ({brandConfig?.signature_designation || "Signatory"})</p>
                  </div>
                </div>
              </div>
            );
          }

          // 2. COMPACT LAYOUT
          if (templateType === "compact") {
            return (
              <div className="flex flex-col gap-3 text-[10px] leading-tight">
                {/* Header */}
                <div className="flex justify-between items-start border-b border-slate-200 pb-2">
                  <div className="flex flex-col gap-0.5">
                    <h1 className="text-sm font-bold text-slate-800">{brand?.name || "Tax Invoice"}</h1>
                    <span className="text-[9px] text-slate-500">{brand?.address}</span>
                    {brand?.gstin && <span className="text-[9px] font-semibold text-slate-700">GST: {brand.gstin}</span>}
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-slate-800 block text-xs">TAX INVOICE</span>
                    <span className="font-mono font-bold text-slate-700">{bill.bill_number}</span>
                    <span className="block text-slate-500 text-[8px]">Date: {bill.bill_date}</span>
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-4 text-[9px] border-b border-slate-100 pb-1.5">
                  <div>
                    <span className="font-bold text-slate-600 block">Buyer:</span>
                    <span className="font-bold text-slate-800">{bill.party?.name}</span>
                    <span className="block text-slate-500">{bill.billing_address?.substring(0, 50)}...</span>
                  </div>
                  {showTransportVal && (
                    <div>
                      <span className="font-bold text-slate-600 block">Transport:</span>
                      <span>{bill.transporter_name || "N/A"} | {bill.vehicle_no || "N/A"}</span>
                    </div>
                  )}
                </div>

                {/* Items */}
                <table className="w-full text-left text-[9px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600 font-bold">
                      <th className="py-1">#</th>
                      <th className="py-1">Item Details</th>
                      {showHsnVal && <th className="py-1">HSN</th>}
                      <th className="py-1 text-center">Qty</th>
                      <th className="py-1 text-right">Rate</th>
                      <th className="py-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bill.items.map((it, idx) => {
                      const net = it.quantity * it.rate * (1 - it.discount_percent / 100);
                      const tax = net * (it.tax_percent / 100);
                      return (
                        <tr key={it.id} className="text-slate-800">
                          <td className="py-1 text-slate-500">{idx + 1}</td>
                          <td className="py-1 font-semibold">{it.design_code} ({it.size})</td>
                          {showHsnVal && <td className="py-1 font-mono">{it.hsn_sac || "—"}</td>}
                          <td className="py-1 text-center">{it.quantity}</td>
                          <td className="py-1 text-right">₹{it.rate}</td>
                          <td className="py-1 text-right font-semibold">₹{(net + tax).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Totals split */}
                <div className="flex justify-between items-end border-t border-slate-200 pt-2 text-[9px]">
                  <div className="max-w-[180px] italic text-slate-500 text-[8px]">
                    {brandConfig?.footer_text || "Thank you for your business."}
                  </div>
                  <div className="w-48 flex flex-col gap-1 text-slate-600">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>₹{bill.taxable_amount.toFixed(2)}</span>
                    </div>
                    {(bill.cgst > 0 || bill.sgst > 0) && (
                      <div className="flex justify-between">
                        <span>GST Splits</span>
                        <span>₹{(bill.cgst + bill.sgst + bill.igst).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-extrabold text-[10px] text-slate-800 border-t border-slate-100 pt-1">
                      <span>Grand Total</span>
                      <span>₹{bill.grand_total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-end mt-4 text-[9px]">
                  <span className="text-slate-400">Customer Sign</span>
                  <span className="font-semibold text-slate-700">Auth Signatory</span>
                </div>
              </div>
            );
          }

          // 3. TRADITIONAL TAX INVOICE (DOUBLE BORDERS)
          if (templateType === "traditional") {
            return (
              <div className="border-double border-4 border-slate-900 p-4 text-xs font-mono leading-relaxed text-slate-900 flex flex-col gap-4">
                <div className="text-center flex flex-col gap-0.5 border-b-2 border-slate-900 pb-3">
                  <span className="text-base font-extrabold uppercase tracking-wide">TAX INVOICE</span>
                  <h1 className="text-lg font-extrabold uppercase">{brand?.name || "COMPANY NAME"}</h1>
                  <span className="text-xs">{brand?.address}</span>
                  {brand?.gstin && <span className="font-bold text-xs">GSTIN/UIN: {brand.gstin}</span>}
                </div>

                <div className="grid grid-cols-2 border-b-2 border-slate-900 pb-3 gap-4">
                  <div className="border-r border-slate-900 pr-4">
                    <span className="font-bold block mb-1">Details of Receiver (Billed To):</span>
                    <span className="font-extrabold block text-sm">{bill.party?.name}</span>
                    <p className="whitespace-pre-line leading-normal">{bill.billing_address}</p>
                    {bill.gstin && <span className="font-bold">GSTIN/UIN: {bill.gstin}</span>}
                  </div>
                  <div className="pl-4 flex flex-col gap-1.5">
                    <div>
                      <span className="font-bold">Invoice No:</span>{" "}
                      <span className="font-extrabold">{bill.bill_number}</span>
                    </div>
                    <div>
                      <span className="font-bold">Date:</span> {bill.bill_date}
                    </div>
                    {showTransportVal && (
                      <>
                        <div>
                          <span className="font-bold">Transporter:</span> {bill.transporter_name || "—"}
                        </div>
                        <div>
                          <span className="font-bold">Vehicle No:</span> {bill.vehicle_no || "—"}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <table className="w-full text-left border-collapse border-b border-slate-900">
                  <thead>
                    <tr className="border-b-2 border-slate-900 font-extrabold uppercase text-[10px]">
                      <th className="py-2 pr-2">S.N.</th>
                      <th className="py-2">Description of Goods</th>
                      {showHsnVal && <th className="py-2">HSN</th>}
                      <th className="py-2 text-center">Qty</th>
                      <th className="py-2 text-right">Rate</th>
                      {showDiscountVal && <th className="py-2 text-center">Disc</th>}
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {bill.items.map((it, idx) => {
                      const net = it.quantity * it.rate * (1 - it.discount_percent / 100);
                      return (
                        <tr key={it.id}>
                          <td className="py-2 pr-2">{idx + 1}</td>
                          <td className="py-2 font-bold">{it.design_code} ({it.size})</td>
                          {showHsnVal && <td className="py-2">{it.hsn_sac || "—"}</td>}
                          <td className="py-2 text-center">{it.quantity} Pcs</td>
                          <td className="py-2 text-right">₹{it.rate.toFixed(2)}</td>
                          {showDiscountVal && <td className="py-2 text-center">{it.discount_percent}%</td>}
                          <td className="py-2 text-right font-bold">₹{net.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start pt-3">
                  <div>
                    <span className="font-bold block mb-1 text-[9px] uppercase tracking-wider">Declarations & Footnote</span>
                    <p className="text-[10px] leading-relaxed italic">{brandConfig?.declaration_text || "Goods once sold will not be taken back."}</p>
                  </div>
                  <div className="flex flex-col gap-1.5 text-right font-bold">
                    <div className="flex justify-between">
                      <span>Taxable Value:</span>
                      <span>₹{bill.taxable_amount.toFixed(2)}</span>
                    </div>
                    {bill.cgst > 0 && (
                      <div className="flex justify-between">
                        <span>Add CGST:</span>
                        <span>₹{bill.cgst.toFixed(2)}</span>
                      </div>
                    )}
                    {bill.sgst > 0 && (
                      <div className="flex justify-between">
                        <span>Add SGST:</span>
                        <span>₹{bill.sgst.toFixed(2)}</span>
                      </div>
                    )}
                    {bill.igst > 0 && (
                      <div className="flex justify-between">
                        <span>Add IGST:</span>
                        <span>₹{bill.igst.toFixed(2)}</span>
                      </div>
                    )}
                    {bill.charges_total > 0 && (
                      <div className="flex justify-between">
                        <span>Other Charges:</span>
                        <span>₹{bill.charges_total.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-slate-900 pt-2 text-sm font-extrabold">
                      <span>Total Invoice Value:</span>
                      <span>₹{bill.grand_total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-end mt-8">
                  <div className="text-center w-40 border-t border-slate-900 pt-1 text-[10px]">
                    Receiver's Signature
                  </div>
                  <div className="text-center w-48 flex flex-col items-center">
                    <span className="text-[9px] font-extrabold uppercase">For {brand?.name || "COMPANY"}</span>
                    <div className="h-8" />
                    <span className="border-t border-slate-900 w-full pt-1 font-bold text-[10px]">
                      {brandConfig?.signature_name || "Authorized Signatory"}
                    </span>
                  </div>
                </div>
              </div>
            );
          }

          // 4. DEFAULT CLASSIC LAYOUT (Standard GST Tax Invoice)
          return (
            <div className="flex flex-col gap-6 text-xs text-slate-800">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div className="flex flex-col gap-1.5">
                  {showLogo && (
                    <img src={brand.logo_url} alt={brand.name} className="h-10 w-auto object-contain self-start mb-1" />
                  )}
                  <h1 className="text-lg font-bold text-slate-900">{brand?.name || "Tax Invoice"}</h1>
                  <span className="text-xs text-slate-500 font-medium">{brandConfig?.header_text || "Wholesale Apparel Manufacturers"}</span>
                  <span className="text-xs text-slate-600 max-w-xs">{brand?.address}</span>
                  {brand?.gstin && <span className="text-xs font-semibold text-slate-800">GSTIN: {brand.gstin}</span>}
                </div>
                <div className="text-right flex flex-col gap-1.5">
                  <span className="text-base font-bold text-slate-900 tracking-wider">TAX INVOICE</span>
                  <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-right">
                    <span className="text-slate-500">Invoice No:</span>
                    <span className="font-bold text-slate-800 font-mono">{bill.bill_number}</span>
                    <span className="text-slate-500">Invoice Date:</span>
                    <span className="font-semibold text-slate-800">{bill.bill_date}</span>
                    <span className="text-slate-500">Due Date:</span>
                    <span className="font-semibold text-slate-800">{bill.due_date}</span>
                  </div>
                </div>
              </div>

              {/* Billed To / Details grid */}
              <div className="grid grid-cols-2 gap-8 border-b border-slate-200 pb-4">
                <div>
                  <span className="font-bold text-slate-600 block mb-1">Details of Receiver (Billed To):</span>
                  <span className="font-bold text-slate-900 text-sm block">{bill.party?.name}</span>
                  <p className="text-slate-600 leading-relaxed mt-1 max-w-xs">{bill.billing_address}</p>
                  {bill.gstin && <span className="font-semibold text-slate-800 block mt-1">GSTIN: {bill.gstin}</span>}
                </div>
                {showTransportVal && (bill.transporter_name || bill.vehicle_no) && (
                  <div>
                    <span className="font-bold text-slate-600 block mb-1">Transport Details:</span>
                    <div className="grid grid-cols-2 gap-y-1 text-slate-600">
                      <span>Transporter Name:</span>
                      <span className="font-semibold text-slate-800">{bill.transporter_name || "N/A"}</span>
                      <span>Vehicle Number:</span>
                      <span className="font-semibold text-slate-800 font-mono">{bill.vehicle_no || "N/A"}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-300 bg-slate-50 text-slate-700 font-bold">
                    <th className="p-2">#</th>
                    <th className="p-2">Item Description</th>
                    {showHsnVal && <th className="p-2">HSN</th>}
                    <th className="p-2 text-center">Qty</th>
                    <th className="p-2 text-right">Rate</th>
                    {showDiscountVal && <th className="p-2 text-center">Disc (%)</th>}
                    <th className="p-2 text-center">Tax Rate</th>
                    <th className="p-2 text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {bill.items.map((it, idx) => {
                    const gross = it.quantity * it.rate;
                    const net = gross * (1 - it.discount_percent / 100);
                    const tax = net * (it.tax_percent / 100);
                    return (
                      <tr key={it.id} className="text-slate-800">
                        <td className="p-2 text-slate-500">{idx + 1}</td>
                        <td className="p-2 font-semibold">{it.design_code} ({it.size}) - {it.colour_name}</td>
                        {showHsnVal && <td className="p-2 font-mono">{it.hsn_sac || "—"}</td>}
                        <td className="p-2 text-center">{it.quantity} Pcs</td>
                        <td className="p-2 text-right">₹{it.rate.toFixed(2)}</td>
                        {showDiscountVal && <td className="p-2 text-center">{it.discount_percent}%</td>}
                        <td className="p-2 text-center">{it.tax_percent}%</td>
                        <td className="p-2 text-right font-semibold">₹{(net + tax).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Bottom Sections: T&C and Totals */}
              <div className="flex justify-between items-start border-t border-slate-300 pt-4 mt-4">
                <div className="max-w-xs flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Declarations & T&C</span>
                  <p className="text-[10px] text-slate-500 leading-relaxed italic">{brandConfig?.footer_text || "Goods once sold will not be taken back."}</p>
                  {brandConfig?.bank_account && (
                    <div className="text-[10px] text-slate-500 border border-slate-200 rounded p-2.5 bg-slate-50 flex flex-col mt-2">
                      <span className="font-bold text-slate-600 block mb-0.5">Bank Details for Transfer</span>
                      <span>Bank: {brandConfig.bank_account.bank_name}</span>
                      <span>Account Number: {brandConfig.bank_account.account_number}</span>
                      <span>IFSC Code: {brandConfig.bank_account.ifsc_code}</span>
                    </div>
                  )}
                </div>

                <div className="w-64 flex flex-col gap-2 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Subtotal Value</span>
                    <span>₹{bill.item_total.toFixed(2)}</span>
                  </div>
                  {bill.charges_total > 0 && (
                    <div className="flex justify-between">
                      <span>Adjusted Charges</span>
                      <span>₹{bill.charges_total.toFixed(2)}</span>
                    </div>
                  )}
                  {bill.discount_amount > 0 && (
                    <div className="flex justify-between text-red-600 font-semibold">
                      <span>Overall Discount</span>
                      <span>-₹{bill.discount_amount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold text-slate-800">
                    <span>Taxable Subtotal</span>
                    <span>₹{bill.taxable_amount.toFixed(2)}</span>
                  </div>
                  {bill.cgst > 0 && (
                    <div className="flex justify-between">
                      <span>CGST</span>
                      <span>₹{bill.cgst.toFixed(2)}</span>
                    </div>
                  )}
                  {bill.sgst > 0 && (
                    <div className="flex justify-between">
                      <span>SGST</span>
                      <span>₹{bill.sgst.toFixed(2)}</span>
                    </div>
                  )}
                  {bill.igst > 0 && (
                    <div className="flex justify-between">
                      <span>IGST</span>
                      <span>₹{bill.igst.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t-2 border-slate-400 pt-2 font-bold text-sm text-slate-900">
                    <span>Invoice Grand Total</span>
                    <span>₹{bill.grand_total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="flex justify-between items-end mt-12 text-xs">
                <span className="border-t border-slate-300 w-36 text-center pt-1 text-slate-500">Receiver's Sign</span>
                <div className="text-right flex flex-col items-center">
                  <span className="text-[10px] text-slate-500">For {brand?.name || "Authorized Brand"}</span>
                  <div className="h-8" />
                  <span className="border-t border-slate-300 w-44 text-center pt-1 font-semibold text-slate-700">
                    {brandConfig?.signature_name || "Accountant"} ({brandConfig?.signature_designation || "Authorized Signatory"})
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
