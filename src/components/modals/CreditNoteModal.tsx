"use client";

import React from "react";
import { X, Printer, FileText } from "lucide-react";
import { numberToWords } from "@/lib/utils/numberToWords";
import { formatDate } from "@/lib/utils";

interface CreditNoteModalProps {
  open: boolean;
  onClose: () => void;
  creditNote: {
    cn_number: string;
    cn_date: string;
    amount: number;
    reason?: string | null;
    party?: {
      name: string;
      company_name?: string | null;
      gstin?: string | null;
      phone?: string | null;
      billing_address_line1?: string | null;
      billing_city?: string | null;
      billing_state?: string | null;
      billing_pincode?: string | null;
    } | null;
    return?: {
      return_number: string;
      return_date: string;
      bill?: {
        bill_number: string;
        bill_date?: string;
      } | null;
    } | null;
  };
  items?: Array<{
    id?: string;
    design?: {
      name: string;
      design_number?: string;
    } | null;
    quantity_delta?: number;
    value_delta?: number;
    quantity?: number;
    rate?: number;
    amount?: number;
    hsn_sac?: string | null;
  }>;
}

export function CreditNoteModal({ open, onClose, creditNote, items = [] }: CreditNoteModalProps) {
  if (!open) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val || 0);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto print-modal-overlay">
      {/* Modal Container */}
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200 print-modal-content">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-800">Credit Note Voucher</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Voucher Area */}
        <div id="credit-note-voucher" className="p-8 space-y-6 bg-white">
          
          {/* Top Title Banner */}
          <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6">
            <div>
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest block">Official Voucher</span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">CREDIT NOTE</h1>
              <p className="text-xs text-slate-500 font-semibold mt-1">TAS ERP System generated Credit Adjustment</p>
            </div>
            <div className="text-right">
              <div className="inline-block px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-md text-xs font-black text-indigo-700 font-mono mb-1">
                {creditNote.cn_number}
              </div>
              <p className="text-xs text-slate-600 font-semibold">Date: {formatDate(creditNote.cn_date)}</p>
            </div>
          </div>

          {/* Customer & Ref Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Credit Issued To (Customer)</span>
              <p className="font-extrabold text-slate-900 text-sm">{creditNote.party?.name || "—"}</p>
              {creditNote.party?.company_name && (
                <p className="font-semibold text-slate-600">{creditNote.party.company_name}</p>
              )}
              {creditNote.party?.gstin && (
                <p className="font-mono font-bold text-slate-700 mt-1">GSTIN: {creditNote.party.gstin}</p>
              )}
              {creditNote.party?.billing_city && (
                <p className="text-slate-500 text-[11px] mt-1">
                  {creditNote.party.billing_address_line1}, {creditNote.party.billing_city}, {creditNote.party.billing_state} - {creditNote.party.billing_pincode}
                </p>
              )}
            </div>

            <div className="space-y-1 sm:text-right">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Reference Information</span>
              {creditNote.return?.return_number && (
                <p className="font-semibold text-slate-700">Return Voucher: <span className="font-bold text-slate-900 font-mono">{creditNote.return.return_number}</span></p>
              )}
              <p className="font-semibold text-slate-700">Orig. Invoice: <span className="font-bold text-indigo-600 font-mono">{creditNote.return?.bill?.bill_number || "Direct Return"}</span></p>
              <p className="font-semibold text-slate-700">Reason: <span className="font-bold text-slate-900">{creditNote.reason || "Sales Return"}</span></p>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="p-3">Item / Design Description</th>
                  <th className="p-3 w-[100px] text-right">Qty</th>
                  <th className="p-3 w-[120px] text-right">Credit Value</th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? (
                  items.map((item, idx) => {
                    const qty = item.quantity || (item.quantity_delta ? Math.abs(item.quantity_delta) : 0);
                    const val = item.amount || (item.value_delta ? Math.abs(item.value_delta) : 0);
                    return (
                      <tr key={idx} className="border-b border-slate-100 last:border-0 text-slate-800">
                        <td className="p-3">
                          <span className="font-bold text-slate-900 block">{item.design?.name || "Stock Item"}</span>
                          {item.design?.design_number && (
                            <span className="text-[10px] font-mono text-slate-500">{item.design.design_number}</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-bold text-emerald-700 font-mono">
                          {qty} Pcs
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(val)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-slate-400 italic">
                      Sales return adjustment credit of {formatCurrency(creditNote.amount)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Total & Amount in Words */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end pt-2">
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Credit Amount in Words:</span>
              <p className="text-xs font-bold text-slate-800 italic">{numberToWords(creditNote.amount)}</p>
            </div>

            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-right space-y-1">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">Net Credit Value</span>
              <span className="text-2xl font-black text-emerald-700 font-mono">
                {formatCurrency(creditNote.amount)}
              </span>
            </div>
          </div>

          {/* Footer & Signature */}
          <div className="pt-8 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
            <div>
              <p className="font-bold text-slate-700">TAS ERP - Inventory & Sales</p>
              <p className="text-[10px] mt-0.5">This is a system generated Credit Note document.</p>
            </div>
            <div className="text-center w-48 border-t border-slate-400 pt-2">
              <p className="font-bold text-slate-800">Authorized Signatory</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
