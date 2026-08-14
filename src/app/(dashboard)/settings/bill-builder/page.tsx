"use client";

import React, { useEffect, useState } from "react";
import { BillBuilderCanvas } from "@/components/settings/BillBuilderCanvas";
import { CustomBillLayout, DEFAULT_BILL_LAYOUT } from "@/lib/pdf/custom-layout-renderer";
import { toast } from "sonner";
import { useERPQuery, useERPMutation } from "@/hooks/useERPQuery";
import { Button } from "@/components/ui/button";
import AsyncButton from "@/components/shared/AsyncButton";
import { Building2, FileText, Landmark, ShieldCheck } from "lucide-react";

export default function BillBuilderPage() {
  const [layout, setLayout] = useState<CustomBillLayout>(DEFAULT_BILL_LAYOUT);
  const [activeTab, setActiveTab] = useState<"print_settings" | "layout_builder">("print_settings");

  // Form states for bill footer / terms / bank
  const [termsConditions, setTermsConditions] = useState("");
  const [declaration, setDeclaration] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNo, setBankAccountNo] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [bankAccountType, setBankAccountType] = useState("Current Account");
  const [bankAccountId, setBankAccountId] = useState("");

  // Fetch bill config
  const { data: configData, isPending } = useERPQuery(["settings-bill-config"], async () => {
    const res = await fetch("/api/settings/bill-config");
    if (!res.ok) throw new Error("Failed to load bill settings");
    return res.json();
  });

  const { data: accountsData } = useERPQuery(["banks-upi-for-bill"], async () => {
    const res = await fetch("/api/master-data/banks-upi");
    if (!res.ok) throw new Error("Failed to load bank accounts");
    return res.json();
  });

  useEffect(() => {
    if (configData?.config) {
      const c = configData.config;
      setTermsConditions(c.terms_conditions || c.footer_text || "");
      setDeclaration(c.declaration || c.declaration_text || "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.");
      setBankName(c.bank_name || c.bank_account?.bank_name || "");
      setBankAccountNo(c.bank_account_no || c.bank_account?.account_number || "");
      setBankIfsc(c.bank_ifsc || c.bank_account?.ifsc_code || "");
      setBankBranch(c.bank_branch || "");
      setBankAccountType(c.bank_account_type || "Current Account");
      setBankAccountId(c.bank_account_id || c.bank_account?.id || "");
    }
  }, [configData]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("tas-erp-custom-bill-layout");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.elements) {
          setLayout(parsed);
        }
      }
    } catch (e) {}
  }, []);

  const saveMutation = useERPMutation(
    async () => {
      const res = await fetch("/api/settings/bill-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          terms_conditions: termsConditions,
          declaration,
          bank_name: bankName,
          bank_account_no: bankAccountNo,
          bank_ifsc: bankIfsc,
          bank_branch: bankBranch,
          bank_account_type: bankAccountType,
          bank_account_id: bankAccountId || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save settings");
      }
      return res.json();
    },
    {
      successMessage: "Bill settings saved successfully",
      invalidates: [["settings-bill-config"], ["brand-config-preview"]],
    }
  );

  const handleSaveLayout = async (savedLayout: CustomBillLayout) => {
    try {
      localStorage.setItem("tas-erp-custom-bill-layout", JSON.stringify(savedLayout));
      setLayout(savedLayout);
    } catch (e) {}
  };

  const inputClass = `
    bg-[var(--input-bg)]
    border border-[var(--input-border)]
    text-[var(--text-primary)]
    placeholder:text-[var(--text-faint)]
    focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent
    rounded-lg px-3 h-10 text-sm
    transition-colors w-full
  `;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-light)] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Bill &amp; Invoice Settings</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Configure Terms &amp; Conditions, Bank Details, Declarations, and print layout options for Sales Bills.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2 bg-[var(--page-bg)] p-1 rounded-xl border border-[var(--border)] self-start">
          <button
            onClick={() => setActiveTab("print_settings")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "print_settings"
                ? "bg-[var(--card-bg)] text-[var(--primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            Invoice Footer &amp; Bank
          </button>
          <button
            onClick={() => setActiveTab("layout_builder")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "layout_builder"
                ? "bg-[var(--card-bg)] text-[var(--primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            Visual Layout Builder
          </button>
        </div>
      </div>

      {activeTab === "print_settings" ? (
        <div className="space-y-6">
          {/* Terms & Conditions Section */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[var(--primary)]" />
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Terms &amp; Conditions</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Enter each term on a new line. They will be automatically numbered on the bill footer.
                </p>
              </div>
            </div>
            <textarea
              rows={4}
              value={termsConditions}
              onChange={(e) => setTermsConditions(e.target.value)}
              placeholder="1. Goods once sold will not be taken back&#10;2. Interest @ 18% p.a. will be charged if bill not paid within due date&#10;3. All disputes subject to local jurisdiction only"
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg p-3 text-xs leading-relaxed font-mono resize-y"
            />
          </div>

          {/* Bank Details Section */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-[var(--primary)]" />
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Company Bank Account Details</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Printed in the bottom footer of Pakka Sales Bills for customer payment transfers.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1 md:col-span-3">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Saved Bank / UPI Account</label>
                <select
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  className={`${inputClass} cursor-pointer`}
                >
                  <option value="">Use the manual details below</option>
                  {(accountsData?.accounts || []).filter((account: any) => account.is_active !== false).map((account: any) => (
                    <option key={account.id} value={account.id}>
                      {account.type === "upi" ? `${account.name} — ${account.upi_id}` : `${account.name} — ${account.bank_name || "Bank"} (${account.account_number || ""})`}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[var(--text-muted)]">Select an account from Banks &amp; UPI to keep its printed details in sync; or enter dedicated invoice details below.</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Bank Name</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Bank Ltd."
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Account Number</label>
                <input
                  type="text"
                  placeholder="e.g. 50200012345678"
                  value={bankAccountNo}
                  onChange={(e) => setBankAccountNo(e.target.value)}
                  className={`${inputClass} font-mono`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">IFS Code</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC0001234"
                  value={bankIfsc}
                  onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                  className={`${inputClass} font-mono uppercase`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Branch Name</label>
                <input
                  type="text"
                  placeholder="e.g. MG Road Branch"
                  value={bankBranch}
                  onChange={(e) => setBankBranch(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Account Type</label>
                <select
                  value={bankAccountType}
                  onChange={(e) => setBankAccountType(e.target.value)}
                  className={`${inputClass} cursor-pointer`}
                >
                  <option value="Current Account">Current Account</option>
                  <option value="Savings Account">Savings Account</option>
                  <option value="Cash Credit Account (CC)">Cash Credit Account (CC)</option>
                  <option value="Overdraft Account (OD)">Overdraft Account (OD)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Declaration Section */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[var(--primary)]" />
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Statutory Declaration</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Legal declaration printed above the computer generated notice on tax invoices.
                </p>
              </div>
            </div>
            <textarea
              rows={2}
              value={declaration}
              onChange={(e) => setDeclaration(e.target.value)}
              placeholder="We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct."
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg p-3 text-xs leading-relaxed resize-none"
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <AsyncButton
              onClick={async () => { await saveMutation.mutateAsync(); }}
              variant="primary"
            >
              Save Invoice Settings
            </AsyncButton>
          </div>
        </div>
      ) : (
        <BillBuilderCanvas initialLayout={layout} onSave={handleSaveLayout} />
      )}
    </div>
  );
}
