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
  tax_percent?: number;
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
  tax_percent: number;
  return_qty: number | "";
  taxable_amount: number;
  gst_amount: number;
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
  const [billType, setBillType] = useState<"pakka" | "kacha">("pakka");

  // Line items state
  const [lineItems, setLineItems] = useState<ReturnLineItem[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingBills, setLoadingBills] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 1. Initial Load (Customers & Godowns)
  useEffect(() => {
    async function loadMasterData() {
      try {
        setLoadingInitial(true);
        const [cRes, gRes] = await Promise.all([
          fetch("/api/parties?type=customer"),
          fetch("/api/master-data/godowns"),
        ]);

        if (cRes.ok) {
          const cData = await cRes.json();
          setCustomers(cData.parties || cData.data || []);
        }
        if (gRes.ok) {
          const gData = await gRes.json();
          const gList = gData.godowns || gData.data || [];
          setGodowns(gList);
          if (gList.length > 0) {
            setSelectedGodownId(gList[0].id);
          }
        }
      } catch (err) {
        console.error("Error loading master data:", err);
        toast.error("Failed to load customers/godowns");
      } finally {
        setLoadingInitial(false);
      }
    }
    loadMasterData();
  }, []);

  // 2. Fetch Bills (either for selected customer or all bills if customer not chosen)
  useEffect(() => {
    async function loadCustomerBills() {
      try {
        setLoadingBills(true);
        const url = selectedPartyId
          ? `/api/sales/bills?party_id=${selectedPartyId}&limit=500`
          : `/api/sales/bills?limit=500`;

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const billsList: SaleBill[] = data.bills || data.data || [];
          setCustomerBills(billsList);

          // If preselectedBillId matches a bill, select it
          if (preselectedBillId && billsList.some((b) => b.id === preselectedBillId)) {
            setSelectedBillId(preselectedBillId);
            const targetBill = billsList.find((b) => b.id === preselectedBillId);
            if (targetBill?.party_id) {
              setSelectedPartyId(targetBill.party_id);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching bills:", err);
      } finally {
        setLoadingBills(false);
      }
    }

    loadCustomerBills();
  }, [selectedPartyId, preselectedBillId]);

  // 3. Fetch Bill Items when selectedBillId changes
  useEffect(() => {
    if (!selectedBillId) {
      setLineItems([]);
      return;
    }

    async function loadBillDetails() {
      try {
        setLoadingItems(true);
        const res = await fetch(`/api/sales/bills/${selectedBillId}`);
        if (res.ok) {
          const data = await res.json();
          const billData: SaleBill = data.bill || data;
          setBillType(billData.bill_number?.startsWith("KB-") ? "kacha" : "pakka");

          const rawItems: SaleBillItem[] = billData.items || [];
          const lines: ReturnLineItem[] = rawItems.map((item, idx) => {
            const soldQty = Number(item.quantity || 0);
            const unitRate = Number(item.rate || 0);
            const taxPct = Number(item.tax_percent || 12);
            return {
              key: item.id || `item-${idx}`,
              design_id: item.design_id,
              design_name: item.design?.name || item.design?.design_number || "Design",
              colour_id: item.colour_id || null,
              colour_name: item.colour?.colour_name || "Standard",
              size: item.size || "all",
              sold_qty: soldQty,
              unit_rate: unitRate,
              tax_percent: taxPct,
              return_qty: "",
              taxable_amount: 0,
              gst_amount: 0,
              amount: 0,
            };
          });

          setLineItems(lines);
        }
      } catch (err) {
        console.error("Error fetching bill details:", err);
        toast.error("Failed to load bill items");
      } finally {
        setLoadingItems(false);
      }
    }

    loadBillDetails();
  }, [selectedBillId]);

  // 4. Handle Customer Selection Change
  const handleCustomerChange = (partyId: string) => {
    setSelectedPartyId(partyId);
  };

  // 5. Handle Return Qty Change for a Line Item
  const handleReturnQtyChange = (index: number, val: string) => {
    setLineItems((prev) => {
      const next = [...prev];
      const line = { ...next[index] };

      if (val === "") {
        line.return_qty = "";
        line.taxable_amount = 0;
        line.gst_amount = 0;
        line.amount = 0;
      } else {
        const parsed = parseInt(val, 10);
        let qty = parsed;
        if (isNaN(parsed) || parsed < 0) {
          qty = 0;
        } else if (parsed > line.sold_qty) {
          toast.warning(`Cannot return more than sold quantity (${line.sold_qty} pcs)`);
          qty = line.sold_qty;
        }

        line.return_qty = qty;
        line.taxable_amount = Number((qty * line.unit_rate).toFixed(2));
        line.gst_amount = billType === "kacha" ? 0 : Number(((line.taxable_amount * line.tax_percent) / 100).toFixed(2));
        line.amount = Number((line.taxable_amount + line.gst_amount).toFixed(2));
      }

      next[index] = line;
      return next;
    });
  };

  // 6. Calculate Totals
  const totalReturnedPieces = useMemo(() => {
    return lineItems.reduce((sum, line) => sum + (Number(line.return_qty) || 0), 0);
  }, [lineItems]);

  const totalTaxableAmount = useMemo(() => {
    return lineItems.reduce((sum, line) => sum + Number(line.taxable_amount || 0), 0);
  }, [lineItems]);

  const totalGstAmount = useMemo(() => {
    return billType === "kacha" ? 0 : lineItems.reduce((sum, line) => sum + Number(line.gst_amount || 0), 0);
  }, [lineItems, billType]);

  const cgst = useMemo(() => (billType === "kacha" ? 0 : Number((totalGstAmount / 2).toFixed(2))), [totalGstAmount, billType]);
  const sgst = useMemo(() => (billType === "kacha" ? 0 : Number((totalGstAmount / 2).toFixed(2))), [totalGstAmount, billType]);
  const igst = 0;

  const rawGrandTotal = totalTaxableAmount + totalGstAmount;
  const grandTotal = Math.round(rawGrandTotal);
  const roundOff = Number((grandTotal - rawGrandTotal).toFixed(2));

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
    if (totalReturnedPieces <= 0 || grandTotal <= 0) {
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
        tax_percent: line.tax_percent,
        taxable_amount: line.taxable_amount,
        gst_percent: line.tax_percent,
        gst_amount: line.gst_amount,
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
        gst_type: billType === "kacha" ? "without_gst" : "with_gst",
        taxable_amount: totalTaxableAmount,
        cgst,
        sgst,
        igst,
        round_off: roundOff,
        grand_total: grandTotal,
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
        <Loader2 className="h-8 w-8 text-[var(--primary)] animate-spin" />
        <span className="text-sm font-semibold text-[var(--text-muted)]">Loading Sales Return Form...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto select-none pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/sales/returns"
            className="w-9 h-9 border border-[var(--border)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--table-row-hover)] transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Record Customer Sales Return</h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 font-medium">
              Process returned customer items, restore stock to godown, and automatically issue a Credit Note
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: Customer, Bill & Godown Info */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--border-light)] pb-3">
            <User className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Customer & Return Context</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Customer Select */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-[var(--text-secondary)]">Customer / Party *</label>
              <select
                value={selectedPartyId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                className="
                  w-full h-10
                  bg-[var(--input-bg)]
                  border border-[var(--input-border)]
                  text-[var(--text-primary)]
                  placeholder:text-[var(--text-faint)]
                  focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent
                  rounded-lg px-3 text-sm
                  transition-colors
                "
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
              <label className="text-xs font-bold text-[var(--text-secondary)]">
                Original Sales Bill {loadingBills && <span className="text-[10px] text-[var(--primary)] font-normal">(Loading bills...)</span>}
              </label>
              <select
                value={selectedBillId}
                onChange={(e) => {
                  const bId = e.target.value;
                  setSelectedBillId(bId);
                  if (bId) {
                    const b = customerBills.find((bill) => bill.id === bId);
                    if (b?.party_id && b.party_id !== selectedPartyId) {
                      setSelectedPartyId(b.party_id);
                    }
                  }
                }}
                disabled={loadingBills}
                className="
                  w-full h-10
                  bg-[var(--input-bg)]
                  border border-[var(--input-border)]
                  text-[var(--text-primary)]
                  placeholder:text-[var(--text-faint)]
                  focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent
                  rounded-lg px-3 text-sm
                  transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                <option value="">
                  {loadingBills
                    ? "Loading Sales Bills..."
                    : customerBills.length === 0
                    ? "No Sales Bills Found"
                    : "Choose Sales Bill (Optional)..."}
                </option>
                {customerBills.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bill_number} — {formatCurrency(b.grand_total)} [{b.payment_status?.toUpperCase() || "UNPAID"}] ({new Date(b.bill_date).toLocaleDateString("en-IN")})
                  </option>
                ))}
              </select>
            </div>

            {/* Target Godown */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-[var(--text-secondary)]">Stock Destination (Godown) *</label>
              <select
                value={selectedGodownId}
                onChange={(e) => setSelectedGodownId(e.target.value)}
                className="
                  w-full h-10
                  bg-[var(--input-bg)]
                  border border-[var(--input-border)]
                  text-[var(--text-primary)]
                  placeholder:text-[var(--text-faint)]
                  focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent
                  rounded-lg px-3 text-sm
                  transition-colors
                "
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
              <label className="text-xs font-bold text-[var(--text-secondary)]">Return Date *</label>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="
                  w-full h-10
                  bg-[var(--input-bg)]
                  border border-[var(--input-border)]
                  text-[var(--text-primary)]
                  placeholder:text-[var(--text-faint)]
                  focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent
                  rounded-lg px-3 text-sm
                  transition-colors
                "
                required
              />
            </div>
          </div>
        </div>

        {/* Card 2: Return Items Table */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border-light)] pb-3">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-[var(--primary)]" />
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Return Items & Quantities</h2>
            </div>
            {lineItems.length > 0 && (
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                {lineItems.length} Sold Line Item(s) Loaded
              </span>
            )}
          </div>

          {!selectedPartyId ? (
            <div className="py-12 text-center text-[var(--text-muted)] text-sm">
              Please select a customer above to view available items for return.
            </div>
          ) : !selectedBillId ? (
            <div className="py-12 text-center text-[var(--text-muted)] text-sm">
              Select a Sales Bill above to automatically load exact sold designs, colours, sizes, and rates.
            </div>
          ) : loadingItems ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
              <Loader2 className="h-6 w-6 text-[var(--primary)] animate-spin" />
              <span className="text-xs font-semibold">Loading items from sales bill...</span>
            </div>
          ) : lineItems.length === 0 ? (
            <div className="py-12 text-center text-[var(--text-muted)] text-sm">
              No sold items found in this sales bill.
            </div>
          ) : (
            <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    <th className="py-3 px-4 min-w-[220px]">Design / Product</th>
                    <th className="py-3 px-4 whitespace-nowrap">Colour</th>
                    <th className="py-3 px-4 whitespace-nowrap">Size</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Sold Qty</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Unit Rate</th>
                    <th className="py-3 px-4 text-center min-w-[130px] whitespace-nowrap">Return Qty *</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Credit Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-light)]">
                  {lineItems.map((line, idx) => (
                    <tr key={line.key} className="hover:bg-[var(--table-row-hover)] transition-colors">
                      <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">
                        {line.design_name}
                      </td>
                      <td className="py-3 px-4 text-[var(--text-body)] whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 bg-[var(--page-bg)] px-2.5 py-0.5 rounded-full text-xs font-medium text-[var(--text-secondary)] border border-[var(--border)]">
                          <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                          {line.colour_name}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[var(--text-primary)] font-mono font-bold whitespace-nowrap">
                        {line.size}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-[var(--text-muted)] whitespace-nowrap">
                        {line.sold_qty} pcs
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-[var(--text-body)] whitespace-nowrap">
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
                            className="
                              w-24 h-9
                              bg-[var(--input-bg)]
                              border border-[var(--input-border)]
                              text-[var(--text-primary)]
                              placeholder:text-[var(--text-faint)]
                              focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent
                              rounded-md px-2.5 text-center font-mono font-bold text-sm
                              transition-colors
                            "
                          />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
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
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--border-light)] pb-3">
            <FileText className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Reason for Return & Remarks</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)]">Reason for Return *</label>
              <input
                type="text"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="e.g. Size misplacement, Fabric damage, Customer exchange"
                className="
                  w-full h-10
                  bg-[var(--input-bg)]
                  border border-[var(--input-border)]
                  text-[var(--text-primary)]
                  placeholder:text-[var(--text-faint)]
                  focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent
                  rounded-lg px-3 text-sm
                  transition-colors
                "
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)]">Internal Remarks (Optional)</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Additional notes for accounting or inventory..."
                className="
                  w-full h-10
                  bg-[var(--input-bg)]
                  border border-[var(--input-border)]
                  text-[var(--text-primary)]
                  placeholder:text-[var(--text-faint)]
                  focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent
                  rounded-lg px-3 text-sm
                  transition-colors
                "
              />
            </div>
          </div>
        </div>

        {/* Floating Sticky Action Footer (Bounded inside main content area) */}
        <div className="sticky bottom-4 bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-[0_10px_35px_rgba(0,0,0,0.3)] z-30 flex flex-wrap items-center justify-between px-6 transition-all mt-6">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Return Qty</span>
              <span className="text-xl font-bold text-[var(--text-primary)]">{totalReturnedPieces} Pcs</span>
            </div>

            <div className="h-8 w-[1px] bg-[var(--border)]" />

            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Taxable Amount</span>
              <span className="text-sm font-semibold text-[var(--text-body)]">{formatCurrency(totalTaxableAmount)}</span>
            </div>

            {billType === "pakka" && (
              <>
                <div className="h-8 w-[1px] bg-[var(--border)]" />

                <div>
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">CGST + SGST</span>
                  <span className="text-sm font-semibold text-[var(--text-body)]">{formatCurrency(cgst + sgst)}</span>
                </div>
              </>
            )}

            <div className="h-8 w-[1px] bg-[var(--border)]" />

            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Credit Note Grand Total</span>
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/sales/returns"
              className="px-4 h-10 border border-[var(--border)] rounded-lg text-sm font-semibold text-[var(--text-body)] bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] transition-colors flex items-center justify-center cursor-pointer"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={submitting || totalReturnedPieces <= 0}
              className="px-6 h-10 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-semibold text-sm rounded-lg shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
