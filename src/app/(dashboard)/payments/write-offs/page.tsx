"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, RotateCcw, AlertCircle, X, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";

interface WriteOff {
  id: string;
  bill_type: "sale_bill" | "purchase_bill" | "raw_material_purchase";
  bill_id: string;
  write_off_type: "loss" | "gain" | "nil";
  amount: number;
  remarks: string;
  written_off_by_name: string;
  written_off_at: string;
  reversed_at: string | null;
  reversal_reason: string | null;
  bill_number: string;
  party_name: string;
}

export default function WriteOffsPage() {
  const queryClient = useQueryClient();
  const [selectedWriteOffId, setSelectedWriteOffId] = useState<string>("");
  const [reversalReason, setReversalReason] = useState<string>("");

  // Fetch write offs
  const { data: pageData, isLoading, error } = useQuery<{ writeOffs: WriteOff[] }>({
    queryKey: ["write-offs"],
    queryFn: async () => {
      const res = await fetch("/api/payments/write-offs");
      if (!res.ok) throw new Error("Failed to load write-offs");
      return res.json();
    },
  });

  const writeOffs = pageData?.writeOffs || [];

  // Mutation to reverse write-off
  const reverseMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/payments/write-offs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to reverse write-off");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Write-off reversed and outstanding balance restored!");
      queryClient.invalidateQueries({ queryKey: ["write-offs"] });
      setSelectedWriteOffId("");
      setReversalReason("");
    },
    onError: (err: any) => {
      toast.error(err.message || "An error occurred.");
    },
  });

  const handleReverseSubmit = async () => {
    if (!selectedWriteOffId) return;
    if (!reversalReason) {
      toast.error("Please enter a reversal reason.");
      return;
    }

    const payload = {
      action: "reverse",
      write_off_id: selectedWriteOffId,
      reversal_reason: reversalReason,
    };

    await reverseMutation.mutateAsync(payload);
  };

  // Computations for statistics (excluding reversed ones)
  const activeWriteOffs = writeOffs.filter((wo) => !wo.reversed_at);
  const totalWrittenOff = activeWriteOffs.reduce((sum, wo) => sum + Number(wo.amount), 0);
  const totalLoss = activeWriteOffs
    .filter((wo) => wo.write_off_type === "loss")
    .reduce((sum, wo) => sum + Number(wo.amount), 0);
  const totalGain = activeWriteOffs
    .filter((wo) => wo.write_off_type === "gain")
    .reduce((sum, wo) => sum + Number(wo.amount), 0);
  const totalNil = activeWriteOffs
    .filter((wo) => wo.write_off_type === "nil")
    .reduce((sum, wo) => sum + Number(wo.amount), 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
  };

  return (
    <PageState isLoading={isLoading} error={error?.message}>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Write-offs List</h1>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Payments & Finance / Bad Debt Adjustments
            </p>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total Written Off</span>
            <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(totalWrittenOff)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm border-l-4 border-l-red-500">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Loss (Bad Debt)</span>
            <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(totalLoss)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm border-l-4 border-l-green-500">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Gain (Discount Recd)</span>
            <p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(totalGain)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm border-l-4 border-l-slate-400">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Nil Adjustments</span>
            <p className="text-xl font-bold text-slate-500 mt-1">{formatCurrency(totalNil)}</p>
          </div>
        </div>

        {/* Table list */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-[var(--text-muted)] font-bold uppercase tracking-wider">
                  <th className="py-3 px-6">Bill Type</th>
                  <th className="py-3 px-6">Bill / Invoice No.</th>
                  <th className="py-3 px-6">Party Name</th>
                  <th className="py-3 px-6 text-right">Amount</th>
                  <th className="py-3 px-6 text-center">Type</th>
                  <th className="py-3 px-6">Remarks / Reason</th>
                  <th className="py-3 px-6">Written Off By</th>
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-6 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-slate-700">
                {writeOffs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-semibold">
                      No bad debts or invoice balances written off yet.
                    </td>
                  </tr>
                ) : (
                  writeOffs.map((wo) => {
                    const isReversed = !!wo.reversed_at;

                    let typeBadge = (
                      <span className="bg-slate-50 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase text-[9px] tracking-wide border border-slate-100">
                        Nil
                      </span>
                    );
                    if (wo.write_off_type === "loss") {
                      typeBadge = (
                        <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-bold uppercase text-[9px] tracking-wide border border-red-100">
                          Loss
                        </span>
                      );
                    } else if (wo.write_off_type === "gain") {
                      typeBadge = (
                        <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase text-[9px] tracking-wide border border-emerald-100">
                          Gain
                        </span>
                      );
                    }

                    return (
                      <tr key={wo.id} className={`hover:bg-slate-50/50 transition-colors h-14 ${isReversed ? "opacity-50 line-through bg-slate-50/20" : ""}`}>
                        <td className="py-3 px-6 capitalize">{wo.bill_type.replace(/_/g, " ")}</td>
                        <td className="py-3 px-6 font-mono text-slate-800 font-bold">{wo.bill_number}</td>
                        <td className="py-3 px-6 font-bold">{wo.party_name}</td>
                        <td className="py-3 px-6 text-right text-slate-900 font-bold">{formatCurrency(wo.amount)}</td>
                        <td className="py-3 px-6 text-center">{typeBadge}</td>
                        <td className="py-3 px-6 max-w-[200px] truncate" title={wo.remarks}>
                          {isReversed ? `[REVERSED: ${wo.reversal_reason}] ${wo.remarks}` : wo.remarks}
                        </td>
                        <td className="py-3 px-6">{wo.written_off_by_name}</td>
                        <td className="py-3 px-6 text-slate-500 font-mono">
                          {new Date(wo.written_off_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-6 text-center">
                          {!isReversed ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedWriteOffId(wo.id)}
                              className="h-7 text-[10px] font-bold border-red-200 text-red-600 hover:bg-red-50 rounded-md px-2 flex items-center gap-1.5"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Reverse
                            </Button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold">Reversed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reverse Write-off Modal */}
        {selectedWriteOffId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  Reverse Write-off Adjustment
                </h3>
                <button
                  onClick={() => setSelectedWriteOffId("")}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs font-semibold">
                <p className="text-slate-500 leading-relaxed">
                  Reversing this write-off will restore the original outstanding balance on the affected bill. Please provide a reason for this reversal.
                </p>
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-600">Reversal Reason *</label>
                  <input
                    type="text"
                    value={reversalReason}
                    placeholder="Enter reason..."
                    onChange={(e) => setReversalReason(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-transparent text-xs font-bold focus:ring-1 focus:ring-[var(--primary)] outline-none w-full"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-5 py-4 bg-slate-50 border-t border-slate-100">
                <Button
                  variant="outline"
                  onClick={() => setSelectedWriteOffId("")}
                  className="h-9 text-xs font-bold border-gray-300 text-slate-700 hover:bg-white"
                >
                  Cancel
                </Button>
                <AsyncButton
                  onClick={handleReverseSubmit}
                  className="h-9 text-xs font-bold bg-red-600 hover:bg-red-700 text-white"
                >
                  Confirm Reversal
                </AsyncButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageState>
  );
}
