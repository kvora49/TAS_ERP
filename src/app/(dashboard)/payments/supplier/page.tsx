"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { Badge } from "@/components/shared/Badge";
import { Search, Receipt, Wallet, Banknote } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";
import { MobileCompactRow } from "@/components/shared/MobileCompactRow";
import ModuleSubNav from "@/components/shared/ModuleSubNav";
import { PAYMENTS_NAV } from "@/lib/moduleNav";

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
      render: (row) => <span className="font-mono text-xs font-semibold">{formatDate(row.payment_date)}</span>,
    },
    {
      key: "supplier",
      header: "Supplier",
      render: (row) => (
        <div>
          <span className="font-bold text-[var(--text-primary)] block">{row.supplier?.name || "—"}</span>
          {row.supplier?.company_name && <span className="text-xs text-[var(--text-muted)]">{row.supplier.company_name}</span>}
        </div>
      ),
    },
    {
      key: "purchase",
      header: "Purchase Ref",
      width: "130px",
      render: (row) => (
        <span className="font-mono text-xs font-bold text-[var(--primary)]">{row.purchase?.purchase_number || "—"}</span>
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
      render: (row) => <span className="font-mono text-xs text-[var(--text-muted)]">{row.reference_no || "—"}</span>,
    },
    {
      key: "remarks",
      header: "Remarks",
      render: (row) => <span className="text-xs text-[var(--text-muted)]">{row.remarks || "—"}</span>,
    },
    {
      key: "paid_amount",
      header: "Amount Paid",
      width: "140px",
      render: (row) => (
        <span className="font-mono text-xs font-extrabold text-emerald-600 dark:text-emerald-400">{formatCurrency(row.paid_amount)}</span>
      ),
    },
  ];

  return (
    <div className="p-2.5 sm:p-6 space-y-4 sm:space-y-6">
      {/* ── MODULE SUB NAVIGATION ────────────────────────────────────────── */}
      <ModuleSubNav items={PAYMENTS_NAV} />

      <PageHeader
        title="Supplier Payments"
        subtitle="Comprehensive ledger log of all cash, UPI, and bank transfer outlays to suppliers."
      />

      {/* STAT CARDS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 sm:p-5 shadow-xs flex items-center gap-3.5">
          <div className="p-2.5 sm:p-3 bg-[var(--badge-green-bg)] text-[var(--badge-green-text)] rounded-xl shrink-0">
            <Wallet className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-[var(--text-muted)]">Total Outflow</span>
            <p className="text-xl sm:text-2xl font-black text-[var(--badge-green-text)]">{formatCurrency(totalPaid)}</p>
          </div>
        </div>

        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 sm:p-5 shadow-xs flex items-center gap-3.5">
          <div className="p-2.5 sm:p-3 bg-[var(--primary-light)] text-[var(--primary)] rounded-xl shrink-0">
            <Receipt className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-[var(--text-muted)]">Bank / NEFT</span>
            <p className="text-xl sm:text-2xl font-black text-[var(--text-primary)]">{formatCurrency(bankPayments)}</p>
          </div>
        </div>

        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 sm:p-5 shadow-xs flex items-center gap-3.5">
          <div className="p-2.5 sm:p-3 bg-[var(--badge-purple-bg)] text-[var(--badge-purple-text)] rounded-xl shrink-0">
            <Banknote className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-[var(--text-muted)]">UPI Outflow</span>
            <p className="text-xl sm:text-2xl font-black text-[var(--text-primary)]">{formatCurrency(upiPayments)}</p>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex items-center justify-between gap-3 bg-[var(--card-bg)] border border-[var(--border)] p-3 sm:p-4 rounded-xl shadow-xs">
        <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider hidden sm:block">
          Transaction History
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-faint)]" />
          <input
            type="text"
            placeholder="Search supplier, PO, UTR..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[var(--input-border)] rounded-lg text-sm bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:ring-2 focus:ring-[var(--input-focus)] transition-all"
          />
        </div>
      </div>

      {/* MOBILE: Compact High-Density Row List */}
      <div className="md:hidden bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xs divide-y divide-[var(--border-light)]">
        {filteredPayments.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--text-muted)] italic">
            No supplier payments found.
          </div>
        ) : (
          filteredPayments.map((p) => (
            <MobileCompactRow
              key={p.id}
              title={p.supplier?.name || "Unknown Supplier"}
              subtitle={`${p.payment_date ? formatDate(p.payment_date) : "—"} • ${p.payment_mode?.replace("_", " ").toUpperCase()}${p.reference_no ? ` • Ref: ${p.reference_no}` : ""}`}
              value={<span className="text-[var(--badge-green-text)] font-mono">{formatCurrency(p.paid_amount)}</span>}
              badge={
                <Badge variant="primary" className="capitalize text-[10px]">
                  {p.payment_mode?.replace("_", " ")}
                </Badge>
              }
            />
          ))
        )}
      </div>

      {/* DESKTOP: Full DataTable */}
      <div className="hidden md:block bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-xs overflow-hidden">
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
