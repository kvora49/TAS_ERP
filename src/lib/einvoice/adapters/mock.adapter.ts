import crypto from "crypto";
import {
  EInvoiceAdapter,
  TenantIRPCredentials,
  IRPAuthToken,
  IRPInvoicePayload,
  IRPTransportDetails,
  IRPGenerateResult,
  IRPCancelResult,
  IRPStatusResult,
  IRPEWBResult,
  IRPDocType,
} from "../types";

import { validateGSTINInput } from "../../gst-utils";

/**
 * Mock / Sandbox E-Invoice Adapter
 * Simulates government IRP responses, signed QR codes, IRN generation, and e-way bills
 * for development, unit testing, and sandbox verification.
 */
export class MockEInvoiceAdapter implements EInvoiceAdapter {
  readonly providerName = "IRIS_SANDBOX_MOCK";

  async authenticate(credentials: TenantIRPCredentials): Promise<IRPAuthToken> {
    const effectiveClientId = credentials.clientId || process.env.IRIS_CLIENT_ID || "tas_iris_client";
    if (!credentials.gstin) {
      throw new Error("Invalid credentials: GSTIN is required.");
    }

    const gstinVal = validateGSTINInput(credentials.gstin);
    if (!gstinVal.isValid) {
      throw new Error(`[Mock IRP] GSTIN validation failed: ${gstinVal.errorMessage || "Must be 15-character valid GSTIN"}`);
    }

    if (!credentials.userName || !credentials.userName.trim()) {
      throw new Error("[Mock IRP] GSP API Username is required.");
    }

    if (!credentials.password || !credentials.password.trim()) {
      throw new Error("[Mock IRP] GSP API Password is required.");
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(); // 6 hours

    return {
      token,
      expiresAt,
      tokenType: "Bearer",
      sessionId: `IRIS-SESS-${Date.now()}`,
    };
  }

  async generateIRN(
    payload: IRPInvoicePayload,
    credentials: TenantIRPCredentials,
    transportDetails?: IRPTransportDetails
  ): Promise<IRPGenerateResult> {
    // Simulate server-side validation error for duplicate test invoices
    if (payload.docDetails.docNo.includes("TEST-DUP")) {
      return {
        success: false,
        errorCode: "2150",
        errorMessage: "Duplicate IRN: Invoice number already exists in financial year.",
      };
    }

    // Generate deterministic or cryptographically random 64-character hex IRN hash
    const rawDataForHash = `${payload.sellerDetails.gstin}${payload.docDetails.docType}${payload.docDetails.docNo}2026-27`;
    const irn = crypto.createHash("sha256").update(rawDataForHash).digest("hex");

    const ackNo = `11${Date.now().toString().slice(-14)}`;
    const ackDate = new Date().toISOString();

    // Generate signed QR Data (standard JWT / Base64 payload structure containing mandatory fields)
    const qrPayload = {
      SellerGstin: payload.sellerDetails.gstin,
      BuyerGstin: payload.buyerDetails.gstin,
      DocNo: payload.docDetails.docNo,
      DocTyp: payload.docDetails.docType,
      DocDt: payload.docDetails.docDate,
      TotInvVal: payload.valueSummary.totalInvoiceValue,
      ItemCnt: payload.itemList.length,
      MainHsnCode: payload.itemList[0]?.hsnCode || "6203",
      Irn: irn,
      AckNo: ackNo,
      AckDt: ackDate,
    };

    const dummyJwtHeader = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const dummyJwtPayload = Buffer.from(JSON.stringify(qrPayload)).toString("base64url");
    const dummyJwtSig = crypto.randomBytes(64).toString("base64url");
    const signedQrData = `${dummyJwtHeader}.${dummyJwtPayload}.${dummyJwtSig}`;

    // Optional E-Way Bill generation if transport details are provided
    let ewbNo: string | undefined;
    let ewbDate: string | undefined;
    let ewbValidTill: string | undefined;

    const effectiveTransport = transportDetails || payload.transportDetails;
    if (effectiveTransport && (effectiveTransport.vehicleNo || effectiveTransport.transporterId)) {
      ewbNo = `32${Date.now().toString().slice(-10)}`;
      ewbDate = new Date().toISOString();
      // Valid for 24 hours per 200 km (default 1 day)
      ewbValidTill = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }

    return {
      success: true,
      irn,
      ackNo,
      ackDate,
      signedQrData,
      signedInvoiceJson: {
        ...payload,
        irn,
        ackNo,
        ackDate,
      },
      ewbNo,
      ewbDate,
      ewbValidTill,
      rawResponse: {
        Status: "1",
        Data: {
          Irn: irn,
          AckNo: ackNo,
          AckDt: ackDate,
          SignedInvoice: "eyJ...",
          SignedQRCode: signedQrData,
          EwbNo: ewbNo,
          EwbDt: ewbDate,
          EwbValidTill: ewbValidTill,
        },
      },
    };
  }

  async cancelIRN(
    irn: string,
    reasonCode: "1" | "2" | "3" | "4",
    remarks: string,
    credentials: TenantIRPCredentials
  ): Promise<IRPCancelResult> {
    if (!irn || irn.length !== 64) {
      return {
        success: false,
        errorCode: "2301",
        errorMessage: "Invalid IRN specified for cancellation.",
      };
    }

    return {
      success: true,
      irn,
      cancelledAt: new Date().toISOString(),
      rawResponse: {
        Status: "1",
        Data: {
          Irn: irn,
          CancelDate: new Date().toISOString(),
        },
      },
    };
  }

  async getIRNStatus(
    docDetails: { docType: IRPDocType; docNo: string; docDate: string },
    credentials: TenantIRPCredentials
  ): Promise<IRPStatusResult> {
    const rawDataForHash = `${credentials.gstin}${docDetails.docType}${docDetails.docNo}2026-27`;
    const irn = crypto.createHash("sha256").update(rawDataForHash).digest("hex");

    return {
      success: true,
      irn,
      status: "registered",
      ackNo: `11${Date.now().toString().slice(-14)}`,
      ackDate: new Date().toISOString(),
    };
  }

  async generateEWB(
    challanPayload: {
      docNo: string;
      docDate: string;
      docType: "CHL";
      subSupplyType: "1" | "2" | "3" | "8";
      fromParty: any;
      toParty: any;
      itemList: any[];
      totalValue: number;
    },
    transportDetails: IRPTransportDetails,
    credentials: TenantIRPCredentials
  ): Promise<IRPEWBResult> {
    const ewbNo = `32${Date.now().toString().slice(-10)}`;
    const ewbDate = new Date().toISOString();
    const ewbValidTill = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return {
      success: true,
      ewbNo,
      ewbDate,
      ewbValidTill,
      rawResponse: {
        Status: "1",
        Data: {
          EwbNo: ewbNo,
          EwbDt: ewbDate,
          EwbValidTill: ewbValidTill,
        },
      },
    };
  }
}
