"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { Badge, BadgeVariant } from "@/components/shared/Badge";
import { DueDateBadge } from "@/components/shared/DueDateBadge";
import { RecordPaymentModal } from "@/components/forms/RecordPaymentModal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";
import { PullToRefresh } from "@/components/shared/PullToRefresh";
import { SwipeableRow } from "@/components/shared/SwipeableRow";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { Plus, Search, Eye, Edit2, CreditCard, ShoppingBag, DollarSign, Trash2, RotateCcw } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface PurchaseLog {
  id: string;
  record_type: "purchase" | "return";
  doc_number: string;
  invoice_no: string;
  date: string;
  due_date?: string | null;
  grand_total: number;
  paid_amount: number;
  payment_status?: "unpaid" | "partial" | "paid" | "cancelled";
  status: string;
  supplier?: {
    name: string;
    company_name?: string | null;
  };
  purchase_ref?: string;
  raw_purchase?: any;
  raw_return?: any;
}

interface Stats {
  totalPurchases: number;
  totalPaid: number;
  totalDue: number;
  totalReturns: number;
  unpaidCount: number;
}

export default function PurchasesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as any) || "all";
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "purchases" | "returns" | "unpaid" | "paid">(
    ["all", "purchases", "returns", "unpaid", "paid"].includes(initialTab) ? initialTab : "all"
  );

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentPurchase, setPaymentPurchase] = useState<any | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingLog, setDeletingLog] = useState<PurchaseLog | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Fetch Purchases
  const { data: purchasesData, isLoading: purchasesLoading, error: purchasesError, refetch: refetchPurchases } = useQuery<any[]>({
    queryKey: ["raw-material-purchases", "list"],
    staleTime: 30_000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    queryFn: async () => {
      const res = await fetch("/api/raw-materials/purchases");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}: Failed to fetch purchases`);
      }
      const data = await res.json();
      return data.purchases || [];
    },
  });

  // Fetch Purchase Returns
  const { data: returnsData } = useQuery<any[]>({
    queryKey: ["raw-material-purchase-returns", "list"],
    staleTime: 30_000,
    queryFn: async () => {
      try {
        const res = await fetch("/api/raw-materials/purchase-returns");
        if (!res.ok) return [];
        const data = await res.json();
        return data.returns || [];
      } catch {
        return [];
      }
    },
  });

  // Fetch Stats
  const { data: statsData } = useQuery<Stats | null>({
    queryKey: ["raw-material-purchases", "stats"],
    staleTime: 60_000,
    queryFn: async () => {
      try {
        const res = await fetch("/api/raw-materials/purchases/stats");
        if (!res.ok) return null;
        const data = await res.json();
        return data.stats || null;
      } catch {
        return null;
      }
    },
  });

  const purchases = purchasesData || [];
  const returns = returnsData || [];
  const loading = purchasesLoading;
  const isError = !!purchasesError;

  // Unified stream mapping
  const unifiedLogs: PurchaseLog[] = [
    ...purchases.map((p: any) => ({
      id: p.id,
      record_type: "purchase" as const,
      doc_number: p.purchase_number,
      invoice_no: p.invoice_no || "—",
      date: p.invoice_date,
      grand_total: Number(p.grand_total || 0),
      paid_amount: Number(p.paid_amount || 0),
      payment_status: p.payment_status,
      status: p.status,
      supplier: p.supplier,
      raw_purchase: p,
    })),
    ...returns.map((r: any) => ({
      id: r.id,
      record_type: "return" as const,
      doc_number: r.return_number,
      invoice_no: r.purchase?.invoice_no ? `Ref: ${r.purchase.invoice_no}` : (r.challan_no || "—"),
      date: r.return_date,
      grand_total: Number(r.grand_total || 0),
      paid_amount: Number(r.grand_total || 0),
      payment_status: undefined,
      status: r.status,
      supplier: r.supplier,
      purchase_ref: r.purchase?.purchase_number,
      raw_return: r,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalReturnsVal = returns.reduce((acc, r) => acc + Number(r.grand_total || 0), 0);
  const totalPurchasesVal = statsData?.totalPurchases || 0;
  const netProcurementVal = Math.max(0, totalPurchasesVal - totalReturnsVal);

  const handleOpenDelete = (log: PurchaseLog) => {
    setDeletingLog(log);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingLog) return;
    setDeleteLoading(true);
    try {
      const endpoint =
        deletingLog.record_type === "purchase"
          ? `/api/raw-materials/purchases/${deletingLog.id}`
          : `/api/raw-materials/purchase-returns/${deletingLog.id}`;

      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete record");
      }

      toast.success(
        deletingLog.record_type === "purchase"
          ? "Purchase Invoice cancelled successfully"
          : "Purchase Return cancelled successfully"
      );
      setDeleteOpen(false);
      queryClient.invalidateQueries({ queryKey: ["raw-material-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["raw-material-purchase-returns"] });
      queryClient.invalidateQueries({ queryKey: ["purchases", "stats"] });
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
  };

  const filteredLogs = unifiedLogs.filter((log) => {
    const matchesSearch =
      log.doc_number.toLowerCase().includes(search.toLowerCase()) ||
      log.invoice_no.toLowerCase().includes(search.toLowerCase()) ||
      (log.supplier?.name && log.supplier.name.toLowerCase().includes(search.toLowerCase())) ||
      (log.supplier?.company_name && log.supplier.company_name.toLowerCase().includes(search.toLowerCase()));

    let matchesTab = true;
    if (activeTab === "purchases") matchesTab = log.record_type === "purchase";
    else if (activeTab === "returns") matchesTab = log.record_type === "return";
    else if (activeTab === "unpaid") matchesTab = log.record_type === "purchase" && log.payment_status === "unpaid";
    else if (activeTab === "paid") matchesTab = log.record_type === "purchase" && log.payment_status === "paid";

    return matchesSearch && matchesTab;
  });

  const [mobileDisplayCount, setMobileDisplayCount] = useState(15);
  const displayedMobileLogs = filteredLogs.slice(0, mobileDisplayCount);
  const hasMoreMobile = mobileDisplayCount < filteredLogs.length;

  const { sentinelRef } = useInfiniteScroll<HTMLDivElement>({
    enabled: hasMoreMobile && !loading,
    onIntersect: () => {
      setMobileDisplayCount((prev) => Math.min(prev + 10, filteredLogs.length));
    },
  });

  const columns: DataTableColumn<PurchaseLog>[] = [
    {
      key: "doc_number",
      header: "Doc / Reference No.",
      width: "170px",
      render: (row) => {
        const href =
          row.record_type === "purchase"
            ? `/purchases/${row.id}`
            : `/purchases/returns/${row.id}`;

        return (
          <div className="flex items-center gap-2">
            <Link
              href={href}
              className={`font-mono font-bold text-xs hover:underline ${
                row.record_type === "purchase" ? "text-[var(--primary)]" : "text-purple-500"
              }`}
            >
              {row.doc_number}
            </Link>
          </div>
        );
      },
    },
    {
      key: "record_type",
      header: "Type",
      width: "150px",
      render: (row) => {
        if (row.record_type === "purchase") {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--border)] uppercase tracking-wider">
              Purchase Bill
            </span>
          );
        }
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-500 border border-[var(--border)] uppercase tracking-wider">
            Purchase Return
          </span>
        );
      },
    },
    {
      key: "date",
      header: "Date",
      width: "110px",
      render: (row) => <span className="font-mono text-xs font-semibold whitespace-nowrap text-[var(--text-primary)]">{formatDate(row.date)}</span>,
    },
    {
      key: "supplier",
      header: "Supplier",
      width: "220px",
      render: (row) => (
        <div className="min-w-0 pr-2">
          <span className="font-bold text-[var(--text-primary)] block truncate">{row.supplier?.name || "—"}</span>
          {row.supplier?.company_name && <span className="text-xs text-[var(--text-muted)] block truncate">{row.supplier.company_name}</span>}
        </div>
      ),
    },
    {
      key: "invoice_no",
      header: "Inv / Ref No.",
      width: "150px",
      render: (row) => <span className="font-mono text-xs font-semibold text-[var(--text-primary)] whitespace-nowrap">{row.invoice_no}</span>,
    },
    {
      key: "grand_total",
      header: "Grand Total",
      width: "140px",
      render: (row) => (
        <span
          className={`font-mono text-xs font-bold whitespace-nowrap ${
            row.record_type === "return" ? "text-purple-500" : "text-[var(--text-primary)]"
          }`}
        >
          {row.record_type === "return" ? `- ${formatCurrency(row.grand_total)}` : formatCurrency(row.grand_total)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status / Payment",
      width: "130px",
      render: (row) => {
        if (row.record_type === "purchase") {
          let variant: BadgeVariant = "gray";
          if (row.payment_status === "paid") variant = "green";
          else if (row.payment_status === "partial") variant = "orange";
          else if (row.payment_status === "unpaid") variant = "red";

          return (
            <Badge variant={variant} className="capitalize text-[10px] font-bold">
              {row.payment_status}
            </Badge>
          );
        }

        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--page-bg)] text-[var(--text-muted)] border border-[var(--border)] capitalize">
            {row.status}
          </span>
        );
      },
    },
    {
      key: "due_date",
      header: "Due Counter",
      width: "140px",
      render: (row) => {
        if (row.record_type === "purchase") {
          const dueDate = row.raw_purchase?.due_date || row.due_date;
          return (
            <DueDateBadge
              dueDate={dueDate}
              isCompleted={row.payment_status === "paid"}
              type="purchase"
            />
          );
        }
        return null;
      },
    },
    {
      key: "actions",
      header: "Actions",
      width: "140px",
      render: (row) => {
        const detailHref =
          row.record_type === "purchase"
            ? `/purchases/${row.id}`
            : `/purchases/returns/${row.id}`;

        const editHref =
          row.record_type === "purchase"
            ? `/purchases/${row.id}/edit`
            : `/purchases/returns/${row.id}/edit`;

        const isPaid = row.payment_status === "paid";

        return (
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <Link
              href={detailHref}
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors border border-transparent"
              title="View Details"
            >
              <Eye className="h-4 w-4" />
            </Link>
            <Link
              href={editHref}
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors border border-transparent"
              title="Edit"
            >
              <Edit2 className="h-4 w-4" />
            </Link>
            {row.record_type === "purchase" && !isPaid && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPaymentPurchase(row.raw_purchase);
                  setPaymentModalOpen(true);
                }}
                className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors border border-transparent cursor-pointer"
                title="Record Payment"
              >
                <CreditCard className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDelete(row);
              }}
              className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent cursor-pointer"
              title="Cancel / Delete Record"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <PullToRefresh onRefresh={async () => { await refetchPurchases(); }}>
      <div className="p-2.5 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header & Dual Action Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Purchases</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Manage purchase bills, debit notes, and inventory return transactions.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <AsyncButton
            onClick={() => router.push("/purchases/new")}
            variant="primary"
            className="flex-1 sm:flex-initial text-xs font-bold flex items-center justify-center gap-1.5 h-9 sm:h-10 px-3 sm:px-4"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span><span className="hidden sm:inline">Record </span>Purchase</span>
          </AsyncButton>
          <button
            onClick={() => router.push("/purchases/returns/new")}
            className="flex-1 sm:flex-initial text-xs font-bold flex items-center justify-center gap-1.5 h-9 sm:h-10 px-3 sm:px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all shadow-sm shadow-purple-500/20 cursor-pointer shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
            <span><span className="hidden sm:inline">Record </span>Return</span>
          </button>
        </div>
      </div>

      {/* ── MOBILE: snap-scroll stat cards ── */}
      <div className="md:hidden flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-0 pb-1 scrollbar-none">
        {[
          { label: "Purchases",   value: formatCurrency(totalPurchasesVal), icon: ShoppingBag, bg: "bg-[var(--primary-light)]", color: "text-[var(--primary)]" },
          { label: "Returns",     value: formatCurrency(totalReturnsVal),   icon: RotateCcw,  bg: "bg-purple-500/10",           color: "text-purple-500" },
          { label: "Net Procured",value: formatCurrency(netProcurementVal), icon: DollarSign, bg: "bg-green-500/10",            color: "text-green-500" },
          { label: "Due",         value: statsData ? formatCurrency(statsData.totalDue) : "₹0", icon: CreditCard, bg: "bg-amber-500/10", color: "text-amber-500" },
        ].map(({ label, value, icon: Icon, bg, color }) => (
          <div key={label} className="snap-start shrink-0 w-[152px] min-[430px]:w-[168px] bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3 shadow-[var(--shadow-sm)] flex items-center gap-2.5">
            <div className={cn("p-2 rounded-lg shrink-0", bg)}><Icon className={cn("h-4 w-4", color)} /></div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider truncate">{label}</p>
              <p className={cn("text-xs font-black mt-0.5 truncate", color)}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── DESKTOP: existing 4-col stat grid ── */}
      <div className="hidden md:grid grid-cols-4 gap-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)] flex items-center gap-3.5">
            <div className="p-3 bg-[var(--primary-light)] rounded-lg text-[var(--primary)] shrink-0">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Total Purchases</span>
              <p className="text-lg font-black text-[var(--text-primary)] mt-0.5">{formatCurrency(totalPurchasesVal)}</p>
            </div>
          </div>

          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)] flex items-center gap-3.5">
            <div className="p-3 bg-purple-500/10 text-purple-500 rounded-lg shrink-0">
              <RotateCcw className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Total Returns / Debit Notes</span>
              <p className="text-lg font-black text-purple-500 mt-0.5">{formatCurrency(totalReturnsVal)}</p>
            </div>
          </div>

          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)] flex items-center gap-3.5">
            <div className="p-3 bg-green-500/10 text-green-500 rounded-lg shrink-0">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Net Procurement</span>
              <p className="text-lg font-black text-green-500 mt-0.5">{formatCurrency(netProcurementVal)}</p>
            </div>
          </div>

          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)] flex items-center gap-3.5">
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-lg shrink-0">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Outstanding Due</span>
              <p className="text-lg font-black text-amber-500 mt-0.5">{statsData ? formatCurrency(statsData.totalDue) : "₹0.00"}</p>
            </div>
          </div>
        </div>

      {/* ── MOBILE: chip tabs + compact search ── */}
        <div className="md:hidden space-y-2">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: "all", label: "All" },
              { id: "purchases", label: "Purchases" },
              { id: "returns", label: "Returns" },
              { id: "unpaid", label: "Unpaid" },
              { id: "paid", label: "Paid" },
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                className={cn("shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer whitespace-nowrap",
                  activeTab === tab.id ? "bg-[var(--primary)] border-[var(--primary)] text-white" : "bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-muted)]"
                )}
              >{tab.label}</button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-faint)] pointer-events-none" />
            <input type="text" placeholder="Search purchases..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 h-10 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-colors"
            />
          </div>
        </div>

        {/* ── DESKTOP: filter & tabs bar (existing) ── */}
        <div className="hidden md:flex flex-col md:flex-row items-center justify-between gap-4 bg-[var(--card-bg)] border border-[var(--border)] p-4 rounded-xl shadow-[var(--shadow-sm)]">
          {/* Desktop Tabs */}
          <div className="flex bg-[var(--page-bg)] p-1 rounded-lg w-full md:w-auto overflow-x-auto">
            {[
              { id: "all", label: "All Logs" },
              { id: "purchases", label: "Purchases" },
              { id: "returns", label: "Purchase Returns" },
              { id: "unpaid", label: "Unpaid" },
              { id: "paid", label: "Paid" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-[var(--card-bg)] text-[var(--text-primary)] shadow-[var(--shadow-sm)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Desktop Search */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-faint)]" />
            <input type="text" placeholder="Search PO, return #, supplier..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--input-focus)] transition-all"
            />
          </div>
        </div>{/* end desktop filter bar */}

        {/* ── MOBILE: Purchase card list ── */}
        <div className="md:hidden">
          <PageState
            isLoading={loading}
            isError={isError}
            error={purchasesError ? (purchasesError instanceof Error ? purchasesError.message : "Failed to load purchases") : undefined}
            onRetry={refetchPurchases}
            isEmpty={filteredLogs.length === 0}
            emptyTitle="No Purchases Found"
            emptyDescription="No inward bills or return logs match your search filter."
            emptyAction={
              <AsyncButton onClick={() => router.push("/purchases/new")} variant="primary">
                + Record First Purchase
              </AsyncButton>
            }
            skeletonVariant="card"
            skeletonCount={4}
          >
            <div className="space-y-3">
              {displayedMobileLogs.map((log) => {
                const isPurchase = log.record_type === "purchase";
                const detailHref = isPurchase ? `/purchases/${log.id}` : `/purchases/returns/${log.id}`;
                const editHref = isPurchase ? `/purchases/${log.id}/edit` : `/purchases/returns/${log.id}/edit`;
                const isPaid = log.payment_status === "paid";
                const dueDate = isPurchase ? (log.raw_purchase?.due_date || log.due_date) : undefined;

                let statusVariant: BadgeVariant = "gray";
                if (log.payment_status === "paid") statusVariant = "green";
                else if (log.payment_status === "partial") statusVariant = "orange";
                else if (log.payment_status === "unpaid") statusVariant = "red";

                return (
                  <SwipeableRow
                    key={log.id}
                    className="rounded-xl shadow-[var(--shadow-sm)] border border-[var(--border)] overflow-hidden"
                    leftAction={{
                      label: "Edit",
                      icon: <Edit2 size={14} />,
                      bgClass: "bg-amber-500 text-white",
                      onAction: () => router.push(editHref),
                    }}
                    rightAction={{
                      label: "Cancel",
                      icon: <Trash2 size={14} />,
                      bgClass: "bg-rose-600 text-white",
                      onAction: () => handleOpenDelete(log),
                    }}
                  >
                    <div
                      className="bg-[var(--card-bg)] active:bg-[var(--table-row-hover)] transition-colors cursor-pointer"
                      onClick={() => router.push(detailHref)}
                    >
                      {/* Header: Doc# + Type badge */}
                      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                        <Link href={detailHref} onClick={(e) => e.stopPropagation()}
                          className={cn("font-mono font-black text-sm hover:underline", isPurchase ? "text-[var(--primary)]" : "text-purple-500")}
                        >{log.doc_number}</Link>
                        <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                          isPurchase ? "bg-[var(--primary-light)] text-[var(--primary)]" : "bg-purple-500/10 text-purple-500"
                        )}>
                          {isPurchase ? "Purchase" : "Return"}
                        </span>
                      </div>

                      {/* Supplier + Date */}
                      <div className="flex items-center justify-between px-4 pb-2">
                        <span className="font-semibold text-[var(--text-primary)] text-sm truncate max-w-[60%]">{log.supplier?.name || "—"}</span>
                        <span className="text-xs text-[var(--text-muted)] shrink-0">{formatDate(log.date)}</span>
                      </div>

                      {/* Amounts + Status grid */}
                      <div className="grid grid-cols-3 border-t border-[var(--border-light)] mx-4 py-2">
                        <div>
                          <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Total</p>
                          <p className={cn("text-xs font-bold mt-0.5", isPurchase ? "text-[var(--text-primary)]" : "text-purple-500")}>
                            {isPurchase ? formatCurrency(log.grand_total) : `- ${formatCurrency(log.grand_total)}`}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Paid</p>
                          <p className="text-xs font-bold mt-0.5 text-green-500">{isPurchase ? formatCurrency(log.paid_amount) : "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Status</p>
                          <div className="mt-0.5">
                            {isPurchase ? <Badge variant={statusVariant} className="capitalize text-[10px]">{log.payment_status}</Badge>
                              : <span className="text-[10px] font-bold text-[var(--text-muted)]">—</span>
                            }
                          </div>
                        </div>
                      </div>

                      {/* Invoice ref + Due counter */}
                      <div className="flex items-center flex-wrap gap-1.5 px-4 pb-2">
                        {log.invoice_no && log.invoice_no !== "—" && (
                          <span className="text-[10px] font-mono font-bold text-[var(--text-muted)]">Inv: {log.invoice_no}</span>
                        )}
                        {log.purchase_ref && (
                          <span className="text-[10px] font-mono text-purple-400">Ref: {log.purchase_ref}</span>
                        )}
                        {isPurchase && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <DueDateBadge dueDate={dueDate} isCompleted={isPaid} type="purchase" />
                          </div>
                        )}
                      </div>

                      {/* Action footer */}
                      <div className="flex items-center gap-1.5 px-4 pb-3.5 border-t border-[var(--border-light)] pt-2" onClick={(e) => e.stopPropagation()}>
                        <Link href={detailHref} onClick={(e) => e.stopPropagation()}
                          className="flex-1 h-9 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] text-blue-500 flex items-center justify-center cursor-pointer active:scale-95 transition-transform" title="View"
                        ><Eye size={14} /></Link>
                        <Link href={editHref} onClick={(e) => e.stopPropagation()}
                          className="flex-1 h-9 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] text-amber-500 flex items-center justify-center cursor-pointer active:scale-95 transition-transform" title="Edit"
                        ><Edit2 size={14} /></Link>
                        {isPurchase && !isPaid && (
                          <button type="button"
                            onClick={(e) => { e.stopPropagation(); setPaymentPurchase(log.raw_purchase); setPaymentModalOpen(true); }}
                            className="flex-1 h-9 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] text-emerald-500 flex items-center justify-center cursor-pointer active:scale-95 transition-transform" title="Record Payment"
                          ><CreditCard size={14} /></button>
                        )}
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleOpenDelete(log); }}
                          className="flex-1 h-9 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] text-red-500 flex items-center justify-center cursor-pointer active:scale-95 transition-transform" title="Cancel"
                        ><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </SwipeableRow>
                );
              })}

              {hasMoreMobile && (
                <div ref={sentinelRef} className="py-3 flex justify-center items-center text-xs text-[var(--text-muted)] font-medium">
                  <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse mr-2" />
                  Loading more purchases...
                </div>
              )}
            </div>
          </PageState>
        </div>

        {/* ── DESKTOP: DataTable ── */}
        <div className="hidden md:block">
          <PageState
            isLoading={loading}
            isError={isError}
            error={purchasesError ? (purchasesError instanceof Error ? purchasesError.message : "Failed to load purchases") : undefined}
            onRetry={refetchPurchases}
            isEmpty={filteredLogs.length === 0}
            emptyTitle="No Purchases Found"
            emptyDescription="No inward bills or return logs match your search filter."
            emptyAction={
              <AsyncButton onClick={() => router.push("/purchases/new")} variant="primary">
                + Record First Purchase
              </AsyncButton>
            }
            skeletonVariant="table"
            skeletonRows={8}
            skeletonColumns={8}
          >
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
              <DataTable
                columns={columns}
                data={filteredLogs}
                isLoading={false}
                total={filteredLogs.length}
                page={1}
                perPage={10000}
                onPageChange={() => {}}
                onRowClick={(row) => {
                  const href =
                    row.record_type === "purchase"
                      ? `/purchases/${row.id}`
                      : `/purchases/returns/${row.id}`;
                  router.push(href);
                }}
                emptyMessage="No purchases or returns found matching filters."
              />
            </div>{/* end desktop DataTable */}
          </PageState>
        </div>

      {/* RECORD PAYMENT MODAL */}
      {paymentPurchase && (
        <RecordPaymentModal
          open={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false);
            setPaymentPurchase(null);
          }}
          purchase={paymentPurchase}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["purchases"] });
            queryClient.invalidateQueries({ queryKey: ["purchases", "stats"] });
          }}
        />
      )}

      {/* CANCEL CONFIRM DIALOG */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={deletingLog?.record_type === "purchase" ? "Cancel Purchase Invoice" : "Cancel Purchase Return"}
        description={`Are you sure you want to cancel ${deletingLog?.doc_number}? This will reverse transactions and set status to cancelled.`}
        confirmText="Confirm Cancel"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
      />
    </div>
    </PullToRefresh>
  );
}
