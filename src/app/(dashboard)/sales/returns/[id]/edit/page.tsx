"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  User,
  FileText,
  Building2,
  Package,
  CheckCircle2,
  Loader2,
  Receipt,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import AsyncButton from "@/components/shared/AsyncButton";

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

interface SaleBill {
  id: string;
  bill_number: string;
  bill_date: string;
  grand_total: number;
  payment_status?: string;
  party_id: string;
}

interface ReturnLineItem {
  id?: string;
  item_id?: string;
  key: string;
  design_name: string;
  size: string;
  quantity: number;
  rate: number;
  amount: number;
}

export default function EditSalesReturnPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  // Master Data & Current Data
  const [returnNumber, setReturnNumber] = useState("");
  const [customer, setCustomer] = useState<Party | null>(null);
  const [customerBills, setCustomerBills] = useState<SaleBill[]>([]);
  const [selectedBillId, setSelectedBillId] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [items, setItems] = useState<ReturnLineItem[]>([]);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load Sales Return Details
  useEffect(() => {
    async function loadReturn() {
      if (!id) return;
      try {
        const res = await fetch(`/api/sales/returns/${id}`);
        if (!res.ok) throw new Error("Failed to fetch return details");
        const data = await res.json();
        const sReturn = data.return;

        setReturnNumber(sReturn.return_number);
        setCustomer(sReturn.party || null);
        setSelectedBillId(sReturn.original_bill_id || "");
        setReturnDate(sReturn.return_date ? sReturn.return_date.split("T")[0] : "");
        setReturnReason(sReturn.return_reason || "");

        // Load items from stock ledger entries
        const rawEntries: any[] = data.ledgerEntries || [];
        const formatted: ReturnLineItem[] = rawEntries.map((e, idx) => ({
          id: e.id,
          item_id: e.item_id,
          key: e.id || `item-${idx}`,
          design_name: e.design ? `${e.design.design_number || ""} - ${e.design.name}` : "Returned Item",
          size: e.size || "Free Size",
          quantity: Math.abs(Number(e.quantity_delta || 0)),
          rate: Number(e.value_delta && e.quantity_delta ? Math.abs(e.value_delta / e.quantity_delta) : 0),
          amount: Math.abs(Number(e.value_delta || 0)),
        }));

        setItems(formatted);

        // Fetch bills for customer to allow relinking original bill
        if (sReturn.party_id) {
          fetch(`/api/sales/bills?party_id=${sReturn.party_id}&type=all&limit=200`)
            .then((r) => r.json())
            .then((bData) => setCustomerBills(bData.data || []))
            .catch(() => {});
        }
      } catch (err: any) {
        toast.error(err.message || "Error loading sales return");
      } finally {
        setLoading(false);
      }
    }

    loadReturn();
  }, [id]);

  const handleQtyChange = (index: number, val: string) => {
    setItems((prev) => {
      const next = [...prev];
      const parsed = parseFloat(val) || 0;
      next[index] = {
        ...next[index],
        quantity: parsed,
        amount: parsed * next[index].rate,
      };
      return next;
    });
  };

  const handleRateChange = (index: number, val: string) => {
    setItems((prev) => {
      const next = [...prev];
      const parsed = parseFloat(val) || 0;
      next[index] = {
        ...next[index],
        rate: parsed,
        amount: next[index].quantity * parsed,
      };
      return next;
    });
  };

  const calculatedGrandTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnDate) {
      toast.error("Please enter a valid Return Date");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        return_date: returnDate,
        return_reason: returnReason,
        original_bill_id: selectedBillId || null,
        grand_total: calculatedGrandTotal,
        items: items.map((it) => ({
          id: it.id,
          item_id: it.item_id,
          quantity: it.quantity,
          amount: it.amount,
        })),
      };

      const res = await fetch(`/api/sales/returns/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update return");

      toast.success("Sales Return updated successfully!");
      router.push(`/sales/returns/${id}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1100px] mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/sales/returns/${id}`}
            className="p-2 hover:bg-[var(--table-row-hover)] rounded-lg transition-colors text-[var(--text-muted)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              Edit Sales Return: {returnNumber}
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Modify return date, reason, original bill reference, and item breakdown
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer & Return Context */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
            <User className="h-4 w-4" />
            Customer & Return Context
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                Customer Name
              </label>
              <div className="h-10 px-3 flex items-center bg-[var(--page-bg)] border border-[var(--border)] rounded-lg text-sm font-bold text-[var(--text-primary)]">
                {customer?.name || "—"} {customer?.company_name ? `(${customer.company_name})` : ""}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                Return Date *
              </label>
              <input
                type="date"
                required
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg px-3 h-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                Linked Original Sales Bill
              </label>
              <select
                value={selectedBillId}
                onChange={(e) => setSelectedBillId(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg px-3 h-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              >
                <option value="">No Bill Linked (Direct Return)</option>
                {customerBills.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bill_number} — {formatCurrency(b.grand_total)} ({new Date(b.bill_date).toLocaleDateString("en-IN")})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
              Reason for Return
            </label>
            <input
              type="text"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Reason for return..."
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg px-3 h-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
            />
          </div>
        </div>

        {/* Itemized Table */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
            <Package className="h-4 w-4" />
            Returned Stock Items
          </h2>

          <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[var(--table-header-bg)] text-[var(--text-muted)] border-b border-[var(--border)] font-bold uppercase">
                  <th className="p-3">Item Description</th>
                  <th className="p-3 text-right w-[120px]">Qty Returned</th>
                  <th className="p-3 text-right w-[140px]">Unit Rate (₹)</th>
                  <th className="p-3 text-right w-[140px]">Credit Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {items.map((item, idx) => (
                  <tr key={item.key} className="hover:bg-[var(--table-row-hover)]">
                    <td className="p-3 font-bold text-[var(--text-primary)]">
                      {item.design_name}
                    </td>
                    <td className="p-3 text-right">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleQtyChange(idx, e.target.value)}
                        className="w-24 h-9 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] text-right font-mono font-bold rounded-md px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
                      />
                    </td>
                    <td className="p-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.rate}
                        onChange={(e) => handleRateChange(idx, e.target.value)}
                        className="w-28 h-9 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] text-right font-mono font-bold rounded-md px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
                      />
                    </td>
                    <td className="p-3 text-right font-mono font-extrabold text-[var(--text-primary)] text-sm">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-between bg-[var(--card-bg)] border border-[var(--border)] p-4 rounded-xl shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-muted)]">Updated Total Value:</span>
            <span className="text-xl font-black text-rose-600 font-mono">
              {formatCurrency(calculatedGrandTotal)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/sales/returns/${id}`}
              className="px-4 py-2 border border-[var(--border)] rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--table-row-hover)]"
            >
              Cancel
            </Link>
            <AsyncButton
              type="submit"
              isLoading={saving}
              variant="primary"
              className="px-6 py-2 text-xs font-bold"
            >
              Save Changes
            </AsyncButton>
          </div>
        </div>
      </form>
    </div>
  );
}
