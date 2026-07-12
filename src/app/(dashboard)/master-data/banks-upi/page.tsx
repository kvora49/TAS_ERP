"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/shared/Badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, RefreshCw, Star, Building2, Smartphone } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

// Form validation schema
const accountSchema = z.object({
  type: z.enum(["bank", "upi"]),
  name: z.string().min(2, "Account Holder / Name is required"),
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
  updated_at: string;
}

export default function BanksUpiPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "bank" | "upi">("all");

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
    
    if (activeTab === "all") return matchesSearch;
    return acc.type === activeTab && matchesSearch;
  });

  const columns: DataTableColumn<BankAccount>[] = [
    {
      key: "type",
      header: "Type",
      width: "120px",
      render: (row) =>
        row.type === "bank" ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-[#DBEAFE] text-[#1D4ED8]">
            <Building2 size={12} /> Bank
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-[#EDE9FE] text-[#7C3AED]">
            <Smartphone size={12} /> UPI ID
          </span>
        ),
    },
    {
      key: "name",
      header: "Account Display Name",
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#6366F1] hover:underline cursor-pointer">
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
              <span className="font-bold text-[#374151]">
                {row.bank_name} · A/C {row.account_number}
              </span>
              <span className="text-[#64748B] text-[10px]">
                IFSC: {row.ifsc} {row.branch ? `· ${row.branch}` : ""}
              </span>
            </div>
          );
        } else {
          return (
            <div className="flex flex-col gap-0.5">
              <span className="font-bold font-mono text-xs text-[#374151]">{row.upi_id}</span>
              <span className="text-[10px] font-semibold text-[#64748B]">{row.upi_provider || "UPI"} Channel</span>
            </div>
          );
        }
      },
    },
    {
      key: "balance",
      header: "Opening Balance",
      render: (row) => (
        <span className="font-bold font-mono text-xs">
          ₹{row.opening_balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </span>
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
            className="w-9 h-9 border border-[#E5E7EB] rounded-lg hover:bg-[#F1F5F9] text-[#6B7280] flex items-center justify-center cursor-pointer transition-all"
            title="Edit Credentials"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDelete(row);
            }}
            className="w-9 h-9 border border-[#FEE2E2] rounded-lg hover:bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center cursor-pointer transition-all"
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-2">
        {/* Tab filters */}
        <div className="flex gap-1.5 bg-[#E2E8F0]/60 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("all")}
            className="px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all bg-white text-[#0F172A] shadow-sm"
          >
            All Accounts
          </button>
          <button
            onClick={() => setActiveTab("bank")}
            className="px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all text-[#64748B] hover:text-[#0F172A]"
          >
            Bank Accounts
          </button>
          <button
            onClick={() => setActiveTab("upi")}
            className="px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all text-[#64748B] hover:text-[#0F172A]"
          >
            UPI IDs
          </button>
        </div>

        {/* Dual Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenAdd("bank")}
            className="h-10 px-4 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] text-[#6366F1] text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Building2 size={16} /> Add Bank Account
          </button>
          <button
            onClick={() => handleOpenAdd("upi")}
            className="h-10 px-4 rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-[#6366F1]/10"
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
        emptyMessage="No bank or UPI configurations found for the active tab. Create one above."
      />

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg bg-white rounded-xl shadow-lg border border-[#E5E7EB] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0F172A]">
              {editingAccount
                ? `Edit ${selectedType === "bank" ? "Bank Account" : "UPI ID"}`
                : `Add New ${selectedType === "bank" ? "Bank Account" : "UPI ID"}`}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {/* Split Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Type selector (disabled in edit mode) */}
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Account Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!!editingAccount}
                    onClick={() => setValue("type", "bank")}
                    className={`h-10 rounded-lg text-sm font-semibold border flex items-center justify-center gap-2 transition-all ${
                      selectedType === "bank"
                        ? "bg-[#DBEAFE] border-[#1D4ED8] text-[#1D4ED8]"
                        : "bg-white border-[#D1D5DB] text-[#475569] hover:bg-[#F8FAFC]"
                    } disabled:opacity-70`}
                  >
                    <Building2 size={16} /> Bank Account
                  </button>
                  <button
                    type="button"
                    disabled={!!editingAccount}
                    onClick={() => setValue("type", "upi")}
                    className={`h-10 rounded-lg text-sm font-semibold border flex items-center justify-center gap-2 transition-all ${
                      selectedType === "upi"
                        ? "bg-[#EDE9FE] border-[#7C3AED] text-[#7C3AED]"
                        : "bg-white border-[#D1D5DB] text-[#475569] hover:bg-[#F8FAFC]"
                    } disabled:opacity-70`}
                  >
                    <Smartphone size={16} /> UPI ID
                  </button>
                </div>
              </div>

              {/* Display / Holder Name */}
              <div className="sm:col-span-2 space-y-1.5 font-bold">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Account Holder / Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. TAS Garments Pvt Ltd"
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-xs font-semibold text-[#DC2626]">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* Dynamic Bank Fields */}
              {selectedType === "bank" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                      Bank Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. HDFC Bank, ICICI"
                      className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                      {...register("bank_name")}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                      Account Number *
                    </label>
                    <input
                      type="text"
                      placeholder="Bank account number"
                      className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all font-mono"
                      {...register("account_number")}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                      IFSC Code *
                    </label>
                    <input
                      type="text"
                      placeholder="11-character IFSC"
                      className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all font-mono"
                      {...register("ifsc")}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                      Branch Name
                    </label>
                    <input
                      type="text"
                      placeholder="Branch location"
                      className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                      {...register("branch")}
                    />
                  </div>
                </>
              )}

              {/* Dynamic UPI Fields */}
              {selectedType === "upi" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                      UPI ID (VPA) *
                    </label>
                    <input
                      type="text"
                      placeholder="username@bank"
                      className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all font-mono"
                      {...register("upi_id")}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                      UPI Provider Channel
                    </label>
                    <select
                      className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all cursor-pointer"
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
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Opening Balance (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                  {...register("opening_balance")}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Billing Sub-label
                </label>
                <input
                  type="text"
                  placeholder="e.g. Primary Current A/C"
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                  {...register("sub_label")}
                />
              </div>
            </div>

            {/* Default accounts toggles */}
            <div className="flex flex-col gap-2.5 pt-2 border-t border-[#F3F4F6]">
              {/* Default Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A]">Default Payment Option</h4>
                  <p className="text-[10px] text-[#64748B] font-medium leading-none mt-0.5">
                    Pre-selects this account/UPI on bills and ledgers.
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-4.5 w-4.5 text-[#6366F1] focus:ring-[#6366F1] border-gray-300 rounded cursor-pointer"
                  {...register("is_default")}
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A]">Active Status</h4>
                  <p className="text-[10px] text-[#64748B] font-medium leading-none mt-0.5">
                    Controls visibility in payment selector logs.
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-4.5 w-4.5 text-[#6366F1] focus:ring-[#6366F1] border-gray-300 rounded cursor-pointer"
                  {...register("is_active")}
                />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-[#F3F4F6] flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={isSubmitting}
                className="h-10 px-4 rounded-lg border border-[#E5E7EB] hover:bg-[#F1F5F9] text-sm font-semibold text-[#374151] transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-10 px-4 rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-[#6366F1]/10"
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

      {/* Confirm Soft Delete */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Payment Option?"
        description={`Are you sure you want to delete payment account "${deletingAccount?.name}"? Previous transactions will retain integrity, but new bills cannot target this account.`}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
