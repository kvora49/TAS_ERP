"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bell, MessageSquare, AlertTriangle, CheckCircle2,
  Send, Settings, ExternalLink, X, IndianRupee, Clock, FileText, Plus, Download, Trash2,
  Calendar, Repeat, Smartphone, ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";
import { DueDateBadge } from "@/components/shared/DueDateBadge";
import { Modal } from "@/components/shared/Modal";
import { usePWAWebPush } from "@/hooks/usePWAWebPush";
import { cn } from "@/lib/utils";

interface OverdueBill {
  id: string;
  bill_number: string;
  bill_date: string;
  due_date: string;
  grand_total: number;
  outstanding_amount: number;
  days_overdue: number;
  payment_status: string;
  party: { id: string; name: string; company_name?: string; phone?: string } | null;
  snoozed_until?: string | null;
  recurring_interval_days?: number;
}

interface WhatsAppTemplate {
  id: string;
  template_type: string;
  template_text: string;
  is_active: boolean;
}

interface ReminderLink {
  bill_id?: string;
  bill_number: string;
  bill_count?: number;
  party_name: string;
  phone: string;
  message: string;
  whatsapp_url: string | null;
}

const TEMPLATE_TYPES = [
  { key: "payment_reminder", label: "Payment Reminder" },
  { key: "overdue_reminder", label: "Overdue Alert" },
  { key: "bill_share", label: "Bill Share" },
  { key: "pdc_reminder", label: "PDC / Cheque Reminder" },
];

const DEFAULT_TEMPLATES: Record<string, string> = {
  payment_reminder: "Dear {name}, your bill {bill} of ₹{amount} is due on {due}. Kindly make payment at earliest. Thank you.",
  overdue_reminder: "Dear {name}, your bill {bill} of ₹{amount} is overdue by {days} days. Please clear your dues immediately.",
  bill_share: "Dear {name}, please find your bill {bill} for ₹{amount} dated {date}. Thank you for your business.",
  pdc_reminder: "Dear {name}, your PDC cheque of ₹{amount} for bill {bill} is due on {due}. Please ensure sufficient balance.",
};

