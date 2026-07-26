"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

interface CreditNote {
  id: string;
  cn_number: string;
  cn_date: string;
  amount: number;
  reason: string | null;
  party?: {
    name: string;
    company_name: string | null;
    phone: string | null;
    email: string | null;
    gstin: string | null;
    billing_address_line1: string | null;
    billing_city: string | null;
    billing_state: string | null;
    billing_pincode: string | null;
  };
  return?: {
    id: string;
    return_number: string;
    return_date: string;
    return_reason: string | null;
    grand_total: number;
    bill?: { id: string; bill_number: string; bill_date: string } | null;
  } | null;
}

interface LedgerEntry {
  id: string;
  item_id: string;
  quantity_delta: number;
  value_delta: number;
  design?: { name: string; design_number: string } | null;
}

export default function CreditNotePrintPage() {
  const params = useParams();
  const id = params?.id as string;
  const [creditNote, setCreditNote] = useState<CreditNote | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/sales/credit-notes/${id}`);
        if (!res.ok) throw new Error("Failed to load credit note");
        const data = await res.json();
        setCreditNote(data.creditNote);
        setLedgerEntries(data.ledgerEntries || []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  useEffect(() => {
    // Auto-trigger print after data loads
    if (!loading && creditNote) {
      setTimeout(() => window.print(), 500);
    }
  }, [loading, creditNote]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(val);

  const amountToWords = (amount: number): string => {
    const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
      "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
      "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

    function convert(n: number): string {
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
      if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + convert(n % 100) : "");
      if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + convert(n % 1000) : "");
      if (n < 10000000) return convert(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + convert(n % 100000) : "");
      return convert(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + convert(n % 10000000) : "");
    }

    const rupees = Math.floor(amount);
    const paise = Math.round((amount - rupees) * 100);
    let result = convert(rupees) + " Rupees";
    if (paise > 0) result += " and " + convert(paise) + " Paise";
    return result + " Only";
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!creditNote) {
    return (
      <div className="flex h-screen items-center justify-center text-red-500 font-semibold">
        Credit note not found.
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .print-page { box-shadow: none !important; border: 1px solid #e2e8f0 !important; }
        }
        @page { size: A4; margin: 10mm; }
      `}</style>

      {/* Print button — hidden in print */}
      <div className="no-print flex justify-center py-4 gap-3 bg-slate-100 border-b">
        <button
          onClick={() => window.print()}
          className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-all"
        >
          🖨️ Print / Save PDF
        </button>
        <button
          onClick={() => window.close()}
          className="px-5 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-all"
        >
          Close
        </button>
      </div>

      {/* A4 Credit Note Document */}
      <div className="flex justify-center bg-slate-100 min-h-screen py-6 print:bg-white print:py-0">
        <div className="print-page bg-white w-[210mm] min-h-[297mm] shadow-xl p-10 text-[#0F172A]">

          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-indigo-600 pb-4 mb-6">
            <div>
              <h1 className="text-2xl font-black text-indigo-600 tracking-tight">CREDIT NOTE</h1>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
                Sales Return Credit Adjustment
              </p>
            </div>
            <div className="text-right text-xs space-y-0.5">
              <p className="font-black text-xl font-mono text-indigo-600">{creditNote.cn_number}</p>
              <p className="text-slate-600">Date: <span className="font-bold text-slate-800">{creditNote.cn_date}</span></p>
            </div>
          </div>

          {/* Party & Return Info */}
          <div className="grid grid-cols-2 gap-8 mb-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Credit To (Customer)</p>
              <p className="font-extrabold text-sm">{creditNote.party?.name}</p>
              {creditNote.party?.company_name && (
                <p className="text-xs text-slate-600">{creditNote.party.company_name}</p>
              )}
              {creditNote.party?.gstin && (
                <p className="text-xs font-mono font-bold text-slate-700 mt-1">GSTIN: {creditNote.party.gstin}</p>
              )}
              {creditNote.party?.billing_city && (
                <p className="text-xs text-slate-500 mt-1">
                  {creditNote.party.billing_address_line1}, {creditNote.party.billing_city},
                  {" "}{creditNote.party.billing_state} - {creditNote.party.billing_pincode}
                </p>
              )}
              {creditNote.party?.phone && <p className="text-xs text-slate-500 mt-0.5">Ph: {creditNote.party.phone}</p>}
            </div>
            <div className="text-right">
              {creditNote.return && (
                <div className="text-xs space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Return Reference</p>
                  <p className="font-bold text-slate-800">{creditNote.return.return_number}</p>
                  <p className="text-slate-500">Return Date: {creditNote.return.return_date}</p>
                  {creditNote.return.bill && (
                    <p className="text-slate-500">
                      Original Bill: <span className="font-bold text-indigo-600">{creditNote.return.bill.bill_number}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-6">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="p-2.5 text-left font-bold rounded-tl">#</th>
                  <th className="p-2.5 text-left font-bold">Description</th>
                  <th className="p-2.5 text-right font-bold">Qty Returned</th>
                  <th className="p-2.5 text-right font-bold rounded-tr">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.length > 0 ? (
                  ledgerEntries.map((entry, idx) => (
                    <tr key={entry.id} className={idx % 2 === 0 ? "bg-slate-50" : "bg-white"}>
                      <td className="p-2.5 border-b border-slate-100">{idx + 1}</td>
                      <td className="p-2.5 border-b border-slate-100 font-semibold">
                        {entry.design?.name || "Stock Item"}
                        {entry.design?.design_number && (
                          <span className="text-slate-400 font-mono ml-1.5 text-[10px]">
                            ({entry.design.design_number})
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 border-b border-slate-100 text-right font-mono">
                        {Math.abs(entry.quantity_delta)} pcs
                      </td>
                      <td className="p-2.5 border-b border-slate-100 text-right font-mono font-bold">
                        {formatCurrency(Math.abs(entry.value_delta))}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-400 italic text-[11px]">
                      {creditNote.reason || "Sales return credit adjustment"}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-indigo-50 font-bold text-sm">
                  <td colSpan={3} className="p-3 text-right font-bold text-slate-700">Total Credit Amount:</td>
                  <td className="p-3 text-right font-black text-indigo-700 font-mono text-base">
                    {formatCurrency(creditNote.amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Amount in Words */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mb-6">
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Amount in Words</p>
            <p className="text-xs font-semibold text-indigo-800 mt-0.5 italic">
              {amountToWords(creditNote.amount)}
            </p>
          </div>

          {/* Reason */}
          {creditNote.reason && (
            <div className="mb-6">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Reason</p>
              <p className="text-xs text-slate-700 font-medium">{creditNote.reason}</p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-auto border-t border-slate-200 pt-6">
            <div className="flex justify-between items-end">
              <div className="text-xs text-slate-400">
                <p>This is a computer-generated credit note.</p>
                <p>No signature is required.</p>
              </div>
              <div className="text-right">
                <div className="border-t border-slate-300 pt-2 mt-10 w-36 text-xs text-slate-500 text-center">
                  Authorised Signatory
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
