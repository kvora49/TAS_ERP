import { EInvoiceValidationError, GSTEInvoiceConfig } from "../types";
import { GSTIN_STATES } from "@/lib/gst-utils";

export interface TaxBreakdownInvoiceParams {
  sellerStateCode: string;
  placeOfSupplyStateCode: string;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  grandTotal: number;
  chargesTotal?: number;
  discountAmount?: number;
  items: Array<{
    line_index: number;
    item_name?: string | null;
    quantity: number;
    rate: number;
    tax_percent: number;
    discount_percent?: number;
    amount?: number;
  }>;
}

/**
 * Validates tax breakdown, interstate/intrastate tax alignment, and rounding tolerances
 */
export function validateTaxBreakdown(
  params: TaxBreakdownInvoiceParams,
  config: GSTEInvoiceConfig
): EInvoiceValidationError[] {
  const errors: EInvoiceValidationError[] = [];
  const {
    sellerStateCode,
    placeOfSupplyStateCode,
    taxableAmount,
    cgst,
    sgst,
    igst,
    grandTotal,
    items,
  } = params;

  // 1. Verify valid Place of Supply
  const cleanPos = (placeOfSupplyStateCode || "").trim().padStart(2, "0");
  const cleanSeller = (sellerStateCode || "").trim().padStart(2, "0");

  if (!cleanPos || !GSTIN_STATES[cleanPos]) {
    errors.push({
      code: "INVALID_POS_STATE",
      field: "place_of_supply",
      message: `Invalid or missing Place of Supply state code: "${placeOfSupplyStateCode}". Must be a valid 2-digit Indian State/UT code.`,
      severity: "error",
    });
    return errors;
  }

  const isInterstate = cleanSeller !== cleanPos;

  // 2. Intra-state vs Inter-state tax split validation
  if (isInterstate) {
    // Inter-state: must charge IGST, CGST & SGST must be 0
    if (cgst > 0.01 || sgst > 0.01) {
      errors.push({
        code: "INVALID_TAX_SPLIT_INTERSTATE",
        field: "igst",
        message: `Place of Supply (${cleanPos} - ${GSTIN_STATES[cleanPos]}) is in a different state from Seller (${cleanSeller} - ${GSTIN_STATES[cleanSeller]}). This is an Inter-State sale: IGST must be charged, and CGST/SGST must be 0.`,
        severity: "error",
        helpText: "Ensure your billing settings apply IGST for out-of-state deliveries.",
      });
    }
  } else {
    // Intra-state: must charge CGST and SGST (50/50), IGST must be 0
    if (igst > 0.01) {
      errors.push({
        code: "INVALID_TAX_SPLIT_INTRASTATE",
        field: "cgst",
        message: `Place of Supply (${cleanPos} - ${GSTIN_STATES[cleanPos]}) is the same as Seller State (${cleanSeller}). This is an Intra-State sale: CGST and SGST must be charged (50/50), and IGST must be 0.`,
        severity: "error",
        helpText: "Ensure your billing settings apply CGST & SGST for local sales.",
      });
    }

    // Verify CGST and SGST are equal within 10 paise
    if (Math.abs(cgst - sgst) > 0.1) {
      errors.push({
        code: "CGST_SGST_MISMATCH",
        field: "cgst",
        message: `CGST (₹${cgst.toFixed(2)}) and SGST (₹${sgst.toFixed(2)}) must be equal in an intra-state transaction.`,
        severity: "error",
      });
    }
  }

  // 3. Tax computation reconciliation across line items
  let computedItemTax = 0;
  let computedItemTaxable = 0;

  for (const item of items) {
    const qty = Number(item.quantity || 0);
    const rate = Number(item.rate || 0);
    const disc = Number(item.discount_percent || 0);
    const lineTaxable = qty * rate * (1 - disc / 100);
    const lineTax = lineTaxable * (Number(item.tax_percent || 0) / 100);

    computedItemTaxable += lineTaxable;
    computedItemTax += lineTax;
  }

  const declaredTax = cgst + sgst + igst;
  const taxDiff = Math.abs(declaredTax - computedItemTax);

  // If tax difference exceeds ₹2.00, flag warning/error
  if (taxDiff > 2.0) {
    errors.push({
      code: "TAX_COMPUTATION_MISMATCH",
      field: "taxable_amount",
      message: `Total declared GST (₹${declaredTax.toFixed(2)}) differs from line-item calculated GST (₹${computedItemTax.toFixed(2)}) by ₹${taxDiff.toFixed(2)}.`,
      severity: "error",
      helpText: "Recompute line-item taxes to ensure accurate GST filing.",
    });
  }

  // 4. Grand Total Rounding Reconciliation
  const expectedTotal = taxableAmount + declaredTax + Number(params.chargesTotal || 0);
  const roundDiff = Math.abs(grandTotal - expectedTotal);

  if (roundDiff > config.rounding_tolerance) {
    errors.push({
      code: "ROUNDING_TOLERANCE_EXCEEDED",
      field: "grand_total",
      message: `Invoice Grand Total (₹${grandTotal.toFixed(2)}) does not match Taxable Amount + GST + Charges (₹${expectedTotal.toFixed(2)}). Discrepancy of ₹${roundDiff.toFixed(2)} exceeds allowed tolerance of ₹${config.rounding_tolerance.toFixed(2)}.`,
      severity: "error",
      helpText: "Check round-off calculation before submitting.",
    });
  }

  return errors;
}
