"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, FileText, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsPDF from "jspdf";
import "jspdf-autotable";

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
  gst_treatment: "regular" | "composition" | "unregistered" | "exempt";
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
  party: {
    name: string;
  };
  items: BillItem[];
}

export default function SaleBillPrintPage() {
  const { id } = useParams();
  const router = useRouter();
  const [bill, setBill] = useState<SaleBill | null>(null);
  const [brand, setBrand] = useState<any>(null);
  const [brandConfig, setBrandConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
        if (data.brand) setBrand(data.brand);
        if (data.brandConfig) setBrandConfig(data.brandConfig);
      })
      .catch((err) => {
        console.error("Error loading bill:", err);
        toast.error("Failed to load invoice print details");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!bill) return;

    try {
      const doc = new jsPDF();
      const primaryColor = brandConfig?.primary_color || "#6366F1";
      const showHsn = brandConfig?.show_hsn !== false;
      const showDiscount = brandConfig?.show_discount_column !== false;

      // Header Brand Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(33, 37, 41);
      doc.text(brand?.name || "Tax Invoice", 14, 20);

      // Subtitle / Header Text
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(108, 117, 125);
      doc.text(brandConfig?.header_text || "Invoice of Sale", 14, 25);

      // Address & GSTIN
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(73, 80, 87);
      const addrLines = doc.splitTextToSize(brand?.address || "", 100);
      doc.text(addrLines, 14, 30);
      
      let nextY = 30 + (addrLines.length * 4.5);
      if (brand?.gstin) {
        doc.setFont("helvetica", "bold");
        doc.text(`GSTIN: ${brand.gstin}`, 14, nextY);
        nextY += 5;
      }

      // Invoice Number & Dates (Right Aligned)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(33, 37, 41);
      doc.text("INVOICE", 150, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(73, 80, 87);
      doc.text(`Invoice No: ${bill.bill_number}`, 150, 26);
      doc.text(`Date: ${bill.bill_date}`, 150, 31);
      doc.text(`Due Date: ${bill.due_date}`, 150, 36);

      // Divider Accent line
      doc.setDrawColor(primaryColor);
      doc.setLineWidth(1);
      doc.line(14, nextY + 3, 196, nextY + 3);
      nextY += 8;

      // Buyer Info
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Billed To:", 14, nextY);
      doc.text(bill.party?.name || "", 14, nextY + 5);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const buyerAddrLines = doc.splitTextToSize(bill.billing_address || "", 80);
      doc.text(buyerAddrLines, 14, nextY + 10);

      let buyerNextY = nextY + 10 + (buyerAddrLines.length * 4.5);
      if (bill.gstin) {
        doc.setFont("helvetica", "bold");
        doc.text(`GSTIN: ${bill.gstin}`, 14, buyerNextY);
        buyerNextY += 5;
      }

      // Transport Details (if applicable)
      if (brandConfig?.show_transport_details !== false && (bill.transporter_name || bill.vehicle_no)) {
        doc.setFont("helvetica", "bold");
        doc.text("Shipping details:", 120, nextY);
        doc.setFont("helvetica", "normal");
        doc.text(`Transporter: ${bill.transporter_name || "N/A"}`, 120, nextY + 5);
        doc.text(`Vehicle No: ${bill.vehicle_no || "N/A"}`, 120, nextY + 10);
      }

      const tableStartY = Math.max(buyerNextY + 5, nextY + 22);

      // Build Items Table
      const headers = ["#", "Item Description"];
      if (showHsn) headers.push("HSN");
      headers.push("Qty", "Rate");
      if (showDiscount) headers.push("Disc (%)");
      headers.push("GST (%)", "Amount");

      const tableRows = bill.items.map((it, idx) => {
        const net = it.quantity * it.rate * (1 - it.discount_percent / 100);
        const tax = net * (it.tax_percent / 100);
        const row = [String(idx + 1), `${it.design_code} (${it.size}) - ${it.colour_name}`];
        if (showHsn) row.push(it.hsn_sac || "—");
        row.push(`${it.quantity} Pcs`, `Rs ${it.rate.toFixed(2)}`);
        if (showDiscount) row.push(`${it.discount_percent}%`);
        row.push(`${it.tax_percent}%`, `Rs ${(net + tax).toFixed(2)}`);
        return row;
      });

      // Render Table
      (doc as any).autoTable({
        startY: tableStartY,
        head: [headers],
        body: tableRows,
        theme: "striped",
        headStyles: {
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: "bold"
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [33, 37, 41]
        },
        columnStyles: {
          0: { width: 10 },
          1: { width: showHsn ? 60 : 80 }
        }
      });

      let finalY = (doc as any).lastAutoTable.finalY + 10;

      // Add Summary & Terms
      if (finalY > 240) {
        doc.addPage();
        finalY = 20;
      }

      // Terms
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Terms & Declarations:", 14, finalY);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(108, 117, 125);
      const termsLines = doc.splitTextToSize(
        brandConfig?.footer_text || "Goods once sold will not be taken back. Subject to local jurisdiction only.",
        100
      );
      doc.text(termsLines, 14, finalY + 5);

      if (brandConfig?.bank_account) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("Bank Settlement Info:", 14, finalY + 18);
        doc.setFont("helvetica", "normal");
        doc.text(`Bank: ${brandConfig.bank_account.bank_name}`, 14, finalY + 22);
        doc.text(`A/C: ${brandConfig.bank_account.account_number}`, 14, finalY + 26);
        doc.text(`IFSC: ${brandConfig.bank_account.ifsc_code}`, 14, finalY + 30);
      }

      // Summary Panel (Right side)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(73, 80, 87);
      
      doc.text(`Subtotal:`, 130, finalY);
      doc.text(`Rs ${bill.item_total.toFixed(2)}`, 170, finalY, { align: "right" });

      if (bill.discount_amount > 0) {
        doc.text(`Discount:`, 130, finalY + 5);
        doc.text(`-Rs ${bill.discount_amount.toFixed(2)}`, 170, finalY + 5, { align: "right" });
      }

      doc.text(`Taxable Amount:`, 130, finalY + 10);
      doc.text(`Rs ${bill.taxable_amount.toFixed(2)}`, 170, finalY + 10, { align: "right" });

      let taxY = finalY + 15;
      if (bill.cgst > 0 || bill.sgst > 0) {
        doc.text(`CGST:`, 130, taxY);
        doc.text(`Rs ${bill.cgst.toFixed(2)}`, 170, taxY, { align: "right" });
        doc.text(`SGST:`, 130, taxY + 5);
        doc.text(`Rs ${bill.sgst.toFixed(2)}`, 170, taxY + 5, { align: "right" });
        taxY += 10;
      }
      if (bill.igst > 0) {
        doc.text(`IGST:`, 130, taxY);
        doc.text(`Rs ${bill.igst.toFixed(2)}`, 170, taxY, { align: "right" });
        taxY += 5;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(33, 37, 41);
      doc.text(`Grand Total:`, 130, taxY + 5);
      doc.text(`Rs ${bill.grand_total.toFixed(2)}`, 170, taxY + 5, { align: "right" });

      // Signatures
      const sigY = Math.max(finalY + 45, taxY + 20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("Customer Signature", 14, sigY);
      doc.line(14, sigY - 5, 45, sigY - 5);

      doc.text(`For ${brand?.name || "Authorized Brand"}`, 150, sigY - 8);
      doc.text(`${brandConfig?.signature_name || "Accountant"} (${brandConfig?.signature_designation || "Signatory"})`, 150, sigY);
      doc.line(150, sigY - 5, 190, sigY - 5);

      // Save PDF
      doc.save(`invoice_${bill.bill_number}.pdf`);
      toast.success("PDF Invoice generated successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to generate PDF Invoice document");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 text-[#6366F1] animate-spin" />
        <p className="text-sm font-semibold text-slate-500">Loading invoice document layout...</p>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-500">
        <FileText className="h-10 w-10 text-slate-300" />
        <p className="text-sm font-semibold">Bill details could not be found.</p>
        <Button variant="outline" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  // Choose template type
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

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center p-0 md:p-6 print:p-0 print:bg-white select-none">
      {/* Header bar - Hidden during Print */}
      <div className="w-full max-w-4xl bg-white border border-[#E5E7EB] rounded-none md:rounded-xl p-4 mb-6 shadow-sm flex flex-wrap justify-between items-center gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.back()} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Bill</span>
          </Button>
          <div className="flex flex-col">
            <h1 className="text-sm font-bold text-slate-800">{bill.bill_number}</h1>
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Template: {templateType}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            <span>Download PDF</span>
          </Button>
          <Button size="sm" onClick={handlePrint} className="bg-[#6366F1] hover:bg-[#4F46E5] text-white flex items-center gap-2">
            <Printer className="h-4 w-4" />
            <span>Print Invoice</span>
          </Button>
        </div>
      </div>

      {/* Invoice Canvas Container */}
      <div className="w-full max-w-4xl bg-white md:border md:border-[#E5E7EB] md:rounded-xl md:shadow-md p-6 md:p-12 print:p-0 print:border-none print:shadow-none min-h-[29.7cm]">
        
        {/* MODERN LAYOUT */}
        {templateType === "modern" && (
          <div className="flex flex-col gap-6 text-sm text-slate-800">
            <div style={{ backgroundColor: primaryColorVal }} className="h-3 w-full rounded" />
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
        )}

        {/* COMPACT LAYOUT */}
        {templateType === "compact" && (
          <div className="flex flex-col gap-3 text-[10px] leading-tight text-slate-800">
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
        )}

        {/* TRADITIONAL LAYOUT */}
        {templateType === "traditional" && (
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
        )}

        {/* CLASSIC LAYOUT */}
        {templateType === "classic" && (
          <div className="flex flex-col gap-6 text-xs text-slate-800">
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
        )}
      </div>
    </div>
  );
}
