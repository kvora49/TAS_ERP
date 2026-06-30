"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { Badge } from "@/components/shared/Badge";
import { Search, Receipt, Wallet, Banknote } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

interface Payment {
  id: string;
  payment_date: string;
  payment_mode: string;
  reference_no: string | null;
  paid_amount: number;
  remarks: string | null;
  supplier?: {
    name: string;
    company_name: string | null;
  };
  purchase?: {
    purchase_number: string;
    invoice_no: string;
  };
}

export default function SupplierPaymentsPage() {
  const [search, setSearch] = useState("");

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ["payments", "supplier"],
    queryFn: async () => {
      const res = await fetch("/api/payments/supplier");
      if (!res.ok) throw new Error("Failed to fetch payments");
      const data = await res.json();
      return data.payments || [];
    }
  });

  const payments = paymentsData || [];
  const loading = paymentsLoading;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
  };

  const filteredPayments = payments.filter((p) => {
    const matchesSearch =
      (p.supplier?.name && p.supplier.name.toLowerCase().includes(search.toLowerCase())) ||
      (p.purchase?.purchase_number && p.purchase.purchase_number.toLowerCase().includes(search.toLowerCase())) ||
      (p.reference_no && p.reference_no.toLowerCase().includes(search.toLowerCase())) ||
      (p.remarks && p.remarks.toLowerCase().includes(search.toLowerCase()));

    return matchesSearch;
  });

  // Aggregates
  const totalPaid = payments.reduce((acc, curr) => acc + Number(curr.paid_amount || 0), 0);
  const upiPayments = payments.filter((p) => p.payment_mode === "upi").reduce((acc, curr) => acc + Number(curr.paid_amount || 0), 0);
  const bankPayments = payments.filter((p) => ["bank_transfer", "neft", "rtgs"].includes(p.payment_mode)).reduce((acc, curr) => acc + Number(curr.paid_amount || 0), 0);

  const columns: DataTableColumn<Payment>[] = [
    {
      key: "payment_date",
      header: "Payment Date",
      width: "120px",
      render: (row) => <span className="font-mono text-xs font-semibold">{row.payment_date}</span>,
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
      header: "Purchase Ref",
      width: "130px",
      render: (row) => (
        <span className="font-mono text-xs font-bold text-[#6366F1]">{row.purchase?.purchase_number || "—"}</span>
      ),
    },
    {
      key: "payment_mode",
      header: "Mode",
      width: "110px",
      render: (row) => (
        <Badge variant="primary" className="capitalize text-[10px] font-bold">
          {row.payment_mode.replace("_", " ")}
        </Badge>
      ),
    },
    {
      key: "reference_no",
      header: "Ref / UTR No.",
      width: "130px",
      render: (row) => <span className="font-mono text-xs text-[#64748B]">{row.reference_no || "—"}</span>,
    },
    {
      key: "remarks",
      header: "Remarks",
      render: (row) => <span className="text-xs text-[#64748B]">{row.remarks || "—"}</span>,
    },
    {
      key: "paid_amount",
      header: "Amount Paid",
      width: "140px",
      render: (row) => (
        <span className="font-mono text-xs font-extrabold text-green-700">{formatCurrency(row.paid_amount)}</span>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Supplier Payments"
        subtitle="Comprehensive ledger log of all cash, UPI, and bank transfer outlays to suppliers."
      />

      {/* STAT CARDS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-50 rounded-lg text-green-600">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-[#64748B]">Total Outflow</span>
            <p className="text-2xl font-bold text-[#16A34A]">{formatCurrency(totalPaid)}</p>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-lg text-[#6366F1]">
            <Receipt className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-[#64748B]">Bank / NEFT Outflow</span>
            <p className="text-2xl font-bold text-slate-800">{formatCurrency(bankPayments)}</p>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 rounded-lg text-purple-600">
            <Banknote className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-[#64748B]">UPI Outflow</span>
            <p className="text-2xl font-bold text-slate-800">{formatCurrency(upiPayments)}</p>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex items-center justify-between gap-4 bg-white border border-[#E2E8F0] p-4 rounded-xl shadow-sm">
        <div className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
          Transaction History
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Search supplier, PO, UTR, remarks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1] transition-all"
          />
        </div>
      </div>

      {/* PAYMENTS TABLE */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredPayments}
          isLoading={loading}
          total={filteredPayments.length}
          page={1}
          perPage={10000}
          onPageChange={() => {}}
          emptyMessage="No supplier payments found."
        />
      </div>
    </div>
  );
}
