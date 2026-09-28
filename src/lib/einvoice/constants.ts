/**
 * GST E-Invoice & E-Way Bill Constants & IRP Mapping Table
 */

export const IRP_CANCEL_REASONS: Record<string, string> = {
  "1": "Duplicate",
  "2": "Data entry mistake",
  "3": "Order cancelled",
  "4": "Others",
};

/**
 * Mapping of known IRP error codes to human-friendly, actionable descriptions.
 * Section 13 living reference.
 */
export const IRP_ERROR_CODE_MAP: Record<string, string> = {
  // Authentication & Session
  "100": "Invalid authentication credentials or expired IRP session.",
  "101": "Invalid client ID or client secret provided to IRIS IRP.",
  "102": "Authentication token expired. Please re-authenticate.",
  "103": "User session is invalid or has been terminated.",
  "104": "Unauthorized access: Tenant GSTIN does not match intermediary authorization.",

  // GSTIN & Party Details
  "2150": "Duplicate IRN: An e-invoice with this invoice number already exists for this financial year.",
  "2174": "Invalid Supplier GSTIN. Please verify your company GSTIN in Settings.",
  "2175": "Invalid Recipient (Buyer) GSTIN. Please verify customer GSTIN.",
  "2176": "Recipient GSTIN is inactive or cancelled on the GST Portal.",
  "2177": "Supplier GSTIN is inactive or cancelled on the GST Portal.",
  "2180": "Place of Supply code is invalid or does not match Indian state/UT codes.",
  "2181": "Supplier PIN code does not match Supplier State code.",
  "2182": "Buyer PIN code does not match Buyer State code.",

  // Invoice / Document Details
  "2201": "Invoice date cannot be in the future.",
  "2202": "Invoice date is older than 30 days. For taxpayers with turnover >= ₹10 Cr, invoices must be reported within 30 days.",
  "2203": "Invalid document number format. Maximum 16 alphanumeric characters, slashes, or hyphens allowed.",
  "2204": "Document type is missing or invalid.",

  // Line Items & HSN
  "2250": "HSN Code is missing or invalid for one or more items.",
  "2251": "HSN Code must have at least 6 digits for businesses with turnover exceeding ₹5 Crore.",
  "2252": "HSN Code must have at least 4 digits for businesses with turnover up to ₹5 Crore.",
  "2253": "At least one line item is required to generate an e-invoice.",
  "2254": "Total line items exceed the maximum permitted limit of 1,000 items.",

  // Tax & Value Computations
  "2260": "Tax calculation mismatch: CGST + SGST or IGST does not match taxable value × tax rate.",
  "2261": "Intra-state invoice must have CGST and SGST. IGST cannot be charged within the same state.",
  "2262": "Inter-state invoice must have IGST. CGST and SGST cannot be charged across state borders.",
  "2263": "Total invoice amount does not reconcile with taxable amount + taxes + charges within rounding tolerance.",
  "2264": "Item gross amount must equal Quantity × Unit Rate.",

  // Cancellation
  "2300": "Cancellation window expired. E-invoices can only be cancelled within 24 hours of generation.",
  "2301": "IRN is already marked as cancelled.",
  "2302": "An active E-Way Bill is linked to this IRN. Cancel the E-Way Bill before cancelling the IRN.",

  // Generic / Default
  "DEFAULT": "E-Invoice submission failed. Please check the details and try again.",
};

export function getFriendlyIRPErrorMessage(code?: string | null, rawMessage?: string | null): string {
  if (code && IRP_ERROR_CODE_MAP[code]) {
    return IRP_ERROR_CODE_MAP[code];
  }
  if (rawMessage && rawMessage.trim().length > 0) {
    return rawMessage;
  }
  return IRP_ERROR_CODE_MAP.DEFAULT;
}
