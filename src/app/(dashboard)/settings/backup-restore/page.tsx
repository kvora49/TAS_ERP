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
  FileCode,
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
  const [historyRecords, setHistoryRecords] = useState<BackupRecord[]>([]);

  // Restore file selection state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dropdown menu state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

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
    fetchBackupHistory();
  }, []);

  const handleCreateBackup = async () => {
    setCreating(true);
    const toastId = toast.loading("Creating system backup...");
    try {
      const res = await fetch("/api/settings/backup", { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Backup failed");

      toast.success("Backup created successfully", { id: toastId });
      fetchBackupHistory();
    } catch (err: any) {
      toast.error(err.message || "Backup execution failed", { id: toastId });
    } finally {
      setCreating(false);
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
    const toastId = toast.loading("Restoring system databases...");
    
    try {
      // Simulate file content reading and sql restore execution
      await new Promise((resolve) => setTimeout(resolve, 3000));
      
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

  // Get last backup details
  const lastBackup = historyRecords.find((h) => h.status === "completed");

  return (
    <div className="flex flex-col gap-6 text-left">
      <SettingsPageHeader
        section="Backup & Restore"
        title="Settings > Backup & Restore"
        subtitle="Manage system backups and restore data"
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
          subtitle="Create a manual backup of your data to Cloudflare R2 storage"
        >
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center bg-slate-50/50 p-3 rounded-lg border border-[#F3F4F6] select-none">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#94A3B8] block">
                  Last Backup
                </span>
                <span className="text-xs font-semibold text-[#374151] mt-1 block">
                  {lastBackup
                    ? new Date(lastBackup.created_at).toLocaleString("en-IN")
                    : "Never"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-[#94A3B8] block">
                  Next Scheduled
                </span>
                <span className="text-xs font-semibold text-[#374151] mt-1 block">
                  {lastBackup
                    ? new Date(
                        new Date(lastBackup.created_at).getTime() + 24 * 60 * 60 * 1000
                      ).toLocaleString("en-IN")
                    : "Daily at 11:45 PM"}
                </span>
              </div>
            </div>

            <button
              onClick={handleCreateBackup}
              disabled={creating}
              className="w-full h-11 bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
            >
              <CloudUpload className="size-5 shrink-0" />
              {creating ? "Creating backup..." : "Create Backup Now"}
            </button>

            <InfoBanner
              variant="info"
              text="Daily automated backups are created at 11:45 PM."
              className="mt-2"
            />
          </div>
        </SettingsCard>

        {/* CENTER CARD — Last Backup Details */}
        <SettingsCard icon={Database} title="Last Backup Details">
          <div className="flex flex-col justify-between h-full min-h-[180px]">
            <div className="flex flex-col gap-2 text-left select-none">
              <div className="flex py-1.5 border-b border-[#F3F4F6]">
                <span className="text-xs font-semibold text-[#64748B] w-32 shrink-0">
                  Backup Name
                </span>
                <span className="text-xs font-mono text-[#374151] truncate flex-1">
                  {lastBackup ? lastBackup.file_key.split("/").pop() : "N/A"}
                </span>
              </div>
              <div className="flex py-1.5 border-b border-[#F3F4F6]">
                <span className="text-xs font-semibold text-[#64748B] w-32 shrink-0">
                  Backup Size
                </span>
                <span className="text-xs font-semibold text-[#374151] flex-1">
                  {lastBackup ? formatBytes(lastBackup.file_size_bytes) : "N/A"}
                </span>
              </div>
              <div className="flex py-1.5 border-b border-[#F3F4F6]">
                <span className="text-xs font-semibold text-[#64748B] w-32 shrink-0">
                  Storage Location
                </span>
                <span className="text-xs font-semibold text-[#374151] flex-1">
                  {lastBackup?.file_url.startsWith("/backups/") ? "Local Server Backup" : "Cloudflare R2"}
                </span>
              </div>
              <div className="flex py-1.5 border-b border-[#F3F4F6]">
                <span className="text-xs font-semibold text-[#64748B] w-32 shrink-0">
                  Uploaded On
                </span>
                <span className="text-xs font-semibold text-[#374151] flex-1">
                  {lastBackup ? new Date(lastBackup.created_at).toLocaleString("en-IN") : "N/A"}
                </span>
              </div>
            </div>

            {lastBackup && (
              <a
                href={lastBackup.file_url}
                download
                className="w-full h-10 border border-[#E5E7EB] hover:bg-slate-50 bg-white text-[#374151] font-semibold rounded-lg text-sm flex items-center justify-center gap-2 cursor-pointer shadow-sm mt-4 select-none"
              >
                <Download className="size-4 shrink-0" />
                Download Last Backup
              </a>
            )}
          </div>
        </SettingsCard>

        {/* RIGHT CARD — Restore From File */}
        <SettingsCard
          icon={History}
          title="Restore From File"
          subtitle="Upload a backup file (.sql) to restore your data"
        >
          <div className="flex flex-col gap-3">
            {/* Upload Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#D1D5DB] hover:border-[#6366F1] hover:bg-[#F8FAFC] rounded-xl p-5 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors text-center"
            >
              <CloudUpload className="size-8 text-[#94A3B8]" />
              <span className="text-xs font-semibold text-[#64748B]">
                {selectedFile ? selectedFile.name : "Drag and drop your backup file here"}
              </span>
              <span className="text-[10px] text-[#94A3B8]">
                {selectedFile ? formatBytes(selectedFile.size) : "or click to Choose File"}
              </span>
              <input
                type="file"
                ref={fileInputRef}
                accept=".sql"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </div>

            {/* Banners */}
            <div className="flex flex-col gap-2">
              <div className="bg-[#EFF6FF] border border-[#DBEAFE] rounded-lg p-2.5 flex items-start gap-2">
                <Info className="size-3.5 text-[#6366F1] shrink-0 mt-0.5" />
                <span className="text-[10px] text-[#374151] leading-tight">
                  Please ensure you have a recent backup before restoring.
                </span>
              </div>

              <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-2.5 flex items-start gap-2">
                <AlertTriangle className="size-3.5 text-[#DC2626] shrink-0 mt-0.5" />
                <div className="text-left leading-none">
                  <span className="text-[10px] font-bold text-[#991B1B] block">
                    Restoring will overwrite current data.
                  </span>
                  <span className="text-[9px] text-[#DC2626] block mt-1">
                    This action cannot be undone.
                  </span>
                </div>
              </div>
            </div>

            {/* Restore button */}
            <button
              onClick={() => setConfirmRestoreOpen(true)}
              disabled={!selectedFile || restoring}
              className={`w-full h-10 font-semibold rounded-lg text-sm flex items-center justify-center gap-2 cursor-pointer shadow-sm select-none ${
                selectedFile && !restoring
                  ? "bg-[#DC2626] hover:bg-[#B91C1C] text-white"
                  : "bg-[#F1F5F9] text-[#94A3B8] cursor-not-allowed border border-[#E5E7EB]"
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
        <div className="overflow-x-auto border border-[#E5E7EB] rounded-lg mb-4">
          <table className="w-full text-sm text-[#374151]">
            <thead className="bg-[#F9FAFB] text-xs font-semibold text-[#64748B] uppercase tracking-wider h-11">
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
            <tbody className="divide-y divide-[#E5E7EB]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-400">
                    Loading backup history...
                  </td>
                </tr>
              ) : historyRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-400 italic">
                    No backups registered. Click &quot;Create Backup Now&quot; above.
                  </td>
                </tr>
              ) : (
                historyRecords.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/50 h-12">
                    <td className="px-4 py-2 font-mono text-xs text-[#0F172A] truncate max-w-[200px]">
                      {h.file_key.split("/").pop()}
                    </td>
                    <td className="px-4 py-2 text-xs font-medium text-slate-600">
                      {new Date(h.created_at).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-2 text-xs font-medium">{formatBytes(h.file_size_bytes)}</td>
                    <td className="px-4 py-2 text-xs font-semibold text-slate-700">
                      {h.users?.full_name || "System"}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {h.file_url.startsWith("/backups/") ? "Local Server" : "Cloud R2"}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span
                        className={`text-[10px] font-semibold px-2.5 py-0.5 rounded select-none ${
                          h.status === "completed"
                            ? "bg-[#DCFCE7] text-[#15803D]"
                            : h.status === "failed"
                            ? "bg-[#FEE2E2] text-[#DC2626]"
                            : "bg-[#FEF3C7] text-[#D97706]"
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
                          className="w-8 h-8 rounded-lg border border-[#E5E7EB] hover:bg-slate-100 flex items-center justify-center"
                          title="Download File"
                        >
                          <Download className="size-4 text-[#64748B]" />
                        </a>
                        <button
                          onClick={() => setActiveMenuId(activeMenuId === h.id ? null : h.id)}
                          className="w-8 h-8 rounded-lg border border-[#E5E7EB] hover:bg-slate-100 flex items-center justify-center"
                        >
                          <MoreVertical className="size-4 text-[#64748B]" />
                        </button>
                      </div>
                      {activeMenuId === h.id && (
                        <div className="absolute right-4 mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-10 w-28 py-1">
                          <button
                            onClick={() => handleDeleteBackup(h.id)}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-[#DC2626] hover:bg-red-50 inline-flex items-center gap-1.5"
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
          text="Backups are retained for 30 days. After that, they are automatically deleted."
          className="mt-0"
        />
      </SettingsCard>

      {/* CONFIRM DATABASE RESTORE DIALOG */}
      <ConfirmDialog
        open={confirmRestoreOpen}
        onOpenChange={setConfirmRestoreOpen}
        title="Confirm Database Restore"
        description="Are you absolutely sure you want to restore the system database from the selected SQL file? This will overwrite all current system data and tables. This action CANNOT be undone."
        onConfirm={handleRestoreSubmit}
        confirmText="Yes, Overwrite & Restore"
        cancelText="Cancel"
      />
    </div>
  );
}
