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
  DollarSign,
  Search,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Filter,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";
import PageState from "@/components/shared/PageState";

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
      error={error?.message || "Godown not found"}
      onRetry={refetch}
      skeletonVariant="card"
      skeletonCount={4}
    >
      {godown && (
        <div className="p-6 space-y-6">
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

          {/* Header card */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
            {/* Subtle decorative background gradient */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-[var(--primary-light)] rounded-2xl border border-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)] shrink-0 font-black text-xl shadow-sm">
                <Building2 size={24} />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-black text-[var(--text-primary)] tracking-tight">{godown.name}</h1>
                  {godown.code && (
                    <span className="bg-[var(--primary-light)] text-[var(--primary)] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[var(--primary)]/20 uppercase font-mono">
                      {godown.code}
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                      godown.is_active
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        : "bg-red-500/10 text-red-500 border-red-500/20"
                    }`}
                  >
                    {godown.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)] font-semibold">
                  {godown.address && (
                    <span className="flex items-center gap-1">
                      <MapPin size={13} className="text-[var(--text-faint)]" />
                      {godown.address}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => router.push(`/master-data/godowns`)}
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
                  Stock Items
                </span>
                <span className="text-lg font-black text-[var(--text-primary)]">{totalStockItems}</span>
              </div>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
              <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-500 shrink-0">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider">
                  Total Value
                </span>
                <span className="text-lg font-black text-[var(--text-primary)]">{formatCurrency(totalValuation)}</span>
              </div>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
              <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500 shrink-0">
                <ArrowUpRight className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider">
                  Inward Entries
                </span>
                <span className="text-lg font-black text-[var(--text-primary)]">{totalInwardCount}</span>
              </div>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
              <div className="p-3 bg-amber-500/10 rounded-lg text-amber-500 shrink-0">
                <ArrowDownLeft className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-muted)] block font-bold uppercase tracking-wider">
                  Outward Entries
                </span>
                <span className="text-lg font-black text-[var(--text-primary)]">{totalOutwardCount}</span>
              </div>
            </div>
          </div>

          {/* Tabs list */}
          <div className="flex gap-1 border-b border-[var(--border)] pb-px select-none">
            <button
              onClick={() => {
                setActiveTab("stock");
                setRawStockPage(1);
              }}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                activeTab === "stock"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Raw Materials Stock ({totalStockItems})
            </button>
            <button
              onClick={() => {
                setActiveTab("finished-stock");
                setFinishedStockPage(1);
              }}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                activeTab === "finished-stock"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Finished Goods Stock ({finishedStock.length})
            </button>
            <button
              onClick={() => {
                setActiveTab("movements");
                setMovementPage(1);
              }}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                activeTab === "movements"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Movement History ({movements.length})
            </button>
            <button
              onClick={() => setActiveTab("details")}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                activeTab === "details"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Godown Details
            </button>
          </div>

          {/* Tab content: Raw Stock */}
          {activeTab === "stock" && (
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
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
                    {pagedRawStock.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-[var(--text-muted)]">
                          No items currently in stock in this godown.
                        </td>
                      </tr>
                    ) : (
                      pagedRawStock.map((item) => (
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Raw Stock Pagination Footer */}
              {stock.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-t border-[var(--border)] bg-[var(--card-bg)] text-xs select-none">
                  <div className="text-[var(--text-muted)] font-medium">
                    Showing <span className="font-bold text-[var(--text-primary)]">{startRawStockIdx}</span> to{" "}
                    <span className="font-bold text-[var(--text-primary)]">{endRawStockIdx}</span> of{" "}
                    <span className="font-bold text-[var(--text-primary)]">{stock.length}</span> entries
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
              )}
            </div>
          )}

          {/* Tab content: Finished Stock */}
          {activeTab === "finished-stock" && (
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
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
                    {pagedFinishedStock.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-[var(--text-muted)]">
                          No finished goods stock in this godown yet.
                        </td>
                      </tr>
                    ) : (
                      pagedFinishedStock.map((item) => (
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Finished Stock Pagination Footer */}
              {finishedStock.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-t border-[var(--border)] bg-[var(--card-bg)] text-xs select-none">
                  <div className="text-[var(--text-muted)] font-medium">
                    Showing <span className="font-bold text-[var(--text-primary)]">{startFinishedStockIdx}</span> to{" "}
                    <span className="font-bold text-[var(--text-primary)]">{endFinishedStockIdx}</span> of{" "}
                    <span className="font-bold text-[var(--text-primary)]">{finishedStock.length}</span> entries
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
              )}
            </div>
          )}

          {/* Tab content: Movement History */}
          {activeTab === "movements" && (
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden flex flex-col">
              {/* Filter & Search Bar */}
              <div className="p-4 border-b border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--card-bg)]">
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
                    />
                    <input
                      type="text"
                      placeholder="Search movements..."
                      value={movementSearch}
                      onChange={(e) => {
                        setMovementSearch(e.target.value);
                        setMovementPage(1);
                      }}
                      className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg pl-8 pr-3 h-9 text-xs transition-colors"
                    />
                  </div>

                  {/* Flow Direction Pills */}
                  <div className="flex items-center gap-1 bg-[var(--page-bg)] p-0.5 rounded-lg border border-[var(--border)]">
                    <button
                      type="button"
                      onClick={() => {
                        setMovementDirection("all");
                        setMovementPage(1);
                      }}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
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
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
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
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                        movementDirection === "outward"
                          ? "bg-rose-500/15 text-rose-500 font-bold shadow-sm"
                          : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      Outward ({totalOutwardCount})
                    </button>
                  </div>
                </div>

                {/* Per Page Selector */}
                <div className="flex items-center gap-2 self-end sm:self-center text-xs text-[var(--text-muted)]">
                  <span className="hidden md:inline font-medium">Entries per page:</span>
                  <select
                    value={movementPageSize}
                    onChange={(e) => {
                      setMovementPageSize(Number(e.target.value));
                      setMovementPage(1);
                    }}
                    className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg px-2.5 h-9 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-colors cursor-pointer"
                  >
                    <option value={10}>10 per page</option>
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                  </select>
                </div>
              </div>

              {/* Table */}
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
                    {pagedMovements.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-[var(--text-muted)]">
                          {movementSearch || movementDirection !== "all"
                            ? "No movements match the search or filter criteria."
                            : "No movement history recorded in stock ledger yet."}
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
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Movement History Pagination Footer */}
              {filteredMovements.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-t border-[var(--border)] bg-[var(--card-bg)] text-xs select-none">
                  <div className="text-[var(--text-muted)] font-medium text-center sm:text-left">
                    Showing <span className="font-bold text-[var(--text-primary)]">{startMovementIdx}</span> to{" "}
                    <span className="font-bold text-[var(--text-primary)]">{endMovementIdx}</span> of{" "}
                    <span className="font-bold text-[var(--text-primary)]">{filteredMovements.length}</span> results
                    {filteredMovements.length !== movements.length && (
                      <span className="text-[var(--text-faint)] ml-1">
                        (filtered from {movements.length} total)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* First Page */}
                    <button
                      type="button"
                      onClick={() => setMovementPage(1)}
                      disabled={currentMovementPage <= 1}
                      title="First Page"
                      className="w-8 h-8 border border-[var(--border)] bg-[var(--card-bg)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--page-bg)] hover:text-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronsLeft size={14} />
                    </button>

                    {/* Prev Page */}
                    <button
                      type="button"
                      onClick={() => setMovementPage((p) => Math.max(1, p - 1))}
                      disabled={currentMovementPage <= 1}
                      title="Previous Page"
                      className="w-8 h-8 border border-[var(--border)] bg-[var(--card-bg)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--page-bg)] hover:text-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={14} />
                    </button>

                    {/* Desktop Page Numbers */}
                    <div className="hidden sm:flex items-center gap-1">
                      {Array.from({ length: totalMovementPages }).map((_, pIdx) => {
                        const pNum = pIdx + 1;
                        // Show first, last, current, and +/- 1 neighbors
                        if (
                          pNum === 1 ||
                          pNum === totalMovementPages ||
                          (pNum >= currentMovementPage - 1 && pNum <= currentMovementPage + 1)
                        ) {
                          const isCurrent = pNum === currentMovementPage;
                          return (
                            <button
                              key={pNum}
                              type="button"
                              onClick={() => setMovementPage(pNum)}
                              className={`w-8 h-8 text-xs font-semibold rounded-lg flex items-center justify-center transition-all cursor-pointer border ${
                                isCurrent
                                  ? "bg-[var(--primary-light)] border-[var(--primary)] text-[var(--primary)] font-bold"
                                  : "bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--page-bg)] hover:text-[var(--text-primary)]"
                              }`}
                            >
                              {pNum}
                            </button>
                          );
                        }
                        if (
                          (pNum === 2 && currentMovementPage > 3) ||
                          (pNum === totalMovementPages - 1 && currentMovementPage < totalMovementPages - 2)
                        ) {
                          return (
                            <span key={`dots-${pNum}`} className="px-1 text-[var(--text-faint)]">
                              …
                            </span>
                          );
                        }
                        return null;
                      })}
                    </div>

                    {/* Mobile Page Indicator */}
                    <span className="sm:hidden text-xs font-semibold text-[var(--text-primary)] px-2">
                      {currentMovementPage} / {totalMovementPages}
                    </span>

                    {/* Next Page */}
                    <button
                      type="button"
                      onClick={() => setMovementPage((p) => Math.min(totalMovementPages, p + 1))}
                      disabled={currentMovementPage >= totalMovementPages}
                      title="Next Page"
                      className="w-8 h-8 border border-[var(--border)] bg-[var(--card-bg)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--page-bg)] hover:text-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={14} />
                    </button>

                    {/* Last Page */}
                    <button
                      type="button"
                      onClick={() => setMovementPage(totalMovementPages)}
                      disabled={currentMovementPage >= totalMovementPages}
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

          {/* Tab content: Godown Details */}
          {activeTab === "details" && (
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-6 max-w-2xl">
              <div className="space-y-4">
                <h3 className="text-sm font-black text-[var(--text-primary)] border-b border-[var(--border)] pb-3 uppercase tracking-wider">
                  Godown Parameters
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
                  <div>
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Godown Name
                    </span>
                    <span className="text-sm text-[var(--text-primary)]">{godown.name}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Code / Shortcode
                    </span>
                    <span className="text-sm font-mono text-[var(--text-primary)]">
                      {godown.code || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Contact Person
                    </span>
                    <span className="text-sm text-[var(--text-primary)]">
                      {godown.contact_person || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                      Phone Number
                    </span>
                    <span className="text-sm font-mono text-[var(--text-primary)]">
                      {godown.phone || "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t border-[var(--border)] pt-4">
                <h3 className="text-sm font-black text-[var(--text-primary)] border-b border-[var(--border)] pb-3 uppercase tracking-wider">
                  Location & Address
                </h3>
                <div className="text-xs font-semibold space-y-2">
                  <span className="text-[var(--text-muted)] block font-bold uppercase tracking-wider text-[10px]">
                    Complete Address
                  </span>
                  <p className="text-sm text-[var(--text-body)] leading-relaxed">
                    {godown.address || "No address provided for this location."}
                  </p>
                </div>
                {godown.description && (
                  <div className="text-xs font-semibold space-y-2 pt-2">
                    <span className="text-[var(--text-muted)] block font-bold uppercase tracking-wider text-[10px]">
                      Notes / Description
                    </span>
                    <p className="text-sm text-[var(--text-body)] leading-relaxed">
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
