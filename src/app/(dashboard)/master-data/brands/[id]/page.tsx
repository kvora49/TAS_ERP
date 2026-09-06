"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  ChevronRight,
  MapPin,
  Layers,
  CheckCircle2,
  Clock,
  TrendingUp,
  ExternalLink,
  Sparkles,
  Palette,
  Warehouse,
  Hash,
  FileCheck,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";
import ProgressBar from "@/components/shared/ProgressBar";
import PageState from "@/components/shared/PageState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/shared/Badge";

interface Design {
  id?: string;
  name: string;
  code: string;
}

interface Lot {
  id: string;
  lot_number: string;
  lot_date: string;
  total_quantity: number;
  completed_quantity: number;
  status: "draft" | "in_progress" | "completed" | "on_hold" | "cancelled";
  design?: Design;
}

interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
  gstin: string | null;
  address: string | null;
  state: string | null;
  state_code: string | null;
  bill_prefix_pakka: string | null;
  bill_prefix_kacha: string | null;
  design_prefix: string | null;
  design_separator: string | null;
  design_digits: number | null;
  is_primary: boolean;
  is_active: boolean;
}

interface LinkedDesign {
  id: string;
  name: string;
  design_number: string;
  is_active: boolean;
  created_at: string;
}

interface StockItem {
  id: string;
  total_quantity: number;
  cost_per_piece: number;
  total_value: number;
  size_quantities: Record<string, number>;
  godown?: { id: string; name: string };
  design?: { id: string; name: string; code: string };
  colour?: { id: string; colour_name: string };
}

interface BrandDetailResponse {
  brand: Brand;
  lots: Lot[];
  designs: LinkedDesign[];
  stock: StockItem[];
}

