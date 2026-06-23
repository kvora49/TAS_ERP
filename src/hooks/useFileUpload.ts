import { useState } from "react";
import { toast } from "sonner";

export function useFileUpload(folder: string) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const upload = async (file: File): Promise<string | null> => {
    setUploading(true);
    setProgress(0);
    try {
      // 1. Get pre-signed URL from API
      const res = await fetch("/api/upload/presigned", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          folder,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch upload session");
      }

      const { uploadUrl, publicUrl } = await res.json();

      // 2. Perform direct client-to-R2 upload via PUT
      // Note: We use standard XMLHttpRequest to track upload progress if needed,
      // or fetch if basic progress updates are sufficient.
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("R2 upload transfer failed");
      }

      setProgress(100);
      return publicUrl;
    } catch (err: any) {
      console.error("File upload error:", err);
      toast.error(err.message || "Failed to upload file");
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading, progress };
}
