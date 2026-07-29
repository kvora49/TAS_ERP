import React, { useRef, useState } from "react";
import { UploadCloud, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AttachmentDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  selectedFiles: File[];
  onRemoveFile: (index: number) => void;
  accept?: string;
  maxSizeMB?: number;
  className?: string;
}

export function AttachmentDropzone({
  onFilesSelected,
  selectedFiles,
  onRemoveFile,
  accept = ".pdf,.jpg,.jpeg,.png",
  maxSizeMB = 5,
  className,
}: AttachmentDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const processFiles = (fileList: FileList) => {
    const validFiles: File[] = [];
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    const acceptedExtensions = accept.split(",").map(ext => ext.trim().toLowerCase());

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const extension = "." + file.name.split(".").pop()?.toLowerCase();

      const isValidExtension = acceptedExtensions.some(ext => {
        if (ext === "*") return true;
        if (ext.startsWith("image/*") && file.type.startsWith("image/")) return true;
        return ext === extension;
      });

      if (!isValidExtension) {
        toast.error(`Invalid file type: ${file.name}. Only ${accept} allowed.`);
        continue;
      }

      if (file.size > maxSizeBytes) {
        toast.error(`File too large: ${file.name}. Max size is ${maxSizeMB}MB.`);
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const triggerInput = () => {
    fileInputRef.current?.click();
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className={cn("w-full", className)}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        multiple
        accept={accept}
      />
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerInput}
        className={cn(
          "border-2 border-dashed border-[var(--input-border)] rounded-xl p-6 flex flex-col items-center gap-3 cursor-pointer hover:border-[var(--primary)] hover:bg-[var(--table-row-hover)] transition-colors text-center select-none",
          isDragActive && "border-[var(--primary)] bg-[var(--table-row-hover)]"
        )}
      >
        <UploadCloud className="size-8 text-[var(--text-faint)]" />
        <div className="flex flex-col gap-1">
          <span className="text-sm text-[var(--text-body)] font-medium">
            Click to upload or drag and drop
          </span>
          <span className="text-xs text-[var(--text-faint)]">
            PDF, JPG, PNG (Max {maxSizeMB}MB)
          </span>
        </div>
        <button
          type="button"
          className="border border-[var(--border)] h-9 px-4 rounded-lg text-sm bg-[var(--card-bg)] text-[var(--text-body)] hover:bg-[var(--page-bg)] font-medium mt-1 shrink-0"
        >
          Browse Files
        </button>
      </div>

      {selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          {selectedFiles.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 border border-[var(--border)] rounded-lg bg-[var(--card-bg)]"
            >
              <div className="flex items-center gap-2 overflow-hidden mr-2">
                <FileText className="size-4 text-[var(--primary)] shrink-0" />
                <span className="text-xs text-[var(--text-body)] font-medium truncate">
                  {file.name}
                </span>
                <span className="text-[10px] text-[var(--text-faint)] shrink-0">
                  ({formatSize(file.size)})
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFile(idx);
                }}
                className="p-1 hover:bg-red-500/10 hover:text-red-500 rounded text-[var(--text-faint)]"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
