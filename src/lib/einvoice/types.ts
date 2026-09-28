/**
 * Core Types & Interfaces for TAS ERP GST E-Invoicing & E-Way Bill Integration
 * Conforms to IRP INV-01 Schema and GSP-Agnostic Adapter Pattern
 */

export type EInvoiceApplicability = "mandatory" | "voluntary_enabled" | "not_enabled";
export type AATOBracket = "below_5cr" | "5cr_to_10cr" | "10cr_and_above";
export type IRNStatus = "not_applicable" | "pending" | "registered" | "cancelled" | "failed";
export type IRPOnboardingStatus = "not_started" | "otp_pending" | "authorized" | "revoked";

/**
 * GSP/IRP Configuration Reference Values (Config-driven thresholds)
 */
export interface GSTEInvoiceConfig {
  aato_mandatory_threshold: number; // e.g. 5,00,00,000 (₹5 Cr)
  aato_30day_window_threshold: number; // e.g. 10,00,00,000 (₹10 Cr)
  reporting_window_days: number; // e.g. 30 days
  eway_threshold: number; // e.g. 50,000 (₹50,000)
  hsn_min_digits_low_aato: number; // e.g. 4
  hsn_min_digits_high_aato: number; // e.g. 6
  max_invoice_line_items: number; // e.g. 1000
  rounding_tolerance: number; // e.g. 1.00
}

/**
 * Single Validation Exception Item
 * Designed for Tally-like inline exception list with deep-linking
 */
export interface EInvoiceValidationError {
  code: string;
  field: string;
  message: string;
  invoice_line_ref?: string | number | null;
  severity: "error" | "warning";
  helpText?: string;
}

export interface EInvoiceValidationResult {
  isValid: boolean;
  errors: EInvoiceValidationError[];
  warnings: EInvoiceValidationError[];
}

/**
 * Tenant Credentials used for IRP authentication
 */
export interface TenantIRPCredentials {
  gstin: string;
  clientId?: string; // Layer 1: Defaults to process.env.IRIS_CLIENT_ID
  clientSecret?: string; // Layer 1: Defaults to process.env.IRIS_CLIENT_SECRET
  userName?: string; // Layer 2: Taxpayer GSP API Username created on einvoice1.gst.gov.in
  password?: string; // Layer 2: Taxpayer GSP API Password
  authMode?: "direct" | "intermediary";
}

export interface IRPAuthToken {
  token: string;
  expiresAt: string; // ISO DateTime
  tokenType?: string;
  sessionId?: string;
}

/**
 * Standard IRP INV-01 Document Types
 */
export type IRPDocType = "INV" | "CRN" | "DBN";

/**
 * Standard IRP Supply Types
 */
export type IRPSupplyType = "B2B" | "SEZWP" | "SEZWOP" | "EXPWP" | "EXPWOP" | "DEXP";

/**
 * Normalized Invoice Data prepared for IRP Submission
 */
export interface IRPItemPayload {
  itemSeqNo: number;
  productDescription: string;
  isService: boolean;
  hsnCode: string;
  barCode?: string;
  quantity: number;
  freeQuantity?: number;
  unit: string;
  unitPrice: number;
  grossAmount: number;
  discountAmount: number;
  preTaxValue: number;
  taxableValue: number;
  gstRate: number;
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  cessRate?: number;
  cessAmount?: number;
  totalItemValue: number;
}

export interface IRPPartyDetails {
  gstin: string;
  legalName: string;
  tradeName?: string;
  addressLine1: string;
  addressLine2?: string;
  location: string; // City / Town
  pinCode: string;
  stateCode: string;
  phone?: string;
  email?: string;
}

export interface IRPTransportDetails {
  transporterId?: string; // Transporter GSTIN or 15-char Transporter ID
  transporterName?: string;
  transportMode?: "1" | "2" | "3" | "4"; // 1: Road, 2: Rail, 3: Air, 4: Ship
  distanceKm?: number;
  transporterDocNo?: string;
  transporterDocDate?: string; // YYYY-MM-DD
  vehicleNo?: string;
  vehicleType?: "R" | "O"; // R: Regular, O: Over Dimensional Cargo
}

