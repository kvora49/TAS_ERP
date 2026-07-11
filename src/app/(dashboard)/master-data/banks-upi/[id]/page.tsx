"use client";

import { useState } from "react";
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
  QrCode,
  CreditCard,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";

interface Transaction {
  id: string;
  type: "inflow" | "outflow";
  ref_no: string;
  date: string;
  amount: number;
  mode: string;
  details: string;
  partyName: string;
}

interface BankAccount {
  id: string;
  type: "bank" | "upi";
  name: string;
  sub_label: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc: string | null;
  branch: string | null;
  upi_id: string | null;
  upi_provider: string | null;
  is_default: boolean;
  opening_balance: number;
  is_active: boolean;
}

interface BankAccountDetailResponse {
  account: BankAccount;
  transactions: Transaction[];
}

export default function BankAccountDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("transactions");

  const { data: detailData, isLoading, error } = useQuery<BankAccountDetailResponse>({
    queryKey: ["bank-account-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/banks-upi/${id}`);
      if (!res.ok) throw new Error("Failed to fetch account details");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[#64748B]">Loading account profile...</p>
        </div>
      </div>
    );
  }

  if (error || !detailData) {
    return (
      <div className="p-6 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h3 className="text-lg font-bold text-[#0F172A]">Error Loading Account</h3>
        <p className="text-sm text-[#64748B]">{error?.toString() || "Account not found"}</p>
        <button
          onClick={() => router.push("/master-data/banks-upi")}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-all cursor-pointer"
        >
          Back to Banks & UPI
        </button>
      </div>
    );
  }

  const { account, transactions } = detailData;

  // Compute rollups
  const totalTransactions = transactions.length;
  const totalOutflowVal = transactions
    .filter((t) => t.type === "outflow")
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const totalInflowVal = transactions
    .filter((t) => t.type === "inflow")
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  // Approximate balance based on opening balance - outflows + inflows
  const currentApproxBalance = Number(account.opening_balance || 0) + totalInflowVal - totalOutflowVal;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  const isBank = account.type === "bank";

  return (
    <div className="p-6 space-y-6">
      {/* Navigation breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-bold text-[#64748B] select-none">
        <Link href="/" className="hover:text-[#0F172A] transition-colors">
          Dashboard
        </Link>
        <ChevronRight size={12} />
        <span>Master Data</span>
        <ChevronRight size={12} />
        <Link href="/master-data/banks-upi" className="hover:text-[#0F172A] transition-colors">
          Banks & UPI
        </Link>
        <ChevronRight size={12} />
        <span className="text-[#0F172A]">{account.name}</span>
      </div>

      {/* Header card */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        {/* Subtle decorative background gradient */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 rounded-full blur-3xl -z-10" />

        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 font-black text-xl shadow-sm">
            {isBank ? <CreditCard size={24} /> : <QrCode size={24} />}
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black text-[#0F172A] tracking-tight">{account.name}</h1>
              {account.is_default && (
                <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-100 uppercase">
                  Default
                </span>
              )}
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                  account.type === "bank"
                    ? "bg-blue-50 text-blue-700 border-blue-100"
                    : "bg-[#FAF5FF] text-[#7C3AED] border-[#F3E8FF]"
                }`}
              >
                {account.type === "bank" ? "Bank Account" : "UPI Handle"}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                  account.is_active
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : "bg-red-50 text-red-700 border-red-100"
                }`}
              >
                {account.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#64748B] font-semibold">
              {account.sub_label && (
                <span className="text-sm font-medium text-[#475569]">{account.sub_label}</span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => router.push(`/master-data/banks-upi`)}
          className="h-10 px-4 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] text-[#475569] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <ArrowLeft size={14} /> Back to List
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-[#EEF2FF] rounded-lg text-[#6366F1] shrink-0">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] block font-bold uppercase tracking-wider">Book Balance</span>
            <span className="text-lg font-black text-[#1E293B]">{formatCurrency(currentApproxBalance)}</span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-[#F8FAFC] rounded-lg text-[#64748B] shrink-0">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] block font-bold uppercase tracking-wider">Opening Bal</span>
            <span className="text-lg font-black text-[#475569]">{formatCurrency(account.opening_balance)}</span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600 shrink-0">
            <ArrowUpRight className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] block font-bold uppercase tracking-wider">Total Inflows</span>
            <span className="text-lg font-black text-emerald-600">{formatCurrency(totalInflowVal)}</span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-rose-50 rounded-lg text-rose-600 shrink-0">
            <ArrowDownLeft className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] block font-bold uppercase tracking-wider">Total Outflows</span>
            <span className="text-lg font-black text-rose-600">{formatCurrency(totalOutflowVal)}</span>
          </div>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex gap-1 border-b border-[#E2E8F0] pb-px select-none">
        <button
          onClick={() => setActiveTab("transactions")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "transactions"
              ? "border-[#6366F1] text-[#6366F1]"
              : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          Transaction History ({totalTransactions})
        </button>
        <button
          onClick={() => setActiveTab("credentials")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "credentials"
              ? "border-[#6366F1] text-[#6366F1]"
              : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          Account Credentials
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "transactions" && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-bold text-[#475569] uppercase tracking-wider">
                  <th className="py-3 px-5 w-44">Date & Time</th>
                  <th className="py-3 px-5">Ref / Voucher No</th>
                  <th className="py-3 px-5">Party Details</th>
                  <th className="py-3 px-5">Description</th>
                  <th className="py-3 px-5 text-right w-44">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-sm text-[#334155]">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#64748B]">
                      No transactions recorded for this account.
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => {
                    const isOut = t.type === "outflow";
                    return (
                      <tr key={t.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="py-3.5 px-5 text-[#64748B] font-mono text-xs">
                          {new Date(t.date).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3.5 px-5 font-mono text-xs font-bold text-[#6366F1]">
                          {t.ref_no}
                        </td>
                        <td className="py-3.5 px-5 font-bold text-[#0F172A]">
                          {t.partyName}
                        </td>
                        <td className="py-3.5 px-5 text-xs font-semibold text-[#475569]">
                          {t.details}
                        </td>
                        <td
                          className={`py-3.5 px-5 text-right font-mono font-bold ${
                            isOut ? "text-rose-600" : "text-emerald-600"
                          }`}
                        >
                          {isOut ? "-" : "+"}
                          {formatCurrency(t.amount)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "credentials" && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-6 max-w-2xl">
          {isBank ? (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-[#0F172A] border-b border-[#F1F5F9] pb-3 uppercase tracking-wider">
                Bank Details & Credentials
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5 text-xs font-semibold">
                <div>
                  <span className="text-[#64748B] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                    Bank Name
                  </span>
                  <span className="text-sm text-[#1E293B]">{account.bank_name || "—"}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                    Branch Address / Location
                  </span>
                  <span className="text-sm text-[#1E293B]">{account.branch || "—"}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                    Account Number
                  </span>
                  <span className="text-sm text-[#1E293B] font-mono">{account.account_number || "—"}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                    IFSC Code
                  </span>
                  <span className="text-sm text-[#1E293B] font-mono">{account.ifsc || "—"}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-[#0F172A] border-b border-[#F1F5F9] pb-3 uppercase tracking-wider">
                UPI / Virtual Payment Address Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5 text-xs font-semibold">
                <div>
                  <span className="text-[#64748B] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                    UPI ID / VPA Handle
                  </span>
                  <span className="text-sm text-[#1E293B] font-mono">{account.upi_id || "—"}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                    UPI Service Provider / Gateway Bank
                  </span>
                  <span className="text-sm text-[#1E293B] uppercase">{account.upi_provider || "—"}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
