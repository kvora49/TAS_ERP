"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DeleteBankAccountDialog } from "./_components/DeleteBankAccountDialog";
import { Badge } from "@/components/shared/Badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, RefreshCw, Star, Building2, Smartphone, Wallet } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

// Form validation schema
const accountSchema = z.object({
  type: z.enum(["bank", "upi", "cash"]),
  name: z.string().min(2, "Account Holder / Name is required"),
  account_category: z.enum(["pakka", "kacha", "both"]),
  sub_label: z.string().optional(),
  bank_name: z.string().optional(),
  account_number: z.string().optional(),
  ifsc: z.string().optional(),
  branch: z.string().optional(),
  upi_id: z.string().optional(),
  upi_provider: z.string().optional(),
  is_default: z.boolean(),
  opening_balance: z.string().optional(),
  is_active: z.boolean(),
});

type AccountFormValues = z.infer<typeof accountSchema>;

interface BankAccount {
  id: string;
  type: "bank" | "upi" | "cash";
  name: string;
  account_category: "pakka" | "kacha" | "both";
  sub_label: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc: string | null;
  branch: string | null;
  upi_id: string | null;
  upi_provider: string | null;
  is_default: boolean;
  opening_balance: number;
  current_balance?: number;
  is_active: boolean;
  updated_at: string;
}

