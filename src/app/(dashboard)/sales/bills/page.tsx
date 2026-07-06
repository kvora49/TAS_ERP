"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
  IndianRupee,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Filter,
  Calendar,
  User,
  Plus,
  ChevronDown,
  Loader2,
  ArrowUpDown,
  MoreVertical,
  Eye,
  Edit2,
  Download,
  Trash2,
  Share2
} from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { toast } from "sonner";

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ComponentType<any>;
  bgClass: string;
  iconColor: string;
}

function StatCard({ title, value, icon: Icon, bgClass, iconColor }: StatCardProps) {
  return (
    <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-sm flex items-center justify-between">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">{title}</span>
        <span className="text-xl font-bold text-[#0F172A]">{value}</span>
      </div>
      <div className={cn("p-3 rounded-lg", bgClass)}>
        <Icon className={cn("h-5 w-5", iconColor)} />
      </div>
    </div>
  );
}

// Utility to merge Tailwind classes
import { cn } from "@/lib/utils";

interface Party {
  id: string;
  name: string;
  company_name: string | null;
}

interface SaleBill {
  id: string;
  bill_number: string;
  bill_type: "pakka" | "kacha";
  bill_date: string;
  grand_total: number;
  paid_amount: number;
  payment_status: "unpaid" | "partial" | "paid" | "overdue";
  status: "draft" | "active" | "cancelled";
  party: {
    name: string;
    gstin: string | null;
  };
}

