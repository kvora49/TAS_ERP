"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  FileText, Image as ImageIcon, FileSpreadsheet, FileCode,
  Music, Paperclip, Trash2, ExternalLink, Upload, Loader2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarAttachment } from "@/hooks/queries/useCalendarEntries";

interface AttachmentManagerProps {
  entryId?: string;
  attachments?: CalendarAttachment[];
  onAttachmentAdded?: (attachment: CalendarAttachment) => void;
  onAttachmentDeleted?: (id: string) => void;
  readOnly?: boolean;
}

export function AttachmentManager({
  entryId,
  attachments = [],
  onAttachmentAdded,
  onAttachmentDeleted,
  readOnly = false,
}: AttachmentManagerProps) {
  const [uploading, setUploading] = useState(false);

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case "image": return ImageIcon;
      case "pdf": return FileText;
      case "excel": return FileSpreadsheet;
      case "word": return FileCode;
      case "audio": return Music;
      default: return Paperclip;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !entryId) return;

    const file = files[0];
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File size exceeds 20MB limit");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entry_id", entryId);

      const res = await fetch("/api/calendar/attachments", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");

      toast.success("File uploaded");
      onAttachmentAdded?.(json.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to upload file");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this attachment?")) return;
    try {
      const res = await fetch(`/api/calendar/attachments?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Attachment deleted");
      onAttachmentDeleted?.(id);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-3">
      {/* List of attachments */}
      {attachments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {attachments.map((att) => {
            const Icon = getFileIcon(att.file_type);

            return (
              <div
                key={att.id}
                className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] hover:border-[var(--primary)] transition-colors group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded bg-[var(--primary-light)] text-[var(--primary)] shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{att.file_name}</p>
                    <span className="text-[10px] text-[var(--text-muted)]">{formatFileSize(att.file_size)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {att.public_url && (
                    <a
                      href={att.public_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
                      title="Open attachment"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleDelete(att.id)}
                      className="p-1 text-[var(--text-muted)] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete attachment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload area */}
      {!readOnly && entryId && (
        <label className={cn(
          "flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-[var(--input-border)] hover:border-[var(--primary)] bg-[var(--input-bg)] cursor-pointer transition-colors text-xs font-medium text-[var(--text-muted)] hover:text-[var(--primary)]",
          uploading && "opacity-50 pointer-events-none"
        )}>
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" />
              <span>Uploading file...</span>
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              <span>Click to attach file (Images, PDFs, Word, Excel, Audio up to 20MB)</span>
            </>
          )}
          <input
            type="file"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,audio/*"
          />
        </label>
      )}
    </div>
  );
}