export default function BanksUpiPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "bank" | "upi">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "pakka" | "kacha">("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<BankAccount | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      type: "bank",
      name: "",
      account_category: "pakka",
      sub_label: "",
      bank_name: "",
      account_number: "",
      ifsc: "",
      branch: "",
      upi_id: "",
      upi_provider: "GPay",
      is_default: false,
      opening_balance: "0",
      is_active: true,
    },
  });

  const selectedType = watch("type");
  const selectedCategory = watch("account_category");

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/master-data/banks-upi");
      if (!res.ok) throw new Error("Failed to load accounts");
      const result = await res.json();
      setAccounts(result.accounts || []);
    } catch (err: any) {
      toast.error(err.message || "Error fetching accounts list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleOpenAdd = (type: "bank" | "upi") => {
    setEditingAccount(null);
    reset({
      type,
      name: "",
      account_category: "pakka",
      sub_label: "",
      bank_name: "",
      account_number: "",
      ifsc: "",
      branch: "",
      upi_id: "",
      upi_provider: type === "upi" ? "GPay" : "",
      is_default: false,
      opening_balance: "0",
      is_active: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (account: BankAccount) => {
    setEditingAccount(account);
    reset({
      type: account.type,
      name: account.name,
      account_category: account.account_category || (account.type === "cash" ? "kacha" : "pakka"),
      sub_label: account.sub_label || "",
      bank_name: account.bank_name || "",
      account_number: account.account_number || "",
      ifsc: account.ifsc || "",
      branch: account.branch || "",
      upi_id: account.upi_id || "",
      upi_provider: account.upi_provider || "GPay",
      is_default: account.is_default,
      opening_balance: String(account.opening_balance || 0),
      is_active: account.is_active,
    });
    setModalOpen(true);
  };

  const onSubmit = async (values: AccountFormValues) => {
    try {
      const url = editingAccount
        ? `/api/master-data/banks-upi/${editingAccount.id}`
        : "/api/master-data/banks-upi";

      const method = editingAccount ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          updated_at: editingAccount?.updated_at,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save bank/upi account");
      }

      toast.success(
        editingAccount
          ? "Account updated successfully"
          : "Account created successfully"
      );
      setModalOpen(false);
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  };

  const handleOpenDelete = (account: BankAccount) => {
    setDeletingAccount(account);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingAccount) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/master-data/banks-upi/${deletingAccount.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete account");
      }

      toast.success("Account deleted successfully");
      setDeleteOpen(false);
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message || "An error occurred during deletion");
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredAccounts = accounts.filter((acc) => {
    const matchesSearch =
      acc.name.toLowerCase().includes(search.toLowerCase()) ||
      (acc.bank_name && acc.bank_name.toLowerCase().includes(search.toLowerCase())) ||
      (acc.upi_id && acc.upi_id.toLowerCase().includes(search.toLowerCase()));
    
    const matchesType = activeTab === "all" ? true : acc.type === activeTab;
    const matchesCategory =
      categoryFilter === "all"
        ? true
        : (acc.account_category || (acc.type === "cash" ? "kacha" : "pakka")) === categoryFilter;

    return matchesSearch && matchesType && matchesCategory;
  });

  const columns: DataTableColumn<BankAccount>[] = [
    {
      key: "type",
      header: "Type",
      width: "110px",
      render: (row) =>
        row.type === "bank" ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20">
            <Building2 size={12} /> Bank
          </span>
        ) : row.type === "upi" ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Smartphone size={12} /> UPI ID
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Wallet size={12} /> Cash
          </span>
        ),
    },
    {
      key: "account_category",
      header: "Nature",
      width: "135px",
      render: (row) => {
        const cat = row.account_category || (row.type === "cash" ? "kacha" : "pakka");
        if (cat === "pakka") {
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              🏷️ Pakka (Official)
            </span>
          );
        } else if (cat === "kacha") {
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              📝 Kaccha (Non-GST)
            </span>
          );
        } else {
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
              🔄 Both
            </span>
          );
        }
      },
    },
    {
      key: "name",
      header: "Account Display Name",
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-bold text-[var(--primary)] cursor-pointer">
            {row.name}
          </span>
          {row.is_default && (
            <Badge variant="primary" className="gap-1 flex items-center text-[9px] py-0">
              <Star size={8} className="fill-current" /> Default
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "details",
      header: "Payment Credentials",
      render: (row) => {
        if (row.type === "bank") {
          return (
            <div className="flex flex-col gap-0.5 font-mono text-xs">
              <span className="font-bold text-[var(--text-primary)]">
                {row.bank_name} · A/C {row.account_number}
              </span>
              <span className="text-[var(--text-muted)] text-[10px]">
                IFSC: {row.ifsc} {row.branch ? `· ${row.branch}` : ""}
              </span>
            </div>
          );
        } else if (row.type === "upi") {
          return (
            <div className="flex flex-col gap-0.5">
              <span className="font-bold font-mono text-xs text-[var(--text-primary)]">{row.upi_id}</span>
              <span className="text-[10px] font-semibold text-[var(--text-muted)]">{row.upi_provider || "UPI"} Channel</span>
            </div>
          );
        } else {
          return (
            <div className="flex flex-col gap-0.5">
              <span className="font-bold font-mono text-xs text-[var(--text-primary)]">{row.sub_label || "Cash Register"}</span>
              <span className="text-[10px] font-semibold text-[var(--text-muted)]">Physical Cash</span>
            </div>
          );
        }
      },
    },
    {
      key: "balance",
      header: "Current Balance",
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-bold font-mono text-sm text-[var(--text-primary)]">
            ₹{Number(row.current_balance ?? row.opening_balance ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] font-mono">
            Opening: ₹{Number(row.opening_balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge active={row.is_active} />,
    },
    {
      key: "actions",
      header: "Actions",
      width: "120px",
      render: (row) => (
        <div className="flex items-center gap-2 select-none">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenEdit(row);
            }}
            className="w-9 h-9 border border-[var(--border)] rounded-lg hover:bg-[var(--table-row-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer transition-all"
            title="Edit Credentials"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDelete(row);
            }}
            className="w-9 h-9 border border-rose-500/20 rounded-lg hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center cursor-pointer transition-all"
            title="Delete Credentials"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Banks & UPI"
        subtitle="Manage business bank accounts and UPI payment endpoints"
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Master Data" },
          { label: "Banks & UPI" },
        ]}
        searchPlaceholder="Search account or UPI..."
        searchValue={search}
        onSearch={setSearch}
      />

      {/* Tabs & Multi Action Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[var(--border)] pb-3">
        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Tab filters */}
          <div className="flex gap-1 bg-[var(--card-bg)] border border-[var(--border)] p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                activeTab === "all"
                  ? "bg-[var(--primary)] text-white shadow-xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setActiveTab("bank")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                activeTab === "bank"
                  ? "bg-[var(--primary)] text-white shadow-xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Banks
            </button>
            <button
              onClick={() => setActiveTab("upi")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                activeTab === "upi"
                  ? "bg-[var(--primary)] text-white shadow-xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              UPI IDs
            </button>
          </div>

          {/* Category filter pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Nature:</span>
            <div className="flex gap-1 bg-[var(--card-bg)] border border-[var(--border)] p-1 rounded-xl">
              <button
                onClick={() => setCategoryFilter("all")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                  categoryFilter === "all"
                    ? "bg-[var(--table-header-bg)] border border-[var(--border)] text-[var(--text-primary)] shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setCategoryFilter("pakka")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                  categoryFilter === "pakka"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-[var(--text-muted)] hover:text-indigo-500"
                }`}
              >
                🏷️ Pakka
              </button>
              <button
                onClick={() => setCategoryFilter("kacha")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                  categoryFilter === "kacha"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-[var(--text-muted)] hover:text-amber-500"
                }`}
              >
                📝 Kaccha
              </button>
            </div>
          </div>
        </div>

        {/* Dual Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenAdd("bank")}
            className="h-10 px-4 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-[var(--primary)] text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Building2 size={16} /> Add Bank Account
          </button>
          <button
            onClick={() => handleOpenAdd("upi")}
            className="h-10 px-4 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-[var(--primary)]/10"
          >
            <Smartphone size={16} /> Add UPI ID
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredAccounts}
        isLoading={loading}
        total={filteredAccounts.length}
        page={1}
        perPage={10}
        onPageChange={() => {}}
        onRowClick={(row) => router.push(`/master-data/banks-upi/${row.id}`)}
        emptyMessage="No bank or UPI configurations found for the active filter. Create one above."
      />

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-xl bg-[var(--card-bg)] rounded-xl shadow-[var(--modal-shadow)] border border-[var(--border)] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[var(--text-primary)]">
              {editingAccount
                ? `Edit ${selectedType === "bank" ? "Bank Account" : selectedType === "upi" ? "UPI ID" : "Cash Account"}`
                : `Add New ${selectedType === "bank" ? "Bank Account" : "UPI ID"}`}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {/* Split Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Type selector (disabled in edit mode) */}
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Account Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!!editingAccount}
                    onClick={() => setValue("type", "bank")}
                    className={`h-10 rounded-lg text-sm font-semibold border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      selectedType === "bank"
                        ? "bg-indigo-500/15 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold"
                        : "bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--text-body)] hover:bg-[var(--table-row-hover)]"
                    } disabled:opacity-70`}
                  >
                    <Building2 size={16} /> Bank Account
                  </button>
                  <button
                    type="button"
                    disabled={!!editingAccount}
                    onClick={() => setValue("type", "upi")}
                    className={`h-10 rounded-lg text-sm font-semibold border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      selectedType === "upi"
                        ? "bg-purple-500/15 border-purple-500 text-purple-600 dark:text-purple-400 font-bold"
                        : "bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--text-body)] hover:bg-[var(--table-row-hover)]"
                    } disabled:opacity-70`}
                  >
                    <Smartphone size={16} /> UPI ID
                  </button>
                </div>
              </div>

              {/* Account Category / Nature (Pakka vs Kaccha) */}
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Account Nature / Category *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setValue("account_category", "pakka")}
                    className={`h-12 px-3 rounded-lg text-xs font-bold border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                      selectedCategory === "pakka"
                        ? "bg-indigo-500/15 border-indigo-500 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500/20"
                        : "bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--text-body)] hover:bg-[var(--table-row-hover)]"
                    }`}
                  >
                    <span className="flex items-center gap-1 font-extrabold text-xs">🏷️ Pakka Account</span>
                    <span className="text-[9px] font-normal text-[var(--text-muted)]">Official / GST / Current A/C</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setValue("account_category", "kacha")}
                    className={`h-12 px-3 rounded-lg text-xs font-bold border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                      selectedCategory === "kacha"
                        ? "bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400 ring-2 ring-amber-500/20"
                        : "bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--text-body)] hover:bg-[var(--table-row-hover)]"
                    }`}
                  >
                    <span className="flex items-center gap-1 font-extrabold text-xs">📝 Kaccha Account</span>
                    <span className="text-[9px] font-normal text-[var(--text-muted)]">Savings / Shop UPI / Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setValue("account_category", "both")}
                    className={`h-12 px-3 rounded-lg text-xs font-bold border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer col-span-2 sm:col-span-1 ${
                      selectedCategory === "both"
                        ? "bg-slate-500/15 border-slate-500 text-slate-700 dark:text-slate-300 ring-2 ring-slate-500/20"
                        : "bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--text-body)] hover:bg-[var(--table-row-hover)]"
                    }`}
                  >
                    <span className="flex items-center gap-1 font-extrabold text-xs">🔄 Both / General</span>
                    <span className="text-[9px] font-normal text-[var(--text-muted)]">Combined Usage</span>
                  </button>
                </div>
              </div>

              {/* Display / Holder Name */}
              <div className="sm:col-span-2 space-y-1.5 font-bold">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Account Holder / Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. TAS Garments Pvt Ltd"
                  className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg text-sm transition-colors"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-xs font-semibold text-rose-500">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* Dynamic Bank Fields */}
              {selectedType === "bank" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Bank Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. HDFC Bank, ICICI"
                      className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg text-sm transition-colors"
                      {...register("bank_name")}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Account Number *
                    </label>
                    <input
                      type="text"
                      placeholder="Bank account number"
                      className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg text-sm font-mono transition-colors"
                      {...register("account_number")}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      IFSC Code *
                    </label>
                    <input
                      type="text"
                      placeholder="11-character IFSC"
                      className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg text-sm font-mono transition-colors"
                      {...register("ifsc")}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Branch Name
                    </label>
                    <input
                      type="text"
                      placeholder="Branch location"
                      className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg text-sm transition-colors"
                      {...register("branch")}
                    />
                  </div>
                </>
              )}

              {/* Dynamic UPI Fields */}
              {selectedType === "upi" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      UPI ID (VPA) *
                    </label>
                    <input
                      type="text"
                      placeholder="username@bank"
                      className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg text-sm font-mono transition-colors"
                      {...register("upi_id")}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      UPI Provider Channel
                    </label>
                    <select
                      className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg text-sm transition-colors cursor-pointer"
                      {...register("upi_provider")}
                    >
                      <option value="GPay">Google Pay (GPay)</option>
                      <option value="PhonePe">PhonePe</option>
                      <option value="Paytm">Paytm</option>
                      <option value="BHIM">BHIM UPI</option>
                      <option value="HDFC">HDFC Payzapp</option>
                    </select>
                  </div>
                </>
              )}

              {/* Shared Fields */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Opening Balance (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg text-sm transition-colors"
                  {...register("opening_balance")}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Billing Sub-label
                </label>
                <input
                  type="text"
                  placeholder="e.g. Primary Current A/C"
                  className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg text-sm transition-colors"
                  {...register("sub_label")}
                />
              </div>
            </div>

            {/* Default accounts toggles */}
            <div className="flex flex-col gap-2.5 pt-2 border-t border-[var(--border)]">
              {/* Default Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)]">Default Payment Option</h4>
                  <p className="text-[10px] text-[var(--text-muted)] font-medium leading-none mt-0.5">
                    Pre-selects this account/UPI on bills and ledgers.
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-4.5 w-4.5 text-[var(--primary)] focus:ring-[var(--primary)] border-[var(--input-border)] rounded cursor-pointer"
                  {...register("is_default")}
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)]">Active Status</h4>
                  <p className="text-[10px] text-[var(--text-muted)] font-medium leading-none mt-0.5">
                    Controls visibility in payment selector logs.
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-4.5 w-4.5 text-[var(--primary)] focus:ring-[var(--primary)] border-[var(--input-border)] rounded cursor-pointer"
                  {...register("is_active")}
                />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-[var(--border)] flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={isSubmitting}
                className="h-10 px-4 rounded-lg border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-sm font-semibold text-[var(--text-body)] transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-10 px-4 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-[var(--primary)]/10"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Credentials"
                )}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Bank Account Dialog */}
      <DeleteBankAccountDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        account={deletingAccount}
        allAccounts={accounts}
        onSuccess={fetchAccounts}
      />
    </div>
  );
}
