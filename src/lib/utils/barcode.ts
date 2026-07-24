import QRCode from "qrcode";

/**
 * Encodes ONLY the raw UUID into a QR code Data URL (PNG).
 * Security Requirement: No URL prefix, no business data, no design codes.
 */
export async function generateQRCode(qrUuid: string): Promise<string> {
  const dataUrl = await QRCode.toDataURL(qrUuid, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 200,
  });
  return dataUrl;
}

/**
 * Generates a 1D Code128 Barcode Data URL for printing standard linear barcodes.
 */
export function generate1DBarcode(payload: string): string {
  if (typeof window === "undefined") return "";
  try {
    const JsBarcode = require("jsbarcode");
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, payload, {
      format: "CODE128",
      width: 2,
      height: 60,
      displayValue: true,
      fontSize: 12,
      margin: 5,
    });
    return canvas.toDataURL("image/png");
  } catch (err) {
    console.error("Barcode generation error:", err);
    return "";
  }
}

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidQRUUID(input: string): boolean {
  return UUID_REGEX.test(input.trim());
}
