import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();

  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawBrandId = searchParams.get("brandId") || searchParams.get("brand_id");
  let brandId =
    !rawBrandId ||
    rawBrandId === "all" ||
    rawBrandId === "undefined" ||
    rawBrandId === "null" ||
    rawBrandId.trim() === ""
      ? "all"
      : rawBrandId.trim();

  const dateRange = searchParams.get("dateRange") || "this_month";
  const billType = searchParams.get("billType") || searchParams.get("bill_type") || "all";

  try {
    // 1. Verify Brand ID existence for this business
    let designIds: string[] = [];
    if (brandId !== "all") {
      const { data: brandRow } = await supabase
        .from("brands")
        .select("id")
        .eq("id", brandId)
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .maybeSingle();

      if (!brandRow) {
        brandId = "all";
      } else {
        const { data: brandDesigns } = await supabase
          .from("designs")
          .select("id")
          .eq("brand_id", brandId)
          .eq("business_id", businessId)
          .is("deleted_at", null);
        designIds = (brandDesigns || []).map((d) => d.id);
      }
    }

    // 2. Compute Local Date Boundaries
    const now = new Date();
    const todayStr = toLocalDateStr(now);
    let startDateStr = "";
    let endDateStr = todayStr;

    if (dateRange === "today") {
      startDateStr = todayStr;
      endDateStr = todayStr;
    } else if (dateRange === "this_week") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diff);
      startDateStr = toLocalDateStr(startOfWeek);
    } else if (dateRange === "this_month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startDateStr = toLocalDateStr(startOfMonth);
    } else if (dateRange === "last_month") {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      startDateStr = toLocalDateStr(startOfLastMonth);
      endDateStr = toLocalDateStr(endOfLastMonth);
    } else if (dateRange === "this_quarter") {
      const currentMonth = now.getMonth();
      const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
      const startOfQuarter = new Date(now.getFullYear(), quarterStartMonth, 1);
      startDateStr = toLocalDateStr(startOfQuarter);
    } else if (dateRange === "this_year") {
      const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const fiscalYearStart = new Date(startYear, 3, 1);
      startDateStr = toLocalDateStr(fiscalYearStart);
    }

    // Chart Start Date
    let chartStartDate = new Date(now);
    if (dateRange === "this_year") {
      const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      chartStartDate = new Date(startYear, 3, 1);
    } else if (dateRange === "last_month") {
      chartStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    } else if (dateRange === "this_month") {
      chartStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (dateRange === "this_week") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      chartStartDate = new Date(now.getFullYear(), now.getMonth(), diff);
    } else {
      chartStartDate.setDate(chartStartDate.getDate() - 30);
    }
    const chartStartDateStr = toLocalDateStr(chartStartDate);

    // 3. Build Parallel Queries
    const bankAccountsPromise = supabase
      .from("bank_accounts")
      .select("id, name, type, bank_name, upi_provider, account_number, upi_id, opening_balance, current_balance, is_active")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    const stagesPromise = supabase
      .from("production_stages")
      .select("id, name, color, sort_order")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });

    let lotsPromise = supabase
      .from("production_lots")
      .select("id, status, current_stage_id, brand_id, stage:production_stages(id, name, color)")
      .eq("business_id", businessId)
      .is("deleted_at", null);
    if (brandId !== "all") {
      lotsPromise = lotsPromise.eq("brand_id", brandId);
    }

    let finishedStockPromise = supabase
      .from("finished_stock")
      .select("godown_id, design_id, total_quantity, total_value, cost_per_piece, design:designs(sale_price, brand_id)")
      .eq("business_id", businessId)
      .is("deleted_at", null);
    if (brandId !== "all") {
      if (designIds.length > 0) {
        finishedStockPromise = finishedStockPromise.in("design_id", designIds);
      } else {
        finishedStockPromise = finishedStockPromise.eq("design_id", "00000000-0000-0000-0000-000000000000");
      }
    }

    const rawMaterialStockPromise = supabase
      .from("raw_material_current_stock")
      .select("godown_id, current_stock, stock_value, unit_cost, material_type:raw_material_types(name, category, unit, reorder_level)")
      .eq("business_id", businessId);

    const godownsPromise = supabase
      .from("godowns")
      .select("id, name")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    // Sales Queries
    let todaySalesQuery = supabase
      .from("sale_bills")
      .select("grand_total, brand_ids")
      .eq("business_id", businessId)
      .eq("bill_date", todayStr)
      .neq("status", "cancelled")
      .is("deleted_at", null);
    if (brandId !== "all") {
      todaySalesQuery = todaySalesQuery.contains("brand_ids", [brandId]);
    }
    if (billType && billType !== "all") {
      todaySalesQuery = todaySalesQuery.eq("bill_type", billType);
    }

    let periodSalesQuery = supabase
      .from("sale_bills")
      .select("grand_total, paid_amount, payment_status, bill_date, brand_ids")
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
    if (billType && billType !== "all") {
      periodSalesQuery = periodSalesQuery.eq("bill_type", billType);
    }

    let unpaidBillsQuery = supabase
      .from("sale_bills")
      .select("grand_total, paid_amount, bill_number, remarks, brand_ids")
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .neq("payment_status", "paid")
      .is("deleted_at", null);
    if (brandId !== "all") {
      unpaidBillsQuery = unpaidBillsQuery.contains("brand_ids", [brandId]);
    }
    if (billType && billType !== "all") {
      unpaidBillsQuery = unpaidBillsQuery.eq("bill_type", billType);
    }

    let chartSalesQuery = supabase
      .from("sale_bills")
      .select("bill_date, grand_total, brand_ids")
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .is("deleted_at", null)
      .gte("bill_date", chartStartDateStr)
      .lte("bill_date", endDateStr);
    if (brandId !== "all") {
      chartSalesQuery = chartSalesQuery.contains("brand_ids", [brandId]);
    }

    // Payables Queries
    const rmPurchasesPromise = supabase
      .from("raw_material_purchases")
      .select("grand_total, paid_amount, status, payment_status")
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .neq("payment_status", "paid");

    const purchasesPromise = supabase
      .from("purchases")
      .select("grand_total, paid_amount, status, payment_status")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .neq("status", "cancelled")
      .neq("payment_status", "paid");

    // 4. Await All in Parallel
    const [
      bankAccountsRes,
      stagesRes,
      lotsRes,
      finishedStockRes,
      rawMaterialStockRes,
      godownsRes,
      todaySalesRes,
      periodSalesRes,
      unpaidBillsRes,
      chartSalesRes,
      rmPurchasesRes,
      purchasesRes,
    ] = await Promise.all([
      bankAccountsPromise,
      stagesPromise,
      lotsPromise,
      finishedStockPromise,
      rawMaterialStockPromise,
      godownsPromise,
      todaySalesQuery,
      periodSalesQuery,
      unpaidBillsQuery,
      chartSalesQuery,
      rmPurchasesPromise,
      purchasesPromise,
    ]);

    // 5. Process Bank Balances & Cash In Hand
    const bankAccounts = (bankAccountsRes.data || []).map((acc: any) => {
      const balance = acc.current_balance !== null && acc.current_balance !== undefined
        ? Number(acc.current_balance)
        : Number(acc.opening_balance || 0);
      return {
        ...acc,
        current_balance: balance,
      };
    });

    const cashInHand = bankAccounts.reduce(
      (sum, acc) => sum + Number(acc.current_balance || 0),
      0
    );

    // 6. Calculate Finished Stock and Raw Material Stock
    const finishedStockRows = finishedStockRes.data || [];
    const rawMaterialStockRows = rawMaterialStockRes.data || [];

    const finishedStockVal = finishedStockRows.reduce((sum, item: any) => {
      const qty = Number(item.total_quantity || 0);
      let val = Number(item.total_value || 0);
      if (val <= 0 && qty > 0) {
        const costPerPiece = Number(item.cost_per_piece || 0);
        const salePrice = Number(item.design?.sale_price || 0);
        const unitCost = costPerPiece > 0 ? costPerPiece : (salePrice > 0 ? Math.round(salePrice * 0.6) : 150);
        val = qty * unitCost;
      }
      return sum + val;
    }, 0);

    const rawMaterialStockVal = brandId === "all"
      ? rawMaterialStockRows.reduce((sum, item: any) => {
          const val = Number(item.stock_value || 0);
          if (val > 0) return sum + val;
          const qty = Number(item.current_stock || 0);
          const unitCost = Number(item.unit_cost || 0);
          return sum + (qty * unitCost);
        }, 0)
      : 0;

    const totalStockValue = finishedStockVal + rawMaterialStockVal;

    // 7. Calculate Sales KPIs
    const todaySales = (todaySalesRes.data || []).reduce(
      (sum, b: any) => sum + Number(b.grand_total || 0),
      0
    );

    const periodSalesTotal = (periodSalesRes.data || []).reduce(
      (sum, b: any) => sum + Number(b.grand_total || 0),
      0
    );

    // 8. Calculate Pending Receivables & Payables
    const validUnpaidBills = (unpaidBillsRes.data || []).filter(
      (b: any) => !b.bill_number?.startsWith("TEMP-") && !b.remarks?.includes("[TEMPORARY]")
    );

    const pendingDues = validUnpaidBills.reduce(
      (sum, b: any) => sum + Math.max(0, Number(b.grand_total || 0) - Number(b.paid_amount || 0)),
      0
    );

    const rmPayables = (rmPurchasesRes.data || []).reduce(
      (sum, p: any) => sum + Math.max(0, Number(p.grand_total || 0) - Number(p.paid_amount || 0)),
      0
    );
    const purchasesPayables = (purchasesRes.data || []).reduce(
      (sum, p: any) => sum + Math.max(0, Number(p.grand_total || 0) - Number(p.paid_amount || 0)),
      0
    );
    const totalSupplierPayables = rmPayables + purchasesPayables;
    const totalSupplierPayablesCount = (rmPurchasesRes.data?.length || 0) + (purchasesRes.data?.length || 0);

    // 9. Production Lots Distribution
    const stages = stagesRes.data || [];
    const lots = lotsRes.data || [];

    // Map stage_id -> stage metadata
    const stageIdToMeta = new Map<string, { name: string; color: string }>();
    stages.forEach((stg: any) => {
      stageIdToMeta.set(stg.id, {
        name: stg.name,
        color: stg.color || "#6366F1",
      });
    });

    // Group counts by normalized stage name (case-insensitive deduplication across templates)
    const normalizedStageMap = new Map<string, { displayName: string; color: string; count: number }>();

    const statusCounts: Record<string, { name: string; color: string; count: number }> = {
      draft: { name: "Draft", color: "#94A3B8", count: 0 },
      in_progress: { name: "In Progress", color: "#6366F1", count: 0 },
      completed: { name: "Completed", color: "#10B981", count: 0 },
      on_hold: { name: "On Hold", color: "#F59E0B", count: 0 },
      cancelled: { name: "Cancelled", color: "#EF4444", count: 0 },
    };

    lots.forEach((lot: any) => {
      let stageName: string | null = null;
      let stageColor = "#6366F1";

      if (lot.current_stage_id && stageIdToMeta.has(lot.current_stage_id)) {
        const meta = stageIdToMeta.get(lot.current_stage_id)!;
        stageName = meta.name;
        stageColor = meta.color;
      } else if (lot.stage?.name) {
        stageName = lot.stage.name;
        stageColor = lot.stage.color || "#6366F1";
      }

      if (stageName) {
        const key = stageName.trim().toLowerCase();
        if (!normalizedStageMap.has(key)) {
          const display = stageName.trim().charAt(0).toUpperCase() + stageName.trim().slice(1);
          normalizedStageMap.set(key, { displayName: display, color: stageColor, count: 0 });
        }
        normalizedStageMap.get(key)!.count++;
      } else if (lot.status && statusCounts[lot.status]) {
        statusCounts[lot.status].count++;
      } else {
        statusCounts.in_progress.count++;
      }
    });

    const stageItems = Array.from(normalizedStageMap.values())
      .filter((s) => s.count > 0)
      .map((s) => ({ name: s.displayName, value: s.count, color: s.color }));

    const statusItems = Object.values(statusCounts)
      .filter((s) => s.count > 0)
      .map((s) => ({ name: s.name, value: s.count, color: s.color }));

    const productionDonut = stageItems.length > 0 ? stageItems : statusItems;

    // 10. Low Stock Alerts
    const lowStockAlerts = rawMaterialStockRows
      .filter((s: any) => {
        const current = Number(s.current_stock || 0);
        const reorder = Number(s.material_type?.reorder_level || 0);
        return reorder > 0 && current < reorder;
      })
      .map((s: any) => ({
        name: s.material_type?.name || "Unknown Material",
        category: s.material_type?.category || "Raw Material",
        qty: `${s.current_stock} ${s.material_type?.unit || "Units"}`.trim(),
        reorder: `${s.material_type?.reorder_level || 0} ${s.material_type?.unit || "Units"}`.trim(),
      }))
      .slice(0, 5);

    // 11. Godown Stock Aggregation
    const godowns = godownsRes.data || [];
    const godownStockMap: Record<string, { name: string; pieces: number; value: number }> = {};
    godowns.forEach((g: any) => {
      godownStockMap[g.id] = { name: g.name, pieces: 0, value: 0 };
    });

    finishedStockRows.forEach((item: any) => {
      if (item.godown_id && godownStockMap[item.godown_id]) {
        const qty = Number(item.total_quantity || 0);
        let val = Number(item.total_value || 0);
        if (val <= 0 && qty > 0) {
          const costPerPiece = Number(item.cost_per_piece || 0);
          const salePrice = Number(item.design?.sale_price || 0);
          const unitCost = costPerPiece > 0 ? costPerPiece : (salePrice > 0 ? Math.round(salePrice * 0.6) : 150);
          val = qty * unitCost;
        }
        godownStockMap[item.godown_id].pieces += qty;
        godownStockMap[item.godown_id].value += val;
      }
    });

    if (brandId === "all") {
      rawMaterialStockRows.forEach((item: any) => {
        if (item.godown_id && godownStockMap[item.godown_id]) {
          const qty = Number(item.current_stock || 0);
          let val = Number(item.stock_value || 0);
          if (val <= 0 && qty > 0) {
            val = qty * Number(item.unit_cost || 0);
          }
          godownStockMap[item.godown_id].pieces += qty;
          godownStockMap[item.godown_id].value += val;
        }
      });
    }

    const godownStock = Object.values(godownStockMap);

    // 12. Dynamic Sales Chart Generation
    const chartSales = chartSalesRes.data || [];
    const salesGrouped: Record<string, number> = {};

    if (dateRange === "this_week" || dateRange === "today") {
      // 7 days interval
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = toLocalDateStr(d);
        salesGrouped[key] = 0;
      }
    } else if (dateRange === "this_year") {
      // Monthly buckets
      const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      for (let m = 0; m < 12; m++) {
        const d = new Date(startYear, 3 + m, 1);
        if (d > now) break;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        salesGrouped[key] = 0;
      }
    } else {
      // 6 intervals across the selected period or last 30 days
      const daysCount = 30;
      const step = 5;
      for (let i = daysCount - step; i >= 0; i -= step) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = toLocalDateStr(d);
        salesGrouped[key] = 0;
      }
    }

    chartSales.forEach((bill: any) => {
      if (!bill.bill_date) return;
      const billDateStr = bill.bill_date.split("T")[0];
      const amount = Number(bill.grand_total || 0);

      if (dateRange === "this_year") {
        const billMonthKey = billDateStr.substring(0, 7);
        if (salesGrouped[billMonthKey] !== undefined) {
          salesGrouped[billMonthKey] += amount;
        }
      } else if (salesGrouped[billDateStr] !== undefined) {
        salesGrouped[billDateStr] += amount;
      } else {
        // Find closest date key
        let closestKey = Object.keys(salesGrouped)[0];
        let minDiff = Infinity;
        const billTime = new Date(billDateStr).getTime();
        Object.keys(salesGrouped).forEach((k) => {
          const diff = Math.abs(new Date(k).getTime() - billTime);
          if (diff < minDiff) {
            minDiff = diff;
            closestKey = k;
          }
        });
        if (closestKey) {
          salesGrouped[closestKey] += amount;
        }
      }
    });

    const salesChart = Object.entries(salesGrouped).map(([key, sales]) => {
      let formattedLabel = key;
      if (dateRange === "this_year") {
        const [y, m] = key.split("-");
        const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
        formattedLabel = d.toLocaleDateString("en-US", { month: "short" });
      } else {
        const d = new Date(key + "T00:00:00");
        formattedLabel = isNaN(d.getTime())
          ? key
          : d.toLocaleDateString("en-US", { day: "2-digit", month: "short" });
      }
      return {
        date: formattedLabel,
        sales: Math.round(sales),
      };
    });

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
      salesChart,
      godownStock,
      bankBalances: bankAccounts,
      remindersSummary: {
        receivables: {
          total_overdue: validUnpaidBills.length,
          total_outstanding: pendingDues,
        },
        payables: {
          total_overdue: totalSupplierPayablesCount,
          total_outstanding: totalSupplierPayables,
        },
      },
    });
  } catch (err: any) {
    console.error("[GET /api/dashboard] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load dashboard metrics" },
      { status: 500 }
    );
  }
}

