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
import { getFriendlyIRPErrorMessage } from "../constants";
import { validateGSTINInput } from "../../gst-utils";

export interface IrisAdapterConfig {
  baseUrl?: string;
  isSandbox?: boolean;
}

/**
 * IRIS IRP Adapter Implementation
 * Implements EInvoiceAdapter interface for IRIS IRP GSP APIs
 */
export class IrisEInvoiceAdapter implements EInvoiceAdapter {
  readonly providerName = "IRIS_IRP";
  private baseUrl: string;
  private tokenCache: Map<string, IRPAuthToken> = new Map();

  constructor(config: IrisAdapterConfig = {}) {
    const isSandbox = config.isSandbox ?? process.env.NODE_ENV !== "production";
    this.baseUrl =
      config.baseUrl ||
      (isSandbox
        ? process.env.IRIS_IRP_SANDBOX_URL || "https://sandbox.irisirp.com"
        : process.env.IRIS_IRP_PROD_URL || "https://api.irisirp.com");
  }

  private getEffectiveCredentials(credentials?: TenantIRPCredentials): { effectiveClientId: string; effectiveClientSecret: string } {
    const effectiveClientId = credentials?.clientId || process.env.IRIS_CLIENT_ID;
    const effectiveClientSecret = credentials?.clientSecret || process.env.IRIS_CLIENT_SECRET;

    if (!effectiveClientId || !effectiveClientSecret) {
      throw new Error(
        "[IRIS IRP] Configuration Error: IRIS_CLIENT_ID and IRIS_CLIENT_SECRET are missing. Configure them in environment variables or provide them in credentials."
      );
    }

    return { effectiveClientId, effectiveClientSecret };
  }

  /**
   * Authenticate tenant or intermediary with IRIS IRP
   */
  async authenticate(credentials: TenantIRPCredentials): Promise<IRPAuthToken> {
    const { effectiveClientId, effectiveClientSecret } = this.getEffectiveCredentials(credentials);

    const gstinVal = validateGSTINInput(credentials.gstin);
    if (!gstinVal.isValid) {
      throw new Error(`[IRIS IRP] Invalid Company GSTIN: ${gstinVal.errorMessage || "Must be 15-character valid GSTIN"}`);
    }

    const cacheKey = `${credentials.gstin}_${effectiveClientId}`;
    const cached = this.tokenCache.get(cacheKey);

    // 1. Reuse in-memory cached token if valid for at least 5 more minutes
    if (cached && new Date(cached.expiresAt).getTime() - Date.now() > 5 * 60 * 1000) {
      return cached;
    }

    // 2. Reuse session auth token from database if valid
    if (credentials.authToken) {
      const expiry = credentials.tokenExpiry ? new Date(credentials.tokenExpiry).getTime() : 0;
      if (!credentials.tokenExpiry || expiry - Date.now() > 5 * 60 * 1000) {
        const authToken: IRPAuthToken = {
          token: credentials.authToken,
          expiresAt: credentials.tokenExpiry || new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        };
        this.tokenCache.set(cacheKey, authToken);
        return authToken;
      }
    }

    if (!credentials.userName || !credentials.userName.trim()) {
      throw new Error("[IRIS IRP] GSP API Username is required. Please configure it in Settings > Company Profile.");
    }

    if (!credentials.password || !credentials.password.trim()) {
      throw new Error(
        "[IRIS IRP] Session expired or not connected. Please verify your IRP connection in Settings > Company Profile."
      );
    }

    try {
      const response = await fetch(`${this.baseUrl}/einv/v1/auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "client-id": effectiveClientId,
          "client-secret": effectiveClientSecret,
          gstin: credentials.gstin,
        },
        body: JSON.stringify({
          UserName: credentials.userName,
          Password: credentials.password,
          AuthMode: credentials.authMode || "intermediary",
        }),
      });

      const data = await response.json();

      if (!response.ok || data.Status === "0") {
        const errCode = data.ErrorDetails?.[0]?.ErrorCode || "100";
        const errMsg = data.ErrorDetails?.[0]?.ErrorMessage || data.message || "Authentication failed with IRIS IRP.";
        throw new Error(`[${errCode}] ${getFriendlyIRPErrorMessage(errCode, errMsg)}`);
      }

      const authToken: IRPAuthToken = {
        token: data.Data?.AuthToken || data.token,
        expiresAt: data.Data?.TokenExpiry || new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        sessionId: data.Data?.SessionId,
      };

      this.tokenCache.set(cacheKey, authToken);
      return authToken;
    } catch (err: any) {
      console.error("IRIS Authentication Error:", err);
      throw err;
    }
  }

  /**
   * Generates IRN (+ optional E-Way Bill) via IRIS IRP
   */
  async generateIRN(
    payload: IRPInvoicePayload,
    credentials: TenantIRPCredentials,
    transportDetails?: IRPTransportDetails
  ): Promise<IRPGenerateResult> {
    try {
      const auth = await this.authenticate(credentials);

      // Format payload according to IRP INV-01 Schema
      const irpPayload = this.formatIRPPayload(payload, transportDetails);

      const { effectiveClientId } = this.getEffectiveCredentials(credentials);
      const response = await fetch(`${this.baseUrl}/einv/v1/invoice/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "client-id": effectiveClientId,
          gstin: credentials.gstin,
          "auth-token": auth.token,
        },
        body: JSON.stringify(irpPayload),
      });

