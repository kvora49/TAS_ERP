"use client";

import { useEffect, useState, useRef } from "react";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { SettingsPreviewCard } from "@/components/settings/SettingsPreviewCard";
import { useFileUpload } from "@/hooks/useFileUpload";
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

export default function CompanyProfileSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/company-profile");
      if (!res.ok) throw new Error("Failed to load company profile");
      const data = await res.json();
      if (data.business) {
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
    } catch (err: any) {
      toast.error(err.message || "Error fetching company profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSave = async () => {
    if (!name || !gstin || !address || !phone || !email || !fiscalYear || !currency) {
      toast.error("Please fill in all required fields (*)");
      return;
    }

    setSaving(true);
    try {
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

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile");

      toast.success("Company profile updated successfully");
      fetchProfile();
    } catch (err: any) {
      toast.error(err.message || "Error saving company profile");
    } finally {
      setSaving(false);
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
      toast.success("Logo uploaded successfully");
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

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <span className="text-sm font-semibold text-slate-500 animate-pulse">
          Loading company profile...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 text-left">
      <SettingsPageHeader
        section="Company Profile"
        title="Settings - Company Profile"
        subtitle="Manage your company's profile, logo and contact details"
        actionLabel="Save Changes"
        onAction={handleSave}
        actionIcon={<Save className="size-4 text-white" />}
        actionLoading={saving}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT + CENTER - Company Information Form */}
        <div className="lg:col-span-2">
          <SettingsCard icon={Building2} title="Company Information">
            {/* Logo Row */}
            <div className="flex flex-col sm:flex-row items-start gap-6 mb-6">
              {/* Current Preview */}
              <div className="flex flex-col items-center">
                <div className="w-32 h-32 rounded-xl border border-[#E5E7EB] overflow-hidden bg-[#F8FAFC] flex items-center justify-center relative">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Company Logo" className="object-contain w-full h-full" />
                  ) : (
                    <Building className="size-12 text-[#94A3B8]" />
                  )}
                  {uploading && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                      <span className="text-xs font-semibold text-[#6366F1] animate-pulse">
                        Uploading...
                      </span>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-[#94A3B8] mt-2 font-medium">
                  Recommended size: 300x300px
                </span>
              </div>

              {/* Upload Zone */}
              <div
                onClick={triggerFileSelect}
                className="w-full max-w-sm h-32 border-2 border-dashed border-[#D1D5DB] rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-[#6366F1] hover:bg-[#F8FAFC] transition-colors p-4"
              >
                <CloudUpload className="size-7 text-[#94A3B8]" />
                <span className="text-sm font-semibold text-[#374151] mt-1">Upload Logo</span>
                <span className="text-[10px] text-[#94A3B8]">PNG, JPG or SVG • Max 2MB</span>
                <button
                  type="button"
                  className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white hover:bg-slate-50 transition-colors shadow-sm"
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
                <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                  Company Name <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                  placeholder="Company Name"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                  GSTIN <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                  placeholder="GST Number"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                  Full Address <span className="text-[#DC2626]">*</span>
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full h-28 px-3 py-2.5 rounded-lg border border-[#D1D5DB] text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all resize-none"
                  placeholder="Company Address"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                  PAN
                </label>
                <input
                  type="text"
                  value={pan}
                  onChange={(e) => setPan(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                  placeholder="PAN Card Number"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                  Phone <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                  placeholder="Phone Number"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                  Email <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                  placeholder="Email Address"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                  Website
                </label>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                  placeholder="Website URL"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                  Default Currency <span className="text-[#DC2626]">*</span>
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                >
                  <option value="INR (₹)">INR (₹) - Rupee</option>
                  <option value="USD ($)">USD ($) - Dollar</option>
                  <option value="EUR (€)">EUR (€) - Euro</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                  Fiscal Year <span className="text-[#DC2626]">*</span>
                </label>
                <select
                  value={fiscalYear}
                  onChange={(e) => setFiscalYear(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
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
            <div className="flex flex-col gap-3.5 text-sm text-[#64748B]">
              {website && (
                <div className="flex items-center justify-between">
                  <span>Website</span>
                  <a
                    href={website.startsWith("http") ? website : `https://${website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#6366F1] hover:underline flex items-center gap-1 font-semibold"
                  >
                    Visit <ExternalLink className="size-3" />
                  </a>
                </div>
              )}
              {address && (
                <div className="flex flex-col gap-1 text-left">
                  <span className="font-semibold text-slate-700">Billing Address</span>
                  <p className="text-xs text-slate-500 whitespace-pre-wrap leading-relaxed">
                    {address}
                  </p>
                </div>
              )}
              <div className="flex items-center gap-1.5 justify-between">
                <span>Fiscal Year</span>
                <span className="font-semibold text-slate-700">{fiscalYear}</span>
              </div>
              <div className="flex items-center gap-1.5 justify-between">
                <span>Currency</span>
                <span className="font-semibold text-slate-700">{currency}</span>
              </div>

              {/* Info Note Block */}
              <div className="bg-[#EFF6FF] rounded-lg p-3 mt-2 flex items-start gap-2">
                <Info className="size-4 text-[#6366F1] shrink-0 mt-0.5" />
                <div className="text-left">
                  <span className="text-xs font-semibold text-[#1D4ED8] block">Note</span>
                  <span className="text-[11px] text-[#64748B] block mt-1 leading-snug">
                    Company profile details will be used in invoices, reports and other documents.
                  </span>
                </div>
              </div>
            </div>
          </SettingsPreviewCard>
        </div>
      </div>
    </div>
  );
}
