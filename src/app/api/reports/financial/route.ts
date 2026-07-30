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
  const bid = userData.business_id;

  try {
    // Run all queries in parallel
    const [
      salesResult,
      purchasesResult,
      paymentsReceivedResult,
      paymentsMadeResult,
      expensesResult,
      salaryResult,
      miscIncomeResult,
      writeoffsResult,
    ] = await Promise.all([
      // Total sales (pakka + kacha)
      supabase
        .from("sale_bills")
        .select("grand_total, bill_type, payment_status, paid_amount")
        .eq("business_id", bid)
        .eq("status", "active")
        .is("deleted_at", null)
        .gte("bill_date", from)
        .lte("bill_date", to),

      // Raw material purchases
      supabase
        .from("raw_material_purchases")
        .select("grand_total, payment_status, paid_amount")
        .eq("business_id", bid)
        .neq("status", "cancelled")
        .is("deleted_at", null)
        .gte("invoice_date", from)
        .lte("invoice_date", to),

      // Payments received from customers
      supabase
        .from("payments")
        .select("amount, payment_mode")
        .eq("business_id", bid)
        .eq("direction", "received")
        .eq("status", "completed")
        .gte("payment_date", from)
        .lte("payment_date", to),

      // Payments made to suppliers
      supabase
        .from("payments")
        .select("amount, payment_mode")
        .eq("business_id", bid)
        .eq("direction", "paid")
        .eq("status", "completed")
        .gte("payment_date", from)
        .lte("payment_date", to),

      // Expenses
      supabase
        .from("expenses")
        .select("amount, category")
        .eq("business_id", bid)
        .neq("status", "cancelled")
        .gte("expense_date", from)
        .lte("expense_date", to),

      // Salary
      supabase
        .from("salary_entries")
        .select("net_salary")
        .eq("business_id", bid)
        .gte("payment_date", from)
        .lte("payment_date", to),

      // Misc income
      supabase
        .from("misc_income")
        .select("amount")
        .eq("business_id", bid)
        .gte("income_date", from)
        .lte("income_date", to),

      // Write-offs (bad debts)
      supabase
        .from("write_offs")
        .select("amount")
        .eq("business_id", bid)
        .gte("write_off_date", from)
        .lte("write_off_date", to),
    ]);

    const bills = salesResult.data ?? [];
    const purchases = purchasesResult.data ?? [];
    const paymentsIn = paymentsReceivedResult.data ?? [];
    const paymentsOut = paymentsMadeResult.data ?? [];
    const expenses = expensesResult.data ?? [];
    const salaries = salaryResult.data ?? [];
    const miscIncome = miscIncomeResult.data ?? [];
    const writeoffs = writeoffsResult.data ?? [];

    // ── P&L Calculations ──
    const totalRevenue = bills.reduce((s, b) => s + Number(b.grand_total), 0);
    const totalMiscIncome = miscIncome.reduce((s, m) => s + Number(m.amount), 0);
    const totalIncome = totalRevenue + totalMiscIncome;

    const totalPurchases = purchases.reduce((s, p) => s + Number(p.grand_total), 0);
    const grossProfit = totalRevenue - totalPurchases;

    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const expBreakdown = expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category ?? "Other"] = (acc[e.category ?? "Other"] || 0) + Number(e.amount);
      return acc;
    }, {});

    const totalSalary = salaries.reduce((s, sl) => s + Number(sl.net_salary), 0);
    const totalWriteoffs = writeoffs.reduce((s, w) => s + Number(w.amount), 0);
    const operatingExpenses = totalExpenses + totalSalary;
    const operatingProfit = grossProfit - operatingExpenses;
    const netProfit = operatingProfit - totalWriteoffs;

    // ── Balance Sheet Calculations ──
    const outstanding = bills.filter(b => b.payment_status !== "paid")
      .reduce((s, b) => s + Number(b.grand_total) - Number(b.paid_amount), 0);
    const payablesRM = purchases.filter(p => p.payment_status !== "paid")
      .reduce((s, p) => s + Number(p.grand_total) - Number(p.paid_amount), 0);

    // ── Cash Flow ──
    const totalCashIn = paymentsIn.reduce((s, p) => s + Number(p.amount), 0);
    const totalCashOut = paymentsOut.reduce((s, p) => s + Number(p.amount), 0);
    const netCashFlow = totalCashIn - totalCashOut;

    const cashByMode = paymentsIn.reduce<Record<string, number>>((acc, p) => {
      acc[p.payment_mode] = (acc[p.payment_mode] || 0) + Number(p.amount);
      return acc;
    }, {});

    // ── GST Summary ──
    const gstBills = await supabase
      .from("sale_bills")
      .select("taxable_amount, cgst, sgst, igst, grand_total, bill_date, bill_number, parties(company_name,name)")
      .eq("business_id", bid)
      .eq("status", "active")
      .is("deleted_at", null)
      .gte("bill_date", from)
      .lte("bill_date", to);

    const gstPurchases = await supabase
      .from("raw_material_purchases")
      .select("total_taxable_value, total_gst_amount, grand_total, invoice_date, purchase_number, parties(company_name,name)")
      .eq("business_id", bid)
      .neq("status", "cancelled")
      .is("deleted_at", null)
      .gte("invoice_date", from)
      .lte("invoice_date", to);

    const totalOutputGST = (gstBills.data ?? []).reduce((s, b) => s + Number(b.cgst) + Number(b.sgst) + Number(b.igst), 0);
    const totalInputGST = (gstPurchases.data ?? []).reduce((s, p) => s + Number(p.total_gst_amount), 0);

    return NextResponse.json({
      from,
      to,
      // Profit & Loss
      pl: {
        income: { revenue: totalRevenue, misc_income: totalMiscIncome, total: totalIncome },
        cogs: totalPurchases,
        gross_profit: grossProfit,
        expenses: { total: totalExpenses, breakdown: expBreakdown },
        salary: totalSalary,
        operating_expenses: operatingExpenses,
        operating_profit: operatingProfit,
        bad_debts: totalWriteoffs,
        net_profit: netProfit,
        net_margin_pct: totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0,
        gross_margin_pct: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
      },
      // Balance Sheet
      balance_sheet: {
        assets: {
          trade_receivables: outstanding,
          cash_and_bank: totalCashIn - totalCashOut,
          inventory_value: 0, // populated by stock valuation separately
        },
        liabilities: {
          trade_payables: payablesRM,
        },
        equity: {
          retained_earnings: netProfit,
        },
      },
      // GST Summary
      gst: {
        summary: {
          net_taxable_sales: (gstBills.data ?? []).reduce((s, b) => s + Number(b.taxable_amount), 0),
          total_output_gst: totalOutputGST,
          net_taxable_purchases: (gstPurchases.data ?? []).reduce((s, p) => s + Number(p.total_taxable_value), 0),
          total_input_gst: totalInputGST,
          net_gst_payable: totalOutputGST - totalInputGST,
        },
        sales_rows: (gstBills.data ?? []).map(b => ({
          number: b.bill_number,
          date: b.bill_date,
          party: (b.parties as any)?.company_name ?? (b.parties as any)?.name ?? "—",
          taxable: Number(b.taxable_amount),
          gst: Number(b.cgst) + Number(b.sgst) + Number(b.igst),
          total: Number(b.grand_total),
        })),
        purchase_rows: (gstPurchases.data ?? []).map(p => ({
          number: p.purchase_number,
          date: p.invoice_date,
          party: (p.parties as any)?.company_name ?? (p.parties as any)?.name ?? "—",
          taxable: Number(p.total_taxable_value),
          gst: Number(p.total_gst_amount),
          total: Number(p.grand_total),
        })),
      },
      // Cash Flow
      cash_flow: {
        net_cash_flow: netCashFlow,
        total_inflows: totalCashIn,
        total_outflows: totalCashOut,
        inflows: {
          customer_payments: paymentsIn.filter(p => !["neft","rtgs","bank_transfer","cheque","upi","cash"].includes("x")).reduce((s, p) => s + Number(p.amount), totalCashIn - totalCashIn) || totalCashIn,
          misc_income: totalMiscIncome,
        },
        outflows: {
          supplier_payments: paymentsOut.reduce((s, p) => s + Number(p.amount), 0),
          expenses: totalExpenses,
          salary: totalSalary,
        },
        by_mode: cashByMode,
        inflow_by_mode: paymentsIn.reduce<Record<string, number>>((acc, p) => {
          acc[p.payment_mode] = (acc[p.payment_mode] || 0) + Number(p.amount);
          return acc;
        }, {}),
        outflow_by_mode: paymentsOut.reduce<Record<string, number>>((acc, p) => {
          acc[p.payment_mode] = (acc[p.payment_mode] || 0) + Number(p.amount);
          return acc;
        }, {}),
      },
    });
  } catch (err: any) {
    console.error("[reports/financial]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
