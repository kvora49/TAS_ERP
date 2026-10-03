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
  const to = searchParams.get("to") ?? null;

  try {
    const { data, error } = await supabase.rpc("fn_report_financial_balance", {
      p_business_id: businessId,
      p_to: to,
    });

    if (error) {
      console.error("[reports/financial/balance RPC error]", error);
      return NextResponse.json({ error: "Failed to fetch balance sheet report" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[reports/financial/balance]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    console.log(`[PERF_TIMING] GET /api/reports/financial/balance - ${(performance.now() - __startTime).toFixed(2)}ms`);
  }
}
