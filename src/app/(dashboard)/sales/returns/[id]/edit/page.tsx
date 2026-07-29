"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  User,
  FileText,
  Building2,
  Package,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
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

interface EditableItem {
  id?: string;
  item_id: string;
  godown_id?: string;
  quantity: number;
  rate: number;
  amount: number;
  design_number: string;
  design_name: string;
}

interface OriginalBillItem {
  id: string;
  design_id: string;
  colour_id: string | null;
  size: string;
  quantity: number;
  rate: number;
  amount: number;
  design?: { id: string; design_number?: string; name?: string };
}

export default function EditSalesReturnPage() {
  const { id } = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [returnNumber, setReturnNumber] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [originalBillId, setOriginalBillId] = useState<string | null>(null);

  // Items states
  const [items, setItems] = useState<EditableItem[]>([]);
  const [originalBillItems, setOriginalBillItems] = useState<OriginalBillItem[]>([]);
  const [selectedAddItemIndex, setSelectedAddItemIndex] = useState<string>("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/sales/returns/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load sales return");
        return res.json();
      })
      .then((data) => {
        if (data.return) {
          const r = data.return;
          setReturnNumber(r.return_number);
          setReturnDate(r.return_date ? new Date(r.return_date).toISOString().split("T")[0] : "");
          setReturnReason(r.return_reason || "");
          setCustomerName(r.party?.name || "Customer");
          setBillNumber(r.bill?.bill_number || "Direct Return");
          setOriginalBillId(r.original_bill_id || null);

          // If created from a bill, fetch original bill items for "+ Add Item" dropdown
          if (r.original_bill_id) {
            fetch(`/api/sales/bills/${r.original_bill_id}`)
              .then((bRes) => bRes.json())
              .then((bData) => {
                if (bData.items) {
                  setOriginalBillItems(bData.items);
                }
              })
              .catch(() => {});
          }
        }

        if (data.ledgerEntries && Array.isArray(data.ledgerEntries)) {
          const mapped: EditableItem[] = data.ledgerEntries.map((it: any) => {
            const qty = Math.abs(Number(it.quantity_delta || 0));
            const amt = Math.abs(Number(it.value_delta || 0));
            const rate = qty > 0 ? amt / qty : 0;
            return {
              id: it.id,
              item_id: it.item_id,
              godown_id: it.godown_id,
              quantity: qty,
              rate: Math.round(rate),
              amount: amt,
              design_number: it.design?.design_number || "SR-ITEM",
              design_name: it.design?.name || "Returned Item",
            };
          });
          setItems(mapped);
        }
      })
      .catch((err) => {
        toast.error(err.message || "Failed to fetch sales return details");
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Compute items from original bill that are not yet in the return list
  const availableBillItems = useMemo(() => {
    const currentItemIds = new Set(items.map((i) => i.item_id));
    return originalBillItems.filter((bItem) => !currentItemIds.has(bItem.design_id));
  }, [originalBillItems, items]);

  // Recalculate Total Credit Value
  const calculatedGrandTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [items]);

  const handleItemQtyChange = (index: number, newQty: number) => {
    const qty = Math.max(0, newQty);
    setItems((prev) => {
      const next = [...prev];
      const rate = next[index].rate;
      next[index] = {
        ...next[index],
        quantity: qty,
        amount: qty * rate,
      };
      return next;
    });
  };

  const handleItemRateChange = (index: number, newRate: number) => {
    const rate = Math.max(0, newRate);
    setItems((prev) => {
      const next = [...prev];
      const qty = next[index].quantity;
      next[index] = {
        ...next[index],
        rate: rate,
        amount: qty * rate,
      };
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddMissingItem = () => {
    if (!selectedAddItemIndex) return;
    const bItem = originalBillItems.find((bi) => bi.id === selectedAddItemIndex);
    if (!bItem) return;

    const newItem: EditableItem = {
      item_id: bItem.design_id,
      quantity: bItem.quantity,
      rate: bItem.rate,
      amount: bItem.amount,
      design_number: bItem.design?.design_number || "DES-ITEM",
      design_name: bItem.design?.name || "Original Invoice Item",
    };

    setItems((prev) => [...prev, newItem]);
    setSelectedAddItemIndex("");
    toast.success(`Added item '${newItem.design_number}' from original invoice!`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("Sales return must have at least one item.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sales/returns/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          return_date: returnDate,
          return_reason: returnReason,
          grand_total: calculatedGrandTotal,
          items: items.map((it) => ({
            id: it.id,
            item_id: it.item_id,
            godown_id: it.godown_id,
            quantity: it.quantity,
            amount: it.amount,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update sales return");
      }

      toast.success(`Sales return ${returnNumber} updated successfully!`);
      router.push("/sales/bills");
    } catch (err: any) {
      toast.error(err.message || "Failed to update sales return");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/sales/bills"
            className="w-9 h-9 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] flex items-center justify-center transition-colors"
          >
            <ArrowLeft size={18} className="text-[var(--text-body)]" />
          </Link>
          <div>
            <span className="text-xs font-semibold text-rose-500 uppercase tracking-wider">
              Sales Return
            </span>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              Edit Return {returnNumber}
            </h1>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Main Details Card */}
        <div className="bg-[var(--card-bg)] p-6 rounded-2xl border border-[var(--border)] shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 block">
                Customer / Party
              </label>
              <input
                type="text"
                disabled
                value={customerName}
                className="w-full bg-[var(--page-bg)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] opacity-70"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 block">
                Original Invoice Number
              </label>
              <input
                type="text"
                disabled
                value={billNumber}
                className="w-full bg-[var(--page-bg)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm font-mono font-semibold text-[var(--primary)] opacity-70"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 block">
                Return Date
              </label>
              <input
                type="date"
                required
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 block">
                Reason for Return
              </label>
              <input
                type="text"
                placeholder="e.g. Size misfit, damaged fabric, customer request"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              />
            </div>
          </div>
        </div>

        {/* Add Missing Item From Original Invoice Section */}
        {originalBillId && availableBillItems.length > 0 && (
          <div className="bg-[var(--primary-light)]/40 p-4 rounded-2xl border border-[var(--primary)]/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold text-[var(--primary)] uppercase tracking-wider">
                + Add Missing Items From Original Invoice ({billNumber})
              </span>
              <p className="text-xs text-[var(--text-muted)]">
                {availableBillItems.length} item(s) from the original invoice are not yet in this return list.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedAddItemIndex}
                onChange={(e) => setSelectedAddItemIndex(e.target.value)}
                className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
              >
                <option value="">Select Item to Add...</option>
                {availableBillItems.map((bi) => (
                  <option key={bi.id} value={bi.id}>
                    {bi.design?.design_number || "DES-ITEM"} ({bi.quantity} Pcs @ ₹{bi.rate})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddMissingItem}
                disabled={!selectedAddItemIndex}
                className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Plus size={14} /> Add Item
              </button>
            </div>
          </div>
        )}

        {/* Returned Items List */}
        <div className="bg-[var(--card-bg)] p-6 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Returned Items ({items.length})
            </h2>
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              Edit Quantity & Rate directly below
            </span>
          </div>

          <div className="overflow-x-auto border border-[var(--border)] rounded-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--table-header-bg)] text-xs font-bold text-[var(--text-muted)] uppercase select-none">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Design Code</th>
                  <th className="py-3 px-4">Design Name</th>
                  <th className="py-3 px-4 text-center w-[130px]">Qty Returned</th>
                  <th className="py-3 px-4 text-center w-[130px]">Rate (₹)</th>
                  <th className="py-3 px-4 text-right">Return Value</th>
                  <th className="py-3 px-4 text-right w-[60px]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {items.length > 0 ? (
                  items.map((it, idx) => (
                    <tr key={it.id || idx} className="hover:bg-[var(--table-row-hover)]">
                      <td className="py-3 px-4 font-mono text-[var(--text-muted)]">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-[var(--primary)]">
                        {it.design_number}
                      </td>
                      <td className="py-3 px-4 font-medium text-[var(--text-primary)]">
                        {it.design_name}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <input
                          type="number"
                          min="1"
                          value={it.quantity}
                          onChange={(e) => handleItemQtyChange(idx, Number(e.target.value))}
                          className="w-20 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg px-2 py-1 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={it.rate}
                          onChange={(e) => handleItemRateChange(idx, Number(e.target.value))}
                          className="w-24 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg px-2 py-1 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
                        />
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-500">
                        {formatCurrency(it.amount)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="w-7 h-7 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] hover:bg-red-500/10 text-red-500 flex items-center justify-center transition-all cursor-pointer"
                          title="Remove Item"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-rose-500 font-semibold italic">
                      No items remaining. Please add or keep at least one returned item.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-4 border-t border-[var(--border)]">
            <div className="text-right">
              <span className="text-xs text-[var(--text-muted)] uppercase font-bold block">
                Total Credit Value
              </span>
              <span className="text-2xl font-black text-rose-500">
                {formatCurrency(calculatedGrandTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-4 pt-4">
          <Link
            href="/sales/bills"
            className="px-6 py-2.5 border border-[var(--border)] rounded-xl text-sm font-bold text-[var(--text-muted)] hover:bg-[var(--table-row-hover)]"
          >
            Cancel
          </Link>
          <AsyncButton
            type="submit"
            isLoading={submitting}
            variant="primary"
            className="px-8 py-2.5 text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white"
          >
            Update Sales Return
          </AsyncButton>
        </div>
      </form>
    </div>
  );
}
