"use client";

import { useState } from "react";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { Modal } from "@/components/shared/Modal";
import AsyncButton from "@/components/shared/AsyncButton";
import PageState from "@/components/shared/PageState";
import { useCompany, CompanyItem } from "@/components/providers/CompanyProvider";
import {
  Building2,
  Plus,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  FileText,
  ArrowRight,
  ShieldCheck,
  Archive,
  ArchiveRestore,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getStateNameFromGSTIN, getStateCodeFromGSTIN } from "@/lib/gst-utils";

export default function CompaniesSettingsPage() {
  const {
    companies,
    activeCompany,
    isLoading,
    isSwitching,
    switchCompany,
    refetchCompanies,
  } = useCompany();

  // --- Add Company form state ---
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyAddress, setNewCompanyAddress] = useState("");
  const [newCompanyPhone, setNewCompanyPhone] = useState("");
  const [newCompanyEmail, setNewCompanyEmail] = useState("");
  const [newCompanyGstin, setNewCompanyGstin] = useState("");
  const [newCompanyPan, setNewCompanyPan] = useState("");
  const [newCompanyWebsite, setNewCompanyWebsite] = useState("");
  const [creating, setCreating] = useState(false);

  // --- Archive modal state ---
  const [archiveTarget, setArchiveTarget] = useState<CompanyItem | null>(null);
  const [archiveStep, setArchiveStep] = useState<"warning" | "confirm">("warning");
  const [archiveConfirmInput, setArchiveConfirmInput] = useState("");
  const [archiveLoading, setArchiveLoading] = useState(false);

  // --- Restore modal state ---
  const [restoreTarget, setRestoreTarget] = useState<CompanyItem | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) {
      toast.error("Please enter a company name");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/companies/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCompanyName.trim(),
          address: newCompanyAddress.trim() || null,
          phone: newCompanyPhone.trim() || null,
          email: newCompanyEmail.trim() || null,
          gstin: newCompanyGstin.trim() || null,
          pan: newCompanyPan.trim() || null,
          website: newCompanyWebsite.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create company");
      }

      toast.success(`Company "${newCompanyName}" created successfully!`);
      setAddModalOpen(false);
      resetForm();
      refetchCompanies();
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred");
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setNewCompanyName("");
    setNewCompanyAddress("");
    setNewCompanyPhone("");
    setNewCompanyEmail("");
    setNewCompanyGstin("");
    setNewCompanyPan("");
    setNewCompanyWebsite("");
  };

  const openArchiveModal = (company: CompanyItem) => {
    setArchiveTarget(company);
    setArchiveStep("warning");
    setArchiveConfirmInput("");
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    if (archiveConfirmInput.trim() !== archiveTarget.name.trim()) {
      toast.error("Company name does not match. Please type it exactly.");
      return;
    }
    setArchiveLoading(true);
    try {
      const res = await fetch("/api/companies/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: archiveTarget.id, action: "archive" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to archive company");

      toast.success(data.message || `Company archived successfully.`);
      setArchiveTarget(null);
      refetchCompanies();
    } catch (err: any) {
      toast.error(err.message || "Failed to archive company");
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setRestoreLoading(true);
    try {
      const res = await fetch("/api/companies/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: restoreTarget.id, action: "restore" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to restore company");

      toast.success(data.message || "Company restored successfully.");
      setRestoreTarget(null);
      refetchCompanies();
    } catch (err: any) {
      toast.error(err.message || "Failed to restore company");
    } finally {
      setRestoreLoading(false);
    }
  };

  const inputClass =
    "w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors";

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <SettingsPageHeader
        section="Settings"
        title="Companies & Workspaces"
        subtitle="Manage your garment manufacturing businesses, view assigned roles, and switch workspaces."
        actionLabel="+ Add New Company"
        onAction={() => setAddModalOpen(true)}
      />

      <PageState
        isLoading={isLoading}
        isError={false}
        onRetry={refetchCompanies}
        isEmpty={companies.length === 0}
        skeletonVariant="card"
        skeletonCount={3}
        emptyTitle="No companies assigned yet"
        emptyDescription="You are not currently linked to any active company workspace."
        emptyAction={
          <AsyncButton onClick={() => setAddModalOpen(true)} variant="primary">
            + Create First Company
          </AsyncButton>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {companies.map((company) => {
            const isCurrent = company.isActive || company.id === activeCompany?.id;
            const isOwner = company.role === "owner";
            const isArchived = !!(company as any).archived_at;

            return (
              <div
                key={company.id}
                className={cn(
                  "relative rounded-2xl border p-5 transition-all duration-200 flex flex-col justify-between",
                  isArchived
                    ? "bg-[var(--page-bg)] border-[var(--border)] opacity-75"
                    : isCurrent
                    ? "bg-[var(--card-bg)] border-[var(--primary)] shadow-md ring-1 ring-[var(--primary)]/30"
                    : "bg-[var(--card-bg)] border-[var(--border)] hover:border-[var(--text-faint)] shadow-xs"
                )}
              >
                {/* Archived ribbon */}
                {isArchived && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
                    <Archive size={10} />
                    <span>Archived</span>
                  </div>
                )}

                <div>
                  {/* Top: Logo, Title & Active Badge */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[var(--page-bg)] border border-[var(--border)] flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                        {(company as any).logo_url ? (
                          <img
                            src={(company as any).logo_url}
                            alt={company.name}
                            className="w-full h-full object-contain p-1"
                          />
                        ) : (
                          <Building2 size={20} className="text-[var(--text-muted)]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3
                          className="text-sm sm:text-base font-bold text-[var(--text-primary)] break-words leading-snug"
                          title={company.name}
                        >
                          {company.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <RoleBadge role={company.role} />
                        </div>
                      </div>
                    </div>

                    {isCurrent && !isArchived && (
                      <div className="self-start sm:self-auto flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 text-[11px] font-bold shrink-0">
                        <CheckCircle2 size={12} />
                        <span>Active Workspace</span>
                      </div>
                    )}
                  </div>

                  {/* Metadata Grid */}
                  <div className="mt-4 pt-3 border-t border-[var(--border-light)] space-y-1.5 text-xs text-[var(--text-muted)]">
                    {company.gstin && (
                      <div className="flex items-center gap-2 truncate">
                        <FileText size={13} className="shrink-0 text-[var(--text-faint)]" />
                        <span>
                          GSTIN:{" "}
                          <strong className="text-[var(--text-body)] font-medium">
                            {company.gstin}
                          </strong>
                        </span>
                      </div>
                    )}
                    {company.phone && (
                      <div className="flex items-center gap-2 truncate">
                        <Phone size={13} className="shrink-0 text-[var(--text-faint)]" />
                        <span>{company.phone}</span>
                      </div>
                    )}
                    {company.email && (
                      <div className="flex items-center gap-2 truncate">
                        <Mail size={13} className="shrink-0 text-[var(--text-faint)]" />
                        <span>{company.email}</span>
                      </div>
                    )}
                    {company.address && (
                      <div className="flex items-center gap-2 truncate">
                        <MapPin size={13} className="shrink-0 text-[var(--text-faint)]" />
                        <span className="truncate">{company.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="mt-5 pt-3 border-t border-[var(--border)] flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-faint)] font-medium">
                    <ShieldCheck size={13} className="text-[var(--primary)]" />
                    <span>Isolated Database Tenant</span>
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    {/* Archive / Restore — owner only */}
                    {isOwner && (
                      <>
                        {isArchived ? (
                          <button
                            type="button"
                            onClick={() => setRestoreTarget(company)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                          >
                            <ArchiveRestore size={12} />
                            <span>Restore</span>
                          </button>
                        ) : (
                          !isCurrent && (
                            <button
                              type="button"
                              onClick={() => openArchiveModal(company)}
                              title="Archive this company"
                              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--page-bg)] hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--text-muted)] hover:text-red-600 dark:hover:text-red-400 border border-[var(--border)] hover:border-red-300 dark:hover:border-red-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                            >
                              <Archive size={12} />
                              <span>Archive</span>
                            </button>
                          )
                        )}
                      </>
                    )}

                    {/* Switch button — only for non-current, non-archived companies */}
                    {!isCurrent && !isArchived ? (
                      <button
                        type="button"
                        onClick={() => switchCompany(company.id)}
                        disabled={isSwitching}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--page-bg)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)] text-[var(--text-primary)] border border-[var(--border)] rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                      >
                        <span>Switch Company</span>
                        <ArrowRight size={13} />
                      </button>
                    ) : isCurrent && !isArchived ? (
                      <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                        Currently Operating
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </PageState>

      {/* ── Add Company Modal ──────────────────────────────────────── */}
      <Modal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        title="Add New Company"
        description="Create a new independent tenant workspace. You will be assigned as the Owner."
        maxWidth="max-w-xl"
      >
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Company / Business Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              placeholder="e.g. Homelander Apparels Pvt Ltd"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  GSTIN (Optional)
                </label>
                {newCompanyGstin && getStateNameFromGSTIN(newCompanyGstin) && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    ✓ {getStateNameFromGSTIN(newCompanyGstin)} ({getStateCodeFromGSTIN(newCompanyGstin)})
                  </span>
                )}
              </div>
              <input
                type="text"
                value={newCompanyGstin}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setNewCompanyGstin(val);
                  if (val.length >= 12 && (!newCompanyPan || newCompanyPan.length !== 10)) {
                    const extractedPan = val.substring(2, 12);
                    if (/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(extractedPan)) {
                      setNewCompanyPan(extractedPan);
                    }
                  }
                }}
                placeholder="24ABCDE1234F1Z5"
                maxLength={15}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                PAN (Optional)
              </label>
              <input
                type="text"
                value={newCompanyPan}
                onChange={(e) => setNewCompanyPan(e.target.value.toUpperCase())}
                placeholder="ABCDE1234F"
                maxLength={10}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Official Email
              </label>
              <input
                type="email"
                value={newCompanyEmail}
                onChange={(e) => setNewCompanyEmail(e.target.value)}
                placeholder="contact@company.com"
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Phone Number
              </label>
              <input
                type="text"
                value={newCompanyPhone}
                onChange={(e) => setNewCompanyPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Operating Address
            </label>
            <textarea
              value={newCompanyAddress}
              onChange={(e) => setNewCompanyAddress(e.target.value)}
              placeholder="Factory / Office address..."
              rows={2}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg p-3 text-sm transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Website (Optional)
            </label>
            <input
              type="text"
              value={newCompanyWebsite}
              onChange={(e) => setNewCompanyWebsite(e.target.value)}
              placeholder="https://mycompany.com"
              className={inputClass}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <AsyncButton onClick={handleCreateCompany} isLoading={creating} variant="primary">
              Create & Launch Workspace
            </AsyncButton>
          </div>
        </div>
      </Modal>

      {/* ── Archive Warning Modal — Step 1 ────────────────────────── */}
      <Modal
        open={!!archiveTarget && archiveStep === "warning"}
        onOpenChange={(open) => { if (!open) setArchiveTarget(null); }}
        title="Archive Company"
        maxWidth="max-w-md"
      >
        <div className="space-y-5 pt-1">
          {/* Severity banner */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700">
            <AlertTriangle className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" size={20} />
            <div className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed space-y-2">
              <p className="font-bold">This action has serious consequences.</p>
              <ul className="list-disc pl-4 space-y-1 text-xs font-medium">
                <li>All <strong>non-owner members</strong> will immediately lose access to this company.</li>
                <li>You, as the owner, will retain access so you can manage or restore the workspace.</li>
                <li>All data (bills, stock, payroll, transactions) is <strong>preserved</strong> — nothing is deleted.</li>
                <li>The company will be hidden from the normal workspace switcher.</li>
                <li>You can <strong>restore</strong> this company at any time from Settings → Companies.</li>
              </ul>
            </div>
          </div>

          <p className="text-sm text-[var(--text-body)]">
            Are you sure you want to archive{" "}
            <strong className="text-[var(--text-primary)]">{archiveTarget?.name}</strong>?
          </p>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setArchiveTarget(null)}
              className="px-4 py-2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setArchiveStep("confirm")}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer"
            >
              <Archive size={14} />
              Continue to Confirmation
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Archive Confirm Modal — Step 2 (type name) ───────────── */}
      <Modal
        open={!!archiveTarget && archiveStep === "confirm"}
        onOpenChange={(open) => { if (!open) { setArchiveTarget(null); setArchiveConfirmInput(""); } }}
        title="Final Confirmation Required"
        maxWidth="max-w-md"
      >
        <div className="space-y-5 pt-1">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700">
            <Trash2 className="text-red-600 dark:text-red-400 mt-0.5 shrink-0" size={18} />
            <p className="text-xs text-red-800 dark:text-red-300 font-semibold leading-relaxed">
              All non-owner member access will be <strong>immediately revoked</strong> upon archiving.
              You cannot undo the member revocation — members will need to be manually re-invited if you restore.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Type the company name to confirm:
              <span className="ml-2 font-mono text-[var(--text-primary)] normal-case tracking-normal">
                {archiveTarget?.name}
              </span>
            </label>
            <input
              type="text"
              value={archiveConfirmInput}
              onChange={(e) => setArchiveConfirmInput(e.target.value)}
              placeholder={archiveTarget?.name || ""}
              className="w-full bg-[var(--input-bg)] border border-red-300 dark:border-red-700 text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors font-mono"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setArchiveStep("warning")}
              className="px-4 py-2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              ← Back
            </button>
            <AsyncButton
              onClick={handleArchive}
              isLoading={archiveLoading}
              disabled={archiveConfirmInput.trim() !== archiveTarget?.name?.trim()}
              variant="destructive"
            >
              Archive Company
            </AsyncButton>
          </div>
        </div>
      </Modal>

      {/* ── Restore Confirm Modal ─────────────────────────────────── */}
      <Modal
        open={!!restoreTarget}
        onOpenChange={(open) => { if (!open) setRestoreTarget(null); }}
        title="Restore Archived Company"
        maxWidth="max-w-md"
      >
        <div className="space-y-5 pt-1">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700">
            <ArchiveRestore className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" size={18} />
            <div className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed space-y-1">
              <p className="font-bold">Restoring this company will:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Make the workspace active again and visible in the switcher.</li>
                <li>Restore your owner access immediately.</li>
                <li>
                  <strong>Not</strong> automatically reinstate previously revoked members — you'll need to
                  re-invite them manually from Users & Roles.
                </li>
              </ul>
            </div>
          </div>

          <p className="text-sm text-[var(--text-body)]">
            Restore{" "}
            <strong className="text-[var(--text-primary)]">{restoreTarget?.name}</strong>?
          </p>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setRestoreTarget(null)}
              className="px-4 py-2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <AsyncButton onClick={handleRestore} isLoading={restoreLoading} variant="primary">
              Restore Company
            </AsyncButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
