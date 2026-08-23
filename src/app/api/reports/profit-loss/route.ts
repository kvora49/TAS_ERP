import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const defaultFrom = `${fyStartYear}-04-01`;

  const { searchParams } = new URL(request.url);
  const fromDate = searchParams.get("from") || defaultFrom;
  const toDate = searchParams.get("to") || today.toISOString().split("T")[0];

  try {
    const { data: plData, error: plError } = await supabase
      .rpc("get_profit_loss", { p_business_id: businessId, p_from: fromDate, p_to: toDate });

    if (plError) throw plError;

    return NextResponse.json(plData);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
