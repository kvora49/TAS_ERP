"use client";

import { useEffect, useState } from "react";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { SettingsToggleRow } from "@/components/settings/SettingsToggleRow";
import { SettingsPreviewCard } from "@/components/settings/SettingsPreviewCard";
import { InfoBanner } from "@/components/shared/InfoBanner";
import {
  Settings2,
  SlidersHorizontal,
  Save,
  CheckCircle2,
  Receipt,
  Boxes,
  Hash,
  BellRing,
  TrendingDown,
  Globe,
  DollarSign,
  Calendar,
  Clock,
  LayoutGrid,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";

export default function GeneralSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState<string | null>(null);

  // Form states
  const [businessName, setBusinessName] = useState("");
  const [currency, setCurrency] = useState("INR (₹) - Indian Rupee");
  const [dateFormat, setDateFormat] = useState("DD MMM YYYY (31 May 2024)");
  const [timezone, setTimezone] = useState("(GMT+05:30) Asia/Kolkata");

  const [itemsPerPage, setItemsPerPage] = useState("10 items");

  // Preference states
  const [enableGst, setEnableGst] = useState(true);
  const [enableBatchTracking, setEnableBatchTracking] = useState(true);
  const [enableSerialNumbers, setEnableSerialNumbers] = useState(false);
  const [lowStockAlerts, setLowStockAlerts] = useState(true);
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);

  // Fetch initial settings
  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/general");
      if (!res.ok) throw new Error("Failed to load settings");
      const data = await res.json();
      
      if (data.business) {
        setBusinessName(data.business.name || "");
        setCurrency(data.business.currency || "INR (₹) - Indian Rupee");
        setDateFormat(data.business.date_format || "DD MMM YYYY (31 May 2024)");
        setTimezone(data.business.timezone || "(GMT+05:30) Asia/Kolkata");
        setItemsPerPage(data.business.items_per_page ? `${data.business.items_per_page} items` : "10 items");
        setEnableGst(data.business.enable_gst ?? true);
        setEnableBatchTracking(data.business.enable_batch_tracking ?? true);
        setAllowNegativeStock(data.business.allow_negative_stock ?? false);
        setLowStockAlerts(data.business.low_stock_alerts ?? true);
        setVersion(data.business.updated_at);
      }

      if (data.settings) {
        setEnableSerialNumbers(data.settings.enable_serial_numbers ?? false);
      }
    } catch (err: any) {
      toast.error(err.message || "Error loading settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const numericItems = parseInt(itemsPerPage) || 10;
      
      const res = await fetch("/api/settings/general", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: businessName,
          currency,
          date_format: dateFormat,
          timezone,
          items_per_page: numericItems,
          enable_gst: enableGst,
          enable_batch_tracking: enableBatchTracking,
          enable_serial_numbers: enableSerialNumbers,
          low_stock_alerts: lowStockAlerts,
          allow_negative_stock: allowNegativeStock,
          client_updated_at: version,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update settings");
      }

      toast.success("Settings updated successfully");
      fetchSettings(); // reload to get new updated_at version
    } catch (err: any) {
      toast.error(err.message || "Error saving settings");
    } finally {
      setSaving(false);
    }
  };

  // Preview formatting helper
  const getShortDateFormat = (longFmt: string) => {
    if (longFmt.includes("DD MMM YYYY")) return "DD MMM YYYY";
    return longFmt;
  };

  // Live preview rows
  const previewRows = [
    { icon: FileSpreadsheet, label: "Business Name", value: businessName || "—", type: "text" as const },
    { icon: DollarSign, label: "Currency", value: currency, type: "text" as const },
    { icon: Calendar, label: "Date Format", value: getShortDateFormat(dateFormat), type: "text" as const },
    { icon: Clock, label: "Time Zone", value: timezone.split(" ").slice(1).join(" ") || timezone, type: "text" as const },

    { icon: LayoutGrid, label: "Items Per Page", value: itemsPerPage, type: "text" as const },
  ];

  // Calculate active preferences count
  const activePrefs = [
    { name: "Enable GST", active: enableGst },
    { name: "Enable Batch Tracking", active: enableBatchTracking },
    { name: "Enable Serial Numbers", active: enableSerialNumbers },
    { name: "Low Stock Alerts", active: lowStockAlerts },
    { name: "Allow Negative Stock", active: allowNegativeStock },
  ].filter((p) => p.active);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <span className="text-sm font-semibold text-slate-500 animate-pulse">
          Loading general settings...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsPageHeader
        section="General"
        title="Settings"
        subtitle="Manage general system configuration and preferences"
        actionLabel="Save Changes"
        onAction={handleSave}
        actionIcon={<Save className="size-4 text-white" />}
        actionLoading={saving}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN - General Settings Form */}
        <SettingsCard
          icon={Settings2}
          title="General Settings"
          subtitle="Manage general system configuration"
        >
          <div className="flex flex-col gap-5 text-left">
            <div>
              <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                Business Name
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                placeholder="e.g. ABC Garments"
              />
              <p className="text-xs text-[#94A3B8] mt-1.5">
                Your business name as it appears in documents
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
              >
                <option value="INR (₹) - Indian Rupee">INR (₹) - Indian Rupee</option>
                <option value="USD ($) - US Dollar">USD ($) - US Dollar</option>
                <option value="EUR (€) - Euro">EUR (€) - Euro</option>
                <option value="GBP (£) - British Pound">GBP (£) - British Pound</option>
              </select>
              <p className="text-xs text-[#94A3B8] mt-1.5">
                Default currency for transactions
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                Date Format
              </label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="w-full h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
              >
                <option value="DD MMM YYYY (31 May 2024)">DD MMM YYYY (31 May 2024)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (2024-05-31)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (05/31/2024)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY (31/05/2024)</option>
              </select>
              <p className="text-xs text-[#94A3B8] mt-1.5">
                Choose the default date format
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                Time Zone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
              >
                <option value="(GMT+05:30) Asia/Kolkata">(GMT+05:30) Asia/Kolkata</option>
                <option value="(GMT+00:00) UTC">(GMT+00:00) UTC</option>
                <option value="(GMT-05:00) Eastern Time">(GMT-05:00) Eastern Time</option>
              </select>
              <p className="text-xs text-[#94A3B8] mt-1.5">System time zone</p>
            </div>



            <div>
              <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                Items Per Page
              </label>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(e.target.value)}
                className="w-full h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
              >
                <option value="10 items">10 items</option>
                <option value="25 items">25 items</option>
                <option value="50 items">50 items</option>
                <option value="100 items">100 items</option>
              </select>
              <p className="text-xs text-[#94A3B8] mt-1.5">
                Number of items to show in tables
              </p>
            </div>
          </div>
        </SettingsCard>

        {/* CENTER COLUMN - System Preferences */}
        <SettingsCard
          icon={SlidersHorizontal}
          title="System Preferences"
          subtitle="Set system-wide preferences"
        >
          <div className="flex flex-col gap-0 text-left">
            <SettingsToggleRow
              icon={Receipt}
              label="Enable GST"
              subtitle="Enable GST features and calculations"
              checked={enableGst}
              onCheckedChange={setEnableGst}
            />
            <SettingsToggleRow
              icon={Boxes}
              label="Enable Batch Tracking"
              subtitle="Track inventory by batches"
              checked={enableBatchTracking}
              onCheckedChange={setEnableBatchTracking}
            />
            <SettingsToggleRow
              icon={Hash}
              label="Enable Serial Numbers"
              subtitle="Track items by serial numbers"
              checked={enableSerialNumbers}
              onCheckedChange={setEnableSerialNumbers}
            />
            <SettingsToggleRow
              icon={BellRing}
              label="Low Stock Alerts"
              subtitle="Show alerts for low stock items"
              checked={lowStockAlerts}
              onCheckedChange={setLowStockAlerts}
            />
            <SettingsToggleRow
              icon={TrendingDown}
              label="Allow Negative Stock"
              subtitle="Allow issuing stock even if insufficient"
              checked={allowNegativeStock}
              onCheckedChange={setAllowNegativeStock}
            />
          </div>
        </SettingsCard>

        {/* RIGHT COLUMN - Preview */}
        <div className="flex flex-col gap-6">
          <SettingsPreviewCard
            title="Preview"
            subtitle="Current Settings Summary"
            rows={previewRows}
          >
            <div>
              <h4 className="text-sm font-semibold text-[#15803D] mb-3 text-left">
                Active Preferences ({activePrefs.length})
              </h4>
              <div className="flex flex-col gap-1.5">
                {activePrefs.map((pref, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 text-left">
                    <CheckCircle2 className="size-4 text-[#15803D] shrink-0" />
                    <span className="text-sm text-[#374151]">{pref.name}</span>
                  </div>
                ))}
                {activePrefs.length === 0 && (
                  <span className="text-xs text-[#94A3B8] italic text-left block">
                    No active preferences
                  </span>
                )}
              </div>
            </div>
          </SettingsPreviewCard>
        </div>
      </div>

      {/* BOTTOM - Full width info banner */}
      <div className="w-full">
        <InfoBanner
          variant="info"
          text="These settings will be applied across the entire system."
          className="mt-0"
        />
      </div>
    </div>
  );
}
