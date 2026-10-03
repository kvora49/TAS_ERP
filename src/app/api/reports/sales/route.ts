import { readLaterAllocations } from "@/lib/report-later-allocations";
import { readReportRows, requireReportResults } from "@/lib/report-data";
import { paidAtCutoff, dueDateAging } from "@/lib/report-balances";
import { validReportRequest } from "@/lib/report-request";
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
  if (!validReportRequest(searchParams)) return NextResponse.json({ error: "Invalid report filters" }, { status: 400 });
  const from = searchParams.get("from") ?? defaultFrom;
  const to = searchParams.get("to") ?? today.toISOString().split("T")[0];
  const billType = searchParams.get("bill_type");
  const partyId = searchParams.get("party_id");
  const paymentStatus = searchParams.get("payment_status");
  const designId = searchParams.get("design_id");
  const brandId = searchParams.get("brand_id"); // global header brand filter
  const bid = businessId;

  try {
    // ── 1. Parallel fetch: bills + returns + payments ──────────────────────────
    let billsQuery = supabase
      .from("sale_bills")
      .select(`
        id, bill_number, bill_type, bill_date, grand_total, taxable_amount,
        cgst, sgst, igst, payment_status, paid_amount, status, due_date,
        parties(id, name, company_name)
      `)
      .eq("business_id", bid)
      .eq("status", "active")
      .is("deleted_at", null)
      .gte("bill_date", from)
      .lte("bill_date", to)
      .order("bill_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (billType && (billType === "kacha" || billType === "pakka")) {
      billsQuery = billsQuery.eq("bill_type", billType);
    }
    if (partyId && partyId !== "all") {
      billsQuery = billsQuery.eq("party_id", partyId);
    }

    const itemScope = (brandId && brandId !== "all") || (designId && designId !== "all");
    let itemQuery = supabase.from("sale_bill_items").select("id,bill_id,design:designs!inner(brand_id),bill:sale_bills!inner(business_id)").eq("bill.business_id", bid);
    if (brandId && brandId !== "all") itemQuery = itemQuery.eq("design.brand_id", brandId);
    if (designId && designId !== "all") itemQuery = itemQuery.eq("design_id", designId);

    const [billsResult, returnsResult, paymentsResult, agingResult, allocationsResult, brandResult] = await Promise.all([
      readReportRows(billsQuery.order("id")),
      readReportRows(supabase
        .from("sales_returns")
        .select("id, return_number, return_date, grand_total, status, party_id, original_bill_id, parties(id, name, company_name)")
        .eq("business_id", bid)
        .gte("return_date", from)
        .lte("return_date", to)
        .eq("status", "approved").order("id")),
      readReportRows(supabase
        .from("payments")
        .select("id, party_id, payment_date, payment_mode, amount, direction")
        .eq("business_id", bid)
        .eq("direction", "received")
        .gte("payment_date", from)
        .lte("payment_date", to).in("status", ["completed", "success"]).order("id")),
      readReportRows(supabase.from("sale_bills").select("id,bill_type,bill_date,due_date,grand_total,paid_amount,party_id,status,payment_status").eq("business_id", bid).eq("status", "active").is("deleted_at", null).lte("bill_date", to).order("id")),
      readLaterAllocations(supabase, bid, to).then(data => ({ data, error: null })),
      itemScope ? readReportRows(itemQuery.order("id")) : Promise.resolve({ data: [], error: null }),
    ]);

    requireReportResults([billsResult, returnsResult, paymentsResult, agingResult, allocationsResult, brandResult]);
    const brandBills = new Set(brandResult.data.map((r: any) => r.bill_id));
    const scope = (row: any) => (!billType || billType === "all" || row.bill_type === billType) && (!partyId || partyId === "all" || row.party_id === partyId) && (!itemScope || brandBills.has(row.id));
    const agingBills = paidAtCutoff(agingResult.data, allocationsResult.data, "sale_bill").filter(scope);
    const invoiceIds = new Set(agingBills.map(row => row.id));
    const allBills = paidAtCutoff(billsResult.data, allocationsResult.data, "sale_bill").filter(row => (!itemScope || brandBills.has(row.id)) && (!paymentStatus || paymentStatus === "all" || row.payment_status === paymentStatus || (paymentStatus === "partially_paid" && row.payment_status === "partial")));
    const allReturns = returnsResult.data.filter((row: any) => (!partyId || partyId === "all" || row.party_id === partyId) && ((!billType || billType === "all") && !itemScope || invoiceIds.has(row.original_bill_id)));
    const allPayments = paymentsResult.data.filter((row: any) => !partyId || partyId === "all" || row.party_id === partyId);

    // ── 2. KPI Calculations ───────────────────────────────────────────────────
    const grossSales = allBills.reduce((s, b) => s + Number(b.grand_total), 0);
    const totalGST = allBills.reduce((s, b) => s + Number(b.cgst || 0) + Number(b.sgst || 0) + Number(b.igst || 0), 0);
    const taxableRevenue = allBills.reduce((s, b) => s + Number(b.taxable_amount || 0), 0);
    const totalReturns = allReturns.reduce((s, r) => s + Number(r.grand_total || 0), 0);
    const netSales = grossSales - totalReturns;
    const totalBills = allBills.length;
    const totalOutstanding = allBills
      .filter(b => b.payment_status !== "paid")
      .reduce((s, b) => s + Number(b.grand_total) - Number(b.paid_amount), 0);
    const totalPaid = allBills.reduce((s, b) => s + Number(b.paid_amount), 0);
    const kachaRevenue = allBills.filter(b => b.bill_type === "kacha").reduce((s, b) => s + Number(b.grand_total), 0);
    const pakkaRevenue = allBills.filter(b => b.bill_type === "pakka").reduce((s, b) => s + Number(b.grand_total), 0);
    const kachaPaid = allBills.filter(b => b.bill_type === "kacha").reduce((s, b) => s + Number(b.paid_amount), 0);
    const pakkaPaid = allBills.filter(b => b.bill_type === "pakka").reduce((s, b) => s + Number(b.paid_amount), 0);
    const kachaOutstanding = allBills
      .filter(b => b.bill_type === "kacha" && b.payment_status !== "paid")
      .reduce((s, b) => s + Number(b.grand_total) - Number(b.paid_amount), 0);
    const pakkaOutstanding = allBills
      .filter(b => b.bill_type === "pakka" && b.payment_status !== "paid")
      .reduce((s, b) => s + Number(b.grand_total) - Number(b.paid_amount), 0);

    // ── 3. Ageing Buckets ─────────────────────────────────────────────────────
    const ageing = dueDateAging(agingBills, to, "bill_date");

    // ── 4. Monthly Trend ──────────────────────────────────────────────────────
    const monthMap: Record<string, { sales: number; returns: number }> = {};
    for (const b of allBills) {
      const m = b.bill_date.slice(0, 7);
      if (!monthMap[m]) monthMap[m] = { sales: 0, returns: 0 };
      monthMap[m].sales += Number(b.grand_total);
    }
    for (const r of allReturns) {
      const m = r.return_date.slice(0, 7);
      if (!monthMap[m]) monthMap[m] = { sales: 0, returns: 0 };
      monthMap[m].returns += Number(r.grand_total || 0);
    }
    const monthlyTrend = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, vals]) => ({
        month: new Date(month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
        total: vals.sales,
        returns: vals.returns,
        net: vals.sales - vals.returns,
        rawMonth: month,
      }));

    // ── 5. Top Parties ────────────────────────────────────────────────────────
    const partyMap: Record<string, { id: string; name: string; total: number; bills: number; outstanding: number }> = {};
    for (const b of allBills) {
      const p = b.parties as any;
      const pId = p?.id ?? "unknown";
      const pName = p?.company_name ?? p?.name ?? "Unknown";
      if (!partyMap[pId]) partyMap[pId] = { id: pId, name: pName, total: 0, bills: 0, outstanding: 0 };
      partyMap[pId].total += Number(b.grand_total);
      partyMap[pId].bills += 1;
      if (b.payment_status !== "paid") {
        partyMap[pId].outstanding += Number(b.grand_total) - Number(b.paid_amount);
      }
    }
    const topParties = Object.values(partyMap).sort((a, b) => b.total - a.total).slice(0, 10);

    // ── 6. Payment Mode Summary ───────────────────────────────────────────────
    const modeMap: Record<string, number> = {};
    for (const p of allPayments) {
      modeMap[p.payment_mode] = (modeMap[p.payment_mode] || 0) + Number(p.amount);
    }
    const paymentModeSummary = Object.entries(modeMap)
      .map(([mode, amount]) => ({
        mode: mode.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);

    // ── 7. Quick Insights ─────────────────────────────────────────────────────
    const salesByDay: Record<string, number> = {};
    for (const b of allBills) {
      salesByDay[b.bill_date] = (salesByDay[b.bill_date] || 0) + Number(b.grand_total);
    }
    const bestDayEntry = Object.entries(salesByDay).sort(([, a], [, b]) => b - a)[0];
    const topParty = topParties[0];
    const quickInsights = {
      bestDay: bestDayEntry ? { date: bestDayEntry[0], amount: bestDayEntry[1] } : null,
      topCustomer: topParty ? { name: topParty.name, amount: topParty.total } : null,
      avgBillValue: totalBills > 0 ? grossSales / totalBills : 0,
      collectionRate: grossSales > 0 ? Math.round((totalPaid / grossSales) * 100) : 0,
    };

    // ── 8. Bill Register rows ─────────────────────────────────────────────────
    const billRows = allBills.map(b => ({
      id: b.id,
      bill_number: b.bill_number,
      bill_type: b.bill_type,
      bill_date: b.bill_date,
      due_date: b.due_date,
      party: (b.parties as any)?.company_name ?? (b.parties as any)?.name ?? "-",
      party_id: (b.parties as any)?.id,
      taxable_amount: Number(b.taxable_amount || 0),
      cgst: Number(b.cgst || 0),
      sgst: Number(b.sgst || 0),
      igst: Number(b.igst || 0),
      total_gst: Number(b.cgst || 0) + Number(b.sgst || 0) + Number(b.igst || 0),
      grand_total: Number(b.grand_total),
      paid_amount: Number(b.paid_amount),
      outstanding: Number(b.grand_total) - Number(b.paid_amount),
      payment_status: b.payment_status,
      view_url: `/sales/${b.id}`,
    }));

    const returnRows = allReturns.map(r => ({
      id: r.id,
      return_number: r.return_number,
      return_date: r.return_date,
      party: (r.parties as any)?.company_name ?? (r.parties as any)?.name ?? "-",
      party_id: (r.parties as any)?.id,
      grand_total: Number(r.grand_total || 0),
      status: r.status,
      view_url: `/sales/returns/${r.id}`,
    }));

    const statusBreakdown = allBills.reduce<Record<string, number>>((acc, b) => {
      acc[b.payment_status] = (acc[b.payment_status] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      from,
      to,
      bill_type: billType ?? "all",
      summary: {
        grossSales,
        netSales,
        taxableRevenue,
        totalGST,
        totalReturns,
        totalBills,
        returnCount: allReturns.length,
        totalOutstanding,
        totalPaid,
        avgBillValue: totalBills > 0 ? grossSales / totalBills : 0,
        collectionRate: grossSales > 0 ? Math.round((totalPaid / grossSales) * 100) : 0,
        kachaRevenue, pakkaRevenue,
        kachaPaid, pakkaPaid,
        kachaOutstanding, pakkaOutstanding,
        kachaBills: allBills.filter(b => b.bill_type === "kacha").length,
        pakkaBills: allBills.filter(b => b.bill_type === "pakka").length,
        totalRevenue: grossSales, // legacy alias
      },

      ageing,
      metadata: { agingBasis: "All outstanding invoices at cutoff, by due date", paymentBasis: "Posted receipts in period, filtered by party; brand/bill-type attribution requires allocation detail", historicalBasis: "Current paid totals less known later unified allocations" },
      monthlyTrend,
      topParties,
      paymentModeSummary,
      statusBreakdown,
      bills: billRows,
      returns: returnRows,
      quickInsights,
    });
  } catch (err: any) {
    console.error("[reports/sales]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
