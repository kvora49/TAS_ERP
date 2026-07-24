"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  User,
  FileText,
  Building2,
  Package,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Loader2,
  Receipt,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(val || 0);
};

interface Party {
  id: string;
  name: string;
  company_name: string | null;
}

interface Godown {
  id: string;
  name: string;
}

interface SaleBillItem {
  id: string;
  design_id: string;
  colour_id: string | null;
  size: string;
  quantity: number;
  rate: number;
  amount: number;
  design?: { id: string; code?: string; design_number?: string; name: string };
  colour?: { id: string; colour_name: string };
}

interface SaleBill {
  id: string;
  bill_number: string;
  bill_date: string;
  grand_total: number;
  payment_status?: string;
  party_id: string;
  items?: SaleBillItem[];
}

interface ReturnLineItem {
  key: string;
  design_id: string;
  design_name: string;
  colour_id: string | null;
  colour_name: string;
  size: string;
  sold_qty: number;
  unit_rate: number;
  return_qty: number | "";
  amount: number;
}

export default function RecordSalesReturnPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedBillId = searchParams.get("bill_id");

  // Master Data States
  const [customers, setCustomers] = useState<Party[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [customerBills, setCustomerBills] = useState<SaleBill[]>([]);

  // Selection States
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [selectedBillId, setSelectedBillId] = useState("");
  const [selectedGodownId, setSelectedGodownId] = useState("");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split("T")[0]);
  const [returnReason, setReturnReason] = useState("");
  const [remarks, setRemarks] = useState("");

  // Loading States
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingBills, setLoadingBills] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Line items state
  const [lineItems, setLineItems] = useState<ReturnLineItem[]>([]);

  // 1. Initial Load: Fetch Customers & Godowns
  useEffect(() => {
    async function loadMasters() {
      try {
        const [cRes, gRes] = await Promise.all([
          fetch("/api/parties?type=customer"),
          fetch("/api/master-data/godowns"),
        ]);

        if (cRes.ok) {
          const cData = await cRes.json();
          setCustomers(cData.parties || []);
        }
        if (gRes.ok) {
          const gData = await gRes.json();
          const list = gData.godowns || [];
          setGodowns(list);
          if (list.length > 0) {
            setSelectedGodownId(list[0].id);
          }
        }
      } catch (err) {
        toast.error("Failed to load initial masters");
      } finally {
        setLoadingInitial(false);
      }
    }
    loadMasters();
  }, []);

  // 2. Fetch Sales Bills when Customer is Selected
  useEffect(() => {
    if (!selectedPartyId) {
      setCustomerBills([]);
      setSelectedBillId("");
      setLineItems([]);
      return;
    }

    async function loadCustomerBills() {
      setLoadingBills(true);
      try {
        const res = await fetch(`/api/sales/bills?party_id=${selectedPartyId}&type=all&limit=200`);
        if (res.ok) {
          const data = await res.json();
          setCustomerBills(data.data || []);
        }
      } catch (err) {
        toast.error("Failed to load customer sales bills");
      } finally {
        setLoadingBills(false);
      }
    }
    loadCustomerBills();
  }, [selectedPartyId]);

  // 3. Handle preselected bill ID query param
  useEffect(() => {
    if (preselectedBillId && customers.length > 0) {
      fetch(`/api/sales/bills/${preselectedBillId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.bill) {
            setSelectedPartyId(data.bill.party_id);
            setSelectedBillId(data.bill.id);
          }
        })
        .catch(() => {});
    }
  }, [preselectedBillId, customers]);

  // 4. Fetch Items when Sales Bill is Selected
  useEffect(() => {
    if (!selectedBillId) {
      setLineItems([]);
      return;
    }

    async function loadBillItems() {
      setLoadingItems(true);
      try {
        const res = await fetch(`/api/sales/bills/${selectedBillId}`);
        if (!res.ok) throw new Error("Failed to fetch sales bill details");

        const data = await res.json();
        const rawItems: SaleBillItem[] = data.bill?.items || [];

        const formattedLines: ReturnLineItem[] = rawItems.map((it, idx) => {
          const designName = it.design
            ? `${it.design.code || it.design.design_number || ""} - ${it.design.name}`
            : "Unknown Item";
          const colourName = it.colour?.colour_name || "Default Colour";

          return {
            key: `${it.id || idx}`,
            design_id: it.design_id,
            design_name: designName,
            colour_id: it.colour_id,
            colour_name: colourName,
            size: it.size || "Free Size",
            sold_qty: Number(it.quantity || 0),
            unit_rate: Number(it.rate || 0),
            return_qty: 0,
            amount: 0,
          };
        });

        setLineItems(formattedLines);
      } catch (err: any) {
        toast.error(err.message || "Failed to load bill items");
      } finally {
        setLoadingItems(false);
      }
    }

    loadBillItems();
  }, [selectedBillId]);

  // 5. Update Line Item Return Qty & Calculate Amount
  const handleReturnQtyChange = (index: number, val: string) => {
    setLineItems((prev) => {
      const next = [...prev];
      const line = { ...next[index] };

      if (val === "") {
        line.return_qty = "";
        line.amount = 0;
      } else {
        const parsed = parseInt(val, 10);
        if (isNaN(parsed) || parsed < 0) {
          line.return_qty = 0;
          line.amount = 0;
        } else if (parsed > line.sold_qty) {
          toast.warning(`Cannot return more than sold quantity (${line.sold_qty} pcs)`);
          line.return_qty = line.sold_qty;
          line.amount = line.sold_qty * line.unit_rate;
        } else {
          line.return_qty = parsed;
          line.amount = parsed * line.unit_rate;
        }
      }

      next[index] = line;
      return next;
    });
  };

  // 6. Calculate Totals
  const totalReturnedPieces = useMemo(() => {
    return lineItems.reduce((sum, line) => sum + (Number(line.return_qty) || 0), 0);
  }, [lineItems]);

  const calculatedCreditValue = useMemo(() => {
    return lineItems.reduce((sum, line) => sum + line.amount, 0);
  }, [lineItems]);

  // 7. Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPartyId) {
      toast.error("Please select a Customer");
      return;
    }
    if (!selectedGodownId) {
      toast.error("Please select a target Godown location for returned stock");
      return;
    }
    if (!returnDate) {
      toast.error("Please select a Return Date");
      return;
    }
    if (totalReturnedPieces <= 0 || calculatedCreditValue <= 0) {
      toast.error("Please enter return quantity (> 0) for at least one item");
      return;
    }
    if (!returnReason.trim()) {
      toast.error("Please enter a reason for the return");
      return;
    }

    const activeItems = lineItems
      .filter((line) => Number(line.return_qty) > 0)
      .map((line) => ({
        design_id: line.design_id,
        colour_id: line.colour_id,
        size: line.size,
        return_qty: Number(line.return_qty),
        quantity: Number(line.return_qty),
        unit_rate: line.unit_rate,
        rate: line.unit_rate,
        amount: line.amount,
      }));

    setSubmitting(true);
    try {
      const payload = {
        party_id: selectedPartyId,
        original_bill_id: selectedBillId || null,
        return_date: returnDate,
        return_reason: returnReason.trim(),
        remarks: remarks.trim(),
        godown_id: selectedGodownId,
        grand_total: calculatedCreditValue,
        items: activeItems,
      };

      const res = await fetch("/api/sales/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to process sales return");
      }

      toast.success("Sales Return processed! Credit Note issued & Stock restored to Godown.");
      router.push("/sales/returns");
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="p-12 flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-8 w-8 text-[#6366F1] animate-spin" />
        <span className="text-sm font-semibold text-[#64748B]">Loading Sales Return Form...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto select-none pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/sales/returns"
            className="w-9 h-9 border border-[#E5E7EB] rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#0F172A] hover:bg-[#F9FAFB] transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Record Customer Sales Return</h1>
            <p className="text-xs text-[#64748B] mt-0.5 font-medium">
              Process returned customer items, restore stock to godown, and automatically issue a Credit Note
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: Customer, Bill & Godown Info */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-[#F1F5F9] pb-3">
            <User className="h-5 w-5 text-[#6366F1]" />
            <h2 className="text-sm font-bold text-[#0F172A]">Customer & Return Context</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Customer Select */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-[#374151]">Customer / Party *</label>
              <select
                value={selectedPartyId}
                onChange={(e) => setSelectedPartyId(e.target.value)}
                className="w-full h-10 border border-[#E5E7EB] rounded-lg px-3 text-sm bg-white focus:ring-2 focus:ring-[#6366F1] outline-none"
                required
              >
                <option value="">Choose Customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.company_name ? `(${c.company_name})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Sales Bill Select */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-[#374151]">
                Original Sales Bill {loadingBills && <span className="text-[10px] text-[#6366F1] font-normal">(Loading bills...)</span>}
              </label>
              <select
                value={selectedBillId}
                onChange={(e) => setSelectedBillId(e.target.value)}
                disabled={!selectedPartyId || loadingBills}
                className="w-full h-10 border border-[#E5E7EB] rounded-lg px-3 text-sm bg-white focus:ring-2 focus:ring-[#6366F1] outline-none disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">{selectedPartyId ? "Choose Sales Bill (Optional)" : "Select Customer First"}</option>
                {customerBills.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bill_number} — {formatCurrency(b.grand_total)} [{b.payment_status?.toUpperCase() || "UNPAID"}] ({new Date(b.bill_date).toLocaleDateString("en-IN")})
                  </option>
                ))}
              </select>
            </div>

            {/* Target Godown */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-[#374151]">Stock Destination (Godown) *</label>
              <select
                value={selectedGodownId}
                onChange={(e) => setSelectedGodownId(e.target.value)}
                className="w-full h-10 border border-[#E5E7EB] rounded-lg px-3 text-sm bg-white focus:ring-2 focus:ring-[#6366F1] outline-none"
                required
              >
                <option value="">Select Godown Location...</option>
                {godowns.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Return Date */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-[#374151]">Return Date *</label>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full h-10 border border-[#E5E7EB] rounded-lg px-3 text-sm bg-white focus:ring-2 focus:ring-[#6366F1] outline-none"
                required
              />
            </div>
          </div>
        </div>

        {/* Card 2: Return Items Table */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-[#6366F1]" />
              <h2 className="text-sm font-bold text-[#0F172A]">Return Items & Quantities</h2>
            </div>
            {lineItems.length > 0 && (
              <span className="text-xs font-semibold text-[#64748B]">
                {lineItems.length} Sold Line Item(s) Loaded
              </span>
            )}
          </div>

          {!selectedPartyId ? (
            <div className="py-12 text-center text-[#64748B] text-sm">
              Please select a customer above to view available items for return.
            </div>
          ) : !selectedBillId ? (
            <div className="py-12 text-center text-[#64748B] text-sm">
              Select a Sales Bill above to automatically load exact sold designs, colours, sizes, and rates.
            </div>
          ) : loadingItems ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-[#64748B]">
              <Loader2 className="h-6 w-6 text-[#6366F1] animate-spin" />
              <span className="text-xs font-semibold">Loading items from sales bill...</span>
            </div>
          ) : lineItems.length === 0 ? (
            <div className="py-12 text-center text-[#64748B] text-sm">
              No sold items found in this sales bill.
            </div>
          ) : (
            <div className="overflow-x-auto border border-[#E5E7EB] rounded-lg">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-xs font-bold text-[#64748B] uppercase tracking-wider">
                    <th className="py-3 px-4 min-w-[220px]">Design / Product</th>
                    <th className="py-3 px-4 whitespace-nowrap">Colour</th>
                    <th className="py-3 px-4 whitespace-nowrap">Size</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Sold Qty</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Unit Rate</th>
                    <th className="py-3 px-4 text-center min-w-[130px] whitespace-nowrap">Return Qty *</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Credit Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {lineItems.map((line, idx) => (
                    <tr key={line.key} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-3 px-4 font-semibold text-[#0F172A]">
                        {line.design_name}
                      </td>
                      <td className="py-3 px-4 text-[#374151] whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 bg-slate-100 px-2.5 py-0.5 rounded-full text-xs font-medium text-slate-700 border border-slate-200">
                          <span className="w-2 h-2 rounded-full bg-slate-500" />
                          {line.colour_name}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#374151] font-mono font-bold whitespace-nowrap">
                        {line.size}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-[#64748B] whitespace-nowrap">
                        {line.sold_qty} pcs
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-[#374151] whitespace-nowrap">
                        {formatCurrency(line.unit_rate)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center">
                          <input
                            type="number"
                            min="0"
                            max={line.sold_qty}
                            value={line.return_qty}
                            onChange={(e) => handleReturnQtyChange(idx, e.target.value)}
                            placeholder="0"
                            className="w-24 h-9 border border-[#CBD5E1] rounded-md px-2.5 text-center font-mono font-bold text-sm focus:ring-2 focus:ring-[#6366F1] outline-none"
                          />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#15803D] whitespace-nowrap">
                        {formatCurrency(line.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Card 3: Return Reason & Remarks */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-[#F1F5F9] pb-3">
            <FileText className="h-5 w-5 text-[#6366F1]" />
            <h2 className="text-sm font-bold text-[#0F172A]">Reason for Return & Remarks</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#374151]">Reason for Return *</label>
              <input
                type="text"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="e.g. Size misplacement, Fabric damage, Customer exchange"
                className="w-full h-10 border border-[#E5E7EB] rounded-lg px-3 text-sm bg-white focus:ring-2 focus:ring-[#6366F1] outline-none"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#374151]">Internal Remarks (Optional)</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Additional notes for accounting or inventory..."
                className="w-full h-10 border border-[#E5E7EB] rounded-lg px-3 text-sm bg-white focus:ring-2 focus:ring-[#6366F1] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Sticky Action Footer */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] p-4 shadow-lg z-30 flex items-center justify-between px-8">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Total Return Qty</span>
              <span className="text-xl font-bold text-[#0F172A]">{totalReturnedPieces} Pcs</span>
            </div>

            <div className="h-8 w-[1px] bg-[#E5E7EB]" />

            <div>
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Credit Note Amount</span>
              <span className="text-xl font-bold text-[#15803D]">{formatCurrency(calculatedCreditValue)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/sales/returns"
              className="px-4 h-10 border border-[#E5E7EB] rounded-lg text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB] transition-colors flex items-center justify-center cursor-pointer"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={submitting || totalReturnedPieces <= 0}
              className="px-6 h-10 bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold text-sm rounded-lg shadow-md shadow-[#6366F1]/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Submit & Issue Credit Note</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
