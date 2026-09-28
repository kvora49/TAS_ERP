import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch invoice status counts in parallel
    const [
      registeredRes,
      pendingRes,
      failedRes,
      cancelledRes,
      billEwbRes,
      challanEwbRes,
      recentErrorsRes,
      bizRes,
    ] = await Promise.all([
      supabase
        .from("sale_bills")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("irn_status", "registered"),

      supabase
        .from("sale_bills")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("irn_status", "pending"),

      supabase
        .from("sale_bills")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("irn_status", "failed"),

      supabase
        .from("sale_bills")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("irn_status", "cancelled"),

      supabase
        .from("sale_bills")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .not("ewb_no", "is", null),

      supabase
        .from("challans")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .not("eway_bill_no", "is", null),

      supabase
        .from("einvoice_error_log")
        .select("*")
        .eq("business_id", businessId)
        .order("occurred_at", { ascending: false })
        .limit(20),

      supabase
        .from("businesses")
        .select("id, name, gstin, einvoice_applicability, aato_bracket, irp_onboarding_status")
        .eq("id", businessId)
        .maybeSingle(),
    ]);

    const registered = registeredRes.count || 0;
    const pending = pendingRes.count || 0;
    const failed = failedRes.count || 0;
    const cancelled = cancelledRes.count || 0;
    const totalBillsWithIrn = registered + pending + failed + cancelled;
    const activeEwbCount = (billEwbRes.count || 0) + (challanEwbRes.count || 0);

    // Compute failure rate
    const failureRate = totalBillsWithIrn > 0 ? (failed / totalBillsWithIrn) * 100 : 0;

    // Detect health and alert state (Requirement 12: Alerting on spikes vs IRP outages)
    let healthStatus: "healthy" | "data_quality_spike" | "irp_outage" = "healthy";
    let alertMessage = "E-Invoice operations are running smoothly with zero active anomalies.";

    const errors = recentErrorsRes.data || [];
    const hasRecentOutageCodes = errors.some(
      (e) =>
        e.irp_error_code === "100" ||
        e.irp_error_code === "102" ||
        e.irp_error_code === "TIMEOUT_UNRESOLVED" ||
        (e.friendly_message && e.friendly_message.toLowerCase().includes("gateway timeout"))
    );

    if (hasRecentOutageCodes) {
      healthStatus = "irp_outage";
      alertMessage = "Potential IRP Gateway Alert: Recent requests encountered upstream authentication or network timeouts.";
    } else if (failureRate > 15 && failed >= 3) {
      healthStatus = "data_quality_spike";
      alertMessage = `High Failure Rate Alert (${failureRate.toFixed(1)}%): Multiple recent e-invoice generations failed due to tenant data quality or validation errors.`;
    }

    return NextResponse.json({
      success: true,
      business: bizRes.data,
      metrics: {
        registered,
        pending,
        failed,
        cancelled,
        totalWithIrn: totalBillsWithIrn,
        activeEwbs: activeEwbCount,
        failureRate: Number(failureRate.toFixed(1)),
        successRate: totalBillsWithIrn > 0 ? Number(((registered / totalBillsWithIrn) * 100).toFixed(1)) : 100,
      },
      health: {
        status: healthStatus,
        message: alertMessage,
      },
      recentErrors: errors,
    });
  } catch (err: any) {
    console.error("Error loading e-invoice operations stats:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load e-invoice operations statistics" },
      { status: 500 }
    );
  }
}