export default function BrandDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"lots" | "designs" | "stock" | "details">("lots");

  const { data: detailData, isLoading, error, refetch } = useQuery<BrandDetailResponse>({
    queryKey: ["brand-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/brands/${id}`);
      if (!res.ok) throw new Error("Failed to fetch brand details");
      return res.json();
    },
    staleTime: 30_000,
  });

  const brand = detailData?.brand;
  const lots = detailData?.lots || [];
  const designs = detailData?.designs || [];
  const stock = detailData?.stock || [];

  // Compute rollups
  const totalLots = lots.length;
  const activeLots = lots.filter((l) => l.status === "in_progress").length;
  const totalPlannedQty = lots.reduce((acc, curr) => acc + Number(curr.total_quantity || 0), 0);
  const totalProducedQty = lots.reduce((acc, curr) => acc + Number(curr.completed_quantity || 0), 0);

  const getLotStatusStyle = (status: Lot["status"]) => {
    switch (status) {
      case "in_progress":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "completed":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "on_hold":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "cancelled":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-[var(--page-bg)] text-[var(--text-muted)] border-[var(--border)]";
    }
  };

  return (
    <PageState
      isLoading={isLoading}
      isError={!!error || (!isLoading && !brand)}
      error={error ? (error instanceof Error ? error.message : "Failed to load brand") : "Brand not found"}
      onRetry={refetch}
      skeletonVariant="card"
      skeletonCount={4}
    >
      {brand && (
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Navigation breadcrumbs */}
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)] select-none">
            <Link href="/" className="hover:text-[var(--text-primary)] transition-colors">
              Dashboard
            </Link>
            <ChevronRight size={12} />
            <span>Master Data</span>
            <ChevronRight size={12} />
            <Link href="/master-data/brands" className="hover:text-[var(--text-primary)] transition-colors">
              Brands
            </Link>
            <ChevronRight size={12} />
            <span className="text-[var(--text-primary)]">{brand.name}</span>
          </div>

          {/* Header Card - Mobile App Bar & Hero */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
            {/* Subtle decorative background gradient */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[var(--primary-light)] rounded-2xl border border-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)] shrink-0 font-black text-xl shadow-sm overflow-hidden">
                {brand.logo_url ? (
                  <Image
                    src={brand.logo_url}
                    alt={brand.name}
                    width={56}
                    height={56}
                    className="w-full h-full object-contain rounded-2xl"
                  />
                ) : (
                  brand.name.substring(0, 2).toUpperCase()
                )}
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black text-[var(--text-primary)] tracking-tight truncate">
                    {brand.name}
                  </h1>
                  {brand.is_primary && (
                    <span className="bg-[var(--primary-light)] text-[var(--primary)] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[var(--primary)]/20 uppercase">
                      Primary
                    </span>
                  )}
                  <StatusBadge active={brand.is_active} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)] font-semibold">
                  {brand.gstin && (
                    <span className="font-mono bg-[var(--page-bg)] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-secondary)]">
                      GST: {brand.gstin}
                    </span>
                  )}
                  {brand.state && (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} className="text-[var(--text-faint)]" />
                      {brand.state} ({brand.state_code || "—"})
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push(`/master-data/brands`)}
              className="self-start md:self-center h-9 sm:h-10 px-3.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--page-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
            >
              <ArrowLeft size={14} /> Back to List
            </button>
          </div>

          {/* Stats Row - Responsive 2x2 Grid on Mobile, 4 Columns on Desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 sm:p-4 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-[var(--primary-light)] rounded-lg text-[var(--primary)] shrink-0">
                <Layers className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider truncate">
                  Total Lots
                </span>
                <span className="text-base sm:text-lg font-black text-[var(--text-primary)]">
                  {totalLots}
                </span>
              </div>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 sm:p-4 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 rounded-lg text-emerald-500 shrink-0">
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider truncate">
                  Produced Qty
                </span>
                <span className="text-base sm:text-lg font-black text-[var(--text-primary)]">
                  {totalProducedQty.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 sm:p-4 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 rounded-lg text-amber-500 shrink-0">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider truncate">
                  Active Lots
                </span>
                <span className="text-base sm:text-lg font-black text-[var(--text-primary)]">
                  {activeLots}
                </span>
              </div>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 sm:p-4 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-[var(--page-bg)] rounded-lg text-[var(--text-muted)] shrink-0 border border-[var(--border)]">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider truncate">
                  Planned Qty
                </span>
                <span className="text-base sm:text-lg font-black text-[var(--text-primary)]">
                  {totalPlannedQty.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Subtabs Navigation - Horizontally Scrollable Segmented Bar */}
          <div className="flex gap-1.5 border-b border-[var(--border)] pb-px select-none overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab("lots")}
              className={`px-3.5 py-2 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === "lots"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Layers size={13} />
              Production Lots ({totalLots})
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
              <Palette size={13} />
              Designs ({designs.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("stock")}
              className={`px-3.5 py-2 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === "stock"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Warehouse size={13} />
              Finished Stock ({stock.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("details")}
              className={`px-3.5 py-2 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === "details"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <FileCheck size={13} />
              Brand Information
            </button>
          </div>

          {/* Tab Content: Production Lots */}
          {activeTab === "lots" && (
            <div className="space-y-3">
              {lots.length === 0 ? (
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-8 text-center text-[var(--text-muted)] text-sm">
                  No production lots have been assigned to this brand yet.
                </div>
              ) : (
                <>
                  {/* Mobile Card List View (block md:hidden) */}
                  <div className="block md:hidden space-y-2.5">
                    {lots.map((lot) => (
                      <div
                        key={lot.id}
                        onClick={() => router.push(`/production/lots/${lot.id}`)}
                        className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 shadow-sm active:scale-[0.99] transition-all cursor-pointer space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-mono text-xs font-bold text-[var(--primary)] bg-[var(--primary-light)] px-1.5 py-0.5 rounded border border-[var(--primary)]/20">
                              {lot.lot_number}
                            </span>
                            <h4 className="font-bold text-sm text-[var(--text-primary)] mt-1 truncate">
                              {lot.design?.code ? `${lot.design.code} - ${lot.design.name}` : "—"}
                            </h4>
                          </div>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getLotStatusStyle(
                              lot.status
                            )}`}
                          >
                            {lot.status.replace("_", " ")}
                          </span>
                        </div>

                        <div className="space-y-1 pt-1">
                          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                            <span>Production Progress</span>
                            <span className="font-bold text-[var(--text-primary)]">
                              {lot.completed_quantity.toLocaleString()} / {lot.total_quantity.toLocaleString()} pcs
                            </span>
                          </div>
                          <ProgressBar value={lot.completed_quantity} total={lot.total_quantity} />
                        </div>

                        <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-muted)]">
                          <span>Date: {formatDate(lot.lot_date)}</span>
                          <span className="font-bold text-[var(--primary)] text-[11px] flex items-center gap-1">
                            View Lot <ChevronRight size={12} />
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
                            <th className="py-3 px-5 w-40">Lot Number</th>
                            <th className="py-3 px-5">Lot Date</th>
                            <th className="py-3 px-5">Design / Style</th>
                            <th className="py-3 px-5 text-right w-32">Total Qty</th>
                            <th className="py-3 px-5 w-44">Production Progress</th>
                            <th className="py-3 px-5 text-center w-36">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)] text-sm text-[var(--text-body)]">
                          {lots.map((lot) => (
                            <tr
                              key={lot.id}
                              onClick={() => router.push(`/production/lots/${lot.id}`)}
                              className="hover:bg-[var(--table-row-hover)] transition-colors cursor-pointer"
                            >
                              <td className="py-3.5 px-5 font-mono text-xs font-bold text-[var(--primary)]">
                                {lot.lot_number}
                              </td>
                              <td className="py-3.5 px-5 text-[var(--text-muted)] font-mono text-xs">
                                {formatDate(lot.lot_date)}
                              </td>
                              <td className="py-3.5 px-5 font-semibold text-[var(--text-primary)]">
                                {lot.design?.code ? `${lot.design.code} - ${lot.design.name}` : "—"}
                              </td>
                              <td className="py-3.5 px-5 text-right font-medium text-[var(--text-body)]">
                                {lot.total_quantity.toLocaleString()}
                              </td>
                              <td className="py-3.5 px-5">
                                <ProgressBar value={lot.completed_quantity} total={lot.total_quantity} />
                              </td>
                              <td className="py-3.5 px-5 text-center" onClick={(e) => e.stopPropagation()}>
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${getLotStatusStyle(
                                    lot.status
                                  )}`}
                                >
                                  {lot.status.replace("_", " ")}
                                </span>
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

          {/* Tab Content: Designs */}
          {activeTab === "designs" && (
            <div className="space-y-3">
              {designs.length === 0 ? (
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-8 text-center text-[var(--text-muted)] text-sm">
                  No designs configured for this brand yet.
                </div>
              ) : (
                <>
                  {/* Mobile Card List View (block md:hidden) */}
                  <div className="block md:hidden space-y-2.5">
                    {designs.map((d) => (
                      <div
                        key={d.id}
                        onClick={() => router.push(`/master-data/designs/${d.id}`)}
                        className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 shadow-sm active:scale-[0.99] transition-all cursor-pointer space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-mono text-xs font-bold text-[var(--primary)] bg-[var(--primary-light)] px-1.5 py-0.5 rounded border border-[var(--primary)]/20">
                              {d.design_number}
                            </span>
                            <h4 className="font-bold text-sm text-[var(--text-primary)] mt-1 truncate">
                              {d.name}
                            </h4>
                          </div>
                          <StatusBadge active={d.is_active} />
                        </div>

                        <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-muted)]">
                          <span>Created: {formatDate(d.created_at)}</span>
                          <span className="font-bold text-[var(--primary)] text-[11px] flex items-center gap-1">
                            View Design <ChevronRight size={12} />
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
                            <th className="py-3 px-5">Design Code</th>
                            <th className="py-3 px-5">Design Name</th>
                            <th className="py-3 px-5">Created At</th>
                            <th className="py-3 px-5 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)] text-sm text-[var(--text-body)]">
                          {designs.map((d) => (
                            <tr
                              key={d.id}
                              onClick={() => router.push(`/master-data/designs/${d.id}`)}
                              className="hover:bg-[var(--table-row-hover)] transition-colors cursor-pointer"
                            >
                              <td className="py-3.5 px-5 font-mono text-xs font-bold text-[var(--primary)]">
                                {d.design_number}
                              </td>
                              <td className="py-3.5 px-5 font-semibold text-[var(--text-primary)]">
                                {d.name}
                              </td>
                              <td className="py-3.5 px-5 text-[var(--text-muted)] font-mono text-xs">
                                {formatDate(d.created_at)}
                              </td>
                              <td className="py-3.5 px-5 text-center">
                                <StatusBadge active={d.is_active} />
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

          {/* Tab Content: Finished Stock */}
          {activeTab === "stock" && (
            <div className="space-y-3">
              {stock.length === 0 ? (
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-8 text-center text-[var(--text-muted)] text-sm">
                  No finished stock available for this brand&apos;s designs.
                </div>
              ) : (
                <>
                  {/* Mobile Card List View (block md:hidden) */}
                  <div className="block md:hidden space-y-2.5">
                    {stock.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => item.design?.id && router.push(`/finished-stock/designs/${item.design.id}`)}
                        className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 shadow-sm active:scale-[0.99] transition-all cursor-pointer space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-[var(--text-primary)] truncate">
                              {item.design?.code ? `${item.design.code} - ${item.design.name}` : item.design?.name || "—"}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              {item.colour?.colour_name && (
                                <span className="bg-[var(--page-bg)] px-2 py-0.5 rounded text-[10px] font-semibold text-[var(--text-muted)] border border-[var(--border)]">
                                  {item.colour.colour_name}
                                </span>
                              )}
                              {item.godown?.name && (
                                <span className="bg-[var(--page-bg)] px-2 py-0.5 rounded text-[10px] font-semibold text-[var(--text-muted)] border border-[var(--border)]">
                                  {item.godown.name}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs text-[var(--text-muted)] block font-medium">In Stock</span>
                            <span className="text-sm font-black text-[var(--text-primary)] font-mono">
                              {item.total_quantity.toLocaleString()} pcs
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-xs">
                          <span className="text-[var(--text-muted)]">
                            Cost: ₹{item.cost_per_piece ? item.cost_per_piece.toFixed(2) : "0.00"}
                          </span>
                          <span className="font-mono font-bold text-[var(--primary)] text-sm">
                            ₹{item.total_value ? item.total_value.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
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
                            <th className="py-3 px-5">Design / Style</th>
                            <th className="py-3 px-5">Colour</th>
                            <th className="py-3 px-5">Godown</th>
                            <th className="py-3 px-5 text-right">In Stock Qty</th>
                            <th className="py-3 px-5 text-right">Cost Per Piece</th>
                            <th className="py-3 px-5 text-right">Total Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)] text-sm text-[var(--text-body)]">
                          {stock.map((item) => (
                            <tr
                              key={item.id}
                              onClick={() => item.design?.id && router.push(`/finished-stock/designs/${item.design.id}`)}
                              className="hover:bg-[var(--table-row-hover)] transition-colors cursor-pointer"
                            >
                              <td className="py-3.5 px-5 font-semibold text-[var(--text-primary)]">
                                {item.design?.code ? `${item.design.code} - ${item.design.name}` : item.design?.name || "—"}
                              </td>
                              <td className="py-3.5 px-5 text-xs text-[var(--text-muted)] font-medium">
                                {item.colour?.colour_name || "—"}
                              </td>
                              <td className="py-3.5 px-5 text-xs text-[var(--text-muted)]">
                                {item.godown?.name || "—"}
                              </td>
                              <td className="py-3.5 px-5 text-right font-mono font-bold text-[var(--text-primary)]">
                                {item.total_quantity.toLocaleString()}
                              </td>
                              <td className="py-3.5 px-5 text-right font-mono text-xs text-[var(--text-muted)]">
                                ₹{item.cost_per_piece ? item.cost_per_piece.toFixed(2) : "0.00"}
                              </td>
                              <td className="py-3.5 px-5 text-right font-mono font-bold text-[var(--primary)]">
                                ₹{item.total_value ? item.total_value.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
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

          {/* Tab Content: Brand Information - Mobile App Settings Styling */}
          {activeTab === "details" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* Document Numbering Configuration */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
                  <Hash size={16} className="text-[var(--primary)]" />
                  <h3 className="text-xs sm:text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">
                    Document Numbering Configuration
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-[var(--page-bg)] rounded-xl border border-[var(--border)]">
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Bill Prefix (Pakka)
                    </span>
                    <span className="font-mono text-sm font-bold text-[var(--text-primary)]">
                      {brand.bill_prefix_pakka || "N/A"}
                    </span>
                  </div>
                  <div className="p-3 bg-[var(--page-bg)] rounded-xl border border-[var(--border)]">
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Bill Prefix (Kacha)
                    </span>
                    <span className="font-mono text-sm font-bold text-[var(--text-primary)]">
                      {brand.bill_prefix_kacha || "N/A"}
                    </span>
                  </div>
                  <div className="p-3 bg-[var(--page-bg)] rounded-xl border border-[var(--border)]">
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Design Prefix
                    </span>
                    <span className="font-mono text-sm font-bold text-[var(--text-primary)]">
                      {brand.design_prefix || "N/A"}
                    </span>
                  </div>
                  <div className="p-3 bg-[var(--page-bg)] rounded-xl border border-[var(--border)]">
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Separator & Digits
                    </span>
                    <span className="font-mono text-sm font-bold text-[var(--text-primary)]">
                      &apos;{brand.design_separator || "."}&apos; / {brand.design_digits || "4"} digits
                    </span>
                  </div>
                </div>
              </div>

              {/* Legal & Contact Profile */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
                  <FileCheck size={16} className="text-emerald-500" />
                  <h3 className="text-xs sm:text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">
                    Legal & Location Details
                  </h3>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-[var(--page-bg)] rounded-xl border border-[var(--border)]">
                      <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                        GSTIN
                      </span>
                      <span className="font-mono text-sm font-bold text-[var(--text-primary)]">
                        {brand.gstin || "—"}
                      </span>
                    </div>
                    <div className="p-3 bg-[var(--page-bg)] rounded-xl border border-[var(--border)]">
                      <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                        State & Code
                      </span>
                      <span className="font-mono text-sm font-bold text-[var(--text-primary)]">
                        {brand.state ? `${brand.state} (${brand.state_code || "—"})` : "—"}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 bg-[var(--page-bg)] rounded-xl border border-[var(--border)]">
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Registered Address
                    </span>
                    <p className="text-xs sm:text-sm font-medium text-[var(--text-body)] leading-relaxed mt-0.5">
                      {brand.address || "No registered address provided for this brand."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </PageState>
  );
}
