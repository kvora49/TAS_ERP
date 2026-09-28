import { SupabaseClient } from "@supabase/supabase-js";
import {
  EInvoiceValidationResult,
  EInvoiceValidationError,
  GSTEInvoiceConfig,
  AATOBracket,
} from "../types";
import { getGSTEInvoiceConfig } from "../config";
import { validateGSTIN, verifyGstinStateConsistency, validatePincode } from "./gstin";
import { validateInvoiceHSNCodes } from "./hsn";
import { validateInvoiceNumberFormat, checkInvoiceNumberUniqueness } from "./invoice-number";
import { validateInvoiceDates } from "./dates";
import { validateTaxBreakdown } from "./tax-breakdown";
import { deriveStateDetails, getPlaceOfSupplyCode } from "@/lib/gst-utils";

export interface InvoiceValidationPayload {
  id: string;
  bill_number: string;
  bill_type: "pakka" | "kacha";
  bill_date: string;
  status: string;
  irn?: string | null;
  irn_status?: string | null;

  // Party / Buyer
  gstin?: string | null;
  billing_address?: string | null;
  billing_city?: string | null;
  billing_pincode?: string | null;
  billing_state?: string | null;
  billing_state_code?: string | null;
  party?: {
    name?: string | null;
    company_name?: string | null;
    gstin?: string | null;
    billing_address_line1?: string | null;
    billing_city?: string | null;
    billing_pincode?: string | null;
    billing_state?: string | null;
    state?: string | null;
  } | null;

  // Consignee / Ship-To
  ship_to_same_as_bill_to?: boolean;
  consignee_name?: string | null;
  consignee_address?: string | null;
  consignee_city?: string | null;
  consignee_pincode?: string | null;
  consignee_gstin?: string | null;
  consignee_state?: string | null;
  consignee_state_code?: string | null;

  // Totals
  taxable_amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  grand_total: number;
  charges_total?: number;
  discount_amount?: number;

  // Items
  items?: any[];
  sale_bill_items?: any[];
}

export interface BusinessValidationProfile {
  id: string;
  name: string;
  gstin: string;
  address?: string | null;
  city?: string | null;
  pincode?: string | null;
  state?: string | null;
  state_code?: string | null;
  einvoice_applicability?: string | null;
  aato_bracket?: string | null;
}

/**
 * Main Local Pre-Validation Engine for GST E-Invoicing
 * Executes all regulatory and semantic checks locally without making network calls.
 * Returns an inline exception list for immediate Tally-like user resolution.
 */
