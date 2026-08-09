import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userData } = await supabase.from("users").select("business_id").eq("id", user.id).single();
  if (!userData?.business_id) return NextResponse.json({ error: "No business" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? `${new Date().getFullYear()}-04-01`;
  const to = searchParams.get("to") ?? new Date().toISOString().split("T")[0];
  const billType = searchParams.get("bill_type"); // 'kacha' | 'pakka' | null = all
  const partyId = searchParams.get("party_id");
  const paymentStatus = searchParams.get("payment_status");
  const bid = userData.business_id;

  try {
    let query = supabase
      .from("sale_bills")
      .select(`
        id, bill_number, bill_type, bill_date, grand_total, taxable_amount,
        cgst, sgst, igst, payment_status, paid_amount, status,
        parties!inner(id, name, company_name)
      `)
      .eq("business_id", bid)
      .eq("status", "active")
      .is("deleted_at", null)
      .gte("bill_date", from)
      .lte("bill_date", to)
      .order("bill_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (billType && (billType === "kacha" || billType === "pakka")) {
      query = query.eq("bill_type", billType);
    }

    if (partyId && partyId !== "all") {
      query = query.eq("party_id", partyId);
    }

    if (paymentStatus && paymentStatus !== "all") {
      query = query.eq("payment_status", paymentStatus);
    }

    const { data: bills, error } = await query;
    if (error) throw error;

    const allBills = bills ?? [];

    // Summary stats
    const totalRevenue = allBills.reduce((s, b) => s + Number(b.grand_total), 0);
    const totalBills = allBills.length;
    const totalOutstanding = allBills
      .filter(b => b.payment_status !== "paid")
      .reduce((s, b) => s + Number(b.grand_total) - Number(b.paid_amount), 0);
    const totalPaid = allBills.reduce((s, b) => s + Number(b.paid_amount), 0);
    const avgBillValue = totalBills > 0 ? totalRevenue / totalBills : 0;

    // Kaacha vs Pakka split
    const kachaRevenue = allBills.filter(b => b.bill_type === "kacha").reduce((s, b) => s + Number(b.grand_total), 0);
    const pakkaRevenue = allBills.filter(b => b.bill_type === "pakka").reduce((s, b) => s + Number(b.grand_total), 0);

    // Monthly trend
    const monthMap: Record<string, number> = {};
    for (const b of allBills) {
      const m = b.bill_date.slice(0, 7); // YYYY-MM
      monthMap[m] = (monthMap[m] || 0) + Number(b.grand_total);
    }
    const monthlyTrend = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({
        month: new Date(month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
        total,
        rawMonth: month,
      }));

    // Top parties by revenue
    const partyMap: Record<string, { id: string; name: string; total: number; bills: number }> = {};
    for (const b of allBills) {
      const p = b.parties as any;
      const pName = p?.company_name ?? p?.name ?? "Unknown";
      if (!partyMap[p?.id]) {
        partyMap[p?.id] = { id: p?.id, name: pName, total: 0, bills: 0 };
      }
      partyMap[p?.id].total += Number(b.grand_total);
      partyMap[p?.id].bills += 1;
    }
    const topParties = Object.values(partyMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Payment status breakdown
    const statusBreakdown = allBills.reduce<Record<string, number>>((acc, b) => {
      acc[b.payment_status] = (acc[b.payment_status] || 0) + 1;
      return acc;
    }, {});

    // Recent bills (for table display) — already sorted desc
    const recentBills = allBills.slice(0, 50).map(b => ({
      id: b.id,
      bill_number: b.bill_number,
      bill_type: b.bill_type,
      bill_date: b.bill_date,
      party: (b.parties as any)?.company_name ?? (b.parties as any)?.name ?? "—",
      party_id: (b.parties as any)?.id,
      grand_total: Number(b.grand_total),
      paid_amount: Number(b.paid_amount),
      outstanding: Number(b.grand_total) - Number(b.paid_amount),
      payment_status: b.payment_status,
    }));

    return NextResponse.json({
      from,
      to,
      bill_type: billType ?? "all",
      summary: {
        totalRevenue,
        totalBills,
        totalOutstanding,
        totalPaid,
        avgBillValue,
        kachaRevenue,
        pakkaRevenue,
        kachaBills: allBills.filter(b => b.bill_type === "kacha").length,
        pakkaBills: allBills.filter(b => b.bill_type === "pakka").length,
      },
      monthlyTrend,
      topParties,
      statusBreakdown,
      bills: recentBills,
    });
  } catch (err: any) {
    console.error("[reports/sales]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
