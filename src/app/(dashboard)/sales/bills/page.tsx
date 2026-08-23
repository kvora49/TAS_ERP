"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";
import { safeSheetToJson } from "@/lib/report-export";
import { useERPQuery, useERPMutation } from "@/hooks/useERPQuery";
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
  MoreVertical,
  Eye,
  Edit2,
  Download,
  Printer,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { DueDateBadge } from "@/components/shared/DueDateBadge";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";
import { Modal } from "@/components/shared/Modal";
import { MobileFilterSheet, MobileFilterField } from "@/components/shared/MobileFilterSheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { staggerContainer, cardVariants, hoverLift, tableRowVariants } from "@/lib/animations";

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ComponentType<any>;
  bgClass: string;
  iconColor: string;
}

function StatCard({ title, value, icon: Icon, bgClass, iconColor }: StatCardProps) {
  return (
    <motion.div
      variants={cardVariants}
      whileHover={hoverLift.hover}
      className="bg-[var(--card-bg)] p-5 rounded-xl border border-[var(--border)] shadow-[var(--shadow-sm)] flex items-center justify-between transition-shadow"
    >
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{title}</span>
        <span className="text-xl font-bold text-[var(--text-primary)]">{value}</span>
      </div>
      <div className={cn("p-3 rounded-lg", bgClass)}>
        <Icon className={cn("h-5 w-5", iconColor)} />
      </div>
    </motion.div>
  );
}

interface Party {
  id: string;
  name: string;
  company_name: string | null;
}

interface SaleBill {
  id: string;
  bill_number: string;
  bill_type: "pakka" | "kacha" | "return";
  bill_date: string;
  due_date?: string | null;
  grand_total: number;
  paid_amount: number;
  payment_status: "unpaid" | "partial" | "paid" | "overdue" | "settled";
  status: "draft" | "active" | "cancelled";
  is_temporary?: boolean;
  is_sales_return?: boolean;
  bill?: {
    id: string;
    bill_number: string;
    bill_date?: string;
  } | null;
  party: {
    name: string;
    gstin: string | null;
  };
}

import { useGeneralSettings } from "@/hooks/useGeneralSettings";

