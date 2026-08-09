"use client";

import { useEffect, useState, useRef } from "react";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { InfoBanner } from "@/components/shared/InfoBanner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  CloudUpload,
  Database,
  History,
  Download,
  MoreVertical,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Info,
} from "lucide-react";
import { toast } from "sonner";

interface BackupRecord {
  id: string;
  backup_type: "manual" | "automatic";
  file_key: string;
  file_url: string;
  file_size_bytes: number;
  status: "in_progress" | "completed" | "failed";
  error_message: string | null;
  created_at: string;
  users?: {
    full_name: string;
  };
}

export default function BackupRestoreSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<BackupRecord[]>([]);

  // Restore file selection state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dropdown menu state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Backup Schedule Settings state
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  const [backupFrequency, setBackupFrequency] = useState("daily");
  const [backupTime, setBackupTime] = useState("23:45");
  const [backupRetentionDays, setBackupRetentionDays] = useState(30);
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchBackupSettings = async () => {
    try {
      const res = await fetch("/api/settings/backup");
      if (!res.ok) return;
      const data = await res.json();
      if (data.settings) {
        setAutoBackupEnabled(data.settings.auto_backup_enabled ?? true);
        setBackupFrequency(data.settings.backup_frequency || "daily");
        setBackupTime(data.settings.backup_time || "23:45");
        setBackupRetentionDays(data.settings.backup_retention_days || 30);
      }
    } catch (_err) {}
  };

  const fetchBackupHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/backup-history");
      if (!res.ok) throw new Error("Failed to load backup history");
      const data = await res.json();
      setHistoryRecords(data.history || []);
    } catch (err: any) {
      toast.error(err.message || "Error fetching backup history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackupSettings();
    fetchBackupHistory();
  }, []);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/settings/backup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auto_backup_enabled: autoBackupEnabled,
          backup_frequency: backupFrequency,
          backup_time: backupTime,
          backup_retention_days: backupRetentionDays,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save backup settings");
      toast.success("Backup schedule settings updated successfully");
    } catch (err: any) {
      toast.error(err.message || "Error saving backup settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const getNextScheduledLabel = () => {
    if (!autoBackupEnabled) return "Disabled";
    const FREQ_LABELS: Record<string, string> = {
      thrice_daily: "Thrice Daily (Every 8h)",
      twice_daily: "Twice Daily (Every 12h)",
      daily: "Daily",
      alternate_days: "Alternate Days",
      weekly: "Weekly",
      "10_days": "Every 10 Days",
      monthly: "Monthly (30 Days)",
    };
    const freqName = FREQ_LABELS[backupFrequency] || "Daily";
    return `${freqName} at ${backupTime}`;
  };

  const handleCreateBackup = async () => {
    setCreating(true);
    const toastId = toast.loading("Creating real database backup...");
    try {
      const res = await fetch("/api/settings/backup", { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Backup failed");

      toast.success("Database backup created successfully", { id: toastId });
      fetchBackupHistory();
    } catch (err: any) {
      toast.error(err.message || "Backup execution failed", { id: toastId });
    } finally {
      setCreating(false);
    }
  };

  const handleSyncBuckets = async () => {
    setSyncing(true);
    const toastId = toast.loading("Replicating backups to secondary Cloudflare R2 bucket...");
    try {
      const res = await fetch("/api/admin/backup/sync", { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Sync failed");

      toast.success(
        data.message || `Successfully synced ${data.syncedCount || 0} backup file(s) to secondary bucket.`,
        { id: toastId }
      );
    } catch (err: any) {
      toast.error(err.message || "Backup replication sync failed", { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteBackup = async (id: string) => {
    setActiveMenuId(null);
    const toastId = toast.loading("Deleting backup file...");
    try {
      const res = await fetch(`/api/settings/backup-history/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Deletion failed");

      toast.success("Backup deleted successfully", { id: toastId });
      fetchBackupHistory();
    } catch (err: any) {
      toast.error(err.message || "Error deleting backup", { id: toastId });
    }
  };

  const handleRestoreSubmit = async () => {
    if (!selectedFile) return;

    setConfirmRestoreOpen(false);
    setRestoring(true);
    const toastId = toast.loading("Parsing and restoring database records...");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/settings/backup/restore", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Restore failed");

      toast.success("Database restored successfully! Reloading workspace...", { id: toastId });
      setSelectedFile(null);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      toast.error(err.message || "Restore execution failed", { id: toastId });
    } finally {
      setRestoring(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const lastBackup = historyRecords.find((h) => h.status === "completed");

  return (
    <div className="flex flex-col gap-6 text-left">
      <SettingsPageHeader
        section="Backup & Restore"
        title="Settings > Backup & Restore"
        subtitle="Manage system backups, cross-account replication, and database restoration"
        actionLabel="Create Backup Now"
        onAction={handleCreateBackup}
        actionIcon={<CloudUpload className="size-4 text-white" />}
        actionLoading={creating}
      />

      {/* TOP ROW — 3 columns grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT CARD — Backup to Cloud (R2) */}
        <SettingsCard
          icon={CloudUpload}
          title="Backup to Cloud (R2)"
          subtitle="Create a real database backup to secure Cloudflare R2 storage"
        >
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center bg-[var(--page-bg)] p-3 rounded-lg border border-[var(--border-light)] select-none">
              <div>
                <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">
                  Last Backup
                </span>
                <span className="text-xs font-semibold text-[var(--text-primary)] mt-1 block">
                  {lastBackup
                    ? new Date(lastBackup.created_at).toLocaleString("en-IN")
                    : "Never"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">
                  Next Scheduled
                </span>
                <span className="text-xs font-semibold text-[var(--text-primary)] mt-1 block">
                  {getNextScheduledLabel()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={handleCreateBackup}
                disabled={creating}
                className="w-full h-10 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50 transition-colors"
              >
                <CloudUpload className="size-4 shrink-0" />
                {creating ? "Creating..." : "Backup Now"}
              </button>

              <button
                onClick={handleSyncBuckets}
                disabled={syncing}
                className="w-full h-10 border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary-light)] font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`size-3.5 shrink-0 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing..." : "Sync 2nd Bucket"}
              </button>
            </div>

            <InfoBanner
              variant="info"
              text={`Schedule: ${getNextScheduledLabel()} (Auto-deletes after ${backupRetentionDays} days)`}
              className="mt-1"
            />

            {/* Schedule Configuration Controls */}
            <div className="border-t border-[var(--border-light)] pt-4 mt-1 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[var(--text-primary)]">
                  Enable Automated Backups
                </label>
                <input
                  type="checkbox"
                  checked={autoBackupEnabled}
                  onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                  className="size-4 rounded border-[var(--input-border)] text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                />
              </div>

              {autoBackupEnabled && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">
                      Backup Frequency
                    </label>
                    <select
                      value={backupFrequency}
                      onChange={(e) => setBackupFrequency(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-[var(--input-border)] text-xs bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
                    >
                      <option value="thrice_daily">Thrice Daily (Every 8 Hours)</option>
                      <option value="twice_daily">Twice Daily (Every 12 Hours)</option>
                      <option value="daily">Daily (Every 24 Hours)</option>
                      <option value="alternate_days">Alternate Days (Every 2 Days)</option>
                      <option value="weekly">Weekly</option>
                      <option value="10_days">Every 10 Days</option>
                      <option value="monthly">Monthly (30 Days)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">
                        Scheduled Time
                      </label>
                      <input
                        type="time"
                        value={backupTime}
                        onChange={(e) => setBackupTime(e.target.value)}
                        className="w-full h-9 px-2 rounded-lg border border-[var(--input-border)] text-xs bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">
                        Auto Cleanup
                      </label>
                      <select
                        value={backupRetentionDays}
                        onChange={(e) => setBackupRetentionDays(Number(e.target.value))}
                        className="w-full h-9 px-2 rounded-lg border border-[var(--input-border)] text-xs bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
                      >
                        <option value={7}>7 Days</option>
                        <option value={14}>14 Days</option>
                        <option value={30}>30 Days (1 Month)</option>
                        <option value={60}>60 Days (2 Months)</option>
                        <option value={90}>90 Days (3 Months)</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="w-full h-9 mt-1 border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary-light)] text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {savingSettings ? "Saving schedule..." : "Save Backup Schedule"}
              </button>
            </div>
          </div>
        </SettingsCard>

        {/* CENTER CARD — Last Backup Details */}
        <SettingsCard icon={Database} title="Last Backup Details">
          <div className="flex flex-col justify-between h-full min-h-[180px]">
            <div className="flex flex-col gap-2 text-left select-none">
              <div className="flex py-1.5 border-b border-[var(--border-light)]">
                <span className="text-xs font-semibold text-[var(--text-muted)] w-32 shrink-0">
                  Backup Name
                </span>
                <span className="text-xs font-mono text-[var(--text-primary)] truncate flex-1">
                  {lastBackup ? lastBackup.file_key.split("/").pop() : "N/A"}
                </span>
              </div>
              <div className="flex py-1.5 border-b border-[var(--border-light)]">
                <span className="text-xs font-semibold text-[var(--text-muted)] w-32 shrink-0">
                  Backup Size
                </span>
                <span className="text-xs font-semibold text-[var(--text-primary)] flex-1">
                  {lastBackup ? formatBytes(lastBackup.file_size_bytes) : "N/A"}
                </span>
              </div>
              <div className="flex py-1.5 border-b border-[var(--border-light)]">
                <span className="text-xs font-semibold text-[var(--text-muted)] w-32 shrink-0">
                  Storage Location
                </span>
                <span className="text-xs font-semibold text-[var(--text-primary)] flex-1">
                  {lastBackup?.file_url.startsWith("/backups/") ? "Local Server Backup" : "Cloudflare R2"}
                </span>
              </div>
              <div className="flex py-1.5 border-b border-[var(--border-light)]">
                <span className="text-xs font-semibold text-[var(--text-muted)] w-32 shrink-0">
                  Uploaded On
                </span>
                <span className="text-xs font-semibold text-[var(--text-primary)] flex-1">
                  {lastBackup ? new Date(lastBackup.created_at).toLocaleString("en-IN") : "N/A"}
                </span>
              </div>
            </div>

            {lastBackup && (
              <a
                href={lastBackup.file_url}
                download
                className="w-full h-10 border border-[var(--border)] hover:bg-[var(--table-row-hover)] bg-[var(--card-bg)] text-[var(--text-primary)] font-semibold rounded-lg text-sm flex items-center justify-center gap-2 cursor-pointer shadow-xs mt-4 select-none"
              >
                <Download className="size-4 shrink-0 text-[var(--primary)]" />
                Download Last Backup
              </a>
            )}
          </div>
        </SettingsCard>

        {/* RIGHT CARD — Restore From File */}
        <SettingsCard
          icon={History}
          title="Restore From File"
          subtitle="Upload a backup file (.sql) to restore system data"
        >
          <div className="flex flex-col gap-3">
            {/* Upload Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--table-row-hover)] rounded-xl p-5 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors text-center"
            >
              <CloudUpload className="size-8 text-[var(--text-muted)]" />
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                {selectedFile ? selectedFile.name : "Drag and drop your backup file here"}
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">
                {selectedFile ? formatBytes(selectedFile.size) : "or click to Choose File (.sql)"}
              </span>
              <input
                type="file"
                ref={fileInputRef}
                accept=".sql,.json"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </div>

            {/* Banners */}
            <div className="flex flex-col gap-2">
              <div className="bg-[var(--primary-light)] border border-[var(--primary)]/20 rounded-lg p-2.5 flex items-start gap-2">
                <Info className="size-3.5 text-[var(--primary)] shrink-0 mt-0.5" />
                <span className="text-[10px] text-[var(--text-secondary)] leading-tight">
                  Restores all master data, parties, bills, payments, stock, and lots safely into tenant scope.
                </span>
              </div>

              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 flex items-start gap-2">
                <AlertTriangle className="size-3.5 text-red-500 shrink-0 mt-0.5" />
                <div className="text-left leading-none">
                  <span className="text-[10px] font-bold text-red-600 dark:text-red-400 block">
                    Restoring will overwrite current tenant data.
                  </span>
                  <span className="text-[9px] text-red-500 block mt-1">
                    This action cannot be undone.
                  </span>
                </div>
              </div>
            </div>

            {/* Restore button */}
            <button
              onClick={() => setConfirmRestoreOpen(true)}
              disabled={!selectedFile || restoring}
              className={`w-full h-10 font-semibold rounded-lg text-sm flex items-center justify-center gap-2 cursor-pointer shadow-xs select-none transition-colors ${
                selectedFile && !restoring
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-[var(--page-bg)] text-[var(--text-faint)] cursor-not-allowed border border-[var(--border)]"
              }`}
            >
              {restoring ? "Restoring..." : "Restore Now"}
            </button>
          </div>
        </SettingsCard>
      </div>

      {/* BOTTOM CARD — Backup History */}
      <SettingsCard
        icon={History}
        title="Backup History"
        subtitle="View and manage all system backups"
      >
        <div className="overflow-x-auto border border-[var(--border)] rounded-lg mb-4">
          <table className="w-full text-sm text-[var(--text-body)]">
            <thead className="bg-[var(--table-header-bg)] text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider h-11">
              <tr>
                <th className="px-4 py-2 text-left">Backup Name</th>
                <th className="px-4 py-2 text-left">Date & Time</th>
                <th className="px-4 py-2 text-left">Size</th>
                <th className="px-4 py-2 text-left">Uploaded By</th>
                <th className="px-4 py-2 text-left">Location</th>
                <th className="px-4 py-2 text-center">Status</th>
                <th className="px-4 py-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-[var(--text-muted)]">
                    Loading backup history...
                  </td>
                </tr>
              ) : historyRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-[var(--text-muted)] italic">
                    No backups registered. Click &quot;Create Backup Now&quot; above.
                  </td>
                </tr>
              ) : (
                historyRecords.map((h) => (
                  <tr key={h.id} className="hover:bg-[var(--table-row-hover)] h-12">
                    <td className="px-4 py-2 font-mono text-xs text-[var(--text-primary)] truncate max-w-[200px]">
                      {h.file_key.split("/").pop()}
                    </td>
                    <td className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)]">
                      {new Date(h.created_at).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-2 text-xs font-medium">{formatBytes(h.file_size_bytes)}</td>
                    <td className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)]">
                      {h.users?.full_name || "System"}
                    </td>
                    <td className="px-4 py-2 text-xs text-[var(--text-muted)]">
                      {h.file_url.startsWith("/backups/") ? "Local Server" : "Cloud R2"}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span
                        className={`text-[10px] font-semibold px-2.5 py-0.5 rounded select-none ${
                          h.status === "completed"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : h.status === "failed"
                            ? "bg-red-500/10 text-red-600 dark:text-red-400"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {h.status === "completed"
                          ? "Success"
                          : h.status === "failed"
                          ? "Failed"
                          : "In Progress"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center relative">
                      <div className="flex items-center justify-center gap-1">
                        <a
                          href={h.file_url}
                          download
                          className="w-8 h-8 rounded-lg border border-[var(--border)] hover:bg-[var(--table-row-hover)] flex items-center justify-center"
                          title="Download File"
                        >
                          <Download className="size-4 text-[var(--text-muted)]" />
                        </a>
                        <button
                          onClick={() => setActiveMenuId(activeMenuId === h.id ? null : h.id)}
                          className="w-8 h-8 rounded-lg border border-[var(--border)] hover:bg-[var(--table-row-hover)] flex items-center justify-center"
                        >
                          <MoreVertical className="size-4 text-[var(--text-muted)]" />
                        </button>
                      </div>
                      {activeMenuId === h.id && (
                        <div className="absolute right-4 mt-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg shadow-md z-10 w-28 py-1">
                          <button
                            onClick={() => handleDeleteBackup(h.id)}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 inline-flex items-center gap-1.5"
                          >
                            <Trash2 className="size-3.5 shrink-0" />
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <InfoBanner
          variant="info"
          text={`Backups are retained for ${backupRetentionDays} days. After that, old backups are automatically deleted.`}
          className="mt-0"
        />
      </SettingsCard>

      {/* CONFIRM DATABASE RESTORE DIALOG */}
      <ConfirmDialog
        open={confirmRestoreOpen}
        onOpenChange={setConfirmRestoreOpen}
        title="Confirm Database Restore"
        description="Are you absolutely sure you want to restore the system database from the selected SQL file? This will overwrite current system data and tables for your business. This action CANNOT be undone."
        onConfirm={handleRestoreSubmit}
        confirmText="Yes, Overwrite & Restore"
        cancelText="Cancel"
      />
    </div>
  );
}
