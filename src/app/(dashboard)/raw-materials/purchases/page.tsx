"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { Badge, BadgeVariant } from "@/components/shared/Badge";
import { RecordPaymentModal } from "@/components/forms/RecordPaymentModal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Plus, Search, Eye, Edit2, CreditCard, ShoppingBag, DollarSign, AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface Purchase {
  id: string;
  purchase_number: string;
  invoice_no: string;
  invoice_date: string;
  grand_total: number;
  paid_amount: number;
  payment_status: "unpaid" | "partial" | "paid" | "cancelled";
  status: "active" | "draft" | "cancelled";
  gst_type: "with_gst" | "without_gst" | "reverse_charge";
  supplier?: {
    name: string;
    company_name: string;
  };
}

interface Stats {
  totalPurchases: number;
  totalPaid: number;
  totalDue: number;
  unpaidCount: number;
  partialCount: number;
  paidCount: number;
  totalCount: number;
}

export default function PurchasesPage() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "unpaid" | "partial" | "paid">("all");

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentPurchase, setPaymentPurchase] = useState<Purchase | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingPurchase, setDeletingPurchase] = useState<Purchase | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const pRes = await fetch("/api/raw-materials/purchases");
      if (!pRes.ok) throw new Error("Failed to fetch purchases");
      const pData = await pRes.json();
      setPurchases(pData.purchases || []);

      const sRes = await fetch("/api/raw-materials/purchases/stats");
      if (sRes.ok) {
        const sData = await sRes.json();
        setStats(sData.stats);
      }
    } catch (err: any) {
      toast.error(err.message || "Error loading purchases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenDelete = (purchase: Purchase) => {
    setDeletingPurchase(purchase);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingPurchase) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/raw-materials/purchases/${deletingPurchase.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cancel invoice");
      }
      toast.success("Invoice cancelled successfully");
      setDeleteOpen(false);
      fetchData();
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

  const filteredPurchases = purchases.filter((p) => {
    const matchesSearch =
      p.purchase_number.toLowerCase().includes(search.toLowerCase()) ||
      p.invoice_no.toLowerCase().includes(search.toLowerCase()) ||
      (p.supplier?.name && p.supplier.name.toLowerCase().includes(search.toLowerCase())) ||
      (p.supplier?.company_name && p.supplier.company_name.toLowerCase().includes(search.toLowerCase()));

    const matchesTab = activeTab === "all" || p.payment_status === activeTab;

    return matchesSearch && matchesTab;
  });

  const columns: DataTableColumn<Purchase>[] = [
    {
      key: "purchase_number",
      header: "PO Number",
      width: "140px",
      render: (row) => (
        <Link
          href={`/raw-materials/purchases/${row.id}`}
          className="font-mono font-bold text-xs text-[#6366F1] hover:underline"
        >
          {row.purchase_number}
        </Link>
      ),
    },
    {
      key: "invoice_date",
      header: "Invoice Date",
      width: "120px",
      render: (row) => <span className="font-mono text-xs font-semibold">{row.invoice_date}</span>,
    },
    {
      key: "supplier",
      header: "Supplier",
      render: (row) => (
        <div>
          <span className="font-bold text-[#0F172A] block">{row.supplier?.name || "—"}</span>
          {row.supplier?.company_name && <span className="text-xs text-[#64748B]">{row.supplier.company_name}</span>}
        </div>
      ),
    },
    {
      key: "invoice_no",
      header: "Invoice No.",
      width: "120px",
      render: (row) => <span className="font-mono text-xs font-semibold text-[#1E293B]">{row.invoice_no}</span>,
    },
    {
      key: "grand_total",
      header: "Grand Total",
      width: "130px",
      render: (row) => <span className="font-mono text-xs font-bold text-[#0F172A]">{formatCurrency(row.grand_total)}</span>,
    },
    {
      key: "balance",
      header: "Balance Due",
      width: "130px",
      render: (row) => {
        const bal = Number(row.grand_total) - Number(row.paid_amount || 0);
        return (
          <span className={`font-mono text-xs font-bold ${bal > 0 ? "text-amber-700" : "text-emerald-700"}`}>
            {formatCurrency(bal)}
          </span>
        );
      },
    },
    {
      key: "payment_status",
      header: "Payment",
      width: "110px",
      render: (row) => {
        let variant: BadgeVariant = "gray";
        if (row.payment_status === "paid") variant = "green";
        else if (row.payment_status === "partial") variant = "orange";
        else if (row.payment_status === "unpaid") variant = "red";

        return (
          <Badge variant={variant} className="capitalize text-[10px] font-bold">
            {row.payment_status}
          </Badge>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      width: "140px",
      render: (row) => {
        const isPaid = row.payment_status === "paid";
        return (
          <div className="flex items-center gap-1.5">
            <Link
              href={`/raw-materials/purchases/${row.id}`}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
              title="View Invoice"
            >
              <Eye className="h-4 w-4" />
            </Link>
            {!isPaid && (
              <button
                onClick={() => {
                  setPaymentPurchase(row);
                  setPaymentModalOpen(true);
                }}
                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-100"
                title="Record Payment"
              >
                <CreditCard className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => handleOpenDelete(row)}
              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
              title="Cancel Invoice"
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
      <PageHeader
        title="Purchase Invoices"
        subtitle="Record and track raw material purchases, invoices, and payment statuses."
        actionLabel="Record Purchase"
        onAction={() => router.push("/raw-materials/purchases/new")}
      />

      {/* STAT CARDS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-[#EEF2FF] rounded-lg text-[#6366F1] shrink-0">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Total Purchases</span>
            <p className="text-lg font-black text-[#0F172A] mt-0.5">{stats ? formatCurrency(stats.totalPurchases) : "₹0.00"}</p>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-[#F0FDF4] rounded-lg text-[#16A34A] shrink-0">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Total Paid</span>
            <p className="text-lg font-black text-[#16A34A] mt-0.5">{stats ? formatCurrency(stats.totalPaid) : "₹0.00"}</p>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-[#FEF9C3] rounded-lg text-[#D97706] shrink-0">
            <CreditCard className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Total Outstanding</span>
            <p className="text-lg font-black text-[#D97706] mt-0.5">{stats ? formatCurrency(stats.totalDue) : "₹0.00"}</p>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-[#FEF2F2] rounded-lg text-[#DC2626] shrink-0">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Unpaid Invoices</span>
            <p className="text-lg font-black text-[#DC2626] mt-0.5">{stats ? stats.unpaidCount : "0"}</p>
          </div>
        </div>
      </div>

      {/* FILTER & TABS BAR */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white border border-[#E2E8F0] p-4 rounded-xl shadow-sm">
        {/* Tabs */}
        <div className="flex bg-[#F1F5F9] p-1 rounded-lg w-full md:w-auto">
          {[
            { id: "all", label: "All Invoices" },
            { id: "unpaid", label: "Unpaid" },
            { id: "partial", label: "Partial" },
            { id: "paid", label: "Paid" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-white text-[#0F172A] shadow-sm font-bold"
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
            placeholder="Search PO, invoice, supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1] transition-all"
          />
        </div>
      </div>

      {/* INVOICES TABLE */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredPurchases}
          isLoading={loading}
          total={filteredPurchases.length}
          page={1}
          perPage={10000}
          onPageChange={() => {}}
          emptyMessage="No purchases invoices found."
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
          onSuccess={fetchData}
        />
      )}

      {/* CANCEL CONFIRM DIALOG */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Cancel Purchase Invoice"
        description={`Are you sure you want to cancel purchase invoice ${deletingPurchase?.purchase_number}? This will set status to cancelled.`}
        confirmText="Cancel Invoice"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
