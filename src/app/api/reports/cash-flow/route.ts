import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const defaultFrom = `${fyStartYear}-04-01`;

  const { searchParams } = new URL(request.url);
  const fromDate = searchParams.get("from") || defaultFrom;
  const toDate = searchParams.get("to") || today.toISOString().split("T")[0];

  try {
    const [paymentsInResult, paymentsOutResult, jobWorkPaymentsResult, expensesResult, salaryResult, miscIncomeResult] = await Promise.all([
      supabase.from("payments").select("amount, payment_date, payment_mode, direction, bank_account:bank_accounts(id, name, account_category)")
        .eq("business_id", businessId).eq("direction", "received")
        .neq("status", "cancelled")
        .gte("payment_date", fromDate).lte("payment_date", toDate),
      supabase.from("payments").select("amount, payment_date, payment_mode, direction, bank_account:bank_accounts(id, name, account_category)")
        .eq("business_id", businessId).eq("direction", "paid")
        .neq("status", "cancelled")
        .gte("payment_date", fromDate).lte("payment_date", toDate),
      supabase.from("job_work_payments").select("paid_amount, payment_mode, payment_date")
        .eq("business_id", businessId).neq("status", "cancelled")
        .gte("payment_date", fromDate).lte("payment_date", toDate),
      supabase.from("expenses").select("amount, gst_amount, expense_date")
        .eq("business_id", businessId).neq("status", "cancelled")
        .gte("expense_date", fromDate).lte("expense_date", toDate),
      supabase.from("salary_entries").select("net_salary, payment_date")
        .eq("business_id", businessId).gte("payment_date", fromDate).lte("payment_date", toDate),
      supabase.from("misc_income").select("amount, income_date")
        .eq("business_id", businessId).gte("income_date", fromDate).lte("income_date", toDate),
    ]);

    const paymentsIn = paymentsInResult.data || [];
    const regularPaymentsOut = paymentsOutResult.data || [];
    const jobWorkPayments = (jobWorkPaymentsResult.data || []).map((jwp: any) => ({
      amount: jwp.paid_amount,
      payment_date: jwp.payment_date,
      payment_mode: jwp.payment_mode || "bank_transfer",
      direction: "paid",
      bank_account: null,
    }));
    const paymentsOut = [...regularPaymentsOut, ...jobWorkPayments];

    const pakkaInflow = paymentsIn
      .filter((p: any) => p.bank_account?.account_category === "pakka" || p.bank_account?.account_category === "both" || (!p.bank_account && p.payment_mode !== "cash"))
      .reduce((s, p) => s + Number(p.amount), 0);
    const kachaInflow = paymentsIn
      .filter((p: any) => p.bank_account?.account_category === "kacha" || p.payment_mode === "cash")
      .reduce((s, p) => s + Number(p.amount), 0);

    const pakkaOutflow = paymentsOut
      .filter((p: any) => p.bank_account?.account_category === "pakka" || p.bank_account?.account_category === "both" || (!p.bank_account && p.payment_mode !== "cash"))
      .reduce((s, p) => s + Number(p.amount), 0);
    const kachaOutflow = paymentsOut
      .filter((p: any) => p.bank_account?.account_category === "kacha" || p.payment_mode === "cash")
      .reduce((s, p) => s + Number(p.amount), 0);

    const inflows = {
      customer_payments: paymentsIn.reduce((s, p) => s + Number(p.amount), 0),
      misc_income: (miscIncomeResult.data || []).reduce((s, m) => s + Number(m.amount), 0),
      pakka_payments: pakkaInflow,
      kacha_payments: kachaInflow,
    };
    const outflows = {
      supplier_payments: regularPaymentsOut.reduce((s, p) => s + Number(p.amount), 0),
      job_work_payments: jobWorkPayments.reduce((s, p) => s + Number(p.amount), 0),
      expenses: (expensesResult.data || []).reduce((s, e) => s + Number(e.amount) + Number(e.gst_amount || 0), 0),
      salary: (salaryResult.data || []).reduce((s, e) => s + Number(e.net_salary), 0),
      pakka_payments: pakkaOutflow,
      kacha_payments: kachaOutflow,
    };

    const totalInflows = inflows.customer_payments + inflows.misc_income;
    const totalOutflows = outflows.supplier_payments + outflows.job_work_payments + outflows.expenses + outflows.salary;
    const netCashFlow = totalInflows - totalOutflows;

    return NextResponse.json({
      from: fromDate, to: toDate,
      inflows, outflows,
      total_inflows: totalInflows,
      total_outflows: totalOutflows,
      net_cash_flow: netCashFlow,
      pakka_inflow: pakkaInflow,
      kacha_inflow: kachaInflow,
      pakka_outflow: pakkaOutflow,
      kacha_outflow: kachaOutflow,
      net_pakka_flow: pakkaInflow - pakkaOutflow,
      net_kacha_flow: kachaInflow - kachaOutflow,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
