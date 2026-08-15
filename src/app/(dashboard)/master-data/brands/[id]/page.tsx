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
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";
import ProgressBar from "@/components/shared/ProgressBar";
import PageState from "@/components/shared/PageState";

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
  const [activeTab, setActiveTab] = useState("lots");

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

  return (
    <PageState
      isLoading={isLoading}
      isError={!!error || (!isLoading && !brand)}
      error={error?.message || "Brand not found"}
      onRetry={refetch}
      skeletonVariant="card"
      skeletonCount={4}
    >
      {brand && (
        <div className="p-6 space-y-6">
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

          {/* Header card */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
            {/* Subtle decorative background gradient */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-[var(--primary-light)] rounded-2xl border border-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)] shrink-0 font-black text-xl shadow-sm overflow-hidden">
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
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-black text-[var(--text-primary)] tracking-tight">{brand.name}</h1>
                  {brand.is_primary && (
                    <span className="bg-[var(--primary-light)] text-[var(--primary)] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[var(--primary)]/20 uppercase">
                      Primary
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                      brand.is_active
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        : "bg-red-500/10 text-red-500 border-red-500/20"
                    }`}
                  >
                    {brand.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)] font-semibold">
                  {brand.gstin && (
                    <span className="font-mono bg-[var(--page-bg)] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-secondary)]">
                      GST: {brand.gstin}
                    </span>
                  )}
                  {brand.state && (
                    <span className="flex items-center gap-1 text-[var(--text-muted)]">
                      <MapPin size={13} className="text-[var(--text-faint)]" />
                      {brand.state} ({brand.state_code || "—"})
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => router.push(`/master-data/brands`)}
              className="h-10 px-4 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--page-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <ArrowLeft size={14} /> Back to List
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
              <div className="p-3 bg-[var(--primary-light)] rounded-lg text-[var(--primary)] shrink-0">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider">
                  Total Lots
                </span>
                <span className="text-lg font-black text-[var(--text-primary)]">{totalLots}</span>
              </div>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
              <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-500 shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider">
                  Produced Qty
                </span>
                <span className="text-lg font-black text-[var(--text-primary)]">
                  {totalProducedQty.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
              <div className="p-3 bg-amber-500/10 rounded-lg text-amber-500 shrink-0">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider">
                  Active Lots
                </span>
                <span className="text-lg font-black text-[var(--text-primary)]">{activeLots}</span>
              </div>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
              <div className="p-3 bg-[var(--page-bg)] rounded-lg text-[var(--text-muted)] shrink-0">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider">
                  Planned Qty
                </span>
                <span className="text-lg font-black text-[var(--text-primary)]">
                  {totalPlannedQty.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Tabs list */}
          <div className="flex gap-1 border-b border-[var(--border)] pb-px select-none">
            <button
              onClick={() => setActiveTab("lots")}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                activeTab === "lots"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Production Lots ({totalLots})
            </button>
            <button
              onClick={() => setActiveTab("designs")}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                activeTab === "designs"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Designs ({designs.length})
            </button>
            <button
              onClick={() => setActiveTab("stock")}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                activeTab === "stock"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Finished Stock ({stock.length})
            </button>
            <button
              onClick={() => setActiveTab("details")}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                activeTab === "details"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Brand Information
            </button>
          </div>

          {/* Tab content */}
          {activeTab === "lots" && (
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
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
                    {lots.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-[var(--text-muted)]">
                          No production lots have been assigned to this brand yet.
                        </td>
                      </tr>
                    ) : (
                      lots.map((lot) => (
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
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                                lot.status === "in_progress"
                                  ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                                  : lot.status === "completed"
                                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                  : lot.status === "on_hold"
                                  ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                  : lot.status === "cancelled"
                                  ? "bg-red-500/10 text-red-500 border border-red-500/20"
                                  : "bg-[var(--page-bg)] text-[var(--text-muted)] border border-[var(--border)]"
                              }`}
                            >
                              {lot.status.replace("_", " ")}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "designs" && (
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
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
                    {designs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-[var(--text-muted)]">
                          No designs configured for this brand yet.
                        </td>
                      </tr>
                    ) : (
                      designs.map((d) => (
                        <tr
                          key={d.id}
                          onClick={() => router.push(`/master-data/designs?search=${d.design_number}`)}
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
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                d.is_active
                                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                  : "bg-[var(--page-bg)] text-[var(--text-muted)] border border-[var(--border)]"
                              }`}
                            >
                              {d.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "stock" && (
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
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
                    {stock.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-[var(--text-muted)]">
                          No finished stock available for this brand&apos;s designs.
                        </td>
                      </tr>
                    ) : (
                      stock.map((item) => (
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "details" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Billing prefixes & configurations */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-[var(--text-primary)] border-b border-[var(--border)] pb-3 uppercase tracking-wider">
                  Document Numbering Configuration
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-xs">
                  <div>
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Bill Prefix (Pakka)
                    </span>
                    <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                      {brand.bill_prefix_pakka || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Bill Prefix (Kacha)
                    </span>
                    <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                      {brand.bill_prefix_kacha || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Design Prefix
                    </span>
                    <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                      {brand.design_prefix || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Design Separator
                    </span>
                    <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                      {brand.design_separator || "."}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Design Digits
                    </span>
                    <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                      {brand.design_digits || "4"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Legal / Contact Details */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-[var(--text-primary)] border-b border-[var(--border)] pb-3 uppercase tracking-wider">
                  Legal & Address Details
                </h3>
                <div className="space-y-3.5 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                        GSTIN
                      </span>
                      <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {brand.gstin || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                        State (Code)
                      </span>
                      <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {brand.state ? `${brand.state} (${brand.state_code || "—"})` : "—"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Registered Address
                    </span>
                    <span className="text-sm font-medium text-[var(--text-body)] block leading-relaxed">
                      {brand.address || "No address provided."}
                    </span>
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
