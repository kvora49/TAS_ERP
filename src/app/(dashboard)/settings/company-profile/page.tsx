"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { SettingsPreviewCard } from "@/components/settings/SettingsPreviewCard";
import { PageState } from "@/components/experience/PageState";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Building2,
  ClipboardList,
  CloudUpload,
  Save,
  Building,
  Info,
  ExternalLink,
  Mail,
  PhoneCall,
} from "lucide-react";
import { toast } from "sonner";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

export default function CompanyProfileSettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch, getSanitizedWebsite } = useCompanyProfile();

  // Form states
  const [name, setName] = useState("");
  const [gstin, setGstin] = useState("");
  const [pan, setPan] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [currency, setCurrency] = useState("INR (₹)");
  const [fiscalYear, setFiscalYear] = useState("1 April – 31 March");
  const [logoUrl, setLogoUrl] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading } = useFileUpload("logos");

  // Populate local form state when query resolves
  useEffect(() => {
    if (data?.business) {
      setName(data.business.name || "");
      setGstin(data.business.gstin || "");
      setPan(data.business.pan || "");
      setAddress(data.business.address || "");
      setPhone(data.business.phone || "");
      setEmail(data.business.email || "");
      setWebsite(data.business.website || "");
      setCurrency(data.business.currency || "INR (₹)");
      setFiscalYear(data.business.financial_year_start || "1 April – 31 March");
      setLogoUrl(data.business.logo_url || "");
    }
  }, [data]);

  const isDirty = Boolean(
    data?.business && (
      name !== (data.business.name || "") ||
      gstin !== (data.business.gstin || "") ||
      address !== (data.business.address || "") ||
      phone !== (data.business.phone || "") ||
      email !== (data.business.email || "")
    )
  );
  useUnsavedChangesGuard(isDirty);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name || !gstin || !address || !phone || !email || !fiscalYear || !currency) {
        throw new Error("Please fill in all required fields (*)");
      }

      const res = await fetch("/api/settings/company-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          gstin,
          pan,
          address,
          phone,
          email,
          website,
          logo_url: logoUrl,
          financial_year_start: fiscalYear,
          currency,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to update profile");
      }
      return resData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "company-profile"] });
      toast.success("Company profile updated successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error saving company profile");
    },
  });

  const handleSave = async () => {
    await saveMutation.mutateAsync();
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size exceeds 2MB limit");
      return;
    }

    const result = await upload(file);
    if (result.success) {
      setLogoUrl(result.url);
      toast.success("Logo uploaded successfully. Click Save Changes to apply.");
    } else {
      toast.error(result.error);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // Preview fields
  const previewRows = [
    { icon: Building, label: "Company Name", value: name || "—", type: "text" as const },
    { icon: ClipboardList, label: "GSTIN", value: gstin || "—", type: "text" as const },
    { icon: ClipboardList, label: "PAN", value: pan || "—", type: "text" as const },
    { icon: PhoneCall, label: "Phone", value: phone || "—", type: "text" as const },
    { icon: Mail, label: "Email", value: email || "—", type: "text" as const },
  ];

  const sanitizedUrl = getSanitizedWebsite();

  return (
    <PageState
      isLoading={isLoading}
      isError={!!error}
      error={error as Error}
      onRetry={refetch}
      skeletonVariant="form"
    >
      <div className="flex flex-col gap-6 text-left">
        <SettingsPageHeader
          section="Company Profile"
          title="Settings - Company Profile"
          subtitle="Manage your company's profile, logo and contact details"
          actionLabel="Save Changes"
          onAction={handleSave}
          actionIcon={<Save className="size-4 text-white" />}
          actionLoading={saveMutation.isPending}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT + CENTER - Company Information Form */}
          <div className="lg:col-span-2">
            <SettingsCard icon={Building2} title="Company Information">
              {/* Logo Row */}
              <div className="flex flex-col sm:flex-row items-start gap-6 mb-6">
                {/* Current Preview */}
                <div className="flex flex-col items-center">
                  <div className="w-32 h-32 rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--page-bg)] flex items-center justify-center relative shadow-sm">
                    {logoUrl ? (
                      <Image
                        src={logoUrl}
                        alt="Company Logo"
                        width={128}
                        height={128}
                        className="object-contain w-full h-full p-2"
                      />
                    ) : (
                      <Building className="size-12 text-[var(--text-muted)]" />
                    )}
                    {uploading && (
                      <div className="absolute inset-0 bg-[var(--card-bg)]/80 backdrop-blur-xs flex items-center justify-center">
                        <span className="text-xs font-semibold text-[var(--primary)] animate-pulse">
                          Uploading...
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] mt-2 font-medium">
                    Recommended size: 300x300px
                  </span>
                </div>

                {/* Upload Zone */}
                <div
                  onClick={triggerFileSelect}
                  className="w-full max-w-sm h-32 border-2 border-dashed border-[var(--input-border)] rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-[var(--primary)] hover:bg-[var(--page-bg)] transition-colors p-4"
                >
                  <CloudUpload className="size-7 text-[var(--text-muted)]" />
                  <span className="text-sm font-semibold text-[var(--text-primary)] mt-1">Upload Logo</span>
                  <span className="text-[10px] text-[var(--text-muted)]">PNG, JPG or SVG • Max 2MB</span>
                  <button
                    type="button"
                    className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-primary)] hover:bg-[var(--page-bg)] transition-colors shadow-xs"
                  >
                    Choose File
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    accept=".png,.jpg,.jpeg,.svg"
                    className="hidden"
                  />
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                    placeholder="Company Name"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
                    GSTIN <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors uppercase font-mono"
                    placeholder="GST Number"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
                    Full Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full h-28 px-3 py-2.5 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors resize-none"
                    placeholder="Company Address"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
                    PAN
                  </label>
                  <input
                    type="text"
                    value={pan}
                    onChange={(e) => setPan(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors uppercase font-mono"
                    placeholder="PAN Card Number"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                    placeholder="Phone Number"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                    placeholder="Email Address"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
                    Website
                  </label>
                  <input
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                    placeholder="e.g. www.mycompany.com"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
                    Default Currency <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                  >
                    <option value="INR (₹)">INR (₹) - Rupee</option>
                    <option value="USD ($)">USD ($) - Dollar</option>
                    <option value="EUR (€)">EUR (€) - Euro</option>
                    <option value="GBP (£)">GBP (£) - Pound</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
                    Fiscal Year <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={fiscalYear}
                    onChange={(e) => setFiscalYear(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                  >
                    <option value="1 April – 31 March">1 April – 31 March</option>
                    <option value="1 January – 31 December">1 January – 31 December</option>
                    <option value="1 July – 30 June">1 July – 30 June</option>
                  </select>
                </div>
              </div>
            </SettingsCard>
          </div>

          {/* RIGHT COLUMN - Company Overview */}
          <div>
            <SettingsPreviewCard
              title="Company Overview"
              subtitle="Details visible on documents"
              rows={previewRows}
            >
              <div className="flex flex-col gap-3.5 text-sm text-[var(--text-secondary)]">
                {sanitizedUrl && (
                  <div className="flex items-center justify-between">
                    <span>Website</span>
                    <a
                      href={sanitizedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--primary)] hover:underline flex items-center gap-1 font-semibold"
                    >
                      Visit <ExternalLink className="size-3" />
                    </a>
                  </div>
                )}
                {address && (
                  <div className="flex flex-col gap-1 text-left">
                    <span className="font-semibold text-[var(--text-primary)]">Billing Address</span>
                    <p className="text-xs text-[var(--text-muted)] whitespace-pre-wrap leading-relaxed">
                      {address}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-1.5 justify-between">
                  <span>Fiscal Year</span>
                  <span className="font-semibold text-[var(--text-primary)]">{fiscalYear}</span>
                </div>
                <div className="flex items-center gap-1.5 justify-between">
                  <span>Currency</span>
                  <span className="font-semibold text-[var(--text-primary)]">{currency}</span>
                </div>

                {/* Info Note Block */}
                <div className="bg-[var(--primary-light)] border border-[var(--border)] rounded-lg p-3 mt-2 flex items-start gap-2">
                  <Info className="size-4 text-[var(--primary)] shrink-0 mt-0.5" />
                  <div className="text-left">
                    <span className="text-xs font-semibold text-[var(--text-primary)] block">Note</span>
                    <span className="text-[11px] text-[var(--text-muted)] block mt-1 leading-snug">
                      Company profile details will be used in invoices, reports and other documents.
                    </span>
                  </div>
                </div>
              </div>
            </SettingsPreviewCard>
          </div>
        </div>
      </div>
    </PageState>
  );
}
