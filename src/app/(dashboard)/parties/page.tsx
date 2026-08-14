"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge, BadgeVariant } from "@/components/shared/Badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";
import { Plus, Search, FileText, Pencil, Trash2, Users, Briefcase, UserCheck, User } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { usePartiesList } from "@/hooks/queries/useParties";
import { formatCurrency, cn } from "@/lib/utils";
import { invalidatePartyRelatedQueries } from "@/lib/utils/party";

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
  billing_address_line1?: string | null;
  billing_address_line2?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_pincode?: string | null;
  shipping_address_line1?: string | null;
  shipping_address_line2?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_pincode?: string | null;
}

import { ManualNoteModal } from "@/components/sales/ManualNoteModal";

export default function PartiesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "supplier" | "customer" | "worker">("all");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingParty, setDeletingParty] = useState<Party | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteModalType, setNoteModalType] = useState<"credit_note" | "debit_note">("credit_note");

  const { data: partiesData, isLoading: loading, error, refetch } = usePartiesList();

  const parties: Party[] = partiesData?.parties || [];

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
      invalidatePartyRelatedQueries(queryClient);
    } catch (err: any) {
      toast.error(err.message || "An error occurred during deletion");
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredParties = parties.filter((p) => {
    const s = search.trim().toLowerCase();
    const matchesSearch =
      !s ||
      p.name?.toLowerCase().includes(s) ||
      (p.company_name && p.company_name.toLowerCase().includes(s)) ||
      (p.code && p.code.toLowerCase().includes(s)) ||
      (p.phone && p.phone.toLowerCase().includes(s)) ||
      (p.gstin && p.gstin.toLowerCase().includes(s)) ||
      (p.billing_address_line1 && p.billing_address_line1.toLowerCase().includes(s)) ||
      (p.billing_address_line2 && p.billing_address_line2.toLowerCase().includes(s)) ||
      (p.billing_city && p.billing_city.toLowerCase().includes(s)) ||
      (p.billing_state && p.billing_state.toLowerCase().includes(s)) ||
      (p.billing_pincode && p.billing_pincode.toLowerCase().includes(s)) ||
      (p.shipping_address_line1 && p.shipping_address_line1.toLowerCase().includes(s)) ||
      (p.shipping_address_line2 && p.shipping_address_line2.toLowerCase().includes(s)) ||
      (p.shipping_city && p.shipping_city.toLowerCase().includes(s)) ||
      (p.shipping_state && p.shipping_state.toLowerCase().includes(s)) ||
      (p.shipping_pincode && p.shipping_pincode.toLowerCase().includes(s));

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
      render: (row) => <span className="font-mono font-bold text-xs text-[var(--primary)]">{row.code || "—"}</span>,
    },
    {
      key: "name",
      header: "Party / Display Name",
      render: (row) => (
        <div>
          <Link
            href={`/parties/${row.id}`}
            className="font-bold text-[var(--primary)] hover:underline block text-left"
          >
            {row.name}
          </Link>
          {row.company_name && <span className="text-xs text-[var(--text-muted)]">{row.company_name}</span>}
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
      render: (row) => <span className="text-sm font-medium text-[var(--text-primary)]">{row.phone || "—"}</span>,
    },
    {
      key: "gstin",
      header: "GSTIN",
      render: (row) => <span className="font-mono text-xs uppercase text-[var(--text-primary)]">{row.gstin || "—"}</span>,
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
        <div className="flex items-center gap-2 select-none">
          <Link
            href={`/parties/${row.id}`}
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 text-[var(--primary)] hover:bg-[var(--primary-light)] rounded-lg transition-colors border border-transparent"
            title="View Profile / Details"
          >
            <User className="h-4 w-4" />
          </Link>
          <Link
            href={`/parties/${row.id}/ledger`}
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors border border-transparent"
            title="View Ledger"
          >
            <FileText className="h-4 w-4" />
          </Link>
          <Link
            href={`/parties/${row.id}/edit`}
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors border border-transparent"
            title="Edit Party"
          >
            <Pencil className="h-4 w-4" />
          </Link>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDelete(row);
            }}
            className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent cursor-pointer"
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Parties Directory</h1>
          <p className="text-xs text-[var(--text-muted)]">Manage suppliers, customers, and workers in one unified system.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setNoteModalType("credit_note"); setNoteModalOpen(true); }}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={14} /> Issue Credit Note
          </button>
          <button
            onClick={() => { setNoteModalType("debit_note"); setNoteModalOpen(true); }}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={14} /> Issue Debit Note
          </button>
          <AsyncButton
            onClick={() => router.push("/parties/new")}
            variant="primary"
            className="px-4 py-2 text-xs font-bold flex items-center gap-1"
          >
            <Plus size={14} /> Add Party
          </AsyncButton>
        </div>
      </div>

      <PageState
        isLoading={loading}
        isError={!!error}
        error={error ? (error instanceof Error ? error.message : "Failed to load parties directory") : undefined}
        onRetry={refetch}
        isEmpty={filteredParties.length === 0}
        emptyTitle="No Parties Found"
        emptyMessage="No party directory records match your search or filter."
        emptyAction={
          <AsyncButton onClick={() => router.push("/parties/new")} variant="primary">
            + Add First Party
          </AsyncButton>
        }
        skeletonVariant="table"
        skeletonRows={8}
        skeletonColumns={7}
      >
        {/* STAT CARDS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] flex items-center gap-4">
            <div className="p-3 bg-[var(--primary-light)] rounded-lg text-[var(--primary)]">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-[var(--text-muted)]">Suppliers</span>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{supplierCount}</p>
            </div>
          </div>

          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-lg text-green-500">
              <Briefcase className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-[var(--text-muted)]">Customers</span>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{customerCount}</p>
            </div>
          </div>

          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 rounded-lg text-amber-500">
              <UserCheck className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-[var(--text-muted)]">Workers</span>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{workerCount}</p>
            </div>
          </div>
        </div>

        {/* ── MOBILE: snap-scroll stat cards ── */}
        <div className="md:hidden flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 pb-1 scrollbar-none">
          {[
            { label: "Suppliers", count: supplierCount, icon: Users,     bg: "bg-[var(--primary-light)]",  color: "text-[var(--primary)]" },
            { label: "Customers", count: customerCount, icon: Briefcase, bg: "bg-green-500/10",              color: "text-green-500" },
            { label: "Workers",   count: workerCount,   icon: UserCheck, bg: "bg-amber-500/10",             color: "text-amber-500" },
            { label: "All",       count: parties.length, icon: Users,    bg: "bg-[var(--primary-light)]",  color: "text-[var(--primary)]" },
          ].map(({ label, count, icon: Icon, bg, color }) => (
            <div key={label} className="snap-start shrink-0 w-[140px] bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3 shadow-[var(--shadow-sm)] flex items-center gap-2.5">
              <div className={cn("p-2 rounded-lg", bg)}><Icon className={cn("h-4 w-4", color)} /></div>
              <div>
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
                <p className={cn("text-sm font-black mt-0.5", color)}>{count}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── DESKTOP: existing 3-col stat grid ── */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-[var(--card-bg)] border border-[var(--border)] p-4 rounded-xl shadow-[var(--shadow-sm)]">
          {/* Desktop Tabs */}
          <div className="flex bg-[var(--page-bg)] p-1 rounded-lg w-full md:w-auto">
            {[
              { id: "all", label: "All Parties" },
              { id: "supplier", label: "Suppliers" },
              { id: "customer", label: "Customers" },
              { id: "worker", label: "Workers" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-[var(--card-bg)] text-[var(--text-primary)] shadow-[var(--shadow-sm)] font-bold"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Desktop Search */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-faint)]" />
            <input type="text" placeholder="Search by name, address, city, state, pincode, GSTIN..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--input-focus)] transition-all"
            />
          </div>
        </div>{/* end desktop filter bar */}

        {/* ── MOBILE: Party card list ── */}
        <div className="md:hidden space-y-3">
          {filteredParties.map((party) => (
            <div key={party.id}
              className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden active:bg-[var(--table-row-hover)] transition-colors cursor-pointer"
              onClick={() => router.push(`/parties/${party.id}`)}
            >
              {/* Header: Avatar initials + Name + Status */}
              <div className="flex items-center gap-3 px-4 pt-3.5 pb-2">
                <div className="w-9 h-9 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center font-black text-sm shrink-0 uppercase">
                  {party.name?.charAt(0) || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/parties/${party.id}`} onClick={(e) => e.stopPropagation()}
                    className="font-bold text-[var(--text-primary)] text-sm hover:text-[var(--primary)] hover:underline block truncate"
                  >{party.name}</Link>
                  {party.company_name && <p className="text-[11px] text-[var(--text-muted)] truncate">{party.company_name}</p>}
                </div>
                <StatusBadge active={party.status === "active"} />
              </div>

              {/* Type badges + Code */}
              <div className="flex items-center gap-1.5 flex-wrap px-4 pb-2">
                <span className="font-mono text-[10px] font-bold text-[var(--text-faint)] bg-[var(--page-bg)] border border-[var(--border)] px-2 py-0.5 rounded">
                  {party.code || "—"}
                </span>
                {party.type?.map((t) => {
                  let variant: BadgeVariant = "gray";
                  if (t === "supplier") variant = "primary";
                  else if (t === "customer") variant = "green";
                  else if (t === "worker") variant = "orange";
                  return <Badge key={t} variant={variant} className="capitalize text-[10px]">{t}</Badge>;
                })}
              </div>

              {/* Phone + GSTIN grid */}
              <div className="grid grid-cols-2 gap-2 px-4 pb-2 border-t border-[var(--border-light)] pt-2">
                <div>
                  <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Phone</p>
                  <p className="text-xs font-semibold text-[var(--text-primary)] mt-0.5 truncate">{party.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">GSTIN</p>
                  <p className="text-xs font-mono font-bold text-[var(--text-primary)] mt-0.5 truncate uppercase">{party.gstin || "—"}</p>
                </div>
              </div>

              {/* Action footer */}
              <div className="flex items-center gap-1.5 px-4 pb-3.5 border-t border-[var(--border-light)] pt-2" onClick={(e) => e.stopPropagation()}>
                <Link href={`/parties/${party.id}`} onClick={(e) => e.stopPropagation()}
                  className="flex-1 h-8 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] text-[var(--primary)] flex items-center justify-center cursor-pointer" title="View Profile"
                ><User size={13} /></Link>
                <Link href={`/parties/${party.id}/ledger`} onClick={(e) => e.stopPropagation()}
                  className="flex-1 h-8 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] text-blue-500 flex items-center justify-center cursor-pointer" title="Ledger"
                ><FileText size={13} /></Link>
                <Link href={`/parties/${party.id}/edit`} onClick={(e) => e.stopPropagation()}
                  className="flex-1 h-8 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] text-amber-500 flex items-center justify-center cursor-pointer" title="Edit"
                ><Pencil size={13} /></Link>
                <button type="button" onClick={(e) => { e.stopPropagation(); handleOpenDelete(party); }}
                  className="flex-1 h-8 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] text-red-500 flex items-center justify-center cursor-pointer" title="Delete"
                ><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>

        {/* ── DESKTOP: DataTable ── */}
        <div className="hidden md:block bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
          <DataTable
            columns={columns}
            data={filteredParties}
            isLoading={false}
            total={filteredParties.length}
            page={1}
            perPage={10000}
            onPageChange={() => {}}
            onRowClick={(row) => router.push(`/parties/${row.id}`)}
            emptyMessage="No parties found matching filter."
          />
        </div>{/* end desktop DataTable */}
      </PageState>

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

      <ManualNoteModal
        open={noteModalOpen}
        onOpenChange={setNoteModalOpen}
        initialType={noteModalType}
        onSuccess={() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ["master-data", "parties"] });
        }}
      />
    </div>
  );
}