      const resJson = await response.json();

      if (!response.ok || resJson.Status === "0") {
        const firstErr = resJson.ErrorDetails?.[0];
        const code = firstErr?.ErrorCode || "DEFAULT";
        const msg = firstErr?.ErrorMessage || resJson.message || "Failed to generate IRN";

        return {
          success: false,
          errorCode: code,
          errorMessage: getFriendlyIRPErrorMessage(code, msg),
          errorDetails: resJson.ErrorDetails?.map((e: any) => ({
            code: e.ErrorCode,
            message: getFriendlyIRPErrorMessage(e.ErrorCode, e.ErrorMessage),
          })),
          rawResponse: resJson,
        };
      }

      const data = resJson.Data;
      return {
        success: true,
        irn: data.Irn,
        ackNo: data.AckNo?.toString(),
        ackDate: data.AckDt,
        signedQrData: data.SignedQRCode,
        signedInvoiceJson: data.SignedInvoice,
        ewbNo: data.EwbNo?.toString(),
        ewbDate: data.EwbDt,
        ewbValidTill: data.EwbValidTill,
        rawResponse: resJson,
      };
    } catch (err: any) {
      return {
        success: false,
        errorCode: "NETWORK_ERROR",
        errorMessage: err.message || "Network or unexpected error while communicating with IRIS IRP.",
        rawResponse: err,
      };
    }
  }

  /**
   * Cancel IRN within 24 hours of generation
   */
  async cancelIRN(
    irn: string,
    reasonCode: "1" | "2" | "3" | "4",
    remarks: string,
    credentials: TenantIRPCredentials
  ): Promise<IRPCancelResult> {
    try {
      const auth = await this.authenticate(credentials);

      const { effectiveClientId } = this.getEffectiveCredentials(credentials);
      const response = await fetch(`${this.baseUrl}/einv/v1/invoice/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "client-id": effectiveClientId,
          gstin: credentials.gstin,
          "auth-token": auth.token,
        },
        body: JSON.stringify({
          Irn: irn,
          CnlRsn: reasonCode,
          CnlRem: remarks,
        }),
      });

      const resJson = await response.json();

      if (!response.ok || resJson.Status === "0") {
        const firstErr = resJson.ErrorDetails?.[0];
        const code = firstErr?.ErrorCode || "DEFAULT";
        const msg = firstErr?.ErrorMessage || resJson.message || "Cancellation failed.";

        return {
          success: false,
          errorCode: code,
          errorMessage: getFriendlyIRPErrorMessage(code, msg),
          rawResponse: resJson,
        };
      }

      return {
        success: true,
        irn,
        cancelledAt: resJson.Data?.CancelDate || new Date().toISOString(),
        rawResponse: resJson,
      };
    } catch (err: any) {
      return {
        success: false,
        errorCode: "NETWORK_ERROR",
        errorMessage: err.message || "Network error while cancelling IRN.",
      };
    }
  }

  /**
   * Retrieve IRN status by Document Details
   */
  async getIRNStatus(
    docDetails: { docType: IRPDocType; docNo: string; docDate: string },
    credentials: TenantIRPCredentials
  ): Promise<IRPStatusResult> {
    try {
      const auth = await this.authenticate(credentials);

      const url = new URL(`${this.baseUrl}/einv/v1/invoice/status`);
      url.searchParams.set("docType", docDetails.docType);
      url.searchParams.set("docNo", docDetails.docNo);
      url.searchParams.set("docDate", docDetails.docDate);

      const { effectiveClientId } = this.getEffectiveCredentials(credentials);
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "client-id": effectiveClientId,
          gstin: credentials.gstin,
          "auth-token": auth.token,
        },
      });

      const resJson = await response.json();

      if (!response.ok || resJson.Status === "0") {
        return {
          success: false,
          rawResponse: resJson,
        };
      }

      return {
        success: true,
        irn: resJson.Data?.Irn,
        status: resJson.Data?.Status === "ACT" ? "registered" : "cancelled",
        ackNo: resJson.Data?.AckNo?.toString(),
        ackDate: resJson.Data?.AckDt,
        rawResponse: resJson,
      };
    } catch (err: any) {
      return {
        success: false,
        rawResponse: err,
      };
    }
  }

  /**
   * Standalone E-Way Bill generation for Delivery Challans
   */
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
    try {
      const auth = await this.authenticate(credentials);

      const { effectiveClientId } = this.getEffectiveCredentials(credentials);
      const response = await fetch(`${this.baseUrl}/ewb/v1/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "client-id": effectiveClientId,
          gstin: credentials.gstin,
          "auth-token": auth.token,
        },
        body: JSON.stringify({
          supplyType: "O",
          subSupplyType: challanPayload.subSupplyType,
          docType: "CHL",
          docNo: challanPayload.docNo,
          docDate: challanPayload.docDate,
          fromGstin: challanPayload.fromParty.gstin,
          fromTrdName: challanPayload.fromParty.legalName,
          fromAddr1: challanPayload.fromParty.addressLine1,
          fromPlace: challanPayload.fromParty.location,
          fromPincode: Number(challanPayload.fromParty.pinCode),
          actFromStateCode: Number(challanPayload.fromParty.stateCode),
          fromStateCode: Number(challanPayload.fromParty.stateCode),
          toGstin: challanPayload.toParty.gstin || "URP",
          toTrdName: challanPayload.toParty.legalName,
          toAddr1: challanPayload.toParty.addressLine1,
          toPlace: challanPayload.toParty.location,
          toPincode: Number(challanPayload.toParty.pinCode),
          actToStateCode: Number(challanPayload.toParty.stateCode),
          toStateCode: Number(challanPayload.toParty.stateCode),
          totalValue: challanPayload.totalValue,
          transporterId: transportDetails.transporterId,
          transporterName: transportDetails.transporterName,
          transDocNo: transportDetails.transporterDocNo,
          transDocDate: transportDetails.transporterDocDate,
          transMode: transportDetails.transportMode || "1",
          distance: transportDetails.distanceKm || 0,
          vehicleNo: transportDetails.vehicleNo,
          vehicleType: transportDetails.vehicleType || "R",
          itemList: challanPayload.itemList.map((it) => ({
            productName: it.productDescription,
            hsnCode: Number(it.hsnCode),
            quantity: it.quantity,
            qtyUnit: it.unit,
            taxableAmount: it.taxableValue,
            cgstRate: it.gstRate / 2,
            sgstRate: it.gstRate / 2,
            igstRate: it.igstAmount > 0 ? it.gstRate : 0,
          })),
        }),
      });

      const resJson = await response.json();

      if (!response.ok || resJson.Status === "0") {
        const firstErr = resJson.ErrorDetails?.[0];
        const code = firstErr?.ErrorCode || "DEFAULT";
        const msg = firstErr?.ErrorMessage || resJson.message || "Failed to generate E-Way bill.";
        return {
          success: false,
          errorCode: code,
          errorMessage: getFriendlyIRPErrorMessage(code, msg),
          rawResponse: resJson,
        };
      }

      return {
        success: true,
        ewbNo: resJson.Data?.EwbNo?.toString(),
        ewbDate: resJson.Data?.EwbDt,
        ewbValidTill: resJson.Data?.EwbValidTill,
        rawResponse: resJson,
      };
    } catch (err: any) {
      return {
        success: false,
        errorCode: "NETWORK_ERROR",
        errorMessage: err.message || "Network error while generating E-Way Bill.",
      };
    }
  }

  /**
   * Helper to format internal model to standard IRP INV-01 JSON
   */
  private formatIRPPayload(payload: IRPInvoicePayload, transportDetails?: IRPTransportDetails): any {
    const tr = transportDetails || payload.transportDetails;

    return {
      Version: payload.version || "1.1",
      TranDtls: {
        TaxSch: payload.transactionDetails.taxScheme || "GST",
        SupTyp: payload.transactionDetails.supplyType || "B2B",
        RegRev: payload.transactionDetails.reverseCharge ? "Y" : "N",
        IgstOnIntra: payload.transactionDetails.igstOnIntra ? "Y" : "N",
      },
      DocDtls: {
        Typ: payload.docDetails.docType,
        No: payload.docDetails.docNo,
        Dt: payload.docDetails.docDate,
      },
      SellerDtls: {
        Gstin: payload.sellerDetails.gstin,
        LglNm: payload.sellerDetails.legalName,
        TrdNm: payload.sellerDetails.tradeName || payload.sellerDetails.legalName,
        Addr1: payload.sellerDetails.addressLine1,
        Addr2: payload.sellerDetails.addressLine2 || "",
        Loc: payload.sellerDetails.location || "City",
        Pin: Number(payload.sellerDetails.pinCode),
        Stcd: payload.sellerDetails.stateCode,
      },
      BuyerDtls: {
        Gstin: payload.buyerDetails.gstin,
        LglNm: payload.buyerDetails.legalName,
        TrdNm: payload.buyerDetails.tradeName || payload.buyerDetails.legalName,
        Pos: payload.buyerDetails.placeOfSupply || payload.buyerDetails.stateCode,
        Addr1: payload.buyerDetails.addressLine1,
        Addr2: payload.buyerDetails.addressLine2 || "",
        Loc: payload.buyerDetails.location || "City",
        Pin: Number(payload.buyerDetails.pinCode),
        Stcd: payload.buyerDetails.stateCode,
      },
      DispDtls: payload.dispatchDetails
        ? {
            Nm: payload.dispatchDetails.legalName,
            Addr1: payload.dispatchDetails.addressLine1,
            Loc: payload.dispatchDetails.location,
            Pin: Number(payload.dispatchDetails.pinCode),
            Stcd: payload.dispatchDetails.stateCode,
          }
        : undefined,
      ShipDtls: payload.shipToDetails
        ? {
            Gstin: payload.shipToDetails.gstin || undefined,
            LglNm: payload.shipToDetails.legalName,
            TrdNm: payload.shipToDetails.tradeName || payload.shipToDetails.legalName,
            Addr1: payload.shipToDetails.addressLine1,
            Loc: payload.shipToDetails.location,
            Pin: Number(payload.shipToDetails.pinCode),
            Stcd: payload.shipToDetails.stateCode,
          }
        : undefined,
      ItemList: payload.itemList.map((it) => ({
        SlNo: String(it.itemSeqNo),
        PrdDesc: it.productDescription,
        IsServc: it.isService ? "Y" : "N",
        HsnCd: it.hsnCode,
        Qty: it.quantity,
        Unit: it.unit || "PCS",
        UnitPrice: it.unitPrice,
        TotAmt: it.grossAmount,
        Discount: it.discountAmount,
        AssAmt: it.taxableValue,
        GstRt: it.gstRate,
        IgstAmt: it.igstAmount,
        CgstAmt: it.cgstAmount,
        SgstAmt: it.sgstAmount,
        TotItemVal: it.totalItemValue,
      })),
      ValDtls: {
        AssVal: payload.valueSummary.totalTaxableAmount,
        CgstVal: payload.valueSummary.totalCgstAmount,
        SgstVal: payload.valueSummary.totalSgstAmount,
        IgstVal: payload.valueSummary.totalIgstAmount,
        CesVal: payload.valueSummary.totalCessAmount || 0,
        Discount: payload.valueSummary.discountAmount || 0,
        OthChrg: payload.valueSummary.otherCharges || 0,
        RndOffAmt: payload.valueSummary.roundOffAmount || 0,
        TotInvVal: payload.valueSummary.totalInvoiceValue,
      },
      EwbDtls:
        tr && (tr.vehicleNo || tr.transporterId)
          ? {
              TransId: tr.transporterId || undefined,
              TransName: tr.transporterName || undefined,
              Distance: tr.distanceKm || 0,
              TransDocNo: tr.transporterDocNo || undefined,
              TransDocDt: tr.transporterDocDate || undefined,
              VehNo: tr.vehicleNo || undefined,
              VehType: tr.vehicleType || "R",
              TransMode: tr.transportMode || "1",
            }
          : undefined,
    };
  }
}
