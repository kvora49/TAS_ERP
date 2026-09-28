import { EInvoiceValidationError } from "../types";
import { GSTIN_STATES } from "@/lib/gst-utils";

const GSTIN_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * Validates a GSTIN for:
 * 1. Presence
 * 2. 15-character length and format regex
 * 3. Valid State Code prefix (01-37, 38, 97)
 * 4. Mod-36 Luhn Checksum digit
 */
export function validateGSTIN(
  gstin: string | null | undefined,
  fieldLabel: string,
  options: { required?: boolean; fieldKey?: string; lineRef?: string | number } = {}
): EInvoiceValidationError[] {
  const { required = true, fieldKey = "gstin", lineRef } = options;
  const errors: EInvoiceValidationError[] = [];

  const trimmed = (gstin || "").trim().toUpperCase();

  if (!trimmed) {
    if (required) {
      errors.push({
        code: "GSTIN_REQUIRED",
        field: fieldKey,
        message: `${fieldLabel} is required for B2B GST E-Invoicing.`,
        invoice_line_ref: lineRef,
        severity: "error",
      });
    }
    return errors;
  }

  if (trimmed.length !== 15) {
    errors.push({
      code: "GSTIN_INVALID_LENGTH",
      field: fieldKey,
      message: `${fieldLabel} must be exactly 15 characters (provided: ${trimmed.length}).`,
      invoice_line_ref: lineRef,
      severity: "error",
    });
    return errors;
  }

  if (!GSTIN_REGEX.test(trimmed)) {
    errors.push({
      code: "GSTIN_INVALID_FORMAT",
      field: fieldKey,
      message: `${fieldLabel} "${trimmed}" has an invalid GSTIN format. Expected: 2 digits state code + 10 alphanumeric PAN + 1 entity digit + 'Z' + 1 checksum digit.`,
      invoice_line_ref: lineRef,
      severity: "error",
    });
    return errors;
  }

  // State Code check
  const stateCode = trimmed.substring(0, 2);
  if (!GSTIN_STATES[stateCode]) {
    errors.push({
      code: "GSTIN_INVALID_STATE_CODE",
      field: fieldKey,
      message: `${fieldLabel} contains state code "${stateCode}" which is not a recognized Indian State/UT code.`,
      invoice_line_ref: lineRef,
      severity: "error",
    });
    return errors;
  }

  // Mod-36 Checksum Verification
  const calculatedCheckDigit = calculateGSTINChecksum(trimmed.substring(0, 14));
  const actualCheckDigit = trimmed[14];

  if (calculatedCheckDigit !== actualCheckDigit) {
    errors.push({
      code: "GSTIN_CHECKSUM_FAILED",
      field: fieldKey,
      message: `${fieldLabel} "${trimmed}" failed government checksum validation (expected "${calculatedCheckDigit}", found "${actualCheckDigit}"). Please check for typos.`,
      invoice_line_ref: lineRef,
      severity: "error",
    });
  }

  return errors;
}

/**
 * Calculates the Mod-36 check digit for the first 14 characters of a GSTIN
 */
export function calculateGSTINChecksum(first14: string): string {
  const upper = first14.toUpperCase();
  let sum = 0;

  for (let i = 0; i < 14; i++) {
    const codePoint = GSTIN_ALPHABET.indexOf(upper[i]);
    if (codePoint === -1) return "";
    const factor = i % 2 === 0 ? 1 : 2;
    const product = codePoint * factor;
    const quotient = Math.floor(product / 36);
    const remainder = product % 36;
    sum += quotient + remainder;
  }

  const remainder = sum % 36;
  const checkCode = (36 - remainder) % 36;
  return GSTIN_ALPHABET[checkCode];
}

/**
 * Checks consistency between a GSTIN's state code and a declared state code
 */
export function verifyGstinStateConsistency(
  gstin: string | null | undefined,
  declaredStateCode: string | null | undefined,
  fieldLabel: string
): EInvoiceValidationError[] {
  if (!gstin || !declaredStateCode) return [];
  const gstinState = gstin.trim().substring(0, 2);
  const cleanDeclared = declaredStateCode.trim().padStart(2, "0");

  if (gstinState !== cleanDeclared) {
    return [
      {
        code: "GSTIN_STATE_MISMATCH",
        field: "state_code",
        message: `${fieldLabel} state code "${cleanDeclared}" contradicts GSTIN state code "${gstinState}" (${GSTIN_STATES[gstinState] || "Unknown"}).`,
        severity: "error",
      },
    ];
  }
  return [];
}

/**
 * Verifies standard 6-digit Indian PIN code format
 */
export function validatePincode(
  pincode: string | null | undefined,
  fieldLabel: string,
  fieldKey: string = "pincode"
): EInvoiceValidationError[] {
  const trimmed = (pincode || "").trim();
  if (!trimmed) {
    return [
      {
        code: "PINCODE_REQUIRED",
        field: fieldKey,
        message: `${fieldLabel} PIN code is required for E-Invoice submission.`,
        severity: "error",
      },
    ];
  }

  if (!/^[1-9][0-9]{5}$/.test(trimmed)) {
    return [
      {
        code: "PINCODE_INVALID_FORMAT",
        field: fieldKey,
        message: `${fieldLabel} PIN code "${trimmed}" is invalid. Must be a 6-digit number not starting with 0.`,
        severity: "error",
      },
    ];
  }

  return [];
}
