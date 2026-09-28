import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { SalesBillRepository } from "@/repositories/sales-bill.repository";
import {
  validateInvoiceForEInvoice,
  getEInvoiceAdapter,
  IRPInvoicePayload,
  IRPTransportDetails,
} from "@/lib/einvoice";
import { deriveStateDetails } from "@/lib/gst-utils";
import { logAudit } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const __startTime = performance.now();
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const repo = new SalesBillRepository(supabase);
    const [detail, bizRes, userRes] = await Promise.all([
      repo.getDetailById(params.id, businessId),
      supabase.from("businesses").select("*").eq("id", businessId).maybeSingle(),
      supabase.auth.getUser(),
    ]);

    if (!detail || !detail.bill) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (bizRes.error || !bizRes.data) {
      return NextResponse.json({ error: "Business profile not found" }, { status: 404 });
    }

    const bill = detail.bill;
    const business = bizRes.data;
    const user = userRes.data?.user;

    // 1. Run Local Pre-Validation
    const validation = await validateInvoiceForEInvoice(
      {
        ...bill,
        items: detail.bill.items || [],
      },
      {
        id: business.id,
        name: business.name,
        gstin: business.gstin,
        address: business.address,
        city: business.city,
        pincode: business.pincode,
        state: business.state,
        state_code: business.state_code,
        aato_bracket: business.aato_bracket,
        einvoice_applicability: business.einvoice_applicability,
      },
      { supabase }
    );

    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: "Invoice failed local pre-validation checks.",
          validationErrors: validation.errors,
        },
        { status: 422 }
      );
    }

    // 2. Derive Seller, Buyer, Consignee Details
    const sellerState = deriveStateDetails(
      business.address,
      business.gstin,
      business.state,
      business.state_code
    );

    const buyerGstin = bill.gstin || bill.party?.gstin;
    const buyerAddress = bill.billing_address || bill.party?.billing_address_line1 || "";
    const buyerPin =
      bill.billing_pincode ||
      bill.party?.billing_pincode ||
      (buyerAddress.match(/\b[1-9][0-9]{5}\b/) || [])[0] ||
      "400001";
    const buyerState = deriveStateDetails(
      buyerAddress,
      buyerGstin,
      bill.billing_state || bill.party?.billing_state || bill.party?.state,
      bill.billing_state_code
    );

    const buyerTradeName = (bill.party?.company_name || bill.party?.name || "Customer").trim();

    // 3. Format Line Items
    const rawItems: any[] = bill.items || [];
    const isInterstate = Number(bill.igst || 0) > 0;

    const itemList = rawItems.map((it, idx) => {
      const qty = Number(it.quantity || 0);
      const rate = Number(it.rate || 0);
      const discPercent = Number(it.discount_percent || 0);
      const grossAmt = qty * rate;
      const discAmt = grossAmt * (discPercent / 100);
      const taxable = grossAmt - discAmt;
      const gstRate = Number(it.tax_percent || 0);
      const lineTax = taxable * (gstRate / 100);

      const hsn = (it.hsn_sac || "").toString().trim().replace(/[^0-9]/g, "") || "620412";
      const desc = it.item_name || it.description || it.design?.name || it.design?.design_number || `Item ${idx + 1}`;

      return {
        itemSeqNo: idx + 1,
        productDescription: desc.substring(0, 100),
        isService: false,
        hsnCode: hsn,
        quantity: qty,
        unit: (it.unit || "PCS").toUpperCase().substring(0, 8),
        unitPrice: rate,
        grossAmount: Math.round(grossAmt * 100) / 100,
        discountAmount: Math.round(discAmt * 100) / 100,
        preTaxValue: Math.round(taxable * 100) / 100,
        taxableValue: Math.round(taxable * 100) / 100,
        gstRate,
        igstAmount: isInterstate ? Math.round(lineTax * 100) / 100 : 0,
        cgstAmount: !isInterstate ? Math.round((lineTax / 2) * 100) / 100 : 0,
        sgstAmount: !isInterstate ? Math.round((lineTax / 2) * 100) / 100 : 0,
        totalItemValue: Math.round((taxable + lineTax) * 100) / 100,
      };
    });

    // 4. Construct Transport Details if present
    let transportDetails: IRPTransportDetails | undefined;
    const transporter = bill.eway_transporter || bill.transporter_name || bill.dispatched_through;
    const vehicle = bill.eway_vehicle_no || bill.vehicle_no;

    if (transporter || vehicle) {
      transportDetails = {
        transporterName: transporter || undefined,
        vehicleNo: vehicle || undefined,
        transportMode: "1", // Road
        distanceKm: 50,
      };
    }

    // 5. Construct Normalized Payload
    const invoicePayload: IRPInvoicePayload = {
      version: "1.1",
      docDetails: {
        docType: "INV",
        docNo: bill.bill_number,
        docDate: bill.bill_date,
      },
      transactionDetails: {
        taxScheme: "GST",
        supplyType: "B2B",
        reverseCharge: false,
        igstOnIntra: false,
      },
      sellerDetails: {
        gstin: business.gstin,
        legalName: business.name,
        tradeName: business.name,
        addressLine1: business.address?.substring(0, 100) || "Office Address",
        location: business.city || "Mumbai",
        pinCode: business.pincode || "400001",
        stateCode: sellerState.code,
      },
      buyerDetails: {
        gstin: buyerGstin,
        legalName: buyerTradeName,
        tradeName: buyerTradeName,
        addressLine1: buyerAddress.substring(0, 100) || "Billing Address",
        location: bill.billing_city || "City",
        pinCode: buyerPin,
        stateCode: buyerState.code,
      },
      itemList,
      valueSummary: {
        totalTaxableAmount: Number(bill.taxable_amount || 0),
        totalCgstAmount: Number(bill.cgst || 0),
        totalSgstAmount: Number(bill.sgst || 0),
        totalIgstAmount: Number(bill.igst || 0),
        totalCessAmount: 0,
        discountAmount: Number(bill.discount_amount || 0),
        otherCharges: Number(bill.charges_total || 0),
        roundOffAmount: Number(bill.round_off || 0),
        totalInvoiceValue: Number(bill.grand_total || 0),
      },
      transportDetails,
    };

    // 6. Invoke Adapter
    const adapter = getEInvoiceAdapter();
    const credentials = {
      gstin: business.gstin,
      clientId: process.env.IRIS_CLIENT_ID || "tas_iris_client",
      clientSecret: process.env.IRIS_CLIENT_SECRET || "tas_iris_secret",
      userName: business.irp_client_id || undefined,
    };

    const result = await adapter.generateIRN(invoicePayload, credentials, transportDetails);

    if (!result.success) {
      // Log error to einvoice_error_log
      await supabase.from("einvoice_error_log").insert({
        business_id: businessId,
        invoice_id: bill.id,
        irp_error_code: result.errorCode || "IRP_ERROR",
        friendly_message: result.errorMessage || "IRP rejected invoice generation",
        raw_response: JSON.stringify(result.rawResponse || {}),
      });

      // Update invoice status to failed
      await supabase
        .from("sale_bills")
        .update({ irn_status: "failed" })
        .eq("id", bill.id)
        .eq("business_id", businessId);

      return NextResponse.json(
        {
          error: result.errorMessage,
          errorCode: result.errorCode,
          errorDetails: result.errorDetails,
        },
        { status: 400 }
      );
    }

    // 7. Update Invoice with Generated IRN & Locked State
    const updateData: any = {
      irn: result.irn,
      irn_status: "registered",
      ack_no: result.ackNo,
      ack_date: result.ackDate,
      signed_qr_data: result.signedQrData,
      signed_invoice_json: result.signedInvoiceJson,
      ewb_no: result.ewbNo || null,
      ewb_date: result.ewbDate || null,
      ewb_valid_till: result.ewbValidTill || null,
      locked_for_edit: true, // Immutability lock
    };

    const { error: updateError } = await supabase
      .from("sale_bills")
      .update(updateData)
      .eq("id", bill.id)
      .eq("business_id", businessId);

    if (updateError) {
      console.error("Failed to update bill with IRN data:", updateError);
      return NextResponse.json(
        { error: "IRN was generated but failed to save to invoice record." },
        { status: 500 }
      );
    }

    // Log audit trail
    await logAudit(
      businessId,
      "einvoice_generate",
      "sale_bills",
      bill.id,
      {
        irn: result.irn,
        ack_no: result.ackNo,
        ewb_no: result.ewbNo,
      }
    );

    return NextResponse.json({
      success: true,
      message: "E-Invoice generated successfully!",
      irn: result.irn,
      ackNo: result.ackNo,
      ackDate: result.ackDate,
      signedQrData: result.signedQrData,
      ewbNo: result.ewbNo,
      ewbDate: result.ewbDate,
      ewbValidTill: result.ewbValidTill,
    });
  } catch (err: any) {
    console.error("Generate E-Invoice server error:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred during E-Invoice generation." },
      { status: 500 }
    );
  } finally {
    console.log(`[PERF_TIMING] POST /api/sales/bills/${params.id}/einvoice/generate - ${(performance.now() - __startTime).toFixed(2)}ms`);
  }
}
