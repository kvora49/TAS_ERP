"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/shared/Badge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ArrowLeft, Loader2, Calendar, FileText, CheckCircle2, Download, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface StockEntryItem {
  id: string;
  material_type_id: string;
  hsn_sac: string | null;
  unit: string;
  quantity: number;
  rate: number;
  batch_lot_no: string | null;
  expiry_date: string | null;
  amount: number;
  material_type?: {
    name: string;
    category: string;
  };
}

interface StockEntry {
  id: string;
  stock_entry_number: string;
  entry_type: "stock_in" | "stock_out" | "adjustment";
  reference_type: string | null;
  reference_no: string | null;
  reference_date: string | null;
  posting_date: string;
  remarks: string | null;
  notes: string | null;
  total_items_value: number;
  grand_total: number;
  status: "active" | "cancelled";
  attachments: string[];
  godown?: {
    name: string;
  };
  items: StockEntryItem[];
}

export default function StockEntryDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [entry, setEntry] = useState<StockEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const fetchEntryDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/raw-materials/stock/${id}`);
      if (!res.ok) throw new Error("Failed to fetch stock entry details");
      const data = await res.json();
      setEntry(data.entry);
    } catch (err: any) {
      toast.error(err.message || "Error loading stock entry");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntryDetails();
  }, [id]);

  const handleConfirmCancel = async () => {
    setCancelLoading(true);
    try {
      const res = await fetch(`/api/raw-materials/stock/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel entry");

      toast.success("Stock entry cancelled successfully! Stock quantities reverted.");
      setCancelOpen(false);
      fetchEntryDetails();
    } catch (err: any) {
      toast.error(err.message || "Could not cancel stock entry");
    } finally {
      setCancelLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#6366F1]" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="p-6 text-center text-sm font-semibold text-red-500">
        Stock entry not found.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
        <div className="flex items-center gap-3">
          <Link href="/raw-materials/stock" className="p-2 hover:bg-[#F1F5F9] rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5 text-[#64748B]" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[#0F172A]">
                Stock Entry: {entry.stock_entry_number}
              </h1>
              {entry.status === "active" ? (
                <Badge variant="green">Active</Badge>
              ) : (
                <Badge variant="red">Cancelled</Badge>
              )}
            </div>
            <p className="text-xs text-[#64748B]">
              Posted on {entry.posting_date} • Godown: {entry.godown?.name || "—"}
            </p>
          </div>
        </div>

        <div>
          {entry.status === "active" && (
            <button
              onClick={() => setCancelOpen(true)}
              className="px-3.5 py-1.5 text-xs font-bold text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-lg flex items-center gap-1.5 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" /> Cancel Entry
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details & Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header metadata summary */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h2 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Location & Posting</h2>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between font-semibold">
                  <span className="text-[#64748B]">Godown:</span>
                  <span className="text-[#0F172A] font-bold">{entry.godown?.name || "—"}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-[#64748B]">Posting Date:</span>
                  <span className="text-[#0F172A] font-mono">{entry.posting_date}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-[#64748B]">Entry Type:</span>
                  <span className="capitalize font-bold text-slate-800">{entry.entry_type.replace("_", " ")}</span>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Reference Source</h2>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between font-semibold">
                  <span className="text-[#64748B]">Ref Doc Type:</span>
                  <span className="capitalize text-slate-700 font-semibold">{entry.reference_type || "manual"}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-[#64748B]">Ref No:</span>
                  <span className="text-[#1E293B] font-mono">{entry.reference_no || "—"}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-[#64748B]">Ref Date:</span>
                  <span className="text-[#1E293B] font-mono">{entry.reference_date || "—"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Items breakdown table */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] mb-4 border-l-4 border-[#6366F1] pl-2.5">
              Material Items Logged
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[#64748B] font-bold">
                    <th className="pb-2">Material Type</th>
                    <th className="pb-2 w-[80px]">HSN</th>
                    <th className="pb-2 w-[100px] text-right">Quantity</th>
                    <th className="pb-2 w-[110px] text-right">Unit Cost</th>
                    <th className="pb-2 w-[100px]">Batch/Lot No.</th>
                    <th className="pb-2 w-[100px]">Expiry Date</th>
                    <th className="pb-2 w-[120px] text-right">Total Valuation (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.items?.map((item) => (
                    <tr key={item.id} className="border-b border-[#F1F5F9] last:border-0 align-middle">
                      <td className="py-3 pr-2">
                        <span className="font-bold text-[#0F172A]">{item.material_type?.name || "—"}</span>
                        <span className="text-[10px] text-[#64748B] block uppercase tracking-wider">
                          {item.material_type?.category || "—"}
                        </span>
                      </td>
                      <td className="py-3 pr-2 font-mono text-[10px]">{item.hsn_sac || "—"}</td>
                      <td className="py-3 pr-2 text-right font-extrabold text-slate-800">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-3 pr-2 text-right font-mono font-semibold">
                        {formatCurrency(item.rate)}
                      </td>
                      <td className="py-3 pr-2 font-mono text-[10px] text-slate-700">{item.batch_lot_no || "—"}</td>
                      <td className="py-3 pr-2 font-mono text-[10px] text-[#64748B]">{item.expiry_date || "—"}</td>
                      <td className="py-3 text-right font-mono font-extrabold text-[#0F172A]">
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Ledger Impact, valuation, cancellations */}
        <div className="space-y-6">
          {/* Valuation Box */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B] border-b border-[#F1F5F9] pb-2">
              Entry Valuation
            </h2>
            <div className="flex justify-between items-center bg-slate-50 p-3.5 rounded-lg border border-[#E2E8F0] font-bold text-slate-700">
              <span>Valuation:</span>
              <span className="font-mono text-lg font-black">{formatCurrency(entry.grand_total)}</span>
            </div>
            {entry.remarks && (
              <div className="bg-slate-50 p-2.5 rounded border border-[#E2E8F0] text-xs text-[#64748B] font-semibold">
                <span className="font-bold text-slate-800 block">Remarks:</span>
                {entry.remarks}
              </div>
            )}
          </div>

          {/* Stock Ledger Impact Card */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-[#4F46E5] uppercase tracking-wider">Stock Ledger Impact</h3>
            <p className="text-[10px] text-slate-600">
              This transaction has updated physical balances in the <strong>{entry.godown?.name || "godown"}</strong>.
            </p>

            <div className="space-y-2.5">
              {entry.items.map((it) => {
                const diffSymbol = entry.status === "cancelled" 
                  ? "Reverted" 
                  : entry.entry_type === "stock_in" 
                    ? `+${it.quantity}` 
                    : `-${it.quantity}`;
                
                const dotColor = entry.status === "cancelled"
                  ? "bg-slate-400"
                  : entry.entry_type === "stock_in"
                    ? "bg-emerald-500"
                    : "bg-red-500";

                return (
                  <div key={it.id} className="bg-white p-2.5 border border-indigo-100 rounded-lg text-xs font-semibold flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`}></span>
                      <span className="text-[#0F172A] truncate max-w-[120px]">{it.material_type?.name}</span>
                    </div>
                    <span className={`font-mono font-bold ${entry.status === "cancelled" ? "text-slate-500" : entry.entry_type === "stock_in" ? "text-emerald-700" : "text-red-700"}`}>
                      {diffSymbol} {it.unit}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Attachments */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B] border-b border-[#F1F5F9] pb-2 mb-3">
              Attachments
            </h2>
            {entry.attachments?.length === 0 ? (
              <p className="text-slate-400 text-xs italic text-center py-2">No attachments uploaded</p>
            ) : (
              <div className="space-y-2">
                {entry.attachments.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-2 bg-slate-50 border border-[#E2E8F0] rounded-lg text-xs font-bold text-[#6366F1] hover:bg-[#EEF2FF] transition-all"
                  >
                    <span className="flex items-center gap-1.5 truncate pr-2">
                      <FileText className="h-4 w-4 text-[#64748B]" />
                      Entry Attachment {i + 1}
                    </span>
                    <Download className="h-3.5 w-3.5 shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CANCEL CONFIRM DIALOG */}
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel Stock Entry"
        description={`Are you sure you want to cancel stock entry ${entry.stock_entry_number}? This will permanently revert current stock values in the godown.`}
        confirmText="Cancel Entry"
        loading={cancelLoading}
        onConfirm={handleConfirmCancel}
      />
    </div>
  );
}
