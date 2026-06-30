"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { Badge, BadgeVariant } from "@/components/shared/Badge";
import { ArrowLeft, Loader2, Calendar, CreditCard, DollarSign, Receipt } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

interface LedgerEntry {
  date: string;
  particulars: string;
  voucherType: "Opening" | "Purchase" | "Return" | "Payment";
  voucherNo: string;
  debit: number;
  credit: number;
  balanceStr: string;
  balanceSign: "Dr" | "Cr";
}

interface Party {
  id: string;
  code: string;
  name: string;
  company_name: string | null;
  type: string[];
  phone: string | null;
  gstin: string | null;
  payment_terms: string;
  credit_limit: number;
  opening_balance: number;
  status: string;
}

export default function PartyLedgerPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const { data: partyData, isLoading: partyLoading } = useQuery<Party | null>({
    queryKey: ["party", id],
    queryFn: async () => {
      const res = await fetch(`/api/parties/${id}`);
      if (!res.ok) throw new Error("Failed to load party info");
      const data = await res.json();
      return data.party || null;
    }
  });

  const { data: ledgerData, isLoading: ledgerLoading } = useQuery<LedgerEntry[]>({
    queryKey: ["ledger", id],
    queryFn: async () => {
      const res = await fetch(`/api/parties/${id}/ledger`);
      if (!res.ok) throw new Error("Failed to load ledger details");
      const data = await res.json();
      return data.ledger || [];
    }
  });

  const party = partyData || null;
  const ledger = ledgerData || [];
  const loading = partyLoading || ledgerLoading;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
  };

  const totalDebits = ledger.reduce((acc, curr) => acc + curr.debit, 0);
  const totalCredits = ledger.reduce((acc, curr) => acc + curr.credit, 0);
  const closingBalanceStr = ledger.length > 0 ? ledger[ledger.length - 1].balanceStr : "₹0.00 Cr";
  const closingBalanceSign = ledger.length > 0 ? ledger[ledger.length - 1].balanceSign : "Cr";

  const columns: DataTableColumn<LedgerEntry>[] = [
    {
      key: "date",
      header: "Date",
      width: "120px",
      render: (row) => <span className="font-mono text-xs font-semibold">{row.date}</span>,
    },
    {
      key: "particulars",
      header: "Particulars",
      render: (row) => <span className="font-medium text-[#1E293B]">{row.particulars}</span>,
    },
    {
      key: "voucherType",
      header: "Voucher Type",
      width: "120px",
      render: (row) => {
        let variant: BadgeVariant = "gray";
        if (row.voucherType === "Purchase") variant = "primary"; // Blue
        else if (row.voucherType === "Payment") variant = "green"; // Green
        else if (row.voucherType === "Return") variant = "orange"; // Orange
        return (
          <Badge variant={variant} className="capitalize text-[10px]">
            {row.voucherType}
          </Badge>
        );
      },
    },
    {
      key: "voucherNo",
      header: "Voucher No.",
      width: "130px",
      render: (row) => <span className="font-mono text-xs text-[#64748B]">{row.voucherNo}</span>,
    },
    {
      key: "debit",
      header: "Debit (Dr) Amount",
      width: "150px",
      render: (row) => (
        <span className={`font-mono text-xs font-bold ${row.debit > 0 ? "text-[#DC2626]" : "text-slate-400"}`}>
          {row.debit > 0 ? formatCurrency(row.debit) : "—"}
        </span>
      ),
    },
    {
      key: "credit",
      header: "Credit (Cr) Amount",
      width: "150px",
      render: (row) => (
        <span className={`font-mono text-xs font-bold ${row.credit > 0 ? "text-[#16A34A]" : "text-slate-400"}`}>
          {row.credit > 0 ? formatCurrency(row.credit) : "—"}
        </span>
      ),
    },
    {
      key: "balanceStr",
      header: "Running Balance",
      width: "160px",
      render: (row) => (
        <span
          className={`font-mono text-xs font-bold ${
            row.balanceSign === "Cr" ? "text-emerald-700 bg-emerald-50 px-2 py-1 rounded" : "text-rose-700 bg-rose-50 px-2 py-1 rounded"
          }`}
        >
          {row.balanceStr}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#6366F1]" />
      </div>
    );
  }

  if (!party) {
    return (
      <div className="p-6 text-center text-sm font-semibold text-red-500">
        Party ledger could not be loaded.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/parties" className="p-2 hover:bg-[#F1F5F9] rounded-lg transition-colors">
          <ArrowLeft className="h-5 w-5 text-[#64748B]" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            Ledger Account: {party.name}
            <Badge variant="primary" className="text-[10px] font-mono">
              {party.code}
            </Badge>
          </h1>
          <p className="text-xs text-[#64748B]">
            Chronological statement of purchases, returns, payments, and balances.
          </p>
        </div>
      </div>

      {/* PARTY & SUMMARY CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Profile Details */}
        <div className="lg:col-span-1 bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-3.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-2">Profile Info</h2>
          <div>
            <span className="text-[10px] font-semibold text-[#94A3B8] block">Company Name</span>
            <span className="text-sm font-bold text-[#0F172A]">{party.company_name || "—"}</span>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-[#94A3B8] block">GSTIN</span>
            <span className="text-xs font-mono font-bold uppercase text-[#1E293B]">{party.gstin || "—"}</span>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-[#94A3B8] block">Phone / Mobile</span>
            <span className="text-sm font-semibold text-[#1E293B]">{party.phone || "—"}</span>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-[#94A3B8] block">Payment Terms</span>
            <span className="text-xs font-semibold text-[#1E293B] capitalize">{party.payment_terms?.replace(/_/g, " ") || "—"}</span>
          </div>
        </div>

        {/* Ledger Statistics Cards */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-red-50 rounded-lg text-red-600">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#64748B]">Total Debits (Dr)</span>
              <p className="text-xl font-bold text-[#DC2626]">{formatCurrency(totalDebits)}</p>
              <span className="text-[10px] text-[#94A3B8]">Payments / Returns</span>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-lg text-green-600">
              <Receipt className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#64748B]">Total Credits (Cr)</span>
              <p className="text-xl font-bold text-[#16A34A]">{formatCurrency(totalCredits)}</p>
              <span className="text-[10px] text-[#94A3B8]">Purchases / Opening</span>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-lg text-[#6366F1]">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#64748B]">Closing Balance</span>
              <p className={`text-xl font-bold ${closingBalanceSign === "Cr" ? "text-emerald-700" : "text-rose-700"}`}>
                {closingBalanceStr}
              </p>
              <span className="text-[10px] text-[#94A3B8]">Net Outstanding</span>
            </div>
          </div>
        </div>
      </div>

      {/* LEDGER DATA TABLE */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={ledger}
          isLoading={loading}
          total={ledger.length}
          page={1}
          perPage={10000}
          onPageChange={() => {}}
          emptyMessage="No ledger entries found."
        />
      </div>
    </div>
  );
}
