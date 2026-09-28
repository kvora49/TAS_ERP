import { NextRequest, NextResponse } from "next/server";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const __startTime = performance.now();
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? null;
  const to = searchParams.get("to") ?? null;
  const tab = searchParams.get("tab") ?? "receivables";
  const billType = searchParams.get("bill_type") ?? null;
  const partyId = searchParams.get("party_id") && searchParams.get("party_id") !== "all" ? searchParams.get("party_id") : null;
  const agingBucket = searchParams.get("aging_bucket") ?? null;
  const accountId = searchParams.get("account_id") && searchParams.get("account_id") !== "all" ? searchParams.get("account_id") : null;
  const direction = searchParams.get("direction") ?? null;
  const accountCategory = searchParams.get("account_category") ?? null;

  try {
    const { data, error } = await supabase.rpc("fn_report_payments", {
      p_business_id: businessId,
      p_tab: tab,
      p_from: from,
      p_to: to,
      p_bill_type: billType,
      p_party_id: partyId,
      p_aging_bucket: agingBucket,
      p_account_id: accountId,
      p_direction: direction,
      p_account_category: accountCategory,
    });

    if (error) {
      console.error("[reports/payments RPC error]", error);
      return NextResponse.json({ error: error.message || "Failed to fetch payments report" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[reports/payments]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    console.log(`[PERF_TIMING] GET /api/reports/payments - ${(performance.now() - __startTime).toFixed(2)}ms`);
  }
}
