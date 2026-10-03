import { validReportRequest } from "@/lib/report-request";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const __startTime = performance.now();
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid party identifier" }, { status: 400 });
  }
  const { searchParams } = new URL(request.url);
  if (!validReportRequest(searchParams)) return NextResponse.json({ error: "Invalid report filters" }, { status: 400 });
  const billType = searchParams.get("bill_type"); // 'kacha' | 'pakka' | null

  try {
    const { data, error } = await supabase.rpc("fn_party_ledger", {
      p_business_id: businessId,
      p_party_id: id,
      p_bill_type: billType ?? null,
    });

    if (error) {
      console.error("[parties/ledger RPC error]", error);
      return NextResponse.json({ error: "Failed to fetch party ledger" }, { status: 500 });
    }

    if (data?.error === "Party/Worker not found") {
      return NextResponse.json({ error: "Party/Worker not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[parties/ledger]", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  } finally {
    console.log(`[PERF_TIMING] GET /api/parties/${params.id}/ledger - ${(performance.now() - __startTime).toFixed(2)}ms`);
  }
}
