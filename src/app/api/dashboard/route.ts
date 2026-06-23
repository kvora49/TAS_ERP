import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const startTime = Date.now();
  const supabase = createClient();

  const authStart = Date.now();
  const businessId = await getSessionBusinessId();
  const authDuration = Date.now() - authStart;

  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const dbStart = Date.now();
    // 2. Fetch Bank Balances, Brands, Godowns, and Stages in Parallel
    const [bankAccountsResult, brandsResult, godownsResult, stagesResult] = await Promise.all([
      supabase
        .from("bank_accounts")
        .select("id, name, type, upi_provider, account_number, upi_id, opening_balance, is_active")
        .eq("business_id", businessId)
        .is("deleted_at", null),
      supabase
        .from("brands")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .is("deleted_at", null),
      supabase
        .from("godowns")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .is("deleted_at", null),
      supabase
        .from("production_stages")
        .select("id, name, color")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })
    ]);
    const dbDuration = Date.now() - dbStart;

    const bankAccounts = bankAccountsResult.data;
    const stages = stagesResult.data;

    const cashInHand = bankAccounts?.reduce(
      (sum, acc) => sum + Number(acc.opening_balance || 0),
      0
    ) || 0;

    // 6. Return Aggregated Dashboard Data
    // Stubs/placeholders are populated since sales and lots are built in Phase 4 and 6.
    return NextResponse.json({
      kpis: {
        totalStockValue: { value: 1245000, change: 8.2, positive: true },
        todaySales: { value: 48500, change: 12.5, positive: true },
        thisMonthSales: { value: 685000, change: 4.1, positive: true },
        pendingDues: { value: 240000, change: 2.3, positive: false },
        cashInHand: { value: cashInHand, change: 0, positive: true },
      },
      productionDonut: stages?.map((stage) => ({
        name: stage.name,
        color: stage.color || "#6366F1",
        value: Math.floor(Math.random() * 25) + 5,
      })) || [
        { name: "Cutting", value: 12, color: "#6366F1" },
        { name: "Stitching", value: 18, color: "#10B981" },
        { name: "Washing", value: 8, color: "#F59E0B" },
        { name: "Finishing", value: 15, color: "#EF4444" },
      ],
      lowStockAlerts: [
        { name: "Cotton Thread 60s", category: "Trims", qty: "12 rolls", reorder: "30 rolls" },
        { name: "Navy Denim Fabric", category: "Fabric", qty: "140 meters", reorder: "500 meters" },
        { name: "TAS Brand Neck Labels", category: "Labels", qty: "450 pcs", reorder: "1000 pcs" },
      ],
      upcomingPayments: [
        { desc: "Supplier: Vardhman Threads", date: "28 Jun 2026", amount: 15400, type: "unpaid" },
        { desc: "PDC Cheque #492819 - HDFC", date: "02 Jul 2026", amount: 45000, type: "cheque" },
        { desc: "Job Worker: Ram Stitching", date: "05 Jul 2026", amount: 8400, type: "unpaid" },
      ],
      salesChart: [
        { date: "01 May", sales: 12000 },
        { date: "05 May", sales: 34000 },
        { date: "10 May", sales: 22000 },
        { date: "15 May", sales: 48000 },
        { date: "20 May", sales: 65000 },
        { date: "25 May", sales: 55000 },
        { date: "30 May", sales: 88000 },
      ],
      godownStock: [
        { name: "Primary Warehouse", pieces: 24500, value: 8575000 },
        { name: "Godown B - Trims Shop", pieces: 0, value: 380000 },
        { name: "Godown C - Job Work Transit", pieces: 4200, value: 1470000 },
      ],
      bankBalances: bankAccounts || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load dashboard metrics" },
      { status: 500 }
    );
  }
}
