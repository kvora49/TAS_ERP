/**
 * Resolves party phone/WhatsApp number gracefully checking all potential fields.
 */
export function getPartyPhone(party?: {
  phone?: string | null;
  whatsapp_number?: string | null;
  contact_numbers?: Array<{ label?: string; number?: string }> | null;
} | null): string {
  if (!party) return "";
  if (party.whatsapp_number && party.whatsapp_number.trim()) {
    return party.whatsapp_number.trim();
  }
  if (party.phone && party.phone.trim()) {
    return party.phone.trim();
  }
  if (Array.isArray(party.contact_numbers) && party.contact_numbers.length > 0) {
    const waContact = party.contact_numbers.find(
      (c) => c.label?.toLowerCase() === "whatsapp" || c.label?.toLowerCase() === "primary"
    );
    if (waContact?.number) return waContact.number.trim();
    if (party.contact_numbers[0]?.number) return party.contact_numbers[0].number.trim();
  }
  return "";
}

/**
 * Formats a raw phone string into a clean international number (e.g. 919876543210).
 */
export function formatPhoneForWhatsApp(phone: string): string {
  const clean = (phone || "").replace(/\D/g, "");
  if (!clean) return "";
  if (clean.length === 10) return `91${clean}`;
  return clean;
}

/**
 * Generates direct WhatsApp URLs bypassing intermediate landing pages:
 * - On Mobile / PWA: Uses `whatsapp://send?phone=...&text=...` to directly open native WhatsApp app.
 * - On Desktop: Uses `https://web.whatsapp.com/send?phone=...&text=...` to open WhatsApp Web directly without intermediate landing page.
 */
export function getWhatsAppUrl(phone: string, text: string): string {
  const cleanPhone = formatPhoneForWhatsApp(phone);
  const encodedText = encodeURIComponent(text || "");

  const isMobile =
    typeof window !== "undefined" &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isMobile) {
    return cleanPhone
      ? `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`
      : `whatsapp://send?text=${encodedText}`;
  }

  // On desktop: use direct web.whatsapp.com to bypass intermediate api.whatsapp.com landing page
  return cleanPhone
    ? `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
    : `https://web.whatsapp.com/send?text=${encodedText}`;
}

/**
 * Smart launcher that attempts native desktop app protocol `whatsapp://send` first,
 * and seamlessly falls back to direct `web.whatsapp.com` tab if app is not installed.
 */
export function openWhatsApp(phone: string, text: string) {
  if (typeof window === "undefined") return;

  const cleanPhone = formatPhoneForWhatsApp(phone);
  const encodedText = encodeURIComponent(text || "");

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isMobile) {
    const mobileUrl = cleanPhone
      ? `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`
      : `whatsapp://send?text=${encodedText}`;
    window.location.href = mobileUrl;
    return;
  }

  // On Desktop: Try launching native WhatsApp Desktop App directly via URI protocol scheme
  const nativeAppUrl = cleanPhone
    ? `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`
    : `whatsapp://send?text=${encodedText}`;

  const webUrl = cleanPhone
    ? `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
    : `https://web.whatsapp.com/send?text=${encodedText}`;

  // Open direct web tab or attempt native protocol launch without showing api.whatsapp.com landing page
  let appOpened = false;
  const onBlur = () => {
    appOpened = true;
  };
  window.addEventListener("blur", onBlur, { once: true });

  // Trigger native desktop app launch
  window.location.href = nativeAppUrl;

  // If focus didn't leave the browser after 1.5s (meaning Desktop App is not installed), open WhatsApp Web tab directly!
  setTimeout(() => {
    window.removeEventListener("blur", onBlur);
    if (!appOpened) {
      window.open(webUrl, "_blank");
    }
  }, 1500);
}

/**
 * Smart Invoice WhatsApp Sharing Helper:
 * 1. Capability Detection: Checks if device supports Web Share API with File Sharing (`navigator.canShare({ files })`).
 * 2. On Supported Mobile / PWA: Fetches the PDF blob, creates a File object, and calls `navigator.share()` so WhatsApp gets the actual PDF document attached!
 * 3. On Desktop or Fallback: Automatically launches `openWhatsApp()` with pre-filled message + public invoice link!
 */
export async function shareInvoiceWithWhatsApp(options: {
  phone: string;
  text: string;
  billId?: string;
  pdfUrl?: string;
  fileName?: string;
}) {
  const { phone, text, billId, fileName } = options;
  const targetPdfUrl = options.pdfUrl || (billId ? `/api/public/bills/${billId}/pdf?download=true` : undefined);

  if (targetPdfUrl && typeof navigator !== "undefined" && navigator.share && navigator.canShare) {
    try {
      const response = await fetch(targetPdfUrl);
      if (response.ok) {
        const blob = await response.blob();
        const file = new File([blob], fileName || "Invoice.pdf", { type: "application/pdf" });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: fileName || "Tax Invoice",
            text,
            files: [file],
          });
          return;
        }
      }
    } catch (err) {
      console.warn("Native file sharing cancelled or failed, falling back to WhatsApp link.", err);
    }
  }

  // Fallback to WhatsApp link with pre-filled text & public bill URL
  openWhatsApp(phone, text);
}

