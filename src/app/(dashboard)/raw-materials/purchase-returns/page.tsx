"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { Badge, BadgeVariant } from "@/components/shared/Badge";
import { Plus, Search, Eye, RefreshCw, FileText } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";

interface PurchaseReturn {
  id: string;
  return_number: string;
  purchase_id: string;
  return_date: string;
  return_type: string;
  reason: string | null;
  grand_total: number;
  status: "pending" | "completed" | "cancelled";
  supplier?: {
    name: string;
    company_name: string | null;
  };
  purchase?: {
    purchase_number: string;
    invoice_no: string;
  };
}

export default function PurchaseReturnsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const { data: returnsData, isLoading: returnsLoading } = useQuery<PurchaseReturn[]>({
    queryKey: ["purchase-returns"],
    queryFn: async () => {
      const res = await fetch("/api/raw-materials/purchase-returns");
      if (!res.ok) throw new Error("Failed to fetch returns");
      const data = await res.json();
      return data.returns || [];
    }
  });

  const returns = returnsData || [];
  const loading = returnsLoading;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
  };

  const filteredReturns = returns.filter((r) => {
    const matchesSearch =
      r.return_number.toLowerCase().includes(search.toLowerCase()) ||
      (r.supplier?.name && r.supplier.name.toLowerCase().includes(search.toLowerCase())) ||
      (r.purchase?.purchase_number && r.purchase.purchase_number.toLowerCase().includes(search.toLowerCase())) ||
      (r.reason && r.reason.toLowerCase().includes(search.toLowerCase()));

    return matchesSearch;
  });

  const columns: DataTableColumn<PurchaseReturn>[] = [
    {
      key: "return_number",
      header: "Return ID",
      width: "140px",
      render: (row) => (
        <Link
          href={`/raw-materials/purchase-returns/${row.id}`}
          className="font-mono font-bold text-xs text-[#6366F1] hover:underline"
        >
          {row.return_number}
        </Link>
      ),
    },
    {
      key: "return_date",
      header: "Return Date",
      width: "120px",
      render: (row) => <span className="font-mono text-xs font-semibold">{formatDate(row.return_date)}</span>,
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
      key: "purchase",
      header: "Original Invoice",
      width: "150px",
      render: (row) => (
        <div>
          <Link
            href={`/raw-materials/purchases/${row.purchase_id}`}
            className="font-mono text-xs font-bold text-[#475569] hover:underline block"
          >
            {row.purchase?.purchase_number || "—"}
          </Link>
          <span className="text-[10px] text-slate-400 font-semibold font-mono">Inv: {row.purchase?.invoice_no}</span>
        </div>
      ),
    },
    {
      key: "return_type",
      header: "Return Reason Category",
      render: (row) => (
        <div>
          <span className="text-xs capitalize font-semibold text-slate-800">{row.return_type.replace("_", " ")}</span>
          {row.reason && <span className="text-[10px] text-[#64748B] block mt-0.5">{row.reason}</span>}
        </div>
      ),
    },
    {
      key: "grand_total",
      header: "Return Value",
      width: "130px",
      render: (row) => (
        <span className="font-mono text-xs font-extrabold text-[#0F172A]">{formatCurrency(row.grand_total)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "110px",
      render: (row) => {
        let variant: BadgeVariant = "gray";
        if (row.status === "completed") variant = "green";
        else if (row.status === "pending") variant = "orange";
        else if (row.status === "cancelled") variant = "red";

        return (
          <Badge variant={variant} className="capitalize text-[10px] font-bold">
            {row.status}
          </Badge>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      width: "80px",
      render: (row) => (
        <div className="flex items-center justify-center">
          <Link
            href={`/raw-materials/purchase-returns/${row.id}`}
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Purchase Returns"
        subtitle="Track raw material returns, quality issue log, and supplier credit debit notes."
        actionLabel="Record Return"
        onAction={() => router.push("/raw-materials/purchase-returns/new")}
      />

      {/* FILTER & SEARCH BAR */}
      <div className="flex items-center justify-between gap-4 bg-white border border-[#E2E8F0] p-4 rounded-xl shadow-sm">
        <div className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
          Return Log History
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Search return ID, supplier, PO..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1] transition-all"
          />
        </div>
      </div>

      {/* RETURNS TABLE */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredReturns}
          isLoading={loading}
          total={filteredReturns.length}
          page={1}
          perPage={10000}
          onPageChange={() => {}}
          onRowClick={(row) => router.push(`/raw-materials/purchase-returns/${row.id}`)}
          emptyMessage="No purchase returns found."
        />
      </div>
    </div>
  );
}
