"use client";

import React, { useEffect, useState, useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";

export interface OutstandingBill {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total: number;
  outstanding: number;
  bill_type: "sale_bill" | "purchase_bill" | "raw_material_purchase" | "job_work_entry";
}

interface Allocation {
  billId: string;
  allocatedAmount: number;
  billType: OutstandingBill["bill_type"];
}

interface BillAllocationTableProps {
  bills: OutstandingBill[];
  paymentAmount: number;
  onAllocationChange: (allocations: Allocation[]) => void;
}

export default function BillAllocationTable({
  bills,
  paymentAmount,
  onAllocationChange,
}: BillAllocationTableProps) {
  // Store allocation values by bill ID
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  // Store check status by bill ID
  const [checkedBills, setCheckedBills] = useState<Record<string, boolean>>({});
  // Track if user has overridden the auto-allocation
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [, startTransition] = useTransition();

  // Reset local state if bills list changes
  useEffect(() => {
    setAllocations({});
    setCheckedBills({});
    setIsManualOverride(false);
  }, [bills]);

  // Auto-allocate oldest-first when paymentAmount changes (if not in manual override mode)
  useEffect(() => {
    if (isManualOverride || paymentAmount <= 0) return;

    // Sort bills oldest first (by date)
    const sortedBills = [...bills].sort(
      (a, b) => new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime()
    );

    let remainingMoney = paymentAmount;
    const newAllocations: Record<string, number> = {};
    const newChecked: Record<string, boolean> = {};

    sortedBills.forEach((bill) => {
      if (remainingMoney > 0) {
        const toAllocate = Math.min(remainingMoney, bill.outstanding);
        newAllocations[bill.id] = parseFloat(toAllocate.toFixed(2));
        newChecked[bill.id] = true;
        remainingMoney -= toAllocate;
      } else {
        newAllocations[bill.id] = 0;
        newChecked[bill.id] = false;
      }
    });

    setAllocations(newAllocations);
    setCheckedBills(newChecked);

    // Notify parent
    const result: Allocation[] = bills
      .filter((b) => newChecked[b.id] && newAllocations[b.id] > 0)
      .map((b) => ({
        billId: b.id,
        allocatedAmount: newAllocations[b.id],
        billType: b.bill_type,
      }));
    onAllocationChange(result);
  }, [paymentAmount, bills, isManualOverride]);

  // Handle checking/unchecking a bill
  const handleCheckChange = (billId: string, isChecked: boolean) => {
    setIsManualOverride(true);
    const updatedChecked = { ...checkedBills, [billId]: isChecked };
    const updatedAllocations = { ...allocations };

    if (!isChecked) {
      updatedAllocations[billId] = 0;
    } else {
      // Find the remaining payment amount to allocate to this checked bill
      const currentAllocated = Object.entries(updatedAllocations)
        .filter(([id]) => id !== billId)
        .reduce((sum, [, val]) => sum + val, 0);

      const bill = bills.find((b) => b.id === billId);
      if (bill) {
        const remainingPayment = Math.max(0, paymentAmount - currentAllocated);
        updatedAllocations[billId] = parseFloat(Math.min(remainingPayment, bill.outstanding).toFixed(2));
      }
    }

    setCheckedBills(updatedChecked);
    setAllocations(updatedAllocations);
    triggerParentUpdate(updatedChecked, updatedAllocations);
  };

  // Handle manual input in Allocate field
  const handleAmountChange = (billId: string, value: string) => {
    setIsManualOverride(true);
    const numValue = Math.max(0, parseFloat(value) || 0);

    const bill = bills.find((b) => b.id === billId);
    if (!bill) return;

    // Cap allocation at outstanding amount
    const cappedValue = parseFloat(Math.min(numValue, bill.outstanding).toFixed(2));

    const updatedAllocations = { ...allocations, [billId]: cappedValue };
    const updatedChecked = { ...checkedBills, [billId]: cappedValue > 0 };

    setAllocations(updatedAllocations);
    setCheckedBills(updatedChecked);
    triggerParentUpdate(updatedChecked, updatedAllocations);
  };

  const triggerParentUpdate = (checked: Record<string, boolean>, allocs: Record<string, number>) => {
    startTransition(() => {
      const result: Allocation[] = bills
        .filter((b) => checked[b.id] && allocs[b.id] > 0)
        .map((b) => ({
          billId: b.id,
          allocatedAmount: allocs[b.id],
          billType: b.bill_type,
        }));
      onAllocationChange(result);
    });
  };

  // Computations for summary/footer
  const totalAllocated = Object.entries(allocations)
    .filter(([id]) => checkedBills[id])
    .reduce((sum, [, val]) => sum + val, 0);

  const unallocatedAmount = Math.max(0, paymentAmount - totalAllocated);

  return (
    <div className="flex flex-col gap-4 border border-[var(--border-light)] rounded-xl bg-white overflow-hidden shadow-[var(--shadow-sm)]">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[var(--border-light)] border-b border-gray-200 text-[var(--text-muted)] font-bold uppercase tracking-wider">
              <th className="py-3 px-4 w-12 text-center">Select</th>
              <th className="py-3 px-4">Invoice / Bill No.</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Invoice Date</th>
              <th className="py-3 px-4">Due Date</th>
              <th className="py-3 px-4 text-right">Total Amount</th>
              <th className="py-3 px-4 text-right">Outstanding</th>
              <th className="py-3 px-4 text-right w-40">Allocate (₹)</th>
              <th className="py-3 px-4 text-right">Balance After</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-medium">
            {bills.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-[var(--text-muted)] font-semibold">
                  No outstanding bills found for this party.
                </td>
              </tr>
            ) : (
              bills.map((bill) => {
                const allocated = allocations[bill.id] || 0;
                const isChecked = !!checkedBills[bill.id];
                const balanceAfter = Math.max(0, bill.outstanding - allocated);

                return (
                  <tr key={bill.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 text-center">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => handleCheckChange(bill.id, !!checked)}
                        className="h-4.5 w-4.5 rounded border-[var(--input-border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                      />
                    </td>
                    <td className="py-3 px-4 text-[var(--text-primary)] font-bold">
                      {bill.invoice_number}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {bill.bill_type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[var(--text-muted)]">
                      {new Date(bill.invoice_date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3 px-4 text-[var(--text-muted)]">
                      {new Date(bill.due_date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3 px-4 text-right text-[var(--text-primary)]">
                      ₹{bill.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right text-amber-600 font-bold">
                      ₹{bill.outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end">
                        <input
                          type="number"
                          value={allocated || ""}
                          placeholder="0.00"
                          disabled={!isChecked}
                          onChange={(e) => handleAmountChange(bill.id, e.target.value)}
                          className="h-8 w-32 text-right text-xs font-bold border border-[var(--input-border)] bg-transparent px-3 py-1 focus:ring-1 focus:ring-[var(--primary)] rounded-lg disabled:opacity-50 outline-none"
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={
                          balanceAfter === 0
                            ? "text-[var(--alloc-fulfilled-color)] font-bold"
                            : "text-[var(--alloc-partial-color)] font-bold"
                        }
                      >
                        ₹{balanceAfter.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Allocation Summary Footer */}
      <div className="bg-slate-50 border-t border-gray-100 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-bold text-[var(--text-primary)]">
        <div>
          {isManualOverride && (
            <button
              onClick={() => setIsManualOverride(false)}
              className="text-[var(--primary)] hover:underline text-[10px] uppercase tracking-wider"
            >
              Reset to oldest-first auto-allocation
            </button>
          )}
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] uppercase tracking-wide">Total Allocated:</span>
            <span className="text-sm font-extrabold text-[var(--primary)]">
              ₹{totalAllocated.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] uppercase tracking-wide">Unallocated Amount:</span>
            <span
              className={
                unallocatedAmount > 0
                  ? "text-blue-600 text-sm font-extrabold"
                  : "text-green-600 text-sm font-extrabold"
              }
            >
              ₹{unallocatedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
