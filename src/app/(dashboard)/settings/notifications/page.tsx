"use client";

import { useEffect, useState } from "react";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { InfoBanner } from "@/components/shared/InfoBanner";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Bell,
  Settings2,
  Calendar,
  Clock,
  Package,
  ShieldAlert,
  Save,
  Factory,
  CheckSquare,
  AlertTriangle,
  Mail,
  User,
  Info,
} from "lucide-react";
import { toast } from "sonner";

interface Rule {
  id: string;
  type: string;
  is_enabled: boolean;
  days_before: number;
  target_roles: string[];
  enable_email: boolean;
  enable_sms: boolean;
  enable_in_app: boolean;
}

export default function NotificationsSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // General Notification Preferences states
  const [notifDefaultTime, setNotifDefaultTime] = useState("09:00 AM");
  const [notifEmailSenderName, setNotifEmailSenderName] = useState("ABC Garments Pvt. Ltd.");
  const [notifEmailReplyTo, setNotifEmailReplyTo] = useState("noreply@abcgarments.com");
  const [notifWeekend, setNotifWeekend] = useState(true);
  const [notifHoliday, setNotifHoliday] = useState(false);

  // Rules list
  const [rules, setRules] = useState<Rule[]>([]);

  const [editingRuleIdx, setEditingRuleIdx] = useState<number | null>(null);
  const [roleSelectorOpen, setRoleSelectorOpen] = useState(false);

  const ALL_ROLES = ["owner", "admin", "manager", "accountant", "staff", "intern"];
  const ROLE_LABELS: Record<string, string> = {
    owner: "Owner",
    admin: "Admin",
    manager: "Manager",
    accountant: "Accountant",
    staff: "Store Incharge",
    intern: "Production User",
  };

  const handleRoleCheckboxChange = (role: string, checked: boolean) => {
    if (editingRuleIdx === null) return;
    setRules((prev) =>
      prev.map((r, i) => {
        if (i === editingRuleIdx) {
          const updatedRoles = checked
            ? [...r.target_roles, role]
            : r.target_roles.filter((x) => x !== role);
          return { ...r, target_roles: updatedRoles };
        }
        return r;
      })
    );
  };

  const fetchNotificationSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/notifications");
      if (!res.ok) throw new Error("Failed to load notification settings");
      const data = await res.json();

      if (data.settings) {
        setNotifDefaultTime(data.settings.notif_default_time || "09:00 AM");
        setNotifEmailSenderName(data.settings.notif_email_sender_name || "ABC Garments Pvt. Ltd.");
        setNotifEmailReplyTo(data.settings.notif_email_reply_to || "noreply@abcgarments.com");
        setNotifWeekend(data.settings.notif_weekend ?? true);
        setNotifHoliday(data.settings.notif_holiday ?? false);
      }

      setRules(data.rules || []);
    } catch (err: any) {
      toast.error(err.message || "Error loading notification preferences");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotificationSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notif_default_time: notifDefaultTime,
          notif_email_sender_name: notifEmailSenderName,
          notif_email_reply_to: notifEmailReplyTo,
          notif_weekend: notifWeekend,
          notif_holiday: notifHoliday,
          rules,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update notification settings");

      toast.success("Notification preferences saved successfully");
      fetchNotificationSettings();
    } catch (err: any) {
      toast.error(err.message || "Error saving notification settings");
    } finally {
      setSaving(false);
    }
  };

  const handleRuleToggle = (idx: number, checked: boolean) => {
    setRules((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, is_enabled: checked } : r))
    );
  };

  const handleRuleDaysChange = (idx: number, days: number) => {
    setRules((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, days_before: days } : r))
    );
  };

  const handleRuleChannelToggle = (idx: number, field: "enable_email" | "enable_sms" | "enable_in_app", checked: boolean) => {
    setRules((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: checked } : r))
    );
  };

  // Helper mappings for rules
  const getRuleDetails = (type: string) => {
    const details: Record<
      string,
      { label: string; description: string; icon: any; iconBg: string; iconColor: string }
    > = {
      payment_due: {
        label: "Payment Due",
        description: "Send alerts for invoices about to be due",
        icon: Calendar,
        iconBg: "bg-[#EEF2FF]",
        iconColor: "text-[#6366F1]",
      },
      overdue: {
        label: "Payment Overdue",
        description: "Alert when sales invoices remain unpaid after due date",
        icon: Clock,
        iconBg: "bg-[#FEF3C7]",
        iconColor: "text-[#D97706]",
      },
      pdc_reminder: {
        label: "PDC Cheque Due",
        description: "Reminder for Post Dated Cheques maturing soon",
        icon: Calendar,
        iconBg: "bg-[#FEF3C7]",
        iconColor: "text-[#D97706]",
      },
      low_stock: {
        label: "Low Stock",
        description: "Alert when raw material quantities cross minimum thresholds",
        icon: Package,
        iconBg: "bg-[#DBEAFE]",
        iconColor: "text-[#1D4ED8]",
      },
      cheque_bounce: {
        label: "Cheque Bounce",
        description: "High priority warning when bank returns a cheque",
        icon: ShieldAlert,
        iconBg: "bg-[#FEE2E2]",
        iconColor: "text-[#DC2626]",
      },
      stage_delay: {
        label: "Stage Delay",
        description: "Alert if a production batch stays at a stage longer than limit",
        icon: Factory,
        iconBg: "bg-[#DBEAFE]",
        iconColor: "text-[#1D4ED8]",
      },
      lot_complete: {
        label: "Lot Complete",
        description: "Notify manager when a production lot is finished",
        icon: CheckSquare,
        iconBg: "bg-[#DCFCE7]",
        iconColor: "text-[#15803D]",
      },
      write_off_alert: {
        label: "Write-Off Alert",
        description: "Notification for inventory corrections or damages",
        icon: AlertTriangle,
        iconBg: "bg-[#FEE2E2]",
        iconColor: "text-[#DC2626]",
      },
    };

    return (
      details[type] || {
        label: type.replace(/_/g, " "),
        description: "System notification alert",
        icon: Bell,
        iconBg: "bg-[#F1F5F9]",
        iconColor: "text-[#64748B]",
      }
    );
  };

  const getRoleChipColor = (role: string) => {
    if (role === "admin" || role === "owner") return "bg-[#EDE9FE] text-[#6D28D9]";
    return "bg-[#FEF3C7] text-[#D97706]"; // Accountant or manager
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <span className="text-sm font-semibold text-slate-500 animate-pulse">
          Loading notifications configurations...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 text-left">
      <SettingsPageHeader
        section="Notifications"
        title="Settings > Notifications"
        subtitle="Configure and manage notification preferences"
        actionLabel="Save Changes"
        onAction={handleSave}
        actionIcon={<Save className="size-4 text-white" />}
        actionLoading={saving}
      />

      {/* CARD 1 — Notification Rules */}
      <SettingsCard
        icon={Bell}
        title="Notification Rules"
        subtitle="Manage notification rules, timing and recipients"
      >
        <div className="overflow-x-auto border border-[#E5E7EB] rounded-lg mb-4">
          <table className="w-full text-sm text-[#374151]">
            <thead className="bg-[#F9FAFB] text-xs font-semibold text-[#64748B] uppercase tracking-wider h-11">
              <tr>
                <th className="px-4 py-2 text-left w-[200px]">Notification</th>
                <th className="px-4 py-2 text-left w-[220px]">Description</th>
                <th className="px-4 py-2 text-center w-[120px]">Days Before</th>
                <th className="px-4 py-2 text-left w-[180px]">Target Roles</th>
                <th className="px-4 py-2 text-center w-[80px]">Email</th>
                <th className="px-4 py-2 text-center w-[80px]">SMS</th>
                <th className="px-4 py-2 text-center w-[80px]">In-App</th>
                <th className="px-4 py-2 text-center w-[80px]">Status</th>
                <th className="px-4 py-2 text-center w-[60px]">Enabled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {rules.map((r, idx) => {
                const info = getRuleDetails(r.type);
                const IconComp = info.icon;
                const hasDays = r.type !== "cheque_bounce" && r.type !== "lot_complete" && r.type !== "write_off_alert";

                return (
                  <tr key={r.id || r.type} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3.5 font-semibold text-[#0F172A]">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${info.iconBg}`}>
                          <IconComp className={`size-4 ${info.iconColor}`} />
                        </div>
                        <span>{info.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-[#64748B] text-xs sm:text-sm">
                      {info.description}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <input
                          type="number"
                          min="0"
                          disabled={!r.is_enabled || !hasDays}
                          value={hasDays ? r.days_before : 0}
                          onChange={(e) => handleRuleDaysChange(idx, Number(e.target.value))}
                          className="w-14 h-8 text-center border border-[#E5E7EB] rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#6366F1] disabled:opacity-50 disabled:bg-slate-100"
                        />
                        <span className="text-xs text-[#64748B]">days</span>
                      </div>
                    </td>
                    <td
                      className="px-4 py-3.5 cursor-pointer hover:bg-slate-100/50 transition-colors select-none"
                      onClick={() => {
                        setEditingRuleIdx(idx);
                        setRoleSelectorOpen(true);
                      }}
                      title="Click to edit target roles"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {r.target_roles.length === 0 ? (
                          <span className="text-xs text-[#DC2626] font-semibold">No Roles Set</span>
                        ) : (
                          r.target_roles.map((role) => (
                            <span
                              key={role}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${getRoleChipColor(
                                role
                              )}`}
                            >
                              {ROLE_LABELS[role] || role}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <Switch
                        disabled={!r.is_enabled}
                        checked={r.enable_email}
                        onCheckedChange={(checked) =>
                          handleRuleChannelToggle(idx, "enable_email", checked)
                        }
                        size="sm"
                        className="data-[state=checked]:bg-[#6366F1] data-[state=unchecked]:bg-[#D1D5DB]"
                      />
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <Switch
                        disabled={!r.is_enabled}
                        checked={r.enable_sms}
                        onCheckedChange={(checked) =>
                          handleRuleChannelToggle(idx, "enable_sms", checked)
                        }
                        size="sm"
                        className="data-[state=checked]:bg-[#6366F1] data-[state=unchecked]:bg-[#D1D5DB]"
                      />
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <Switch
                        disabled={!r.is_enabled}
                        checked={r.enable_in_app}
                        onCheckedChange={(checked) =>
                          handleRuleChannelToggle(idx, "enable_in_app", checked)
                        }
                        size="sm"
                        className="data-[state=checked]:bg-[#6366F1] data-[state=unchecked]:bg-[#D1D5DB]"
                      />
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded select-none ${
                          r.is_enabled
                            ? "bg-[#DCFCE7] text-[#15803D]"
                            : "bg-[#FEE2E2] text-[#DC2626]"
                        }`}
                      >
                        {r.is_enabled ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <Switch
                        checked={r.is_enabled}
                        onCheckedChange={(checked) => handleRuleToggle(idx, checked)}
                        size="sm"
                        className="data-[state=checked]:bg-[#6366F1] data-[state=unchecked]:bg-[#D1D5DB]"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <InfoBanner
          variant="info"
          text="Days Before: Number of days before the event to send notification (0 = on the day of event)."
          className="mt-0"
        />
      </SettingsCard>

      {/* CARD 2 — Notification Preferences */}
      <SettingsCard
        icon={Settings2}
        title="Notification Preferences"
        subtitle="General notification preferences"
      >
        <div className="flex flex-col gap-6">
          {/* Top row - Input grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                Default Time
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={notifDefaultTime}
                  onChange={(e) => setNotifDefaultTime(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  placeholder="09:00 AM"
                />
                <Clock className="size-4 text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
              <p className="text-xs text-[#94A3B8] mt-1.5">
                Default time to send notifications
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                Email Sender Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={notifEmailSenderName}
                  onChange={(e) => setNotifEmailSenderName(e.target.value)}
                  className="w-full h-10 pl-3 pr-10 rounded-lg border border-[#D1D5DB] text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
                <User className="size-4 text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
              <p className="text-xs text-[#94A3B8] mt-1.5">
                Name used in email notifications
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold text-[#374151] block mb-1.5">
                Email Reply To
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={notifEmailReplyTo}
                  onChange={(e) => setNotifEmailReplyTo(e.target.value)}
                  className="w-full h-10 pl-3 pr-10 rounded-lg border border-[#D1D5DB] text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
                <Mail className="size-4 text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
              <p className="text-xs text-[#94A3B8] mt-1.5">
                Reply-to email address
              </p>
            </div>
          </div>

          {/* Toggle Rows (Weekend/Holiday) */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-8 pt-4 border-t border-[#F3F4F6]">
            <div className="flex items-center justify-between gap-4 bg-slate-50/50 p-4 border border-[#F3F4F6] rounded-xl flex-1 w-full sm:w-auto">
              <div>
                <span className="text-sm font-semibold text-[#374151] block">
                  Enable Weekend Notifications
                </span>
                <span className="text-xs text-[#94A3B8] block mt-1">
                  Allow notifications to be sent on weekends
                </span>
              </div>
              <Switch
                checked={notifWeekend}
                onCheckedChange={setNotifWeekend}
                className="data-[state=checked]:bg-[#6366F1] data-[state=unchecked]:bg-[#D1D5DB] shrink-0"
              />
            </div>

            <div className="flex items-center justify-between gap-4 bg-slate-50/50 p-4 border border-[#F3F4F6] rounded-xl flex-1 w-full sm:w-auto">
              <div>
                <span className="text-sm font-semibold text-[#374151] block">
                  Enable Holiday Notifications
                </span>
                <span className="text-xs text-[#94A3B8] block mt-1">
                  Allow notifications to be sent on company holidays
                </span>
              </div>
              <Switch
                checked={notifHoliday}
                onCheckedChange={setNotifHoliday}
                className="data-[state=checked]:bg-[#6366F1] data-[state=unchecked]:bg-[#D1D5DB] shrink-0"
              />
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* TARGET ROLES SELECTOR DIALOG */}
      <Dialog open={roleSelectorOpen} onOpenChange={setRoleSelectorOpen}>
        <DialogContent className="max-w-xs w-full bg-white rounded-2xl p-6 text-left shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#0F172A]">
              Target Roles: {editingRuleIdx !== null && getRuleDetails(rules[editingRuleIdx]?.type).label}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 mt-4">
            {ALL_ROLES.map((role) => {
              const isChecked = editingRuleIdx !== null && rules[editingRuleIdx]?.target_roles.includes(role);
              return (
                <label key={role} className="flex items-center gap-3 cursor-pointer select-none py-1 hover:bg-slate-50 rounded-lg px-2">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => handleRoleCheckboxChange(role, e.target.checked)}
                    className="rounded border-[#D1D5DB] text-[#6366F1] focus:ring-[#6366F1] h-4 w-4 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-[#374151]">
                    {ROLE_LABELS[role]}
                  </span>
                </label>
              );
            })}
          </div>

          <DialogFooter className="mt-5">
            <button
              onClick={() => setRoleSelectorOpen(false)}
              className="w-full h-10 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-lg text-sm font-semibold cursor-pointer shadow-sm"
            >
              Done
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BOTTOM — About Notifications Banner (Variant 4 — purple about) */}
      <InfoBanner
        variant="about"
        title="About Notifications"
        text="Notifications will be sent based on the rules above. Users will receive only those notifications for which they have the selected target roles."
        className="mt-0"
      />
    </div>
  );
}
