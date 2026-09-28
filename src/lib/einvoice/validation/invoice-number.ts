import { EInvoiceValidationError } from "../types";
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Validates invoice number format according to GST rules:
 * - Max 16 characters
 * - Only A-Z, a-z, 0-9, hyphen (-), and slash (/)
 * - No special characters or spaces
 */
export function validateInvoiceNumberFormat(
  billNumber: string | null | undefined,
  fieldKey: string = "bill_number"
): EInvoiceValidationError[] {
  const errors: EInvoiceValidationError[] = [];
  const trimmed = (billNumber || "").trim();

  if (!trimmed) {
    errors.push({
      code: "DOC_NO_REQUIRED",
      field: fieldKey,
      message: "Invoice number is required.",
      severity: "error",
    });
    return errors;
  }

  if (trimmed.length > 16) {
    errors.push({
      code: "DOC_NO_TOO_LONG",
      field: fieldKey,
      message: `Invoice number "${trimmed}" is ${trimmed.length} characters long. GST rules strictly allow a maximum of 16 characters.`,
      severity: "error",
      helpText: "Shorten invoice prefix or sequential number to 16 characters or less.",
    });
  }

  // Only alphanumeric, hyphens, and slashes are permitted
  if (!/^[a-zA-Z0-9\-\/]+$/.test(trimmed)) {
    errors.push({
      code: "DOC_NO_INVALID_CHARS",
      field: fieldKey,
      message: `Invoice number "${trimmed}" contains invalid characters. GST invoice numbers may only contain letters, numbers, hyphens (-), and slashes (/).`,
      severity: "error",
      helpText: "Remove spaces or special characters like #, _, @, etc.",
    });
  }

  return errors;
}

/**
 * Checks if the invoice number already has a registered IRN or duplicate in the FY
 */
export async function checkInvoiceNumberUniqueness(
  supabase: SupabaseClient,
  businessId: string,
  invoiceId: string,
  billNumber: string
): Promise<EInvoiceValidationError[]> {
  const errors: EInvoiceValidationError[] = [];

  try {
    const { data: existing, error } = await supabase
      .from("sale_bills")
      .select("id, bill_number, irn, irn_status")
      .eq("business_id", businessId)
      .eq("bill_number", billNumber.trim())
      .neq("id", invoiceId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      console.warn("Could not verify invoice number uniqueness:", error);
      return [];
    }

    if (existing) {
      if (existing.irn_status === "registered" && existing.irn) {
        errors.push({
          code: "DOC_NO_DUPLICATE_IRN",
          field: "bill_number",
          message: `Invoice number "${billNumber}" has already been issued with an IRN (${existing.irn.substring(0, 12)}...) under another record.`,
          severity: "error",
          helpText: "Change the invoice number to a unique sequence before generating an e-invoice.",
        });
      } else {
        errors.push({
          code: "DOC_NO_DUPLICATE",
          field: "bill_number",
          message: `Invoice number "${billNumber}" is already in use by another invoice in your company.`,
          severity: "error",
        });
      }
    }
  } catch (err) {
    console.warn("Error running invoice uniqueness check:", err);
  }

  return errors;
}
