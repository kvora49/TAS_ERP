"use client";

import { useEffect, useState, useRef } from "react";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { InfoBanner } from "@/components/shared/InfoBanner";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MessageSquare,
  Plus,
  Pencil,
  Trash2,
  Send,
  History,
  User,
  Copy,
  ExternalLink,
  FileText,
  Phone,
  Save,
  Users,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface Template {
  id: string;
  name: string;
  code: string;
  category: string;
  content: string;
  is_active: boolean;
  created_at: string;
}

interface Party {
  id: string;
  name: string;
  type: string[];
  phone: string | null;
  whatsapp_number: string | null;
}

interface AuditLog {
  id: string;
  template_code: string;
  message_generated: string;
  status: string;
  created_at: string;
  users?: {
    full_name: string;
  };
  parties?: {
    name: string;
  };
}

export default function CommunicationSettingsPage() {
  const [activeTab, setActiveTab] = useState<"templates" | "parties" | "sandbox" | "logs">("templates");
  const [loading, setLoading] = useState(true);

  // Data states
  const [templates, setTemplates] = useState<Template[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  // Template Form State
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [tmplName, setTmplName] = useState("");
  const [tmplCode, setTmplCode] = useState("");
  const [tmplCategory, setTmplCategory] = useState("Sales");
  const [tmplContent, setTmplContent] = useState("");
  const [tmplActive, setTmplActive] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Party Phone Edit State
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [partyPhone, setPartyPhone] = useState("");
  const [savingParty, setSavingParty] = useState(false);

  // Sandbox State
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [selectedTmplId, setSelectedTmplId] = useState("");
  const [sbInvoiceNo, setSbInvoiceNo] = useState("INV-2026-1001");
  const [sbAmount, setSbAmount] = useState("48,500");
  const [sbDueDate, setSbDueDate] = useState("25-Jun-2026");
  const [sbCompanyName, setSbCompanyName] = useState("TAS ERP");

  // Message Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewRecipientName, setPreviewRecipientName] = useState("");
  const [previewNumber, setPreviewNumber] = useState("");
  const [previewMessageText, setPreviewMessageText] = useState("");
  const [previewTmplCode, setPreviewTmplCode] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tmplRes, partyRes, logRes] = await Promise.all([
        fetch("/api/settings/communication/templates"),
        fetch("/api/settings/communication/parties"),
        fetch("/api/settings/communication/logs"),
      ]);

      if (tmplRes.ok) {
        const tmplData = await tmplRes.json();
        setTemplates(tmplData.templates || []);
      }
      if (partyRes.ok) {
        const partyData = await partyRes.json();
        setParties(partyData.parties || []);
      }
      if (logRes.ok) {
        const logData = await logRes.json();
        setLogs(logData.logs || []);
      }
    } catch (err) {
      toast.error("Error loading communication settings data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Template CRUD
  const handleOpenAddTemplate = () => {
    setEditingTemplate(null);
    setTmplName("");
    setTmplCode("");
    setTmplCategory("Sales");
    setTmplContent("");
    setTmplActive(true);
    setTemplateModalOpen(true);
  };

  const handleOpenEditTemplate = (tmpl: Template) => {
    setEditingTemplate(tmpl);
    setTmplName(tmpl.name);
    setTmplCode(tmpl.code);
    setTmplCategory(tmpl.category);
    setTmplContent(tmpl.content);
    setTmplActive(tmpl.is_active);
    setTemplateModalOpen(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tmplName || !tmplCode || !tmplContent) {
      toast.error("Please fill in Name, Code, and Content");
      return;
    }

    setSavingTemplate(true);
    try {
      const method = editingTemplate ? "PUT" : "POST";
      const payload = editingTemplate
        ? { id: editingTemplate.id, name: tmplName, code: tmplCode, category: tmplCategory, content: tmplContent, is_active: tmplActive }
        : { name: tmplName, code: tmplCode, category: tmplCategory, content: tmplContent, is_active: tmplActive };

      const res = await fetch("/api/settings/communication/templates", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save template failed");

      toast.success(editingTemplate ? "Template updated" : "Template created");
      setTemplateModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Error saving template");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleToggleTemplateStatus = async (tmpl: Template, active: boolean) => {
    try {
      const res = await fetch("/api/settings/communication/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...tmpl,
          is_active: active,
        }),
      });

      if (!res.ok) throw new Error("Status update failed");
      toast.success(`Template ${active ? "activated" : "deactivated"}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Error updating status");
    }
  };

  // Party Phone updates
  const handleOpenEditParty = (party: Party) => {
    setEditingParty(party);
    setPartyPhone(party.whatsapp_number || party.phone || "");
  };

  const handleSavePartyPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParty) return;

    // Validate phone: numbers only, length between 10 and 15
    const digits = partyPhone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) {
      toast.error("Please enter a valid mobile number with country code (e.g. 919876543210)");
      return;
    }

    setSavingParty(true);
    try {
      const res = await fetch("/api/settings/communication/parties", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingParty.id,
          whatsapp_number: digits,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update phone");

      toast.success("Party WhatsApp number updated successfully");
      setEditingParty(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Error updating party");
    } finally {
      setSavingParty(false);
    }
  };

  // Sandbox Generator
  const getSelectedParty = () => parties.find((p) => p.id === selectedPartyId);
  const getSelectedTemplate = () => templates.find((t) => t.id === selectedTmplId);

  const getGeneratedMessageText = () => {
    const tmpl = getSelectedTemplate();
    const party = getSelectedParty();
    if (!tmpl) return "Select a template to generate preview...";
    const pName = party ? party.name : "ABC Textiles";

    return tmpl.content
      .replace(/{{party_name}}/g, pName)
      .replace(/{{invoice_no}}/g, sbInvoiceNo)
      .replace(/{{amount}}/g, sbAmount)
      .replace(/{{due_date}}/g, sbDueDate)
      .replace(/{{company_name}}/g, sbCompanyName);
  };

  const handleLaunchSandboxPreview = () => {
    const tmpl = getSelectedTemplate();
    const party = getSelectedParty();

    if (!tmpl) {
      toast.error("Please select a WhatsApp Template");
      return;
    }
    if (!party) {
      toast.error("Please select a recipient Party");
      return;
    }

    const number = party.whatsapp_number || party.phone;
    if (!number) {
      toast.error("The selected party does not have a WhatsApp number. Set one first.");
      return;
    }

    setPreviewRecipientName(party.name);
    setPreviewNumber(number.replace(/\D/g, ""));
    setPreviewMessageText(getGeneratedMessageText());
    setPreviewTmplCode(tmpl.code);
    setPreviewModalOpen(true);
  };

  const handleOpenWhatsAppUrl = async () => {
    // 1. Log action in Audit Trail (whatsapp_logs)
    try {
      await fetch("/api/settings/communication/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          party_id: selectedPartyId,
          template_code: previewTmplCode,
          message_generated: previewMessageText,
        }),
      });
      fetchData(); // reload log records
    } catch (err) {
      console.error("Failed logging to audit trail:", err);
    }

    // 2. Open WhatsApp Web/App click-to-chat url
    const url = `https://wa.me/${previewNumber}?text=${encodeURIComponent(previewMessageText)}`;
    window.open(url, "_blank");

    setPreviewModalOpen(false);
    toast.success("WhatsApp opened with pre-filled message!");
  };

  const handleCopyPreviewText = () => {
    navigator.clipboard.writeText(previewMessageText);
    toast.success("Message copied to clipboard!");
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <span className="text-sm font-semibold text-slate-500 animate-pulse">
          Loading communication module...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 text-left">
      <SettingsPageHeader
        section="Communication"
        title="Settings > Communication"
        subtitle="Manage WhatsApp message templates and trace communications"
        actionLabel={activeTab === "templates" ? "Create Template" : undefined}
        onAction={activeTab === "templates" ? handleOpenAddTemplate : undefined}
        actionIcon={activeTab === "templates" ? <Plus className="size-4 text-white" /> : undefined}
      />

      {/* Tabs list */}
      <div className="flex border-b border-[#E5E7EB] gap-2 select-none">
        <button
          onClick={() => setActiveTab("templates")}
          className={`py-3 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "templates" ? "border-[#6366F1] text-[#6366F1]" : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          WhatsApp Templates
        </button>
        <button
          onClick={() => setActiveTab("parties")}
          className={`py-3 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "parties" ? "border-[#6366F1] text-[#6366F1]" : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          Party WhatsApp Numbers
        </button>
        <button
          onClick={() => setActiveTab("sandbox")}
          className={`py-3 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "sandbox" ? "border-[#6366F1] text-[#6366F1]" : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          WhatsApp Sandbox
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`py-3 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "logs" ? "border-[#6366F1] text-[#6366F1]" : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          Audit Trail
        </button>
      </div>

      {/* TAB 1: WhatsApp Templates List */}
      {activeTab === "templates" && (
        <SettingsCard
          icon={MessageSquare}
          title="Predefined Templates"
          subtitle="Manage your quick-send templates for customers and suppliers"
        >
          <div className="overflow-x-auto border border-[#E5E7EB] rounded-lg">
            <table className="w-full text-sm text-[#374151]">
              <thead className="bg-[#F9FAFB] text-xs font-semibold text-[#64748B] uppercase tracking-wider h-11">
                <tr>
                  <th className="px-4 py-2 text-left">Template Name</th>
                  <th className="px-4 py-2 text-left">Code</th>
                  <th className="px-4 py-2 text-left">Category</th>
                  <th className="px-4 py-2 text-left">Message Pattern</th>
                  <th className="px-4 py-2 text-center w-[100px]">Status</th>
                  <th className="px-4 py-2 text-center w-[120px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {templates.map((tmpl) => (
                  <tr key={tmpl.id} className="hover:bg-slate-50/50 h-14">
                    <td className="px-4 py-2 font-semibold text-[#0F172A]">{tmpl.name}</td>
                    <td className="px-4 py-2 font-mono text-xs text-indigo-600 font-bold">{tmpl.code}</td>
                    <td className="px-4 py-2">
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                        {tmpl.category}
                      </span>
                    </td>
                    <td className="px-4 py-2 max-w-[300px] truncate text-slate-500 text-xs font-mono whitespace-pre-wrap">
                      {tmpl.content}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <Switch
                        checked={tmpl.is_active}
                        onCheckedChange={(checked) => handleToggleTemplateStatus(tmpl, checked)}
                        size="sm"
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => handleOpenEditTemplate(tmpl)}
                        className="w-8 h-8 rounded-lg border border-[#E5E7EB] hover:bg-slate-100 inline-flex items-center justify-center transition-colors"
                        title="Edit Template"
                      >
                        <Pencil className="size-4 text-[#64748B]" />
                      </button>
                    </td>
                  </tr>
                ))}
                {templates.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-400 italic">
                    No templates configured. Click &quot;Create Template&quot; above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SettingsCard>
      )}

      {/* TAB 2: Party WhatsApp Numbers */}
      {activeTab === "parties" && (
        <SettingsCard
          icon={Users}
          title="Party Contacts Master"
          subtitle="Utility list to manage and validate party WhatsApp numbers for sandboxing"
        >
          <div className="overflow-x-auto border border-[#E5E7EB] rounded-lg">
            <table className="w-full text-sm text-[#374151]">
              <thead className="bg-[#F9FAFB] text-xs font-semibold text-[#64748B] uppercase tracking-wider h-11">
                <tr>
                  <th className="px-4 py-2 text-left">Party Name</th>
                  <th className="px-4 py-2 text-left">Account Type</th>
                  <th className="px-4 py-2 text-left">Base Phone</th>
                  <th className="px-4 py-2 text-left">WhatsApp Number</th>
                  <th className="px-4 py-2 text-center w-[120px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {parties.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 h-14">
                    <td className="px-4 py-2 font-semibold text-[#0F172A]">{p.name}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {p.type.map((t) => (
                          <span key={t} className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700 capitalize">
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-slate-500 text-xs font-mono">{p.phone || "—"}</td>
                    <td className="px-4 py-2 text-[#0F172A] font-mono text-xs font-semibold">
                      {p.whatsapp_number ? (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="size-3 text-green-600 shrink-0" />
                          {p.whatsapp_number}
                        </span>
                      ) : (
                        <span className="text-red-500 italic">Not set</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => handleOpenEditParty(p)}
                        className="h-8 px-2.5 rounded-lg border border-[#E5E7EB] hover:bg-slate-100 text-xs font-bold inline-flex items-center gap-1 text-slate-700 transition-colors cursor-pointer"
                      >
                        <Pencil className="size-3" /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {parties.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400 italic">
                      No parties available in database. Set up parties in ERP first.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Party edit dialog */}
          <Dialog open={editingParty !== null} onOpenChange={() => setEditingParty(null)}>
            <DialogContent className="max-w-sm w-full bg-white rounded-2xl p-6 text-left shadow-xl">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-[#0F172A]">
                  Configure WhatsApp: {editingParty?.name}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSavePartyPhone} className="flex flex-col gap-4 mt-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">
                    WhatsApp Mobile Number
                  </label>
                  <input
                    type="text"
                    value={partyPhone}
                    onChange={(e) => setPartyPhone(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm focus:ring-2 focus:ring-[#6366F1] font-mono"
                    placeholder="e.g. 919876543210"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1.5 leading-snug">
                    Enter the full number including country code without spaces, plus signs, or hyphens (e.g., 91 for India).
                  </span>
                </div>
                <DialogFooter className="mt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingParty(null)}
                    className="h-10 px-4 border border-[#E5E7EB] hover:bg-slate-50 rounded-lg text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingParty}
                    className="h-10 px-4 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1 shadow-sm"
                  >
                    <Save className="size-4" /> Save
                  </button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </SettingsCard>
      )}

      {/* TAB 3: WhatsApp Sandbox Playground */}
      {activeTab === "sandbox" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* SANDBOX CONTROLS */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <SettingsCard
              icon={Send}
              title="WhatsApp Sender Sandbox"
              subtitle="Test Click-to-Chat variables replacement and click simulation"
            >
              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">
                      Select Party/Recipient
                    </label>
                    <select
                      value={selectedPartyId}
                      onChange={(e) => setSelectedPartyId(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm bg-white focus:ring-2 focus:ring-[#6366F1]"
                    >
                      <option value="">Choose party...</option>
                      {parties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.whatsapp_number ? `+${p.whatsapp_number}` : "No number"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">
                      Select Template
                    </label>
                    <select
                      value={selectedTmplId}
                      onChange={(e) => setSelectedTmplId(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm bg-white focus:ring-2 focus:ring-[#6366F1]"
                    >
                      <option value="">Choose template...</option>
                      {templates.filter((t) => t.is_active).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="border-t border-[#F3F4F6] pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">
                      Variable: Invoice No ({"{{invoice_no}}"})
                    </label>
                    <input
                      type="text"
                      value={sbInvoiceNo}
                      onChange={(e) => setSbInvoiceNo(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm focus:ring-2 focus:ring-[#6366F1]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">
                      Variable: Amount ({"{{amount}}"})
                    </label>
                    <input
                      type="text"
                      value={sbAmount}
                      onChange={(e) => setSbAmount(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm focus:ring-2 focus:ring-[#6366F1]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">
                      Variable: Due Date ({"{{due_date}}"})
                    </label>
                    <input
                      type="text"
                      value={sbDueDate}
                      onChange={(e) => setSbDueDate(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm focus:ring-2 focus:ring-[#6366F1]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">
                      Variable: Company Name ({"{{company_name}}"})
                    </label>
                    <input
                      type="text"
                      value={sbCompanyName}
                      onChange={(e) => setSbCompanyName(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm focus:ring-2 focus:ring-[#6366F1]"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-[#F3F4F6]">
                  <button
                    onClick={handleLaunchSandboxPreview}
                    className="w-full h-11 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 shadow-sm shadow-green-100 cursor-pointer"
                  >
                    <MessageSquare className="size-4 shrink-0" /> Send WhatsApp Reminder
                  </button>
                </div>
              </div>
            </SettingsCard>
          </div>

          {/* DYNAMIC MESSAGE PATTERN PREVIEW */}
          <div className="flex flex-col gap-6">
            <div className="border border-[#E5E7EB] rounded-2xl bg-white shadow-sm overflow-hidden flex flex-col h-full min-h-[300px]">
              <div className="bg-[#075E54] text-white p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#128C7E] flex items-center justify-center text-white font-bold text-xs">
                  WA
                </div>
                <div className="text-left leading-none">
                  <span className="text-sm font-semibold block">Live Pattern Output</span>
                  <span className="text-[10px] text-green-100 block mt-1">Pre-render formatting</span>
                </div>
              </div>
              <div className="flex-1 bg-[#ECE5DD] p-4 flex flex-col justify-end text-left select-none relative overflow-y-auto">
                <div className="absolute top-4 left-4 bg-white/70 backdrop-blur-sm rounded-lg px-2.5 py-1 text-[9px] font-bold text-[#64748B]">
                  MESSAGE CONTAINER
                </div>
                <div className="bg-white text-slate-800 rounded-lg p-3 text-xs leading-relaxed max-w-[85%] shadow-sm self-start font-mono whitespace-pre-wrap">
                  {getGeneratedMessageText()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Audit Logs */}
      {activeTab === "logs" && (
        <SettingsCard
          icon={History}
          title="WhatsApp Communication Trail"
          subtitle="Audit history logs for all generated messages sent to parties"
        >
          <div className="overflow-x-auto border border-[#E5E7EB] rounded-lg">
            <table className="w-full text-sm text-[#374151]">
              <thead className="bg-[#F9FAFB] text-xs font-semibold text-[#64748B] uppercase tracking-wider h-11">
                <tr>
                  <th className="px-4 py-2 text-left">Date & Time</th>
                  <th className="px-4 py-2 text-left">Sent By</th>
                  <th className="px-4 py-2 text-left">Recipient Party</th>
                  <th className="px-4 py-2 text-left">Template</th>
                  <th className="px-4 py-2 text-left">Message Generated</th>
                  <th className="px-4 py-2 text-center w-[130px]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 h-14">
                    <td className="px-4 py-2 text-xs font-medium text-slate-500">
                      {new Date(log.created_at).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-2 text-xs font-bold text-slate-700">
                      {log.users?.full_name || "System"}
                    </td>
                    <td className="px-4 py-2 font-semibold text-[#0F172A]">
                      {log.parties?.name || "Unknown Party"}
                    </td>
                    <td className="px-4 py-2 font-mono text-[10px] text-indigo-600 font-bold">
                      {log.template_code}
                    </td>
                    <td className="px-4 py-2 max-w-[250px] truncate text-slate-500 text-xs font-mono" title={log.message_generated}>
                      {log.message_generated}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-[#DCFCE7] text-[#15803D] inline-flex items-center gap-1 select-none">
                        <Check className="size-3" /> {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-400 italic">
                      No communications logged yet. Try sending messages in the Sandbox tab.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SettingsCard>
      )}

      {/* TEMPLATE ADD/EDIT DIALOG */}
      <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
        <DialogContent className="max-w-md w-full bg-white rounded-2xl p-6 text-left shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#0F172A]">
              {editingTemplate ? "Edit WhatsApp Template" : "Add WhatsApp Template"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveTemplate} className="flex flex-col gap-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={tmplName}
                  onChange={(e) => setTmplName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm focus:ring-2 focus:ring-[#6366F1]"
                  placeholder="Payment Reminder"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">
                  Template Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={tmplCode}
                  onChange={(e) => setTmplCode(e.target.value.toUpperCase())}
                  className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm focus:ring-2 focus:ring-[#6366F1] font-mono"
                  placeholder="PAYMENT_REMINDER"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">
                Category
              </label>
              <select
                value={tmplCategory}
                onChange={(e) => setTmplCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm bg-white focus:ring-2 focus:ring-[#6366F1]"
              >
                <option value="Sales">Sales</option>
                <option value="Payment">Payment</option>
                <option value="Procurement">Procurement</option>
                <option value="Logistics">Logistics</option>
                <option value="General">General</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">
                Message Content <span className="text-red-500">*</span>
              </label>
              <textarea
                value={tmplContent}
                onChange={(e) => setTmplContent(e.target.value)}
                className="w-full h-32 p-3 rounded-lg border border-[#D1D5DB] text-xs font-mono focus:ring-2 focus:ring-[#6366F1] focus:outline-none"
                placeholder="Use placeholders like {{party_name}}, {{invoice_no}}, {{amount}}, {{due_date}}, {{company_name}}."
              />
              <span className="text-[10px] text-slate-400 block mt-1.5 leading-snug">
                Supported dynamic tags: <code>{"{{party_name}}"}</code>, <code>{"{{invoice_no}}"}</code>, <code>{"{{amount}}"}</code>, <code>{"{{due_date}}"}</code>, <code>{"{{company_name}}"}</code>.
              </span>
            </div>

            <div className="flex items-center justify-between border border-[#F3F4F6] rounded-xl p-3 bg-slate-50/50">
              <span className="text-xs font-bold text-slate-500 uppercase">Active Status</span>
              <Switch checked={tmplActive} onCheckedChange={setTmplActive} size="sm" />
            </div>

            <DialogFooter className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setTemplateModalOpen(false)}
                className="h-10 px-4 border border-[#E5E7EB] hover:bg-slate-50 rounded-lg text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingTemplate}
                className="h-10 px-4 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1 shadow-sm"
              >
                <Save className="size-4" /> {editingTemplate ? "Update Template" : "Save Template"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MESSAGE PREVIEW AND DISPATCH MODAL */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-md w-full bg-white rounded-2xl p-6 text-left shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#0F172A]">
              WhatsApp Message Preview
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-4 select-none">
            <div className="grid grid-cols-2 gap-4 border-b border-[#F3F4F6] pb-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Recipient</span>
                <span className="text-xs font-semibold text-slate-700 block mt-0.5">{previewRecipientName}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">WhatsApp Number</span>
                <span className="text-xs font-semibold text-slate-700 block mt-0.5">+{previewNumber}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">
                Review & Edit Message
              </label>
              <textarea
                value={previewMessageText}
                onChange={(e) => setPreviewMessageText(e.target.value)}
                className="w-full h-40 p-3 rounded-lg border border-[#D1D5DB] text-xs font-mono focus:ring-2 focus:ring-[#6366F1]"
              />
              <span className="text-[10px] text-amber-600 font-medium block mt-1.5 leading-snug">
                ⚠️ Confirm details before launching WhatsApp. TAS ERP will not auto-send the message. You must click Send manually in the WhatsApp window.
              </span>
            </div>
          </div>

          <DialogFooter className="mt-5 flex gap-3">
            <button
              onClick={() => setPreviewModalOpen(false)}
              className="h-10 px-4 border border-[#E5E7EB] hover:bg-slate-50 rounded-lg text-sm font-semibold flex-1"
            >
              Cancel
            </button>
            <button
              onClick={handleCopyPreviewText}
              className="h-10 px-4 border border-[#E5E7EB] hover:bg-slate-50 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 flex-1"
            >
              <Copy className="size-4 text-slate-500" /> Copy Text
            </button>
            <button
              onClick={handleOpenWhatsAppUrl}
              className="h-10 px-5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 shadow-sm shadow-green-100 flex-[1.5]"
            >
              <ExternalLink className="size-4" /> Open WhatsApp
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
