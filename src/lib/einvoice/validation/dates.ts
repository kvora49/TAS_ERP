import { EInvoiceValidationError, AATOBracket, GSTEInvoiceConfig } from "../types";

/**
 * Validates invoice date rules:
 * 1. Invoice date cannot be in the future.
 * 2. 30-day reporting window check for businesses with AATO >= ₹10 Crore.
 */
export function validateInvoiceDates(
  billDateStr: string | null | undefined,
  aatoBracket: AATOBracket,
  config: GSTEInvoiceConfig,
  currentDate: Date = new Date()
): EInvoiceValidationError[] {
  const errors: EInvoiceValidationError[] = [];

  if (!billDateStr) {
    errors.push({
      code: "INVOICE_DATE_REQUIRED",
      field: "bill_date",
      message: "Invoice date is required.",
      severity: "error",
    });
    return errors;
  }

  const invoiceDate = new Date(billDateStr);
  if (isNaN(invoiceDate.getTime())) {
    errors.push({
      code: "INVOICE_DATE_INVALID",
      field: "bill_date",
      message: `Invalid invoice date format: "${billDateStr}".`,
      severity: "error",
    });
    return errors;
  }

  // Set hours to midnight for accurate day comparison
  const invDay = new Date(invoiceDate.getFullYear(), invoiceDate.getMonth(), invoiceDate.getDate()).getTime();
  const todayDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()).getTime();

  // Rule 1: No future dates
  if (invDay > todayDay) {
    errors.push({
      code: "INVOICE_DATE_FUTURE",
      field: "bill_date",
      message: `Invoice date cannot be in the future (${invoiceDate.toLocaleDateString("en-IN")}).`,
      severity: "error",
    });
  }

  // Rule 2: 30-day reporting window for >= ₹10 Cr turnover taxpayers
  if (aatoBracket === "10cr_and_above") {
    const maxDays = config.reporting_window_days;
    const diffMs = todayDay - invDay;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > maxDays) {
      errors.push({
        code: "INVOICE_DATE_EXCEEDS_30_DAYS",
        field: "bill_date",
        message: `Invoice date (${invoiceDate.toLocaleDateString("en-IN")}) is ${diffDays} days old. Under GST rules, high turnover taxpayers are expected to report invoices within ${maxDays} days of invoice date.`,
        severity: "warning",
        helpText: "If your portal account allows reporting invoices older than 30 days, you can ignore this warning and proceed.",
      });
    }
  }

  return errors;
}
