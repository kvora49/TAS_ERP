"use client";

import { useEffect, useState } from "react";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { SettingsToggleRow } from "@/components/settings/SettingsToggleRow";
import { Switch } from "@/components/ui/switch";
import { InfoBanner } from "@/components/shared/InfoBanner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  Calendar,
  Receipt,
  Settings2,
  Plus,
  Pencil,
  Trash2,
  Info,
  Save,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface Brand {
  id: string;
  name: string;
  bill_prefix_pakka: string | null;
  bill_prefix_kacha: string | null;
  design_prefix: string | null;
  design_separator: string;
  design_digits: number;
}

export default function FinancialSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Financial general preference states
  const [defaultCreditDays, setDefaultCreditDays] = useState(0);
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState("30_days");
  const [defaultTdsType, setDefaultTdsType] = useState("194C");
  const [roundOffMethod, setRoundOffMethod] = useState("two_decimals");
  const [enableCashRounding, setEnableCashRounding] = useState(true);

  // Brands list
  const [brands, setBrands] = useState<Brand[]>([]);

  // Editing dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [editPakka, setEditPakka] = useState("");
  const [editKacha, setEditKacha] = useState("");
  const [editSeparator, setEditSeparator] = useState("/");
  const [editDigits, setEditDigits] = useState(5);

  const fetchFinancialSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/financial");
      if (!res.ok) throw new Error("Failed to load financial settings");
      const data = await res.json();
      
      if (data.settings) {
        setDefaultCreditDays(data.settings.default_credit_days || 0);
        setDefaultPaymentTerms(data.settings.default_payment_terms || "30_days");
        setDefaultTdsType(data.settings.default_tds_type || "194C");
        setRoundOffMethod(data.settings.round_off_method || "two_decimals");
        setEnableCashRounding(data.settings.enable_cash_rounding ?? true);
      }

      setBrands(data.brands || []);
    } catch (err: any) {
      toast.error(err.message || "Error fetching financial settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancialSettings();
  }, []);

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/financial", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          default_credit_days: defaultCreditDays,
          default_payment_terms: defaultPaymentTerms,
          default_tds_type: defaultTdsType,
          round_off_method: roundOffMethod,
          enable_cash_rounding: enableCashRounding,
          brands, // Save any local updates to brands
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update financial settings");

      toast.success("Financial settings saved successfully");
      fetchFinancialSettings();
    } catch (err: any) {
      toast.error(err.message || "Error saving financial settings");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEditBrand = (brand: Brand) => {
    setEditingBrand(brand);
    setEditPakka(brand.bill_prefix_pakka || "");
    setEditKacha(brand.bill_prefix_kacha || "");
    setEditSeparator(brand.design_separator || "/");
    setEditDigits(Number(brand.design_digits || 5));
    setEditDialogOpen(true);
  };

  const handleSaveBrandEdit = () => {
    if (!editingBrand) return;

    setBrands((prev) =>
      prev.map((b) => {
        if (b.id === editingBrand.id) {
          return {
            ...b,
            bill_prefix_pakka: editPakka,
            bill_prefix_kacha: editKacha,
            design_separator: editSeparator,
            design_digits: editDigits,
          };
        }
        return b;
      })
    );

    setEditDialogOpen(false);
    toast.info("Brand changes staged locally. Click 'Save Changes' at the top to commit.");
  };

  const getNextNumberPreview = (brand: Brand) => {
    const pakka = brand.bill_prefix_pakka || "PK";
    const separator = brand.design_separator || "/";
    const digits = brand.design_digits || 5;
    const yearSuffix = "26-27"; // static standard representation for mockup preview
    const nextVal = "1".padStart(Number(digits), "0");
    return `${pakka}${separator}${yearSuffix}${separator}${nextVal}`;
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <span className="text-sm font-semibold text-slate-500 animate-pulse">
          Loading financial preferences...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 text-left">
      <SettingsPageHeader
        section="Financial"
        title="Settings > Financial"
        subtitle="Configure financial preferences and defaults"
        actionLabel="Save Changes"
        onAction={handleSaveAll}
        actionIcon={<Save className="size-4 text-white" />}
        actionLoading={saving}
      />

      {/* CARD 1 — Bill Series Configuration */}
      <SettingsCard
        icon={FileText}
        title="Bill Series Configuration"
        subtitle="Configure bill numbering series for each brand"
        headerRight={
          <button
            type="button"
            onClick={() => toast.info("To add a new series, please create a new Brand in Master Data.")}
            className="border border-[#E5E7EB] bg-white h-9 px-3 rounded-lg text-sm font-semibold hover:bg-slate-50 shadow-sm cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="size-4" /> Add Series
          </button>
        }
      >
        <div className="overflow-x-auto border border-[#E5E7EB] rounded-lg">
          <table className="w-full text-sm text-[#374151]">
            <thead className="bg-[#F9FAFB] text-xs font-semibold text-[#64748B] uppercase tracking-wider h-10">
              <tr>
                <th className="px-4 py-2 text-left">Brand</th>
                <th className="px-4 py-2 text-left">Series Type</th>
                <th className="px-4 py-2 text-left">Prefix (Pakka)</th>
                <th className="px-4 py-2 text-left">Prefix (Kacha)</th>
                <th className="px-4 py-2 text-left">Separator</th>
                <th className="px-4 py-2 text-center">Digits</th>
                <th className="px-4 py-2 text-left">Reset Frequency</th>
                <th className="px-4 py-2 text-left">Next Number</th>
                <th className="px-4 py-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {brands.map((b) => (
                <tr key={b.id} className="hover:bg-[#F8FAFC] h-14">
                  <td className="px-4 py-2 font-semibold text-[#374151]">{b.name}</td>
                  <td className="px-4 py-2">Invoice</td>
                  <td className="px-4 py-2 font-mono">{b.bill_prefix_pakka || "PK"}</td>
                  <td className="px-4 py-2 font-mono">{b.bill_prefix_kacha || "KC"}</td>
                  <td className="px-4 py-2">{b.design_separator || "/"}</td>
                  <td className="px-4 py-2 text-center">{b.design_digits || 5}</td>
                  <td className="px-4 py-2">Every Financial Year</td>
                  <td className="px-4 py-2 font-mono">{getNextNumberPreview(b)}</td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleOpenEditBrand(b)}
                        className="w-8 h-8 border border-[#E5E7EB] hover:bg-slate-100 rounded-lg inline-flex items-center justify-center transition-colors"
                      >
                        <Pencil className="size-4 text-[#64748B]" />
                      </button>
                      <button
                        onClick={() => toast.warning("To delete, deactivate the Brand in Master Data.")}
                        className="w-8 h-8 border border-[#FEE2E2] hover:bg-red-50 rounded-lg inline-flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="size-4 text-[#EF4444]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {brands.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-6 text-slate-400 italic">
                    No brands available. Please add brands in Master Data first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 px-4 py-3 select-none">
          <Info className="size-4 text-[#94A3B8]" />
          <span className="text-xs text-[#64748B]">
            Next number indicates the next document number that will be generated.
          </span>
        </div>
      </SettingsCard>

      {/* ROW 2 — Two side-by-side cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Default Credit Days */}
        <SettingsCard
          icon={Calendar}
          title="Default Credit Days"
          subtitle="Set default credit period for customers"
        >
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                Default Credit Days <span className="text-[#DC2626]">*</span>
              </label>
              <div className="flex w-full">
                <input
                  type="number"
                  min="0"
                  value={defaultCreditDays}
                  onChange={(e) => setDefaultCreditDays(Number(e.target.value))}
                  className="flex-1 h-10 px-3 rounded-l-lg border border-r-0 border-[#D1D5DB] text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                  placeholder="e.g. 30"
                />
                <span className="h-10 px-4 bg-[#F9FAFB] border border-[#D1D5DB] rounded-r-lg text-sm text-[#64748B] flex items-center justify-center font-medium">
                  days
                </span>
              </div>
            </div>
            <InfoBanner
              variant="info"
              text="This credit period will be used in sales invoices if customer specific credit days is not set."
            />
          </div>
        </SettingsCard>

        {/* Default Payment Terms */}
        <SettingsCard
          icon={Receipt}
          title="Default Payment Terms"
          subtitle="Set default payment terms for purchases"
        >
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                Default Payment Terms <span className="text-[#DC2626]">*</span>
              </label>
              <select
                value={defaultPaymentTerms}
                onChange={(e) => setDefaultPaymentTerms(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
              >
                <option value="immediate">Immediate</option>
                <option value="15_days">15 Days</option>
                <option value="30_days">30 Days</option>
                <option value="45_days">45 Days</option>
                <option value="60_days">60 Days</option>
                <option value="90_days">90 Days</option>
              </select>
            </div>
            <InfoBanner
              variant="info"
              text="This payment term will be used in purchase invoices if vendor specific terms is not set."
            />
          </div>
        </SettingsCard>
      </div>

      {/* CARD 3 — Other Financial Preferences */}
      <SettingsCard
        icon={Settings2}
        title="Other Financial Preferences"
        subtitle="Configure additional financial preferences"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div>
            <label className="text-sm font-semibold text-[#374151] block mb-1.5">
              Default TDS Type
            </label>
            <select
              value={defaultTdsType}
              onChange={(e) => setDefaultTdsType(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
            >
              <option value="194C">194C - Contractor</option>
              <option value="194H">194H - Commission</option>
              <option value="194I">194I - Rent</option>
              <option value="194J">194J - Professional</option>
              <option value="none">None</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-[#374151] block mb-1.5">
              Round Off Option
            </label>
            <select
              value={roundOffMethod}
              onChange={(e) => setRoundOffMethod(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
            >
              <option value="two_decimals">Round to 2 Decimal Places</option>
              <option value="nearest_rupee">Round to Nearest Rupee</option>
              <option value="no_rounding">No Round Off</option>
            </select>
          </div>

          <div className="flex items-center justify-between border border-[#F3F4F6] rounded-xl p-4 mt-5 bg-slate-50/50">
            <div>
              <span className="text-sm font-semibold text-[#374151] block leading-none">
                Enable Cash Rounding
              </span>
              <span className="text-xs text-[#94A3B8] block mt-1.5 leading-none">
                Round off cash transactions to nearest rupee
              </span>
            </div>
            <Switch
              checked={enableCashRounding}
              onCheckedChange={setEnableCashRounding}
            />
          </div>
        </div>
      </SettingsCard>

      {/* EDIT BRAND BILL PREFIX DIALOG */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md w-full bg-white rounded-2xl p-6 text-left shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0F172A]">
              Edit Series Config: {editingBrand?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 mt-4">
            <div>
              <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                Prefix (Pakka)
              </label>
              <input
                type="text"
                value={editPakka}
                onChange={(e) => setEditPakka(e.target.value.toUpperCase())}
                className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] font-mono"
                placeholder="PK"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                Prefix (Kacha)
              </label>
              <input
                type="text"
                value={editKacha}
                onChange={(e) => setEditKacha(e.target.value.toUpperCase())}
                className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] font-mono"
                placeholder="KC"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                Separator
              </label>
              <input
                type="text"
                maxLength={1}
                value={editSeparator}
                onChange={(e) => setEditSeparator(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                placeholder="/"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                Digits Length
              </label>
              <input
                type="number"
                min="3"
                max="8"
                value={editDigits}
                onChange={(e) => setEditDigits(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
              />
            </div>
          </div>

          <DialogFooter className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => setEditDialogOpen(false)}
              className="h-10 px-4 border border-[#E5E7EB] hover:bg-slate-50 rounded-lg text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveBrandEdit}
              className="h-10 px-4 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-lg text-sm font-semibold"
            >
              Stage Changes
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
