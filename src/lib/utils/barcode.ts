import crypto from "crypto";

/**
 * Generates a clean, readable, short 1D Barcode ID based on Design Number and Size.
 * Format: {DESIGN_NUMBER}-{SIZE}
 * Example: NIG.0042-M, ZARA.0101-XL, DES-001-FREE
 */
export function generateBarcodeId(designNumber: string, size?: string): string {
  const cleanedDesign = (designNumber || "DES-001").trim().toUpperCase();
  const rawSize = (size || "").trim().toUpperCase();

  let cleanedSize = "FREE";
  if (rawSize && rawSize !== "FREE SIZE" && rawSize !== "ALL SIZES" && rawSize !== "STANDARD") {
    cleanedSize = rawSize.replace(/\s+/g, "-");
  }

  return `${cleanedDesign}-${cleanedSize}`;
}

/**
 * Parses a barcode payload into its constituent design number and size.
 * Handles:
 * - Smart barcodes: "NIG.0042-M" -> { designNumber: "NIG.0042", size: "M" }
 * - Free size: "NIG.0042-FREE" -> { designNumber: "NIG.0042", size: "FREE" }
 * - Plain design number: "NIG.0042" -> { designNumber: "NIG.0042", size: null }
 */
export function parseBarcodeId(payload: string): { designNumber: string; size: string | null } {
  if (!payload) return { designNumber: "", size: null };
  const trimmed = payload.trim().toUpperCase();

  const lastHyphenIdx = trimmed.lastIndexOf("-");
  if (lastHyphenIdx > 0 && lastHyphenIdx < trimmed.length - 1) {
    const potentialSize = trimmed.slice(lastHyphenIdx + 1);
    const potentialDesign = trimmed.slice(0, lastHyphenIdx);

    // Common garment sizes or tokens under 7 chars (e.g. S, M, L, XL, XXL, 3XL, FREE, FS, 28, 30, 32, 34, 36, 38, 40, 42, 44)
    const isLikelySize =
      potentialSize.length <= 7 &&
      /^(FREE|FS|ALL|XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|5XL|6XL|\d{2,3})$/i.test(potentialSize);

    if (isLikelySize) {
      return {
        designNumber: potentialDesign,
        size: potentialSize === "FREE" ? "Free Size" : potentialSize,
      };
    }
  }

  return {
    designNumber: trimmed,
    size: null,
  };
}

/**
 * Generates a 1D Code128 Barcode Data URL for printing or display.
 * Generates high-contrast, sharp SVG/Canvas rendering optimized for camera scanning.
 */
export function generate1DBarcode(payload: string, options?: { height?: number; width?: number; fontSize?: number }): string {
  if (typeof window === "undefined" || !payload) return "";
  try {
    const JsBarcode = require("jsbarcode");
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, payload, {
      format: "CODE128",
      width: options?.width || 2,
      height: options?.height || 55,
      displayValue: false, // We render human-readable text cleanly below in UI/print
      margin: 4,
      background: "#ffffff",
      lineColor: "#000000",
    });
    return canvas.toDataURL("image/png");
  } catch (err) {
    console.error("Barcode generation error:", err);
    return "";
  }
}

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidQRUUID(input: string): boolean {
  return UUID_REGEX.test((input || "").trim());
}

/**
 * Validates whether an input string is a valid linear barcode or SKU payload.
 */
export function isValidBarcodePayload(input: string): boolean {
  if (!input) return false;
  const trimmed = input.trim();
  if (trimmed.length < 2 || trimmed.length > 128) return false;
  return true;
}

/**
 * Legacy UUID generator (maintained for backward compatibility with existing stickers)
 */
export function generateSizeQRUUID(stockId: string, size: string): string {
  if (!stockId) return "";
  const cleanedSize = (size || "").trim().toUpperCase();
  if (!cleanedSize || cleanedSize === "ALL SIZES" || cleanedSize === "FREE SIZE") {
    return stockId;
  }
  const hash = crypto.createHash("sha1").update(`${stockId}:${cleanedSize}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
