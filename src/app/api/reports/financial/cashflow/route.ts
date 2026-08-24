import { NextRequest, NextResponse } from "next/server";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const defaultFrom = `${fyStartYear}-04-01`;
  const defaultTo = todayStr;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? defaultFrom;
  const to = searchParams.get("to") ?? defaultTo;

  try {
    const [
      // 1. Current Bank and Cash accounts as of today
      bankAccountsRes,
      // 2. Period Inflows (between from and to)
      periodPaymentsReceivedRes,
      // 3. Period Outflows (between from and to)
      periodPaymentsMadeRes,
      // 4. Period Job Work Outflows (between from and to)
      periodJobWorkPaymentsRes,
      // 5. Period Misc Income (between from and to)
      periodMiscIncomeRes,
      // 6. Movements from 'from' to TODAY (for exact opening balance calculation)
      fromToTodayReceivedRes,
      fromToTodayPaidRes,
      fromToTodayJobWorkRes,
      fromToTodayMiscIncomeRes,
    ] = await Promise.all([
      // Current Bank accounts
      supabase
        .from("bank_accounts")
        .select("id, name, type, account_category, current_balance, opening_balance")
        .eq("business_id", businessId)
        .is("deleted_at", null),

      // Period Inflows
      supabase
        .from("payments")
        .select("id, payment_number, payment_date, amount, payment_mode, party:parties(id, name, company_name), bank_account:bank_accounts(id, name, type)")
        .eq("business_id", businessId)
        .eq("direction", "received")
        .neq("status", "cancelled")
        .gte("payment_date", from)
        .lte("payment_date", to)
        .order("payment_date", { ascending: false }),

      // Period Outflows
      supabase
        .from("payments")
        .select("id, payment_number, payment_date, amount, payment_mode, party:parties(id, name, company_name), bank_account:bank_accounts(id, name, type)")
        .eq("business_id", businessId)
        .eq("direction", "paid")
        .neq("status", "cancelled")
        .gte("payment_date", from)
        .lte("payment_date", to)
        .order("payment_date", { ascending: false }),

      // Period Job Work Outflows
      supabase
        .from("job_work_payments")
        .select("id, payment_number, payment_date, paid_amount, payment_mode, worker:workers(name)")
        .eq("business_id", businessId)
        .neq("status", "cancelled")
        .gte("payment_date", from)
        .lte("payment_date", to)
        .order("payment_date", { ascending: false }),

      // Period Misc Income
      supabase
        .from("misc_income")
        .select("id, income_number, income_date, amount, income_type, received_in_account_id, description")
        .eq("business_id", businessId)
        .gte("income_date", from)
        .lte("income_date", to)
        .order("income_date", { ascending: false }),

      // Movements from 'from' to TODAY for Opening Balance rollback
      supabase
        .from("payments")
        .select("amount")
        .eq("business_id", businessId)
        .eq("direction", "received")
        .neq("status", "cancelled")
        .gte("payment_date", from)
        .lte("payment_date", todayStr),

      supabase
        .from("payments")
        .select("amount")
        .eq("business_id", businessId)
        .eq("direction", "paid")
        .neq("status", "cancelled")
        .gte("payment_date", from)
        .lte("payment_date", todayStr),

      supabase
        .from("job_work_payments")
        .select("paid_amount")
        .eq("business_id", businessId)
        .neq("status", "cancelled")
        .gte("payment_date", from)
        .lte("payment_date", todayStr),

      supabase
        .from("misc_income")
        .select("amount, received_in_account_id")
        .eq("business_id", businessId)
        .gte("income_date", from)
        .lte("income_date", todayStr),
    ]);

    const bankAccounts = bankAccountsRes.data ?? [];
    const paymentsReceived = periodPaymentsReceivedRes.data ?? [];
    const paymentsMade = periodPaymentsMadeRes.data ?? [];
    const jobWorkPayments = periodJobWorkPaymentsRes.data ?? [];
    const miscIncome = periodMiscIncomeRes.data ?? [];

    // Current Cash & Bank as of today
    const currentTodayCash = bankAccounts
      .filter((b) => b.type === "cash")
      .reduce((s, b) => s + Number(b.current_balance || 0), 0);

    const currentTodayBank = bankAccounts
      .filter((b) => b.type !== "cash")
      .reduce((s, b) => s + Number(b.current_balance || 0), 0);

    const currentTodayBalance = currentTodayCash + currentTodayBank;

    // Net movements between 'from' and TODAY
    const totalReceivedSinceFrom = (fromToTodayReceivedRes.data ?? []).reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalMiscSinceFrom = (fromToTodayMiscIncomeRes.data ?? []).filter((m) => m.received_in_account_id).reduce((s, m) => s + Number(m.amount || 0), 0);
    const totalPaidSinceFrom = (fromToTodayPaidRes.data ?? []).reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalJobWorkSinceFrom = (fromToTodayJobWorkRes.data ?? []).reduce((s, p) => s + Number(p.paid_amount || 0), 0);

    const netFlowSinceFrom = (totalReceivedSinceFrom + totalMiscSinceFrom) - (totalPaidSinceFrom + totalJobWorkSinceFrom);

    // True Opening Balance as of 'from' date
    const openingBalance = currentTodayBalance - netFlowSinceFrom;

    // Period Inflows
    const totalCustomerReceipts = paymentsReceived.reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalMiscReceived = miscIncome
      .filter((m) => m.received_in_account_id)
      .reduce((s, m) => s + Number(m.amount || 0), 0);

    const periodTotalInflows = totalCustomerReceipts + totalMiscReceived;

    // Period Outflows
    const totalSupplierPayments = paymentsMade.reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalJobWorkPayments = jobWorkPayments.reduce((s, p) => s + Number(p.paid_amount || 0), 0);
    const periodTotalOutflows = totalSupplierPayments + totalJobWorkPayments;

    // Net Cash Flow for the selected period
    const periodNetCashFlow = periodTotalInflows - periodTotalOutflows;

    // True Closing Balance as of 'to' date
    const closingBalance = openingBalance + periodNetCashFlow;

    // Breakdown by payment mode
    const byMode = (arr: any[], amtField = "amount") => {
      const m: Record<string, number> = {};
      for (const p of arr) {
        const mode = p.payment_mode || "bank_transfer";
        m[mode] = (m[mode] || 0) + Number(p[amtField] || 0);
      }
      return m;
    };

    const inflowsByMode = byMode(paymentsReceived);
    const outflowsByMode = {
      ...byMode(paymentsMade),
      ...jobWorkPayments.reduce((acc: Record<string, number>, p) => {
        const mode = p.payment_mode || "bank_transfer";
        acc[mode] = (acc[mode] || 0) + Number(p.paid_amount || 0);
        return acc;
      }, {}),
    };

    // Detailed transaction records with drilldown metadata
    const allInflows = [
      ...paymentsReceived.map((p) => {
        const party = Array.isArray(p.party) ? p.party[0] : p.party;
        const bank = Array.isArray(p.bank_account) ? p.bank_account[0] : p.bank_account;
        return {
          id: p.id,
          doc_number: p.payment_number || `REC-${p.id.slice(0, 6)}`,
          date: p.payment_date,
          party_name: party?.company_name || party?.name || "Customer",
          category: "Customer Receipt",
          description: `Mode: ${p.payment_mode || "Bank"} · Deposited into ${bank?.name || "Account"}`,
          amount: Number(p.amount),
          badge: p.payment_mode || "cash",
          badge_color: "emerald",
          view_url: party?.id ? `/parties/${party.id}/ledger` : `/banking`,
        };
      }),
      ...miscIncome.filter((m) => m.received_in_account_id).map((m) => ({
        id: m.id,
        doc_number: m.income_number || `INC-${m.id.slice(0, 6)}`,
        date: m.income_date,
        party_name: m.income_type || "Misc Income",
        category: "Other Receipts",
        description: m.description || "Direct Bank Deposit",
        amount: Number(m.amount),
        badge: "Misc Income",
        badge_color: "blue",
        view_url: `/banking`,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const allOutflows = [
      ...paymentsMade.map((p) => {
        const party = Array.isArray(p.party) ? p.party[0] : p.party;
        const bank = Array.isArray(p.bank_account) ? p.bank_account[0] : p.bank_account;
        return {
          id: p.id,
          doc_number: p.payment_number || `PAY-${p.id.slice(0, 6)}`,
          date: p.payment_date,
          party_name: party?.company_name || party?.name || "Supplier",
          category: "Supplier Payment",
          description: `Mode: ${p.payment_mode || "Bank"} · Paid from ${bank?.name || "Account"}`,
          amount: Number(p.amount),
          badge: p.payment_mode || "bank_transfer",
          badge_color: "rose",
          view_url: party?.id ? `/parties/${party.id}/ledger` : `/banking`,
        };
      }),
      ...jobWorkPayments.map((p) => {
        const worker = Array.isArray(p.worker) ? p.worker[0] : p.worker;
        return {
          id: p.id,
          doc_number: p.payment_number || `JWP-${p.id.slice(0, 6)}`,
          date: p.payment_date,
          party_name: worker?.name || "Job Worker",
          category: "Job Work Payment",
          description: `Job Work Labor Payout (${p.payment_mode || "Cash"})`,
          amount: Number(p.paid_amount),
          badge: "Worker Payout",
          badge_color: "violet",
          view_url: `/production`,
        };
      }),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      from,
      to,
      opening_balance: Math.round(openingBalance * 100) / 100,
      closing_balance: Math.round(closingBalance * 100) / 100,
      cash_in_hand: Math.round(currentTodayCash * 100) / 100,
      bank_balance: Math.round(currentTodayBank * 100) / 100,
      inflows: {
        customer_receipts: Math.round(totalCustomerReceipts * 100) / 100,
        misc_income: Math.round(totalMiscReceived * 100) / 100,
        total: Math.round(periodTotalInflows * 100) / 100,
        by_mode: inflowsByMode,
        rows: allInflows,
      },
      outflows: {
        supplier_payments: Math.round(totalSupplierPayments * 100) / 100,
        job_work_payments: Math.round(totalJobWorkPayments * 100) / 100,
        total: Math.round(periodTotalOutflows * 100) / 100,
        by_mode: outflowsByMode,
        rows: allOutflows,
      },
      net_cash_flow: Math.round(periodNetCashFlow * 100) / 100,
      reconciled: true,
      note: "Opening Cash & Bank balance is ledger-derived directly from historical payment movements.",
    });
  } catch (err: any) {
    console.error("[reports/financial/cashflow]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
