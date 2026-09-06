"use client";

import { useEffect, useState } from "react";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { InfoBanner } from "@/components/shared/InfoBanner";
import { Switch } from "@/components/ui/switch";
import { Modal } from "@/components/shared/Modal";
import PageState from "@/components/shared/PageState";
import { useNotificationSettings, NotificationRule } from "@/hooks/useNotificationSettings";
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
  Smartphone,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { usePWAWebPush } from "@/hooks/usePWAWebPush";
import { cn } from "@/lib/utils";

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
  const { permission, requestNotificationPermission, sendTestLockScreenPush } = usePWAWebPush();
  const { data, isLoading, error, refetch, updateSettings, isSaving } = useNotificationSettings();

  // General Notification Preferences states
  const [notifEmailSenderName, setNotifEmailSenderName] = useState("ABC Garments Pvt. Ltd.");
  const [notifEmailReplyTo, setNotifEmailReplyTo] = useState("noreply@abcgarments.com");
  const [notifWeekend, setNotifWeekend] = useState(true);
  const [notifHoliday, setNotifHoliday] = useState(false);

  // Rules list
  const [rules, setRules] = useState<NotificationRule[]>([]);

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

  useEffect(() => {
    if (data?.settings) {
      setNotifEmailSenderName(data.settings.notif_email_sender_name || "ABC Garments Pvt. Ltd.");
      setNotifEmailReplyTo(data.settings.notif_email_reply_to || "noreply@abcgarments.com");
      setNotifWeekend(data.settings.notif_weekend ?? true);
      setNotifHoliday(data.settings.notif_holiday ?? false);
    }
    if (data?.rules) {
      setRules(data.rules);
    }
  }, [data]);

  const handleSave = async () => {
    await updateSettings({
      notif_email_sender_name: notifEmailSenderName,
      notif_email_reply_to: notifEmailReplyTo,
      notif_weekend: notifWeekend,
      notif_holiday: notifHoliday,
      rules,
    });
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

  return (
    <PageState
      isLoading={isLoading}
      isError={!!error}
      error={error?.message}
      onRetry={refetch}
      skeletonVariant="form"
    >
      <div className="flex flex-col gap-6 text-left">
        <SettingsPageHeader
          section="Notifications"
          title="Settings > Notifications"
          subtitle="Configure and manage notification preferences"
          actionLabel="Save Changes"
          onAction={handleSave}
          actionIcon={<Save className="size-4 text-white" />}
          actionLoading={isSaving}
        />

      {/* CARD 1 — Notification Rules */}
      <SettingsCard
        icon={Bell}
        title="Notification Rules"
        subtitle="Manage notification rules, timing and recipients"
      >
        {/* Mobile Notification Rule Cards (< md) */}
        <div className="md:hidden space-y-3.5 mb-4">
          {rules.map((r, idx) => {
            const info = getRuleDetails(r.type);
            const IconComp = info.icon;
            const hasDays = r.type !== "cheque_bounce" && r.type !== "lot_complete" && r.type !== "write_off_alert";

            return (
              <div
                key={r.id || r.type}
                className={cn(
                  "p-4 rounded-xl border transition-all bg-[var(--card-bg)] space-y-3 shadow-2xs",
                  r.is_enabled
                    ? "border-[var(--border)]"
                    : "border-[var(--border-light)] opacity-75"
                )}
              >
                {/* Header: Icon + Title + Master Switch */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${info.iconBg}`}>
                      <IconComp className={`size-4 ${info.iconColor}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-sm text-[var(--text-primary)] block truncate">
                        {info.label}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        {r.is_enabled ? "Active Rule" : "Rule Disabled"}
                      </span>
                    </div>
                  </div>
                  <Switch
                    checked={r.is_enabled}
                    onCheckedChange={(checked) => handleRuleToggle(idx, checked)}
                    size="sm"
                    className="data-[state=checked]:bg-[var(--primary)] shrink-0"
                  />
                </div>

                {/* Description */}
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  {info.description}
                </p>

                {/* Timing (Days Before) if applicable */}
                {hasDays && (
                  <div className="flex items-center justify-between bg-[var(--page-bg)] px-3 py-2 rounded-lg border border-[var(--border-light)] text-xs">
                    <span className="font-medium text-[var(--text-body)]">Trigger Timing</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        disabled={!r.is_enabled}
                        value={r.days_before}
                        onChange={(e) => handleRuleDaysChange(idx, Number(e.target.value))}
                        className="w-12 h-7 text-center border border-[var(--input-border)] rounded-md text-xs font-bold bg-[var(--input-bg)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--input-focus)] disabled:opacity-50"
                      />
                      <span className="text-[11px] text-[var(--text-muted)]">days before</span>
                    </div>
                  </div>
                )}

                {/* Target Roles */}
                <div
                  className="bg-[var(--page-bg)] p-2.5 rounded-lg border border-[var(--border-light)] cursor-pointer hover:border-[var(--primary)] transition-colors"
                  onClick={() => {
                    setEditingRuleIdx(idx);
                    setRoleSelectorOpen(true);
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Target Recipients
                    </span>
                    <span className="text-[10px] text-[var(--primary)] font-semibold">Change</span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {r.target_roles.length === 0 ? (
                      <span className="text-xs text-red-500 font-semibold">No Roles Set</span>
                    ) : (
                      r.target_roles.map((role) => (
                        <span
                          key={role}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${getRoleChipColor(role)}`}
                        >
                          {ROLE_LABELS[role] || role}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Notification Channels */}
                <div className="pt-2 border-t border-[var(--border-light)] grid grid-cols-3 gap-2">
                  <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-[var(--page-bg)] border border-[var(--border-light)] gap-1">
                    <span className="text-[11px] font-semibold text-[var(--text-body)]">Email</span>
                    <Switch
                      disabled={!r.is_enabled}
                      checked={r.enable_email}
                      onCheckedChange={(checked) => handleRuleChannelToggle(idx, "enable_email", checked)}
                      size="sm"
                      className="data-[state=checked]:bg-[var(--primary)]"
                    />
                  </div>
                  <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-[var(--page-bg)] border border-[var(--border-light)] gap-1">
                    <span className="text-[11px] font-semibold text-[var(--text-body)]">SMS</span>
                    <Switch
                      disabled={!r.is_enabled}
                      checked={r.enable_sms}
                      onCheckedChange={(checked) => handleRuleChannelToggle(idx, "enable_sms", checked)}
                      size="sm"
                      className="data-[state=checked]:bg-[var(--primary)]"
                    />
                  </div>
                  <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-[var(--page-bg)] border border-[var(--border-light)] gap-1">
                    <span className="text-[11px] font-semibold text-[var(--text-body)]">In-App</span>
                    <Switch
                      disabled={!r.is_enabled}
                      checked={r.enable_in_app}
                      onCheckedChange={(checked) => handleRuleChannelToggle(idx, "enable_in_app", checked)}
                      size="sm"
                      className="data-[state=checked]:bg-[var(--primary)]"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Table (hidden on mobile) */}
        <div className="hidden md:block overflow-x-auto border border-[var(--border)] rounded-lg mb-4">
          <table className="w-full text-sm text-[var(--text-body)]">
            <thead className="bg-[var(--table-header-bg)] text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider h-11">
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
            <tbody className="divide-y divide-[var(--border)]">
              {rules.map((r, idx) => {
                const info = getRuleDetails(r.type);
                const IconComp = info.icon;
                const hasDays = r.type !== "cheque_bounce" && r.type !== "lot_complete" && r.type !== "write_off_alert";

                return (
                  <tr key={r.id || r.type} className="hover:bg-[var(--table-row-hover)] transition-colors">
                    <td className="px-4 py-3.5 font-semibold text-[var(--text-primary)]">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${info.iconBg}`}>
                          <IconComp className={`size-4 ${info.iconColor}`} />
                        </div>
                        <span>{info.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-[var(--text-muted)] text-xs sm:text-sm">
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
                          className="w-14 h-8 text-center border border-[var(--input-border)] rounded-lg text-sm bg-[var(--input-bg)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--input-focus)] disabled:opacity-50 disabled:bg-[var(--page-bg)]"
                        />
                        <span className="text-xs text-[var(--text-muted)]">days</span>
                      </div>
                    </td>
                    <td
                      className="px-4 py-3.5 cursor-pointer hover:bg-[var(--table-row-hover)] transition-colors select-none"
                      onClick={() => {
                        setEditingRuleIdx(idx);
                        setRoleSelectorOpen(true);
                      }}
                      title="Click to edit target roles"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {r.target_roles.length === 0 ? (
                          <span className="text-xs text-red-500 font-semibold">No Roles Set</span>
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
                        className="data-[state=checked]:bg-[var(--primary)]"
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
                        className="data-[state=checked]:bg-[var(--primary)]"
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
                        className="data-[state=checked]:bg-[var(--primary)]"
                      />
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded select-none ${
                          r.is_enabled
                            ? "bg-green-500/10 text-green-600 dark:text-green-400"
                            : "bg-red-500/10 text-red-500"
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
                        className="data-[state=checked]:bg-[var(--primary)]"
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
          {/* Input grid — Email Sender Name + Reply To */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      {/* CARD 3 — PWA Lock Screen & Background Push */}
      <SettingsCard
        icon={Smartphone}
        title="PWA Mobile & Lock Screen Push"
        subtitle="Configure and test Web Push notifications for locked screens and mobile background delivery"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[var(--page-bg)] p-4 border border-[var(--border)] rounded-xl">
            <div>
              <span className="text-sm font-semibold text-[var(--text-primary)] block">
                Browser Notification Permission
              </span>
              <span className="text-xs text-[var(--text-muted)] block mt-1">
                Status: <strong className="capitalize">{permission}</strong> {permission === "granted" ? "— Active ✅" : "— Not Enabled ❌"}
              </span>
            </div>
            {permission !== "granted" ? (
              <button
                type="button"
                onClick={requestNotificationPermission}
                className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Enable Lock Screen Push
              </button>
            ) : (
              <button
                type="button"
                onClick={() => sendTestLockScreenPush()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2"
              >
                <Send className="size-3.5" /> Test Lock Screen Push
              </button>
            )}
          </div>
        </div>
      </SettingsCard>

      {/* TARGET ROLES SELECTOR MODAL */}
      <Modal
        open={roleSelectorOpen}
        onOpenChange={setRoleSelectorOpen}
        title={`Target Roles: ${editingRuleIdx !== null ? getRuleDetails(rules[editingRuleIdx]?.type).label : ""}`}
        maxWidth="max-w-sm"
      >
        <div className="flex flex-col gap-2 mt-3">
          {ALL_ROLES.map((role) => {
            const isChecked = editingRuleIdx !== null && rules[editingRuleIdx]?.target_roles.includes(role);
            return (
              <label key={role} className="flex items-center gap-3 cursor-pointer select-none py-2 hover:bg-[var(--table-row-hover)] rounded-lg px-2.5 transition-colors">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => handleRoleCheckboxChange(role, e.target.checked)}
                  className="rounded border-[var(--input-border)] text-[var(--primary)] focus:ring-[var(--input-focus)] h-4 w-4 cursor-pointer"
                />
                <span className="text-sm font-medium text-[var(--text-body)]">
                  {ROLE_LABELS[role]}
                </span>
              </label>
            );
          })}
        </div>

        <div className="mt-5 pt-3 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={() => setRoleSelectorOpen(false)}
            className="w-full h-10 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white rounded-lg text-sm font-semibold cursor-pointer shadow-[var(--shadow-sm)] transition-colors"
          >
            Done
          </button>
        </div>
      </Modal>

      {/* BOTTOM — About Notifications Banner */}
      <InfoBanner
        variant="about"
        title="About Notifications"
        text="Notifications will be sent based on the rules above. Users will receive only those notifications for which they have the selected target roles."
        className="mt-0"
      />
    </div>
    </PageState>
  );
}