export default function RemindersPage() {
  const queryClient = useQueryClient();
  const { permission, requestNotificationPermission } = usePWAWebPush();

  // Active Tab: 'receivables' | 'payables' | 'cheques' | 'templates'
  const [activeTab, setActiveTab] = useState<"receivables" | "payables" | "cheques" | "templates">("receivables");
  const [selectedBills, setSelectedBills] = useState<Set<string>>(new Set());
  const [selectedTemplateType, setSelectedTemplateType] = useState<string>("payment_reminder");
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<string>("payment_reminder");
  const [templateText, setTemplateText] = useState("");
  const [reminderLinks, setReminderLinks] = useState<ReminderLink[]>([]);
  const [showLinksModal, setShowLinksModal] = useState(false);

  // Snooze & Recurring Schedule Modal States
  const [snoozeTargetBill, setSnoozeTargetBill] = useState<OverdueBill | null>(null);
  const [snoozeDays, setSnoozeDays] = useState<number>(3);

  const [recurringTargetBill, setRecurringTargetBill] = useState<OverdueBill | null>(null);
  const [recurringDays, setRecurringDays] = useState<number>(2);

  // Load reminder items for activeTab (receivables / payables / cheques)
  const apiType = activeTab === "receivables" ? "bills" : activeTab;

  const { data, isLoading, error } = useQuery({
    queryKey: ["reminders", activeTab],
    queryFn: async () => {
      const res = await fetch(`/api/reminders?type=${apiType}`);
      if (!res.ok) throw new Error("Failed to load reminders data");
      return res.json();
    },
    enabled: activeTab !== "templates",
  });

  const [deletedTemplateKeys, setDeletedTemplateKeys] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("tas_deleted_templates");
        return raw ? new Set(JSON.parse(raw)) : new Set();
      } catch {
        return new Set();
      }
    }
    return new Set();
  });

  // Snooze Mutation
  const snoozeMutation = useMutation({
    mutationFn: async ({ billId, snoozedUntil }: { billId: string; snoozedUntil: string | null }) => {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "snooze_bill",
          bill_id: billId,
          bill_type: activeTab === "payables" ? "payable" : "receivable",
          snoozed_until: snoozedUntil,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to snooze bill");
      return json;
    },
    onSuccess: () => {
      toast.success("Reminder snoozed successfully!");
      setSnoozeTargetBill(null);
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Recurring Schedule Mutation
  const recurringMutation = useMutation({
    mutationFn: async ({ billId, interval }: { billId: string; interval: number }) => {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_recurring_interval",
          bill_id: billId,
          bill_type: activeTab === "payables" ? "payable" : "receivable",
          recurring_interval_days: interval,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to set recurring schedule");
      return json;
    },
    onSuccess: () => {
      toast.success("Recurring reminder interval updated!");
      setRecurringTargetBill(null);
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (payload: { template_type: string; template_text: string }) => {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_template", ...payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json;
    },
    onSuccess: (_, variables) => {
      toast.success("Template saved!");
      const norm = variables.template_type.toLowerCase().replace(/\s+/g, "_");
      setDeletedTemplateKeys((prev) => {
        const next = new Set(prev);
        next.delete(norm);
        try { localStorage.setItem("tas_deleted_templates", JSON.stringify(Array.from(next))); } catch {}
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      setShowTemplateEditor(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateType: string) => {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_template", template_type: templateType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json;
    },
    onSuccess: (_, templateType) => {
      const norm = templateType.toLowerCase().replace(/\s+/g, "_");
      setDeletedTemplateKeys((prev) => {
        const next = new Set(prev);
        next.add(norm);
        try { localStorage.setItem("tas_deleted_templates", JSON.stringify(Array.from(next))); } catch {}
        return next;
      });
      toast.success("Template deleted!");
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      setShowTemplateEditor(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const sendRemindersMutation = useMutation({
    mutationFn: async ({ billIds, templateType }: { billIds: string[]; templateType: string }) => {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_reminders",
          bill_ids: billIds,
          template_type: templateType,
          target_type: activeTab,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json;
    },
    onSuccess: (data) => {
      setReminderLinks(data.links || []);
      setShowLinksModal(true);
      setSelectedBills(new Set());
    },
    onError: (err: any) => toast.error(err.message),
  });

  const bills: OverdueBill[] = data?.overdue_bills || [];
  const templates: WhatsAppTemplate[] = data?.templates || [];
  const stats = data?.stats || { total_overdue: 0, total_outstanding: 0, critical: 0 };

  const rawTemplateTypes: { key: string; label: string; isCustom: boolean }[] = [];
  const seenKeys = new Set<string>();

  TEMPLATE_TYPES.forEach((t) => {
    const norm = t.key.toLowerCase().replace(/\s+/g, "_");
    rawTemplateTypes.push({ key: t.key, label: t.label, isCustom: false });
    seenKeys.add(norm);
  });

  templates.forEach((tmpl: any) => {
    const rawKey = (tmpl?.template_type || tmpl?.code || "").trim();
    if (!rawKey) return;
    const norm = rawKey.toLowerCase().replace(/\s+/g, "_");

    if (!seenKeys.has(norm)) {
      seenKeys.add(norm);
      rawTemplateTypes.push({
        key: norm,
        label: norm.startsWith("custom_")
          ? "Custom Template (" + norm.slice(-4) + ")"
          : rawKey.replace(/_/g, " "),
        isCustom: true,
      });
    }
  });

  const allTemplateTypes = rawTemplateTypes.filter(
    (t) => !deletedTemplateKeys.has(t.key.toLowerCase().replace(/\s+/g, "_"))
  );

  const getTemplate = (type: string) => {
    const norm = type.toLowerCase().replace(/\s+/g, "_");
    const found = templates.find((t: any) => {
      const key = (t.template_type || t.code || "").trim().toLowerCase().replace(/\s+/g, "_");
      return key === norm;
    });
    return found?.template_text || (found as any)?.content || DEFAULT_TEMPLATES[norm] || "";
  };

  const handleOpenTemplateEditor = (type: string) => {
    setEditingTemplate(type);
    setTemplateText(getTemplate(type));
    setShowTemplateEditor(true);
  };

  const handleToggleBill = (id: string) => {
    setSelectedBills((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedBills.size === bills.length) setSelectedBills(new Set());
    else setSelectedBills(new Set(bills.map((b) => b.id)));
  };

  const handleSendReminders = async (overrideTemplate?: string): Promise<void> => {
    if (selectedBills.size === 0) { void toast.error("Select at least one bill."); return; }
    const tmpl = overrideTemplate || selectedTemplateType;
    await sendRemindersMutation.mutateAsync({ billIds: Array.from(selectedBills), templateType: tmpl });
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

  const handleApplySnooze = (daysToAdd: number) => {
    if (!snoozeTargetBill) return;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysToAdd);
    const dateStr = targetDate.toISOString().split("T")[0];
    snoozeMutation.mutate({ billId: snoozeTargetBill.id, snoozedUntil: dateStr });
  };

  return (
    <PageState isLoading={isLoading && activeTab !== "templates"} error={error?.message}>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div>
            <h1 className="text-xl font-extrabold text-[var(--text-primary)] flex items-center gap-2">
              <Bell className="text-[var(--primary)]" size={24} />
              <span>Reminders & WhatsApp Hub</span>
            </h1>
            <p className="text-xs text-[var(--text-muted)] font-medium">
              Manage payment receivables, vendor payables, PDC cheques, and overdue reminder schedules.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {permission !== "granted" && (
              <button
                onClick={requestNotificationPermission}
                className="h-9 px-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Smartphone size={14} />
                <span>Enable Mobile PWA Push</span>
              </button>
            )}

            {activeTab !== "templates" && (
              <AsyncButton
                onClick={() => handleSendReminders()}
                disabled={selectedBills.size === 0}
                className="flex items-center gap-1.5 h-9 px-4 text-xs font-bold bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-lg disabled:opacity-50 cursor-pointer"
              >
                <MessageSquare className="h-4 w-4" />
                Send WhatsApp ({selectedBills.size})
              </AsyncButton>
            )}
          </div>
        </div>

        {/* Primary Tabs Navigation */}
        <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => { setActiveTab("receivables"); setSelectedBills(new Set()); }}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap",
              activeTab === "receivables"
                ? "bg-[var(--primary)] text-white shadow-md shadow-indigo-500/20"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--table-row-hover)]"
            )}
          >
            <span>📥 Receivables (Customer Dues)</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab("payables"); setSelectedBills(new Set()); }}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap",
              activeTab === "payables"
                ? "bg-[var(--primary)] text-white shadow-md shadow-indigo-500/20"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--table-row-hover)]"
            )}
          >
            <span>📤 Payables (Supplier Dues)</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab("cheques"); setSelectedBills(new Set()); }}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap",
              activeTab === "cheques"
                ? "bg-[var(--primary)] text-white shadow-md shadow-indigo-500/20"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--table-row-hover)]"
            )}
          >
            <span>💳 PDC / Cheques</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("templates")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap",
              activeTab === "templates"
                ? "bg-[var(--primary)] text-white shadow-md shadow-indigo-500/20"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--table-row-hover)]"
            )}
          >
            <span>⚙️ WhatsApp Templates</span>
          </button>
        </div>

        {/* Stats Cards (For Bills/Payables/Cheques) */}
        {activeTab !== "templates" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] flex items-center gap-4">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 rounded-lg"><AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" /></div>
              <div>
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide block">Overdue Count</span>
                <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">{stats.total_overdue}</p>
              </div>
            </div>
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] flex items-center gap-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/50 rounded-lg"><IndianRupee className="h-5 w-5 text-amber-600 dark:text-amber-400" /></div>
              <div>
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide block">Total Pending Amount</span>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{fmt(stats.total_outstanding)}</p>
              </div>
            </div>
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] flex items-center gap-4">
              <div className="p-3 bg-red-50 dark:bg-red-950/50 rounded-lg"><Clock className="h-5 w-5 text-red-600 dark:text-red-400" /></div>
              <div>
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide block">Critical (&gt;30 Days)</span>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-0.5">{stats.critical}</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: WHATSAPP TEMPLATES MANAGER */}
        {activeTab === "templates" ? (
          <div className="bg-gradient-to-br from-[#128C7E]/5 to-[#25D366]/5 border border-[#25D366]/20 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#25D366]/20 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-[#25D366]" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">WhatsApp Message Templates</h3>
                  <p className="text-[11px] text-[var(--text-muted)] font-medium">Configure customized message templates for customer & vendor reminders</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingTemplate(`custom_${Date.now()}`);
                  setTemplateText("Dear {{party_name}}, please find your bill {{invoice_no}} for ₹{{amount}} due on {{due_date}}.\n\nThank you!");
                  setShowTemplateEditor(true);
                }}
                className="px-3.5 py-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer self-start sm:self-auto"
              >
                <Plus className="h-4 w-4" />
                <span>Add Custom Template</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allTemplateTypes.map((t) => {
                const text = getTemplate(t.key);
                return (
                  <div
                    key={t.key}
                    className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 space-y-3 shadow-[var(--shadow-sm)]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--primary)] uppercase tracking-wide">
                        {t.label}
                      </span>
                      <button
                        onClick={() => handleOpenTemplateEditor(t.key)}
                        className="text-xs text-[var(--primary)] hover:underline font-bold"
                      >
                        Edit
                      </button>
                    </div>
                    <p className="text-xs text-[var(--text-body)] font-mono whitespace-pre-wrap bg-[var(--page-bg)] p-3 rounded-lg border border-[var(--border)]">
                      {text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* TAB 1, 2 & 3: RECEIVABLES, PAYABLES & PDC CHEQUES LIST */
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] overflow-hidden shadow-[var(--shadow-sm)]">
            <div className="p-4 bg-[var(--table-header-bg)] border-b border-[var(--border)] flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bills.length > 0 && selectedBills.size === bills.length}
                  onChange={handleSelectAll}
                  className="h-4 w-4 rounded text-[var(--primary)] focus:ring-[var(--input-focus)]"
                />
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  Select All ({bills.length} Items)
                </span>
              </label>
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                {selectedBills.size} selected for bulk action
              </span>
            </div>

            {bills.length === 0 ? (
              <div className="p-12 text-center text-[var(--text-muted)] space-y-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                <p className="text-sm font-bold text-[var(--text-primary)]">No Pending Dues!</p>
                <p className="text-xs">All bills in this section are cleared or up to date.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {bills.map((bill) => {
                  const isSelected = selectedBills.has(bill.id);
                  const isSnoozed = bill.snoozed_until && bill.snoozed_until > new Date().toISOString().split("T")[0];

                  return (
                    <div
                      key={bill.id}
                      className={cn(
                        "p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors",
                        isSelected ? "bg-[var(--primary-light)]/40" : "hover:bg-[var(--table-row-hover)]"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleBill(bill.id)}
                          className="mt-1 h-4 w-4 rounded text-[var(--primary)] focus:ring-[var(--input-focus)] cursor-pointer"
                        />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs text-[var(--primary)]">
                              {bill.bill_number}
                            </span>
                            <DueDateBadge
                              dueDate={bill.due_date}
                              isCompleted={bill.payment_status === "paid"}
                              type={activeTab === "payables" ? "purchase" : activeTab === "cheques" ? "job_work" : "bill"}
                            />
                            {isSnoozed && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded border border-purple-200">
                                💤 Snoozed till {bill.snoozed_until}
                              </span>
                            )}
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200">
                              Every {bill.recurring_interval_days || 2}d
                            </span>
                          </div>

                          <div className="text-xs text-[var(--text-body)] font-semibold">
                            {bill.party?.company_name || bill.party?.name || "Party"}
                            {bill.party?.phone && (
                              <span className="text-[var(--text-muted)] font-normal ml-2">
                                📞 {bill.party.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 self-end md:self-auto">
                        <div className="text-right">
                          <span className="text-xs font-extrabold text-[var(--text-primary)] font-mono block">
                            {fmt(bill.outstanding_amount)}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)] block">
                            Total: {fmt(bill.grand_total)}
                          </span>
                        </div>

                        {/* Action buttons per bill */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setSnoozeTargetBill(bill)}
                            className="h-8 px-2.5 rounded-lg border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-[var(--text-primary)] text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            title="Snooze reminder for N days"
                          >
                            <Clock size={12} className="text-amber-500" />
                            <span>Snooze</span>
                          </button>

                          <button
                            onClick={() => setRecurringTargetBill(bill)}
                            className="h-8 px-2.5 rounded-lg border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-[var(--text-primary)] text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            title="Change recurring reminder interval"
                          >
                            <Repeat size={12} className="text-[var(--primary)]" />
                            <span>Interval</span>
                          </button>

                          {bill.party?.phone && (
                            <a
                              href={`https://web.whatsapp.com/send?phone=91${bill.party.phone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="h-8 w-8 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] flex items-center justify-center transition-all cursor-pointer"
                              title="Direct WhatsApp chat"
                            >
                              <MessageSquare size={14} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SNOOZE MODAL */}
      <Modal open={!!snoozeTargetBill} onOpenChange={() => setSnoozeTargetBill(null)} title="Snooze Reminder">
        <div className="space-y-4">
          <p className="text-xs text-[var(--text-body)]">
            Temporarily pause reminders for <strong>{snoozeTargetBill?.bill_number}</strong> until a specified date:
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleApplySnooze(1)}
              className="py-2.5 border border-[var(--border)] rounded-lg text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)] transition-all cursor-pointer"
            >
              +1 Day (Tomorrow)
            </button>
            <button
              onClick={() => handleApplySnooze(3)}
              className="py-2.5 border border-[var(--border)] rounded-lg text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)] transition-all cursor-pointer"
            >
              +3 Days
            </button>
            <button
              onClick={() => handleApplySnooze(7)}
              className="py-2.5 border border-[var(--border)] rounded-lg text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)] transition-all cursor-pointer"
            >
              +7 Days (1 Week)
            </button>
          </div>
          {snoozeTargetBill?.snoozed_until && (
            <button
              onClick={() => snoozeMutation.mutate({ billId: snoozeTargetBill.id, snoozedUntil: null })}
              className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              Clear Snooze (Resume Normal Schedule)
            </button>
          )}
        </div>
      </Modal>

      {/* RECURRING INTERVAL MODAL */}
      <Modal open={!!recurringTargetBill} onOpenChange={() => setRecurringTargetBill(null)} title="Set Overdue Reminder Frequency">
        <div className="space-y-4">
          <p className="text-xs text-[var(--text-body)]">
            Configure how often overdue notifications & mobile PWA alerts should repeat for <strong>{recurringTargetBill?.bill_number}</strong> until payment is cleared:
          </p>

          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 5, 7, 14].map((days) => (
              <button
                key={days}
                onClick={() => recurringMutation.mutate({ billId: recurringTargetBill!.id, interval: days })}
                className={cn(
                  "py-2.5 border rounded-lg text-xs font-bold transition-all cursor-pointer",
                  (recurringTargetBill?.recurring_interval_days || 2) === days
                    ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                    : "border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--table-row-hover)]"
                )}
              >
                Every {days} {days === 1 ? "Day" : "Days"}
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* TEMPLATE EDITOR MODAL */}
      <Modal open={showTemplateEditor} onOpenChange={setShowTemplateEditor} title="Edit WhatsApp Template">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-[var(--text-primary)] block mb-1">Template Key / Type</label>
            <input
              type="text"
              value={editingTemplate}
              onChange={(e) => setEditingTemplate(e.target.value)}
              className="w-full h-9 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs font-semibold text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--text-primary)] block mb-1">Template Content</label>
            <textarea
              rows={4}
              value={templateText}
              onChange={(e) => setTemplateText(e.target.value)}
              className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs font-mono text-[var(--text-primary)]"
            />
            <p className="text-[10px] text-[var(--text-muted)] mt-1 font-medium">
              Available tags: &#123;&#123;party_name&#125;&#125;, &#123;&#123;invoice_no&#125;&#125;, &#123;&#123;amount&#125;&#125;, &#123;&#123;due_date&#125;&#125;, &#123;&#123;days&#125;&#125;, &#123;&#123;bill_url&#125;&#125;
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => deleteTemplateMutation.mutate(editingTemplate)}
              className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1"
            >
              <Trash2 size={13} />
              Delete Template
            </button>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setShowTemplateEditor(false)} className="text-xs font-bold">
                Cancel
              </Button>
              <AsyncButton
                onClick={() => saveTemplateMutation.mutateAsync({ template_type: editingTemplate, template_text: templateText })}
                className="text-xs font-bold bg-[var(--primary)] text-white px-4 py-2 rounded-lg"
              >
                Save Template
              </AsyncButton>
            </div>
          </div>
        </div>
      </Modal>

      {/* WHATSAPP LINKS MODAL */}
      <Modal open={showLinksModal} onOpenChange={setShowLinksModal} title="Generated WhatsApp Reminders">
        <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
          {reminderLinks.map((link, idx) => (
            <div key={idx} className="p-3 border border-[var(--border)] rounded-lg bg-[var(--card-bg)] space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--text-primary)]">
                <span>{link.party_name}</span>
                <span className="font-mono text-[var(--text-muted)]">{link.phone || "No Phone"}</span>
              </div>
              <p className="text-[11px] text-[var(--text-body)] font-mono bg-[var(--page-bg)] p-2 rounded border border-[var(--border)] whitespace-pre-wrap">
                {link.message}
              </p>
              {link.whatsapp_url ? (
                <a
                  href={link.whatsapp_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#25D366] hover:underline"
                >
                  <ExternalLink size={12} />
                  Open WhatsApp Chat
                </a>
              ) : (
                <span className="text-[10px] text-rose-500 font-bold">Missing phone number in master data</span>
              )}
            </div>
          ))}
        </div>
      </Modal>
    </PageState>
  );
}
