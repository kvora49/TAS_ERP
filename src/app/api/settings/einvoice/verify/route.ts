import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getEInvoiceAdapter } from "@/lib/einvoice";
import { validateGSTINInput } from "@/lib/gst-utils";

export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { userName, password } = body;

    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .select("id, gstin, name, irp_client_id, irp_auth_token, irp_token_expiry, irp_onboarding_status")
      .eq("id", businessId)
      .maybeSingle();

    if (bizError || !business) {
      return NextResponse.json({ error: "Business record not found" }, { status: 404 });
    }

    if (!business.gstin) {
      return NextResponse.json(
        { error: "A valid Company GSTIN must be configured in Company Profile before connecting to IRP." },
        { status: 400 }
      );
    }

    // Strict 15-character GSTIN validation
    const gstinVal = validateGSTINInput(business.gstin);
    if (!gstinVal.isValid) {
      return NextResponse.json(
        {
          error: `Cannot authorize with IRP: Company GSTIN "${business.gstin}" is invalid (${gstinVal.errorMessage || "Must be 15 characters"}). Please update and save a valid 15-character GSTIN in Company Profile first.`,
        },
        { status: 400 }
      );
    }

    const effectiveUserName = userName?.trim() || business.irp_client_id;
    if (!effectiveUserName) {
      return NextResponse.json(
        { error: "Please provide your GSP API Username created on einvoice1.gst.gov.in under API Registration." },
        { status: 400 }
      );
    }

    if (!password || !password.trim()) {
      return NextResponse.json(
        { error: "Please enter your GSP API Password to authenticate with the IRP portal." },
        { status: 400 }
      );
    }

    // Layer 1: Platform credentials identifying TAS to IRIS (stored strictly on server)
    const platformClientId = process.env.IRIS_CLIENT_ID || "tas_iris_client";
    const platformClientSecret = process.env.IRIS_CLIENT_SECRET || "tas_iris_secret";

    const adapter = getEInvoiceAdapter();
    const isLiveIris = adapter.providerName === "IRIS_IRP";

    const authResult = await adapter.authenticate({
      gstin: business.gstin,
      clientId: platformClientId,
      clientSecret: platformClientSecret,
      userName: effectiveUserName,
      password: password.trim(),
    });

    // Mark tenant as authorized in DB with live session token
    await supabase
      .from("businesses")
      .update({
        irp_onboarding_status: "authorized",
        irp_client_id: effectiveUserName || null,
        irp_auth_token: authResult.token,
        irp_token_expiry: authResult.expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", businessId);

    return NextResponse.json({
      success: true,
      isLive: isLiveIris,
      providerName: adapter.providerName,
      message: isLiveIris
        ? `GSTIN ${business.gstin} is successfully authorized with live IRIS GSP. Live E-Invoicing is ready!`
        : `[Simulator Mode] Verified locally with Mock Adapter for GSTIN ${business.gstin}. (Notice: Live government portal connection requires EINVOICE_ADAPTER=iris and live GSP credentials in .env.local).`,
      expiresAt: authResult.expiresAt,
      apiUsername: effectiveUserName,
    });
  } catch (err: any) {
    console.error("IRP connection verification failed:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to authenticate with IRP. Please check your credentials.",
      },
      { status: 400 }
    );
  }
}