export async function validateInvoiceForEInvoice(
  invoice: InvoiceValidationPayload,
  business: BusinessValidationProfile,
  options: {
    supabase?: SupabaseClient | null;
    config?: GSTEInvoiceConfig;
    currentDate?: Date;
  } = {}
): Promise<EInvoiceValidationResult> {
  const errors: EInvoiceValidationError[] = [];
  const warnings: EInvoiceValidationError[] = [];

  const recordIssue = (issue: EInvoiceValidationError) => {
    if (issue.severity === "warning") {
      warnings.push(issue);
    } else {
      errors.push(issue);
    }
  };
  const recordIssues = (issues: EInvoiceValidationError[]) => {
    issues.forEach(recordIssue);
  };

  const config = options.config || (await getGSTEInvoiceConfig(options.supabase));
  const aatoBracket: AATOBracket =
    (business.aato_bracket as AATOBracket) || "below_5cr";

  // ── 1. Document Qualification & Lifecycle Checks ─────────────────
  if (invoice.bill_type !== "pakka") {
    recordIssue({
      code: "INVOICE_TYPE_NOT_PAKKA",
      field: "bill_type",
      message: "E-Invoicing is only applicable to official GST Tax Invoices (Pakka bills), not estimate/kacha bills.",
      severity: "error",
    });
  }

  if (invoice.status === "cancelled") {
    recordIssue({
      code: "INVOICE_ALREADY_CANCELLED",
      field: "status",
      message: "This invoice is cancelled in TAS ERP and cannot be submitted to the IRP.",
      severity: "error",
    });
  }

  if (invoice.irn_status === "registered" && invoice.irn) {
    recordIssue({
      code: "INVOICE_ALREADY_REGISTERED",
      field: "irn",
      message: `This invoice already has an active IRN (${invoice.irn.substring(0, 16)}...). Duplicate submission will be rejected.`,
      severity: "error",
    });
  }

  // ── 2. Seller / Business Details Validation ──────────────────────
  const sellerErrors = validateGSTIN(business.gstin, "Seller (Company) GSTIN", {
    required: true,
    fieldKey: "business_gstin",
  });
  recordIssues(sellerErrors);

  const sellerState = deriveStateDetails(
    business.address,
    business.gstin,
    business.state,
    business.state_code
  );

  recordIssues(verifyGstinStateConsistency(business.gstin, sellerState.code, "Seller"));

  if (!business.address || business.address.trim().length < 3) {
    errors.push({
      code: "SELLER_ADDRESS_REQUIRED",
      field: "business_address",
      message: "Company address is missing or incomplete in Settings > Company Profile.",
      severity: "error",
    });
  }

  // ── 3. Buyer / Recipient Details Validation ──────────────────────
  const buyerGstin = invoice.gstin || invoice.party?.gstin;
  const buyerErrors = validateGSTIN(buyerGstin, "Buyer (Party) GSTIN", {
    required: true,
    fieldKey: "party_gstin",
  });
  recordIssues(buyerErrors);

  const buyerAddress =
    invoice.billing_address || invoice.party?.billing_address_line1 || "";
  if (!buyerAddress.trim()) {
    recordIssue({
      code: "BUYER_ADDRESS_REQUIRED",
      field: "billing_address",
      message: "Buyer billing address is required.",
      severity: "error",
      helpText: "Enter the customer address in the invoice or party master.",
    });
  }

  const buyerState = deriveStateDetails(
    buyerAddress,
    buyerGstin,
    invoice.billing_state || invoice.party?.billing_state || invoice.party?.state,
    invoice.billing_state_code
  );

  recordIssues(verifyGstinStateConsistency(buyerGstin, buyerState.code, "Buyer"));

  // Buyer PIN code check (from billing address or party details)
  const pinMatch = (buyerAddress.match(/\b[1-9][0-9]{5}\b/) || [])[0];
  const buyerPin = invoice.billing_pincode || invoice.party?.billing_pincode || pinMatch;
  if (!buyerPin) {
    recordIssue({
      code: "BUYER_PINCODE_MISSING",
      field: "billing_pincode",
      message: "Buyer 6-digit PIN code is missing from the billing address.",
      severity: "error",
    });
  } else {
    recordIssues(validatePincode(buyerPin, "Buyer", "billing_pincode"));
  }

  // ── 4. Consignee / Ship-To Details Validation ────────────────────
  if (invoice.ship_to_same_as_bill_to === false) {
    if (invoice.consignee_gstin) {
      recordIssues(validateGSTIN(invoice.consignee_gstin, "Consignee GSTIN", {
        required: false,
        fieldKey: "consignee_gstin",
      }));
    }

    if (!invoice.consignee_address || invoice.consignee_address.trim().length < 3) {
      recordIssue({
        code: "CONSIGNEE_ADDRESS_REQUIRED",
        field: "consignee_address",
        message: "Consignee shipping address is required when different from billing address.",
        severity: "error",
      });
    }

    const shipPinMatch = (invoice.consignee_address?.match(/\b[1-9][0-9]{5}\b/) || [])[0];
    const shipPin = invoice.consignee_pincode || shipPinMatch;
    if (!shipPin) {
      recordIssue({
        code: "CONSIGNEE_PINCODE_MISSING",
        field: "consignee_pincode",
        message: "Consignee 6-digit PIN code is missing.",
        severity: "error",
      });
    } else {
      recordIssues(validatePincode(shipPin, "Consignee", "consignee_pincode"));
    }
  }

  // ── 5. Document Number & Date Validation ─────────────────────────
  recordIssues(validateInvoiceNumberFormat(invoice.bill_number));
  recordIssues(
    validateInvoiceDates(
      invoice.bill_date,
      aatoBracket,
      config,
      options.currentDate
    )
  );

  if (options.supabase && business.id && invoice.id && invoice.bill_number) {
    const dupErrors = await checkInvoiceNumberUniqueness(
      options.supabase,
      business.id,
      invoice.id,
      invoice.bill_number
    );
    recordIssues(dupErrors);
  }

  // ── 6. Line Items & HSN Validation ───────────────────────────────
  const rawItems = invoice.items || invoice.sale_bill_items || [];
  if (rawItems.length === 0) {
    recordIssue({
      code: "ITEMS_EMPTY",
      field: "items",
      message: "The invoice must contain at least one line item.",
      severity: "error",
    });
  } else if (rawItems.length > config.max_invoice_line_items) {
    recordIssue({
      code: "ITEMS_EXCEED_LIMIT",
      field: "items",
      message: `The invoice contains ${rawItems.length} items. IRP permits a maximum of ${config.max_invoice_line_items} items per invoice.`,
      severity: "error",
    });
  } else {
    const itemsForHsn = rawItems.map((it, idx) => ({
      id: it.id,
      item_name: it.item_name || it.description,
      design_name: it.design?.name,
      design_code: it.design?.design_number,
      hsn_sac: it.hsn_sac,
      line_index: idx + 1,
    }));
    recordIssues(validateInvoiceHSNCodes(itemsForHsn, aatoBracket, config));
  }

  // ── 7. Place of Supply & Tax Reconciliation ──────────────────────
  const posCode = getPlaceOfSupplyCode({
    partyGstin: buyerGstin,
    consigneeGstin: invoice.consignee_gstin,
    consigneeStateCode: invoice.consignee_state_code,
    shipToSameAsBillTo: invoice.ship_to_same_as_bill_to !== false,
  });

  if (!posCode) {
    recordIssue({
      code: "PLACE_OF_SUPPLY_UNDETERMINED",
      field: "place_of_supply",
      message: "Place of Supply state code could not be determined from buyer or consignee details.",
      severity: "error",
    });
  } else {
    const taxErrors = validateTaxBreakdown(
      {
        sellerStateCode: sellerState.code,
        placeOfSupplyStateCode: posCode,
        taxableAmount: Number(invoice.taxable_amount || 0),
        cgst: Number(invoice.cgst || 0),
        sgst: Number(invoice.sgst || 0),
        igst: Number(invoice.igst || 0),
        grandTotal: Number(invoice.grand_total || 0),
        chargesTotal: Number(invoice.charges_total || 0),
        discountAmount: Number(invoice.discount_amount || 0),
        items: rawItems.map((it, idx) => ({
          line_index: idx + 1,
          item_name: it.item_name,
          quantity: Number(it.quantity || 0),
          rate: Number(it.rate || 0),
          tax_percent: Number(it.tax_percent || 0),
          discount_percent: Number(it.discount_percent || 0),
          amount: Number(it.amount || 0),
        })),
      },
      config
    );
    recordIssues(taxErrors);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
