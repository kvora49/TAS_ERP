import { NextRequest, NextResponse } from "next/server";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const defaultFrom = `${fyStartYear}-04-01`;
  const defaultTo = today.toISOString().split("T")[0];

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? defaultFrom;
  const to = searchParams.get("to") ?? defaultTo;
  const billType = searchParams.get("bill_type"); // 'kacha' | 'pakka' | null = all

  try {
    // ── Parallel data fetch ────────────────────────────────────────────────────
    const [
      saleBillsRes,
      salesReturnsRes,
      rmPurchasesRes,
      stockValuationRes,
      fgStockRes,
      expensesRes,
      salaryRes,
      miscIncomeRes,
      writeoffsRes,
      jobWorkRes,
    ] = await Promise.all([
      // 1. Sale bills with items and party
      supabase
        .from("sale_bills")
        .select("id, bill_number, bill_date, grand_total, taxable_amount, cgst, sgst, igst, bill_type, paid_amount, payment_status, party:parties(id, name, company_name), items:sale_bill_items(item_type, amount, quantity, rate)")
        .eq("business_id", businessId)
        .eq("status", "active")
        .is("deleted_at", null)
        .gte("bill_date", from)
        .lte("bill_date", to)
        .order("bill_date", { ascending: false }),

      // 2. Sales returns
      supabase
        .from("sales_returns")
        .select("id, return_number, return_date, grand_total, original_bill_id, status, party:parties(id, name, company_name)")
        .eq("business_id", businessId)
        .neq("status", "cancelled")
        .gte("return_date", from)
        .lte("return_date", to)
        .order("return_date", { ascending: false }),

      // 3. Raw material purchases with items and supplier
      supabase
        .from("raw_material_purchases")
        .select("id, purchase_number, invoice_date, grand_total, total_taxable_value, total_gst_amount, gst_type, paid_amount, payment_status, supplier:parties(id, name, company_name), items:raw_material_purchase_items(item_type, other_category, taxable_value, gst_amount, amount, quantity, rate)")
        .eq("business_id", businessId)
        .neq("status", "cancelled")
        .is("deleted_at", null)
        .gte("invoice_date", from)
        .lte("invoice_date", to)
        .order("invoice_date", { ascending: false }),

      // 4. Current RM stock valuation
      supabase
        .from("raw_material_current_stock")
        .select("stock_value, unit_cost, current_stock, material_type:raw_material_types(name, category)")
        .eq("business_id", businessId),

      // 5. Current FG stock valuation
      supabase
        .from("finished_stock")
        .select("total_value, total_quantity, cost_per_piece, design:designs(id, name, design_number)")
        .eq("business_id", businessId)
        .is("deleted_at", null),

      // 6. Expenses
      supabase
        .from("expenses")
        .select("id, expense_number, expense_date, amount, gst_amount, vendor_name, expense_type:expense_types(name)")
        .eq("business_id", businessId)
        .gte("expense_date", from)
        .lte("expense_date", to)
        .order("expense_date", { ascending: false }),

      // 7. Salary entries
      supabase
        .from("salary_entries")
        .select("id, payment_date, net_salary, month, year, employee_id")
        .eq("business_id", businessId)
        .gte("payment_date", from)
        .lte("payment_date", to)
        .order("payment_date", { ascending: false }),

      // 8. Misc income
      supabase
        .from("misc_income")
        .select("id, income_number, income_date, amount, income_type, description")
        .eq("business_id", businessId)
        .gte("income_date", from)
        .lte("income_date", to)
        .order("income_date", { ascending: false }),

      // 9. Write offs
      supabase
        .from("write_offs")
        .select("id, amount, bill_type, bill_id, remarks, written_off_at")
        .eq("business_id", businessId)
        .gte("written_off_at", from)
        .lte("written_off_at", to)
        .order("written_off_at", { ascending: false }),

      // 10. Job work entries
      supabase
        .from("stage_entries")
        .select("id, entry_date, total_job_work_amount, lot_id, worker:workers(name)")
        .eq("business_id", businessId)
        .gte("entry_date", from)
        .lte("entry_date", to)
        .order("entry_date", { ascending: false }),
    ]);

    const saleBills = saleBillsRes.data ?? [];
    const salesReturns = salesReturnsRes.data ?? [];
    const rmPurchases = rmPurchasesRes.data ?? [];
    const rmStock = stockValuationRes.data ?? [];
    const fgStock = fgStockRes.data ?? [];
    const expenses = expensesRes.data ?? [];
    const salaries = salaryRes.data ?? [];
    const miscIncome = miscIncomeRes.data ?? [];
    const writeoffs = writeoffsRes.data ?? [];
    const jobWorkEntries = jobWorkRes.data ?? [];

    // ── Apply bill type filter ─────────────────────────────────────────────────
    const filteredSaleBills = billType && (billType === "kacha" || billType === "pakka")
      ? saleBills.filter((b) => b.bill_type === billType)
      : saleBills;

    const filteredPurchases = billType === "pakka"
      ? rmPurchases.filter((p) => p.gst_type !== "without_gst")
      : billType === "kacha"
      ? rmPurchases.filter((p) => p.gst_type === "without_gst")
      : rmPurchases;

    // ── Revenue Calculation & Drill-Down Records ──────────────────────────────
    let revFG = 0, revFabric = 0, revAccessory = 0, revOthers = 0;
    let totalGrossRevenue = 0;
    const salesDrillRecords: any[] = [];

    for (const bill of filteredSaleBills) {
      const billTotal = Number(bill.grand_total);
      totalGrossRevenue += billTotal;
      const items = (bill as any).items ?? [];
      const party = Array.isArray(bill.party) ? bill.party[0] : bill.party;
      const partyName = party?.company_name || party?.name || "Customer";

      if (!Array.isArray(items) || items.length === 0) {
        revFG += billTotal;
        salesDrillRecords.push({
          id: bill.id,
          doc_number: bill.bill_number,
          date: bill.bill_date,
          party_name: partyName,
          category: "Finished Goods",
          amount: billTotal,
          badge: bill.bill_type,
          badge_color: bill.bill_type === "pakka" ? "blue" : "amber",
          view_url: `/sales/bills/${bill.id}`,
        });
      } else {
        const billItemTotal = items.reduce((s: number, it: any) => s + Number(it.amount || 0), 0);
        for (const it of items) {
          const ratio = billItemTotal > 0 ? Number(it.amount || 0) / billItemTotal : 1 / items.length;
          const portion = billTotal * ratio;
          const type = it.item_type || "finished_goods";
          const catLabel =
            type === "finished_goods" ? "Finished Goods" :
            type === "fabric" ? "Raw Material / Fabric" :
            type === "accessory" ? "Accessories & Trims" : "Others";

          if (type === "finished_goods") revFG += portion;
          else if (type === "fabric") revFabric += portion;
          else if (type === "accessory") revAccessory += portion;
          else revOthers += portion;

          salesDrillRecords.push({
            id: `${bill.id}-${type}`,
            doc_number: bill.bill_number,
            date: bill.bill_date,
            party_name: partyName,
            category: catLabel,
            description: `${it.quantity ?? 1} pcs/mtrs @ ₹${it.rate ?? 0}`,
            amount: Math.round(portion * 100) / 100,
            badge: bill.bill_type,
            badge_color: bill.bill_type === "pakka" ? "blue" : "amber",
            view_url: `/sales/bills/${bill.id}`,
          });
        }
      }
    }

    // Net off sales returns
    const totalReturns = salesReturns.reduce((s, r) => s + Number(r.grand_total || 0), 0);
    const returnRatio = totalGrossRevenue > 0 ? totalReturns / totalGrossRevenue : 0;
    revFG = Math.max(0, revFG * (1 - returnRatio));
    revFabric = Math.max(0, revFabric * (1 - returnRatio));
    revAccessory = Math.max(0, revAccessory * (1 - returnRatio));
    revOthers = Math.max(0, revOthers * (1 - returnRatio));

    const totalRevenue = revFG + revFabric + revAccessory + revOthers;

    // Sales Returns drill-down records
    const returnsDrillRecords = salesReturns.map((r) => {
      const party = Array.isArray(r.party) ? r.party[0] : r.party;
      return {
        id: r.id,
        doc_number: r.return_number,
        date: r.return_date,
        party_name: party?.company_name || party?.name || "Customer",
        description: "Sales Return Inward",
        amount: Number(r.grand_total),
        badge: "Return",
        badge_color: "rose",
        view_url: `/sales/returns/${r.id}`,
      };
    });

    // ── COGS Calculation & Drill-Down Records ─────────────────────────────────
    let purchFabric = 0, purchFG = 0, purchAccessory = 0, purchOthers = 0;
    let rcmPurchase = 0, normalPurchase = 0;
    const purchasesDrillRecords: any[] = [];

    for (const purchase of filteredPurchases) {
      const purchTotal = Number(purchase.grand_total);
      const items = (purchase as any).items ?? [];
      const supplier = Array.isArray(purchase.supplier) ? purchase.supplier[0] : purchase.supplier;
      const supplierName = supplier?.company_name || supplier?.name || "Supplier";
      const isRcm = purchase.gst_type === "reverse_charge";
      if (isRcm) rcmPurchase += purchTotal;
      else normalPurchase += purchTotal;

      if (!Array.isArray(items) || items.length === 0) {
        purchFabric += purchTotal;
        purchasesDrillRecords.push({
          id: purchase.id,
          doc_number: purchase.purchase_number,
          date: purchase.invoice_date,
          party_name: supplierName,
          category: "Raw Material",
          amount: purchTotal,
          badge: purchase.gst_type,
          badge_color: isRcm ? "amber" : "slate",
          view_url: `/raw-materials/purchases/${purchase.id}`,
        });
      } else {
        const itemTotal = items.reduce((s: number, it: any) => s + Number(it.amount || 0), 0);
        for (const it of items) {
          const ratio = itemTotal > 0 ? Number(it.amount || 0) / itemTotal : 1 / items.length;
          const portion = purchTotal * ratio;
          const type = it.item_type || "fabric";

          if (type === "fabric") purchFabric += portion;
          else if (type === "finished_goods") purchFG += portion;
          else if (type === "accessory") purchAccessory += portion;
          else {
            const otherCat = it.other_category;
            if (otherCat !== "capital_asset") {
              purchOthers += portion;
            }
          }

          purchasesDrillRecords.push({
            id: `${purchase.id}-${type}`,
            doc_number: purchase.purchase_number,
            date: purchase.invoice_date,
            party_name: supplierName,
            category: type === "fabric" ? "Raw Material" : type === "finished_goods" ? "Finished Goods" : type === "accessory" ? "Accessories" : "Others",
            description: `${it.quantity ?? 1} @ ₹${it.rate ?? 0}`,
            amount: Math.round(portion * 100) / 100,
            badge: purchase.gst_type,
            badge_color: isRcm ? "amber" : "slate",
            view_url: `/raw-materials/purchases/${purchase.id}`,
          });
        }
      }
    }

    // Closing stock value
    const closingRMStock = rmStock.reduce((s, r) => s + Number(r.stock_value || 0), 0);
    const closingFGStock = fgStock.reduce((s, f) => s + Number(f.total_value || 0), 0);
    const closingStock = closingRMStock + closingFGStock;

    // COGS = Purchases − Closing stock
    const cogsRM = Math.max(0, purchFabric - closingRMStock);
    const cogsFG = Math.max(0, purchFG - closingFGStock);
    const cogsAccessory = purchAccessory;
    const cogsManufactured = 0;

    // Job work cost (Direct production overhead inside COGS)
    const jobWorkExpense = jobWorkEntries.reduce((s, j) => s + Number(j.total_job_work_amount || 0), 0);
    const totalCOGS = cogsRM + cogsFG + cogsAccessory + jobWorkExpense;
    const grossProfit = totalRevenue - totalCOGS;

    // Job work drill-down records
    const jobWorkDrillRecords = jobWorkEntries.map((j) => {
      const worker = Array.isArray(j.worker) ? j.worker[0] : j.worker;
      return {
        id: j.id,
        doc_number: `JW-${j.id.slice(0, 8).toUpperCase()}`,
        date: j.entry_date,
        party_name: worker?.name || "Job Worker",
        description: `Production Lot #${j.lot_id ? String(j.lot_id).slice(0, 8) : "—"}`,
        amount: Number(j.total_job_work_amount || 0),
        badge: "Job Work",
        badge_color: "violet",
        view_url: j.lot_id ? `/production/lots/${j.lot_id}` : `/production`,
      };
    });

    // ── Operating Expenses (strictly excludes Job Work) ────────────────────────
    const expBreakdown: Record<string, number> = {};
    let totalOperatingExpenses = 0;
    const expenseDrillRecords: any[] = [];

    for (const e of expenses) {
      const expType = Array.isArray(e.expense_type) ? e.expense_type[0] : e.expense_type;
      const catName = expType?.name ?? "General Expense";
      expBreakdown[catName] = (expBreakdown[catName] || 0) + Number(e.amount);
      totalOperatingExpenses += Number(e.amount);

      expenseDrillRecords.push({
        id: e.id,
        doc_number: e.expense_number || `EXP-${e.id.slice(0, 6)}`,
        date: e.expense_date,
        party_name: e.vendor_name || catName,
        category: catName,
        description: `Expense: ${catName}`,
        amount: Number(e.amount),
        badge: catName,
        badge_color: "amber",
        view_url: `/expenses`,
      });
    }

    const totalSalary = salaries.reduce((s, sl) => s + Number(sl.net_salary || 0), 0);
    const salaryDrillRecords = salaries.map((sl) => ({
      id: sl.id,
      doc_number: `SAL-${sl.month}/${sl.year}`,
      date: sl.payment_date,
      party_name: `Employee #${sl.employee_id ? String(sl.employee_id).slice(0, 6) : "Staff"}`,
      description: `Monthly Salary payout for ${sl.month}/${sl.year}`,
      amount: Number(sl.net_salary),
      badge: "Salary",
      badge_color: "emerald",
      view_url: `/payroll`,
    }));

    const totalOperating = totalOperatingExpenses + totalSalary;
    const operatingProfit = grossProfit - totalOperating;

    // ── Other Income / Expenses ───────────────────────────────────────────────
    const miscIncomeBreakdown: Record<string, number> = {};
    let totalMiscIncome = 0;
    const miscIncomeDrillRecords: any[] = [];

    for (const m of miscIncome) {
      const type = (m as any).income_type ?? "Other Income";
      miscIncomeBreakdown[type] = (miscIncomeBreakdown[type] || 0) + Number(m.amount);
      totalMiscIncome += Number(m.amount);

      miscIncomeDrillRecords.push({
        id: m.id,
        doc_number: m.income_number || `INC-${m.id.slice(0, 6)}`,
        date: m.income_date,
        party_name: type,
        description: m.description || "Miscellaneous Income",
        amount: Number(m.amount),
        badge: type,
        badge_color: "blue",
        view_url: `/banking`,
      });
    }

    const totalWriteoffs = writeoffs.reduce((s, w) => s + Number(w.amount || 0), 0);
    const writeoffsDrillRecords = writeoffs.map((w) => ({
      id: w.id,
      doc_number: `WO-${w.id.slice(0, 8).toUpperCase()}`,
      date: w.written_off_at,
      party_name: "Bad Debt Write-off",
      description: w.remarks || "Invoice Bad Debt Written Off",
      amount: Number(w.amount),
      badge: "Write-off",
      badge_color: "rose",
      view_url: `/sales/bills`,
    }));

    // ── Net Profit ────────────────────────────────────────────────────────────
    const netProfit = operatingProfit + totalMiscIncome - totalWriteoffs;
    const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : null;
    const netMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : null;
    const expenseRatioPct = totalRevenue > 0 ? (totalOperating / totalRevenue) * 100 : null;

    return NextResponse.json({
      from,
      to,
      bill_type: billType ?? "all",
      revenue: {
        finished_goods: Math.round(revFG * 100) / 100,
        raw_material: Math.round(revFabric * 100) / 100,
        accessories: Math.round(revAccessory * 100) / 100,
        others: Math.round(revOthers * 100) / 100,
        gross_revenue: Math.round(totalGrossRevenue * 100) / 100,
        returns: Math.round(totalReturns * 100) / 100,
        total: Math.round(totalRevenue * 100) / 100,
        drill_records: salesDrillRecords,
        returns_drill_records: returnsDrillRecords,
      },
      misc_income: {
        breakdown: miscIncomeBreakdown,
        total: Math.round(totalMiscIncome * 100) / 100,
        drill_records: miscIncomeDrillRecords,
      },
      total_income: Math.round((totalRevenue + totalMiscIncome) * 100) / 100,
      cogs: {
        raw_material: Math.round(cogsRM * 100) / 100,
        finished_goods: Math.round(cogsFG * 100) / 100,
        accessories: Math.round(cogsAccessory * 100) / 100,
        manufactured: cogsManufactured,
        job_work: Math.round(jobWorkExpense * 100) / 100,
        total: Math.round(totalCOGS * 100) / 100,
        purchases_in_period: {
          fabric: Math.round(purchFabric * 100) / 100,
          finished_goods: Math.round(purchFG * 100) / 100,
          accessories: Math.round(purchAccessory * 100) / 100,
          others: Math.round(purchOthers * 100) / 100,
          rcm: Math.round(rcmPurchase * 100) / 100,
          normal: Math.round(normalPurchase * 100) / 100,
        },
        closing_stock: {
          raw_material: Math.round(closingRMStock * 100) / 100,
          finished_goods: Math.round(closingFGStock * 100) / 100,
          total: Math.round(closingStock * 100) / 100,
        },
        purchases_drill_records: purchasesDrillRecords,
        job_work_drill_records: jobWorkDrillRecords,
      },
      gross_profit: Math.round(grossProfit * 100) / 100,
      gross_margin_pct: grossMarginPct !== null ? Math.round(grossMarginPct * 100) / 100 : null,
      operating_expenses: {
        breakdown: expBreakdown,
        expenses_total: Math.round(totalOperatingExpenses * 100) / 100,
        salary: Math.round(totalSalary * 100) / 100,
        total: Math.round(totalOperating * 100) / 100,
        drill_records: expenseDrillRecords,
        salary_drill_records: salaryDrillRecords,
      },
      expense_ratio_pct: expenseRatioPct !== null ? Math.round(expenseRatioPct * 100) / 100 : null,
      operating_profit: Math.round(operatingProfit * 100) / 100,
      other_expenses: {
        bad_debts: Math.round(totalWriteoffs * 100) / 100,
        total: Math.round(totalWriteoffs * 100) / 100,
        drill_records: writeoffsDrillRecords,
      },
      net_profit: Math.round(netProfit * 100) / 100,
      net_margin_pct: netMarginPct !== null ? Math.round(netMarginPct * 100) / 100 : null,
    });
  } catch (err: any) {
    console.error("[reports/financial/pl]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
