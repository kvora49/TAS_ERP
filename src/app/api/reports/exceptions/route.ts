import { NextRequest, NextResponse } from "next/server";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { sourceDate } from "@/lib/report-source-fields";

export async function GET(request: NextRequest) {
  const business = await getSessionBusinessId();
  if (!business) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const from = sourceDate.safeParse(params.get("from")), to = sourceDate.safeParse(params.get("to"));
  if (!from.success || !to.success || from.data > to.data) return NextResponse.json({ error: "Invalid report period" }, { status: 400 });
  try {
    const { data, error } = await createClient().rpc("fn_report_exceptions", { p_business_id: business, p_from: from.data, p_to: to.data });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("[report-exceptions]", error);
    return NextResponse.json({ error: "Unable to load report exceptions" }, { status: 500 });
  }
}
