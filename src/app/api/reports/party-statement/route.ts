import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const partyId = searchParams.get("party_id");
  const fromDate = searchParams.get("from") || new Date(new Date().getFullYear(), 3, 1).toISOString().split("T")[0];
  const toDate = searchParams.get("to") || new Date().toISOString().split("T")[0];

  if (!partyId) {
    // Return parties list for the selector
    const { data: parties } = await supabase.from("parties").select("id, name, company_name, type")
      .eq("business_id", businessId).is("deleted_at", null).order("name");
    return NextResponse.json({ parties: parties || [] });
  }

  try {
    // Fetch party info
    const { data: party } = await supabase.from("parties").select("id, name, company_name, type, phone")
      .eq("id", partyId).eq("business_id", businessId).single();

    // Fetch ledger via existing endpoint
    const ledgerRes = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/parties/${partyId}/ledger?from=${fromDate}&to=${toDate}`,
      { headers: { cookie: request.headers.get("cookie") || "" } }
    );
    const ledgerData = await ledgerRes.json();

    return NextResponse.json({
      party, ledger: ledgerData.ledger || [],
      opening_balance: ledgerData.openingBalance || 0,
      closing_balance: ledgerData.closingBalance || 0,
      from: fromDate, to: toDate,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
