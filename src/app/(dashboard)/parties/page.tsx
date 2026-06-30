"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge, BadgeVariant } from "@/components/shared/Badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Plus, Search, FileText, Pencil, Trash2, Users, Briefcase, UserCheck } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Party {
  id: string;
  code: string;
  name: string;
  company_name: string | null;
  type: string[];
  phone: string | null;
  gstin: string | null;
  status: string;
  opening_balance: number;
}

export default function PartiesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "supplier" | "customer" | "worker">("all");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingParty, setDeletingParty] = useState<Party | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data: partiesData, isLoading: partiesLoading } = useQuery<Party[]>({
    queryKey: ["parties"],
    queryFn: async () => {
      const res = await fetch("/api/parties");
      if (!res.ok) throw new Error("Failed to fetch parties");
      const data = await res.json();
      return data.parties || [];
    }
  });

  const parties = partiesData || [];
  const loading = partiesLoading;

  const handleOpenDelete = (party: Party) => {
    setDeletingParty(party);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingParty) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/parties/${deletingParty.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete party");
      }
      toast.success("Party deleted successfully");
      setDeleteOpen(false);
      queryClient.invalidateQueries({ queryKey: ["parties"] });
    } catch (err: any) {
      toast.error(err.message || "An error occurred during deletion");
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredParties = parties.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.company_name && p.company_name.toLowerCase().includes(search.toLowerCase())) ||
      (p.code && p.code.toLowerCase().includes(search.toLowerCase())) ||
      (p.phone && p.phone.includes(search));

    const matchesTab = activeTab === "all" || p.type?.includes(activeTab);

    return matchesSearch && matchesTab;
  });

  const supplierCount = parties.filter((p) => p.type?.includes("supplier")).length;
  const customerCount = parties.filter((p) => p.type?.includes("customer")).length;
  const workerCount = parties.filter((p) => p.type?.includes("worker")).length;

  const columns: DataTableColumn<Party>[] = [
    {
      key: "code",
      header: "Code",
      width: "110px",
      render: (row) => <span className="font-mono font-bold text-xs text-[#6366F1]">{row.code || "—"}</span>,
    },
    {
      key: "name",
      header: "Party / Display Name",
      render: (row) => (
        <div>
          <span className="font-bold text-[#0F172A] block">{row.name}</span>
          {row.company_name && <span className="text-xs text-[#64748B]">{row.company_name}</span>}
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (row) => (
        <div className="flex gap-1">
          {row.type?.map((t) => {
            let variant: BadgeVariant = "gray";
            if (t === "supplier") variant = "primary";
            else if (t === "customer") variant = "green";
            else if (t === "worker") variant = "orange";
            return (
              <Badge key={t} variant={variant} className="capitalize text-[10px]">
                {t}
              </Badge>
            );
          })}
        </div>
      ),
    },
    {
      key: "phone",
      header: "Phone Number",
      render: (row) => <span className="text-sm font-medium">{row.phone || "—"}</span>,
    },
    {
      key: "gstin",
      header: "GSTIN",
      render: (row) => <span className="font-mono text-xs uppercase">{row.gstin || "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "100px",
      render: (row) => <StatusBadge active={row.status === "active"} />,
    },
    {
      key: "actions",
      header: "Actions",
      width: "150px",
      render: (row) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/parties/${row.id}/ledger`}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
            title="View Ledger"
          >
            <FileText className="h-4 w-4" />
          </Link>
          <Link
            href={`/master-data/parties/${row.id}/edit`}
            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-transparent hover:border-amber-100"
            title="Edit Party"
          >
            <Pencil className="h-4 w-4" />
          </Link>
          <button
            onClick={() => handleOpenDelete(row)}
            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
            title="Delete Party"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Parties Directory"
        subtitle="Manage suppliers, customers, and workers in one unified system."
        actionLabel="Add Party"
        onAction={() => router.push("/master-data/parties/new")}
      />

      {/* STAT CARDS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#EEF2FF] rounded-lg text-[#6366F1]">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-[#64748B]">Suppliers</span>
            <p className="text-2xl font-bold text-[#0F172A]">{supplierCount}</p>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#F0FDF4] rounded-lg text-[#16A34A]">
            <Briefcase className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-[#64748B]">Customers</span>
            <p className="text-2xl font-bold text-[#0F172A]">{customerCount}</p>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#FEF9C3] rounded-lg text-[#D97706]">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-[#64748B]">Workers</span>
            <p className="text-2xl font-bold text-[#0F172A]">{workerCount}</p>
          </div>
        </div>
      </div>

      {/* FILTER & TABS BAR */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white border border-[#E2E8F0] p-4 rounded-xl shadow-sm">
        {/* Tabs */}
        <div className="flex bg-[#F1F5F9] p-1 rounded-lg w-full md:w-auto">
          {[
            { id: "all", label: "All Parties" },
            { id: "supplier", label: "Suppliers" },
            { id: "customer", label: "Customers" },
            { id: "worker", label: "Workers" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${activeTab === tab.id
                  ? "bg-white text-[#0F172A] shadow-sm font-bold"
                  : "text-[#64748B] hover:text-[#0F172A]"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Search code, name, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1] transition-all"
          />
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredParties}
          isLoading={loading}
          total={filteredParties.length}
          page={1}
          perPage={10000}
          onPageChange={() => { }}
          emptyMessage="No parties found in database."
        />
      </div>

      {/* DELETE CONFIRM DIALOG */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Party"
        description={`Are you sure you want to delete ${deletingParty?.name}? This action will soft-delete their profile details.`}
        confirmText="Delete"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
