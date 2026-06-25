"use client";

import { useEffect, useState } from "react";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { SettingsToggleRow } from "@/components/settings/SettingsToggleRow";
import { SettingsPreviewCard } from "@/components/settings/SettingsPreviewCard";
import { InfoBanner } from "@/components/shared/InfoBanner";
import {
  Factory,
  SlidersHorizontal,
  ChevronRight,
  ChevronDown,
  Warehouse,
  FileText,
  Save,
  Info,
} from "lucide-react";
import { toast } from "sonner";

interface Stage {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
}

interface Godown {
  id: string;
  name: string;
}

const MOCK_STAGES: Stage[] = [
  { id: "1", name: "Cutting", icon: "✂", color: "#EF4444", sort_order: 1 },
  { id: "2", name: "Stitching", icon: "🧵", color: "#3B82F6", sort_order: 2 },
  { id: "3", name: "Finishing", icon: "⚡", color: "#F59E0B", sort_order: 3 },
  { id: "4", name: "Quality Check", icon: "✓", color: "#10B981", sort_order: 4 },
  { id: "5", name: "Packing", icon: "📦", color: "#8B5CF6", sort_order: 5 },
];

export default function ProductionSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Lists
  const [stages, setStages] = useState<Stage[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);

  // Settings states
  const [jobWorkBillType, setJobWorkBillType] = useState("Job Work In");
  const [autoCompleteLot, setAutoCompleteLot] = useState(true);
  const [allowBackDateProduction, setAllowBackDateProduction] = useState(false);
  const [lockCompletedLots, setLockCompletedLots] = useState(true);
  const [defaultGodownId, setDefaultGodownId] = useState(""); // Default Work Center

  const fetchProductionSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/production");
      if (!res.ok) throw new Error("Failed to load production settings");
      const data = await res.json();

      if (data.settings) {
        setJobWorkBillType(data.settings.job_work_default_bill_type || "Job Work In");
        setAutoCompleteLot(data.settings.auto_complete_lot ?? true);
        setAllowBackDateProduction(data.settings.allow_back_date_production ?? false);
        setLockCompletedLots(data.settings.lock_completed_lots ?? true);
        setDefaultGodownId(data.settings.default_godown_id || "");
      }

      setStages(data.stages && data.stages.length > 0 ? data.stages : MOCK_STAGES);
      setGodowns(data.godowns || []);
    } catch (err: any) {
      toast.error(err.message || "Error loading production settings");
      setStages(MOCK_STAGES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductionSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/production", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_work_default_bill_type: jobWorkBillType,
          auto_complete_lot: autoCompleteLot,
          allow_back_date_production: allowBackDateProduction,
          lock_completed_lots: lockCompletedLots,
          default_godown_id: defaultGodownId,
          // Staging sort orders of stages if they were reordered (currently static in UI)
          stages: stages.map((s, idx) => ({ id: s.id, sort_order: idx + 1 })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update production settings");

      toast.success("Production settings saved successfully");
      fetchProductionSettings();
    } catch (err: any) {
      toast.error(err.message || "Error saving production settings");
    } finally {
      setSaving(false);
    }
  };

  // Preview helper values
  const getStageFlowString = () => {
    return stages.map((s) => s.name).join(" → ");
  };

  const getWorkCenterName = () => {
    const center = godowns.find((g) => g.id === defaultGodownId);
    return center ? center.name : "Main Production Unit";
  };

  const previewRows = [
    {
      icon: Factory,
      label: "Default Stage Flow",
      value: getStageFlowString(),
      type: "text" as const,
    },
    {
      icon: FileText,
      label: "Job Work Bill Type",
      value: jobWorkBillType,
      type: "text" as const,
    },
    {
      icon: SlidersHorizontal,
      label: "Auto-complete Lot",
      value: autoCompleteLot,
      type: "badge" as const,
    },
  ];

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <span className="text-sm font-semibold text-slate-500 animate-pulse">
          Loading production settings...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 text-left">
      <SettingsPageHeader
        section="Production"
        title="Settings > Production"
        subtitle="Manage production related preferences"
        actionLabel="Save Changes"
        onAction={handleSave}
        actionIcon={<Save className="size-4 text-white" />}
        actionLoading={saving}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT + CENTER AREA */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* CARD 1 — Production Preferences */}
          <SettingsCard
            icon={Factory}
            title="Production Preferences"
            subtitle="Configure production process and defaults"
          >
            <div className="flex flex-col gap-6">
              {/* SECTION A — Default Production Stage Flow */}
              <div>
                <label className="text-sm font-semibold text-[#374151] block mb-1">
                  Default Production Stage Flow
                </label>
                <p className="text-xs text-[#94A3B8] mb-3">
                  Define and manage the default stage sequence for production
                </p>

                {/* Horizontal scroll flow */}
                <div className="flex items-center gap-2 overflow-x-auto pb-3 pt-1 select-none scrollbar-thin">
                  {stages.map((stage, idx) => (
                    <div key={stage.id} className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white text-sm text-[#374151] font-medium shadow-sm hover:shadow-md transition-shadow">
                        <span
                          style={{ color: stage.color || "#6366F1" }}
                          className="font-semibold"
                        >
                          {stage.icon || "•"}
                        </span>
                        <span>{stage.name}</span>
                        {idx === stages.length - 1 && (
                          <ChevronDown size={14} className="text-[#94A3B8] ml-1 shrink-0" />
                        )}
                      </div>
                      {idx < stages.length - 1 && (
                        <ChevronRight size={14} className="text-[#94A3B8] shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION B — Job Work Bill Type */}
              <div>
                <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                  Job Work Bill Type (Default) <span className="text-[#DC2626]">*</span>
                </label>
                <select
                  value={jobWorkBillType}
                  onChange={(e) => setJobWorkBillType(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                >
                  <option value="Job Work In">Job Work In</option>
                  <option value="Job Work Out">Job Work Out</option>
                  <option value="Ask Each Time">Ask Each Time</option>
                </select>
              </div>

              {/* SECTION C — Auto-complete Lot Toggle */}
              <div className="border-t border-[#F3F4F6] pt-3">
                <SettingsToggleRow
                  icon={SlidersHorizontal}
                  label="Auto-complete Lot"
                  subtitle="Automatically complete lot when all operations are finished"
                  checked={autoCompleteLot}
                  onCheckedChange={setAutoCompleteLot}
                  className="border-b-0"
                />
              </div>
            </div>
          </SettingsCard>

          {/* CARD 2 — Production Advanced Settings */}
          <SettingsCard
            icon={SlidersHorizontal}
            title="Production Advanced Settings"
            subtitle="Additional production configurations"
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col">
                <SettingsToggleRow
                  icon={SlidersHorizontal}
                  label="Allow Back Date Production"
                  subtitle="Allow creating production entries with back dates"
                  checked={allowBackDateProduction}
                  onCheckedChange={setAllowBackDateProduction}
                />
                <SettingsToggleRow
                  icon={SlidersHorizontal}
                  label="Lock Completed Lots"
                  subtitle="Prevent editing of completed lots"
                  checked={lockCompletedLots}
                  onCheckedChange={setLockCompletedLots}
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                  Default Work Center
                </label>
                <select
                  value={defaultGodownId}
                  onChange={(e) => setDefaultGodownId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                >
                  <option value="">Main Production Unit</option>
                  {godowns.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <InfoBanner
                variant="info"
                text="These production settings will be applied across all production modules."
              />
            </div>
          </SettingsCard>
        </div>

        {/* RIGHT COLUMN - Preview */}
        <div>
          <SettingsPreviewCard
            title="Preview"
            subtitle="Current Production Settings"
            rows={previewRows}
          >
            <div className="flex flex-col gap-3 text-sm text-[#64748B]">
              <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-2 text-xs font-semibold text-slate-700 select-none">
                <span>Default Work Center</span>
                <span>{getWorkCenterName()}</span>
              </div>
              <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-2 text-xs font-semibold text-slate-700 select-none">
                <span>Back Date Production</span>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    allowBackDateProduction ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  {allowBackDateProduction ? "Allowed" : "Locked"}
                </span>
              </div>

              {/* About Production settings */}
              <div className="bg-[#EFF6FF] rounded-lg p-3 mt-2 flex items-start gap-2">
                <Info className="size-4 text-[#1D4ED8] shrink-0 mt-0.5" />
                <div className="text-left">
                  <span className="text-xs font-semibold text-[#1D4ED8] block">
                    About Production Settings
                  </span>
                  <span className="text-[11px] text-[#64748B] block mt-1 leading-snug">
                    These rules govern raw materials deductions, batch stage timelines, and lot lock states on complete operations.
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
