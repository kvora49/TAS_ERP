/**
 * Opens WhatsApp dynamically based on device type (Desktop vs Mobile/Tablet)
 * - On Mobile / Tablet: Uses `whatsapp://send?phone=...&text=...` to directly launch native WhatsApp app.
 * - On Desktop: Uses `https://web.whatsapp.com/send?phone=...&text=...` to open WhatsApp Web directly without intermediate landing page.
 */
export function openWhatsApp(phone: string, text: string) {
  const cleanPhone = (phone || "").replace(/\D/g, "");
  const encodedText = encodeURIComponent(text);

  const isMobile =
    typeof window !== "undefined" &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  let url = "";
  if (isMobile) {
    url = cleanPhone
      ? `whatsapp://send?phone=91${cleanPhone}&text=${encodedText}`
      : `whatsapp://send?text=${encodedText}`;
  } else {
    url = cleanPhone
      ? `https://web.whatsapp.com/send?phone=91${cleanPhone}&text=${encodedText}`
      : `https://web.whatsapp.com/send?text=${encodedText}`;
  }

  window.open(url, "_blank");
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
