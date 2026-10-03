import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getEInvoiceAdapter, IRP_CANCEL_REASONS } from "@/lib/einvoice";
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
    const body = await request.json();
    const { reason_code, remarks } = body;

    if (!reason_code || !IRP_CANCEL_REASONS[reason_code]) {
      return NextResponse.json(
        { error: "Invalid cancellation reason. Please select a valid reason from the government list." },
        { status: 400 }
      );
    }

    if (!remarks || remarks.trim().length < 3) {
      return NextResponse.json(
        { error: "Cancellation remarks are mandatory (minimum 3 characters)." },
        { status: 400 }
      );
    }

    const [billRes, bizRes, userRes] = await Promise.all([
      supabase
        .from("sale_bills")
        .select("id, bill_number, irn, irn_status, ack_date")
        .eq("id", params.id)
        .eq("business_id", businessId)
        .maybeSingle(),
      supabase
        .from("businesses")
        .select("id, gstin, irp_client_id, irp_auth_token, irp_token_expiry")
        .eq("id", businessId)
        .maybeSingle(),
      supabase.auth.getUser(),
    ]);

    if (billRes.error || !billRes.data) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const bill = billRes.data;
    const business = bizRes.data;
    const user = userRes.data?.user;

    if (!bill.irn || bill.irn_status !== "registered") {
      return NextResponse.json(
        { error: "This invoice does not have an active registered IRN to cancel." },
        { status: 400 }
      );
    }

    // 24-hour statutory cancellation rule verification
    if (bill.ack_date) {
      const ackTime = new Date(bill.ack_date).getTime();
      const now = Date.now();
      const diffHours = (now - ackTime) / (1000 * 60 * 60);

      if (diffHours > 24) {
        return NextResponse.json(
          {
            error:
              "Cancellation window expired. Government rules strictly allow IRP cancellation only within 24 hours of generation. To cancel or adjust this transaction, issue a Credit Note.",
          },
          { status: 400 }
        );
      }
    }

    const adapter = getEInvoiceAdapter();
    const credentials = {
      gstin: business?.gstin || "",
      clientId: process.env.IRIS_CLIENT_ID,
      clientSecret: process.env.IRIS_CLIENT_SECRET,
      userName: business?.irp_client_id || undefined,
      authToken: business?.irp_auth_token || undefined,
      tokenExpiry: business?.irp_token_expiry || undefined,
    };

    const cancelResult = await adapter.cancelIRN(
      bill.irn,
      reason_code as "1" | "2" | "3" | "4",
      remarks.trim(),
      credentials
    );

    if (!cancelResult.success) {
      return NextResponse.json(
        { error: cancelResult.errorMessage || "Failed to cancel IRN on IRP." },
        { status: 400 }
      );
    }

    const cancelledAt = cancelResult.cancelledAt || new Date().toISOString();
    const reasonText = `${IRP_CANCEL_REASONS[reason_code]}: ${remarks.trim()}`;

    // Update bill in DB
    const { error: updateError } = await supabase
      .from("sale_bills")
      .update({
        irn_status: "cancelled",
        irn_cancel_reason: reasonText,
        irn_cancelled_at: cancelledAt,
        locked_for_edit: false, // Unlock for editing/re-invoicing
      })
      .eq("id", bill.id)
      .eq("business_id", businessId);

    if (updateError) {
      console.error("Failed to update bill record after IRN cancellation:", updateError);
    }

    await logAudit(
      businessId,
      "einvoice_cancel",
      "sale_bills",
      bill.id,
      {
        irn: bill.irn,
        reason: reasonText,
        cancelled_at: cancelledAt,
      }
    );

    return NextResponse.json({
      success: true,
      message: "E-Invoice (IRN) cancelled successfully.",
      irn: bill.irn,
      cancelledAt,
    });
  } catch (err: any) {
    console.error("Cancel E-Invoice error:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred during cancellation." },
      { status: 500 }
    );
  }
}