export default function SalesBillsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active Tab: 'pakka' or 'kacha'
  const [activeTab, setActiveTab] = useState<"pakka" | "kacha">("pakka");

  // Filters
  const [search, setSearch] = useState("");
  const [partyId, setPartyId] = useState("");
  const [status, setStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Data State
  const [bills, setBills] = useState<SaleBill[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({
    totalBills: 0,
    totalAmount: 0,
    paidAmount: 0,
    outstandingAmount: 0,
    overdueBills: 0
  });

  // UI state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeRowAction, setActiveRowAction] = useState<string | null>(null);

  // Fetch Parties (Customers) for filter
  useEffect(() => {
    fetch("/api/parties?type=customer")
      .then((res) => res.json())
      .then((data) => {
        if (data.parties) setParties(data.parties);
      })
      .catch((err) => console.error("Error loading customers:", err));
  }, []);

  // Fetch Bills
  const fetchBills = () => {
    setLoading(true);
    const params = new URLSearchParams({
      type: activeTab,
      page: page.toString(),
      limit: limit.toString(),
      search,
      party_id: partyId,
      status,
      start_date: startDate,
      end_date: endDate
    });

    fetch(`/api/sales/bills?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.bills) setBills(data.bills);
        if (data.total) setTotal(data.total);
        if (data.stats) setStats(data.stats);
      })
      .catch((err) => {
        console.error("Error fetching bills:", err);
        toast.error("Failed to load bills");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBills();
  }, [activeTab, page, limit, partyId, status, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchBills();
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(val);
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "paid":
        return "green";
      case "partial":
        return "orange";
      case "unpaid":
        return "red";
      case "overdue":
        return "red";
      default:
        return "gray";
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-[#6366F1] uppercase tracking-wider">Sales & Billing</span>
          <h1 className="text-2xl font-bold text-[#0F172A]">Sales Bills List</h1>
          <p className="text-sm text-[#64748B]">Manage all your sales bills (Pakka & Kacha)</p>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3 self-start md:self-auto relative">
          <button
            type="button"
            className="px-4 py-2 border border-[#D1D5DB] rounded-lg text-sm font-semibold text-[#374151] bg-white hover:bg-[#F9FAFB] transition-colors"
          >
            Import Bills
          </button>

          {/* Split Dropdown Button */}
          <div className="relative flex">
            <Link
              href={`/sales/bills/new?type=${activeTab}`}
              className="px-4 py-2 rounded-l-lg text-sm font-semibold text-white bg-[#6366F1] hover:bg-[#4F46E5] transition-colors flex items-center gap-2 border-r border-[#4F46E5]"
            >
              <Plus className="h-4 w-4" />
              <span>Create Sale Bill</span>
            </Link>
            <button
              onClick={() => setIsCreateOpen(!isCreateOpen)}
              className="px-2 py-2 rounded-r-lg text-white bg-[#6366F1] hover:bg-[#4F46E5] transition-colors"
            >
              <ChevronDown className="h-4 w-4" />
            </button>

            {isCreateOpen && (
              <div className="absolute right-0 top-11 w-48 rounded-lg border border-[#E5E7EB] bg-white shadow-lg z-30 overflow-hidden">
                <Link
                  href="/sales/bills/new?type=pakka"
                  onClick={() => setIsCreateOpen(false)}
                  className="block px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] text-left"
                >
                  Create Pakka Bill
                </Link>
                <Link
                  href="/sales/bills/new?type=kacha"
                  onClick={() => setIsCreateOpen(false)}
                  className="block px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] text-left"
                >
                  Create Kacha Bill
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#E5E7EB]">
        <nav className="flex gap-6 -mb-[1px]">
          <button
            onClick={() => {
              setActiveTab("pakka");
              setPage(1);
            }}
            className={cn(
              "pb-4 text-sm font-semibold border-b-2 transition-all px-1",
              activeTab === "pakka"
                ? "border-[#6366F1] text-[#6366F1]"
                : "border-transparent text-[#64748B] hover:text-[#374151]"
            )}
          >
            Pakka Bills
          </button>
          <button
            onClick={() => {
              setActiveTab("kacha");
              setPage(1);
            }}
            className={cn(
              "pb-4 text-sm font-semibold border-b-2 transition-all px-1",
              activeTab === "kacha"
                ? "border-[#6366F1] text-[#6366F1]"
                : "border-transparent text-[#64748B] hover:text-[#374151]"
            )}
          >
            Kacha Bills
          </button>
        </nav>
      </div>

      {/* 5 KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Bills"
          value={stats.totalBills.toString()}
          icon={FileText}
          bgClass="bg-[#EEF2FF]"
          iconColor="text-[#6366F1]"
        />
        <StatCard
          title="Total Amount"
          value={formatCurrency(stats.totalAmount)}
          icon={IndianRupee}
          bgClass="bg-[#EEF2FF]"
          iconColor="text-[#6366F1]"
        />
        <StatCard
          title="Paid Amount"
          value={formatCurrency(stats.paidAmount)}
          icon={CheckCircle2}
          bgClass="bg-[#F0FDF4]"
          iconColor="text-[#15803D]"
        />
        <StatCard
          title="Outstanding"
          value={formatCurrency(stats.outstandingAmount)}
          icon={Clock}
          bgClass="bg-[#FFFBEB]"
          iconColor="text-[#D97706]"
        />
        <StatCard
          title="Overdue Bills"
          value={stats.overdueBills.toString()}
          icon={AlertCircle}
          bgClass="bg-[#FEF2F2]"
          iconColor="text-[#DC2626]"
        />
      </div>

      {/* Filter and search bar */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm flex flex-col gap-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search by Bill Number, Reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 w-full rounded-lg border border-[#D1D5DB] text-sm focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] outline-none"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Party Select */}
            <div className="flex items-center gap-1.5 border border-[#D1D5DB] rounded-lg px-3 py-2 bg-white">
              <User className="h-4 w-4 text-[#64748B]" />
              <select
                value={partyId}
                onChange={(e) => {
                  setPartyId(e.target.value);
                  setPage(1);
                }}
                className="text-sm text-[#374151] font-medium bg-transparent border-0 outline-none p-0 focus:ring-0 focus:outline-none"
              >
                <option value="">All Customers</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Select */}
            <div className="flex items-center gap-1.5 border border-[#D1D5DB] rounded-lg px-3 py-2 bg-white">
              <Filter className="h-4 w-4 text-[#64748B]" />
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="text-sm text-[#374151] font-medium bg-transparent border-0 outline-none p-0 focus:ring-0 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>

            {/* Date range inputs */}
            <div className="flex items-center gap-2 border border-[#D1D5DB] rounded-lg px-3 py-1.5 bg-white">
              <Calendar className="h-4 w-4 text-[#64748B]" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="text-xs text-[#374151] font-medium border-0 outline-none p-0 focus:ring-0"
              />
              <span className="text-xs text-[#64748B]">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="text-xs text-[#374151] font-medium border-0 outline-none p-0 focus:ring-0"
              />
            </div>

            {/* Reset button */}
            {(search || partyId || status || startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPartyId("");
                  setStatus("");
                  setStartDate("");
                  setEndDate("");
                  setPage(1);
                }}
                className="text-xs font-semibold text-[#6366F1] hover:text-[#4F46E5]"
              >
                Reset Filters
              </button>
            )}
          </div>
        </form>

        {/* Table / List */}
        <div className="overflow-x-auto border border-[#E5E7EB] rounded-lg">
          <table className="min-w-full divide-y divide-[#E5E7EB] text-left">
            <thead className="bg-[#F9FAFB] text-xs font-semibold text-[#64748B] uppercase tracking-wider select-none">
              <tr>
                <th className="px-6 py-3.5">Bill Number</th>
                <th className="px-6 py-3.5">Bill Date</th>
                <th className="px-6 py-3.5">Customer / Party</th>
                <th className="px-6 py-3.5">Type</th>
                <th className="px-6 py-3.5">Total Amount</th>
                <th className="px-6 py-3.5">Paid</th>
                <th className="px-6 py-3.5">Outstanding</th>
                <th className="px-6 py-3.5">Payment Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] text-sm text-[#0F172A] bg-white">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-6 w-6 text-[#6366F1] animate-spin" />
                      <span className="text-xs text-[#64748B] font-semibold uppercase tracking-wider">Loading sales bills...</span>
                    </div>
                  </td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-[#64748B]">
                    No sales bills found matching the current filters.
                  </td>
                </tr>
              ) : (
                bills.map((bill) => {
                  const outstanding = bill.grand_total - bill.paid_amount;
                  return (
                    <tr key={bill.id} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-[#6366F1]">
                        <Link href={`/sales/bills/${bill.id}`} className="hover:underline">
                          {bill.bill_number}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {new Date(bill.bill_date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric"
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-[#1E293B]">{bill.party?.name}</span>
                          {bill.party?.gstin && (
                            <span className="text-[10px] text-[#64748B] font-bold">GST: {bill.party.gstin}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                            bill.bill_type === "pakka"
                              ? "bg-[#DCFCE7] text-[#15803D]"
                              : "bg-[#FEF3C7] text-[#D97706]"
                          )}
                        >
                          {bill.bill_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">
                        {formatCurrency(bill.grand_total)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-[#15803D]">
                        {formatCurrency(bill.paid_amount)}
                      </td>
                      <td
                        className={cn(
                          "px-6 py-4 whitespace-nowrap font-medium",
                          outstanding > 0 ? "text-[#DC2626]" : "text-[#64748B]"
                        )}
                      >
                        {formatCurrency(outstanding)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={getStatusVariant(bill.payment_status)}>
                          {bill.payment_status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right relative">
                        <button
                          onClick={() =>
                            setActiveRowAction(activeRowAction === bill.id ? null : bill.id)
                          }
                          className="p-1 rounded-md text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
                        >
                          <MoreVertical className="h-4.5 w-4.5" />
                        </button>

                        {activeRowAction === bill.id && (
                          <div className="absolute right-6 top-12 w-40 rounded-lg border border-[#E5E7EB] bg-white shadow-lg z-20 overflow-hidden text-left">
                            <Link
                              href={`/sales/bills/${bill.id}`}
                              className="px-4 py-2 text-xs text-[#374151] hover:bg-[#F9FAFB] flex items-center gap-2"
                            >
                              <Eye className="h-3.5 w-3.5 text-[#64748B]" />
                              <span>View Details</span>
                            </Link>
                            <Link
                              href={`/sales/bills/${bill.id}/edit`}
                              className="px-4 py-2 text-xs text-[#374151] hover:bg-[#F9FAFB] flex items-center gap-2"
                            >
                              <Edit2 className="h-3.5 w-3.5 text-[#64748B]" />
                              <span>Edit Bill</span>
                            </Link>
                            <Link
                              href={`/sales/bills/${bill.id}/print`}
                              className="px-4 py-2 text-xs text-[#374151] hover:bg-[#F9FAFB] flex items-center gap-2"
                            >
                              <Download className="h-3.5 w-3.5 text-[#64748B]" />
                              <span>Download PDF</span>
                            </Link>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between border-t border-[#F3F4F6] pt-4 select-none">
            <div className="text-xs text-[#64748B]">
              Showing <span className="font-semibold text-[#374151]">{(page - 1) * limit + 1}</span> to{" "}
              <span className="font-semibold text-[#374151]">
                {Math.min(page * limit, total)}
              </span>{" "}
              of <span className="font-semibold text-[#374151]">{total}</span> bills
            </div>

            <div className="flex items-center gap-4">
              {/* Limit dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[#64748B]">Per page:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(parseInt(e.target.value, 10));
                    setPage(1);
                  }}
                  className="text-xs border border-[#D1D5DB] rounded px-1.5 py-0.5 bg-white text-[#374151]"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              {/* Prev / Next */}
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1 rounded border border-[#D1D5DB] text-xs font-semibold hover:bg-[#F9FAFB] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  disabled={page * limit >= total}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1 rounded border border-[#D1D5DB] text-xs font-semibold hover:bg-[#F9FAFB] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
