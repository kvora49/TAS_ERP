"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  MapPin,
  Building2,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  IndianRupee,
  TrendingUp,
  History,
  AlertCircle,
  Clock,
  Package,
  ShoppingBag,
  Percent,
  Maximize2,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Tag,
  Scissors,
  Warehouse,
  FileText,
  FileCheck,
  ExternalLink,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import PageState from "@/components/shared/PageState";
import { RollPassportModal } from "@/components/modals/RollPassportModal";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/shared/Badge";

interface Godown {
  id: string;
  name: string;
  code: string | null;
}

interface Stock {
  id: string;
  current_stock: number;
  unit_cost: number;
  stock_value: number;
  godown: Godown;
}

interface Purchase {
  id: string;
  quantity: number;
  rate: number;
  amount: number;
  purchaseId: string;
  invoiceNumber: string;
  purchaseDate: string;
  supplierName: string;
}

interface Movement {
  id: string;
  transaction_type: string;
  quantity_delta: number;
  value_delta: number;
  created_at: string;
  godown?: {
    name: string;
  };
}

interface Material {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  image_url?: string | null;
  reorder_level: number | null;
  hsn_code: string | null;
  gst_percent: number | null;
  is_active: boolean;
  default_supplier?: {
    id: string;
    name: string;
  };
}

interface Rollups {
  totalCurrentStock: number;
  totalStockValue: number;
  averagePurchaseCost: number;
  reorderWarning: boolean;
}

interface Roll {
  id: string;
  roll_number: string;
  shade: string | null;
  total_quantity: number;
  remaining_quantity: number;
  rate: number;
  invoice_no: string;
  invoice_date: string | null;
  supplier_name: string;
  created_at: string;
}

interface RawMaterialDetailResponse {
  material: Material;
  is_fabric?: boolean;
  stocks: Stock[];
  purchases: Purchase[];
  movements: Movement[];
  rolls?: Roll[];
  rollups: Rollups;
}

