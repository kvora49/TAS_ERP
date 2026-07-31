"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bell, MessageSquare, AlertTriangle, CheckCircle2,
  Send, Settings, ExternalLink, X, IndianRupee, Clock, FileText, Plus, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";
import { cn } from "@/lib/utils";
import { openWhatsApp, shareInvoiceWithWhatsApp } from "@/lib/utils/whatsapp";

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
  const [activeTab, setActiveTab] = useState<"bills" | "cheques">("bills");
  const [selectedBills, setSelectedBills] = useState<Set<string>>(new Set());
  const [selectedTemplateType, setSelectedTemplateType] = useState<string>("payment_reminder");
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<string>("payment_reminder");
  const [templateText, setTemplateText] = useState("");
  const [reminderLinks, setReminderLinks] = useState<ReminderLink[]>([]);
  const [showLinksModal, setShowLinksModal] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["reminders", activeTab],
    queryFn: async () => {
      const res = await fetch(`/api/reminders?type=${activeTab}`);
      if (!res.ok) throw new Error("Failed to load reminders data");
      return res.json();
    },
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
    onSuccess: () => {
      toast.success("Template saved!");
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

  const allTemplateTypes = [...TEMPLATE_TYPES];
  templates.forEach((tmpl: any) => {
    const typeKey = tmpl?.template_type || tmpl?.code;
    if (typeKey && typeof typeKey === "string" && !allTemplateTypes.some((t) => t.key === typeKey)) {
      allTemplateTypes.push({
        key: typeKey,
        label: typeKey.startsWith("custom_")
          ? "Custom Template (" + typeKey.slice(-4) + ")"
          : typeKey.replace(/_/g, " "),
      });
    }
  });

  const getTemplate = (type: string) => {
    const found = templates.find((t: any) => (t.template_type || t.code) === type);
    return found?.template_text || (found as any)?.content || DEFAULT_TEMPLATES[type] || "";
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

  const criticalColor = (days: number) => {
    if (days > 60) return "bg-red-100 text-red-700 border-red-200";
    if (days > 30) return "bg-orange-100 text-orange-700 border-orange-200";
    if (days > 0) return "bg-amber-100 text-amber-700 border-amber-200";
    if (days === 0) return "bg-blue-100 text-blue-700 border-blue-200";
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  return (
    <PageState isLoading={isLoading} error={error?.message}>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Reminders & WhatsApp</h1>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Payments & Finance / Collection Reminders
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-[var(--border)]">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] pl-2">Template:</span>
              <select
                value={selectedTemplateType}
                onChange={(e) => setSelectedTemplateType(e.target.value)}
                className="h-8 px-2 rounded-md bg-white dark:bg-slate-900 border border-[var(--border)] text-xs font-bold text-[var(--text-primary)] focus:outline-none cursor-pointer"
              >
                {allTemplateTypes.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <Button variant="outline" onClick={() => handleOpenTemplateEditor(selectedTemplateType)}
              className="flex items-center gap-1.5 text-xs font-bold h-9 rounded-lg">
              <Settings className="h-3.5 w-3.5" />
              Manage Templates
            </Button>
            <AsyncButton onClick={() => handleSendReminders()}
              disabled={selectedBills.size === 0}
              className="flex items-center gap-1.5 h-9 px-4 text-xs font-bold bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-lg disabled:opacity-50 cursor-pointer">
              <MessageSquare className="h-4 w-4" />
              Send WhatsApp ({selectedBills.size})
            </AsyncButton>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-rose-50 rounded-lg"><AlertTriangle className="h-5 w-5 text-rose-600" /></div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Overdue Bills</span>
              <p className="text-2xl font-bold text-rose-600 mt-0.5">{stats.total_overdue}</p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 rounded-lg"><IndianRupee className="h-5 w-5 text-amber-600" /></div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Total Outstanding</span>
              <p className="text-xl font-bold text-amber-600 mt-0.5">{fmt(stats.total_outstanding)}</p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-red-50 rounded-lg"><Clock className="h-5 w-5 text-red-600" /></div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Critical (&gt;30 Days)</span>
              <p className="text-2xl font-bold text-red-600 mt-0.5">{stats.critical}</p>
            </div>
          </div>
        </div>

        {/* WhatsApp Templates Quick View */}
        <div className="bg-gradient-to-br from-[#128C7E]/5 to-[#25D366]/5 border border-[#25D366]/20 rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#25D366]" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">WhatsApp Message Templates</h3>
                <p className="text-[11px] text-slate-500 font-medium">Select or create templates for sending WhatsApp reminders</p>
              </div>
            </div>
            <button
              onClick={() => {
                setEditingTemplate(`custom_${Date.now()}`);
                setTemplateText("Dear {{party_name}}, please find your bill {{invoice_no}} for ₹{{amount}} due on {{due_date}}.\n\nThank you!");
                setShowTemplateEditor(true);
              }}
              className="px-3 py-1.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer self-start sm:self-auto"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Custom Template</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allTemplateTypes.map((t) => {
              const existing = templates.find((tmpl: any) => (tmpl.template_type || tmpl.code) === t.key);
              const isSelected = selectedTemplateType === t.key;
              return (
                <div
                  key={t.key}
                  className={cn(
                    "rounded-lg border p-4 flex items-start justify-between gap-3 transition-all cursor-pointer",
                    isSelected
                      ? "bg-white border-[#25D366] shadow-sm ring-1 ring-[#25D366]/30"
                      : "bg-white/80 border-gray-200 hover:border-gray-300"
                  )}
                  onClick={() => setSelectedTemplateType(t.key)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-900">{t.label}</p>
                      {isSelected && (
                        <span className="bg-[#25D366]/10 text-[#128C7E] text-[9px] font-extrabold px-1.5 py-0.5 rounded">
                          Active Template
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2">
                      {existing?.template_text || (existing as any)?.content || DEFAULT_TEMPLATES[t.key]}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenTemplateEditor(t.key);
                      }}
                      className="text-[10px] font-bold text-[var(--primary)] hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTemplateType(t.key);
                        void handleSendReminders(t.key);
                      }}
                      disabled={selectedBills.size === 0}
                      className="text-[10px] font-extrabold px-2 py-1 bg-[#25D366] text-white rounded hover:bg-[#1ebe5d] disabled:opacity-40"
                    >
                      Use & Send
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Reminders Table & Tabs */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {/* Tab Navigation Bar */}
          <div className="flex items-center gap-6 border-b border-gray-200 px-6 pt-3 bg-slate-50/50">
            <button
              onClick={() => {
                setActiveTab("bills");
                setSelectedBills(new Set());
                setSelectedTemplateType("payment_reminder");
              }}
              className={cn(
                "pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2",
                activeTab === "bills"
                  ? "border-[var(--primary)] text-[var(--primary)] font-extrabold"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              <FileText className="h-4 w-4" />
              <span>Sales Bills ({activeTab === "bills" ? bills.length : "..."})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("cheques");
                setSelectedBills(new Set());
                setSelectedTemplateType("pdc_reminder");
              }}
              className={cn(
                "pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2",
                activeTab === "cheques"
                  ? "border-[var(--primary)] text-[var(--primary)] font-extrabold"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              <Clock className="h-4 w-4 text-amber-500" />
              <span>PDC / Cheque Reminders ({activeTab === "cheques" ? bills.length : "..."})</span>
            </button>
          </div>

          <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100 bg-white">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500">
              {activeTab === "cheques" ? "PDC & Cheque Clearing Reminders" : "Sales Bills — Select & Send Reminders"}
            </h3>
            {bills.length > 0 && (
              <button onClick={handleSelectAll}
                className="text-xs font-bold text-[var(--primary)] hover:underline">
                {selectedBills.size === bills.length ? "Deselect All" : "Select All"}
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4 w-10"></th>
                  <th className="py-3 px-6">Party</th>
                  <th className="py-3 px-6">{activeTab === "cheques" ? "Cheque No / Ref" : "Bill No."}</th>
                  <th className="py-3 px-6">{activeTab === "cheques" ? "Cheque Date" : "Bill Date"}</th>
                  <th className="py-3 px-6">Due Date</th>
                  <th className="py-3 px-6 text-right">Amount</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6">Phone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-slate-700">
                {bills.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                        <p className="font-bold text-slate-500">No overdue bills — great job!</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  bills.map((bill) => (
                    <tr key={bill.id}
                      className={`hover:bg-slate-50/50 h-14 cursor-pointer ${selectedBills.has(bill.id) ? "bg-blue-50/40" : ""}`}
                      onClick={() => handleToggleBill(bill.id)}>
                      <td className="py-3 px-4">
                        <input type="checkbox" readOnly checked={selectedBills.has(bill.id)}
                          className="h-4 w-4 accent-[var(--primary)] rounded cursor-pointer" />
                      </td>
                      <td className="py-3 px-6">
                        <p className="font-bold text-slate-900">
                          {bill.party?.company_name || bill.party?.name || "—"}
                        </p>
                        {bill.party?.company_name && (
                          <p className="text-[10px] text-slate-500">{bill.party.name}</p>
                        )}
                      </td>
                      <td className="py-3 px-6 font-mono font-bold text-slate-900">{bill.bill_number}</td>
                      <td className="py-3 px-6 font-mono text-slate-500">
                        {new Date(bill.bill_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                      </td>
                      <td className="py-3 px-6 font-mono text-rose-600 font-bold">
                        {new Date(bill.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                      </td>
                      <td className="py-3 px-6 text-right font-bold font-mono text-slate-900">
                        {fmt(bill.outstanding_amount)}
                      </td>
                      <td className="py-3 px-6">
                        <span className={`inline-flex px-2 py-1 rounded-full text-[9px] font-extrabold border ${criticalColor(bill.days_overdue)}`}>
                          {bill.days_overdue > 0 ? `${bill.days_overdue}d overdue` : bill.days_overdue === 0 ? "Due today" : `Due in ${Math.abs(bill.days_overdue)}d`}
                        </span>
                      </td>
                      <td className="py-3 px-6 font-mono text-slate-500">
                        {bill.party?.phone || <span className="text-slate-300">No phone</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Template Editor Modal */}
      {showTemplateEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-gray-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Edit Template: {TEMPLATE_TYPES.find((t) => t.key === editingTemplate)?.label}
              </h3>
              <button onClick={() => setShowTemplateEditor(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs font-semibold">
              <div>
                <label className="text-slate-600 block mb-1.5">Template Type</label>
                <select value={editingTemplate} onChange={(e) => {
                  setEditingTemplate(e.target.value);
                  setTemplateText(getTemplate(e.target.value));
                }}
                  className="h-9 px-3 w-full rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold outline-none">
                  {allTemplateTypes.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-slate-600 block mb-1.5 font-bold">Message Text</label>
                <textarea rows={5} value={templateText} onChange={(e) => setTemplateText(e.target.value)}
                  className="w-full p-3 rounded-lg border border-[var(--input-border)] text-xs font-medium outline-none resize-none leading-relaxed" />
              </div>
              <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-3.5 space-y-2">
                <p className="text-xs font-semibold text-slate-700">
                  Use placeholders like <code className="bg-slate-200/80 px-1.5 py-0.5 rounded font-mono text-[11px] text-slate-800">{"{{party_name}}"}</code>, <code className="bg-slate-200/80 px-1.5 py-0.5 rounded font-mono text-[11px] text-slate-800">{"{{invoice_no}}"}</code>, <code className="bg-slate-200/80 px-1.5 py-0.5 rounded font-mono text-[11px] text-slate-800">{"{{amount}}"}</code>, <code className="bg-slate-200/80 px-1.5 py-0.5 rounded font-mono text-[11px] text-slate-800">{"{{due_date}}"}</code>, <code className="bg-slate-200/80 px-1.5 py-0.5 rounded font-mono text-[11px] text-slate-800">{"{{company_name}}"}</code>.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    { code: "{{party_name}}", label: "Party Name" },
                    { code: "{{invoice_no}}", label: "Invoice No" },
                    { code: "{{amount}}", label: "Amount" },
                    { code: "{{due_date}}", label: "Due Date" },
                    { code: "{{company_name}}", label: "Company" },
                    { code: "{{date}}", label: "Bill Date" },
                    { code: "{{bill_url}}", label: "Bill Link" },
                  ].map((v) => (
                    <button
                      type="button"
                      key={v.code}
                      onClick={() => setTemplateText((t) => t + " " + v.code)}
                      className="px-2 py-1 bg-white border border-slate-200 text-slate-800 rounded font-mono text-[10px] font-bold hover:bg-slate-100 shadow-2xs cursor-pointer"
                    >
                      + {v.code}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 bg-slate-50 border-t border-slate-100">
              <Button variant="outline" onClick={() => setShowTemplateEditor(false)}
                className="h-9 text-xs font-bold">Cancel</Button>
              <AsyncButton
                onClick={async (): Promise<void> => {
                  await saveTemplateMutation.mutateAsync({ template_type: editingTemplate, template_text: templateText });
                }}
                className="h-9 px-4 text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white rounded-lg">
                Save Template
              </AsyncButton>
            </div>
          </div>
        </div>
      )}

      {/* Reminder Links Modal */}
      {showLinksModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl border border-gray-200 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">WhatsApp Reminder Links</h3>
              <button onClick={() => setShowLinksModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-3">
              {reminderLinks.map((link, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-900">{link.party_name}</p>
                        {link.bill_count && link.bill_count > 1 && (
                          <span className="px-2 py-0.5 bg-indigo-50 text-[var(--primary)] text-[10px] font-extrabold rounded-full border border-indigo-100">
                            {link.bill_count} Bills Combined
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">Invoices: {link.bill_number} • {link.phone ? `+91 ${link.phone}` : "No phone number"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {link.bill_id && (
                        <button
                          type="button"
                          onClick={() => window.open(`/sales/bills/${link.bill_id}/print?autoDownload=true`, "_blank")}
                          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 border border-slate-300 text-slate-700 bg-white rounded-lg hover:bg-slate-50 shadow-sm cursor-pointer"
                        >
                          <Download className="h-3 w-3 text-slate-500" />
                          <span>Download PDF</span>
                        </button>
                      )}
                      {link.phone ? (
                        <button
                          type="button"
                          onClick={() =>
                            shareInvoiceWithWhatsApp({
                              phone: link.phone,
                              text: link.message,
                              billId: link.bill_id,
                              fileName: `Invoice-${link.bill_number}.pdf`,
                            })
                          }
                          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-[#25D366] text-white rounded-lg hover:bg-[#1ebe5d] shadow-sm cursor-pointer"
                        >
                          <Send className="h-3 w-3" />
                          Send via WhatsApp
                          <ExternalLink className="h-2.5 w-2.5" />
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">No phone</span>
                      )}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <p className="text-[11px] text-slate-700 leading-relaxed font-medium">{link.message}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end px-5 py-4 border-t border-slate-100 bg-slate-50">
              <Button onClick={() => setShowLinksModal(false)} className="h-9 text-xs font-bold">Done</Button>
            </div>
          </div>
        </div>
      )}
    </PageState>
  );
}
