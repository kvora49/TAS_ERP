import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getEInvoiceAdapter } from "@/lib/einvoice";
import { deriveStateDetails } from "@/lib/gst-utils";
import { logAudit } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { vehicle_no, transporter_name, transporter_id, distance_km } = body;

    // Fetch challan, business, and items in parallel
    const [challanRes, itemsRes, bizRes] = await Promise.all([
      supabase
        .from("challans")
        .select(
          "*, from_godown:godowns(name, address), to_party:parties(name, company_name, email, phone, billing_address, shipping_address, gstin)"
        )
        .eq("id", params.id)
        .eq("business_id", businessId)
        .maybeSingle(),
      supabase
        .from("challan_items")
        .select("*, design:designs(code:design_number, name, hsn_sac), colour:design_colours(colour_name)")
        .eq("challan_id", params.id),
      supabase.from("businesses").select("*").eq("id", businessId).maybeSingle(),
    ]);

    if (challanRes.error || !challanRes.data) {
      return NextResponse.json({ error: "Delivery challan not found" }, { status: 404 });
    }

    const challan = challanRes.data;
    const items = itemsRes.data || [];
    const business = bizRes.data;

    if (!business?.gstin) {
      return NextResponse.json(
        { error: "Company GSTIN must be configured to generate an E-Way Bill." },
        { status: 400 }
      );
    }

    const effectiveVehicle = vehicle_no || challan.transporter || "MH01AB1234";
    const effectiveTransporter = transporter_name || challan.transporter || "Road Transport";

    const sellerState = deriveStateDetails(
      business.address,
      business.gstin,
      business.state,
      business.state_code
    );

    const partyAddress = challan.to_party?.shipping_address || challan.to_party?.billing_address || "Delivery Location";
    const partyGstin = challan.to_party?.gstin;
    const partyState = deriveStateDetails(partyAddress, partyGstin);
    const partyPin = (partyAddress.match(/\b[1-9][0-9]{5}\b/) || [])[0] || "400001";
    const sellerPin = (business.address?.match(/\b[1-9][0-9]{5}\b/) || [])[0] || "400001";

    const adapter = getEInvoiceAdapter();
    const credentials = {
      gstin: business.gstin,
      clientId: process.env.IRIS_CLIENT_ID,
      clientSecret: process.env.IRIS_CLIENT_SECRET,
      userName: business.irp_client_id || undefined,
      authToken: business.irp_auth_token || undefined,
      tokenExpiry: business.irp_token_expiry || undefined,
    };

    const ewbResult = await adapter.generateEWB(
      {
        docNo: challan.challan_number,
        docDate: challan.challan_date,
        docType: "CHL",
        subSupplyType: "8", // Job work / stock transfer
        fromParty: {
          gstin: business.gstin,
          legalName: business.name,
          addressLine1: business.address?.substring(0, 100) || "Office Address",
          location: business.city || "Mumbai",
          pinCode: sellerPin,
          stateCode: sellerState.code,
        },
        toParty: {
          gstin: partyGstin || "URP",
          legalName: (challan.to_party?.company_name || challan.to_party?.name || "Recipient").trim(),
          addressLine1: partyAddress.substring(0, 100),
          location: "Location",
          pinCode: partyPin,
          stateCode: partyState.code || sellerState.code,
        },
        itemList: items.map((it: any, idx: number) => ({
          itemSeqNo: idx + 1,
          productDescription: it.design?.name || `Item ${idx + 1}`,
          isService: false,
          hsnCode: (it.design?.hsn_sac || "620412").replace(/[^0-9]/g, ""),
          quantity: Number(it.quantity || 0),
          unit: "PCS",
          unitPrice: Number(it.unit_cost || 0),
          grossAmount: Number(it.total_value || 0),
          discountAmount: 0,
          preTaxValue: Number(it.total_value || 0),
          taxableValue: Number(it.total_value || 0),
          gstRate: 5,
          igstAmount: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          totalItemValue: Number(it.total_value || 0),
        })),
        totalValue: Number(challan.total_value || 0),
      },
      {
        transporterName: effectiveTransporter,
        transporterId: transporter_id || undefined,
        vehicleNo: effectiveVehicle,
        transportMode: "1",
        distanceKm: distance_km || 50,
      },
      credentials
    );

    if (!ewbResult.success) {
      return NextResponse.json(
        { error: ewbResult.errorMessage || "Failed to generate E-Way bill on government portal." },
        { status: 400 }
      );
    }

    // Persist in challans table
    const { error: updateError } = await supabase
      .from("challans")
      .update({
        eway_bill_no: ewbResult.ewbNo,
        ewb_date: ewbResult.ewbDate,
        ewb_valid_till: ewbResult.ewbValidTill,
        transporter: effectiveTransporter,
        updated_at: new Date().toISOString(),
      })
      .eq("id", challan.id)
      .eq("business_id", businessId);

    if (updateError) {
      console.error("Failed to update challan with E-Way Bill info:", updateError);
    }

    await logAudit(
      businessId,
      "eway_bill_generate",
      "challans",
      challan.id,
      {
        ewb_no: ewbResult.ewbNo,
        ewb_date: ewbResult.ewbDate,
        ewb_valid_till: ewbResult.ewbValidTill,
      }
    );

    return NextResponse.json({
      success: true,
      message: "E-Way Bill generated successfully!",
      ewbNo: ewbResult.ewbNo,
      ewbDate: ewbResult.ewbDate,
      ewbValidTill: ewbResult.ewbValidTill,
    });
  } catch (err: any) {
    console.error("Generate E-Way Bill error:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred during E-Way Bill generation." },
      { status: 500 }
    );
  }
}
