"use client";

import React from "react";
import { X, Printer, Download, CheckCircle2, Building2, Calendar, FileText } from "lucide-react";
import { numberToWords } from "@/lib/utils/numberToWords";
import { formatDate } from "@/lib/utils";

interface DebitNoteModalProps {
  open: boolean;
  onClose: () => void;
  pReturn: {
    return_number: string;
    return_date: string;
    reason?: string | null;
    challan_no?: string | null;
    grand_total: number;
    total_taxable_value: number;
    supplier?: {
      name: string;
      company_name?: string | null;
      gstin?: string | null;
    };
    purchase?: {
      purchase_number: string;
      invoice_no: string;
    };
    items: Array<{
      id: string;
      material_type?: {
        name: string;
        category?: string;
      };
      hsn_sac?: string | null;
      unit: string;
      returned_qty: number;
      rate: number;
      discount_percent: number;
      taxable_value: number;
    }>;
  };
}

export function DebitNoteModal({ open, onClose, pReturn }: DebitNoteModalProps) {
  if (!open) return null;

  const debitNoteNumber = `DB-${new Date(pReturn.return_date || Date.now()).getFullYear()}-${pReturn.return_number.slice(-4)}`;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
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
            <h2 className="text-base font-bold text-slate-800">Debit Note Voucher</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Voucher Area */}
        <div id="debit-note-voucher" className="p-8 space-y-6 bg-white">
          
          {/* Top Title Banner */}
          <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6">
            <div>
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest block">Official Voucher</span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">DEBIT NOTE</h1>
              <p className="text-xs text-slate-500 font-semibold mt-1">TAS ERP System generated Debit Adjustment</p>
            </div>
            <div className="text-right">
              <div className="inline-block px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-md text-xs font-black text-indigo-700 font-mono mb-1">
                {debitNoteNumber}
              </div>
              <p className="text-xs text-slate-600 font-semibold">Date: {formatDate(pReturn.return_date)}</p>
            </div>
          </div>

          {/* Supplier & Ref Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Debit Issued To (Supplier)</span>
              <p className="font-extrabold text-slate-900 text-sm">{pReturn.supplier?.name || "—"}</p>
              {pReturn.supplier?.company_name && (
                <p className="font-semibold text-slate-600">{pReturn.supplier.company_name}</p>
              )}
              {pReturn.supplier?.gstin && (
                <p className="font-mono font-bold text-slate-700 mt-1">GSTIN: {pReturn.supplier.gstin}</p>
              )}
            </div>

            <div className="space-y-1 sm:text-right">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Reference Information</span>
              <p className="font-semibold text-slate-700">Return Voucher: <span className="font-bold text-slate-900 font-mono">{pReturn.return_number}</span></p>
              <p className="font-semibold text-slate-700">Orig. Invoice: <span className="font-bold text-slate-900 font-mono">{pReturn.purchase?.invoice_no || pReturn.purchase?.purchase_number || "—"}</span></p>
              {pReturn.challan_no && <p className="font-semibold text-slate-700">Challan No: <span className="font-bold text-slate-900">{pReturn.challan_no}</span></p>}
              <p className="font-semibold text-slate-700">Reason: <span className="font-bold text-slate-900">{pReturn.reason || "Material Return"}</span></p>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="p-3">Item Description</th>
                  <th className="p-3 w-[80px]">HSN/SAC</th>
                  <th className="p-3 w-[100px] text-right">Qty</th>
                  <th className="p-3 w-[100px] text-right">Rate</th>
                  <th className="p-3 w-[80px] text-right">Disc (%)</th>
                  <th className="p-3 w-[120px] text-right">Taxable Value</th>
                </tr>
              </thead>
              <tbody>
                {pReturn.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-100 last:border-0 text-slate-800">
                    <td className="p-3">
                      <span className="font-bold text-slate-900 block">{item.material_type?.name || "Material"}</span>
                      {item.material_type?.category && (
                        <span className="text-[10px] text-slate-500 uppercase">{item.material_type.category}</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-slate-600">{item.hsn_sac || "—"}</td>
                    <td className="p-3 text-right font-bold text-rose-600">
                      {item.returned_qty} {item.unit}
                    </td>
                    <td className="p-3 text-right font-mono">{formatCurrency(item.rate)}</td>
                    <td className="p-3 text-right font-mono">{item.discount_percent}%</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(item.taxable_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total & Amount in Words */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end pt-2">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Debit Amount in Words:</span>
              <p className="text-xs font-bold text-slate-800 italic">{numberToWords(pReturn.grand_total)}</p>
            </div>

            <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 text-right space-y-1">
              <span className="text-xs font-bold text-rose-700 uppercase tracking-wider block">Net Debit Value</span>
              <span className="text-2xl font-black text-rose-700 font-mono">
                {formatCurrency(pReturn.grand_total)}
              </span>
            </div>
          </div>

          {/* Footer & Signature */}
          <div className="pt-8 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
            <div>
              <p className="font-bold text-slate-700">TAS ERP - Inventory & Finance</p>
              <p className="text-[10px] mt-0.5">This is a system generated Debit Note document.</p>
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
