import { validReportRequest } from "@/lib/report-request";
import { NextRequest, NextResponse } from "next/server";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const __startTime = performance.now();
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  if (!validReportRequest(searchParams)) return NextResponse.json({ error: "Invalid report filters" }, { status: 400 });
  const from = searchParams.get("from") ?? null;
  const to = searchParams.get("to") ?? null;
  const billType = searchParams.get("bill_type") ?? null;
  const brandId = searchParams.get("brand_id") && searchParams.get("brand_id") !== "all" ? searchParams.get("brand_id") : null;

  try {
    const { data, error } = await supabase.rpc("fn_report_analysis", {
      p_business_id: businessId,
      p_from: from,
      p_to: to,
      p_bill_type: billType,
      p_brand_id: brandId,
      p_compare: searchParams.get("compare") ?? "prev_period",
    });

    if (error) {
      console.error("[reports/analysis RPC error]", error);
      return NextResponse.json({ error: "Failed to fetch analysis report" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[reports/analysis]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    console.log(`[PERF_TIMING] GET /api/reports/analysis - ${(performance.now() - __startTime).toFixed(2)}ms`);
  }
}
