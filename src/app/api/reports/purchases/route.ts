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
  const tab = searchParams.get("tab") ?? "all"; // 'raw' | 'finished' | 'all'
  const billType = searchParams.get("bill_type"); // 'kacha' | 'pakka' | null = all
  const partyId = searchParams.get("party_id");
  const paymentStatus = searchParams.get("payment_status");
  const bid = userData.business_id;

  try {
    let rawQuery = supabase
      .from("raw_material_purchases")
      .select(`
        id, purchase_number, invoice_date, grand_total, paid_amount,
        payment_status, status, gst_type,
        parties!inner(id, name, company_name)
      `)
      .eq("business_id", bid)
      .neq("status", "cancelled")
      .is("deleted_at", null)
      .gte("invoice_date", from)
      .lte("invoice_date", to);

    let finishedQuery = supabase
      .from("purchase_bills")
      .select(`
        id, bill_number, invoice_date, grand_total, paid_amount,
        payment_status, status, bill_type,
        parties!inner(id, name, company_name)
      `)
      .eq("business_id", bid)
      .neq("status", "cancelled")
      .gte("invoice_date", from)
      .lte("invoice_date", to);

    if (billType && (billType === "kacha" || billType === "pakka")) {
      if (billType === "kacha") {
        rawQuery = rawQuery.eq("gst_type", "without_gst");
        finishedQuery = finishedQuery.eq("bill_type", "kacha");
      } else {
        rawQuery = rawQuery.neq("gst_type", "without_gst");
        finishedQuery = finishedQuery.eq("bill_type", "pakka");
      }
    }

    if (partyId && partyId !== "all") {
      rawQuery = rawQuery.eq("party_id", partyId);
      finishedQuery = finishedQuery.eq("party_id", partyId);
    }

    if (paymentStatus && paymentStatus !== "all") {
      rawQuery = rawQuery.eq("payment_status", paymentStatus);
      finishedQuery = finishedQuery.eq("payment_status", paymentStatus);
    }

    const [rawResult, finishedResult] = await Promise.all([
      rawQuery
        .order("invoice_date", { ascending: false })
        .order("created_at", { ascending: false }),
      finishedQuery
        .order("invoice_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    const rawPurchases = (rawResult.data ?? []).map(p => ({
      ...p,
      purchase_type: "raw_material" as const,
      bill_type: p.gst_type === "without_gst" ? ("kacha" as const) : ("pakka" as const),
    }));
    const finishedPurchases = (finishedResult.data ?? []).map(p => ({
      ...p,
      purchase_number: p.bill_number,
      purchase_type: "finished_goods" as const,
      bill_type: (p.bill_type === "kacha" ? "kacha" : "pakka") as "kacha" | "pakka",
    }));

    const allPurchases = tab === "raw"
      ? rawPurchases
      : tab === "finished"
      ? finishedPurchases
      : [...rawPurchases, ...finishedPurchases].sort((a, b) =>
          new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime()
        );

    const totalPurchases = allPurchases.reduce((s, p) => s + Number(p.grand_total), 0);
    const totalPaid = allPurchases.reduce((s, p) => s + Number(p.paid_amount), 0);
    const totalOutstanding = allPurchases
      .filter(p => p.payment_status !== "paid")
      .reduce((s, p) => s + Number(p.grand_total) - Number(p.paid_amount), 0);
    const avgBillValue = allPurchases.length > 0 ? totalPurchases / allPurchases.length : 0;

    const kachaPurchases = allPurchases.filter(p => p.bill_type === "kacha");
    const pakkaPurchases = allPurchases.filter(p => p.bill_type === "pakka");

    const kachaTotal = kachaPurchases.reduce((s, p) => s + Number(p.grand_total), 0);
    const pakkaTotal = pakkaPurchases.reduce((s, p) => s + Number(p.grand_total), 0);

    const kachaPaid = kachaPurchases.reduce((s, p) => s + Number(p.paid_amount), 0);
    const pakkaPaid = pakkaPurchases.reduce((s, p) => s + Number(p.paid_amount), 0);

    const kachaOutstanding = kachaPurchases
      .filter(p => p.payment_status !== "paid")
      .reduce((s, p) => s + Number(p.grand_total) - Number(p.paid_amount), 0);
    const pakkaOutstanding = pakkaPurchases
      .filter(p => p.payment_status !== "paid")
      .reduce((s, p) => s + Number(p.grand_total) - Number(p.paid_amount), 0);

    // Monthly trend
    const monthMap: Record<string, number> = {};
    for (const p of allPurchases) {
      const m = p.invoice_date.slice(0, 7);
      monthMap[m] = (monthMap[m] || 0) + Number(p.grand_total);
    }
    const monthlyTrend = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({
        month: new Date(month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
        total,
      }));

    // Top suppliers
    const supplierMap: Record<string, { id: string; name: string; total: number; bills: number }> = {};
    for (const p of allPurchases) {
      const party = p.parties as any;
      const pid = party?.id ?? "unknown";
      const pName = party?.company_name ?? party?.name ?? "Unknown";
      if (!supplierMap[pid]) supplierMap[pid] = { id: pid, name: pName, total: 0, bills: 0 };
      supplierMap[pid].total += Number(p.grand_total);
      supplierMap[pid].bills += 1;
    }
    const topSuppliers = Object.values(supplierMap).sort((a, b) => b.total - a.total).slice(0, 10);

    const bills = allPurchases.slice(0, 50).map(p => ({
      id: p.id,
      purchase_number: p.purchase_number,
      purchase_type: p.purchase_type,
      bill_type: p.bill_type,
      invoice_date: p.invoice_date,
      party: (p.parties as any)?.company_name ?? (p.parties as any)?.name ?? "—",
      grand_total: Number(p.grand_total),
      paid_amount: Number(p.paid_amount),
      outstanding: Number(p.grand_total) - Number(p.paid_amount),
      payment_status: p.payment_status,
    }));

    return NextResponse.json({
      from, to, tab, bill_type: billType ?? "all",
      summary: {
        totalPurchases,
        totalBills: allPurchases.length,
        totalPaid,
        totalOutstanding,
        avgBillValue,
        rawTotal: rawPurchases.reduce((s, p) => s + Number(p.grand_total), 0),
        finishedTotal: finishedPurchases.reduce((s, p) => s + Number(p.grand_total), 0),
        rawCount: rawPurchases.length,
        finishedCount: finishedPurchases.length,
        kachaTotal,
        pakkaTotal,
        kachaPaid,
        pakkaPaid,
        kachaOutstanding,
        pakkaOutstanding,
        kachaCount: kachaPurchases.length,
        pakkaCount: pakkaPurchases.length,
      },
      monthlyTrend,
      topSuppliers,
      bills,
    });
  } catch (err: any) {
    console.error("[reports/purchases]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
