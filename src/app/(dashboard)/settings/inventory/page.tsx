"use client";

import { useEffect, useState } from "react";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { SettingsToggleRow } from "@/components/settings/SettingsToggleRow";
import { SettingsPreviewCard } from "@/components/settings/SettingsPreviewCard";
import { InfoBanner } from "@/components/shared/InfoBanner";
import {
  Package,
  Bell,
  Eye,
  Info,
  Warehouse,
  AlertCircle,
  Save,
  Boxes,
  Hash,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";

interface Godown {
  id: string;
  name: string;
}

export default function InventorySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Godowns list
  const [godowns, setGodowns] = useState<Godown[]>([]);

  // Settings states
  const [defaultGodownId, setDefaultGodownId] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [enableBatchTracking, setEnableBatchTracking] = useState(true);
  const [enableSerialNumbers, setEnableSerialNumbers] = useState(false);
  const [valuationMethod, setValuationMethod] = useState("fifo");

  const fetchInventorySettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/inventory");
      if (!res.ok) throw new Error("Failed to load inventory settings");
      const data = await res.json();

      if (data.settings) {
        setDefaultGodownId(data.settings.default_godown_id || "");
        setLowStockThreshold(data.settings.low_stock_threshold || 10);
        setAllowNegativeStock(data.settings.allow_negative_stock ?? false);
        setEnableBatchTracking(data.settings.enable_batch_tracking ?? true);
        setEnableSerialNumbers(data.settings.enable_serial_numbers ?? false);
        setValuationMethod(data.settings.stock_valuation_method || "fifo");
      }

      setGodowns(data.godowns || []);
    } catch (err: any) {
      toast.error(err.message || "Error loading inventory settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventorySettings();
  }, []);

  const handleSave = async () => {
    if (!defaultGodownId) {
      toast.error("Please select a default godown");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/settings/inventory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          default_godown_id: defaultGodownId,
          low_stock_threshold: lowStockThreshold,
          allow_negative_stock: allowNegativeStock,
          enable_batch_tracking: enableBatchTracking,
          enable_serial_numbers: enableSerialNumbers,
          stock_valuation_method: valuationMethod,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update inventory settings");

      toast.success("Inventory settings updated successfully");
      fetchInventorySettings();
    } catch (err: any) {
      toast.error(err.message || "Error saving inventory settings");
    } finally {
      setSaving(false);
    }
  };

  // Find godown name for preview
  const getGodownName = () => {
    const godown = godowns.find((g) => g.id === defaultGodownId);
    return godown ? godown.name : "None selected";
  };

  // Format valuation method label
  const getValuationLabel = () => {
    const methods: Record<string, string> = {
      fifo: "FIFO (First In First Out)",
      lifo: "LIFO (Last In First Out)",
      avg: "Average Cost",
      manual: "Manual",
    };
    return methods[valuationMethod] || valuationMethod.toUpperCase();
  };

  const previewRows = [
    { icon: Warehouse, label: "Default Godown", value: getGodownName(), type: "text" as const },
    { icon: AlertCircle, label: "Low Stock Threshold", value: `${lowStockThreshold} items`, type: "text" as const },
    { icon: TrendingDown, label: "Allow Negative Stock", value: allowNegativeStock, type: "badge" as const },
    { icon: Boxes, label: "Enable Batch Tracking", value: enableBatchTracking, type: "badge" as const },
    { icon: Hash, label: "Enable Serial Numbers", value: enableSerialNumbers, type: "badge" as const },
  ];

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <span className="text-sm font-semibold text-slate-500 animate-pulse">
          Loading inventory preferences...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 text-left">
      <SettingsPageHeader
        section="Inventory"
        title="Settings > Inventory"
        subtitle="Manage inventory related preferences"
        actionLabel="Save Changes"
        onAction={handleSave}
        actionIcon={<Save className="size-4 text-white" />}
        actionLoading={saving}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT + CENTER columns */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* CARD 1 — Inventory Preferences */}
          <SettingsCard
            icon={Package}
            title="Inventory Preferences"
            subtitle="Configure inventory behavior and defaults"
          >
            <div className="flex flex-col gap-5">
              <div>
                <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                  Default Godown <span className="text-[#DC2626]">*</span>
                </label>
                <select
                  value={defaultGodownId}
                  onChange={(e) => setDefaultGodownId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                >
                  <option value="">Select Godown...</option>
                  {godowns.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[#94A3B8] mt-1.5">
                  Select the default godown for all inventory transactions
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                  Low Stock Alert Threshold <span className="text-[#DC2626]">*</span>
                </label>
                <div className="flex w-full">
                  <input
                    type="number"
                    min="0"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                    className="flex-1 h-10 px-3 rounded-l-lg border border-r-0 border-[#D1D5DB] text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                    placeholder="10"
                  />
                  <span className="h-10 px-4 bg-[#F9FAFB] border border-[#D1D5DB] rounded-r-lg text-sm text-[#64748B] flex items-center justify-center font-medium">
                    items
                  </span>
                </div>
                <p className="text-xs text-[#94A3B8] mt-1.5">
                  Minimum quantity to trigger low stock alert
                </p>
              </div>

              {/* Toggles */}
              <div className="border-t border-[#F3F4F6] pt-3 flex flex-col">
                <SettingsToggleRow
                  icon={TrendingDown}
                  label="Allow Negative Stock"
                  subtitle="Allow issuing stock even if insufficient"
                  checked={allowNegativeStock}
                  onCheckedChange={setAllowNegativeStock}
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
              </div>
            </div>
          </SettingsCard>

          {/* CARD 2 — Stock Valuation Method */}
          <SettingsCard
            icon={Bell}
            title="Stock Valuation Method"
            subtitle="Select the method for valuing stock"
          >
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                  Valuation Method
                </label>
                <select
                  value={valuationMethod}
                  onChange={(e) => setValuationMethod(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                >
                  <option value="fifo">FIFO (First In First Out)</option>
                  <option value="lifo">LIFO (Last In First Out)</option>
                  <option value="avg">Average Cost</option>
                  <option value="manual">Manual</option>
                </select>
                <p className="text-xs text-[#94A3B8] mt-1.5">
                  This method will be used for stock valuation and cost calculation
                </p>
              </div>

              <InfoBanner
                variant="info"
                text="Inventory settings will be applied across the entire system."
              />
            </div>
          </SettingsCard>
        </div>

        {/* RIGHT COLUMN - Preview */}
        <div>
          <SettingsPreviewCard
            title="Preview"
            subtitle="Current Inventory Settings"
            rows={previewRows}
          >
            <div className="flex flex-col gap-3 text-sm text-[#64748B]">
              <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-2 text-xs font-semibold text-slate-700 select-none">
                <span>Valuation Method</span>
                <span>{getValuationLabel()}</span>
              </div>

              {/* About note box */}
              <div className="bg-[#EFF6FF] rounded-lg p-3 mt-2 flex items-start gap-2">
                <Info className="size-4 text-[#1D4ED8] shrink-0 mt-0.5" />
                <div className="text-left">
                  <span className="text-xs font-semibold text-[#1D4ED8] block">
                    About Inventory Settings
                  </span>
                  <span className="text-[11px] text-[#64748B] block mt-1 leading-snug">
                    These preferences control how inventory is managed in the system. Changes will affect new transactions going forward.
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