export interface IRPInvoicePayload {
  version: string;
  docDetails: {
    docType: IRPDocType;
    docNo: string;
    docDate: string; // DD/MM/YYYY or YYYY-MM-DD
  };
  transactionDetails: {
    taxScheme: "GST";
    supplyType: IRPSupplyType;
    reverseCharge: boolean;
    eCommerceGSTIN?: string;
    igstOnIntra: boolean;
  };
  sellerDetails: IRPPartyDetails;
  buyerDetails: IRPPartyDetails;
  dispatchDetails?: IRPPartyDetails;
  shipToDetails?: IRPPartyDetails;
  itemList: IRPItemPayload[];
  valueSummary: {
    totalTaxableAmount: number;
    totalCgstAmount: number;
    totalSgstAmount: number;
    totalIgstAmount: number;
    totalCessAmount: number;
    totalStateCessAmount?: number;
    discountAmount: number;
    otherCharges: number;
    roundOffAmount: number;
    totalInvoiceValue: number;
  };
  transportDetails?: IRPTransportDetails;
}

/**
 * IRP API Operation Results
 */
export interface IRPGenerateResult {
  success: boolean;
  irn?: string;
  ackNo?: string;
  ackDate?: string;
  signedQrData?: string;
  signedInvoiceJson?: any;
  ewbNo?: string;
  ewbDate?: string;
  ewbValidTill?: string;
  errorCode?: string;
  errorMessage?: string;
  errorDetails?: Array<{ code: string; message: string }>;
  rawResponse?: any;
}

export interface IRPCancelResult {
  success: boolean;
  irn?: string;
  cancelledAt?: string;
  errorCode?: string;
  errorMessage?: string;
  rawResponse?: any;
}

export interface IRPStatusResult {
  success: boolean;
  irn?: string;
  status?: IRNStatus;
  ackNo?: string;
  ackDate?: string;
  signedQrData?: string;
  rawResponse?: any;
}

export interface IRPEWBResult {
  success: boolean;
  ewbNo?: string;
  ewbDate?: string;
  ewbValidTill?: string;
  errorCode?: string;
  errorMessage?: string;
  rawResponse?: any;
}

/**
 * GSP-Agnostic E-Invoice Adapter Interface
 * All GSPs (IRIS, Masters India, ClearTax, etc.) must implement this interface.
 */
export interface EInvoiceAdapter {
  readonly providerName: string;

  /**
   * Authenticate tenant or intermediary with the IRP GSP
   */
  authenticate(credentials: TenantIRPCredentials): Promise<IRPAuthToken>;

  /**
   * Generate IRN (and optional E-Way Bill in same call)
   */
  generateIRN(
    payload: IRPInvoicePayload,
    credentials: TenantIRPCredentials,
    transportDetails?: IRPTransportDetails
  ): Promise<IRPGenerateResult>;

  /**
   * Cancel an IRN within 24 hours
   * reasonCode: "1" = Duplicate, "2" = Data Entry Mistake, "3" = Order Cancelled, "4" = Others
   */
  cancelIRN(
    irn: string,
    reasonCode: "1" | "2" | "3" | "4",
    remarks: string,
    credentials: TenantIRPCredentials
  ): Promise<IRPCancelResult>;

  /**
   * Query status of an existing IRN from IRP
   */
  getIRNStatus(
    docDetails: { docType: IRPDocType; docNo: string; docDate: string },
    credentials: TenantIRPCredentials
  ): Promise<IRPStatusResult>;

  /**
   * Generate standalone E-Way bill for Delivery Challans
   */
  generateEWB(
    challanPayload: {
      docNo: string;
      docDate: string;
      docType: "CHL";
      subSupplyType: "1" | "2" | "3" | "8"; // 1: Supply, 2: Import, 3: Export, 8: Job Work, etc.
      fromParty: IRPPartyDetails;
      toParty: IRPPartyDetails;
      itemList: IRPItemPayload[];
      totalValue: number;
    },
    transportDetails: IRPTransportDetails,
    credentials: TenantIRPCredentials
  ): Promise<IRPEWBResult>;
}