export default function SalesBillsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { enableKachaBilling, itemsPerPage } = useGeneralSettings();

  // Active Tab: 'pakka', 'kacha', 'return', 'all'
  const [activeTab, setActiveTab] = useState<"pakka" | "kacha" | "return" | "all">("pakka");

  // Filters
  const [search, setSearch] = useState("");
  const [partyId, setPartyId] = useState("");
  const [status, setStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Convert Temporary Bill States
  const [convertTargetBill, setConvertTargetBill] = useState<SaleBill | null>(null);
  const [converting, setConverting] = useState(false);

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
        const rawData = safeSheetToJson(ws);

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
  const [billToDelete, setBillToDelete] = useState<SaleBill | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const deleteMutation = useERPMutation(
    async (target: SaleBill) => {
      const endpoint = target.is_sales_return ? `/api/sales/returns/${target.id}` : `/api/sales/bills/${target.id}`;
      const res = await fetch(endpoint, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete record");
      }
      return res.json();
    },
    {
      successMessage: "Record deleted and stock & ledgers updated successfully!",
      invalidates: [
        ["sales-bills"],
        ["sales-returns"],
        ["parties-customers"],
        ["finished-stock"],
        ["designs-list"],
        ["design-detail-filters"],
        ["godowns-list"],
        ["dashboard-stats"],
        ["raw-materials-stock"],
        ["raw-materials"],
      ],
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setBillToDelete(null);
      },
    }
  );

  const handleDeleteClick = (e: React.MouseEvent, bill: SaleBill) => {
    e.stopPropagation();
    if (!bill.is_sales_return && (Number(bill.paid_amount || 0) > 0 || bill.payment_status === "paid" || bill.payment_status === "partial")) {
      toast.error(
        `Cannot delete bill ${bill.bill_number}: Payment of ${formatCurrency(bill.paid_amount)} has been received. Please reverse/delete payment allocations first.`,
        { duration: 5000 }
      );
      return;
    }
    setBillToDelete(bill);
    setDeleteDialogOpen(true);
  };

  const handleConvertClick = (e: React.MouseEvent, bill: SaleBill) => {
    e.stopPropagation();
    setConvertTargetBill(bill);
  };

  const handleConfirmConvert = async (targetType: "pakka" | "kacha") => {
    if (!convertTargetBill) return;
    setConverting(true);
    try {
      const res = await fetch(`/api/sales/bills/${convertTargetBill.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_bill_type: targetType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to convert bill");

      toast.success(json.message || "Converted to official invoice!");
      setConvertTargetBill(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setConverting(false);
    }
  };

  const queryKey = ["sales-bills", activeTab, page, limit, search, partyId, status, startDate, endDate];

  const { data: billsData, isPending: loading, isError, error, refetch } = useERPQuery(
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
          <span className="text-xs font-semibold text-[var(--primary)] uppercase tracking-wider">Sales & Billing</span>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Sales</h1>
          <p className="text-sm text-[var(--text-muted)]">Manage all your sales bills (Pakka & Kacha) and sales returns</p>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3 self-start md:self-auto relative">
          <button
            type="button"
            onClick={handleOpenImport}
            className="px-4 py-2 border border-[var(--border)] rounded-lg text-sm font-semibold text-[var(--text-body)] bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] transition-colors cursor-pointer"
          >
            Import Bills
          </button>

          <Link
            href="/sales/returns/new"
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Record Sales Return</span>
          </Link>

          {/* Create Bill Button */}
          {enableKachaBilling ? (
            <div className="relative flex">
              <Link
                href={`/sales/bills/new?type=${activeTab === "all" || activeTab === "return" ? "pakka" : activeTab}`}
                className="px-4 py-2 rounded-l-lg text-sm font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] transition-colors flex items-center gap-2 border-r border-[var(--primary-dark)]"
              >
                <Plus className="h-4 w-4" />
                <span>Create Sale Bill</span>
              </Link>
              <button
                onClick={() => setIsCreateOpen(!isCreateOpen)}
                className="px-2 py-2 rounded-r-lg text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] transition-colors cursor-pointer"
              >
                <ChevronDown className="h-4 w-4" />
              </button>

              {isCreateOpen && (
                <div className="absolute right-0 top-11 w-48 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] shadow-[var(--shadow-md)] z-30 overflow-hidden">
                  <Link
                    href="/sales/bills/new?type=pakka"
                    onClick={() => setIsCreateOpen(false)}
                    className="block px-4 py-2.5 text-sm text-[var(--text-body)] hover:bg-[var(--table-row-hover)] text-left"
                  >
                    Create Pakka Bill
                  </Link>
                  <Link
                    href="/sales/bills/new?type=kacha"
                    onClick={() => setIsCreateOpen(false)}
                    className="block px-4 py-2.5 text-sm text-[var(--text-body)] hover:bg-[var(--table-row-hover)] text-left"
                  >
                    Create Kacha Bill
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/sales/bills/new?type=pakka"
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] transition-colors flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>Create Sale Bill</span>
            </Link>
          )}
        </div>
      </div>

      {/* Tabs — desktop: underline nav; mobile: horizontal snap chip row */}
      <div className="border-b border-[var(--border)] hidden md:block">
        <nav className="flex gap-6 -mb-[1px]">
          {[
            { id: "pakka", label: "Pakka Bills" },
            ...(enableKachaBilling ? [{ id: "kacha", label: "Kacha Bills" }] : []),
            { id: "return", label: "Sales Returns" },
            { id: "all", label: "All Transactions" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as any); setPage(1); }}
                className={cn(
                  "relative pb-4 text-sm font-semibold transition-colors px-1 cursor-pointer",
                  isActive ? "text-[var(--primary)] font-bold" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                )}
              >
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="sales-bills-tab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--primary)]"
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Mobile Tab Chips */}
      <div className="md:hidden flex gap-2 overflow-x-auto pb-1 -mx-0 scrollbar-none">
        {["pakka", ...(enableKachaBilling ? ["kacha"] : []), "return", "all"].map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab as any); setPage(1); }}
            className={cn(
              "shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer whitespace-nowrap",
              activeTab === tab
                ? "bg-[var(--primary)] border-[var(--primary)] text-white"
                : "bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-muted)]"
            )}
          >
            {tab === "pakka" ? "Pakka Bills" : tab === "kacha" ? "Kacha Bills" : tab === "return" ? "Returns" : "All"}
          </button>
        ))}
      </div>

      <PageState
        isLoading={loading}
        isError={isError}
        error={error ? (error instanceof Error ? error.message : "Failed to load sales bills") : undefined}
        onRetry={refetch}
        isEmpty={bills.length === 0}
        emptyTitle="No Sales Bills Found"
        emptyMessage="No sales bills match your current active tab or search filter."
        emptyAction={
          <AsyncButton onClick={() => router.push(`/sales/bills/new?type=${activeTab}`)} variant="primary">
            + Create First Sale Bill
          </AsyncButton>
        }
        skeletonVariant="table"
        skeletonRows={8}
        skeletonColumns={9}
      >
        {/* Mobile: Snap-scroll stat card row */}
        <div className="md:hidden flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 -mx-4 px-4 scrollbar-none">
          {[
            { title: "Total",       value: total.toString(),                                                                                                icon: FileText,     bg: "bg-[var(--primary-light)]",  color: "text-[var(--primary)]" },
            { title: "Amount",      value: formatCurrency(bills.reduce((s,b)=>s+(b.grand_total||0),0)),                                                    icon: IndianRupee,  bg: "bg-[var(--primary-light)]",  color: "text-[var(--primary)]" },
            { title: "Paid",        value: formatCurrency(bills.reduce((s,b)=>s+(b.paid_amount||0),0)),                                                    icon: CheckCircle2, bg: "bg-green-500/10",             color: "text-green-500" },
            { title: "Outstanding", value: formatCurrency(bills.reduce((s,b)=>s+Math.max(0,(b.grand_total||0)-(b.paid_amount||0)),0)),                      icon: Clock,        bg: "bg-amber-500/10",             color: "text-amber-500" },
            { title: "Overdue",     value: bills.filter(b=>b.payment_status==="overdue").length.toString(),                                                 icon: AlertCircle,  bg: "bg-red-500/10",              color: "text-red-500" },
          ].map(({ title, value, icon: Icon, bg, color }) => (
            <div key={title} className="snap-start shrink-0 w-[148px] min-[430px]:w-[160px] bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3 shadow-[var(--shadow-sm)] flex items-center gap-2.5">
              <div className={cn("p-2 rounded-lg", bg)}>
                <Icon className={cn("h-4 w-4", color)} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider truncate">{title}</p>
                <p className={cn("text-sm font-bold mt-0.5 truncate", color)}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: existing 5-col stat grid — animated */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
        >
          <StatCard title="Total Bills" value={total.toString()} icon={FileText} bgClass="bg-[var(--primary-light)]" iconColor="text-[var(--primary)]" />
          <StatCard title="Total Amount" value={formatCurrency(bills.reduce((s, b) => s + (b.grand_total || 0), 0))} icon={IndianRupee} bgClass="bg-[var(--primary-light)]" iconColor="text-[var(--primary)]" />
          <StatCard title="Paid Amount" value={formatCurrency(bills.reduce((s, b) => s + (b.paid_amount || 0), 0))} icon={CheckCircle2} bgClass="bg-green-500/10" iconColor="text-green-500" />
          <StatCard title="Outstanding" value={formatCurrency(bills.reduce((s, b) => s + Math.max(0, (b.grand_total || 0) - (b.paid_amount || 0)), 0))} icon={Clock} bgClass="bg-amber-500/10" iconColor="text-amber-500" />
          <StatCard title="Overdue Bills" value={bills.filter(b => b.payment_status === "overdue").length.toString()} icon={AlertCircle} bgClass="bg-red-500/10" iconColor="text-red-500" />
        </motion.div>

        {/* Mobile: compact search bar + filter sheet trigger */}
        <div className="md:hidden flex gap-2 mb-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-faint)] pointer-events-none" />
            <input
              type="text"
              placeholder="Search bills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 h-10 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
            />
          </div>
          <MobileFilterSheet
            activeCount={[partyId, status, startDate, endDate].filter(Boolean).length}
            onClearAll={() => { setPartyId(""); setStatus(""); setStartDate(""); setEndDate(""); setPage(1); }}
          >
            <MobileFilterField label="Customer">
              <select
                value={partyId}
                onChange={(e) => { setPartyId(e.target.value); setPage(1); }}
                className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              >
                <option value="">All Customers</option>
                {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </MobileFilterField>
            <MobileFilterField label="Payment Status">
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              >
                <option value="">All Statuses</option>
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </MobileFilterField>
            <MobileFilterField label="Date From">
              <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              />
            </MobileFilterField>
            <MobileFilterField label="Date To">
              <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              />
            </MobileFilterField>
          </MobileFilterSheet>
        </div>

        {/* Desktop: existing filter bar — unchanged */}
        <div className="hidden md:block bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-5 shadow-[var(--shadow-sm)]">
          <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-[var(--text-faint)]" />
              <input type="text" placeholder="Search by Bill Number, Reference..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm focus:border-[var(--input-focus)] focus:ring-1 focus:ring-[var(--input-focus)] outline-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 border border-[var(--input-border)] rounded-lg px-3 py-2 bg-[var(--input-bg)]">
                <User className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                <select value={partyId} onChange={(e) => { setPartyId(e.target.value); setPage(1); }}
                  className="text-sm text-[var(--text-primary)] font-medium bg-transparent border-0 outline-none pl-1 pr-6 py-0.5 focus:ring-0 focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="">All Customers</option>
                  {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1.5 border border-[var(--input-border)] rounded-lg px-3 py-2 bg-[var(--input-bg)]">
                <Filter className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                  className="text-sm text-[var(--text-primary)] font-medium bg-transparent border-0 outline-none pl-1 pr-6 py-0.5 focus:ring-0 focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="">All Statuses</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
              <div className="flex items-center gap-2 border border-[var(--input-border)] rounded-lg px-3 py-1.5 bg-[var(--input-bg)]">
                <Calendar className="h-4 w-4 text-[var(--text-muted)]" />
                <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                  className="text-xs text-[var(--text-primary)] font-medium border-0 outline-none p-0 focus:ring-0 bg-transparent"
                />
                <span className="text-xs text-[var(--text-muted)]">to</span>
                <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                  className="text-xs text-[var(--text-primary)] font-medium border-0 outline-none p-0 focus:ring-0 bg-transparent"
                />
              </div>

              {(search || partyId || status || startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => { setSearch(""); setPartyId(""); setStatus(""); setStartDate(""); setEndDate(""); setPage(1); }}
                  className="text-xs font-semibold text-[var(--primary)] hover:underline cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </form>
        </div>{/* end desktop filter bar */}

        {/* Mobile: Card list (md:hidden) — ALL data preserved */}
        <div className="md:hidden space-y-3">
          {bills.map((bill) => {
            const isReturn = bill.is_sales_return;
            const outstanding = isReturn ? 0 : bill.grand_total - bill.paid_amount;
            const detailHref = isReturn ? `/sales/returns/${bill.id}` : `/sales/bills/${bill.id}`;
            const editHref = isReturn ? `/sales/returns/${bill.id}/edit` : `/sales/bills/${bill.id}/edit`;
            const printHref = isReturn ? `/sales/returns/${bill.id}/print` : `/sales/bills/${bill.id}/print`;
            const downloadHref = isReturn ? `/sales/returns/${bill.id}/print?autoDownload=true` : `/sales/bills/${bill.id}/print?autoDownload=true`;
            return (
              <div
                key={bill.id}
                className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden active:bg-[var(--table-row-hover)] transition-colors cursor-pointer"
                onClick={() => router.push(detailHref)}
              >
                {/* Header: Bill# + Status */}
                <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                  <Link href={detailHref} onClick={(e) => e.stopPropagation()}
                    className="font-mono font-black text-[var(--primary)] text-sm hover:underline"
                  >{bill.bill_number}</Link>
                  {isReturn ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/10 text-purple-500">CREDITED</span>
                  ) : bill.is_temporary ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/10 text-purple-600">TEMPORARY</span>
                  ) : (
                    <Badge variant={getStatusVariant(bill.payment_status)}>{bill.payment_status}</Badge>
                  )}
                </div>
                {/* Subheader: Party + Date */}
                <div className="flex items-center justify-between px-4 pb-2">
                  <span className="font-semibold text-[var(--text-primary)] text-sm truncate max-w-[60%]">{bill.party?.name}</span>
                  <span className="text-xs text-[var(--text-muted)] shrink-0">
                    {new Date(bill.bill_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </div>
                {/* Data Grid: Total / Paid / Due */}
                <div className="grid grid-cols-3 border-t border-[var(--border-light)] mx-4 py-2">
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Total</p>
                    <p className={cn("text-xs font-bold mt-0.5", isReturn ? "text-rose-500" : "text-[var(--text-primary)]")}>
                      {isReturn ? `- ${formatCurrency(bill.grand_total)}` : formatCurrency(bill.grand_total)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Paid</p>
                    <p className={cn("text-xs font-bold mt-0.5", isReturn ? "text-[var(--text-muted)]" : "text-green-500")}>
                      {isReturn ? "—" : formatCurrency(bill.paid_amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Due</p>
                    <p className={cn("text-xs font-bold mt-0.5", outstanding > 0 ? "text-red-500" : "text-[var(--text-muted)]")}>
                      {formatCurrency(outstanding)}
                    </p>
                  </div>
                </div>
                {/* Badge strip: Type + GSTIN + Orig Bill + Due Date Counter */}
                <div className="flex items-center flex-wrap gap-1.5 px-4 pb-2">
                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                    isReturn ? "bg-rose-500/10 text-rose-500" : bill.is_temporary ? "bg-purple-500/10 text-purple-600 border border-purple-200" :
                    bill.bill_type === "pakka" ? "bg-green-500/10 text-green-500" : "bg-amber-500/10 text-amber-500"
                  )}>
                    {isReturn ? "RETURN" : bill.is_temporary ? `${bill.bill_type.toUpperCase()} (TEMP)` : bill.bill_type}
                  </span>
                  {bill.party?.gstin && <span className="text-[10px] text-[var(--text-muted)] font-bold font-mono">GST: {bill.party.gstin}</span>}
                  {isReturn && bill.bill && (
                    <Link href={`/sales/bills/${bill.bill.id}`} onClick={(e) => e.stopPropagation()}
                      className="text-[10px] text-[var(--primary)] font-bold hover:underline"
                    >← {bill.bill.bill_number}</Link>
                  )}
                  {!isReturn && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <DueDateBadge dueDate={bill.due_date} isCompleted={bill.payment_status === "paid" || bill.payment_status === "settled"} type="bill" />
                    </div>
                  )}
                </div>
                {/* Action footer */}
                <div className="flex items-center gap-1.5 px-4 pb-3.5 border-t border-[var(--border-light)] pt-2" onClick={(e) => e.stopPropagation()}>
                  {bill.is_temporary && (
                    <button type="button" onClick={(e) => handleConvertClick(e, bill)}
                      className="px-2.5 py-1.5 rounded-lg border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                    ><CheckCircle2 size={11} /> Convert</button>
                  )}
                  <Link href={editHref} onClick={(e) => e.stopPropagation()}
                    className="flex-1 h-8 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] text-amber-500 flex items-center justify-center cursor-pointer" title="Edit"
                  ><Edit2 size={13} /></Link>
                  <Link href={printHref} onClick={(e) => e.stopPropagation()}
                    className="flex-1 h-8 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] text-amber-600 flex items-center justify-center cursor-pointer" title="Print"
                  ><Printer size={13} /></Link>
                  <Link href={downloadHref} onClick={(e) => e.stopPropagation()}
                    className="flex-1 h-8 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] text-emerald-500 flex items-center justify-center cursor-pointer" title="PDF"
                  ><Download size={13} /></Link>
                  <button type="button" onClick={(e) => handleDeleteClick(e, bill)}
                    className="flex-1 h-8 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] text-red-500 flex items-center justify-center cursor-pointer" title="Delete"
                  ><Trash2 size={13} /></button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop table wrapper — hidden on mobile */}
        <div className="hidden md:block overflow-x-auto border border-[var(--border)] rounded-lg">
            <table className="min-w-full divide-y divide-[var(--border)] text-left">
              <thead className="bg-[var(--table-header-bg)] text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider select-none">
                <tr>
                  <th className="px-6 py-3.5 w-[170px] whitespace-nowrap">Bill Number</th>
                  {(activeTab === "return" || activeTab === "all") && (
                    <th className="px-6 py-3.5 whitespace-nowrap">Orig. Sales Bill</th>
                  )}
                  <th className="px-6 py-3.5 whitespace-nowrap">Bill Date</th>
                  <th className="px-6 py-3.5 whitespace-nowrap">Customer / Party</th>
                  <th className="px-6 py-3.5 whitespace-nowrap">Type</th>
                  <th className="px-6 py-3.5 whitespace-nowrap">Total Amount</th>
                  <th className="px-6 py-3.5 whitespace-nowrap">Paid</th>
                  <th className="px-6 py-3.5 whitespace-nowrap">Outstanding</th>
                  <th className="px-6 py-3.5 whitespace-nowrap">Payment Status</th>
                  <th className="px-6 py-3.5 whitespace-nowrap">Due Counter</th>
                  <th className="px-6 py-3.5 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-sm text-[var(--text-primary)] bg-[var(--card-bg)]">
                {bills.map((bill) => {
                  const isReturn = bill.is_sales_return;
                  const outstanding = isReturn ? 0 : bill.grand_total - bill.paid_amount;
                  const detailHref = isReturn ? `/sales/returns/${bill.id}` : `/sales/bills/${bill.id}`;
                  const editHref = isReturn ? `/sales/returns/${bill.id}/edit` : `/sales/bills/${bill.id}/edit`;
                  const printHref = isReturn ? `/sales/returns/${bill.id}/print` : `/sales/bills/${bill.id}/print`;
                  const downloadHref = isReturn ? `/sales/returns/${bill.id}/print?autoDownload=true` : `/sales/bills/${bill.id}/print?autoDownload=true`;

                  return (
                    <motion.tr
                      key={bill.id}
                      variants={tableRowVariants}
                      initial="initial"
                      animate="animate"
                      onClick={() => router.push(detailHref)}
                      className="hover:bg-[var(--table-row-hover)] transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 font-mono font-bold text-[var(--primary)] whitespace-nowrap">
                        <Link href={detailHref} onClick={(e) => e.stopPropagation()} className="hover:underline">
                          {bill.bill_number}
                        </Link>
                      </td>
                      {(activeTab === "return" || activeTab === "all") && (
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-xs font-semibold">
                          {isReturn ? (
                            bill.bill ? (
                              <Link
                                href={`/sales/bills/${bill.bill.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-[var(--primary)] hover:underline font-bold"
                              >
                                {bill.bill.bill_number}
                              </Link>
                            ) : (
                              <span className="text-[var(--text-faint)] italic">Direct Return</span>
                            )
                          ) : (
                            <span className="text-[var(--text-muted)]">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-[var(--text-body)]">
                        {new Date(bill.bill_date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric"
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-[var(--text-primary)]">{bill.party?.name}</span>
                          {bill.party?.gstin && (
                            <span className="text-[10px] text-[var(--text-muted)] font-bold">GST: {bill.party.gstin}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                            isReturn
                              ? "bg-rose-500/10 text-rose-500"
                              : bill.is_temporary
                              ? "bg-purple-500/10 text-purple-600 border border-purple-200 font-extrabold"
                              : bill.bill_type === "pakka"
                              ? "bg-green-500/10 text-green-500"
                              : "bg-amber-500/10 text-amber-500"
                          )}
                        >
                          {isReturn
                            ? "RETURN"
                            : bill.is_temporary
                            ? `${bill.bill_type.toUpperCase()} (TEMPORARY)`
                            : bill.bill_type}
                        </span>
                      </td>
                      <td className={cn("px-6 py-4 whitespace-nowrap font-medium", isReturn ? "text-rose-500 font-bold" : "text-[var(--text-primary)]")}>
                        {isReturn ? `- ${formatCurrency(bill.grand_total)}` : formatCurrency(bill.grand_total)}
                      </td>
                      <td className={cn("px-6 py-4 whitespace-nowrap font-medium", isReturn ? "text-[var(--text-muted)]" : "text-green-500")}>
                        {isReturn ? "-" : formatCurrency(bill.paid_amount)}
                      </td>
                      <td
                        className={cn(
                          "px-6 py-4 whitespace-nowrap font-medium",
                          outstanding > 0 ? "text-red-500" : "text-[var(--text-muted)]"
                        )}
                      >
                        {formatCurrency(outstanding)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isReturn ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/10 text-purple-500">
                            CREDITED
                          </span>
                        ) : bill.is_temporary ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/10 text-purple-600">
                            TEMPORARY
                          </span>
                        ) : (
                          <Badge variant={getStatusVariant(bill.payment_status)}>
                            {bill.payment_status}
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {!isReturn && (
                          <DueDateBadge
                            dueDate={bill.due_date}
                            isCompleted={bill.payment_status === "paid" || bill.payment_status === "settled"}
                            type="bill"
                          />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {/* Convert Action Button for Temporary Bills */}
                          {bill.is_temporary && (
                            <button
                              type="button"
                              onClick={(e) => handleConvertClick(e, bill)}
                              className="px-2.5 py-1 rounded-lg border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                              title="Convert Temporary Bill to Official Invoice"
                            >
                              <CheckCircle2 size={13} className="text-purple-600" />
                              <span>Convert</span>
                            </button>
                          )}

                          {/* Edit */}
                          <Link
                            href={editHref}
                            onClick={(e) => e.stopPropagation()}
                            className="w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] hover:bg-[var(--table-row-hover)] text-amber-500 flex items-center justify-center transition-all cursor-pointer"
                            title={isReturn ? "Edit Sales Return" : "Edit Bill"}
                          >
                            <Edit2 size={14} />
                          </Link>

                          {/* Print */}
                          <Link
                            href={printHref}
                            onClick={(e) => e.stopPropagation()}
                            className="w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] hover:bg-amber-500/10 text-amber-600 flex items-center justify-center transition-all cursor-pointer"
                            title={isReturn ? "Print Return Memo" : "Print Bill"}
                          >
                            <Printer size={14} />
                          </Link>

                          {/* Download PDF */}
                          <Link
                            href={downloadHref}
                            onClick={(e) => e.stopPropagation()}
                            className="w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] hover:bg-emerald-500/10 text-emerald-500 flex items-center justify-center transition-all cursor-pointer"
                            title="Download PDF"
                          >
                            <Download size={14} />
                          </Link>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteClick(e, bill)}
                            className="w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] hover:bg-red-500/10 text-red-500 flex items-center justify-center transition-all cursor-pointer"
                            title={isReturn ? "Delete Sales Return" : "Delete Sales Bill"}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>{/* end desktop table */}


          {/* Pagination footer */}
          {!loading && total > 0 && (
            <div className="flex items-center justify-between border-t border-[var(--border)] pt-4 select-none">
              <div className="text-xs text-[var(--text-muted)]">
                Showing <span className="font-semibold text-[var(--text-primary)]">{(page - 1) * limit + 1}</span> to{" "}
                <span className="font-semibold text-[var(--text-primary)]">
                  {Math.min(page * limit, total)}
                </span>{" "}
                of <span className="font-semibold text-[var(--text-primary)]">{total}</span> bills
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[var(--text-muted)]">Per page:</span>
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(parseInt(e.target.value, 10));
                      setPage(1);
                    }}
                    className="text-xs border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded pl-2 pr-6 py-1 font-semibold cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    className="px-3 py-1 rounded border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--table-row-hover)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page * limit >= total}
                    onClick={() => setPage(page + 1)}
                    className="px-3 py-1 rounded border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--table-row-hover)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
      </PageState>


      {/* Import Bills Shared Modal */}
      <Modal
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import Sales Bills"
        maxWidth="max-w-4xl"
      >
        <div className="space-y-6 pt-2">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-4 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl">
            <div className="space-y-1">
              <span className="text-xs font-bold text-[var(--text-primary)] block">Download Template</span>
              <p className="text-xs text-[var(--text-muted)] leading-normal">Start by downloading our formatted spreadsheet template.</p>
            </div>
            <button
              type="button"
              onClick={downloadSampleTemplate}
              className="px-3 py-1.5 bg-[var(--primary)] text-white font-bold text-xs rounded-lg hover:bg-[var(--primary-dark)] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download size={14} />
              <span>Download template.xlsx</span>
            </button>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">Select Excel/CSV File</label>
            <div className="relative border-2 border-dashed border-[var(--border)] hover:border-[var(--primary)] rounded-xl p-8 flex flex-col items-center justify-center gap-2 bg-[var(--page-bg)] transition-all cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="h-10 w-10 bg-[var(--primary-light)] text-[var(--primary)] rounded-full flex items-center justify-center">
                <Plus size={20} />
              </div>
              <span className="text-xs font-bold text-[var(--text-primary)]">
                {importFile ? importFile.name : "Drag and drop or click to browse files"}
              </span>
              <span className="text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-widest">Excel or CSV files only</span>
            </div>
          </div>

          {importPreview.length > 0 && (
            <div className="space-y-2">
              <span className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">File Contents Preview & Validation ({importPreview.length} items parsed)</span>
              <div className="border border-[var(--border)] rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
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
                  <tbody className="divide-y divide-[var(--border)]">
                    {importPreview.map((row, idx) => (
                      <tr key={idx} className="hover:bg-[var(--table-row-hover)] font-medium">
                        <td className="py-2 px-3 text-[var(--text-faint)] font-mono font-bold">{row.rowNum}</td>
                        <td className="py-2 px-3 capitalize font-bold text-[var(--text-primary)]">{row.bill_type}</td>
                        <td className="py-2 px-3">
                          <span className={row.partyError ? "text-red-500 font-bold underline decoration-dotted" : "text-[var(--text-primary)]"}>
                            {row.customerName}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-[var(--text-muted)]">{row.bill_date}</td>
                        <td className="py-2 px-3">
                          <span className={row.designError ? "text-red-500 font-bold underline decoration-dotted" : "text-[var(--primary)] font-bold font-mono"}>
                            {row.designCode}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[var(--text-muted)]">{row.colourName || "—"}</td>
                        <td className="py-2 px-3 font-mono text-[var(--text-primary)]">{row.quantity}</td>
                        <td className="py-2 px-3 font-mono text-[var(--text-primary)]">₹{row.rate}</td>
                        <td className="py-2 px-3 text-center">
                          {row.partyError || row.designError ? (
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/10 text-red-500">
                              {row.partyError ? "No Customer" : "No Design"}
                            </span>
                          ) : (
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-500/10 text-green-500">
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

          {importing && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-bold text-[var(--text-primary)]">
                <span>Importing sales bills...</span>
                <span>{importProgress}%</span>
              </div>
              <div className="w-full bg-[var(--page-bg)] h-2 rounded-full overflow-hidden border border-[var(--border)]">
                <div
                  className="bg-[var(--primary)] h-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-[var(--border)] flex items-center justify-between">
            <button
              type="button"
              disabled={importing}
              onClick={() => { setImportOpen(false); setImportFile(null); setImportPreview([]); }}
              className="px-4 py-2 border border-[var(--border)] text-[var(--text-muted)] font-bold text-xs rounded-xl hover:bg-[var(--table-row-hover)] cursor-pointer"
            >
              Cancel
            </button>
            <AsyncButton
              type="button"
              isLoading={importing}
              disabled={importing || importPreview.length === 0}
              onClick={handleConfirmImport}
              variant="primary"
              className="px-5 py-2 text-xs font-bold"
            >
              Confirm & Import Bills
            </AsyncButton>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Confirm Sales Bill Deletion"
        description={`Are you sure you want to delete sales bill '${billToDelete?.bill_number}'?`}
        maxWidth="max-w-md"
      >
        <div className="space-y-4 pt-2">
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 text-xs font-semibold space-y-1">
            <p className="font-bold">⚠️ Automatic Multi-Module Reversal</p>
            <p className="mt-1">Deleting this unpaid invoice will automatically:</p>
            <ul className="list-disc pl-4 space-y-0.5 mt-1 font-medium">
              <li>Restore finished goods inventory to specified godowns</li>
              <li>Record stock ledger cancellation entries</li>
              <li>Deduct ₹{billToDelete?.grand_total} from customer balance</li>
              <li>Revert linked Sales Order booking status (if applicable)</li>
            </ul>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(false)}
              className="px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-xs font-bold text-[var(--text-body)] hover:bg-[var(--page-bg)] cursor-pointer"
            >
              Cancel
            </button>
            <AsyncButton
              variant="destructive"
              onClick={async () => {
                if (billToDelete) {
                  await deleteMutation.mutateAsync(billToDelete);
                }
              }}
            >
              Delete Sales Bill
            </AsyncButton>
          </div>
        </div>
      </Modal>

      {/* Convert Temporary Bill Modal */}
      <Modal
        open={!!convertTargetBill}
        onOpenChange={(open) => !open && setConvertTargetBill(null)}
        title="Convert Temporary Bill to Official Invoice"
        description="Select the official invoice type to assign a sequential bill number and trigger stock & account ledgers."
        maxWidth="max-w-md"
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-[var(--text-body)]">
            Converting temporary bill <strong className="font-mono text-[var(--primary)]">{convertTargetBill?.bill_number}</strong> will convert it into a posted official bill.
          </p>

          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--text-primary)]">Select Official Bill Type:</label>
            <div className={cn("grid gap-3", enableKachaBilling ? "grid-cols-2" : "grid-cols-1")}>
              <button
                type="button"
                onClick={() => handleConfirmConvert("pakka")}
                disabled={converting}
                className="p-3 border border-green-200 bg-green-50/50 hover:bg-green-100 rounded-xl text-left font-bold text-xs text-green-800 transition-all cursor-pointer flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span>PAKKA (Tax Invoice)</span>
                  {converting && <Loader2 className="h-3 w-3 animate-spin text-green-600" />}
                </div>
                <span className="text-[10px] font-normal text-green-600">Assigns INV-YYYY-MM-XXX</span>
              </button>

              {enableKachaBilling && (
                <button
                  type="button"
                  onClick={() => handleConfirmConvert("kacha")}
                  disabled={converting}
                  className="p-3 border border-amber-200 bg-amber-50/50 hover:bg-amber-100 rounded-xl text-left font-bold text-xs text-amber-800 transition-all cursor-pointer flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <span>KACHA (Estimate)</span>
                    {converting && <Loader2 className="h-3 w-3 animate-spin text-amber-600" />}
                  </div>
                  <span className="text-[10px] font-normal text-amber-600">Assigns KAC-YYYY-MM-XXX</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end pt-2">
            <button
              type="button"
              disabled={converting}
              onClick={() => setConvertTargetBill(null)}
              className="px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-xs font-bold text-[var(--text-body)] hover:bg-[var(--page-bg)] cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
