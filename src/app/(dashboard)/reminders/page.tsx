"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bell, MessageSquare, AlertTriangle, CheckCircle2,
  Send, Settings, ExternalLink, X, IndianRupee, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";

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
  bill_number: string;
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
  const [selectedBills, setSelectedBills] = useState<Set<string>>(new Set());
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<string>("payment_reminder");
  const [templateText, setTemplateText] = useState("");
  const [reminderLinks, setReminderLinks] = useState<ReminderLink[]>([]);
  const [showLinksModal, setShowLinksModal] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["reminders"],
    queryFn: async () => {
      const res = await fetch("/api/reminders");
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
    mutationFn: async (billIds: string[]) => {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_reminders", bill_ids: billIds }),
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

  const getTemplate = (type: string) =>
    templates.find((t) => t.template_type === type)?.template_text || DEFAULT_TEMPLATES[type] || "";

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

  const handleSendReminders = async (): Promise<void> => {
    if (selectedBills.size === 0) { void toast.error("Select at least one bill."); return; }
    await sendRemindersMutation.mutateAsync(Array.from(selectedBills));
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

  const criticalColor = (days: number) => {
    if (days > 60) return "bg-red-100 text-red-700 border-red-200";
    if (days > 30) return "bg-orange-100 text-orange-700 border-orange-200";
    if (days > 15) return "bg-amber-100 text-amber-700 border-amber-200";
    return "bg-yellow-100 text-yellow-700 border-yellow-200";
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
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => handleOpenTemplateEditor("payment_reminder")}
              className="flex items-center gap-1.5 text-xs font-bold h-9 rounded-lg">
              <Settings className="h-3.5 w-3.5" />
              Manage Templates
            </Button>
            <AsyncButton onClick={handleSendReminders}
              className="flex items-center gap-1.5 h-9 px-4 text-xs font-bold bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-lg disabled:opacity-50">
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
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-4 w-4 text-[#25D366]" />
            <h3 className="text-sm font-bold text-slate-900">WhatsApp Message Templates</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {TEMPLATE_TYPES.map((t) => {
              const existing = templates.find((tmpl) => tmpl.template_type === t.key);
              return (
                <div key={t.key} className="bg-white rounded-lg border border-gray-200 p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700">{t.label}</p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2">
                      {existing?.template_text || DEFAULT_TEMPLATES[t.key]}
                    </p>
                  </div>
                  <button onClick={() => handleOpenTemplateEditor(t.key)}
                    className="flex-shrink-0 text-[10px] font-bold text-[var(--primary)] hover:underline">
                    Edit
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Overdue Bills Table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500">
              Overdue Bills — Select & Send Reminders
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
                  <th className="py-3 px-6">Bill No.</th>
                  <th className="py-3 px-6">Bill Date</th>
                  <th className="py-3 px-6">Due Date</th>
                  <th className="py-3 px-6 text-right">Outstanding</th>
                  <th className="py-3 px-6">Overdue By</th>
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
                          {bill.days_overdue}d overdue
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
                  {TEMPLATE_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-slate-600 block mb-1.5">Message Text</label>
                <textarea rows={5} value={templateText} onChange={(e) => setTemplateText(e.target.value)}
                  className="w-full p-3 rounded-lg border border-[var(--input-border)] text-xs font-medium outline-none resize-none leading-relaxed" />
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                <p className="text-[10px] font-bold text-amber-700 mb-1.5">Available Variables:</p>
                <div className="flex flex-wrap gap-1.5">
                  {["{name}", "{bill}", "{amount}", "{due}", "{date}", "{days}"].map((v) => (
                    <button key={v} onClick={() => setTemplateText((t) => t + v)}
                      className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-mono text-[10px] font-bold hover:bg-amber-200">
                      {v}
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
                <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{link.party_name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{link.bill_number} • {link.phone || "No phone"}</p>
                    </div>
                    {link.whatsapp_url ? (
                      <a href={link.whatsapp_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-[#25D366] text-white rounded-lg hover:bg-[#1ebe5d]">
                        <Send className="h-3 w-3" />
                        Open WhatsApp
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">No phone</span>
                    )}
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[11px] text-slate-600 leading-relaxed">{link.message}</p>
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
