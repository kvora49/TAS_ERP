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
  FileCheck,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  Clock,
  Loader2,
  Lock,
  RefreshCw,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { validateGSTINInput } from "@/lib/gst-utils";
import { useCompany } from "@/components/providers/CompanyProvider";

export default function CompanyProfileSettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch, getSanitizedWebsite } = useCompanyProfile();
  const { companies, activeCompany, isMultiCompany } = useCompany();

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
  const [einvoiceApplicability, setEinvoiceApplicability] = useState<"mandatory" | "voluntary_enabled" | "not_enabled">("mandatory");
  const [aatoBracket, setAatoBracket] = useState<"below_5cr" | "5cr_to_10cr" | "10cr_and_above">("below_5cr");
  const [gspApiUsername, setGspApiUsername] = useState("");
  const [gspApiPassword, setGspApiPassword] = useState("");
  const [isEditingCredentials, setIsEditingCredentials] = useState(false);
  const [irpOnboardingStatus, setIrpOnboardingStatus] = useState<string>("not_started");
  const [irpTokenExpiry, setIrpTokenExpiry] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

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
      setEinvoiceApplicability(data.business.einvoice_applicability || "mandatory");
      setAatoBracket(data.business.aato_bracket || "below_5cr");
      setGspApiUsername(data.business.irp_client_id || "");
      setGspApiPassword("");
      setIrpOnboardingStatus(data.business.irp_onboarding_status || "not_started");
      setIrpTokenExpiry(data.business.irp_token_expiry || null);
    }
  }, [data]);

  const isDirty = Boolean(
    data?.business && (
      name !== (data.business.name || "") ||
      gstin !== (data.business.gstin || "") ||
      address !== (data.business.address || "") ||
      phone !== (data.business.phone || "") ||
      email !== (data.business.email || "") ||
      einvoiceApplicability !== (data.business.einvoice_applicability || "mandatory") ||
      aatoBracket !== (data.business.aato_bracket || "below_5cr") ||
      gspApiUsername !== (data.business.irp_client_id || "")
    )
  );
  useUnsavedChangesGuard(isDirty);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name || !gstin || !address || !phone || !email || !fiscalYear || !currency) {
        throw new Error("Please fill in all required fields (*)");
      }

      const gstinCheck = validateGSTINInput(gstin);
      if (!gstinCheck.isValid) {
        throw new Error(gstinCheck.errorMessage || "Please enter a valid 15-character Company GSTIN.");
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
          einvoice_applicability: einvoiceApplicability,
          aato_bracket: aatoBracket,
          irp_api_username: gspApiUsername,
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

  const handleVerifyIrp = async () => {
    if (!gstin) {
      toast.error("Please enter a valid Company GSTIN before verifying GSP connection.");
      return;
    }
    const gstinVal = validateGSTINInput(gstin);
    if (!gstinVal.isValid) {
      toast.error(`Invalid Company GSTIN: ${gstinVal.errorMessage || "Must be exactly 15 characters"}. Please correct it in Company Information above and click "Save Changes" first.`);
      return;
    }
    if (gstin !== data?.business?.gstin) {
      toast.error("You have modified the Company GSTIN. Please click 'Save Changes' at the top right to save it to your database before connecting to IRP.");
      return;
    }
    if (!gspApiUsername?.trim()) {
      toast.error("Please enter the GSP API Username created on einvoice1.gst.gov.in under API Registration.");
      return;
    }
    if (!gspApiPassword?.trim()) {
      toast.error("Please enter your GSP API Password.");
      return;
    }
    setIsVerifying(true);
    try {
      const res = await fetch("/api/settings/einvoice/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName: gspApiUsername.trim(),
          password: gspApiPassword.trim(),
        }),
      });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Connection test failed");
      }
      toast.success(resData.message || "Successfully connected to IRIS GSP!");
      setIrpOnboardingStatus("authorized");
      if (resData.expiresAt) {
        setIrpTokenExpiry(resData.expiresAt);
      }
      setGspApiPassword("");
      setIsEditingCredentials(false);
      queryClient.invalidateQueries({ queryKey: ["settings", "company-profile"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to verify IRP credentials");
    } finally {
      setIsVerifying(false);
    }
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
    {
      icon: FileCheck,
      label: "E-Invoicing",
      value:
        einvoiceApplicability === "mandatory"
          ? "Mandatory"
          : einvoiceApplicability === "voluntary_enabled"
          ? "Voluntary"
          : "Disabled",
      type: "text" as const,
    },
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
          {/* LEFT + CENTER - Company Information Form & E-Invoicing Settings */}
          <div className="lg:col-span-2 space-y-6">
            {isMultiCompany && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary-light)]/40 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Building2 className="size-4 text-[var(--primary)] shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--text-primary)] truncate">
                        Active Workspace: {activeCompany?.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--card-bg)] border border-[var(--border)] text-[var(--primary)] shrink-0">
                        {companies.length} Companies
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      You are editing company information and GSP E-Invoice credentials for this specific company.
                    </p>
                  </div>
                </div>
                <Link
                  href="/settings/companies"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--page-bg)] transition-colors shadow-xs shrink-0 cursor-pointer"
                >
                  <span>Switch Company</span>
                  <ArrowRight className="size-3.5 text-[var(--primary)]" />
                </Link>
              </div>
            )}

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
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-semibold text-[var(--text-primary)]">
                      GSTIN <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[11px] font-mono text-[var(--text-faint)]">
                      {gstin.length}/15
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={15}
                    value={gstin}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase().slice(0, 15);
                      setGstin(val);
                      if (val.length >= 12 && !pan) {
                        const extractedPan = val.substring(2, 12);
                        if (/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(extractedPan)) {
                          setPan(extractedPan);
                        }
                      }
                    }}
                    className={`w-full h-10 px-3 rounded-lg border bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors uppercase font-mono ${
                      gstin && !validateGSTINInput(gstin).isValid
                        ? "border-red-500 focus:ring-red-500"
                        : "border-[var(--input-border)]"
                    }`}
                    placeholder="15-digit GSTIN (e.g. 24AABCU9603R1ZM)"
                  />
                  {gstin && !validateGSTINInput(gstin).isValid ? (
                    <p className="text-xs text-red-500 mt-1 font-medium">{validateGSTINInput(gstin).errorMessage}</p>
                  ) : gstin && validateGSTINInput(gstin).isValid ? (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium flex items-center gap-1">
                      ✓ Valid Company GSTIN: {validateGSTINInput(gstin).stateName} ({validateGSTINInput(gstin).stateCode})
                    </p>
                  ) : null}
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

            {/* GST E-Invoicing & IRP Integration */}
            <SettingsCard
              icon={ShieldCheck}
              iconBg="bg-[var(--primary-light)]"
              iconColor="text-[var(--primary)]"
              title="GST E-Invoicing & IRP Integration"
              subtitle="Configure government mandate applicability, AATO turnover rules, and IRP API credentials"
              headerRight={
                irpOnboardingStatus === "authorized" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="size-3.5" />
                    IRP Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    <Clock className="size-3.5" />
                    Verification Needed
                  </span>
                )
              }
            >
              <div className="space-y-5">
                {/* Applicability & Turnover Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
                      E-Invoicing Applicability <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={einvoiceApplicability}
                      onChange={(e) => setEinvoiceApplicability(e.target.value as any)}
                      className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                    >
                      <option value="mandatory">Mandatory (AATO &gt; ₹5 Cr Mandate)</option>
                      <option value="voluntary_enabled">Voluntary (Opted-in for E-Invoicing)</option>
                      <option value="not_enabled">Disabled (Standard GST Invoices)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
                      Turnover (AATO) Bracket <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={aatoBracket}
                      onChange={(e) => setAatoBracket(e.target.value as any)}
                      className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                    >
                      <option value="below_5cr">Turnover &lt; ₹5 Cr (4-digit HSN)</option>
                      <option value="5cr_to_10cr">Turnover ₹5 Cr – ₹10 Cr (6-digit HSN)</option>
                      <option value="10cr_and_above">Turnover ≥ ₹10 Cr (6-digit HSN + 30-Day Window)</option>
                    </select>
                  </div>
                </div>

                {/* Explanation banner */}
                <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-[var(--text-muted)]">
                  <Info className="size-4 text-[var(--primary)] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-[var(--text-primary)]">
                      Local Pre-Validation Rules Active:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] leading-relaxed">
                      <li>
                        Minimum HSN code length:{" "}
                        <strong className="text-[var(--text-primary)]">
                          {aatoBracket === "below_5cr" ? "4 Digits" : "6 Digits"}
                        </strong>
                      </li>
                      <li>
                        Invoice Reporting Window:{" "}
                        <strong className="text-[var(--text-primary)]">
                          {aatoBracket === "10cr_and_above"
                            ? "Strict 30 days from invoice date (IRP Rule)"
                            : "No 30-day cutoff restriction"}
                        </strong>
                      </li>
                      <li>
                        Auto-tax breakdown parity (Intra-state CGST+SGST vs Inter-state IGST) validated before API calls.
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Government E-Invoice API Authorization (IRIS GSP) */}
                <div className="border-t border-[var(--border-light)] pt-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="size-4 text-[var(--primary)]" />
                      <span>Government E-Invoice Portal Authorization (IRIS GSP)</span>
                    </h4>
                    {irpOnboardingStatus === "authorized" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--badge-green-bg)] text-[var(--badge-green-text)] self-start sm:self-auto">
                        <CheckCircle2 className="size-3" />
                        <span>GSTIN Authorized & Live</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--badge-amber-bg)] text-[var(--badge-amber-text)] self-start sm:self-auto">
                        <AlertCircle className="size-3" />
                        <span>Setup Required</span>
                      </span>
                    )}
                  </div>

                  {/* 4-Step Government Portal Authorization Explainer */}
                  <div className="rounded-xl border border-[var(--border-light)] bg-[var(--page-bg)] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                        <Info className="size-3.5 text-[var(--primary)]" />
                        How to Connect Your GSTIN (One-Time Government Portal Setup)
                      </span>
                      <a
                        href="https://einvoice1.gst.gov.in"
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[var(--primary)] hover:underline inline-flex items-center gap-1 font-medium"
                      >
                        Open GST Portal <ExternalLink className="size-3" />
                      </a>
                    </div>

                    <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-[var(--text-body)]">
                      <li className="flex items-start gap-2 bg-[var(--card-bg)] p-2.5 rounded-lg border border-[var(--border-light)]">
                        <span className="flex items-center justify-center size-5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] font-bold text-[11px] shrink-0">1</span>
                        <span>Log in to <strong className="text-[var(--text-primary)]">einvoice1.gst.gov.in</strong> with your company GST login.</span>
                      </li>
                      <li className="flex items-start gap-2 bg-[var(--card-bg)] p-2.5 rounded-lg border border-[var(--border-light)]">
                        <span className="flex items-center justify-center size-5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] font-bold text-[11px] shrink-0">2</span>
                        <span>Go to <strong className="text-[var(--text-primary)]">API Registration</strong> → <strong className="text-[var(--text-primary)]">Create API User</strong> → select <strong className="text-[var(--text-primary)]">Through GSP</strong>.</span>
                      </li>
                      <li className="flex items-start gap-2 bg-[var(--card-bg)] p-2.5 rounded-lg border border-[var(--border-light)]">
                        <span className="flex items-center justify-center size-5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] font-bold text-[11px] shrink-0">3</span>
                        <span>Select Authorized GSP: <strong className="text-[var(--text-primary)]">IRIS Business Services Limited</strong>.</span>
                      </li>
                      <li className="flex items-start gap-2 bg-[var(--card-bg)] p-2.5 rounded-lg border border-[var(--border-light)]">
                        <span className="flex items-center justify-center size-5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] font-bold text-[11px] shrink-0">4</span>
                        <span>Create a dedicated <strong className="text-[var(--text-primary)]">GSP API Username & Password</strong> and link it below.</span>
                      </li>
                    </ol>

                    <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] pt-1">
                      <Lock className="size-3.5 text-[var(--primary)] shrink-0" />
                      <span>
                        <strong>Security Safeguard:</strong> Never enter your main GST tax return password. Only enter the dedicated API User credentials created under &ldquo;Through GSP&rdquo;.
                      </span>
                    </div>
                  </div>

                  {/* State A: Already Connected & Authorized */}
                  {irpOnboardingStatus === "authorized" && !isEditingCredentials ? (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-light)]">
                        <div className="flex items-center gap-3">
                          <div className={`size-10 rounded-full ${data?.einvoiceAdapter?.isLive ? "bg-[var(--badge-green-bg)]" : "bg-amber-500/15"} flex items-center justify-center shrink-0`}>
                            <ShieldCheck className={`size-5 ${data?.einvoiceAdapter?.isLive ? "text-[var(--badge-green-text)]" : "text-amber-600 dark:text-amber-400"}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="text-sm font-bold text-[var(--text-primary)]">
                                {data?.einvoiceAdapter?.isLive ? "IRIS GSP Integration Active" : "Mock E-Invoice Simulator Mode"}
                              </h5>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                data?.einvoiceAdapter?.isLive
                                  ? "bg-[var(--badge-green-bg)] text-[var(--badge-green-text)]"
                                  : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                              }`}>
                                {data?.einvoiceAdapter?.isLive ? "Live Government Handshake" : "Offline Sandbox Simulation"}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">
                              {data?.einvoiceAdapter?.isLive
                                ? "E-Invoices and E-Way Bills are transmitted live to einvoice1.gst.gov.in."
                                : "Currently using local Mock Adapter. Invoices and QR codes are generated locally for testing and are NOT sent to the government portal."}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsEditingCredentials(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--page-bg)] border border-[var(--border)] rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
                        >
                          <KeyRound className="size-3.5" />
                          <span>Update Credentials</span>
                        </button>
                      </div>

                      {!data?.einvoiceAdapter?.isLive && (
                        <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
                          <AlertCircle className="size-4 shrink-0 mt-0.5" />
                          <div>
                            <strong className="font-bold">Notice: Live Government IRP Connection is NOT Active</strong>
                            <p className="mt-0.5 text-[11px] opacity-90 leading-relaxed">
                              Your development environment is running with <code className="font-mono font-bold bg-amber-500/20 px-1 py-0.5 rounded">EINVOICE_ADAPTER=mock</code>. Any test connection will only simulate validation locally. To connect to real government IRP servers, configure authorized IRIS GSP credentials in <code className="font-mono">.env.local</code> and set <code className="font-mono">EINVOICE_ADAPTER=iris</code>.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="p-3 rounded-lg bg-[var(--page-bg)] border border-[var(--border-light)]">
                          <span className="text-[11px] text-[var(--text-muted)] block mb-1">Taxpayer GSTIN</span>
                          <span className="font-mono font-bold text-[var(--text-primary)]">{gstin || "—"}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-[var(--page-bg)] border border-[var(--border-light)]">
                          <span className="text-[11px] text-[var(--text-muted)] block mb-1">GSP API Username</span>
                          <span className="font-mono font-bold text-[var(--text-primary)]">{gspApiUsername || "Configured"}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-[var(--page-bg)] border border-[var(--border-light)]">
                          <span className="text-[11px] text-[var(--text-muted)] block mb-1">Authorized GSP</span>
                          <span className="font-semibold text-[var(--text-primary)]">IRIS Business Services</span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                        <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5">
                          <Clock className="size-3.5" />
                          <span>
                            {irpTokenExpiry
                              ? `Current session valid until: ${new Date(irpTokenExpiry).toLocaleString()}`
                              : "Session active with IRIS GSP (auto-renewed via secure OTP protocol)."}
                          </span>
                        </p>
                        <button
                          type="button"
                          onClick={handleVerifyIrp}
                          disabled={isVerifying}
                          className="inline-flex items-center justify-center gap-1.5 px-4 h-9 rounded-lg border border-[var(--primary)]/30 bg-[var(--primary-light)] text-[var(--primary)] hover:opacity-90 font-semibold text-xs transition-all active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer shadow-xs"
                        >
                          {isVerifying ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" />
                              <span>Testing Live Session...</span>
                            </>
                          ) : (
                            <>
                              <RefreshCw className="size-3.5" />
                              <span>Test Live Connection</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* State B: Initial Setup or Updating Credentials */
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="text-sm font-semibold text-[var(--text-primary)]">
                            {isEditingCredentials ? "Update GSP API Credentials" : "Enter Government GSP API Credentials"}
                          </h5>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            Enter the username and password created on einvoice1.gst.gov.in under Through GSP.
                          </p>
                        </div>
                        {isEditingCredentials && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingCredentials(false);
                              setGspApiPassword("");
                            }}
                            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] underline cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
                            GSP API Username <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={gspApiUsername}
                            onChange={(e) => setGspApiUsername(e.target.value)}
                            className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors font-mono"
                            placeholder="e.g. gsp_taxpayer"
                          />
                          <p className="text-[11px] text-[var(--text-muted)] mt-1">
                            Username defined on einvoice1.gst.gov.in under API Registration
                          </p>
                        </div>

                        <div>
                          <label className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
                            GSP API Password <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="password"
                            value={gspApiPassword}
                            onChange={(e) => setGspApiPassword(e.target.value)}
                            className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors font-mono"
                            placeholder="••••••••••••"
                          />
                          <p className="text-[11px] text-[var(--text-muted)] mt-1">
                            Dedicated API user password (not your main tax filing password)
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-[var(--border-light)]">
                        <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5">
                          <Lock className="size-3.5 text-[var(--primary)] shrink-0" />
                          <span>Relayed securely server-to-server to IRIS for one-time government authorization. Never shown in plain text.</span>
                        </p>
                        <button
                          type="button"
                          onClick={handleVerifyIrp}
                          disabled={
                            isVerifying ||
                            !gspApiUsername?.trim() ||
                            !gspApiPassword?.trim() ||
                            !validateGSTINInput(gstin).isValid ||
                            gstin !== data?.business?.gstin
                          }
                          className="inline-flex items-center justify-center gap-1.5 px-4 h-9 rounded-lg bg-[var(--primary)] text-white hover:opacity-90 font-semibold text-xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer shadow-xs"
                          title={
                            !validateGSTINInput(gstin).isValid
                              ? "Please correct the Company GSTIN in Company Information above first"
                              : gstin !== data?.business?.gstin
                              ? "Please save your modified GSTIN using 'Save Changes' at the top right first"
                              : !gspApiPassword?.trim()
                              ? "Please enter your GSP API Password"
                              : "Authorize & Connect"
                          }
                        >
                          {isVerifying ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" />
                              <span>Authorizing with IRIS...</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="size-3.5" />
                              <span>Authorize & Connect GSTIN</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
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
