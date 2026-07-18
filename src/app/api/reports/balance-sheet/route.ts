import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const toDate = searchParams.get("to") || new Date().toISOString().split("T")[0];

  try {
    const { data: balanceData, error: balanceError } = await supabase
      .rpc("get_balance_sheet", { p_business_id: businessId, p_as_on_date: toDate });

    if (balanceError) throw balanceError;

    // The RPC returns a JSON value. Inside Next.js we unpack/return it directly.
    return NextResponse.json(balanceData);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
