"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  MapPin,
  Building2,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  IndianRupee,
  Search,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Phone,
  User,
  History,
  FileText,
  Warehouse,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import PageState from "@/components/shared/PageState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/shared/Badge";

interface MaterialType {
  id: string;
  name: string;
  category: string;
  unit: string;
}

interface StockItem {
  id: string;
  current_stock: number;
  stock_value: number;
  material_type: MaterialType;
}

interface Movement {
  id: string;
  item_type: "raw_material" | "finished_good";
  transaction_type: string;
  quantity_delta: number;
  value_delta: number;
  created_at: string;
  itemName: string;
  unit: string;
}

interface Godown {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  contact_person: string | null;
  phone: string | null;
  description: string | null;
  is_active: boolean;
}

interface FinishedStockItem {
  id: string;
  total_quantity: number;
  cost_per_piece: number;
  total_value: number;
  size_quantities: Record<string, number>;
  design?: { id: string; name: string; code: string; sale_price?: number };
  colour?: { id: string; colour_name: string };
}

interface GodownDetailResponse {
  godown: Godown;
  stock: StockItem[];
  movements: Movement[];
  finishedStock: FinishedStockItem[];
}

export default function GodownDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"stock" | "finished-stock" | "movements" | "details">("stock");

  // Movement history pagination & filter states
  const [movementSearch, setMovementSearch] = useState("");
  const [movementDirection, setMovementDirection] = useState<"all" | "inward" | "outward">("all");
  const [movementPage, setMovementPage] = useState(1);
  const [movementPageSize, setMovementPageSize] = useState(10);

  // Raw Stock pagination
  const [rawStockPage, setRawStockPage] = useState(1);
  const [rawStockPageSize, setRawStockPageSize] = useState(10);

  // Finished Stock pagination
  const [finishedStockPage, setFinishedStockPage] = useState(1);
  const [finishedStockPageSize, setFinishedStockPageSize] = useState(10);

  const { data: detailData, isLoading, error, refetch } = useQuery<GodownDetailResponse>({
    queryKey: ["godown-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/godowns/${id}`);
      if (!res.ok) throw new Error("Failed to fetch godown details");
      return res.json();
    },
    staleTime: 30_000,
  });

  const godown = detailData?.godown;
  const stock = detailData?.stock || [];
  const movements = detailData?.movements || [];
  const finishedStock = detailData?.finishedStock || [];

  // Compute rollups
  const totalStockItems = stock.length;
  const totalValuation = stock.reduce((acc, curr) => acc + Number(curr.stock_value || 0), 0);
  const totalInwardCount = movements.filter((m) => m.quantity_delta > 0).length;
  const totalOutwardCount = movements.filter((m) => m.quantity_delta < 0).length;

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
      case "sales_return":
        return "Sales Return Inward";
      case "sale_bill":
        return "Sales Dispatch Outward";
      case "adjustment":
        return "Stock Adjustment";
      case "transfer_in":
        return "Transfer Inward";
      case "transfer_out":
        return "Transfer Outward";
      case "transfer":
        return "Stock Transfer";
      default:
        return type.replace(/_/g, " ");
    }
  };

  // Filtered and paginated movements
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const matchesSearch =
        !movementSearch ||
        m.itemName.toLowerCase().includes(movementSearch.toLowerCase()) ||
        m.transaction_type.toLowerCase().includes(movementSearch.toLowerCase()) ||
        m.item_type.toLowerCase().includes(movementSearch.toLowerCase());

      const matchesDirection =
        movementDirection === "all" ||
        (movementDirection === "inward" && m.quantity_delta > 0) ||
        (movementDirection === "outward" && m.quantity_delta < 0);

      return matchesSearch && matchesDirection;
    });
  }, [movements, movementSearch, movementDirection]);

  const totalMovementPages = Math.max(1, Math.ceil(filteredMovements.length / movementPageSize));
  const currentMovementPage = Math.min(movementPage, totalMovementPages);
  const pagedMovements = filteredMovements.slice(
    (currentMovementPage - 1) * movementPageSize,
    currentMovementPage * movementPageSize
  );

  const startMovementIdx = filteredMovements.length === 0 ? 0 : (currentMovementPage - 1) * movementPageSize + 1;
  const endMovementIdx = Math.min(currentMovementPage * movementPageSize, filteredMovements.length);

  // Paginated Raw Stock
  const totalRawStockPages = Math.max(1, Math.ceil(stock.length / rawStockPageSize));
  const currentRawStockPage = Math.min(rawStockPage, totalRawStockPages);
  const pagedRawStock = stock.slice(
    (currentRawStockPage - 1) * rawStockPageSize,
    currentRawStockPage * rawStockPageSize
  );
  const startRawStockIdx = stock.length === 0 ? 0 : (currentRawStockPage - 1) * rawStockPageSize + 1;
  const endRawStockIdx = Math.min(currentRawStockPage * rawStockPageSize, stock.length);

  // Paginated Finished Stock
  const totalFinishedStockPages = Math.max(1, Math.ceil(finishedStock.length / finishedStockPageSize));
  const currentFinishedStockPage = Math.min(finishedStockPage, totalFinishedStockPages);
  const pagedFinishedStock = finishedStock.slice(
    (currentFinishedStockPage - 1) * finishedStockPageSize,
    currentFinishedStockPage * finishedStockPageSize
  );
  const startFinishedStockIdx = finishedStock.length === 0 ? 0 : (currentFinishedStockPage - 1) * finishedStockPageSize + 1;
  const endFinishedStockIdx = Math.min(currentFinishedStockPage * finishedStockPageSize, finishedStock.length);

  return (
    <PageState
      isLoading={isLoading}
      isError={!!error || (!isLoading && !godown)}
      error={error ? (error instanceof Error ? error.message : "Failed to load godown") : "Godown not found"}
      onRetry={refetch}
      skeletonVariant="card"
      skeletonCount={4}
    >
      {godown && (
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Navigation breadcrumbs */}
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)] select-none">
            <Link href="/" className="hover:text-[var(--text-primary)] transition-colors">
              Dashboard
            </Link>
            <ChevronRight size={12} />
            <span>Master Data</span>
            <ChevronRight size={12} />
            <Link href="/master-data/godowns" className="hover:text-[var(--text-primary)] transition-colors">
              Godowns
            </Link>
            <ChevronRight size={12} />
            <span className="text-[var(--text-primary)]">{godown.name}</span>
          </div>

          {/* Header card - Mobile App Hero */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
            {/* Subtle decorative background gradient */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[var(--primary-light)] rounded-2xl border border-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)] shrink-0 font-black text-xl shadow-sm">
                <Building2 size={24} />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black text-[var(--text-primary)] tracking-tight truncate">
                    {godown.name}
                  </h1>
                  {godown.code && (
                    <span className="bg-[var(--primary-light)] text-[var(--primary)] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[var(--primary)]/20 uppercase font-mono">
                      {godown.code}
                    </span>
                  )}
                  <StatusBadge active={godown.is_active} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)] font-semibold">
                  {godown.address && (
                    <span className="flex items-center gap-1 truncate max-w-md">
                      <MapPin size={12} className="text-[var(--text-faint)] shrink-0" />
                      <span className="truncate">{godown.address}</span>
                    </span>
                  )}
                  {godown.contact_person && (
                    <span className="flex items-center gap-1">
                      <User size={12} className="text-[var(--text-faint)] shrink-0" />
                      {godown.contact_person}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push(`/master-data/godowns`)}
              className="self-start md:self-center h-9 sm:h-10 px-3.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--page-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
            >
              <ArrowLeft size={14} /> Back to List
            </button>
          </div>

          {/* Stats row - Responsive 2x2 Grid on Mobile, 4 Columns on Desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 sm:p-4 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-[var(--primary-light)] rounded-lg text-[var(--primary)] shrink-0">
                <Layers className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider truncate">
                  Stock Items
                </span>
                <span className="text-base sm:text-lg font-black text-[var(--text-primary)]">
                  {totalStockItems}
                </span>
              </div>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 sm:p-4 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 rounded-lg text-emerald-500 shrink-0">
                <IndianRupee className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider truncate">
                  Total Value
                </span>
                <span className="text-base sm:text-lg font-black text-[var(--text-primary)] truncate block">
                  {formatCurrency(totalValuation)}
                </span>
              </div>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 sm:p-4 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 rounded-lg text-blue-500 shrink-0">
                <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider truncate">
                  Inward Entries
                </span>
                <span className="text-base sm:text-lg font-black text-[var(--text-primary)]">
                  {totalInwardCount}
                </span>
              </div>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 sm:p-4 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 rounded-lg text-amber-500 shrink-0">
                <ArrowDownLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider truncate">
                  Outward Entries
                </span>
                <span className="text-base sm:text-lg font-black text-[var(--text-primary)]">
                  {totalOutwardCount}
                </span>
              </div>
            </div>
          </div>

          {/* Subtabs list - Scrollable Pill Bar */}
          <div className="flex gap-1.5 border-b border-[var(--border)] pb-px select-none overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => {
                setActiveTab("stock");
                setRawStockPage(1);
              }}
              className={`px-3.5 py-2 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === "stock"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Layers size={13} />
              Raw Materials Stock ({totalStockItems})
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("finished-stock");
                setFinishedStockPage(1);
              }}
              className={`px-3.5 py-2 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === "finished-stock"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Warehouse size={13} />
              Finished Goods Stock ({finishedStock.length})
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
              Movement History ({movements.length})
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
              Godown Details
            </button>
          </div>

          {/* Tab content: Raw Stock */}
          {activeTab === "stock" && (
            <div className="space-y-3">
              {stock.length === 0 ? (
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-8 text-center text-[var(--text-muted)] text-sm">
                  No items currently in stock in this godown.
                </div>
              ) : (
                <>
                  {/* Mobile Card List View (block md:hidden) */}
                  <div className="block md:hidden space-y-2.5">
                    {pagedRawStock.map((item) => (
                      <div
                        key={item.id}
                        onClick={() =>
                          item.material_type?.id &&
                          router.push(`/master-data/raw-materials/${item.material_type.id}`)
                        }
                        className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 shadow-sm active:scale-[0.99] transition-all cursor-pointer space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-[var(--text-primary)] truncate">
                              {item.material_type.name}
                            </h4>
                            <span className="bg-[var(--page-bg)] border border-[var(--border)] text-[var(--text-muted)] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase mt-1 inline-block">
                              {item.material_type.category}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs text-[var(--text-muted)] block font-medium">Current Stock</span>
                            <span className="text-sm font-black text-[var(--text-primary)] font-mono">
                              {item.current_stock.toLocaleString()} {item.material_type.unit}
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-xs">
                          <span className="text-[var(--text-muted)]">Stock Valuation</span>
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
                            <th className="py-3 px-5">Material Name</th>
                            <th className="py-3 px-5 w-40">Category</th>
                            <th className="py-3 px-5 text-right w-44">Current Stock</th>
                            <th className="py-3 px-5 text-right w-44">Stock Value</th>
                            <th className="py-3 px-5 w-32">Unit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)] text-sm text-[var(--text-body)]">
                          {pagedRawStock.map((item) => (
                            <tr
                              key={item.id}
                              onClick={() =>
                                item.material_type?.id &&
                                router.push(`/master-data/raw-materials/${item.material_type.id}`)
                              }
                              className="hover:bg-[var(--table-row-hover)] transition-colors cursor-pointer"
                            >
                              <td className="py-3.5 px-5 font-bold text-[var(--text-primary)]">
                                {item.material_type.name}
                              </td>
                              <td className="py-3.5 px-5">
                                <span className="bg-[var(--page-bg)] border border-[var(--border)] text-[var(--text-muted)] text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                                  {item.material_type.category}
                                </span>
                              </td>
                              <td className="py-3.5 px-5 text-right font-mono font-bold text-[var(--text-primary)]">
                                {item.current_stock.toLocaleString()}
                              </td>
                              <td className="py-3.5 px-5 text-right font-mono font-bold text-[var(--text-primary)]">
                                {formatCurrency(item.stock_value)}
                              </td>
                              <td className="py-3.5 px-5 text-[var(--text-muted)] font-semibold">
                                {item.material_type.unit}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Clean Pagination Footer - Responsive & Non-Overlapping */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border border-[var(--border)] rounded-xl bg-[var(--card-bg)] text-xs select-none shadow-sm">
                    <div className="text-[var(--text-muted)] font-medium text-center sm:text-left">
                      Showing <span className="font-bold text-[var(--text-primary)]">{startRawStockIdx}</span> to{" "}
                      <span className="font-bold text-[var(--text-primary)]">{endRawStockIdx}</span> of{" "}
                      <span className="font-bold text-[var(--text-primary)]">{stock.length}</span> items
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                        <span>Rows:</span>
                        <select
                          value={rawStockPageSize}
                          onChange={(e) => {
                            setRawStockPageSize(Number(e.target.value));
                            setRawStockPage(1);
                          }}
                          className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setRawStockPage((p) => Math.max(1, p - 1))}
                          disabled={currentRawStockPage <= 1}
                          className="w-8 h-8 border border-[var(--border)] bg-[var(--card-bg)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--page-bg)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <span className="text-xs font-semibold text-[var(--text-primary)] px-2">
                          {currentRawStockPage} / {totalRawStockPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setRawStockPage((p) => Math.min(totalRawStockPages, p + 1))}
                          disabled={currentRawStockPage >= totalRawStockPages}
                          className="w-8 h-8 border border-[var(--border)] bg-[var(--card-bg)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--page-bg)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab content: Finished Stock */}
          {activeTab === "finished-stock" && (
            <div className="space-y-3">
              {finishedStock.length === 0 ? (
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-8 text-center text-[var(--text-muted)] text-sm">
                  No finished goods stock in this godown yet.
                </div>
              ) : (
                <>
                  {/* Mobile Card List View (block md:hidden) */}
                  <div className="block md:hidden space-y-2.5">
                    {pagedFinishedStock.map((item) => (
                      <div
                        key={item.id}
                        onClick={() =>
                          item.design?.id && router.push(`/finished-stock/designs/${item.design.id}`)
                        }
                        className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 shadow-sm active:scale-[0.99] transition-all cursor-pointer space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-[var(--text-primary)] truncate">
                              {item.design?.code
                                ? `${item.design.code} - ${item.design.name}`
                                : item.design?.name || "—"}
                            </h4>
                            {item.colour?.colour_name && (
                              <span className="bg-[var(--page-bg)] border border-[var(--border)] text-[var(--text-muted)] text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block">
                                Colour: {item.colour.colour_name}
                              </span>
                            )}
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
                            Cost: ₹
                            {Number(item.cost_per_piece || 0) > 0
                              ? Number(item.cost_per_piece).toFixed(2)
                              : item.design?.sale_price
                              ? (item.design.sale_price * 0.6).toFixed(2)
                              : "0.00"}
                          </span>
                          <span className="font-mono font-bold text-[var(--primary)] text-sm">
                            ₹
                            {Number(item.total_value || 0) > 0
                              ? Number(item.total_value).toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                })
                              : (
                                  item.total_quantity *
                                  (item.cost_per_piece ||
                                    (item.design?.sale_price ? item.design.sale_price * 0.6 : 0))
                                ).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
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
                            <th className="py-3 px-5 text-right w-44">In Stock Qty</th>
                            <th className="py-3 px-5 text-right w-44">Cost Per Piece</th>
                            <th className="py-3 px-5 text-right w-44">Stock Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)] text-sm text-[var(--text-body)]">
                          {pagedFinishedStock.map((item) => (
                            <tr
                              key={item.id}
                              onClick={() =>
                                item.design?.id && router.push(`/finished-stock/designs/${item.design.id}`)
                              }
                              className="hover:bg-[var(--table-row-hover)] transition-colors cursor-pointer"
                            >
                              <td className="py-3.5 px-5 font-semibold text-[var(--text-primary)]">
                                {item.design?.code
                                  ? `${item.design.code} - ${item.design.name}`
                                  : item.design?.name || "—"}
                              </td>
                              <td className="py-3.5 px-5 text-xs text-[var(--text-muted)] font-medium">
                                {item.colour?.colour_name || "—"}
                              </td>
                              <td className="py-3.5 px-5 text-right font-mono font-bold text-[var(--text-primary)]">
                                {item.total_quantity.toLocaleString()}
                              </td>
                              <td className="py-3.5 px-5 text-right font-mono text-xs text-[var(--text-muted)]">
                                ₹
                                {Number(item.cost_per_piece || 0) > 0
                                  ? Number(item.cost_per_piece).toFixed(2)
                                  : item.design?.sale_price
                                  ? (item.design.sale_price * 0.6).toFixed(2)
                                  : "0.00"}
                              </td>
                              <td className="py-3.5 px-5 text-right font-mono font-bold text-[var(--primary)]">
                                ₹
                                {Number(item.total_value || 0) > 0
                                  ? Number(item.total_value).toLocaleString("en-IN", {
                                      minimumFractionDigits: 2,
                                    })
                                  : (
                                      item.total_quantity *
                                      (item.cost_per_piece ||
                                        (item.design?.sale_price ? item.design.sale_price * 0.6 : 0))
                                    ).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Clean Pagination Footer - Responsive & Non-Overlapping */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border border-[var(--border)] rounded-xl bg-[var(--card-bg)] text-xs select-none shadow-sm">
                    <div className="text-[var(--text-muted)] font-medium text-center sm:text-left">
                      Showing <span className="font-bold text-[var(--text-primary)]">{startFinishedStockIdx}</span> to{" "}
                      <span className="font-bold text-[var(--text-primary)]">{endFinishedStockIdx}</span> of{" "}
                      <span className="font-bold text-[var(--text-primary)]">{finishedStock.length}</span> items
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                        <span>Rows:</span>
                        <select
                          value={finishedStockPageSize}
                          onChange={(e) => {
                            setFinishedStockPageSize(Number(e.target.value));
                            setFinishedStockPage(1);
                          }}
                          className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setFinishedStockPage((p) => Math.max(1, p - 1))}
                          disabled={currentFinishedStockPage <= 1}
                          className="w-8 h-8 border border-[var(--border)] bg-[var(--card-bg)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--page-bg)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <span className="text-xs font-semibold text-[var(--text-primary)] px-2">
                          {currentFinishedStockPage} / {totalFinishedStockPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setFinishedStockPage((p) => Math.min(totalFinishedStockPages, p + 1))}
                          disabled={currentFinishedStockPage >= totalFinishedStockPages}
                          className="w-8 h-8 border border-[var(--border)] bg-[var(--card-bg)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--page-bg)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab content: Movement History */}
          {activeTab === "movements" && (
            <div className="space-y-3">
              {/* Filter & Search Bar - Responsive, Never Overlaps */}
              <div className="p-3.5 sm:p-4 border border-[var(--border)] rounded-2xl bg-[var(--card-bg)] shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  {/* Search input */}
                  <div className="relative flex-1 sm:max-w-xs">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
                    />
                    <input
                      type="text"
                      placeholder="Search item or transaction..."
                      value={movementSearch}
                      onChange={(e) => {
                        setMovementSearch(e.target.value);
                        setMovementPage(1);
                      }}
                      className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg pl-8 pr-3 h-9 text-xs transition-colors"
                    />
                  </div>

                  {/* Flow Direction Pills */}
                  <div className="flex items-center gap-1 bg-[var(--page-bg)] p-1 rounded-xl border border-[var(--border)] overflow-x-auto no-scrollbar">
                    <button
                      type="button"
                      onClick={() => {
                        setMovementDirection("all");
                        setMovementPage(1);
                      }}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                        movementDirection === "all"
                          ? "bg-[var(--card-bg)] text-[var(--text-primary)] shadow-sm font-bold"
                          : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      All ({movements.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMovementDirection("inward");
                        setMovementPage(1);
                      }}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                        movementDirection === "inward"
                          ? "bg-emerald-500/15 text-emerald-500 font-bold shadow-sm"
                          : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      Inward ({totalInwardCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMovementDirection("outward");
                        setMovementPage(1);
                      }}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                        movementDirection === "outward"
                          ? "bg-rose-500/15 text-rose-500 font-bold shadow-sm"
                          : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      Outward ({totalOutwardCount})
                    </button>
                  </div>

                  {/* Per Page Selector */}
                  <div className="flex items-center gap-2 self-end sm:self-center text-xs text-[var(--text-muted)]">
                    <span className="hidden sm:inline font-medium">Per page:</span>
                    <select
                      value={movementPageSize}
                      onChange={(e) => {
                        setMovementPageSize(Number(e.target.value));
                        setMovementPage(1);
                      }}
                      className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg px-2.5 h-9 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-colors cursor-pointer"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>
              </div>

              {filteredMovements.length === 0 ? (
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-8 text-center text-[var(--text-muted)] text-sm">
                  {movementSearch || movementDirection !== "all"
                    ? "No movements match the search or filter criteria."
                    : "No movement history recorded in stock ledger yet."}
                </div>
              ) : (
                <>
                  {/* Mobile Cards View - Eliminates Horizontal Scroll Completely! */}
                  <div className="block md:hidden space-y-2.5">
                    {pagedMovements.map((m) => {
                      const isPositive = m.quantity_delta > 0;
                      return (
                        <div
                          key={m.id}
                          className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 shadow-sm space-y-2.5"
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

                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="font-bold text-sm text-[var(--text-primary)] truncate">
                                {m.itemName}
                              </h4>
                              <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                                {m.item_type.replace("_", " ")}
                              </span>
                            </div>

                            <div className="text-right shrink-0">
                              <span
                                className={`text-sm font-mono font-bold block ${
                                  isPositive ? "text-emerald-500" : "text-rose-500"
                                }`}
                              >
                                {isPositive ? "+" : ""}
                                {m.quantity_delta.toLocaleString()} {m.unit}
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
                            <th className="py-3 px-5 w-44">Date & Time</th>
                            <th className="py-3 px-5">Item Details</th>
                            <th className="py-3 px-5">Transaction Type</th>
                            <th className="py-3 px-5 text-right w-40">Qty Change</th>
                            <th className="py-3 px-5 text-right w-44">Value Change</th>
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
                                <td className="py-3.5 px-5 font-semibold text-[var(--text-primary)]">
                                  <div className="flex flex-col">
                                    <span>{m.itemName}</span>
                                    <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                                      {m.item_type.replace("_", " ")}
                                    </span>
                                  </div>
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
                                  {m.quantity_delta.toLocaleString()} {m.unit}
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

                  {/* Clean Movement History Pagination Footer */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border border-[var(--border)] rounded-xl bg-[var(--card-bg)] text-xs select-none shadow-sm">
                    <div className="text-[var(--text-muted)] font-medium text-center sm:text-left">
                      Showing <span className="font-bold text-[var(--text-primary)]">{startMovementIdx}</span> to{" "}
                      <span className="font-bold text-[var(--text-primary)]">{endMovementIdx}</span> of{" "}
                      <span className="font-bold text-[var(--text-primary)]">{filteredMovements.length}</span> results
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setMovementPage(1)}
                        disabled={currentMovementPage <= 1}
                        title="First Page"
                        className="w-8 h-8 border border-[var(--border)] bg-[var(--card-bg)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--page-bg)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronsLeft size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setMovementPage((p) => Math.max(1, p - 1))}
                        disabled={currentMovementPage <= 1}
                        title="Previous Page"
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
                        title="Next Page"
                        className="w-8 h-8 border border-[var(--border)] bg-[var(--card-bg)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--page-bg)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronRight size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setMovementPage(totalMovementPages)}
                        disabled={currentMovementPage >= totalMovementPages}
                        title="Last Page"
                        className="w-8 h-8 border border-[var(--border)] bg-[var(--card-bg)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--page-bg)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronsRight size={14} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab content: Godown Details */}
          {activeTab === "details" && (
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 sm:p-6 shadow-sm space-y-5 max-w-2xl">
              <div className="space-y-3">
                <h3 className="text-xs sm:text-sm font-black text-[var(--text-primary)] border-b border-[var(--border)] pb-2.5 uppercase tracking-wider">
                  Godown Parameters
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-semibold">
                  <div className="p-3 bg-[var(--page-bg)] rounded-xl border border-[var(--border)]">
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Godown Name
                    </span>
                    <span className="text-sm font-bold text-[var(--text-primary)]">{godown.name}</span>
                  </div>
                  <div className="p-3 bg-[var(--page-bg)] rounded-xl border border-[var(--border)]">
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Code / Shortcode
                    </span>
                    <span className="text-sm font-mono font-bold text-[var(--text-primary)]">
                      {godown.code || "—"}
                    </span>
                  </div>
                  <div className="p-3 bg-[var(--page-bg)] rounded-xl border border-[var(--border)]">
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Contact Person
                    </span>
                    <span className="text-sm text-[var(--text-primary)]">
                      {godown.contact_person || "—"}
                    </span>
                  </div>
                  <div className="p-3 bg-[var(--page-bg)] rounded-xl border border-[var(--border)]">
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Phone Number
                    </span>
                    <span className="text-sm font-mono text-[var(--text-primary)]">
                      {godown.phone || "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-t border-[var(--border)] pt-4">
                <h3 className="text-xs sm:text-sm font-black text-[var(--text-primary)] border-b border-[var(--border)] pb-2.5 uppercase tracking-wider">
                  Location & Address
                </h3>
                <div className="p-3 bg-[var(--page-bg)] rounded-xl border border-[var(--border)] text-xs font-semibold space-y-1">
                  <span className="text-[var(--text-muted)] block font-bold uppercase tracking-wider text-[10px]">
                    Complete Address
                  </span>
                  <p className="text-xs sm:text-sm font-medium text-[var(--text-body)] leading-relaxed">
                    {godown.address || "No address provided for this location."}
                  </p>
                </div>
                {godown.description && (
                  <div className="p-3 bg-[var(--page-bg)] rounded-xl border border-[var(--border)] text-xs font-semibold space-y-1">
                    <span className="text-[var(--text-muted)] block font-bold uppercase tracking-wider text-[10px]">
                      Notes / Description
                    </span>
                    <p className="text-xs sm:text-sm font-medium text-[var(--text-body)] leading-relaxed">
                      {godown.description}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </PageState>
  );
}
