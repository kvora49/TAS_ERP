"use client";

import React, { useEffect, useState, useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface OutstandingBill {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total: number;
  returned_amount?: number;
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

  const billIdsKey = bills.map((b) => `${b.id}:${b.outstanding}`).join(",");

  // Reset local state ONLY if the actual list of bills or outstanding amounts change
  useEffect(() => {
    setAllocations({});
    setCheckedBills({});
    setIsManualOverride(false);
  }, [billIdsKey]);

  // Re-allocate when paymentAmount or bills change
  useEffect(() => {
    if (paymentAmount <= 0 && !isManualOverride) return;

    if (!isManualOverride) {
      // Auto-allocate oldest-first across all bills
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

      const result: Allocation[] = bills
        .filter((b) => newChecked[b.id] && newAllocations[b.id] > 0)
        .map((b) => ({
          billId: b.id,
          allocatedAmount: newAllocations[b.id],
          billType: b.bill_type,
        }));
      onAllocationChange(result);
    } else if (paymentAmount > 0) {
      // In manual override mode: if paymentAmount changed, recalculate allocations for checked bills
      const updatedAllocations = { ...allocations };
      let remainingMoney = paymentAmount;

      const sortedBills = [...bills].sort(
        (a, b) => new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime()
      );

      sortedBills.forEach((bill) => {
        if (checkedBills[bill.id]) {
          const currentAlloc = updatedAllocations[bill.id] || 0;
          // If current allocation was 0 (checked before typing paymentAmount), auto-assign available money up to bill.outstanding
          const desiredAlloc = currentAlloc > 0 ? currentAlloc : bill.outstanding;
          const actualAlloc = Math.min(remainingMoney, desiredAlloc);
          updatedAllocations[bill.id] = parseFloat(actualAlloc.toFixed(2));
          remainingMoney -= actualAlloc;
        }
      });

      setAllocations(updatedAllocations);
      triggerParentUpdate(checkedBills, updatedAllocations);
    }
  }, [paymentAmount, bills, isManualOverride]);

  // Handle checking/unchecking a bill
  const handleCheckChange = (billId: string, isChecked: boolean) => {
    setIsManualOverride(true);
    const updatedChecked = { ...checkedBills, [billId]: isChecked };
    const updatedAllocations = { ...allocations };

    if (!isChecked) {
      updatedAllocations[billId] = 0;
    } else {
      const currentAllocated = Object.entries(updatedAllocations)
        .filter(([id]) => id !== billId && updatedChecked[id])
        .reduce((sum, [, val]) => sum + val, 0);

      const bill = bills.find((b) => b.id === billId);
      if (bill) {
        // If paymentAmount is specified, cap at remaining payment money; otherwise allocate up to bill.outstanding
        const remainingPayment = paymentAmount > 0 ? Math.max(0, paymentAmount - currentAllocated) : bill.outstanding;
        const targetAlloc = Math.min(remainingPayment > 0 ? remainingPayment : bill.outstanding, bill.outstanding);
        updatedAllocations[billId] = parseFloat(targetAlloc.toFixed(2));
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

    setCheckedBills(updatedChecked);
    setAllocations(updatedAllocations);
    triggerParentUpdate(updatedChecked, updatedAllocations);
  };

  const triggerParentUpdate = (checked: Record<string, boolean>, allocs: Record<string, number>) => {
    startTransition(() => {
      const result: Allocation[] = bills
        .filter((b) => checked[b.id] && (allocs[b.id] || 0) > 0)
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
    <div className="flex flex-col border border-[var(--border)] rounded-2xl bg-[var(--card-bg)] overflow-hidden shadow-[var(--shadow-sm)]">
      {/* Mobile Card View (md:hidden) */}
      <div className="md:hidden divide-y divide-[var(--border-light)]">
        {bills.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-muted)] text-sm font-semibold">
            No outstanding bills found for this party.
          </div>
        ) : (
          bills.map((bill) => {
            const allocated = allocations[bill.id] || 0;
            const isChecked = !!checkedBills[bill.id];
            const balanceAfter = Math.max(0, bill.outstanding - allocated);

            return (
              <div
                key={bill.id}
                className={cn(
                  "p-3.5 transition-colors space-y-3",
                  isChecked ? "bg-[var(--primary-light)]/20" : "hover:bg-[var(--table-row-hover)]"
                )}
              >
                {/* Header row: Checkbox, Bill No, Badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(checked) => handleCheckChange(bill.id, !!checked)}
                      className="h-4.5 w-4.5 rounded border-[var(--input-border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    <div className="min-w-0">
                      <span className="font-mono text-sm font-bold text-[var(--text-primary)] block truncate">
                        {bill.invoice_number}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full bg-[var(--border-light)] text-[var(--text-secondary)]">
                    {bill.bill_type.replace(/_/g, " ")}
                  </span>
                </div>

                {/* Dates row */}
                <div className="grid grid-cols-2 gap-2 text-xs text-[var(--text-muted)]">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-[var(--text-faint)] block">Date</span>
                    {new Date(bill.invoice_date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-[var(--text-faint)] block">Due Date</span>
                    {new Date(bill.due_date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>

                {/* Amounts row */}
                <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-[var(--page-bg)]/80 border border-[var(--border-light)]">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-[var(--text-faint)] block">Total</span>
                    <span className="font-mono font-semibold text-[var(--text-secondary)]">
                      ₹{bill.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                    {!!bill.returned_amount && bill.returned_amount > 0 && (
                      <span className="block text-[10px] font-bold text-rose-600 dark:text-rose-400">
                        -₹{bill.returned_amount.toLocaleString("en-IN")} ret.
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-semibold text-[var(--text-faint)] block">Outstanding</span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                      ₹{bill.outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Allocation input & quick actions */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Allocate Amount:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleAmountChange(bill.id, bill.outstanding.toString())}
                        className="px-2 py-0.5 text-[11px] font-bold rounded bg-[var(--primary-light)] text-[var(--primary)] hover:opacity-80 transition-opacity"
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCheckChange(bill.id, false)}
                        className="px-2 py-0.5 text-[11px] font-medium rounded bg-[var(--border-light)] text-[var(--text-muted)] hover:opacity-80 transition-opacity"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--text-muted)]">₹</span>
                      <input
                        type="number"
                        value={allocated || ""}
                        placeholder="0.00"
                        disabled={!isChecked}
                        onChange={(e) => handleAmountChange(bill.id, e.target.value)}
                        className="w-full h-9 pl-6 pr-3 text-right text-xs font-bold bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg disabled:opacity-40 transition-colors"
                      />
                    </div>
                    <div className="text-right min-w-[80px]">
                      <span className="text-[10px] uppercase font-semibold text-[var(--text-faint)] block">Rem. Bal</span>
                      <span
                        className={cn(
                          "font-mono text-xs font-bold",
                          balanceAfter === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                        )}
                      >
                        ₹{balanceAfter.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table (hidden md:block) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
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
          <tbody className="divide-y divide-[var(--border-light)] font-medium">
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
                  <tr key={bill.id} className="hover:bg-[var(--table-row-hover)] transition-colors">
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
                      <span className="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full bg-[var(--border-light)] text-[var(--text-secondary)]">
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
                      <div>₹{bill.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
                      {!!bill.returned_amount && bill.returned_amount > 0 && (
                        <span className="inline-block text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded mt-0.5">
                          -₹{bill.returned_amount.toLocaleString("en-IN")} returned
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-amber-600 dark:text-amber-400 font-bold">
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
                          className="h-8 w-32 text-right text-xs font-bold border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] px-3 py-1 focus:ring-1 focus:ring-[var(--input-focus)] rounded-lg disabled:opacity-50 outline-none"
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={
                          balanceAfter === 0
                            ? "text-emerald-600 dark:text-emerald-400 font-bold"
                            : "text-amber-600 dark:text-amber-400 font-bold"
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
      <div className="bg-[var(--table-header-bg)] border-t border-[var(--border)] p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold text-[var(--text-primary)]">
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
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 justify-between sm:justify-end">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] uppercase tracking-wide text-[10px] sm:text-xs">Total Allocated:</span>
            <span className="text-sm font-mono font-extrabold text-[var(--primary)]">
              ₹{totalAllocated.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] uppercase tracking-wide text-[10px] sm:text-xs">Unallocated:</span>
            <span
              className={cn(
                "text-sm font-mono font-extrabold",
                unallocatedAmount > 0 ? "text-blue-600 dark:text-blue-400" : "text-emerald-600 dark:text-emerald-400"
              )}
            >
              ₹{unallocatedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
