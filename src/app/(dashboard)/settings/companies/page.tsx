"use client";

import { useState } from "react";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
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
  Globe,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function CompaniesSettingsPage() {
  const {
    companies,
    activeCompany,
    isLoading,
    isSwitching,
    switchCompany,
    refetchCompanies,
  } = useCompany();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyAddress, setNewCompanyAddress] = useState("");
  const [newCompanyPhone, setNewCompanyPhone] = useState("");
  const [newCompanyEmail, setNewCompanyEmail] = useState("");
  const [newCompanyGstin, setNewCompanyGstin] = useState("");
  const [newCompanyPan, setNewCompanyPan] = useState("");
  const [newCompanyWebsite, setNewCompanyWebsite] = useState("");
  const [creating, setCreating] = useState(false);

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

            return (
              <div
                key={company.id}
                className={cn(
                  "relative rounded-2xl border p-5 transition-all duration-200 flex flex-col justify-between",
                  isCurrent
                    ? "bg-[var(--card-bg)] border-[var(--primary)] shadow-md ring-1 ring-[var(--primary)]/30"
                    : "bg-[var(--card-bg)] border-[var(--border)] hover:border-[var(--text-faint)] shadow-xs"
                )}
              >
                {/* Active Indicator Ribbon */}
                {isCurrent && (
                  <div className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 text-xs font-bold">
                    <CheckCircle2 size={13} />
                    <span>Active Workspace</span>
                  </div>
                )}

                <div>
                  {/* Top: Logo & Title */}
                  <div className="flex items-start gap-3.5 pr-28">
                    <div className="w-12 h-12 rounded-xl bg-[var(--page-bg)] border border-[var(--border)] flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                      {company.logo_url ? (
                        <img
                          src={company.logo_url}
                          alt={company.name}
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <Building2 size={22} className="text-[var(--text-muted)]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-[var(--text-primary)] truncate">
                        {company.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <RoleBadge role={company.role} />
                      </div>
                    </div>
                  </div>

                  {/* Metadata Grid */}
                  <div className="mt-4 pt-3 border-t border-[var(--border-light)] space-y-1.5 text-xs text-[var(--text-muted)]">
                    {company.gstin && (
                      <div className="flex items-center gap-2 truncate">
                        <FileText size={13} className="shrink-0 text-[var(--text-faint)]" />
                        <span>GSTIN: <strong className="text-[var(--text-body)] font-medium">{company.gstin}</strong></span>
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
                <div className="mt-5 pt-3 border-t border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-faint)] font-medium">
                    <ShieldCheck size={13} className="text-[var(--primary)]" />
                    <span>Isolated Database Tenant</span>
                  </div>

                  {isCurrent ? (
                    <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                      Currently Operating
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => switchCompany(company.id)}
                      disabled={isSwitching}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--page-bg)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)] text-[var(--text-primary)] border border-[var(--border)] rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                    >
                      <span>Switch Company</span>
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </PageState>

      {/* Add Company Modal */}
      <Modal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        title="Add New Company"
        description="Create a new independent tenant workspace. You will be assigned as the Owner."
        maxWidth="max-w-xl"
      >
        <div className="space-y-4 pt-2">
          {/* Company Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Company / Business Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              placeholder="e.g. Homelander Apparels Pvt Ltd"
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
            />
          </div>

          {/* GSTIN & PAN Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                GSTIN (Optional)
              </label>
              <input
                type="text"
                value={newCompanyGstin}
                onChange={(e) => setNewCompanyGstin(e.target.value.toUpperCase())}
                placeholder="24ABCDE1234F1Z5"
                maxLength={15}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
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
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
              />
            </div>
          </div>

          {/* Email & Phone Grid */}
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
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
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
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
              />
            </div>
          </div>

          {/* Address */}
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

          {/* Website */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Website (Optional)
            </label>
            <input
              type="text"
              value={newCompanyWebsite}
              onChange={(e) => setNewCompanyWebsite(e.target.value)}
              placeholder="https://mycompany.com"
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <AsyncButton
              onClick={handleCreateCompany}
              isLoading={creating}
              variant="primary"
            >
              Create & Launch Workspace
            </AsyncButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
