"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link as LinkIcon, RefreshCw, Plus, ArrowRight } from "lucide-react";
import PageState from "@/components/shared/PageState";
import DirectContraLinkModal from "@/components/payments/DirectContraLinkModal";

export default function DirectLinkingTab() {
  const [modalOpen, setModalOpen] = useState(false);

  // Fetch direct payment links & workspace data
  const { data: pageData, isLoading, error, refetch } = useQuery<{
    directLinks: any[];
  }>({
    queryKey: ["payments-direct-links"],
    queryFn: async () => {
      const res = await fetch("/api/payments");
      if (!res.ok) throw new Error("Failed to load direct linking data");
      return res.json();
    },
  });

  const links = pageData?.directLinks || [];

  return (
    <PageState
      isLoading={isLoading}
      isError={!!error}
      error={error?.message}
      onRetry={refetch}
      isEmpty={links.length === 0}
      skeletonVariant="table"
      skeletonRows={5}
      skeletonColumns={4}
      emptyTitle="No Direct Payment Links Recorded"
      emptyMessage="Direct Contra Links allow you to settle customer payment receipts directly against supplier/job worker bills without creating duplicate cash or bank entries."
    >
      <div className="space-y-4 sm:space-y-6">
        {/* Top Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-emerald-500 shrink-0" />
              <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate">
                Direct Payment Links
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                Contra Settlements
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1 sm:line-clamp-none">
              History of direct customer-to-supplier settlements and post-facto allocations.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="w-full sm:w-auto justify-center px-4 py-2 bg-[var(--primary)] text-white text-xs font-semibold rounded-xl hover:bg-[var(--primary-dark)] transition-all flex items-center gap-1.5 shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>New Contra Link</span>
          </button>
        </div>

        {/* Links Container */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
          {/* Mobile Card View (md:hidden) */}
          <div className="md:hidden divide-y divide-[var(--border-light)]">
            {links.map((link) => (
              <div key={link.id} className="p-3.5 space-y-2.5 hover:bg-[var(--table-row-hover)] transition-colors">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[11px] text-[var(--text-muted)] font-medium">
                    {link.created_at ? new Date(link.created_at).toLocaleDateString("en-IN") : "-"}
                  </span>
                  <span className="font-mono text-xs font-bold text-[var(--primary)]">
                    ₹{Number(link.linked_amount || 0).toLocaleString("en-IN")}
                  </span>
                </div>

                {/* Source to Target flow */}
                <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--page-bg)] text-xs">
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] uppercase font-semibold text-[var(--text-faint)] block">Customer (Source)</span>
                    <span className="font-semibold text-[var(--text-primary)] block truncate">
                      {link.source?.party?.name || "Customer"}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] block truncate">
                      {link.source?.payment_number || "Direct Receipt"}
                    </span>
                  </div>

                  <ArrowRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />

                  <div className="flex-1 min-w-0 text-right">
                    <span className="text-[9px] uppercase font-semibold text-[var(--text-faint)] block">Supplier (Target)</span>
                    <span className="font-semibold text-[var(--text-primary)] block truncate">
                      {link.target?.party?.name || "Supplier"}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] block truncate">
                      {link.target?.payment_number || "Bill Settlement"}
                    </span>
                  </div>
                </div>

                {link.remarks && (
                  <div className="text-[11px] text-[var(--text-muted)] italic truncate">
                    Memo: {link.remarks}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table (hidden md:block) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--table-header-bg)] text-[var(--text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--border)]">
                <tr>
                  <th className="px-4 py-3">Linked Date</th>
                  <th className="px-4 py-3">Source (Customer / Receipt)</th>
                  <th className="px-4 py-3">Target (Supplier / Bill)</th>
                  <th className="px-4 py-3">Linked Amount</th>
                  <th className="px-4 py-3">Remarks / Memo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {links.map((link) => (
                  <tr key={link.id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                    <td className="px-4 py-3 text-[var(--text-body)]">
                      {link.created_at ? new Date(link.created_at).toLocaleDateString("en-IN") : "-"}
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                      {link.source?.party?.name || "Customer"}
                      <span className="block text-[11px] text-[var(--text-muted)] font-normal">
                        Voucher: {link.source?.payment_number || "Direct Receipt"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                      {link.target?.party?.name || "Supplier"}
                      <span className="block text-[11px] text-[var(--text-muted)] font-normal">
                        Voucher: {link.target?.payment_number || "Bill Settlement"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-[var(--primary)] font-mono">
                      ₹{Number(link.linked_amount || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)] italic">
                      {link.remarks || "Direct Contra Settlement"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        <DirectContraLinkModal
          open={modalOpen}
          onOpenChange={setModalOpen}
        />
      </div>
    </PageState>
  );
}
