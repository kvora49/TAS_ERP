"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Printer, FileText, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface SalesReturn {
  id: string;
  return_number: string;
  return_date: string;
  return_reason: string | null;
  grand_total: number;
  created_at: string;
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
  bill?: {
    bill_number: string;
    bill_date: string;
  } | null;
  credit_note?: {
    cn_number: string;
    credit_amount: number;
  } | null;
}

interface LedgerEntry {
  id: string;
  item_id: string;
  godown_id: string;
  quantity_delta: number;
  value_delta: number;
  design?: {
    name: string;
    design_number: string;
  };
}

export default function SalesReturnPrintPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoDownload = searchParams.get("autoDownload") === "true";

  const [sReturn, setSReturn] = useState<SalesReturn | null>(null);
  const [items, setItems] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/sales/returns/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch sales return details");
        return res.json();
      })
      .then((data) => {
        if (data.return) setSReturn(data.return);
        if (data.ledgerEntries) setItems(data.ledgerEntries);
      })
      .catch((err) => {
        toast.error(err.message || "Failed to load sales return");
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!loading && sReturn && autoDownload) {
      handleDownloadPDF();
    }
  }, [loading, sReturn, autoDownload]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    if (!sReturn) return;
    try {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("CREDIT NOTE / SALES RETURN MEMO", 105, 18, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Return No: ${sReturn.return_number}`, 14, 30);
      doc.text(`Date: ${new Date(sReturn.return_date).toLocaleDateString("en-IN")}`, 14, 36);
      if (sReturn.bill?.bill_number) {
        doc.text(`Original Bill: ${sReturn.bill.bill_number}`, 14, 42);
      }

      doc.text(`Customer: ${sReturn.party?.name || "N/A"}`, 120, 30);
      if (sReturn.party?.gstin) {
        doc.text(`GSTIN: ${sReturn.party.gstin}`, 120, 36);
      }

      const tableData = items.map((it, idx) => [
        idx + 1,
        it.design?.design_number || "ITEM",
        it.design?.name || "-",
        Math.abs(Number(it.quantity_delta || 0)),
        `Rs. ${Math.abs(Number(it.value_delta || 0)).toLocaleString("en-IN")}`,
      ]);

      autoTable(doc, {
        startY: 50,
        head: [["#", "Design Code", "Design Name", "Qty Returned", "Amount"]],
        body: tableData,
        theme: "striped",
        headStyles: { fillColor: [225, 29, 72] },
      });

      const finalY = ((doc as any).lastAutoTable?.finalY || 100) + 10;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Total Returned Credit: Rs. ${Number(sReturn.grand_total || 0).toLocaleString("en-IN")}`, 14, finalY);

      doc.save(`Credit_Note_${sReturn.return_number}.pdf`);
      toast.success("PDF Downloaded successfully!");
    } catch (err: any) {
      toast.error("Failed to generate PDF: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (!sReturn) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold">Sales Return Not Found</h2>
        <Button onClick={() => router.push("/sales/bills")} className="mt-4">
          Back to Sales
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6 print:p-0 print:bg-white text-black">
      {/* Top Action Bar (Hidden when printing) */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <Button variant="outline" onClick={() => router.push("/sales/bills")} className="gap-2">
          <ArrowLeft size={16} /> Back to Sales
        </Button>

        <div className="flex items-center gap-3">
          <Button onClick={handlePrint} variant="outline" className="gap-2">
            <Printer size={16} /> Print Memo
          </Button>
          <Button onClick={handleDownloadPDF} className="gap-2 bg-rose-600 hover:bg-rose-700 text-white">
            <Download size={16} /> Download PDF
          </Button>
        </div>
      </div>

      {/* Printable Sheet */}
      <div className="max-w-4xl mx-auto bg-white p-8 border border-slate-200 rounded-xl shadow-lg print:shadow-none print:border-none print:p-0">
        <div className="border-b-2 border-rose-600 pb-4 mb-6 flex justify-between items-start">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">Credit Note</span>
            <h1 className="text-2xl font-black text-slate-900 mt-1">SALES RETURN MEMO</h1>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{sReturn.return_number}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-slate-800">Date: {new Date(sReturn.return_date).toLocaleDateString("en-IN")}</p>
            {sReturn.bill?.bill_number && (
              <p className="text-xs text-slate-600 mt-1">Ref Invoice: <span className="font-semibold text-slate-900">{sReturn.bill.bill_number}</span></p>
            )}
          </div>
        </div>

        {/* Customer Details */}
        <div className="grid grid-cols-2 gap-6 p-4 bg-slate-50 rounded-lg border border-slate-200 mb-6 text-sm">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase">Customer Details</span>
            <p className="font-bold text-slate-900 text-base mt-1">{sReturn.party?.name}</p>
            {sReturn.party?.company_name && <p className="text-slate-600">{sReturn.party.company_name}</p>}
            {sReturn.party?.gstin && <p className="text-xs font-bold text-slate-700 mt-1">GSTIN: {sReturn.party.gstin}</p>}
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-slate-400 uppercase">Return Reason</span>
            <p className="font-semibold text-slate-800 mt-1">{sReturn.return_reason || "Customer Return / Stock Reversal"}</p>
          </div>
        </div>

        {/* Returned Items Table */}
        <div className="mb-6">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-300 text-xs font-bold text-slate-500 uppercase bg-slate-100">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Item / Design</th>
                <th className="py-2.5 px-3 text-right">Qty Returned</th>
                <th className="py-2.5 px-3 text-right">Return Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {items.length > 0 ? (
                items.map((it, idx) => (
                  <tr key={it.id || idx}>
                    <td className="py-3 px-3 font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900">{it.design?.design_number || "RETURN ITEM"}</p>
                      {it.design?.name && <p className="text-xs text-slate-500">{it.design.name}</p>}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-800">
                      {Math.abs(Number(it.quantity_delta || 0))} Pcs
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-rose-600">
                      ₹{Math.abs(Number(it.value_delta || 0)).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-slate-500 italic">
                    Sales Return Summary Entry
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Total Summary */}
        <div className="flex justify-end pt-4 border-t-2 border-slate-200">
          <div className="w-64 space-y-2 text-right">
            <div className="flex justify-between items-center text-base font-black text-rose-600 pt-2 border-t border-slate-200">
              <span>Total Credit Amount:</span>
              <span>₹{Number(sReturn.grand_total || 0).toLocaleString("en-IN")}</span>
            </div>
            <p className="text-[10px] text-slate-400 italic">Amount credited to customer balance & ledger</p>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-200 flex justify-between text-xs text-slate-500">
          <div>
            <p>Authorized Signatory</p>
          </div>
          <div className="text-right">
            <p>Generated by TAS ERP</p>
          </div>
        </div>
      </div>
    </div>
  );
}
