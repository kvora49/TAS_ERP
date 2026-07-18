"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";
import { useERPQuery } from "@/hooks/useERPQuery";
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

  // Import Modal States
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const [partiesList, setPartiesList] = useState<any[]>([]);
  const [designsList, setDesignsList] = useState<any[]>([]);

  const handleOpenImport = () => {
    setImportOpen(true);
    fetch("/api/parties?type=customer")
      .then((res) => res.json())
      .then((data) => setPartiesList(data.parties || []));
    fetch("/api/master-data/designs")
      .then((res) => res.json())
      .then((data) => setDesignsList(data.designs || []));
  };

  const downloadSampleTemplate = () => {
    const wsData = [
      {
        "Bill Type": "pakka",
        "Customer": "param",
        "Date": new Date().toISOString().split("T")[0],
        "Reference No": "REF-001",
        "Design": "DSN-001",
        "Colour": "black",
        "Size": "L",
        "Quantity": 100,
        "Rate": 250,
        "Discount %": 5,
        "Tax %": 18
      }
    ];
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "sales_bills_import_template.xlsx");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws);

        const rows = rawData.map((row: any, idx: number) => {
          const billType = String(row["Bill Type"] || "pakka").toLowerCase() === "kacha" ? "kacha" : "pakka";
          const customerName = String(row["Customer"] || "").trim();
          const designCode = String(row["Design"] || "").trim();
          const colourName = String(row["Colour"] || "").trim();

          const matchedParty = partiesList.find(p => p.name.toLowerCase() === customerName.toLowerCase());
          const matchedDesign = designsList.find(d => 
            String(d.design_number || "").toLowerCase() === designCode.toLowerCase() || 
            String(d.name || "").toLowerCase() === designCode.toLowerCase()
          );
          const matchedColour = matchedDesign?.design_colours?.find((c: any) => 
            String(c.colour_name || "").toLowerCase() === colourName.toLowerCase()
          ) || matchedDesign?.design_colours?.[0];

          return {
            rowNum: idx + 2,
            bill_type: billType,
            customerName,
            designCode,
            colourName,
            size: String(row["Size"] || "Free Size"),
            quantity: parseInt(row["Quantity"] || "0", 10),
            rate: parseFloat(row["Rate"] || "0"),
            discount_percent: parseFloat(row["Discount %"] || "0"),
            tax_percent: parseFloat(row["Tax %"] || "0"),
            reference_no: row["Reference No"] ? String(row["Reference No"]) : null,
            bill_date: row["Date"] ? String(row["Date"]) : new Date().toISOString().split("T")[0],
            party_id: matchedParty?.id || null,
            design_id: matchedDesign?.id || null,
            colour_id: matchedColour?.id || null,
            partyError: !matchedParty,
            designError: !matchedDesign,
          };
        });

        setImportPreview(rows);
      } catch (err: any) {
        toast.error("Failed to parse Excel file: " + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async () => {
    if (importPreview.length === 0) return;

    const hasErrors = importPreview.some(r => r.partyError || r.designError || !r.quantity || !r.rate);
    if (hasErrors) {
      toast.error("Please resolve all validation errors (unmatched customers/designs, empty quantities/rates) before importing!");
      return;
    }

    setImporting(true);
    setImportProgress(0);

    const grouped: Record<string, any> = {};
    importPreview.forEach((row) => {
      const key = `${row.bill_type}_${row.party_id}_${row.bill_date}_${row.reference_no || ""}`;
      if (!grouped[key]) {
        grouped[key] = {
          bill_type: row.bill_type,
          party_id: row.party_id,
          bill_date: row.bill_date,
          due_date: null,
          payment_terms: "30 days",
          reference_no: row.reference_no,
          discount_type: "flat",
          discount_value: 0,
          status: "active",
          items: [],
          charges: []
        };
      }
      grouped[key].items.push({
        design_id: row.design_id,
        colour_id: row.colour_id,
        size: row.size,
        quantity: row.quantity,
        rate: row.rate,
        discount_percent: row.discount_percent,
        tax_percent: row.tax_percent,
      });
    });

    const billsToImport = Object.values(grouped);
    let successCount = 0;

    for (let i = 0; i < billsToImport.length; i++) {
      try {
        const res = await fetch("/api/sales/bills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(billsToImport[i]),
        });
        if (res.ok) {
          successCount++;
        } else {
          const err = await res.json();
          console.error("Failed to import a bill:", err);
        }
      } catch (err) {
        console.error(err);
      }
      setImportProgress(Math.round(((i + 1) / billsToImport.length) * 100));
    }

    toast.success(`Successfully imported ${successCount} sales bills!`);
    setImporting(false);
    setImportOpen(false);
    setImportFile(null);
    setImportPreview([]);
    router.refresh();
  };

  // Data State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // UI state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeRowAction, setActiveRowAction] = useState<string | null>(null);

  // Build query key from all filters so React Query refetches automatically
  const queryKey = ["sales-bills", activeTab, page, limit, search, partyId, status, startDate, endDate];

  const { data: billsData, isPending: loading } = useERPQuery(
    queryKey,
    async () => {
      const params = new URLSearchParams({
        type: activeTab,
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(partyId && { party_id: partyId }),
        ...(status && { status }),
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
      });
      const res = await fetch(`/api/sales/bills?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load bills");
      return res.json();
    }
  );

  const { data: partiesData } = useERPQuery(["parties-customers"], async () => {
    const res = await fetch("/api/parties?type=customer");
    if (!res.ok) throw new Error("Failed to load customers");
    return (await res.json()).parties || [];
  });

  const bills: SaleBill[] = billsData?.data || [];
  const total: number = billsData?.meta?.total || 0;
  const parties: Party[] = partiesData || [];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
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
            onClick={handleOpenImport}
            className="px-4 py-2 border border-[#D1D5DB] rounded-lg text-sm font-semibold text-[#374151] bg-white hover:bg-[#F9FAFB] transition-colors cursor-pointer"
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
          value={total.toString()}
          icon={FileText}
          bgClass="bg-[#EEF2FF]"
          iconColor="text-[#6366F1]"
        />
        <StatCard
          title="Total Amount"
          value={formatCurrency(bills.reduce((s, b) => s + (b.grand_total || 0), 0))}
          icon={IndianRupee}
          bgClass="bg-[#EEF2FF]"
          iconColor="text-[#6366F1]"
        />
        <StatCard
          title="Paid Amount"
          value={formatCurrency(bills.reduce((s, b) => s + (b.paid_amount || 0), 0))}
          icon={CheckCircle2}
          bgClass="bg-[#F0FDF4]"
          iconColor="text-[#15803D]"
        />
        <StatCard
          title="Outstanding"
          value={formatCurrency(bills.reduce((s, b) => s + Math.max(0, (b.grand_total || 0) - (b.paid_amount || 0)), 0))}
          icon={Clock}
          bgClass="bg-[#FFFBEB]"
          iconColor="text-[#D97706]"
        />
        <StatCard
          title="Overdue Bills"
          value={bills.filter(b => b.payment_status === "overdue").length.toString()}
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

      {/* Import Bills Modal */}
      {importOpen && (
        <div className="fixed inset-0 bg-[#0F172A]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Import Sales Bills</h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">Upload Excel sheet to generate multiple bills instantly</p>
              </div>
              <button
                type="button"
                onClick={() => { setImportOpen(false); setImportFile(null); setImportPreview([]); }}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                &times;
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-700 block">Download Template</span>
                  <p className="text-xs text-slate-500 leading-normal">Start by downloading our formatted spreadsheet template.</p>
                </div>
                <button
                  type="button"
                  onClick={downloadSampleTemplate}
                  className="px-3 py-1.5 bg-slate-800 text-white font-bold text-xs rounded-lg hover:bg-slate-900 transition-colors flex items-center gap-1.5"
                >
                  <Download size={14} />
                  <span>Download template.xlsx</span>
                </button>
              </div>

              {/* Upload field */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">Select Excel/CSV File</label>
                <div className="relative border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-8 flex flex-col items-center justify-center gap-2 bg-slate-50/50 hover:bg-indigo-50/10 transition-all cursor-pointer">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="h-10 w-10 bg-indigo-50 text-[#6366F1] rounded-full flex items-center justify-center">
                    <Plus size={20} />
                  </div>
                  <span className="text-xs font-bold text-slate-700">
                    {importFile ? importFile.name : "Drag and drop or click to browse files"}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Excel or CSV files only</span>
                </div>
              </div>

              {/* Preview table */}
              {importPreview.length > 0 && (
                <div className="space-y-2">
                  <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">File Contents Preview & Validation ({importPreview.length} items parsed)</span>
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-mono text-[10px] text-slate-400 uppercase tracking-wider">
                          <th className="py-2.5 px-3">Row</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Customer</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Design</th>
                          <th className="py-2.5 px-3">Colour</th>
                          <th className="py-2.5 px-3">Qty</th>
                          <th className="py-2.5 px-3">Rate</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((row, idx) => (
                          <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50 font-medium">
                            <td className="py-2 px-3 text-slate-400 font-mono font-bold">{row.rowNum}</td>
                            <td className="py-2 px-3 capitalize font-bold">{row.bill_type}</td>
                            <td className="py-2 px-3">
                              <span className={row.partyError ? "text-red-500 font-bold underline decoration-dotted" : "text-slate-800"}>
                                {row.customerName}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600">{row.bill_date}</td>
                            <td className="py-2 px-3">
                              <span className={row.designError ? "text-red-500 font-bold underline decoration-dotted" : "text-indigo-600 font-bold font-mono"}>
                                {row.designCode}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-600">{row.colourName || "—"}</td>
                            <td className="py-2 px-3 font-mono">{row.quantity}</td>
                            <td className="py-2 px-3 font-mono">₹{row.rate}</td>
                            <td className="py-2 px-3 text-center">
                              {row.partyError || row.designError ? (
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-600">
                                  {row.partyError ? "No Customer" : "No Design"}
                                </span>
                              ) : (
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-600">
                                  OK
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Progress bar */}
              {importing && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                    <span>Importing sales bills...</span>
                    <span>{importProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full transition-all duration-300"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <button
                type="button"
                disabled={importing}
                onClick={() => { setImportOpen(false); setImportFile(null); setImportPreview([]); }}
                className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={importing || importPreview.length === 0}
                onClick={handleConfirmImport}
                className="px-5 py-2 bg-[#6366F1] hover:bg-[#4F46E5] disabled:bg-slate-200 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm"
              >
                {importing && <Loader2 size={14} className="animate-spin" />}
                <span>Confirm & Import Bills</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
