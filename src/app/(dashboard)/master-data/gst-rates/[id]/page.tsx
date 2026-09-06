"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Percent,
  Scissors,
  FileText,
  Sliders,
  ExternalLink,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import PageState from "@/components/shared/PageState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/shared/Badge";

interface RawMaterial {
  id: string;
  name: string;
  category: string;
  unit: string;
  is_active: boolean;
}

interface Design {
  id: string;
  name: string;
  design_number: string;
  is_active: boolean;
  brand?: {
    name: string;
  };
}

interface GstRate {
  id: string;
  hsn_code: string;
  description: string | null;
  gst_percent: number;
  auto_tier: boolean;
  tier_threshold: number | null;
  tier_low_gst: number | null;
  tier_high_gst: number | null;
  is_active: boolean;
}

interface GstRateDetailResponse {
  gstRate: GstRate;
  rawMaterials: RawMaterial[];
  designs: Design[];
}

export default function GstRateDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"materials" | "designs" | "tiering">("materials");

  const { data: detailData, isLoading, error, refetch } = useQuery<GstRateDetailResponse>({
    queryKey: ["gst-rate-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/gst-rates/${id}`);
      if (!res.ok) throw new Error("Failed to fetch GST rate details");
      return res.json();
    },
    staleTime: 30_000,
  });

  const gstRate = detailData?.gstRate;
  const rawMaterials = detailData?.rawMaterials || [];
  const designs = detailData?.designs || [];

  return (
    <PageState
      isLoading={isLoading}
      isError={!!error || (!isLoading && !gstRate)}
      error={error ? (error instanceof Error ? error.message : "Failed to load GST rate") : "GST Rate not found"}
      onRetry={refetch}
      skeletonVariant="card"
      skeletonCount={4}
    >
      {gstRate && (
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Navigation breadcrumbs */}
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)] select-none">
            <Link href="/" className="hover:text-[var(--text-primary)] transition-colors">
              Dashboard
            </Link>
            <ChevronRight size={12} />
            <span>Master Data</span>
            <ChevronRight size={12} />
            <Link href="/master-data/gst-rates" className="hover:text-[var(--text-primary)] transition-colors">
              GST Rates
            </Link>
            <ChevronRight size={12} />
            <span className="text-[var(--text-primary)]">HSN {gstRate.hsn_code}</span>
          </div>

          {/* Header card */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
            {/* Subtle decorative background gradient */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[var(--primary-light)] rounded-2xl border border-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)] shrink-0 font-black text-xl shadow-sm">
                <Percent size={22} />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black text-[var(--text-primary)] tracking-tight">
                    HSN / SAC: {gstRate.hsn_code}
                  </h1>
                  <StatusBadge active={gstRate.is_active} />
                  {gstRate.auto_tier ? (
                    <Badge variant="purple" className="text-[10px] px-2 py-0.5">
                      Auto-Tiered
                    </Badge>
                  ) : (
                    <Badge variant="gray" className="text-[10px] px-2 py-0.5">
                      Flat {gstRate.gst_percent}%
                    </Badge>
                  )}
                </div>
                {gstRate.description && (
                  <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed">
                    {gstRate.description}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push(`/master-data/gst-rates`)}
              className="self-start md:self-center h-9 sm:h-10 px-3.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--page-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
            >
              <ArrowLeft size={14} /> Back to List
            </button>
          </div>

          {/* Stats row - Responsive 2x2 grid on mobile, 4 columns on desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 sm:p-4 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-[var(--primary-light)] rounded-lg text-[var(--primary)] shrink-0">
                <Percent className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider truncate">
                  Base Rate
                </span>
                <span className="text-base sm:text-lg font-black text-[var(--text-primary)]">
                  {gstRate.gst_percent}%
                </span>
              </div>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 sm:p-4 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 rounded-lg text-emerald-500 shrink-0">
                <Scissors className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider truncate">
                  Raw Materials
                </span>
                <span className="text-base sm:text-lg font-black text-[var(--text-primary)]">
                  {rawMaterials.length}
                </span>
              </div>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 sm:p-4 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 rounded-lg text-blue-500 shrink-0">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider truncate">
                  Catalog Designs
                </span>
                <span className="text-base sm:text-lg font-black text-[var(--text-primary)]">
                  {designs.length}
                </span>
              </div>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 sm:p-4 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 rounded-lg text-amber-500 shrink-0">
                <Sliders className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider truncate">
                  Tax Structure
                </span>
                <span className="text-base sm:text-lg font-black text-[var(--text-primary)] truncate block">
                  {gstRate.auto_tier ? "Auto-Tiered" : "Flat Rate"}
                </span>
              </div>
            </div>
          </div>

          {/* Subtabs list - Scrollable pill bar */}
          <div className="flex gap-1.5 border-b border-[var(--border)] pb-px select-none overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab("materials")}
              className={`px-3.5 py-2 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === "materials"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Scissors size={13} />
              Referenced Raw Materials ({rawMaterials.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("designs")}
              className={`px-3.5 py-2 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === "designs"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <FileText size={13} />
              Referenced Catalog Designs ({designs.length})
            </button>
            {gstRate.auto_tier && (
              <button
                type="button"
                onClick={() => setActiveTab("tiering")}
                className={`px-3.5 py-2 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "tiering"
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Sliders size={13} />
                Tiering Rules
              </button>
            )}
          </div>

          {/* Tab content: Raw Materials */}
          {activeTab === "materials" && (
            <div className="space-y-3">
              {rawMaterials.length === 0 ? (
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-8 text-center text-[var(--text-muted)] text-sm">
                  No raw materials currently reference this HSN/SAC code.
                </div>
              ) : (
                <>
                  {/* Mobile Card List View (block md:hidden) */}
                  <div className="block md:hidden space-y-2.5">
                    {rawMaterials.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => router.push(`/master-data/raw-materials/${item.id}`)}
                        className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 shadow-sm active:scale-[0.99] transition-all cursor-pointer space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-[var(--text-primary)] truncate">
                              {item.name}
                            </h4>
                            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                              Category: {item.category || "Other"}
                            </span>
                          </div>
                          <StatusBadge active={item.is_active} />
                        </div>

                        <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-muted)]">
                          <span>
                            Default Unit: <strong className="text-[var(--text-primary)]">{item.unit}</strong>
                          </span>
                          <span className="font-bold text-[var(--primary)] text-[11px] flex items-center gap-1">
                            View Material <ExternalLink size={11} />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View (hidden md:block) */}
                  <div className="hidden md:block bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                            <th className="py-3 px-5">Material Name</th>
                            <th className="py-3 px-5 w-48">Category</th>
                            <th className="py-3 px-5 w-44">Default Unit</th>
                            <th className="py-3 px-5 text-center w-36">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)] text-sm text-[var(--text-body)]">
                          {rawMaterials.map((item) => (
                            <tr
                              key={item.id}
                              onClick={() => router.push(`/master-data/raw-materials/${item.id}`)}
                              className="hover:bg-[var(--table-row-hover)] transition-colors cursor-pointer"
                            >
                              <td className="py-3.5 px-5 font-bold text-[var(--text-primary)]">
                                {item.name}
                              </td>
                              <td className="py-3.5 px-5">
                                <span className="bg-[var(--page-bg)] border border-[var(--border)] text-[var(--text-muted)] text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                                  {item.category || "Other"}
                                </span>
                              </td>
                              <td className="py-3.5 px-5 font-semibold text-[var(--text-body)]">
                                {item.unit}
                              </td>
                              <td className="py-3.5 px-5 text-center" onClick={(e) => e.stopPropagation()}>
                                <StatusBadge active={item.is_active} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab content: Designs */}
          {activeTab === "designs" && (
            <div className="space-y-3">
              {designs.length === 0 ? (
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-8 text-center text-[var(--text-muted)] text-sm">
                  No catalog designs currently reference this HSN/SAC code.
                </div>
              ) : (
                <>
                  {/* Mobile Card List View (block md:hidden) */}
                  <div className="block md:hidden space-y-2.5">
                    {designs.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => router.push(`/master-data/designs/${item.id}`)}
                        className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 shadow-sm active:scale-[0.99] transition-all cursor-pointer space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-mono text-xs font-bold text-[var(--primary)] bg-[var(--primary-light)] px-1.5 py-0.5 rounded border border-[var(--primary)]/20">
                              {item.design_number}
                            </span>
                            <h4 className="font-bold text-sm text-[var(--text-primary)] mt-1 truncate">
                              {item.name}
                            </h4>
                          </div>
                          <StatusBadge active={item.is_active} />
                        </div>

                        <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-muted)]">
                          <span>
                            Brand: <strong className="text-[var(--text-secondary)]">{item.brand?.name || "—"}</strong>
                          </span>
                          <span className="font-bold text-[var(--primary)] text-[11px] flex items-center gap-1">
                            View Design <ExternalLink size={11} />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View (hidden md:block) */}
                  <div className="hidden md:block bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                            <th className="py-3 px-5 w-40">Design Number</th>
                            <th className="py-3 px-5">Design Name</th>
                            <th className="py-3 px-5">Brand</th>
                            <th className="py-3 px-5 text-center w-36">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)] text-sm text-[var(--text-body)]">
                          {designs.map((item) => (
                            <tr
                              key={item.id}
                              onClick={() => router.push(`/master-data/designs/${item.id}`)}
                              className="hover:bg-[var(--table-row-hover)] transition-colors cursor-pointer"
                            >
                              <td className="py-3.5 px-5 font-mono text-xs font-bold text-[var(--primary)]">
                                {item.design_number}
                              </td>
                              <td className="py-3.5 px-5 font-semibold text-[var(--text-primary)]">
                                {item.name}
                              </td>
                              <td className="py-3.5 px-5 font-medium text-[var(--text-secondary)]">
                                {item.brand?.name || "—"}
                              </td>
                              <td className="py-3.5 px-5 text-center" onClick={(e) => e.stopPropagation()}>
                                <StatusBadge active={item.is_active} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab content: Auto-Tiering Rules */}
          {activeTab === "tiering" && gstRate.auto_tier && (
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 max-w-xl">
              <h3 className="text-xs sm:text-sm font-black text-[var(--text-primary)] border-b border-[var(--border)] pb-3 uppercase tracking-wider">
                Auto-Tiering Rules
              </h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                When sale price/value per piece matches the threshold, the system dynamically swaps the applicable tax rate during sales billing.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 bg-[var(--page-bg)] rounded-xl border border-[var(--border)]">
                  <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                    Threshold Limit
                  </span>
                  <span className="text-sm font-bold text-[var(--text-primary)] font-mono">
                    ₹{gstRate.tier_threshold?.toLocaleString() || "0"}
                  </span>
                </div>
                <div className="p-3 bg-[var(--page-bg)] rounded-xl border border-[var(--border)]">
                  <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                    Low Tier (&le; Threshold)
                  </span>
                  <span className="text-sm font-bold text-emerald-500 font-mono">
                    {gstRate.tier_low_gst}%
                  </span>
                </div>
                <div className="p-3 bg-[var(--page-bg)] rounded-xl border border-[var(--border)]">
                  <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                    High Tier (&gt; Threshold)
                  </span>
                  <span className="text-sm font-bold text-indigo-500 font-mono">
                    {gstRate.tier_high_gst}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </PageState>
  );
}
