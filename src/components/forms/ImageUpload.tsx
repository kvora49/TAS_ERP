import React, { useRef } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useFileUpload } from "@/hooks/useFileUpload";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  onRemove?: () => void;
  folder: string;
  className?: string;
  label?: string;
}

export function ImageUpload({
  value,
  onChange,
  onRemove,
  folder,
  className,
  label = "Upload Image",
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading } = useFileUpload(folder);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size exceeds 5MB limit");
      return;
    }

    // Validate type
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Only PNG, JPEG, and WEBP formats are supported");
      return;
    }

    const result = await upload(file);
    if (result.success) {
      onChange(result.url);
      toast.success("Image uploaded successfully");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className={cn("space-y-1.5 select-none", className)}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/png, image/jpeg, image/jpg, image/webp"
        className="hidden"
      />

      {value ? (
        <div className="relative w-32 h-32 rounded-xl border border-[#E5E7EB] overflow-hidden group bg-[#F8FAFC]">
          <img
            src={value}
            alt="Upload Preview"
            className="w-full h-full object-contain p-1.5"
          />
          {/* Remove Overlay Button */}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#DC2626] hover:bg-[#B91C1C] text-white flex items-center justify-center transition-all cursor-pointer shadow-md"
              title="Remove Image"
            >
              <X size={12} strokeWidth={3} />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={uploading}
          className="w-32 h-32 rounded-xl border-2 border-dashed border-[#D1D5DB] hover:border-[#6366F1] hover:bg-[#EEF2FF]/30 transition-all flex flex-col items-center justify-center p-3 text-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:hover:border-[#D1D5DB]"
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 text-[#6366F1] animate-spin" />
          ) : (
            <ImagePlus className="h-6 w-6 text-[#94A3B8]" />
          )}
          <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide">
            {uploading ? "Uploading..." : label}
          </span>
          <span className="text-[9px] text-[#94A3B8] font-medium leading-none">
            Max 5MB
          </span>
        </button>
      )}
    </div>
  );
}
