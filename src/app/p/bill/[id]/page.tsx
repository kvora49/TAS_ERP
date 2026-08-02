"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer, Download, FileText, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { numberToWords } from "@/lib/utils/numberToWords";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";

interface BillItem {
  id: string;
  design?: { design_number?: string; name?: string };
  colour?: { colour_name?: string };
  quantity: number;
  rate: number;
  amount: number;
  hsn_sac?: string;
}

interface SaleBill {
  id: string;
  bill_number: string;
  bill_type: string;
  bill_date: string;
  due_date: string;
  grand_total: number;
  item_total: number;
  charges_total: number;
  discount_amount: number;
  taxable_amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  round_off: number;
  billing_address?: string;
  phone?: string;
  gstin?: string;
  status: string;
  is_temporary?: boolean;
  party?: { name: string; company_name?: string; phone?: string; gstin?: string };
  items?: BillItem[];
}

export default function PublicBillPage() {
  const { id } = useParams();
  const { getEffectiveLogo, business } = useCompanyProfile();
  const [bill, setBill] = useState<SaleBill | null>(null);
  const [brand, setBrand] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/public/bills/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Invoice not found or link has expired");
        return res.json();
      })
      .then((data) => {
        setBill(data.bill);
        setBrand(data.brand);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="h-10 w-10 text-emerald-400 animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-300">Loading your invoice details...</p>
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <AlertCircle className="h-12 w-12 text-rose-500 mb-4" />
        <h1 className="text-lg font-bold text-white mb-2">Invoice Unavailable</h1>
        <p className="text-xs text-slate-400 mb-6">{error || "This invoice link is invalid or no longer exists."}</p>
      </div>
    );
  }

  const partyName = bill.party?.company_name || bill.party?.name || "Customer";
  const formattedTotal = bill.grand_total.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const amountWords = numberToWords(bill.grand_total);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans pb-12">
      {/* Top Banner Actions */}
      <div className="bg-slate-900 text-white py-4 px-6 sticky top-0 z-50 shadow-md print:hidden">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-400" />
            <span className="font-extrabold text-sm tracking-wide font-mono">{bill.bill_number}</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/public/bills/${id}/pdf?download=true`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-sm"
            >
              <Download className="h-4 w-4 text-slate-300" />
              <span>Download PDF</span>
            </a>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Print Invoice</span>
            </button>
          </div>
        </div>
      </div>

      {/* Invoice Main Printable Sheet */}
      <main className="max-w-3xl mx-auto mt-6 bg-white border border-slate-200 rounded-2xl shadow-xl p-8 print:border-none print:shadow-none print:m-0 print:p-0">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-200 pb-6 mb-6">
          <div>
            {(() => {
              const effectiveLogo = getEffectiveLogo(brand?.logo_url);
              const sellerGstin = brand?.gstin || business?.gstin;
              const sellerPan = business?.pan;
              return (
                <>
                  <img src={effectiveLogo || "/logo.png"} alt={brand?.name || "TAS ERP Logo"} className="h-10 w-auto object-contain mb-2" />
                  <h1 className="text-2xl font-black tracking-tight text-slate-900">{brand?.name || business?.name || "Tax Invoice"}</h1>
                  {(brand?.address || business?.address) && <p className="text-xs text-slate-500 mt-1 max-w-xs">{brand?.address || business?.address}</p>}
                  <div className="flex flex-col gap-0.5 mt-1 text-xs font-mono font-bold text-slate-700">
                    {sellerGstin && <p>GSTIN: {sellerGstin}</p>}
                    {sellerPan && <p>PAN: {sellerPan}</p>}
                  </div>
                  {(brand?.phone || business?.phone) && <p className="text-xs text-slate-500 font-mono mt-0.5">Ph: {brand?.phone || business?.phone}</p>}
                </>
              );
            })()}
          </div>
          <div className="text-right">
            <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 font-extrabold text-xs uppercase tracking-wider rounded-md border border-emerald-200 mb-2">
              TAX INVOICE
            </span>
            <p className="text-xl font-bold font-mono text-slate-900">{bill.bill_number}</p>
            <p className="text-xs text-slate-500 mt-1">
              Date: {new Date(bill.bill_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
        </div>

        {/* Customer Details */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-6 flex flex-col md:flex-row justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Billed To</p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">{partyName}</p>
            {bill.billing_address && <p className="text-xs text-slate-600 mt-1">{bill.billing_address}</p>}
            {bill.phone && <p className="text-xs text-slate-500 font-mono mt-0.5">Phone: {bill.phone}</p>}
            {bill.gstin && <p className="text-xs text-slate-700 font-mono font-bold mt-0.5">GSTIN: {bill.gstin}</p>}
          </div>
          <div className="text-right flex flex-col justify-end">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Amount Due</p>
            <p className="text-2xl font-black text-slate-900 font-mono">₹{formattedTotal}</p>
          </div>
        </div>

        {/* Table of Items */}
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-500 font-bold uppercase tracking-wider border-y border-slate-200">
                <th className="py-3 px-3 w-12 text-center">#</th>
                <th className="py-3 px-4">Item Description</th>
                <th className="py-3 px-3 text-right">Qty</th>
                <th className="py-3 px-4 text-right">Rate</th>
                <th className="py-3 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {bill.items?.map((item, idx) => (
                <tr key={item.id || idx}>
                  <td className="py-3 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                  <td className="py-3 px-4 font-bold">
                    {item.design?.design_number || item.design?.name || "Item"}
                    {item.colour?.colour_name && <span className="text-slate-500 font-normal ml-1">({item.colour.colour_name})</span>}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold">{item.quantity}</td>
                  <td className="py-3 px-4 text-right font-mono">₹{item.rate?.toLocaleString("en-IN")}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold">₹{item.amount?.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Footer */}
        <div className="flex flex-col md:flex-row justify-between items-start border-t border-slate-200 pt-4 gap-6">
          <div className="max-w-md">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">Amount in Words</p>
            <p className="text-xs font-semibold text-slate-700 capitalize">{amountWords} Only</p>
          </div>
          <div className="w-full md:w-64 space-y-1.5 text-xs font-medium text-slate-600">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span>Item Subtotal</span>
              <span className="font-mono text-slate-900 font-bold">₹{bill.item_total?.toLocaleString("en-IN")}</span>
            </div>
            {bill.discount_amount > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-100 text-rose-600">
                <span>Discount</span>
                <span className="font-mono font-bold">-₹{bill.discount_amount?.toLocaleString("en-IN")}</span>
              </div>
            )}
            {bill.cgst > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>CGST</span>
                <span className="font-mono font-bold">₹{bill.cgst?.toLocaleString("en-IN")}</span>
              </div>
            )}
            {bill.sgst > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>SGST</span>
                <span className="font-mono font-bold">₹{bill.sgst?.toLocaleString("en-IN")}</span>
              </div>
            )}
            {bill.igst > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>IGST</span>
                <span className="font-mono font-bold">₹{bill.igst?.toLocaleString("en-IN")}</span>
              </div>
            )}
            <div className="flex justify-between py-2 text-sm font-black text-slate-900 border-t-2 border-slate-900 mt-2">
              <span>Grand Total</span>
              <span className="font-mono">₹{formattedTotal}</span>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center border-t border-dashed border-slate-200 pt-6">
          <p className="text-xs text-slate-500 font-medium">Thank you for your business!</p>
          <p className="text-[10px] text-slate-400 mt-1">This is a computer-generated tax invoice.</p>
        </div>
      </main>
    </div>
  );
}
