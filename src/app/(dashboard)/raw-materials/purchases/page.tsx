"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { Badge, BadgeVariant } from "@/components/shared/Badge";
import { RecordPaymentModal } from "@/components/forms/RecordPaymentModal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Plus, Search, Eye, Edit2, CreditCard, ShoppingBag, DollarSign, AlertCircle, Trash2, ArrowLeftRight, RotateCcw } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";

interface PurchaseLog {
  id: string;
  record_type: "purchase" | "return";
  doc_number: string;
  invoice_no: string;
  date: string;
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
  const { data: purchasesData, isLoading: purchasesLoading } = useQuery<any[]>({
    queryKey: ["purchases"],
    queryFn: async () => {
      const res = await fetch("/api/raw-materials/purchases");
      if (!res.ok) throw new Error("Failed to fetch purchases");
      const data = await res.json();
      return data.purchases || [];
    },
  });

  // Fetch Purchase Returns
  const { data: returnsData, isLoading: returnsLoading } = useQuery<any[]>({
    queryKey: ["purchase-returns"],
    queryFn: async () => {
      const res = await fetch("/api/raw-materials/purchase-returns");
      if (!res.ok) throw new Error("Failed to fetch returns");
      const data = await res.json();
      return data.returns || [];
    },
  });

  // Fetch Stats
  const { data: statsData, isLoading: statsLoading } = useQuery<Stats | null>({
    queryKey: ["purchases", "stats"],
    queryFn: async () => {
      const res = await fetch("/api/raw-materials/purchases/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      const data = await res.json();
      return data.stats || null;
    },
  });

  const purchases = purchasesData || [];
  const returns = returnsData || [];
  const loading = purchasesLoading || returnsLoading || statsLoading;

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

  // Compute total returns sum
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
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-returns"] });
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

  const columns: DataTableColumn<PurchaseLog>[] = [
    {
      key: "doc_number",
      header: "Doc / Reference No.",
      width: "170px",
      render: (row) => {
        const href =
          row.record_type === "purchase"
            ? `/raw-materials/purchases/${row.id}`
            : `/raw-materials/purchase-returns/${row.id}`;

        return (
          <div className="flex items-center gap-2">
            <Link
              href={href}
              className={`font-mono font-bold text-xs hover:underline ${
                row.record_type === "purchase" ? "text-indigo-600" : "text-purple-700 dark:text-purple-400"
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
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60 uppercase tracking-wider">
              Purchase Bill
            </span>
          );
        }
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60 shadow-xs uppercase tracking-wider">
            Purchase Return
          </span>
        );
      },
    },
    {
      key: "date",
      header: "Date",
      width: "110px",
      render: (row) => <span className="font-mono text-xs font-semibold whitespace-nowrap">{formatDate(row.date)}</span>,
    },
    {
      key: "supplier",
      header: "Supplier",
      width: "220px",
      render: (row) => (
        <div className="min-w-0 pr-2">
          <span className="font-bold text-[#0F172A] block truncate">{row.supplier?.name || "—"}</span>
          {row.supplier?.company_name && <span className="text-xs text-[#64748B] block truncate">{row.supplier.company_name}</span>}
        </div>
      ),
    },
    {
      key: "invoice_no",
      header: "Inv / Ref No.",
      width: "150px",
      render: (row) => <span className="font-mono text-xs font-semibold text-[#1E293B] whitespace-nowrap">{row.invoice_no}</span>,
    },
    {
      key: "grand_total",
      header: "Grand Total",
      width: "140px",
      render: (row) => (
        <span
          className={`font-mono text-xs font-bold whitespace-nowrap ${
            row.record_type === "return" ? "text-purple-700 dark:text-purple-400" : "text-[#0F172A]"
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
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 capitalize">
            {row.status}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      width: "140px",
      render: (row) => {
        const detailHref =
          row.record_type === "purchase"
            ? `/raw-materials/purchases/${row.id}`
            : `/raw-materials/purchase-returns/${row.id}`;

        const editHref =
          row.record_type === "purchase"
            ? `/raw-materials/purchases/${row.id}/edit`
            : `/raw-materials/purchase-returns/${row.id}/edit`;

        const isPaid = row.payment_status === "paid";

        return (
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <Link
              href={detailHref}
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
              title="View Details"
            >
              <Eye className="h-4 w-4" />
            </Link>
            <Link
              href={editHref}
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-transparent hover:border-amber-100"
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
                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-100"
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
              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
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
    <div className="p-6 space-y-6">
      {/* Header & Dual Action Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A]">Purchases</h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Manage purchase bills, debit notes, and inventory return transactions.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => router.push("/raw-materials/purchases/new")}
            className="flex-1 sm:flex-initial px-4 py-2 bg-[#6366F1] hover:bg-indigo-600 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" /> Record Purchase
          </button>
          <button
            onClick={() => router.push("/raw-materials/purchase-returns/new")}
            className="flex-1 sm:flex-initial px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Record Purchase Return
          </button>
        </div>
      </div>

      {/* STAT CARDS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-[#EEF2FF] rounded-lg text-[#6366F1] shrink-0">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Total Purchases</span>
            <p className="text-lg font-black text-[#0F172A] mt-0.5">{formatCurrency(totalPurchasesVal)}</p>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-purple-50 text-purple-700 rounded-lg shrink-0">
            <RotateCcw className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Total Returns / Debit Notes</span>
            <p className="text-lg font-black text-purple-700 mt-0.5">{formatCurrency(totalReturnsVal)}</p>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-[#F0FDF4] rounded-lg text-[#16A34A] shrink-0">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Net Procurement</span>
            <p className="text-lg font-black text-[#16A34A] mt-0.5">{formatCurrency(netProcurementVal)}</p>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-[#FEF9C3] rounded-lg text-[#D97706] shrink-0">
            <CreditCard className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Outstanding Due</span>
            <p className="text-lg font-black text-[#D97706] mt-0.5">{statsData ? formatCurrency(statsData.totalDue) : "₹0.00"}</p>
          </div>
        </div>
      </div>

      {/* FILTER & TABS BAR */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white border border-[#E2E8F0] p-4 rounded-xl shadow-sm">
        {/* Tabs */}
        <div className="flex bg-[#F1F5F9] p-1 rounded-lg w-full md:w-auto overflow-x-auto">
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
                  ? "bg-white text-[#0F172A] shadow-sm"
                  : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Search PO, return #, supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1] transition-all"
          />
        </div>
      </div>

      {/* UNIFIED LOGS TABLE */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredLogs}
          isLoading={loading}
          total={filteredLogs.length}
          page={1}
          perPage={10000}
          onPageChange={() => {}}
          onRowClick={(row) => {
            const href =
              row.record_type === "purchase"
                ? `/raw-materials/purchases/${row.id}`
                : `/raw-materials/purchase-returns/${row.id}`;
            router.push(href);
          }}
          emptyMessage="No purchases or returns found."
        />
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
  );
}
