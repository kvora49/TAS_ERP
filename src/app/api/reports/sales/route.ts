import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || `${new Date().getFullYear()}-04-01`;
  const to = searchParams.get("to") || new Date().toISOString().split("T")[0];

  try {
    const [billsResult, returnsResult, topPartiesResult] = await Promise.all([
      supabase
        .from("sale_bills")
        .select(`
          id, bill_number, bill_date, grand_total, cgst, sgst, igst, paid_amount,
          payment_status, party:parties(id, name, company_name)
        `)
        .eq("business_id", businessId)
        .gte("bill_date", from)
        .lte("bill_date", to)
        .order("bill_date", { ascending: false }),
      supabase
        .from("sale_returns")
        .select("id, return_date, grand_total")
        .eq("business_id", businessId)
        .gte("return_date", from)
        .lte("return_date", to),
      supabase
        .from("sale_bills")
        .select("party_id, grand_total, parties(name, company_name)")
        .eq("business_id", businessId)
        .gte("bill_date", from)
        .lte("bill_date", to),
    ]);

    const rawBills = billsResult.data || [];
    const bills = rawBills.map((b: any) => {
      const gst = Number(b.cgst || 0) + Number(b.sgst || 0) + Number(b.igst || 0);
      const outstanding = Number(b.grand_total || 0) - Number(b.paid_amount || 0);
      return {
        ...b,
        gst_amount: gst,
        outstanding_amount: outstanding,
      };
    });

    const totalRevenue = bills.reduce((s: number, b: any) => s + Number(b.grand_total), 0);
    const totalGST = bills.reduce((s: number, b: any) => s + Number(b.gst_amount || 0), 0);
    const totalOutstanding = bills.reduce((s: number, b: any) => s + Number(b.outstanding_amount || 0), 0);
    const totalReturns = (returnsResult.data || []).reduce((s: number, r: any) => s + Number(r.grand_total), 0);

    const billsByStatus = bills.reduce((acc: Record<string, number>, b: any) => {
      acc[b.payment_status] = (acc[b.payment_status] || 0) + 1;
      return acc;
    }, {});

    // Top parties by revenue
    const partyMap: Record<string, { name: string; total: number }> = {};
    (topPartiesResult.data || []).forEach((b: any) => {
      const party = Array.isArray(b.parties) ? b.parties[0] : b.parties;
      const name = party?.company_name || party?.name || "Unknown";
      if (!partyMap[b.party_id]) partyMap[b.party_id] = { name, total: 0 };
      partyMap[b.party_id].total += Number(b.grand_total);
    });
    const topParties = Object.entries(partyMap)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([id, v]) => ({ id, ...v }));

    // Monthly trend
    const monthMap: Record<string, number> = {};
    bills.forEach((b: any) => {
      const monthKey = b.bill_date.substring(0, 7);
      monthMap[monthKey] = (monthMap[monthKey] || 0) + Number(b.grand_total);
    });
    const monthlyTrend = Object.entries(monthMap)
      .sort()
      .map(([month, total]) => ({ month, total }));

    return NextResponse.json({
      from, to,
      summary: {
        totalRevenue, totalGST, totalOutstanding, totalReturns,
        totalBills: bills.length,
        netRevenue: totalRevenue - totalReturns,
      },
      bills,
      billsByStatus,
      topParties,
      monthlyTrend,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
