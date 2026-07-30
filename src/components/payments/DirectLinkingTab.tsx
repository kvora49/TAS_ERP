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
      <div className="space-y-6">
        {/* Top Actions */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Direct Payment Links & Contra Settlements
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              History of direct customer-to-supplier settlements and post-facto payment allocations.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 bg-[var(--primary)] text-white text-xs font-semibold rounded-xl hover:bg-[var(--primary-dark)] transition-all flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            + New Direct Contra Link
          </button>
        </div>

        {/* Links Table */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
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
                    <td className="px-4 py-3 font-bold text-[var(--primary)]">
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
