"use client";

import React, { useEffect, useState, useMemo } from "react";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { SettingsCard } from "@/components/settings/SettingsCard";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";
import { useERPQuery, useERPMutation } from "@/hooks/useERPQuery";
import { usePermissions } from "@/hooks/usePermissions";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { FileText, Landmark, ShieldCheck, Save, HelpCircle } from "lucide-react";

interface BankAccountOption {
  id: string;
  name: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  ifsc?: string;
  branch?: string;
  account_type?: string;
  upi_id?: string;
  type?: string;
  is_active?: boolean;
}

export default function BillInvoiceSettingsPage() {
  const { canEdit } = usePermissions();
  const userCanEdit = canEdit("settings") !== false;

  // Form states
  const [termsConditions, setTermsConditions] = useState("");
  const [declaration, setDeclaration] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNo, setBankAccountNo] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [bankAccountType, setBankAccountType] = useState("Current Account");
  const [bankAccountId, setBankAccountId] = useState("");

  // Initial loaded baseline for dirty checking
  const [initialState, setInitialState] = useState<{
    termsConditions: string;
    declaration: string;
    bankName: string;
    bankAccountNo: string;
    bankIfsc: string;
    bankBranch: string;
    bankAccountType: string;
    bankAccountId: string;
  } | null>(null);

  // Fetch bill config
  const {
    data: configData,
    isPending,
    error,
    refetch,
  } = useERPQuery(["settings-bill-config"], async () => {
    const res = await fetch("/api/settings/bill-config");
    if (!res.ok) throw new Error("Failed to load bill settings");
    return res.json();
  });

  // Fetch available bank/UPI accounts for quick-fill
  const { data: accountsData } = useERPQuery(["banks-upi-for-bill"], async () => {
    const res = await fetch("/api/master-data/banks-upi");
    if (!res.ok) throw new Error("Failed to load bank accounts");
    return res.json();
  });

  useEffect(() => {
    if (configData?.config) {
      const c = configData.config;
      const initialTerms = c.terms_conditions || c.footer_text || "";
      const initialDecl =
        c.declaration ||
        c.declaration_text ||
        "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.";
      const initialBName = c.bank_name || c.bank_account?.bank_name || "";
      const initialAccNo = c.bank_account_no || c.bank_account?.account_number || "";
      const initialIfsc = c.bank_ifsc || c.bank_account?.ifsc_code || "";
      const initialBranch = c.bank_branch || "";
      const initialAccType = c.bank_account_type || "Current Account";
      const initialAccId = c.bank_account_id || c.bank_account?.id || "";

      setTermsConditions(initialTerms);
      setDeclaration(initialDecl);
      setBankName(initialBName);
      setBankAccountNo(initialAccNo);
      setBankIfsc(initialIfsc);
      setBankBranch(initialBranch);
      setBankAccountType(initialAccType);
      setBankAccountId(initialAccId);

      setInitialState({
        termsConditions: initialTerms,
        declaration: initialDecl,
        bankName: initialBName,
        bankAccountNo: initialAccNo,
        bankIfsc: initialIfsc,
        bankBranch: initialBranch,
        bankAccountType: initialAccType,
        bankAccountId: initialAccId,
      });
    }
  }, [configData]);

  // Compute dirty state
  const isDirty = useMemo(() => {
    if (!initialState) return false;
    return (
      termsConditions !== initialState.termsConditions ||
      declaration !== initialState.declaration ||
      bankName !== initialState.bankName ||
      bankAccountNo !== initialState.bankAccountNo ||
      bankIfsc !== initialState.bankIfsc ||
      bankBranch !== initialState.bankBranch ||
      bankAccountType !== initialState.bankAccountType ||
      bankAccountId !== initialState.bankAccountId
    );
  }, [
    initialState,
    termsConditions,
    declaration,
    bankName,
    bankAccountNo,
    bankIfsc,
    bankBranch,
    bankAccountType,
    bankAccountId,
  ]);

  useUnsavedChangesGuard(isDirty);

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
      successMessage: "Bill & invoice settings saved successfully",
      invalidates: [["settings-bill-config"], ["brand-config-preview"], ["settings-bill-config-preview"]],
    }
  );

  const handleSave = async () => {
    await saveMutation.mutateAsync();
    setInitialState({
      termsConditions,
      declaration,
      bankName,
      bankAccountNo,
      bankIfsc,
      bankBranch,
      bankAccountType,
      bankAccountId,
    });
  };

  const handleSelectAccount = (selectedId: string) => {
    setBankAccountId(selectedId);
    if (!selectedId) return;

    const matchedAccount = (accountsData?.accounts || []).find(
      (acc: BankAccountOption) => acc.id === selectedId
    );

    if (matchedAccount) {
      if (matchedAccount.bank_name || matchedAccount.name) {
        setBankName(matchedAccount.bank_name || matchedAccount.name);
      }
      if (matchedAccount.account_number) {
        setBankAccountNo(matchedAccount.account_number);
      }
      if (matchedAccount.ifsc_code || matchedAccount.ifsc) {
        setBankIfsc(matchedAccount.ifsc_code || matchedAccount.ifsc || "");
      }
      if (matchedAccount.branch) {
        setBankBranch(matchedAccount.branch);
      }
      if (matchedAccount.account_type) {
        setBankAccountType(matchedAccount.account_type);
      }
    }
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
    <PageState
      isLoading={isPending}
      isError={Boolean(error)}
      error={error instanceof Error ? error.message : "Failed to load bill settings"}
      onRetry={() => refetch()}
      skeletonVariant="form"
    >
      <div className="flex flex-col gap-6 pb-20 md:pb-6">
        <SettingsPageHeader
          section="Settings"
          title="Bill & Invoice Settings"
          subtitle="Configure Terms & Conditions, Bank Details, and Statutory Declarations for Sales Bills and Invoices."
          actionLabel={userCanEdit ? "Save Settings" : undefined}
          onAction={userCanEdit ? handleSave : undefined}
          actionLoading={saveMutation.isPending}
          actionIcon={<Save className="size-4 text-white" />}
          actionDisabled={!isDirty}
        />

        <div className="flex flex-col gap-6">
          {/* Terms & Conditions Card */}
          <SettingsCard
            icon={FileText}
            iconBg="bg-[var(--primary-light)]"
            iconColor="text-[var(--primary)]"
            title="Terms & Conditions"
            subtitle="Standard terms printed in the footer of your sales bills and invoices."
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>Enter each term on a new line. They will be automatically numbered on the printed bill footer.</span>
                <span className="font-mono text-[var(--text-faint)]">
                  {termsConditions ? `${termsConditions.split("\n").filter((l) => l.trim().length > 0).length} items` : "0 items"}
                </span>
              </div>
              <textarea
                rows={5}
                value={termsConditions}
                onChange={(e) => setTermsConditions(e.target.value)}
                disabled={!userCanEdit}
                placeholder={"1. Goods once sold will not be taken back\n2. Interest @ 18% p.a. will be charged if bill not paid within due date\n3. All disputes subject to local jurisdiction only"}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg p-3 text-xs leading-relaxed font-mono resize-y transition-colors"
              />
            </div>
          </SettingsCard>

          {/* Bank Details Card */}
          <SettingsCard
            icon={Landmark}
            iconBg="bg-[var(--primary-light)]"
            iconColor="text-[var(--primary)]"
            title="Company Bank Account Details"
            subtitle="Printed on Pakka Sales Bills and Invoices for direct customer payment and NEFT/RTGS transfers."
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Link From Saved Bank / UPI Account
                </label>
                <select
                  value={bankAccountId}
                  onChange={(e) => handleSelectAccount(e.target.value)}
                  disabled={!userCanEdit}
                  className={`${inputClass} cursor-pointer`}
                >
                  <option value="">Use custom manual details below</option>
                  {(accountsData?.accounts || [])
                    .filter((account: BankAccountOption) => account.is_active !== false)
                    .map((account: BankAccountOption) => (
                      <option key={account.id} value={account.id}>
                        {account.type === "upi"
                          ? `${account.name} — UPI (${account.upi_id})`
                          : `${account.name} — ${account.bank_name || "Bank"} (${account.account_number || "No A/C"})`}
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Selecting a master account pre-fills the bank fields below and keeps printed details synchronized.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC Bank Ltd."
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    disabled={!userCanEdit}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Account Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 50200012345678"
                    value={bankAccountNo}
                    onChange={(e) => setBankAccountNo(e.target.value)}
                    disabled={!userCanEdit}
                    className={`${inputClass} font-mono`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    IFS Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC0001234"
                    value={bankIfsc}
                    onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                    disabled={!userCanEdit}
                    className={`${inputClass} font-mono uppercase`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Branch Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ring Road Branch"
                    value={bankBranch}
                    onChange={(e) => setBankBranch(e.target.value)}
                    disabled={!userCanEdit}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Account Type
                  </label>
                  <select
                    value={bankAccountType}
                    onChange={(e) => setBankAccountType(e.target.value)}
                    disabled={!userCanEdit}
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
          </SettingsCard>

          {/* Statutory Declaration Card */}
          <SettingsCard
            icon={ShieldCheck}
            iconBg="bg-[var(--primary-light)]"
            iconColor="text-[var(--primary)]"
            title="Statutory Declaration"
            subtitle="Standard legal declaration printed above the computer generated notice on tax invoices."
          >
            <div className="space-y-3">
              <textarea
                rows={3}
                value={declaration}
                onChange={(e) => setDeclaration(e.target.value)}
                disabled={!userCanEdit}
                placeholder="We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct."
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg p-3 text-xs leading-relaxed resize-none transition-colors"
              />
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                <HelpCircle className="size-3.5 text-[var(--text-faint)] shrink-0" />
                <span>This declaration text satisfies GST requirements for computerized invoice signatures.</span>
              </div>
            </div>
          </SettingsCard>

          {/* Save Action Bar */}
          {userCanEdit && (
            <div className="flex items-center justify-between bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
              <span className="text-xs text-[var(--text-muted)]">
                {isDirty ? "You have unsaved changes in bill settings." : "All changes are saved."}
              </span>
              <AsyncButton
                onClick={handleSave}
                disabled={!isDirty || saveMutation.isPending}
                variant="primary"
                className="h-10 px-6 font-semibold"
              >
                Save Settings
              </AsyncButton>
            </div>
          )}
        </div>
      </div>
    </PageState>
  );
}