export default function RawMaterialDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"stock" | "rolls" | "purchases" | "movements" | "details">("stock");
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Roll Passport Modal state
  const [selectedRollId, setSelectedRollId] = useState<string | null>(null);
  const [passportModalOpen, setPassportModalOpen] = useState(false);

  // Rolls tab filters & pagination
  const [rollSearch, setRollSearch] = useState("");
  const [rollStatusFilter, setRollStatusFilter] = useState<"all" | "in_stock" | "partially_used" | "exhausted">("all");
  const [rollPage, setRollPage] = useState(1);
  const [rollPageSize, setRollPageSize] = useState(10);

  // Purchases tab pagination
  const [purchasePage, setPurchasePage] = useState(1);
  const [purchasePageSize, setPurchasePageSize] = useState(10);

  // Movements tab pagination
  const [movementPage, setMovementPage] = useState(1);
  const [movementPageSize, setMovementPageSize] = useState(10);

  const { data: detailData, isLoading, error, refetch } = useQuery<RawMaterialDetailResponse>({
    queryKey: ["raw-material-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/raw-materials/${id}`);
      if (!res.ok) throw new Error("Failed to fetch raw material details");
      return res.json();
    },
    staleTime: 30_000,
  });

  const material = detailData?.material;
  const stocks = detailData?.stocks || [];
  const purchases = detailData?.purchases || [];
  const movements = detailData?.movements || [];
  const rolls = detailData?.rolls || [];
  const rollups = detailData?.rollups || {
    totalCurrentStock: 0,
    totalStockValue: 0,
    averagePurchaseCost: 0,
    reorderWarning: false,
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case "purchase":
        return "Purchase Inward";
      case "purchase_return":
        return "Purchase Return";
      case "production_lot_allocation":
        return "Lot Allocation";
      case "production_lot_return":
        return "Lot Return";
      case "adjustment":
        return "Manual Adjustment";
      case "transfer_in":
        return "Transfer In";
      case "transfer_out":
        return "Transfer Out";
      default:
        return type.replace(/_/g, " ");
    }
  };

  // Rolls calculations & filters
  const activeRollsCount = rolls.filter((r) => r.remaining_quantity > 0).length;
  const exhaustedRollsCount = rolls.filter((r) => r.remaining_quantity === 0).length;
  const totalRollsCount = rolls.length;

  const filteredRolls = useMemo(() => {
    return rolls.filter((r) => {
      const matchesSearch =
        !rollSearch ||
        r.roll_number.toLowerCase().includes(rollSearch.toLowerCase()) ||
        (r.shade && r.shade.toLowerCase().includes(rollSearch.toLowerCase())) ||
        (r.invoice_no && r.invoice_no.toLowerCase().includes(rollSearch.toLowerCase())) ||
        (r.supplier_name && r.supplier_name.toLowerCase().includes(rollSearch.toLowerCase()));

      let matchesStatus = true;
      if (rollStatusFilter === "in_stock") {
        matchesStatus = r.remaining_quantity > 0;
      } else if (rollStatusFilter === "exhausted") {
        matchesStatus = r.remaining_quantity === 0;
      } else if (rollStatusFilter === "partially_used") {
        matchesStatus = r.remaining_quantity > 0 && r.remaining_quantity < r.total_quantity;
      }

      return matchesSearch && matchesStatus;
    });
  }, [rolls, rollSearch, rollStatusFilter]);

  const totalRollPages = Math.max(1, Math.ceil(filteredRolls.length / rollPageSize));
  const currentRollPage = Math.min(rollPage, totalRollPages);
  const pagedRolls = filteredRolls.slice(
    (currentRollPage - 1) * rollPageSize,
    currentRollPage * rollPageSize
  );

  // Purchases Pagination
  const totalPurchasePages = Math.max(1, Math.ceil(purchases.length / purchasePageSize));
  const currentPurchasePage = Math.min(purchasePage, totalPurchasePages);
  const pagedPurchases = purchases.slice(
    (currentPurchasePage - 1) * purchasePageSize,
    currentPurchasePage * purchasePageSize
  );

  // Movements Pagination
  const totalMovementPages = Math.max(1, Math.ceil(movements.length / movementPageSize));
  const currentMovementPage = Math.min(movementPage, totalMovementPages);
  const pagedMovements = movements.slice(
    (currentMovementPage - 1) * movementPageSize,
    currentMovementPage * movementPageSize
  );

  return (
    <PageState
      isLoading={isLoading}
      isError={!!error || (!isLoading && !material)}
      error={error ? (error instanceof Error ? error.message : "Failed to load raw material") : "Material not found"}
      onRetry={refetch}
      skeletonVariant="card"
      skeletonCount={4}
    >
      {material && (
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Navigation breadcrumbs */}
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)] select-none">
            <Link href="/" className="hover:text-[var(--text-primary)] transition-colors">
              Dashboard
            </Link>
            <ChevronRight size={12} />
            <span>Master Data</span>
            <ChevronRight size={12} />
            <Link href="/master-data/raw-materials" className="hover:text-[var(--text-primary)] transition-colors">
              Raw Materials
            </Link>
            <ChevronRight size={12} />
            <span className="text-[var(--text-primary)]">{material.name}</span>
          </div>

          {/* Header Card - Mobile App Bar & Hero */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
            {/* Subtle decorative background gradient */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

            <div className="flex items-start gap-3 sm:gap-5">
              {material.image_url ? (
                <div
                  className="relative group shrink-0 cursor-pointer"
                  onClick={() => setZoomImageUrl(material.image_url || null)}
                  title="Click for full screen"
                >
                  <img
                    src={material.image_url}
                    alt={material.name}
                    className="w-16 h-16 sm:w-24 sm:h-24 object-cover rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] shadow-md group-hover:scale-105 transition-all duration-200"
                  />
                  <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold select-none">
                    Zoom
                  </div>
                </div>
              ) : (
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[var(--primary-light)] rounded-2xl border border-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)] shrink-0 font-black text-xl shadow-sm">
                  <Package size={24} />
                </div>
              )}

              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black text-[var(--text-primary)] tracking-tight truncate">
                    {material.name}
                  </h1>
                  {material.category && (
                    <span className="bg-[var(--primary-light)] text-[var(--primary)] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[var(--primary)]/20 uppercase">
                      {material.category}
                    </span>
                  )}
                  <StatusBadge active={material.is_active} />
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)] font-semibold">
                  {material.default_supplier && (
                    <span className="flex items-center gap-1">
                      <Building2 size={12} className="text-[var(--text-faint)]" />
                      Supplier: {material.default_supplier.name}
                    </span>
                  )}
                  {material.hsn_code && (
                    <span className="font-mono bg-[var(--page-bg)] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-secondary)]">
                      HSN: {material.hsn_code}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-2 self-start md:self-center shrink-0">
              <button
                type="button"
                disabled={isSyncing}
                onClick={async () => {
                  setIsSyncing(true);
                  try {
                    const res = await fetch("/api/raw-materials/purchase-returns/reconcile", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ targetMaterialTypeId: id }),
                    });
                    if (!res.ok) throw new Error("Sync failed");
                    toast.success("Stock reconciled successfully!");
                    refetch();
                  } catch (err: any) {
                    toast.error(err.message || "Failed to reconcile stock");
                  } finally {
                    setIsSyncing(false);
                  }
                }}
                className="h-9 sm:h-10 px-3.5 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] hover:opacity-90 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              >
                <RefreshCw size={13} className={isSyncing ? "animate-spin" : ""} /> Sync Stock
              </button>

              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined" && document.referrer.includes("/stock/raw-materials")) {
                    router.push("/stock/raw-materials");
                  } else if (typeof window !== "undefined" && window.history.length > 1) {
                    router.back();
                  } else {
                    router.push("/master-data/raw-materials");
                  }
                }}
                className="h-9 sm:h-10 px-3.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--page-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <ArrowLeft size={14} /> Back to List
              </button>
            </div>
          </div>

          {/* Stats Row - Responsive 2x2 Grid on Mobile, 4 Columns on Desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 sm:p-4 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-[var(--primary-light)] rounded-lg text-[var(--primary)] shrink-0">
                <Layers className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider truncate">
                  Total Stock
                </span>
                <span className="text-base sm:text-lg font-black text-[var(--text-primary)]">
                  {rollups.totalCurrentStock.toLocaleString()}{" "}
                  <span className="text-xs font-semibold text-[var(--text-muted)]">{material.unit}</span>
                </span>
              </div>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 sm:p-4 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 rounded-lg text-emerald-500 shrink-0">
                <IndianRupee className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider truncate">
                  Stock Valuation
                </span>
                <span className="text-base sm:text-lg font-black text-[var(--text-primary)] truncate block">
                  {formatCurrency(rollups.totalStockValue)}
                </span>
              </div>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 sm:p-4 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 rounded-lg text-blue-500 shrink-0">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider truncate">
                  Avg Cost / {material.unit}
                </span>
                <span className="text-base sm:text-lg font-black text-blue-500 truncate block">
                  {formatCurrency(rollups.averagePurchaseCost)}
                </span>
              </div>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 sm:p-4 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 rounded-lg text-amber-500 shrink-0">
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider truncate">
                  Reorder Level
                </span>
                <span className="text-base sm:text-lg font-black text-amber-500">
                  {material.reorder_level ? material.reorder_level.toLocaleString() : "—"}{" "}
                  <span className="text-xs font-semibold text-[var(--text-muted)]">{material.unit}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Subtabs list - Scrollable Segmented Pill Bar */}
          <div className="flex gap-1.5 border-b border-[var(--border)] pb-px select-none overflow-x-auto no-scrollbar">
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
              Live Stock ({stocks.length})
            </button>

            {(detailData.is_fabric ?? (detailData.material.category?.toLowerCase() === "fabric" || (rolls && rolls.length > 0))) && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab("rolls");
                  setRollPage(1);
                }}
                className={`px-3.5 py-2 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "rolls"
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Layers size={13} />
                Rolls & Batches ({activeRollsCount}/{totalRollsCount})
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setActiveTab("purchases");
                setPurchasePage(1);
              }}
              className={`px-3.5 py-2 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === "purchases"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <ShoppingBag size={13} />
              Purchases ({purchases.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("movements");
                setMovementPage(1);
              }}
              className={`px-3.5 py-2 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === "movements"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <History size={13} />
              Movements ({movements.length})
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
              <FileText size={13} />
              Specifications
            </button>
          </div>

          {/* Tab content: Live Stock */}
          {activeTab === "stock" && (
            <div className="space-y-3">
              {stocks.length === 0 ? (
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-8 text-center text-[var(--text-muted)] text-sm">
                  No stock currently available in any godown.
                </div>
              ) : (
                <>
                  {/* Mobile Card List View (block md:hidden) */}
                  <div className="block md:hidden space-y-2.5">
                    {stocks.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => item.godown?.id && router.push(`/master-data/godowns/${item.godown.id}`)}
                        className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 shadow-sm active:scale-[0.99] transition-all cursor-pointer space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-bold text-sm text-[var(--text-primary)]">
                              {item.godown?.name || "Godown"}
                            </h4>
                            {item.godown?.code && (
                              <span className="font-mono text-[10px] text-[var(--text-muted)] bg-[var(--page-bg)] px-1.5 py-0.5 rounded border border-[var(--border)] mt-1 inline-block">
                                Code: {item.godown.code}
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-[var(--text-muted)] block font-medium">In Stock</span>
                            <span className="text-sm font-black text-[var(--text-primary)] font-mono">
                              {item.current_stock.toLocaleString()} {material.unit}
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-xs">
                          <span className="text-[var(--text-muted)]">Unit Cost: {formatCurrency(item.unit_cost)}</span>
                          <span className="font-mono font-bold text-[var(--primary)] text-sm">
                            {formatCurrency(item.stock_value)}
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
                            <th className="py-3 px-5">Godown Name</th>
                            <th className="py-3 px-5 w-40">Godown Code</th>
                            <th className="py-3 px-5 text-right w-44">Quantity In Stock</th>
                            <th className="py-3 px-5 text-right w-44">Unit Cost</th>
                            <th className="py-3 px-5 text-right w-44">Stock Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)] text-sm text-[var(--text-body)]">
                          {stocks.map((item) => (
                            <tr
                              key={item.id}
                              onClick={() => item.godown?.id && router.push(`/master-data/godowns/${item.godown.id}`)}
                              className="hover:bg-[var(--table-row-hover)] transition-colors cursor-pointer"
                            >
                              <td className="py-3.5 px-5 font-bold text-[var(--text-primary)]">
                                {item.godown?.name || "Godown"}
                              </td>
                              <td className="py-3.5 px-5 font-mono text-xs text-[var(--text-muted)]">
                                {item.godown?.code || "—"}
                              </td>
                              <td className="py-3.5 px-5 text-right font-mono font-bold text-[var(--text-primary)]">
                                {item.current_stock.toLocaleString()} {material.unit}
                              </td>
                              <td className="py-3.5 px-5 text-right font-mono text-xs text-[var(--text-muted)]">
                                {formatCurrency(item.unit_cost)}
                              </td>
                              <td className="py-3.5 px-5 text-right font-mono font-bold text-[var(--primary)]">
                                {formatCurrency(item.stock_value)}
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

          {/* Tab content: Rolls & Batches */}
          {activeTab === "rolls" && (
            <div className="space-y-3">
              {/* Filter & Search Toolbar */}
              <div className="p-3.5 sm:p-4 border border-[var(--border)] rounded-2xl bg-[var(--card-bg)] shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1 sm:max-w-xs">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
                    />
                    <input
                      type="text"
                      placeholder="Search roll no, shade, invoice..."
                      value={rollSearch}
                      onChange={(e) => {
                        setRollSearch(e.target.value);
                        setRollPage(1);
                      }}
                      className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg pl-8 pr-3 h-9 text-xs transition-colors"
                    />
                  </div>

                  {/* Status Pills */}
                  <div className="flex items-center gap-1 bg-[var(--page-bg)] p-1 rounded-xl border border-[var(--border)] overflow-x-auto no-scrollbar">
                    <button
                      type="button"
                      onClick={() => {
                        setRollStatusFilter("all");
                        setRollPage(1);
                      }}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                        rollStatusFilter === "all"
                          ? "bg-[var(--card-bg)] text-[var(--text-primary)] shadow-sm font-bold"
                          : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      All ({totalRollsCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRollStatusFilter("in_stock");
                        setRollPage(1);
                      }}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                        rollStatusFilter === "in_stock"
                          ? "bg-emerald-500/15 text-emerald-500 font-bold shadow-sm"
                          : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      In Stock ({activeRollsCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRollStatusFilter("exhausted");
                        setRollPage(1);
                      }}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                        rollStatusFilter === "exhausted"
                          ? "bg-slate-500/15 text-slate-400 font-bold shadow-sm"
                          : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      Exhausted ({exhaustedRollsCount})
                    </button>
                  </div>

                  {/* Per Page Selector */}
                  <div className="flex items-center gap-2 self-end sm:self-center text-xs text-[var(--text-muted)]">
                    <span className="hidden sm:inline font-medium">Per page:</span>
                    <select
                      value={rollPageSize}
                      onChange={(e) => {
                        setRollPageSize(Number(e.target.value));
                        setRollPage(1);
                      }}
                      className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg px-2.5 h-9 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-colors cursor-pointer"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>
              </div>

              {pagedRolls.length === 0 ? (
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-8 text-center text-[var(--text-muted)] text-sm">
                  {rollSearch || rollStatusFilter !== "all"
                    ? "No rolls match the search or filter criteria."
                    : "No individual rolls/batches recorded yet for this material."}
                </div>
              ) : (
                <>
                  {/* Mobile Card List View (block md:hidden) */}
                  <div className="block md:hidden space-y-2.5">
                    {pagedRolls.map((r) => {
                      const isExhausted = r.remaining_quantity === 0;
                      return (
                        <div
                          key={r.id}
                          onClick={() => {
                            setSelectedRollId(r.id);
                            setPassportModalOpen(true);
                          }}
                          className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 shadow-sm active:scale-[0.99] transition-all cursor-pointer space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-mono text-xs font-bold text-[var(--primary)] bg-[var(--primary-light)] px-1.5 py-0.5 rounded border border-[var(--primary)]/20">
                                {r.roll_number}
                              </span>
                              {r.shade && (
                                <span className="ml-2 text-xs font-bold text-[var(--text-secondary)] bg-[var(--page-bg)] px-2 py-0.5 rounded border border-[var(--border)]">
                                  Shade: {r.shade}
                                </span>
                              )}
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                isExhausted
                                  ? "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                                  : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                              }`}
                            >
                              {isExhausted ? "Exhausted" : "In Stock"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-1">
                            <span>Supplier: <strong className="text-[var(--text-primary)]">{r.supplier_name}</strong></span>
                            <span>Inv: <strong className="font-mono text-[var(--text-primary)]">{r.invoice_no}</strong></span>
                          </div>

                          <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-xs">
                            <span className="text-[var(--text-muted)]">
                              Balance: <strong className="text-[var(--text-primary)] font-mono">{r.remaining_quantity}</strong> / {r.total_quantity} {material.unit}
                            </span>
                            <span className="font-mono font-bold text-[var(--primary)] text-sm">
                              Rate: ₹{r.rate.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table View (hidden md:block) */}
                  <div className="hidden md:block bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                            <th className="py-3 px-5">Roll / Batch No.</th>
                            <th className="py-3 px-5">Colour / Shade</th>
                            <th className="py-3 px-5">Supplier & Invoice</th>
                            <th className="py-3 px-5 text-right">Initial Qty</th>
                            <th className="py-3 px-5 text-right">Remaining Balance</th>
                            <th className="py-3 px-5 text-center">Status</th>
                            <th className="py-3 px-5 text-right">Purchase Rate</th>
                            <th className="py-3 px-5 text-center w-28">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)] text-sm text-[var(--text-body)]">
                          {pagedRolls.map((r) => {
                            const isExhausted = r.remaining_quantity === 0;
                            return (
                              <tr
                                key={r.id}
                                onClick={() => {
                                  setSelectedRollId(r.id);
                                  setPassportModalOpen(true);
                                }}
                                className="hover:bg-[var(--table-row-hover)] transition-colors cursor-pointer"
                              >
                                <td className="py-3.5 px-5 font-bold font-mono text-[var(--primary)]">
                                  {r.roll_number}
                                </td>
                                <td className="py-3.5 px-5 font-semibold text-[var(--text-primary)]">
                                  {r.shade ? (
                                    <span className="px-2 py-0.5 rounded bg-[var(--page-bg)] border border-[var(--border)] text-xs font-bold text-[var(--text-secondary)]">
                                      {r.shade}
                                    </span>
                                  ) : (
                                    <span className="text-[var(--text-faint)]">—</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-5 text-xs text-[var(--text-muted)]">
                                  <span className="font-bold text-[var(--text-primary)] block">{r.supplier_name}</span>
                                  <span className="font-mono text-[11px] text-[var(--text-muted)]">
                                    Inv: {r.invoice_no}
                                  </span>
                                </td>
                                <td className="py-3.5 px-5 text-right font-mono text-[var(--text-muted)]">
                                  {r.total_quantity} {material.unit}
                                </td>
                                <td className="py-3.5 px-5 text-right font-mono font-bold text-[var(--text-primary)]">
                                  {r.remaining_quantity} {material.unit}
                                </td>
                                <td className="py-3.5 px-5 text-center">
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                      isExhausted
                                        ? "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                                        : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                    }`}
                                  >
                                    {isExhausted ? "Exhausted" : "In Stock"}
                                  </span>
                                </td>
                                <td className="py-3.5 px-5 text-right font-mono font-semibold text-[var(--text-primary)]">
                                  ₹{r.rate.toFixed(2)}
                                </td>
                                <td className="py-3.5 px-5 text-center" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedRollId(r.id);
                                      setPassportModalOpen(true);
                                    }}
                                    className="px-2 py-1 rounded-md bg-[var(--page-bg)] hover:bg-[var(--primary-light)] text-[var(--text-muted)] hover:text-[var(--primary)] text-xs font-bold transition-all border border-[var(--border)] cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <Eye size={12} /> Passport
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Clean Pagination Footer */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border border-[var(--border)] rounded-xl bg-[var(--card-bg)] text-xs select-none shadow-sm">
                    <div className="text-[var(--text-muted)] font-medium text-center sm:text-left">
                      Showing <span className="font-bold text-[var(--text-primary)]">{filteredRolls.length === 0 ? 0 : (currentRollPage - 1) * rollPageSize + 1}</span> to{" "}
                      <span className="font-bold text-[var(--text-primary)]">{Math.min(currentRollPage * rollPageSize, filteredRolls.length)}</span> of{" "}
                      <span className="font-bold text-[var(--text-primary)]">{filteredRolls.length}</span> rolls
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setRollPage((p) => Math.max(1, p - 1))}
                        disabled={currentRollPage <= 1}
                        className="w-8 h-8 border border-[var(--border)] bg-[var(--card-bg)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--page-bg)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="text-xs font-semibold text-[var(--text-primary)] px-2">
                        {currentRollPage} / {totalRollPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setRollPage((p) => Math.min(totalRollPages, p + 1))}
                        disabled={currentRollPage >= totalRollPages}
                        className="w-8 h-8 border border-[var(--border)] bg-[var(--card-bg)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--page-bg)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab content: Purchase History */}
          {activeTab === "purchases" && (
            <div className="space-y-3">
              {purchases.length === 0 ? (
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-8 text-center text-[var(--text-muted)] text-sm">
                  No purchase history recorded for this material.
                </div>
              ) : (
                <>
                  {/* Mobile Card List View (block md:hidden) */}
                  <div className="block md:hidden space-y-2.5">
                    {pagedPurchases.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => p.purchaseId && router.push(`/purchases/${p.purchaseId}`)}
                        className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 shadow-sm active:scale-[0.99] transition-all cursor-pointer space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono text-xs font-bold text-[var(--primary)]">
                              Inv: {p.invoiceNumber || "—"}
                            </span>
                            <h4 className="font-bold text-sm text-[var(--text-primary)] mt-0.5">
                              {p.supplierName}
                            </h4>
                          </div>
                          <span className="text-xs font-mono text-[var(--text-muted)]">
                            {formatDate(p.purchaseDate)}
                          </span>
                        </div>

                        <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-xs">
                          <span className="text-[var(--text-muted)]">
                            Qty: <strong className="text-[var(--text-primary)] font-mono">{p.quantity.toLocaleString()} {material.unit}</strong> @ ₹{p.rate.toFixed(2)}
                          </span>
                          <span className="font-mono font-bold text-[var(--primary)] text-sm">
                            {formatCurrency(p.amount)}
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
                            <th className="py-3 px-5">Purchase Date</th>
                            <th className="py-3 px-5">Invoice Number</th>
                            <th className="py-3 px-5">Supplier Name</th>
                            <th className="py-3 px-5 text-right">Quantity</th>
                            <th className="py-3 px-5 text-right">Purchase Rate</th>
                            <th className="py-3 px-5 text-right">Total Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)] text-sm text-[var(--text-body)]">
                          {pagedPurchases.map((p) => (
                            <tr
                              key={p.id}
                              onClick={() => p.purchaseId && router.push(`/purchases/${p.purchaseId}`)}
                              className="hover:bg-[var(--table-row-hover)] transition-colors cursor-pointer"
                            >
                              <td className="py-3.5 px-5 text-[var(--text-muted)] font-mono text-xs">
                                {formatDate(p.purchaseDate)}
                              </td>
                              <td className="py-3.5 px-5 font-mono text-xs font-bold text-[var(--primary)]">
                                {p.invoiceNumber}
                              </td>
                              <td className="py-3.5 px-5 font-semibold text-[var(--text-primary)]">
                                {p.supplierName}
                              </td>
                              <td className="py-3.5 px-5 text-right font-mono font-bold text-[var(--text-primary)]">
                                {p.quantity.toLocaleString()} {material.unit}
                              </td>
                              <td className="py-3.5 px-5 text-right font-mono text-xs text-[var(--text-muted)]">
                                {formatCurrency(p.rate)}
                              </td>
                              <td className="py-3.5 px-5 text-right font-mono font-bold text-[var(--primary)]">
                                {formatCurrency(p.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Clean Pagination Footer */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border border-[var(--border)] rounded-xl bg-[var(--card-bg)] text-xs select-none shadow-sm">
                    <div className="text-[var(--text-muted)] font-medium text-center sm:text-left">
                      Showing <span className="font-bold text-[var(--text-primary)]">{purchases.length === 0 ? 0 : (currentPurchasePage - 1) * purchasePageSize + 1}</span> to{" "}
                      <span className="font-bold text-[var(--text-primary)]">{Math.min(currentPurchasePage * purchasePageSize, purchases.length)}</span> of{" "}
                      <span className="font-bold text-[var(--text-primary)]">{purchases.length}</span> purchases
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPurchasePage((p) => Math.max(1, p - 1))}
                        disabled={currentPurchasePage <= 1}
                        className="w-8 h-8 border border-[var(--border)] bg-[var(--card-bg)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--page-bg)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="text-xs font-semibold text-[var(--text-primary)] px-2">
                        {currentPurchasePage} / {totalPurchasePages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPurchasePage((p) => Math.min(totalPurchasePages, p + 1))}
                        disabled={currentPurchasePage >= totalPurchasePages}
                        className="w-8 h-8 border border-[var(--border)] bg-[var(--card-bg)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--page-bg)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab content: Stock Movements */}
          {activeTab === "movements" && (
            <div className="space-y-3">
              {movements.length === 0 ? (
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-8 text-center text-[var(--text-muted)] text-sm">
                  No movement history recorded yet for this material.
                </div>
              ) : (
                <>
                  {/* Mobile Card List View (block md:hidden) */}
                  <div className="block md:hidden space-y-2.5">
                    {pagedMovements.map((m) => {
                      const isPositive = m.quantity_delta > 0;
                      return (
                        <div
                          key={m.id}
                          className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 shadow-sm space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="bg-[var(--page-bg)] border border-[var(--border)] text-[var(--text-secondary)] text-xs font-bold px-2 py-0.5 rounded-md">
                              {getTransactionLabel(m.transaction_type)}
                            </span>
                            <span className="text-[11px] font-mono text-[var(--text-muted)]">
                              {new Date(m.created_at).toLocaleString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-xs text-[var(--text-muted)]">
                              Godown: <strong className="text-[var(--text-primary)]">{m.godown?.name || "—"}</strong>
                            </span>
                            <div className="text-right">
                              <span
                                className={`text-sm font-mono font-bold block ${
                                  isPositive ? "text-emerald-500" : "text-rose-500"
                                }`}
                              >
                                {isPositive ? "+" : ""}
                                {m.quantity_delta.toLocaleString()} {material.unit}
                              </span>
                              <span
                                className={`text-xs font-mono font-bold block ${
                                  isPositive ? "text-emerald-500" : "text-rose-500"
                                }`}
                              >
                                {isPositive ? "+" : ""}
                                {formatCurrency(m.value_delta)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table View (hidden md:block) */}
                  <div className="hidden md:block bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                            <th className="py-3 px-5">Date & Time</th>
                            <th className="py-3 px-5">Transaction Type</th>
                            <th className="py-3 px-5">Godown Location</th>
                            <th className="py-3 px-5 text-right">Quantity Changed</th>
                            <th className="py-3 px-5 text-right">Value Impact</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)] text-sm text-[var(--text-body)]">
                          {pagedMovements.map((m) => {
                            const isPositive = m.quantity_delta > 0;
                            return (
                              <tr key={m.id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                                <td className="py-3.5 px-5 text-[var(--text-muted)] font-mono text-xs">
                                  {new Date(m.created_at).toLocaleString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </td>
                                <td className="py-3.5 px-5 font-semibold text-xs text-[var(--text-secondary)]">
                                  {getTransactionLabel(m.transaction_type)}
                                </td>
                                <td className="py-3.5 px-5 font-semibold text-[var(--text-primary)]">
                                  {m.godown?.name || "—"}
                                </td>
                                <td
                                  className={`py-3.5 px-5 text-right font-mono font-bold ${
                                    isPositive ? "text-emerald-500" : "text-rose-500"
                                  }`}
                                >
                                  {isPositive ? "+" : ""}
                                  {m.quantity_delta.toLocaleString()} {material.unit}
                                </td>
                                <td
                                  className={`py-3.5 px-5 text-right font-mono font-bold ${
                                    isPositive ? "text-emerald-500" : "text-rose-500"
                                  }`}
                                >
                                  {isPositive ? "+" : ""}
                                  {formatCurrency(m.value_delta)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Clean Pagination Footer */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border border-[var(--border)] rounded-xl bg-[var(--card-bg)] text-xs select-none shadow-sm">
                    <div className="text-[var(--text-muted)] font-medium text-center sm:text-left">
                      Showing <span className="font-bold text-[var(--text-primary)]">{movements.length === 0 ? 0 : (currentMovementPage - 1) * movementPageSize + 1}</span> to{" "}
                      <span className="font-bold text-[var(--text-primary)]">{Math.min(currentMovementPage * movementPageSize, movements.length)}</span> of{" "}
                      <span className="font-bold text-[var(--text-primary)]">{movements.length}</span> movements
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setMovementPage((p) => Math.max(1, p - 1))}
                        disabled={currentMovementPage <= 1}
                        className="w-8 h-8 border border-[var(--border)] bg-[var(--card-bg)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--page-bg)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="text-xs font-semibold text-[var(--text-primary)] px-2">
                        {currentMovementPage} / {totalMovementPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setMovementPage((p) => Math.min(totalMovementPages, p + 1))}
                        disabled={currentMovementPage >= totalMovementPages}
                        className="w-8 h-8 border border-[var(--border)] bg-[var(--card-bg)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--page-bg)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab content: Material Specifications */}
          {activeTab === "details" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* Profile Card */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
                  <Tag size={16} className="text-[var(--primary)]" />
                  <h3 className="text-xs sm:text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">
                    Taxation & Identification
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-[var(--page-bg)] rounded-xl border border-[var(--border)]">
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      HSN / SAC Code
                    </span>
                    <span className="font-mono text-sm font-bold text-[var(--text-primary)]">
                      {material.hsn_code ? (
                        <Link
                          href={`/master-data/gst-rates?search=${material.hsn_code}`}
                          className="hover:underline text-[var(--primary)] inline-flex items-center gap-1"
                        >
                          {material.hsn_code} <ExternalLink size={11} />
                        </Link>
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>

                  <div className="p-3 bg-[var(--page-bg)] rounded-xl border border-[var(--border)]">
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      GST Tax Rate
                    </span>
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                      {material.gst_percent !== null ? `${material.gst_percent}%` : "—"}
                    </span>
                  </div>

                  <div className="p-3 bg-[var(--page-bg)] rounded-xl border border-[var(--border)]">
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Category
                    </span>
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                      {material.category || "General"}
                    </span>
                  </div>

                  <div className="p-3 bg-[var(--page-bg)] rounded-xl border border-[var(--border)]">
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Inventory Unit
                    </span>
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                      {material.unit}
                    </span>
                  </div>
                </div>
              </div>

              {/* Policy Card */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
                  <FileCheck size={16} className="text-emerald-500" />
                  <h3 className="text-xs sm:text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">
                    Procurement & Reorder Policy
                  </h3>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-[var(--page-bg)] rounded-xl border border-[var(--border)]">
                      <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                        Default Supplier
                      </span>
                      <span className="text-sm font-bold text-[var(--text-primary)]">
                        {material.default_supplier?.name || "None assigned"}
                      </span>
                    </div>

                    <div className="p-3 bg-[var(--page-bg)] rounded-xl border border-[var(--border)]">
                      <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                        Reorder Threshold
                      </span>
                      <span className="text-sm font-bold text-amber-500 font-mono">
                        {material.reorder_level ? `${material.reorder_level.toLocaleString()} ${material.unit}` : "Not configured"}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-[var(--page-bg)] rounded-xl border border-[var(--border)]">
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Item Notes / Description
                    </span>
                    <p className="text-xs sm:text-sm font-medium text-[var(--text-body)] leading-relaxed mt-0.5">
                      {material.description || "No specific notes provided for this raw material."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Roll Passport Dialog Modal */}
          {selectedRollId && (
            <RollPassportModal
              open={passportModalOpen}
              onOpenChange={(isOpen) => {
                setPassportModalOpen(isOpen);
                if (!isOpen) refetch();
              }}
              rollId={selectedRollId}
            />
          )}

          {/* Full Screen Image Zoom Dialog */}
          <Dialog open={!!zoomImageUrl} onOpenChange={() => setZoomImageUrl(null)}>
            <DialogContent className="max-w-2xl bg-[var(--card-bg)] border-[var(--border)] p-2">
              <DialogHeader className="sr-only">
                <DialogTitle>Material Image Zoom</DialogTitle>
              </DialogHeader>
              {zoomImageUrl && (
                <img
                  src={zoomImageUrl}
                  alt={material.name}
                  className="w-full h-auto max-h-[80vh] object-contain rounded-xl"
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}
    </PageState>
  );
}
