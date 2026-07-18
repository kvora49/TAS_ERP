import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();

  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const brandId = searchParams.get("brandId") || "all";
  const dateRange = searchParams.get("dateRange") || "this_month";

  try {
    // 0. Resolve brand design IDs if a specific brand is selected
    let designIds: string[] = [];
    if (brandId !== "all") {
      const { data: brandDesigns } = await supabase
        .from("designs")
        .select("id")
        .eq("brand_id", brandId)
        .eq("business_id", businessId)
        .is("deleted_at", null);
      designIds = brandDesigns?.map((d) => d.id) || [];
    }

    // 1. Fetch Bank Balances, Brands, Godowns, and Stages in Parallel
    const bankAccountsPromise = supabase
      .from("bank_accounts")
      .select("id, name, type, upi_provider, account_number, upi_id, opening_balance, current_balance, is_active")
      .eq("business_id", businessId)
      .is("deleted_at", null);

    const stagesPromise = supabase
      .from("production_stages")
      .select("id, name, color")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });

    let finishedStockValQuery = supabase
      .from("finished_stock")
      .select("total_value")
      .eq("business_id", businessId)
      .is("deleted_at", null);
    if (brandId !== "all") {
      if (designIds.length > 0) {
        finishedStockValQuery = finishedStockValQuery.in("design_id", designIds);
      } else {
        // Force no results if brand has no designs
        finishedStockValQuery = finishedStockValQuery.eq("design_id", "00000000-0000-0000-0000-000000000000");
      }
    }

    const rawMaterialStockValQuery = supabase
      .from("raw_material_current_stock")
      .select("stock_value")
      .eq("business_id", businessId);

    const [bankAccountsResult, stagesResult, finishedStockValResult, rawMaterialStockValResult] = await Promise.all([
      bankAccountsPromise,
      stagesPromise,
      finishedStockValQuery,
      rawMaterialStockValQuery
    ]);

    const bankAccounts = bankAccountsResult.data || [];
    const stages = stagesResult.data || [];

    // Calculate Cash In Hand summing current_balance
    const cashInHand = bankAccounts.reduce(
      (sum, acc) => sum + Number(acc.current_balance || 0),
      0
    );

    // Calculate Total Stock Value
    const finishedStockVal = finishedStockValResult.data?.reduce((sum, item) => sum + Number(item.total_value || 0), 0) || 0;
    // Note: Raw material is brand-agnostic, we only include it if no brand filter or as a constant fallback
    const rawMaterialStockVal = brandId === "all" ? (rawMaterialStockValResult.data?.reduce((sum, item) => sum + Number(item.stock_value || 0), 0) || 0) : 0;
    const totalStockValue = finishedStockVal + rawMaterialStockVal;

    // Calculate Date Boundaries
    const now = new Date();
    let startDateStr = "";
    let endDateStr = "";

    if (dateRange === "today") {
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      startDateStr = todayStart.toISOString().split("T")[0];
      endDateStr = startDateStr;
    } else if (dateRange === "this_week") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(now);
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);
      startDateStr = startOfWeek.toISOString().split("T")[0];
    } else if (dateRange === "this_month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startDateStr = startOfMonth.toISOString().split("T")[0];
    } else if (dateRange === "last_month") {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      startDateStr = startOfLastMonth.toISOString().split("T")[0];
      endDateStr = endOfLastMonth.toISOString().split("T")[0];
    } else if (dateRange === "this_year") {
      const currentYear = now.getFullYear();
      const fiscalStartMonth = 3; // April
      let fiscalYearStart;
      if (now.getMonth() >= fiscalStartMonth) {
        fiscalYearStart = new Date(currentYear, fiscalStartMonth, 1);
      } else {
        fiscalYearStart = new Date(currentYear - 1, fiscalStartMonth, 1);
      }
      startDateStr = fiscalYearStart.toISOString().split("T")[0];
    }

    // Fetch Today's Sales specifically
    const todayStr = now.toISOString().split("T")[0];
    let todaySalesQuery = supabase
      .from("sale_bills")
      .select("grand_total")
      .eq("business_id", businessId)
      .eq("bill_date", todayStr)
      .neq("status", "cancelled")
      .is("deleted_at", null);
    if (brandId !== "all") {
      todaySalesQuery = todaySalesQuery.contains("brand_ids", [brandId]);
    }
    const { data: todaySalesBills } = await todaySalesQuery;
    const todaySales = todaySalesBills?.reduce((sum, b) => sum + Number(b.grand_total || 0), 0) || 0;

    // Fetch Period Sales
    let periodSalesQuery = supabase
      .from("sale_bills")
      .select("grand_total, paid_amount, payment_status, bill_date")
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .is("deleted_at", null);

    if (startDateStr) {
      periodSalesQuery = periodSalesQuery.gte("bill_date", startDateStr);
    }
    if (endDateStr) {
      periodSalesQuery = periodSalesQuery.lte("bill_date", endDateStr);
    }
    if (brandId !== "all") {
      periodSalesQuery = periodSalesQuery.contains("brand_ids", [brandId]);
    }

    const { data: periodSalesBills } = await periodSalesQuery;
    const periodSalesTotal = periodSalesBills?.reduce((sum, b) => sum + Number(b.grand_total || 0), 0) || 0;

    // Calculate Pending Dues
    let unpaidBillsQuery = supabase
      .from("sale_bills")
      .select("grand_total, paid_amount")
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .neq("payment_status", "paid")
      .is("deleted_at", null);
    if (brandId !== "all") {
      unpaidBillsQuery = unpaidBillsQuery.contains("brand_ids", [brandId]);
    }
    const { data: unpaidBills } = await unpaidBillsQuery;

    const pendingDues = unpaidBills?.reduce((sum, b) => sum + (Number(b.grand_total || 0) - Number(b.paid_amount || 0)), 0) || 0;

    // Fetch Low Stock Alerts (Unfiltered by brand as materials don't map to brands)
    const { data: lowStock } = await supabase
      .from("raw_material_current_stock")
      .select("current_stock, material_type:raw_material_types(name, category, unit, reorder_level)")
      .eq("business_id", businessId);

    const lowStockAlerts = (lowStock || [])
      .filter((s: any) => {
        const current = Number(s.current_stock || 0);
        const reorder = Number(s.material_type?.reorder_level || 0);
        return current < reorder;
      })
      .map((s: any) => ({
        name: s.material_type?.name || "Unknown",
        category: s.material_type?.category || "Unknown",
        qty: `${s.current_stock} ${s.material_type?.unit || ""}`.trim(),
        reorder: `${s.material_type?.reorder_level || 0} ${s.material_type?.unit || ""}`.trim(),
      }))
      .slice(0, 5);

    // Fetch Upcoming Payments (Unfiltered by brand)
    const [chequesResult, purchaseBillsResult] = await Promise.all([
      supabase
        .from("cheques")
        .select("cheque_number, bank_name, due_date, amount")
        .eq("business_id", businessId)
        .eq("direction", "issued")
        .in("status", ["pending", "deposited"]),
      supabase
        .from("purchase_bills")
        .select("grand_total, paid_amount, invoice_date, supplier:parties(name)")
        .eq("business_id", businessId)
        .neq("status", "cancelled")
        .neq("payment_status", "paid")
    ]);

    const formattedCheques = (chequesResult.data || []).map(c => ({
      desc: `PDC Cheque #${c.cheque_number} - ${c.bank_name}`,
      date: c.due_date ? new Date(c.due_date).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }) : "N/A",
      amount: Number(c.amount || 0),
      type: "cheque"
    }));

    const formattedPurchases = (purchaseBillsResult.data || []).map(p => ({
      desc: `Supplier: ${(p.supplier as any)?.name || "Unknown"}`,
      date: p.invoice_date ? new Date(p.invoice_date).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }) : "N/A",
      amount: Number(p.grand_total || 0) - Number(p.paid_amount || 0),
      type: "unpaid"
    }));

    const upcomingPayments = [...formattedCheques, ...formattedPurchases]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);

    // Query production lots counts grouped by status
    let lotsQuery = supabase
      .from("production_lots")
      .select("status")
      .eq("business_id", businessId)
      .is("deleted_at", null);
    if (brandId !== "all") {
      lotsQuery = lotsQuery.eq("brand_id", brandId);
    }
    const { data: lots } = await lotsQuery;

    const lotCounts = {
      draft: 0,
      in_progress: 0,
      completed: 0,
      on_hold: 0,
      cancelled: 0,
    };

    lots?.forEach((lot: any) => {
      if (lot.status in lotCounts) {
        lotCounts[lot.status as keyof typeof lotCounts]++;
      }
    });

    const statusColors: Record<string, string> = {
      draft: "#94A3B8",
      in_progress: "#6366F1",
      completed: "#10B981",
      on_hold: "#F59E0B",
      cancelled: "#EF4444",
    };

    const statusNames: Record<string, string> = {
      draft: "Draft",
      in_progress: "In Progress",
      completed: "Completed",
      on_hold: "On Hold",
      cancelled: "Cancelled",
    };

    const productionDonut = Object.entries(lotCounts)
      .map(([status, count]) => ({
        name: statusNames[status],
        value: count,
        color: statusColors[status],
      }))
      .filter(item => item.value > 0);

    // Dynamic Sales Chart data matching dateRange / last 30 days
    const chartStartDate = new Date();
    if (dateRange === "this_year") {
      chartStartDate.setMonth(chartStartDate.getMonth() - 12);
    } else if (dateRange === "last_month") {
      chartStartDate.setMonth(chartStartDate.getMonth() - 2);
    } else {
      chartStartDate.setDate(chartStartDate.getDate() - 30);
    }
    const chartStartDateStr = chartStartDate.toISOString().split("T")[0];

    let chartSalesQuery = supabase
      .from("sale_bills")
      .select("bill_date, grand_total")
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .is("deleted_at", null)
      .gte("bill_date", chartStartDateStr);

    if (brandId !== "all") {
      chartSalesQuery = chartSalesQuery.contains("brand_ids", [brandId]);
    }
    const { data: chartSales } = await chartSalesQuery;

    const salesGrouped: Record<string, number> = {};
    for (let i = 29; i >= 0; i -= 5) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString("en-US", { day: "2-digit", month: "short" });
      salesGrouped[dateStr] = 0;
    }

    chartSales?.forEach(bill => {
      const d = new Date(bill.bill_date);
      let closestStr = Object.keys(salesGrouped)[0];
      let minDiff = Infinity;
      Object.keys(salesGrouped).forEach(key => {
        const keyDate = new Date(key + " " + new Date().getFullYear());
        const diff = Math.abs(d.getTime() - keyDate.getTime());
        if (diff < minDiff) {
          minDiff = diff;
          closestStr = key;
        }
      });
      salesGrouped[closestStr] += Number(bill.grand_total || 0);
    });

    const salesChart = Object.entries(salesGrouped)
      .map(([date, sales]) => ({ date, sales }))
      .sort((a, b) => new Date(a.date + " " + new Date().getFullYear()).getTime() - new Date(b.date + " " + new Date().getFullYear()).getTime());

    // Godown Stocks
    const godownsQuery = supabase
      .from("godowns")
      .select("id, name")
      .eq("business_id", businessId)
      .is("deleted_at", null);

    let finishedStockQuery = supabase
      .from("finished_stock")
      .select("godown_id, total_quantity, total_value")
      .eq("business_id", businessId)
      .is("deleted_at", null);
    if (brandId !== "all") {
      if (designIds.length > 0) {
        finishedStockQuery = finishedStockQuery.in("design_id", designIds);
      } else {
        finishedStockQuery = finishedStockQuery.eq("design_id", "00000000-0000-0000-0000-000000000000");
      }
    }

    const rawStockQuery = supabase
      .from("raw_material_current_stock")
      .select("godown_id, current_stock, stock_value")
      .eq("business_id", businessId);

    const [godownsResult, finishedStockResult, rawStockResult] = await Promise.all([
      godownsQuery,
      finishedStockQuery,
      rawStockQuery
    ]);

    const godownStockMap: Record<string, { name: string, pieces: number, value: number }> = {};
    godownsResult.data?.forEach(g => {
      godownStockMap[g.id] = { name: g.name, pieces: 0, value: 0 };
    });

    finishedStockResult.data?.forEach(item => {
      if (godownStockMap[item.godown_id]) {
        godownStockMap[item.godown_id].pieces += Number(item.total_quantity || 0);
        godownStockMap[item.godown_id].value += Number(item.total_value || 0);
      }
    });

    // Only add raw material stock to godown totals if filtering for "all" brands
    if (brandId === "all") {
      rawStockResult.data?.forEach(item => {
        if (godownStockMap[item.godown_id]) {
          godownStockMap[item.godown_id].pieces += Number(item.current_stock || 0);
          godownStockMap[item.godown_id].value += Number(item.stock_value || 0);
        }
      });
    }

    const godownStock = Object.values(godownStockMap);

    return NextResponse.json({
      kpis: {
        totalStockValue: { value: totalStockValue, change: 0, positive: true },
        todaySales: { value: todaySales, change: 0, positive: true },
        thisMonthSales: { value: periodSalesTotal, change: 0, positive: true },
        pendingDues: { value: pendingDues, change: 0, positive: false },
        cashInHand: { value: cashInHand, change: 0, positive: true },
      },
      productionDonut,
      lowStockAlerts,
      upcomingPayments,
      salesChart,
      godownStock,
      bankBalances: bankAccounts,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load dashboard metrics" },
      { status: 500 }
    );
  }
}
