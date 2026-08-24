import { NextRequest, NextResponse } from "next/server";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  const { searchParams } = new URL(req.url);
  const to = searchParams.get("to") ?? today.toISOString().split("T")[0];

  try {
    const [
      saleBillsRes,
      salesReturnsRes,
      rmPurchasesRes,
      fgPurchasesRes,
      purchaseReturnsRes,
      bankAccountsRes,
      rmStockRes,
      fgStockRes,
      expensesUnpaidRes,
      stageEntriesRes,
    ] = await Promise.all([
      // 1. All active sale bills up to "to" date
      supabase
        .from("sale_bills")
        .select("id, bill_number, bill_date, grand_total, paid_amount, payment_status, party:parties(id, name, company_name)")
        .eq("business_id", businessId)
        .eq("status", "active")
        .is("deleted_at", null)
        .lte("bill_date", to)
        .order("bill_date", { ascending: false }),

      // 2. Sales returns
      supabase
        .from("sales_returns")
        .select("id, return_number, return_date, original_bill_id, grand_total, party:parties(id, name, company_name)")
        .eq("business_id", businessId)
        .neq("status", "cancelled")
        .lte("return_date", to),

      // 3. RM purchases up to "to"
      supabase
        .from("raw_material_purchases")
        .select("id, purchase_number, invoice_date, grand_total, paid_amount, payment_status, gst_type, supplier:parties(id, name, company_name)")
        .eq("business_id", businessId)
        .neq("status", "cancelled")
        .is("deleted_at", null)
        .lte("invoice_date", to)
        .order("invoice_date", { ascending: false }),

      // 4. FG purchases up to "to"
      supabase
        .from("purchase_bills")
        .select("id, bill_number, invoice_date, grand_total, paid_amount, payment_status, supplier:parties(id, name, company_name)")
        .eq("business_id", businessId)
        .eq("status", "active")
        .lte("invoice_date", to)
        .order("invoice_date", { ascending: false }),

      // 5. Purchase returns
      supabase
        .from("purchase_returns")
        .select("id, return_number, return_date, purchase_id, grand_total, supplier:parties(id, name, company_name)")
        .eq("business_id", businessId)
        .neq("status", "cancelled")
        .is("deleted_at", null)
        .lte("return_date", to),

      // 6. Bank accounts
      supabase
        .from("bank_accounts")
        .select("id, name, type, account_category, current_balance, account_number, upi_id")
        .eq("business_id", businessId)
        .is("deleted_at", null),

      // 7. RM stock
      supabase
        .from("raw_material_current_stock")
        .select("id, stock_value, current_stock, unit_cost, material_type:raw_material_types(id, name, category), godown:godowns(id, name)")
        .eq("business_id", businessId),

      // 8. FG stock
      supabase
        .from("finished_stock")
        .select("id, total_value, total_quantity, cost_per_piece, design:designs(id, name, design_number), godown:godowns(id, name)")
        .eq("business_id", businessId)
        .is("deleted_at", null),

      // 9. Unpaid expenses
      supabase
        .from("expenses")
        .select("id, expense_number, expense_date, amount, gst_amount, vendor_name, expense_type:expense_types(name)")
        .eq("business_id", businessId)
        .lte("expense_date", to)
        .is("paid_from_account_id", null)
        .order("expense_date", { ascending: false }),

      // 10. Stage entries outstanding
      supabase
        .from("stage_entries")
        .select("id, entry_date, total_job_work_amount, paid_amount, payment_status, lot_id, worker:workers(id, name)")
        .eq("business_id", businessId)
        .neq("payment_status", "paid")
        .lte("entry_date", to)
        .order("entry_date", { ascending: false }),
    ]);

    const saleBills = saleBillsRes.data ?? [];
    const salesReturns = salesReturnsRes.data ?? [];
    const rmPurchases = rmPurchasesRes.data ?? [];
    const fgPurchases = fgPurchasesRes.data ?? [];
    const purchaseReturns = purchaseReturnsRes.data ?? [];
    const bankAccounts = bankAccountsRes.data ?? [];
    const rmStock = rmStockRes.data ?? [];
    const fgStock = fgStockRes.data ?? [];
    const expensesUnpaid = expensesUnpaidRes.data ?? [];
    const stageEntries = stageEntriesRes.data ?? [];

    // ── Build returns maps ─────────────────────────────────────────────────────
    const salesReturnsMap: Record<string, number> = {};
    for (const r of salesReturns) {
      if (r.original_bill_id) {
        salesReturnsMap[r.original_bill_id] = (salesReturnsMap[r.original_bill_id] || 0) + Number(r.grand_total || 0);
      }
    }

    const purchaseReturnsMap: Record<string, number> = {};
    for (const r of purchaseReturns) {
      if (r.purchase_id) {
        purchaseReturnsMap[r.purchase_id] = (purchaseReturnsMap[r.purchase_id] || 0) + Number(r.grand_total || 0);
      }
    }

    // ── ASSETS ────────────────────────────────────────────────────────────────

    // Cash & Bank
    const cashAccounts = bankAccounts.filter((b) => b.type === "cash");
    const cashInHand = cashAccounts.reduce((s, b) => s + Number(b.current_balance || 0), 0);

    const bankOnly = bankAccounts.filter((b) => b.type !== "cash");
    const bankBalance = bankOnly.reduce((s, b) => s + Number(b.current_balance || 0), 0);

    const bankDrillRecords = bankAccounts.map((b) => ({
      id: b.id,
      doc_number: b.name,
      date: to,
      party_name: b.type === "cash" ? "Cash Account" : b.account_number ? `Acc: ${b.account_number}` : "Bank Account",
      category: b.type === "cash" ? "Cash in Hand" : "Bank Account",
      description: `Category: ${b.account_category || "General"}`,
      amount: Number(b.current_balance || 0),
      badge: b.type,
      badge_color: b.type === "cash" ? "emerald" : "blue",
      view_url: `/banking`,
    }));

    // Trade Receivables
    let tradeReceivables = 0;
    const receivablesDrillRecords: any[] = [];

    for (const bill of saleBills) {
      const returned = salesReturnsMap[bill.id] || 0;
      const netTotal = Math.max(0, Number(bill.grand_total) - returned);
      const outstanding = Math.max(0, netTotal - Number(bill.paid_amount || 0));

      if (outstanding > 0) {
        tradeReceivables += outstanding;
        const party = Array.isArray(bill.party) ? bill.party[0] : bill.party;
        receivablesDrillRecords.push({
          id: bill.id,
          doc_number: bill.bill_number,
          date: bill.bill_date,
          party_name: party?.company_name || party?.name || "Customer",
          category: "Trade Receivable",
          description: `Bill Total: ₹${netTotal} · Paid: ₹${bill.paid_amount || 0}`,
          amount: Math.round(outstanding * 100) / 100,
          badge: bill.payment_status || "unpaid",
          badge_color: "amber",
          view_url: party?.id ? `/parties/${party.id}/ledger` : `/sales/bills/${bill.id}`,
        });
      }
    }

    // Inventory
    const rmInventory = rmStock.reduce((s, r) => s + Number(r.stock_value || 0), 0);
    const fgInventory = fgStock.reduce((s, f) => s + Number(f.total_value || 0), 0);
    const totalInventory = rmInventory + fgInventory;

    const rmStockDrillRecords = rmStock.map((r) => {
      const mat = Array.isArray(r.material_type) ? r.material_type[0] : r.material_type;
      const godown = Array.isArray(r.godown) ? r.godown[0] : r.godown;
      return {
        id: r.id,
        doc_number: mat?.name || "Raw Material",
        date: to,
        party_name: godown?.name || "Main Godown",
        category: "Raw Material",
        description: `Qty: ${r.current_stock ?? 0} @ ₹${r.unit_cost ?? 0}/unit`,
        amount: Number(r.stock_value || 0),
        badge: mat?.category || "fabric",
        badge_color: "emerald",
        view_url: `/raw-materials/stock`,
      };
    });

    const fgStockDrillRecords = fgStock.map((f) => {
      const design = Array.isArray(f.design) ? f.design[0] : f.design;
      const godown = Array.isArray(f.godown) ? f.godown[0] : f.godown;
      return {
        id: f.id,
        doc_number: design?.name || design?.design_number || "Finished Goods",
        date: to,
        party_name: godown?.name || "Main Store",
        category: "Finished Goods",
        description: `Qty: ${f.total_quantity ?? 0} pcs @ ₹${f.cost_per_piece ?? 0}/pc`,
        amount: Number(f.total_value || 0),
        badge: "Finished Goods",
        badge_color: "blue",
        view_url: `/inventory`,
      };
    });

    // ── LIABILITIES ───────────────────────────────────────────────────────────

    // Trade Payables (RM + FG)
    let rmPayables = 0;
    const payablesDrillRecords: any[] = [];

    for (const p of rmPurchases) {
      const returned = purchaseReturnsMap[p.id] || 0;
      const netTotal = Math.max(0, Number(p.grand_total) - returned);
      const outstanding = Math.max(0, netTotal - Number(p.paid_amount || 0));

      if (outstanding > 0) {
        rmPayables += outstanding;
        const supplier = Array.isArray(p.supplier) ? p.supplier[0] : p.supplier;
        payablesDrillRecords.push({
          id: p.id,
          doc_number: p.purchase_number,
          date: p.invoice_date,
          party_name: supplier?.company_name || supplier?.name || "Supplier",
          category: "Raw Material Payable",
          description: `Total: ₹${netTotal} · Paid: ₹${p.paid_amount || 0}`,
          amount: Math.round(outstanding * 100) / 100,
          badge: p.gst_type || "payable",
          badge_color: "rose",
          view_url: supplier?.id ? `/parties/${supplier.id}/ledger` : `/raw-materials/purchases/${p.id}`,
        });
      }
    }

    let fgPayables = 0;
    for (const p of fgPurchases) {
      const returned = purchaseReturnsMap[p.id] || 0;
      const netTotal = Math.max(0, Number(p.grand_total) - returned);
      const outstanding = Math.max(0, netTotal - Number(p.paid_amount || 0));

      if (outstanding > 0) {
        fgPayables += outstanding;
        const supplier = Array.isArray(p.supplier) ? p.supplier[0] : p.supplier;
        payablesDrillRecords.push({
          id: p.id,
          doc_number: p.bill_number,
          date: p.invoice_date,
          party_name: supplier?.company_name || supplier?.name || "FG Supplier",
          category: "Finished Goods Payable",
          description: `Total: ₹${netTotal} · Paid: ₹${p.paid_amount || 0}`,
          amount: Math.round(outstanding * 100) / 100,
          badge: "FG Purchase",
          badge_color: "rose",
          view_url: supplier?.id ? `/parties/${supplier.id}/ledger` : `/inventory`,
        });
      }
    }
    const tradePayables = rmPayables + fgPayables;

    // Worker / Job Work Payables
    let workerPayables = 0;
    const workerPayablesDrillRecords: any[] = [];

    for (const se of stageEntries) {
      const outstanding = Math.max(0, Number(se.total_job_work_amount || 0) - Number(se.paid_amount || 0));
      if (outstanding > 0) {
        workerPayables += outstanding;
        const worker = Array.isArray(se.worker) ? se.worker[0] : se.worker;
        workerPayablesDrillRecords.push({
          id: se.id,
          doc_number: `SE-${se.id.slice(0, 8).toUpperCase()}`,
          date: se.entry_date,
          party_name: worker?.name || "Job Worker",
          category: "Worker Payable",
          description: `Lot #${se.lot_id ? String(se.lot_id).slice(0, 8) : "—"} · Outstanding: ₹${outstanding}`,
          amount: Math.round(outstanding * 100) / 100,
          badge: "Job Work",
          badge_color: "violet",
          view_url: `/production`,
        });
      }
    }

    // Outstanding Expenses
    const outstandingExpenses = expensesUnpaid.reduce((s, e) => s + Number(e.amount || 0), 0);
    const outstandingExpensesDrillRecords = expensesUnpaid.map((e) => {
      const expType = Array.isArray(e.expense_type) ? e.expense_type[0] : e.expense_type;
      return {
        id: e.id,
        doc_number: e.expense_number || `EXP-${e.id.slice(0, 6)}`,
        date: e.expense_date,
        party_name: e.vendor_name || expType?.name || "Vendor",
        category: "Outstanding Expense",
        description: expType?.name || "Expense Payable",
        amount: Number(e.amount),
        badge: "Unpaid",
        badge_color: "rose",
        view_url: `/expenses`,
      };
    });

    // ── Summary Calculations ───────────────────────────────────────────────────
    const totalCurrentAssets = cashInHand + bankBalance + tradeReceivables + totalInventory;
    const totalAssets = totalCurrentAssets;

    const totalCurrentLiabilities = tradePayables + workerPayables + outstandingExpenses;
    const totalLiabilities = totalCurrentLiabilities;

    const workingCapital = totalCurrentAssets - totalCurrentLiabilities;
    const netPosition = totalAssets - totalLiabilities;
    const isBalanced = Math.abs(totalAssets - totalLiabilities - netPosition) < 1;

    return NextResponse.json({
      as_on: to,
      assets: {
        current: {
          cash_in_hand: Math.round(cashInHand * 100) / 100,
          bank_accounts: Math.round(bankBalance * 100) / 100,
          trade_receivables: Math.round(tradeReceivables * 100) / 100,
          inventory: {
            raw_material: Math.round(rmInventory * 100) / 100,
            finished_goods: Math.round(fgInventory * 100) / 100,
            total: Math.round(totalInventory * 100) / 100,
          },
          total: Math.round(totalCurrentAssets * 100) / 100,
        },
        non_current: {
          total: 0,
        },
        total: Math.round(totalAssets * 100) / 100,
      },
      liabilities: {
        current: {
          trade_payables: Math.round(tradePayables * 100) / 100,
          rm_payables: Math.round(rmPayables * 100) / 100,
          fg_payables: Math.round(fgPayables * 100) / 100,
          worker_payables: Math.round(workerPayables * 100) / 100,
          outstanding_expenses: Math.round(outstandingExpenses * 100) / 100,
          total: Math.round(totalCurrentLiabilities * 100) / 100,
        },
        non_current: {
          total: 0,
        },
        total: Math.round(totalLiabilities * 100) / 100,
      },
      net_position: Math.round(netPosition * 100) / 100,
      working_capital: Math.round(workingCapital * 100) / 100,
      is_balanced: isBalanced,
      difference: Math.round((totalAssets - totalLiabilities - netPosition) * 100) / 100,
      drill_records: {
        inventory_rm: rmStockDrillRecords,
        inventory_fg: fgStockDrillRecords,
        receivables: receivablesDrillRecords,
        payables: payablesDrillRecords,
        worker_payables: workerPayablesDrillRecords,
        expenses_unpaid: outstandingExpensesDrillRecords,
        bank_accounts: bankDrillRecords,
      },
    });
  } catch (err: any) {
    console.error("[reports/financial/balance]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
