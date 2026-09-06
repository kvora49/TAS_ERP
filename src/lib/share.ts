import { toast } from "sonner";
import { triggerHaptic } from "@/lib/haptics";

export interface ShareOptions {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
}

export interface ShareResult {
  success: boolean;
  method: "native" | "clipboard" | "aborted" | "error";
  error?: any;
}

/**
 * Checks if the Web Share API is available on the current device/browser.
 */
export function isShareSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/**
 * Checks if file sharing via Web Share API is supported for the given files.
 */
export function canShareFiles(files: File[]): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files })
  );
}

/**
 * Universal Native Web Share helper with clipboard fallback:
 * 1. Checks if native `navigator.share` is available.
 * 2. Attempts native OS share sheet with haptic feedback.
 * 3. Handles user cancellation (AbortError) gracefully without displaying noisy error alerts.
 * 4. Gracefully falls back to clipboard copying if native sharing is unavailable or fails.
 */
export async function shareContent(options: ShareOptions): Promise<ShareResult> {
  const { title, text, url, files } = options;

  triggerHaptic("impactLight");

  // 1. Try native share with files if provided and supported
  if (files && files.length > 0 && canShareFiles(files)) {
    try {
      await navigator.share({ title, text, url, files });
      triggerHaptic("success");
      return { success: true, method: "native" };
    } catch (err: any) {
      if (err.name === "AbortError") {
        return { success: false, method: "aborted" };
      }
      console.warn("Native file share failed, falling back to url/text share.", err);
    }
  }

  // 2. Try native text/url share
  if (isShareSupported()) {
    try {
      const shareData: ShareData = {};
      if (title) shareData.title = title;
      if (text) shareData.text = text;
      if (url) shareData.url = url;

      await navigator.share(shareData);
      triggerHaptic("success");
      return { success: true, method: "native" };
    } catch (err: any) {
      if (err.name === "AbortError") {
        return { success: false, method: "aborted" };
      }
      console.warn("Native text/url share failed, falling back to clipboard.", err);
    }
  }

  // 3. Fallback: Copy link or text to clipboard
  const fallbackContent = url || text || title;
  if (fallbackContent && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(fallbackContent);
      triggerHaptic("success");
      toast.success("Link copied to clipboard!");
      return { success: true, method: "clipboard" };
    } catch (clipboardErr) {
      toast.error("Unable to share or copy link.");
      return { success: false, method: "error", error: clipboardErr };
    }
  }

  toast.error("Sharing is not supported on this browser.");
  return { success: false, method: "error" };
}
