import { NextRequest, NextResponse } from "next/server";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const defaultFrom = `${fyStartYear}-04-01`;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? defaultFrom;
  const to = searchParams.get("to") ?? today.toISOString().split("T")[0];
  const tab = searchParams.get("tab") ?? "all";
  const billType = searchParams.get("bill_type");
  const partyId = searchParams.get("party_id");   // supplier UUID
  const paymentStatus = searchParams.get("payment_status");
  const brandId = searchParams.get("brand_id");   // global header brand filter
  const bid = businessId;

  try {
    // ── Build queries ─────────────────────────────────────────────────────────
    let rawQuery = supabase
      .from("raw_material_purchases")
      .select(`
        id, purchase_number, invoice_date, grand_total, paid_amount,
        payment_status, status, gst_type,
        supplier:parties(id, name, company_name)
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
        supplier:parties(id, name, company_name)
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
    // FIX: use supplier_id (not party_id) — raw_material_purchases FK is supplier_id
    if (partyId && partyId !== "all") {
      rawQuery = rawQuery.eq("supplier_id", partyId);
      finishedQuery = finishedQuery.eq("supplier_id", partyId);
    }
    if (paymentStatus && paymentStatus !== "all") {
      rawQuery = rawQuery.eq("payment_status", paymentStatus);
      finishedQuery = finishedQuery.eq("payment_status", paymentStatus);
    }

    // ── Parallel fetch ────────────────────────────────────────────────────────
    const [rawResult, finishedResult, returnsResult, paymentsResult] = await Promise.all([
      rawQuery.order("invoice_date", { ascending: false }).order("created_at", { ascending: false }),
      finishedQuery.order("invoice_date", { ascending: false }).order("created_at", { ascending: false }),
      // Purchase returns (all RM returns in date range)
      supabase
        .from("purchase_returns")
        .select("id, return_number, return_date, grand_total, return_type, supplier_id, parties(id, name, company_name)")
        .eq("business_id", bid)
        .neq("status", "cancelled")
        .is("deleted_at", null)
        .gte("return_date", from)
        .lte("return_date", to),
      // Outgoing payments
      supabase
        .from("payments")
        .select("id, payment_date, payment_mode, amount, direction")
        .eq("business_id", bid)
        .eq("direction", "paid")
        .gte("payment_date", from)
        .lte("payment_date", to),
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

    // ── Category breakdown — FIX: use IN clause on actual purchase IDs ─────────
    // Only meaningful for raw_material purchases (they have item_type on items)
    const rmIds = rawPurchases.map(p => p.id);
    let categoryBreakdown: { category: string; key: string; amount: number }[] = [];

    if (rmIds.length > 0) {
      const { data: itemsData } = await supabase
        .from("raw_material_purchase_items")
        .select("purchase_id, item_type, total_amount")
        .in("purchase_id", rmIds);

      const categoryMap: Record<string, number> = {
        fabric: 0,
        accessory: 0,
        finished_goods: 0,
        others: 0,
      };
      for (const item of itemsData ?? []) {
        const t = item.item_type || "others";
        if (t in categoryMap) {
          categoryMap[t] += Number(item.total_amount || 0);
        } else {
          categoryMap.others += Number(item.total_amount || 0);
        }
      }
      categoryBreakdown = [
        { category: "Raw Material / Fabric", key: "fabric", amount: categoryMap.fabric },
        { category: "Accessories & Trims", key: "accessory", amount: categoryMap.accessory },
        { category: "Finished Goods", key: "finished_goods", amount: categoryMap.finished_goods },
        { category: "Others", key: "others", amount: categoryMap.others },
      ].filter(c => c.amount > 0);
    }

    // ── Summary KPIs ──────────────────────────────────────────────────────────
    const totalPurchases = allPurchases.reduce((s, p) => s + Number(p.grand_total), 0);
    const totalPaid = allPurchases.reduce((s, p) => s + Number(p.paid_amount), 0);
    const totalOutstanding = allPurchases
      .filter(p => p.payment_status !== "paid")
      .reduce((s, p) => s + Number(p.grand_total) - Number(p.paid_amount), 0);
    const avgBillValue = allPurchases.length > 0 ? totalPurchases / allPurchases.length : 0;
    const totalReturns = (returnsResult.data ?? []).reduce((s, r) => s + Number(r.grand_total || 0), 0);

    const kachaPurchases = allPurchases.filter(p => p.bill_type === "kacha");
    const pakkaPurchases = allPurchases.filter(p => p.bill_type === "pakka");
    const kachaTotal = kachaPurchases.reduce((s, p) => s + Number(p.grand_total), 0);
    const pakkaTotal = pakkaPurchases.reduce((s, p) => s + Number(p.grand_total), 0);
    const kachaPaid = kachaPurchases.reduce((s, p) => s + Number(p.paid_amount), 0);
    const pakkaPaid = pakkaPurchases.reduce((s, p) => s + Number(p.paid_amount), 0);
    const kachaOutstanding = kachaPurchases.filter(p => p.payment_status !== "paid").reduce((s, p) => s + Number(p.grand_total) - Number(p.paid_amount), 0);
    const pakkaOutstanding = pakkaPurchases.filter(p => p.payment_status !== "paid").reduce((s, p) => s + Number(p.grand_total) - Number(p.paid_amount), 0);

    // ── Ageing buckets (payables) ─────────────────────────────────────────────
    const todayMs = new Date().getTime();
    const ageing = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0 };
    for (const p of allPurchases.filter(p => p.payment_status !== "paid")) {
      const outstanding = Number(p.grand_total) - Number(p.paid_amount);
      const dueDate = new Date(p.invoice_date);
      const diffDays = Math.floor((todayMs - dueDate.getTime()) / 86_400_000);
      if (diffDays <= 0) ageing.current += outstanding;
      else if (diffDays <= 30) ageing.d30 += outstanding;
      else if (diffDays <= 60) ageing.d60 += outstanding;
      else if (diffDays <= 90) ageing.d90 += outstanding;
      else ageing.over90 += outstanding;
    }

    // ── Monthly trend ─────────────────────────────────────────────────────────
    const monthMap: Record<string, { purchases: number; returns: number }> = {};
    for (const p of allPurchases) {
      const m = p.invoice_date.slice(0, 7);
      if (!monthMap[m]) monthMap[m] = { purchases: 0, returns: 0 };
      monthMap[m].purchases += Number(p.grand_total);
    }
    for (const r of returnsResult.data ?? []) {
      const m = r.return_date.slice(0, 7);
      if (!monthMap[m]) monthMap[m] = { purchases: 0, returns: 0 };
      monthMap[m].returns += Number(r.grand_total || 0);
    }
    const monthlyTrend = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, vals]) => ({
        month: new Date(month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
        total: vals.purchases,
        returns: vals.returns,
        net: vals.purchases - vals.returns,
      }));

    // ── Top suppliers ─────────────────────────────────────────────────────────
    const supplierMap: Record<string, { id: string; name: string; total: number; bills: number; outstanding: number }> = {};
    for (const p of allPurchases) {
      const party = p.supplier as any;
      const pid = party?.id ?? "unknown";
      const pName = party?.company_name ?? party?.name ?? "Unknown";
      if (!supplierMap[pid]) supplierMap[pid] = { id: pid, name: pName, total: 0, bills: 0, outstanding: 0 };
      supplierMap[pid].total += Number(p.grand_total);
      supplierMap[pid].bills += 1;
      if (p.payment_status !== "paid") {
        supplierMap[pid].outstanding += Number(p.grand_total) - Number(p.paid_amount);
      }
    }
    const topSuppliers = Object.values(supplierMap).sort((a, b) => b.total - a.total).slice(0, 10);

    // ── Payment mode summary ──────────────────────────────────────────────────
    const modeMap: Record<string, number> = {};
    for (const p of paymentsResult.data ?? []) {
      modeMap[p.payment_mode] = (modeMap[p.payment_mode] || 0) + Number(p.amount);
    }
    const paymentModeSummary = Object.entries(modeMap)
      .map(([mode, amount]) => ({
        mode: mode.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);

    // ── Bill rows — include view_url for navigation ───────────────────────────
    const bills = allPurchases.map(p => ({
      id: p.id,
      purchase_number: (p as any).purchase_number,
      purchase_type: p.purchase_type,
      bill_type: p.bill_type,
      invoice_date: p.invoice_date,
      party: (p.supplier as any)?.company_name ?? (p.supplier as any)?.name ?? "-",
      party_id: (p.supplier as any)?.id,
      grand_total: Number(p.grand_total),
      paid_amount: Number(p.paid_amount),
      outstanding: Number(p.grand_total) - Number(p.paid_amount),
      payment_status: p.payment_status,
      view_url: p.purchase_type === "raw_material"
        ? `/raw-materials/purchases/${p.id}`
        : `/purchases/${p.id}`,
    }));

    // ── Return rows — include view_url ────────────────────────────────────────
    const returnRows = (returnsResult.data ?? []).map(r => ({
      id: r.id,
      return_number: r.return_number,
      return_date: r.return_date,
      return_type: r.return_type,
      party: (r.parties as any)?.company_name ?? (r.parties as any)?.name ?? "-",
      party_id: (r.parties as any)?.id,
      grand_total: Number(r.grand_total || 0),
      view_url: `/raw-materials/purchase-returns/${r.id}`,
    }));

    return NextResponse.json({
      from, to, tab, bill_type: billType ?? "all",
      summary: {
        totalPurchases,
        totalBills: allPurchases.length,
        totalPaid,
        totalOutstanding,
        avgBillValue,
        totalReturns,
        returnCount: (returnsResult.data ?? []).length,
        netPurchases: totalPurchases - totalReturns,
        rawTotal: rawPurchases.reduce((s, p) => s + Number(p.grand_total), 0),
        finishedTotal: finishedPurchases.reduce((s, p) => s + Number(p.grand_total), 0),
        rawCount: rawPurchases.length,
        finishedCount: finishedPurchases.length,
        kachaTotal, pakkaTotal,
        kachaPaid, pakkaPaid,
        kachaOutstanding, pakkaOutstanding,
        kachaCount: kachaPurchases.length,
        pakkaCount: pakkaPurchases.length,
      },
      ageing,
      categoryBreakdown,
      monthlyTrend,
      topSuppliers,
      paymentModeSummary,
      bills,
      returns: returnRows,
    });
  } catch (err: any) {
    console.error("[reports/purchases]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
