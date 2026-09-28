import { EInvoiceValidationError, AATOBracket, GSTEInvoiceConfig } from "../types";

export interface LineItemForHSNValidation {
  id?: string;
  item_name?: string | null;
  design_name?: string | null;
  design_code?: string | null;
  hsn_sac?: string | null;
  line_index: number;
}

/**
 * Validates HSN/SAC codes across all line items of an invoice
 * Enforces regulatory 4-digit (AATO <= ₹5 Cr) vs 6-digit (AATO > ₹5 Cr) requirements
 */
export function validateInvoiceHSNCodes(
  items: LineItemForHSNValidation[],
  aatoBracket: AATOBracket,
  config: GSTEInvoiceConfig
): EInvoiceValidationError[] {
  const errors: EInvoiceValidationError[] = [];
  const requiredDigits =
    aatoBracket === "below_5cr"
      ? config.hsn_min_digits_low_aato
      : config.hsn_min_digits_high_aato;

  if (!items || items.length === 0) {
    errors.push({
      code: "ITEMS_EMPTY",
      field: "items",
      message: "The invoice must contain at least one line item to generate an E-Invoice.",
      severity: "error",
    });
    return errors;
  }

  items.forEach((item) => {
    const rawHsn = (item.hsn_sac || "").toString().trim().replace(/[^0-9]/g, "");
    const itemLabel = item.design_code || item.item_name || item.design_name || `Item #${item.line_index}`;
    const lineRef = item.id || item.line_index;

    if (!rawHsn) {
      errors.push({
        code: "HSN_MISSING",
        field: "hsn_sac",
        invoice_line_ref: lineRef,
        message: `Line #${item.line_index} ("${itemLabel}"): HSN/SAC code is missing.`,
        severity: "error",
        helpText: "HSN code is mandatory for all items in a GST Tax Invoice.",
      });
      return;
    }

    if (!/^\d+$/.test(rawHsn)) {
      errors.push({
        code: "HSN_NON_NUMERIC",
        field: "hsn_sac",
        invoice_line_ref: lineRef,
        message: `Line #${item.line_index} ("${itemLabel}"): HSN code "${item.hsn_sac}" contains invalid characters. HSN must be numeric digits only.`,
        severity: "error",
      });
      return;
    }

    // Minimum 4 digits are strictly required in Indian GST
    if (rawHsn.length < 4) {
      errors.push({
        code: "HSN_DIGITS_INSUFFICIENT",
        field: "hsn_sac",
        invoice_line_ref: lineRef,
        message: `Line #${item.line_index} ("${itemLabel}"): HSN code "${item.hsn_sac}" has ${rawHsn.length} digits. Indian GST requires at least a 4-digit HSN code.`,
        severity: "error",
        helpText: "Update this item's HSN code to at least 4 digits before submitting.",
      });
      return;
    }

    // If 4 digits provided but company profile is > 5 Cr (where 6 digits are advised)
    if (rawHsn.length < requiredDigits) {
      const aatoDesc = aatoBracket === "below_5cr" ? "<= ₹5 Crore" : "> ₹5 Crore";
      errors.push({
        code: "HSN_DIGITS_INSUFFICIENT",
        field: "hsn_sac",
        invoice_line_ref: lineRef,
        message: `Line #${item.line_index} ("${itemLabel}"): HSN code "${item.hsn_sac}" has 4 digits. Businesses with turnover ${aatoDesc} normally require a 6-digit HSN code. (You may ignore this warning and proceed if voluntary or applicable).`,
        severity: "warning",
        helpText: `Recommended: Update this item's HSN code to 6 digits, or click "Ignore & Generate" to proceed.`,
      });
      return;
    }

    // Standard Indian GST HSN codes are 4, 6, or 8 digits
    if (rawHsn.length > 8) {
      errors.push({
        code: "HSN_TOO_LONG",
        field: "hsn_sac",
        invoice_line_ref: lineRef,
        message: `Line #${item.line_index} ("${itemLabel}"): HSN code "${item.hsn_sac}" is too long (${rawHsn.length} digits). HSN codes cannot exceed 8 digits.`,
        severity: "error",
      });
    }
  });

  return errors;
}
