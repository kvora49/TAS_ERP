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
  DollarSign,
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
        return "Purchase Return Outward";
      case "production_lot_allocation":
        return "Lot Allocation Outward";
      case "production_lot_finished_good_push":
        return "Lot FG Push Inward";
      case "stock_in":
        return "Stock Inward";
      case "stock_out":
        return "Stock Outward";
      case "adjustment":
        return "Stock Adjustment";
      case "transfer":
        return "Stock Transfer";
      default:
        return type.replace(/_/g, " ");
    }
  };

  // Roll categorization & counts
  const totalRollsCount = rolls.length;
  const inStockRollsCount = rolls.filter((r) => r.remaining_quantity >= r.total_quantity && r.remaining_quantity > 0).length;
  const partialRollsCount = rolls.filter((r) => r.remaining_quantity > 0 && r.remaining_quantity < r.total_quantity).length;
  const activeRollsCount = inStockRollsCount + partialRollsCount;
  const exhaustedRollsCount = rolls.filter((r) => r.remaining_quantity === 0).length;

  // Filtered & Paginated Rolls
  const filteredRolls = useMemo(() => {
    return rolls.filter((r) => {
      const matchesSearch =
        !rollSearch ||
        r.roll_number.toLowerCase().includes(rollSearch.toLowerCase()) ||
        (r.shade && r.shade.toLowerCase().includes(rollSearch.toLowerCase())) ||
        (r.supplier_name && r.supplier_name.toLowerCase().includes(rollSearch.toLowerCase())) ||
        (r.invoice_no && r.invoice_no.toLowerCase().includes(rollSearch.toLowerCase()));

      let matchesStatus = true;
      if (rollStatusFilter === "in_stock") {
        matchesStatus = r.remaining_quantity > 0;
      } else if (rollStatusFilter === "partially_used") {
        matchesStatus = r.remaining_quantity > 0 && r.remaining_quantity < r.total_quantity;
      } else if (rollStatusFilter === "exhausted") {
        matchesStatus = r.remaining_quantity === 0;
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
  const startRollIdx = filteredRolls.length === 0 ? 0 : (currentRollPage - 1) * rollPageSize + 1;
  const endRollIdx = Math.min(currentRollPage * rollPageSize, filteredRolls.length);

  // Paginated Purchases
  const totalPurchasePages = Math.max(1, Math.ceil(purchases.length / purchasePageSize));
  const currentPurchasePage = Math.min(purchasePage, totalPurchasePages);
  const pagedPurchases = purchases.slice(
    (currentPurchasePage - 1) * purchasePageSize,
    currentPurchasePage * purchasePageSize
  );
  const startPurchaseIdx = purchases.length === 0 ? 0 : (currentPurchasePage - 1) * purchasePageSize + 1;
  const endPurchaseIdx = Math.min(currentPurchasePage * purchasePageSize, purchases.length);

  // Paginated Movements
  const totalMovementPages = Math.max(1, Math.ceil(movements.length / movementPageSize));
  const currentMovementPage = Math.min(movementPage, totalMovementPages);
  const pagedMovements = movements.slice(
    (currentMovementPage - 1) * movementPageSize,
    currentMovementPage * movementPageSize
  );
  const startMovementIdx = movements.length === 0 ? 0 : (currentMovementPage - 1) * movementPageSize + 1;
  const endMovementIdx = Math.min(currentMovementPage * movementPageSize, movements.length);

  const getRollStatusBadge = (remaining: number, total: number) => {
    if (remaining === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          Exhausted (0m)
        </span>
      );
    }
    if (remaining < total) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Partially Used
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        In Stock
      </span>
    );
  };

  return (
    <PageState
      isLoading={isLoading}
      isError={!!error || (!isLoading && !material)}
      error={error?.message || "Raw Material not found"}
      onRetry={refetch}
      skeletonVariant="card"
      skeletonCount={4}
    >
      {material && (
        <div className="p-6 space-y-6">
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

          {/* Reorder Warning Alert */}
          {rollups.reorderWarning && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 text-amber-600 dark:text-amber-400 shadow-sm animate-pulse">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-xs font-semibold">
                <h4 className="font-bold text-amber-600 dark:text-amber-300">Reorder Level Warning</h4>
                <p>
                  Current stock level ({rollups.totalCurrentStock.toLocaleString()} {material.unit}) is below or equal to the reorder level of {material.reorder_level?.toLocaleString()} {material.unit}. Please procure soon.
                </p>
              </div>
            </div>
          )}

          {/* Header card */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
            {/* Subtle decorative background gradient */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

            <div className="flex items-center gap-4 sm:gap-5">
              {material.image_url && (
                <div
                  className="relative group shrink-0 cursor-pointer"
                  onClick={() => setZoomImageUrl(material.image_url || null)}
                  title="Click for full screen"
                >
                  <img
                    src={material.image_url}
                    alt={material.name}
                    className="w-28 h-28 sm:w-36 sm:h-36 object-cover rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] shadow-md group-hover:scale-105 transition-all duration-200"
                  />
                  <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold select-none">
                    <span className="bg-black/70 px-3 py-1.5 rounded-full shadow-md">Zoom 🔍</span>
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-black text-[var(--text-primary)] tracking-tight">{material.name}</h1>
                  {material.category && (
                    <span className="bg-[var(--primary-light)] text-[var(--primary)] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[var(--primary)]/20 uppercase">
                      {material.category}
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                      material.is_active
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        : "bg-red-500/10 text-red-500 border-red-500/20"
                    }`}
                  >
                    {material.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)] font-semibold">
                  {material.default_supplier && (
                    <span className="flex items-center gap-1">
                      <Building2 size={13} className="text-[var(--text-faint)]" />
                      Default Supplier: {material.default_supplier.name}
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

            <div className="flex items-center gap-2 self-start md:self-center">
              <button
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
                className="h-10 px-4 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] hover:opacity-90 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              >
                <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} /> Sync Stock
              </button>

              <button
                onClick={() => {
                  if (typeof window !== "undefined" && document.referrer.includes("/stock/raw-materials")) {
                    router.push("/stock/raw-materials");
                  } else if (typeof window !== "undefined" && window.history.length > 1) {
                    router.back();
                  } else {
                    router.push("/master-data/raw-materials");
                  }
                }}
                className="h-10 px-4 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--page-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <ArrowLeft size={14} /> Back to List
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
              <div className="p-3 bg-[var(--primary-light)] rounded-lg text-[var(--primary)] shrink-0">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider">
                  Total Stock
                </span>
                <span className="text-lg font-black text-[var(--text-primary)]">
                  {rollups.totalCurrentStock.toLocaleString()}{" "}
                  <span className="text-xs font-semibold text-[var(--text-muted)]">{material.unit}</span>
                </span>
              </div>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
              <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-500 shrink-0">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider">
                  Stock Valuation
                </span>
                <span className="text-lg font-black text-[var(--text-primary)]">
                  {formatCurrency(rollups.totalStockValue)}
                </span>
              </div>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
              <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500 shrink-0">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider">
                  Avg Cost / {material.unit}
                </span>
                <span className="text-lg font-black text-blue-500">
                  {formatCurrency(rollups.averagePurchaseCost)}
                </span>
              </div>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
              <div className="p-3 bg-amber-500/10 rounded-lg text-amber-500 shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider">
                  Reorder Level
                </span>
                <span className="text-lg font-black text-amber-500">
                  {material.reorder_level ? material.reorder_level.toLocaleString() : "—"}{" "}
                  <span className="text-xs font-semibold text-[var(--text-muted)]">{material.unit}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Tabs list */}
          <div className="flex gap-1 border-b border-[var(--border)] pb-px select-none overflow-x-auto">
            <button
              onClick={() => setActiveTab("stock")}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                activeTab === "stock"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Live Stock per Godown ({stocks.length})
            </button>

            {(detailData.is_fabric ?? (detailData.material.category?.toLowerCase() === "fabric" || (rolls && rolls.length > 0))) && (
              <button
                onClick={() => {
                  setActiveTab("rolls");
                  setRollPage(1);
                }}
                className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                  activeTab === "rolls"
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                Rolls & Batches ({activeRollsCount} in stock / {totalRollsCount} total)
              </button>
            )}

            <button
              onClick={() => {
                setActiveTab("purchases");
                setPurchasePage(1);
              }}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                activeTab === "purchases"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Purchase History ({purchases.length})
            </button>
            <button
              onClick={() => {
                setActiveTab("movements");
                setMovementPage(1);
              }}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                activeTab === "movements"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Stock Movements ({movements.length})
            </button>
            <button
              onClick={() => setActiveTab("details")}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                activeTab === "details"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Material Specifications
            </button>
          </div>

          {/* Tab content: Live Stock */}
          {activeTab === "stock" && (
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
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
                    {stocks.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-[var(--text-muted)]">
                          No stock currently available in any godown.
                        </td>
                      </tr>
                    ) : (
                      stocks.map((item) => (
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab content: Rolls & Batches */}
          {activeTab === "rolls" && (
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden flex flex-col">
              {/* Filter & Search Toolbar */}
              <div className="p-4 border-b border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--card-bg)]">
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
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
                  <div className="flex items-center gap-1 bg-[var(--page-bg)] p-0.5 rounded-lg border border-[var(--border)]">
                    <button
                      type="button"
                      onClick={() => {
                        setRollStatusFilter("all");
                        setRollPage(1);
                      }}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
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
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
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
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                        rollStatusFilter === "exhausted"
                          ? "bg-slate-500/15 text-slate-400 font-bold shadow-sm"
                          : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      Exhausted ({exhaustedRollsCount})
                    </button>
                  </div>
                </div>

                {/* Per Page Selector */}
                <div className="flex items-center gap-2 self-end sm:self-center text-xs text-[var(--text-muted)]">
                  <span className="hidden md:inline font-medium">Entries per page:</span>
                  <select
                    value={rollPageSize}
                    onChange={(e) => {
                      setRollPageSize(Number(e.target.value));
                      setRollPage(1);
                    }}
                    className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg px-2.5 h-9 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-colors cursor-pointer"
                  >
                    <option value={10}>10 per page</option>
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                  </select>
                </div>
              </div>

              {/* Rolls Table */}
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
                    {pagedRolls.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-[var(--text-muted)]">
                          {rollSearch || rollStatusFilter !== "all"
                            ? "No rolls match the search or filter criteria."
                            : "No individual rolls/batches recorded yet for this material."}
                        </td>
                      </tr>
                    ) : (
                      pagedRolls.map((r) => {
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
                            <td className="py-3.5 px-5 font-bold font-mono text-[var(--primary)] flex items-center gap-1.5">
                              <span>{r.roll_number}</span>
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
                            <td
                              className={`py-3.5 px-5 text-right font-mono font-bold ${
                                isExhausted
                                  ? "text-[var(--text-muted)]"
                                  : r.remaining_quantity < r.total_quantity
                                  ? "text-amber-500"
                                  : "text-emerald-500"
                              }`}
                            >
                              {r.remaining_quantity} {material.unit}
                            </td>
                            <td className="py-3.5 px-5 text-center" onClick={(e) => e.stopPropagation()}>
                              {getRollStatusBadge(r.remaining_quantity, r.total_quantity)}
                            </td>
                            <td className="py-3.5 px-5 text-right font-mono font-bold text-[var(--text-primary)]">
                              {formatCurrency(r.rate)}
                            </td>
                            <td className="py-3.5 px-5 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedRollId(r.id);
                                  setPassportModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--page-bg)] border border-[var(--border)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)] hover:border-[var(--primary)]/30 text-xs font-semibold transition-all cursor-pointer"
                              >
                                <Eye size={12} />
                                <span>Passport</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Rolls Pagination Footer */}
              {filteredRolls.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-t border-[var(--border)] bg-[var(--card-bg)] text-xs select-none">
                  <div className="text-[var(--text-muted)] font-medium text-center sm:text-left">
                    Showing <span className="font-bold text-[var(--text-primary)]">{startRollIdx}</span> to{" "}
                    <span className="font-bold text-[var(--text-primary)]">{endRollIdx}</span> of{" "}
                    <span className="font-bold text-[var(--text-primary)]">{filteredRolls.length}</span> rolls
                    {filteredRolls.length !== rolls.length && (
                      <span className="text-[var(--text-faint)] ml-1">
                        (filtered from {rolls.length} total)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setRollPage(1)}
                      disabled={currentRollPage <= 1}
                      title="First Page"
                      className="w-8 h-8 border border-[var(--border)] bg-[var(--card-bg)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--page-bg)] hover:text-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronsLeft size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRollPage((p) => Math.max(1, p - 1))}
                      disabled={currentRollPage <= 1}
                      title="Previous Page"
                      className="w-8 h-8 border border-[var(--border)] bg-[var(--card-bg)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--page-bg)] hover:text-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
                      title="Next Page"
                      className="w-8 h-8 border border-[var(--border)] bg-[var(--card-bg)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--page-bg)] hover:text-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRollPage(totalRollPages)}
                      disabled={currentRollPage >= totalRollPages}
                      title="Last Page"
                      className="w-8 h-8 border border-[var(--border)] bg-[var(--card-bg)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--page-bg)] hover:text-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronsRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab content: Purchase History */}
          {activeTab === "purchases" && (
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                      <th className="py-3 px-5 w-44">Purchase Date</th>
                      <th className="py-3 px-5">Invoice Number</th>
                      <th className="py-3 px-5">Supplier Name</th>
                      <th className="py-3 px-5 text-right w-40">Qty Purchased</th>
                      <th className="py-3 px-5 text-right w-40">Rate / Unit</th>
                      <th className="py-3 px-5 text-right w-44">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] text-sm text-[var(--text-body)]">
                    {pagedPurchases.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-[var(--text-muted)]">
                          No purchase history available for this material.
                        </td>
                      </tr>
                    ) : (
                      pagedPurchases.map((p) => (
                        <tr
                          key={p.id}
                          onClick={() => router.push(`/purchases`)}
                          className="hover:bg-[var(--table-row-hover)] transition-colors cursor-pointer"
                        >
                          <td className="py-3.5 px-5 text-[var(--text-muted)] font-mono text-xs">
                            {p.purchaseDate ? formatDate(p.purchaseDate) : "—"}
                          </td>
                          <td className="py-3.5 px-5 font-mono text-xs font-bold text-[var(--primary)]">
                            {p.invoiceNumber}
                          </td>
                          <td className="py-3.5 px-5 font-semibold text-[var(--text-primary)]">
                            {p.supplierName}
                          </td>
                          <td className="py-3.5 px-5 text-right font-mono font-bold text-[var(--text-body)]">
                            {p.quantity.toLocaleString()} {material.unit}
                          </td>
                          <td className="py-3.5 px-5 text-right font-mono text-[var(--text-muted)]">
                            {formatCurrency(p.rate)}
                          </td>
                          <td className="py-3.5 px-5 text-right font-mono font-bold text-[var(--text-primary)]">
                            {formatCurrency(p.amount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Purchases Pagination Footer */}
              {purchases.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-t border-[var(--border)] bg-[var(--card-bg)] text-xs select-none">
                  <div className="text-[var(--text-muted)] font-medium">
                    Showing <span className="font-bold text-[var(--text-primary)]">{startPurchaseIdx}</span> to{" "}
                    <span className="font-bold text-[var(--text-primary)]">{endPurchaseIdx}</span> of{" "}
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
              )}
            </div>
          )}

          {/* Tab content: Stock Movements */}
          {activeTab === "movements" && (
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                      <th className="py-3 px-5 w-44">Date & Time</th>
                      <th className="py-3 px-5">Godown Location</th>
                      <th className="py-3 px-5">Transaction Type</th>
                      <th className="py-3 px-5 text-right w-44">Quantity Change</th>
                      <th className="py-3 px-5 text-right w-44">Value Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] text-sm text-[var(--text-body)]">
                    {pagedMovements.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-[var(--text-muted)]">
                          No movement history recorded in stock ledger yet.
                        </td>
                      </tr>
                    ) : (
                      pagedMovements.map((m) => {
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
                            <td className="py-3.5 px-5 font-semibold text-[var(--text-primary)]">
                              {m.godown?.name || "—"}
                            </td>
                            <td className="py-3.5 px-5">
                              <span className="font-semibold text-xs text-[var(--text-secondary)]">
                                {getTransactionLabel(m.transaction_type)}
                              </span>
                            </td>
                            <td
                              className={`py-3.5 px-5 text-right font-mono font-bold ${
                                isPositive ? "text-emerald-500" : "text-rose-500"
                              }`}
                            >
                              {isPositive ? "+" : ""}
                              {Number(m.quantity_delta).toLocaleString()} {material.unit}
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
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Movements Pagination Footer */}
              {movements.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-t border-[var(--border)] bg-[var(--card-bg)] text-xs select-none">
                  <div className="text-[var(--text-muted)] font-medium">
                    Showing <span className="font-bold text-[var(--text-primary)]">{startMovementIdx}</span> to{" "}
                    <span className="font-bold text-[var(--text-primary)]">{endMovementIdx}</span> of{" "}
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
              )}
            </div>
          )}

          {/* Tab content: Specifications */}
          {activeTab === "details" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Material configurations */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-[var(--text-primary)] border-b border-[var(--border)] pb-3 uppercase tracking-wider">
                  Catalog Properties
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-xs font-semibold">
                  <div>
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Category
                    </span>
                    <span className="text-sm text-[var(--text-primary)]">{material.category || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Default Unit of Measure
                    </span>
                    <span className="text-sm text-[var(--text-primary)]">{material.unit}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Reorder Level Limit
                    </span>
                    <span className="text-sm text-[var(--text-primary)] font-mono">
                      {material.reorder_level ? material.reorder_level.toLocaleString() : "None"} {material.unit}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                    Description / Specifications
                  </span>
                  <span className="text-sm text-[var(--text-secondary)] leading-relaxed block font-medium">
                    {material.description || "No description provided."}
                  </span>
                </div>
              </div>

              {/* Legal / HSN Configurations */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-[var(--text-primary)] border-b border-[var(--border)] pb-3 uppercase tracking-wider">
                  GST & HSN Configurations
                </h3>
                <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                  <div>
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      HSN / SAC Code
                    </span>
                    {material.hsn_code ? (
                      <Link
                        href={`/master-data/gst-rates`}
                        className="text-sm font-mono font-bold text-[var(--primary)] hover:underline"
                      >
                        {material.hsn_code}
                      </Link>
                    ) : (
                      <span className="text-sm text-[var(--text-primary)] font-mono">—</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      GST Tax Percent
                    </span>
                    <span className="text-sm text-[var(--text-primary)] font-mono">
                      {material.gst_percent ? `${material.gst_percent}%` : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Roll Passport Lifecycle Modal */}
          <RollPassportModal
            rollId={selectedRollId}
            open={passportModalOpen}
            onOpenChange={setPassportModalOpen}
          />

          {/* Image Preview Lightbox Dialog */}
          <Dialog open={!!zoomImageUrl} onOpenChange={() => setZoomImageUrl(null)}>
            <DialogContent className="max-w-2xl bg-[var(--card-bg)] border border-[var(--border)] p-4 sm:p-6 rounded-2xl flex flex-col items-center">
              <DialogHeader className="w-full text-left border-b border-[var(--border)] pb-3 mb-4">
                <DialogTitle className="text-base font-bold text-[var(--text-primary)]">
                  {material.name} - Image Preview
                </DialogTitle>
              </DialogHeader>
              {zoomImageUrl && (
                <div className="w-full flex items-center justify-center p-2 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
                  <img
                    src={zoomImageUrl}
                    alt={material.name}
                    className="max-h-[70vh] object-contain rounded-lg shadow-md"
                  />
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}
    </PageState>
  );
}
