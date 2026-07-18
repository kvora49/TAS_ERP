import { useState } from "react";
import { API_ENDPOINTS } from "@/lib/constants";

export type UploadResult = 
  | { success: true; url: string }
  | { success: false; error: string };

export function useFileUpload(folder: string) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const upload = async (file: File): Promise<UploadResult> => {
    setUploading(true);
    setProgress(0);
    try {
      // 1. Get pre-signed URL from API
      const res = await fetch(API_ENDPOINTS.UPLOAD_PRESIGNED, {
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
        return { success: false, error: errorData.error || "Failed to fetch upload session" };
      }

      const { uploadUrl, publicUrl } = await res.json();

      // 2. Perform direct client-to-R2 upload via PUT using XMLHttpRequest for true progress tracking
      return new Promise<UploadResult>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", file.type);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            setProgress(percentComplete);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setProgress(100);
            resolve({ success: true, url: publicUrl });
          } else {
            resolve({ success: false, error: "R2 upload transfer failed" });
          }
        };

        xhr.onerror = () => {
          resolve({ success: false, error: "R2 upload network error" });
        };

        xhr.send(file);
      });
    } catch (err: unknown) {
      console.error("File upload error:", err);
      const errMsg = err instanceof Error ? err.message : "Failed to upload file";
      return { success: false, error: errMsg };
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading, progress };
}
