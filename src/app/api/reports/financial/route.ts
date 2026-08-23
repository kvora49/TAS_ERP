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
  const billType = searchParams.get("bill_type"); // 'kacha' | 'pakka' | null = all
  const bid = businessId;

  try {
    let salesQuery = supabase
      .from("sale_bills")
      .select("grand_total, bill_type, payment_status, paid_amount")
      .eq("business_id", bid)
      .eq("status", "active")
      .is("deleted_at", null)
      .gte("bill_date", from)
      .lte("bill_date", to);

    let rawPurchasesQuery = supabase
      .from("raw_material_purchases")
      .select("grand_total, payment_status, paid_amount, gst_type")
      .eq("business_id", bid)
      .neq("status", "cancelled")
      .is("deleted_at", null)
      .gte("invoice_date", from)
      .lte("invoice_date", to);

    let finishedPurchasesQuery = supabase
      .from("purchase_bills")
      .select("grand_total, payment_status, paid_amount")
      .eq("business_id", bid)
      .neq("status", "cancelled")
      .gte("invoice_date", from)
      .lte("invoice_date", to);

    if (billType && (billType === "kacha" || billType === "pakka")) {
      salesQuery = salesQuery.eq("bill_type", billType);
      if (billType === "kacha") {
        rawPurchasesQuery = rawPurchasesQuery.eq("gst_type", "without_gst");
      } else {
        rawPurchasesQuery = rawPurchasesQuery.neq("gst_type", "without_gst");
      }
    }

    // Run all queries in parallel
    const [
      salesResult,
      purchasesResult,
      finishedPurchasesResult,
      paymentsReceivedResult,
      paymentsMadeResult,
      jobWorkPaymentsResult,
      expensesResult,
      salaryResult,
      miscIncomeResult,
      writeoffsResult,
      bankAccountsResult,
    ] = await Promise.all([
      salesQuery,
      rawPurchasesQuery,
      finishedPurchasesQuery,

      // Payments received from customers
      supabase
        .from("payments")
        .select("amount, payment_mode, bank_account:bank_accounts(id, name, type, account_category)")
        .eq("business_id", bid)
        .eq("direction", "received")
        .neq("status", "cancelled")
        .gte("payment_date", from)
        .lte("payment_date", to),

      // Payments made to suppliers
      supabase
        .from("payments")
        .select("amount, payment_mode, bank_account:bank_accounts(id, name, type, account_category)")
        .eq("business_id", bid)
        .eq("direction", "paid")
        .neq("status", "cancelled")
        .gte("payment_date", from)
        .lte("payment_date", to),

      // Job work payments to workers
      supabase
        .from("job_work_payments")
        .select("paid_amount, payment_mode, payment_date")
        .eq("business_id", bid)
        .neq("status", "cancelled")
        .gte("payment_date", from)
        .lte("payment_date", to),

      // Expenses
      supabase
        .from("expenses")
        .select("amount, gst_amount, expense_type:expense_types(name)")
        .eq("business_id", bid)
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
        .gte("written_off_at", from)
        .lte("written_off_at", to),

      // Bank accounts live balances
      supabase
        .from("bank_accounts")
        .select("id, name, bank_name, type, account_category, current_balance")
        .eq("business_id", bid)
        .is("deleted_at", null),
    ]);

    const bills = salesResult.data ?? [];
    const purchases = [...(purchasesResult.data ?? []), ...(finishedPurchasesResult.data ?? [])];
    const paymentsIn = paymentsReceivedResult.data ?? [];
    const paymentsOut = [
      ...(paymentsMadeResult.data ?? []),
      ...((jobWorkPaymentsResult.data ?? []).map((jwp: any) => ({
        amount: jwp.paid_amount,
        payment_mode: jwp.payment_mode || "bank_transfer",
        bank_account: null,
      }))),
    ];
    const expenses = expensesResult.data ?? [];
    const salaries = salaryResult.data ?? [];
    const miscIncome = miscIncomeResult.data ?? [];
    const writeoffs = writeoffsResult.data ?? [];
    const bankAccounts = (bankAccountsResult as any)?.data ?? [];

    // ── P&L Calculations ──
    const totalRevenue = bills.reduce((s, b) => s + Number(b.grand_total), 0);
    const totalMiscIncome = miscIncome.reduce((s, m) => s + Number(m.amount), 0);
    const totalIncome = totalRevenue + totalMiscIncome;

    const totalPurchases = purchases.reduce((s, p) => s + Number(p.grand_total), 0);
    const grossProfit = totalRevenue - totalPurchases;

    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const expBreakdown = expenses.reduce<Record<string, number>>((acc, e) => {
      const catName = (e.expense_type as any)?.name ?? "General Expense";
      acc[catName] = (acc[catName] || 0) + Number(e.amount);
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

    const totalBankBalance = bankAccounts.reduce((s: number, b: any) => s + Number(b.current_balance || 0), 0);
    const pakkaBankBalance = bankAccounts
      .filter((b: any) => b.account_category === "pakka" || b.account_category === "both")
      .reduce((s: number, b: any) => s + Number(b.current_balance || 0), 0);
    const kachaBankBalance = bankAccounts
      .filter((b: any) => b.account_category === "kacha" || b.type === "cash")
      .reduce((s: number, b: any) => s + Number(b.current_balance || 0), 0);

    // ── Cash Flow ──
    const totalCashIn = paymentsIn.reduce((s, p) => s + Number(p.amount), 0);
    const totalCashOut = paymentsOut.reduce((s, p) => s + Number(p.amount), 0);
    const netCashFlow = totalCashIn - totalCashOut;

    const pakkaCashIn = paymentsIn
      .filter((p: any) => p.bank_account?.account_category === "pakka" || p.bank_account?.account_category === "both" || (!p.bank_account && p.payment_mode !== "cash"))
      .reduce((s, p) => s + Number(p.amount), 0);
    const kachaCashIn = paymentsIn
      .filter((p: any) => p.bank_account?.account_category === "kacha" || p.payment_mode === "cash")
      .reduce((s, p) => s + Number(p.amount), 0);

    const pakkaCashOut = paymentsOut
      .filter((p: any) => p.bank_account?.account_category === "pakka" || p.bank_account?.account_category === "both" || (!p.bank_account && p.payment_mode !== "cash"))
      .reduce((s, p) => s + Number(p.amount), 0);
    const kachaCashOut = paymentsOut
      .filter((p: any) => p.bank_account?.account_category === "kacha" || p.payment_mode === "cash")
      .reduce((s, p) => s + Number(p.amount), 0);

    const cashByMode = paymentsIn.reduce<Record<string, number>>((acc, p) => {
      acc[p.payment_mode] = (acc[p.payment_mode] || 0) + Number(p.amount);
      return acc;
    }, {});

    // ── GST Summary ──
    let gstBillsQuery = supabase
      .from("sale_bills")
      .select("taxable_amount, cgst, sgst, igst, grand_total, bill_date, bill_number, parties(company_name,name)")
      .eq("business_id", bid)
      .eq("status", "active")
      .is("deleted_at", null)
      .gte("bill_date", from)
      .lte("bill_date", to);

    if (billType && (billType === "kacha" || billType === "pakka")) {
      gstBillsQuery = gstBillsQuery.eq("bill_type", billType);
    }

    const gstBills = await gstBillsQuery;

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
          cash_and_bank: totalBankBalance > 0 ? totalBankBalance : totalCashIn - totalCashOut,
          pakka_bank_balance: pakkaBankBalance,
          kacha_bank_balance: kachaBankBalance,
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
        pakka_inflow: pakkaCashIn,
        kacha_inflow: kachaCashIn,
        pakka_outflow: pakkaCashOut,
        kacha_outflow: kachaCashOut,
        net_pakka_flow: pakkaCashIn - pakkaCashOut,
        net_kacha_flow: kachaCashIn - kachaCashOut,
        inflows: {
          customer_payments: totalCashIn,
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
