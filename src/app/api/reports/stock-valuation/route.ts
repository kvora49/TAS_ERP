import { validReportRequest } from "@/lib/report-request";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const __startTime = performance.now();
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  if (!validReportRequest(searchParams)) return NextResponse.json({ error: "Invalid report filters" }, { status: 400 });

  try {
    const { data, error } = await supabase.rpc("fn_report_stock_valuation", {
      p_business_id: businessId,
    });

    if (error) {
      console.error("[reports/stock-valuation RPC error]", error);
      return NextResponse.json({ error: "Failed to fetch stock valuation" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[reports/stock-valuation]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    console.log(`[PERF_TIMING] GET /api/reports/stock-valuation - ${(performance.now() - __startTime).toFixed(2)}ms`);
  }
}
