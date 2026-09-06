"use client";

import { useEffect, useState } from "react";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { Switch } from "@/components/ui/switch";
import { InfoBanner } from "@/components/shared/InfoBanner";
import { Modal } from "@/components/shared/Modal";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";
import { usePermissions } from "@/hooks/usePermissions";
import { TDS_SECTIONS } from "@/lib/utils/financialCalculations";
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
  Percent,
} from "lucide-react";
import { toast } from "sonner";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

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
  const { canEdit } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  const [isDirty, setIsDirty] = useState(false);

  useUnsavedChangesGuard(isDirty);

  const fetchFinancialSettings = async () => {
    setLoading(true);
    setError(null);
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
      setError(err.message || "Error fetching financial settings");
      toast.error(err.message || "Error fetching financial settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancialSettings();
  }, []);

  const handleSaveAll = async () => {
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
          brands,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update financial settings");

      toast.success("Financial settings saved successfully");
      setIsDirty(false);
      fetchFinancialSettings();
    } catch (err: any) {
      toast.error(err.message || "Error saving financial settings");
      throw err;
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

    setIsDirty(true);
    setEditDialogOpen(false);
    toast.info("Brand changes staged locally. Click 'Save Changes' at the top to commit.");
  };

  const getNextNumberPreview = (brand: Brand) => {
    const pakka = brand.bill_prefix_pakka || "PK";
    const separator = brand.design_separator || "/";
    const digits = brand.design_digits || 5;
    const yearSuffix = "26-27";
    const nextVal = "1".padStart(Number(digits), "0");
    return `${pakka}${separator}${yearSuffix}${separator}${nextVal}`;
  };

  return (
    <div className="flex flex-col gap-6 text-left">
      <SettingsPageHeader
        section="Financial"
        title="Settings > Financial"
        subtitle="Configure financial preferences, bill series and context-aware TDS rules"
        actionLabel={canEdit("Settings") ? "Save Changes" : undefined}
        onAction={canEdit("Settings") ? handleSaveAll : undefined}
        actionIcon={<Save className="size-4 text-white" />}
      />

      <PageState
        isLoading={loading}
        isError={!!error}
        error={error || undefined}
        onRetry={fetchFinancialSettings}
        skeletonVariant="form"
      >
        {/* CARD 1 — Bill Series Configuration */}
        <SettingsCard
          icon={FileText}
          title="Bill Series Configuration"
          subtitle="Configure bill numbering series for each brand"
          headerRight={
            <button
              type="button"
              onClick={() => toast.info("To add a new series, please create a new Brand in Master Data.")}
              className="border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--page-bg)] text-[var(--text-primary)] h-9 px-3 rounded-lg text-sm font-semibold shadow-sm cursor-pointer inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus className="size-4" /> Add Series
            </button>
          }
        >
          {/* Mobile Series Cards (< md) */}
          <div className="md:hidden divide-y divide-[var(--border)] border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--card-bg)] mb-3">
            {brands.map((b) => (
              <div key={b.id} className="p-3.5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-[var(--text-primary)] block">{b.name}</span>
                    <span className="text-[11px] text-[var(--text-muted)] font-medium">Invoice Series</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditBrand(b)}
                      className="h-8 px-2.5 border border-[var(--border)] hover:bg-[var(--page-bg)] text-[var(--primary)] rounded-lg inline-flex items-center gap-1 text-xs font-semibold cursor-pointer"
                    >
                      <Pencil className="size-3.5" />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-[var(--page-bg)] p-2.5 rounded-lg text-xs">
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block">Pakka Prefix</span>
                    <span className="font-mono font-bold text-[var(--text-primary)]">{b.bill_prefix_pakka || "PK"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block">Kacha Prefix</span>
                    <span className="font-mono font-bold text-[var(--text-primary)]">{b.bill_prefix_kacha || "KC"}</span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-[var(--border-light)] flex justify-between items-center">
                    <span className="text-[10px] text-[var(--text-muted)]">Next Document #</span>
                    <span className="font-mono font-bold text-[var(--primary)]">{getNextNumberPreview(b)}</span>
                  </div>
                </div>
              </div>
            ))}
            {brands.length === 0 && (
              <div className="p-4 text-center text-xs text-[var(--text-faint)] italic">
                No brands available. Please add brands in Master Data first.
              </div>
            )}
          </div>

          {/* Desktop Table (hidden on mobile) */}
          <div className="hidden md:block overflow-x-auto border border-[var(--border)] rounded-lg">
            <table className="w-full text-sm text-[var(--text-body)]">
              <thead className="bg-[var(--table-header-bg)] text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider h-10">
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
              <tbody className="divide-y divide-[var(--border)]">
                {brands.map((b) => (
                  <tr key={b.id} className="hover:bg-[var(--table-row-hover)] h-14 transition-colors">
                    <td className="px-4 py-2 font-semibold text-[var(--text-primary)]">{b.name}</td>
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
                          type="button"
                          onClick={() => handleOpenEditBrand(b)}
                          className="w-8 h-8 border border-[var(--border)] hover:bg-[var(--page-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg inline-flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toast.warning("To delete, deactivate the Brand in Master Data.")}
                          className="w-8 h-8 border border-red-500/20 hover:bg-red-500/10 text-red-500 rounded-lg inline-flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {brands.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-6 text-[var(--text-faint)] italic">
                      No brands available. Please add brands in Master Data first.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 px-4 py-3 select-none">
            <Info className="size-4 text-[var(--text-faint)]" />
            <span className="text-xs text-[var(--text-muted)]">
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
                <label className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
                  Default Credit Days <span className="text-red-500">*</span>
                </label>
                <div className="flex w-full">
                  <input
                    type="number"
                    min="0"
                    value={defaultCreditDays}
                    onChange={(e) => setDefaultCreditDays(Number(e.target.value))}
                    className="flex-1 h-10 px-3 rounded-l-lg border border-r-0 border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                    placeholder="e.g. 30"
                  />
                  <span className="h-10 px-4 bg-[var(--table-header-bg)] border border-[var(--input-border)] rounded-r-lg text-sm text-[var(--text-muted)] flex items-center justify-center font-medium">
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
                <label className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
                  Default Payment Terms <span className="text-red-500">*</span>
                </label>
                <select
                  value={defaultPaymentTerms}
                  onChange={(e) => setDefaultPaymentTerms(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] text-sm bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors cursor-pointer"
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

        {/* CARD 3 — Context-Aware TDS Engine & Rounding Preferences */}
        <SettingsCard
          icon={Settings2}
          title="TDS Engine & Rounding Preferences"
          subtitle="Configure default TDS section defaults and round off rules"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center mb-6">
            <div>
              <label className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
                Fallback Default TDS Type
              </label>
              <select
                value={defaultTdsType}
                onChange={(e) => setDefaultTdsType(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] text-sm bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] cursor-pointer"
              >
                {Object.values(TDS_SECTIONS).map((sec) => (
                  <option key={sec.code} value={sec.code}>
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
                Round Off Option
              </label>
              <select
                value={roundOffMethod}
                onChange={(e) => setRoundOffMethod(e.target.value as any)}
                className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] text-sm bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] cursor-pointer"
              >
                <option value="two_decimals">Round to 2 Decimal Places</option>
                <option value="nearest_rupee">Round to Nearest Rupee</option>
                <option value="no_rounding">No Round Off</option>
              </select>
            </div>

            <div className="flex items-center justify-between border border-[var(--border)] rounded-xl p-4 mt-1 bg-[var(--table-header-bg)]">
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)] block leading-none">
                  Enable Cash Rounding
                </span>
                <span className="text-xs text-[var(--text-muted)] block mt-1.5 leading-none">
                  Round off cash transactions to nearest rupee
                </span>
              </div>
              <Switch
                checked={enableCashRounding}
                onCheckedChange={setEnableCashRounding}
              />
            </div>
          </div>

          {/* Section 194 Reference & Module Rules Table */}
          <div className="border border-[var(--border)] rounded-xl p-4 bg-[var(--table-header-bg)]">
            <div className="flex items-center gap-2 mb-3">
              <Percent className="size-4 text-[var(--primary)]" />
              <h4 className="text-sm font-bold text-[var(--text-primary)]">
                Context-Aware Income Tax TDS Rules (Section 194 Reference)
              </h4>
            </div>
            <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--card-bg)]">
              <table className="w-full text-xs text-[var(--text-body)]">
                <thead className="bg-[var(--table-header-bg)] text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left">Module / Context</th>
                    <th className="px-3 py-2 text-left">TDS Section</th>
                    <th className="px-3 py-2 text-center">Individual Rate</th>
                    <th className="px-3 py-2 text-center">Company Rate</th>
                    <th className="px-3 py-2 text-center">No PAN Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] font-mono">
                  <tr>
                    <td className="px-3 py-2 font-sans font-medium text-[var(--text-primary)]">Job Work & Tailors</td>
                    <td className="px-3 py-2 font-semibold">194C - Contracts</td>
                    <td className="px-3 py-2 text-center text-emerald-600 font-bold">1%</td>
                    <td className="px-3 py-2 text-center text-emerald-600 font-bold">2%</td>
                    <td className="px-3 py-2 text-center text-red-500 font-bold">20%</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-sans font-medium text-[var(--text-primary)]">Raw Material Purchases</td>
                    <td className="px-3 py-2 font-semibold">194Q - Purchase of Goods</td>
                    <td className="px-3 py-2 text-center text-emerald-600 font-bold">0.1%</td>
                    <td className="px-3 py-2 text-center text-emerald-600 font-bold">0.1%</td>
                    <td className="px-3 py-2 text-center text-red-500 font-bold">5%</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-sans font-medium text-[var(--text-primary)]">Audit & Legal Fees</td>
                    <td className="px-3 py-2 font-semibold">194J - Professional Services</td>
                    <td className="px-3 py-2 text-center text-emerald-600 font-bold">10%</td>
                    <td className="px-3 py-2 text-center text-emerald-600 font-bold">10%</td>
                    <td className="px-3 py-2 text-center text-red-500 font-bold">20%</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-sans font-medium text-[var(--text-primary)]">Factory & Office Rent</td>
                    <td className="px-3 py-2 font-semibold">194I - Rent</td>
                    <td className="px-3 py-2 text-center text-emerald-600 font-bold">10%</td>
                    <td className="px-3 py-2 text-center text-emerald-600 font-bold">10%</td>
                    <td className="px-3 py-2 text-center text-red-500 font-bold">20%</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-sans font-medium text-[var(--text-primary)]">Sales Agents & Brokers</td>
                    <td className="px-3 py-2 font-semibold">194H - Commission</td>
                    <td className="px-3 py-2 text-center text-emerald-600 font-bold">5%</td>
                    <td className="px-3 py-2 text-center text-emerald-600 font-bold">5%</td>
                    <td className="px-3 py-2 text-center text-red-500 font-bold">20%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </SettingsCard>
      </PageState>

      {/* EDIT BRAND BILL PREFIX MODAL */}
      <Modal open={editDialogOpen} onOpenChange={setEditDialogOpen} title={`Edit Series Config: ${editingBrand?.name}`} maxWidth="max-w-md">
        <div className="flex flex-col gap-4 mt-2">
          <div>
            <label className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
              Prefix (Pakka)
            </label>
            <input
              type="text"
              value={editPakka}
              onChange={(e) => setEditPakka(e.target.value.toUpperCase())}
              className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] font-mono"
              placeholder="PK"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
              Prefix (Kacha)
            </label>
            <input
              type="text"
              value={editKacha}
              onChange={(e) => setEditKacha(e.target.value.toUpperCase())}
              className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] font-mono"
              placeholder="KC"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
              Separator
            </label>
            <input
              type="text"
              maxLength={1}
              value={editSeparator}
              onChange={(e) => setEditSeparator(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              placeholder="/"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
              Digits Length
            </label>
            <input
              type="number"
              min="3"
              max="8"
              value={editDigits}
              onChange={(e) => setEditDigits(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-[var(--border)] pt-4">
          <button
            type="button"
            onClick={() => setEditDialogOpen(false)}
            className="h-10 px-4 border border-[var(--border)] hover:bg-[var(--page-bg)] text-[var(--text-primary)] rounded-lg text-sm font-semibold cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveBrandEdit}
            className="h-10 px-4 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white rounded-lg text-sm font-semibold cursor-pointer transition-colors"
          >
            Stage Changes
          </button>
        </div>
      </Modal>
    </div>
  );
}
