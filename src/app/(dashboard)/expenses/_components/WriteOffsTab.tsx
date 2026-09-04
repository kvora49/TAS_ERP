"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageState from "@/components/shared/PageState";

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

interface WriteOffsTabProps {
  onOpenReverseModal: (writeOffId: string) => void;
}

export default function WriteOffsTab({ onOpenReverseModal }: WriteOffsTabProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: pageData, isLoading, error, refetch } = useQuery<{ writeOffs: WriteOff[] }>({
    queryKey: ["write-offs"],
    queryFn: async () => {
      const res = await fetch("/api/payments/write-offs");
      if (!res.ok) throw new Error("Failed to load write-offs");
      return res.json();
    },
  });

  const writeOffs = pageData?.writeOffs || [];

  const filteredWriteOffs = writeOffs.filter((wo) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      wo.bill_number.toLowerCase().includes(term) ||
      wo.party_name.toLowerCase().includes(term) ||
      wo.remarks.toLowerCase().includes(term)
    );
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-faint)]" />
          <input
            type="text"
            placeholder="Search bill no, party name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg pl-9 pr-3 h-9 text-xs transition-colors"
          />
        </div>
      </div>

      {/* Write-offs Table */}
      <PageState
        isLoading={isLoading}
        isError={!!error}
        error={error?.message}
        onRetry={refetch}
        isEmpty={filteredWriteOffs.length === 0}
        skeletonVariant="table"
        skeletonRows={8}
        skeletonColumns={9}
        emptyTitle="No Write-offs Recorded"
        emptyMessage="No bad debt adjustments or write-offs found matching your search."
      >
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
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
              <tbody className="divide-y divide-[var(--border)] font-medium text-[var(--text-body)]">
                {filteredWriteOffs.map((wo) => {
                  const isReversed = !!wo.reversed_at;

                  let typeBadge = (
                    <span className="bg-slate-500/10 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-bold uppercase text-[9px] tracking-wide border border-slate-500/20">
                      Nil
                    </span>
                  );
                  if (wo.write_off_type === "loss") {
                    typeBadge = (
                      <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full font-bold uppercase text-[9px] tracking-wide border border-rose-500/20">
                        Loss
                      </span>
                    );
                  } else if (wo.write_off_type === "gain") {
                    typeBadge = (
                      <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase text-[9px] tracking-wide border border-emerald-500/20">
                        Gain
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={wo.id}
                      className={`hover:bg-[var(--table-row-hover)] transition-colors h-14 ${
                        isReversed ? "opacity-50 line-through bg-slate-500/5" : ""
                      }`}
                    >
                      <td className="py-3 px-6 capitalize">{wo.bill_type.replace(/_/g, " ")}</td>
                      <td className="py-3 px-6 font-mono text-[var(--text-primary)] font-bold">{wo.bill_number}</td>
                      <td className="py-3 px-6 font-bold">{wo.party_name}</td>
                      <td className="py-3 px-6 text-right text-[var(--text-primary)] font-bold">{formatCurrency(wo.amount)}</td>
                      <td className="py-3 px-6 text-center">{typeBadge}</td>
                      <td className="py-3 px-6 max-w-[200px] truncate" title={wo.remarks}>
                        {isReversed ? `[REVERSED: ${wo.reversal_reason}] ${wo.remarks}` : wo.remarks}
                      </td>
                      <td className="py-3 px-6">{wo.written_off_by_name}</td>
                      <td className="py-3 px-6 text-[var(--text-muted)] font-mono">
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
                            onClick={() => onOpenReverseModal(wo.id)}
                            className="h-7 text-[10px] font-bold border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-md px-2 flex items-center gap-1.5"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Reverse
                          </Button>
                        ) : (
                          <span className="text-[10px] text-[var(--text-faint)] font-bold">Reversed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Write-off Cards */}
          <div className="md:hidden divide-y divide-[var(--border-light)]">
            {filteredWriteOffs.map((wo) => {
              const isReversed = !!wo.reversed_at;

              return (
                <div key={wo.id} className={`p-3.5 space-y-2 ${isReversed ? "opacity-60" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-[var(--primary)]">{wo.bill_number}</span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[var(--table-header-bg)] text-[var(--text-muted)] border border-[var(--border)] capitalize">
                        {wo.bill_type.replace(/_/g, " ")}
                      </span>
                    </div>
                    {isReversed ? (
                      <span className="text-[9px] text-[var(--text-faint)] font-bold uppercase">Reversed</span>
                    ) : wo.write_off_type === "loss" ? (
                      <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full font-bold uppercase text-[9px] border border-rose-500/20">
                        Loss
                      </span>
                    ) : wo.write_off_type === "gain" ? (
                      <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase text-[9px] border border-emerald-500/20">
                        Gain
                      </span>
                    ) : (
                      <span className="bg-slate-500/10 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-bold uppercase text-[9px] border border-slate-500/20">
                        Nil
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-[var(--text-primary)] truncate max-w-[65%]">{wo.party_name}</span>
                    <span className="font-mono text-[var(--text-muted)] text-[11px]">
                      {new Date(wo.written_off_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                    </span>
                  </div>

                  {wo.remarks && (
                    <p className="text-[11px] text-[var(--text-muted)] bg-[var(--table-header-bg)] rounded px-2 py-1 border border-[var(--border-light)]">
                      {isReversed ? `[REVERSED: ${wo.reversal_reason}] ${wo.remarks}` : wo.remarks}
                    </p>
                  )}

                  <div className="flex justify-between items-center pt-1 border-t border-[var(--border-light)] text-xs">
                    <span className="font-mono font-bold text-sm text-[var(--text-primary)]">{formatCurrency(wo.amount)}</span>
                    {!isReversed && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onOpenReverseModal(wo.id)}
                        className="h-7 text-[10px] font-bold border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-md px-2.5 flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="h-3 w-3" /> Reverse
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </PageState>
    </div>
  );
}
