/**
 * Diagnostic test script to reproduce and verify the flaws in the e-invoice workflow
 */

import {
  validateInvoiceForEInvoice,
  DEFAULT_EINVOICE_CONFIG,
} from "../src/lib/einvoice";
import { getPlaceOfSupplyCode, isInterstateTransaction } from "../src/lib/gst-utils";
import { validateTaxBreakdown } from "../src/lib/einvoice/validation/tax-breakdown";

console.log("=================================================");
console.log("  DIAGNOSTIC TEST: E-INVOICE WORKFLOW FLAWS      ");
console.log("=================================================\n");

// ── TEST A: Bill-To Same State (24 Gujarat), Ship-To Another State (27 Maharashtra) ──
console.log("--- TEST A: Bill-To Intra (24), Ship-To Inter (27) ---");
const sellerStateCode = "24";
const buyerGstin = "24AAACT2727Q1ZW"; // Gujarat
const consigneeGstin = "27AAPFU0939F1ZV"; // Maharashtra
const consigneeStateCode = "27";

const posCode = getPlaceOfSupplyCode({
  partyGstin: buyerGstin,
  consigneeGstin: consigneeGstin,
  consigneeStateCode: consigneeStateCode,
  shipToSameAsBillTo: false,
});

console.log("Calculated POS Code:", posCode);
console.log("Expected POS Code: 27 (because goods shipped out of state to Maharashtra)");
if (posCode === "24") {
  console.log("❌ CONFIRMED FLAW 1: getPlaceOfSupplyCode returned 24 instead of 27!");
} else {
  console.log("✅ POS Code correctly returned:", posCode);
}

// ── TEST B: Tax Breakdown with Taxable Charges (Double Counting) ──
console.log("\n--- TEST B: Tax Breakdown with Taxable Charges (Freight ₹500) ---");
// Item: ₹5000, 5% GST = ₹250
// Freight: ₹500 (taxable at 5% = ₹25)
// Total Taxable Amount: ₹5500
// Total GST (CGST+SGST): ₹137.50 + ₹137.50 = ₹275
// Charges Total: ₹500
// Grand Total: ₹5775
const taxErrors = validateTaxBreakdown(
  {
    sellerStateCode: "24",
    placeOfSupplyStateCode: "24",
    taxableAmount: 5500, // Includes the 500 taxable charge!
    cgst: 137.5,
    sgst: 137.5,
    igst: 0,
    grandTotal: 5775,
    chargesTotal: 500,
    discountAmount: 0,
    items: [
      {
        line_index: 1,
        item_name: "Fabric",
        quantity: 10,
        rate: 500,
        tax_percent: 5,
        discount_percent: 0,
        amount: 5000,
      },
    ],
  },
  DEFAULT_EINVOICE_CONFIG
);

console.log("Validation errors returned for invoice with ₹500 freight charge:", taxErrors.map(e => `${e.code}: ${e.message}`));
if (taxErrors.some(e => e.code === "ROUNDING_TOLERANCE_EXCEEDED" || e.code === "TAX_COMPUTATION_MISMATCH")) {
  console.log("❌ CONFIRMED FLAW 2: Valid invoice with taxable charges was rejected by validateTaxBreakdown!");
}

// ── TEST C: Invoice with Bill-Level Discount (₹500 flat discount on ₹5000 order) ──
console.log("\n--- TEST C: Invoice with Bill-Level Discount (₹500 discount) ---");
// Item: ₹5000 (at 5%)
// Discount: ₹500
// Taxable: ₹4500
// GST (5%): ₹225 (CGST ₹112.50, SGST ₹112.50)
// Grand Total: ₹4725
const discountErrors = validateTaxBreakdown(
  {
    sellerStateCode: "24",
    placeOfSupplyStateCode: "24",
    taxableAmount: 4500,
    cgst: 112.5,
    sgst: 112.5,
    igst: 0,
    grandTotal: 4725,
    chargesTotal: 0,
    discountAmount: 500,
    items: [
      {
        line_index: 1,
        item_name: "Fabric",
        quantity: 10,
        rate: 500,
        tax_percent: 5,
        discount_percent: 0,
        amount: 5000,
      },
    ],
  },
  DEFAULT_EINVOICE_CONFIG
);

console.log("Validation errors for invoice with bill-level discount:", discountErrors.map(e => `${e.code}: ${e.message}`));
if (discountErrors.some(e => e.code === "TAX_COMPUTATION_MISMATCH")) {
  console.log("❌ CONFIRMED FLAW 3: Valid invoice with bill discount was rejected because items don't reflect invoice discount!");
}
