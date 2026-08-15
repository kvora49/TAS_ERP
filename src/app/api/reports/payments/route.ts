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
  const tab = searchParams.get("tab") ?? "receivables";
  const billType = searchParams.get("bill_type"); // 'kacha' | 'pakka' | null
  const partyId = searchParams.get("party_id");
  const agingBucket = searchParams.get("aging_bucket");
  const bid = userData.business_id;

  try {
    if (tab === "receivables") {
      let billsQuery = supabase
        .from("sale_bills")
        .select(`
          id, bill_number, bill_date, bill_type, grand_total, paid_amount, payment_status,
          parties!inner(id, name, company_name)
        `)
        .eq("business_id", bid)
        .eq("status", "active")
        .is("deleted_at", null)
        .neq("payment_status", "paid")
        .lte("bill_date", to)
        .order("bill_date");

      if (billType && (billType === "kacha" || billType === "pakka")) {
        billsQuery = billsQuery.eq("bill_type", billType);
      }

      if (partyId && partyId !== "all") {
        billsQuery = billsQuery.eq("party_id", partyId);
      }

      const { data: bills } = await billsQuery;


      const rows = (bills ?? []).map(b => ({
        id: b.id,
        number: b.bill_number,
        date: b.bill_date,
        bill_type: b.bill_type,
        party: (b.parties as any)?.company_name ?? (b.parties as any)?.name ?? "—",
        total: Number(b.grand_total),
        paid: Number(b.paid_amount),
        outstanding: Number(b.grand_total) - Number(b.paid_amount),
        status: b.payment_status,
      }));

      const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);
      const totalBills = rows.length;

      // Aging buckets
      const today = new Date();
      const aging = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
      for (const r of rows) {
        const days = Math.floor((today.getTime() - new Date(r.date).getTime()) / 86400000);
        if (days <= 30) aging["0-30"] += r.outstanding;
        else if (days <= 60) aging["31-60"] += r.outstanding;
        else if (days <= 90) aging["61-90"] += r.outstanding;
        else aging["90+"] += r.outstanding;
      }

      return NextResponse.json({ tab, from, to, rows, summary: { totalOutstanding, totalBills, totalPaid: (bills ?? []).reduce((s, b) => s + Number(b.paid_amount), 0) }, aging });
    }

    if (tab === "payables") {
      // Outstanding to suppliers = raw_material_purchases + purchase_bills not fully paid
      let rmQuery = supabase.from("raw_material_purchases")
        .select(`id, purchase_number, invoice_date, grand_total, paid_amount, payment_status, gst_type, parties!inner(id, name, company_name)`)
        .eq("business_id", bid).neq("payment_status", "paid").neq("status", "cancelled").is("deleted_at", null).lte("invoice_date", to);

      let pgQuery = supabase.from("purchase_bills")
        .select(`id, bill_number, invoice_date, grand_total, paid_amount, payment_status, bill_type, parties!inner(id, name, company_name)`)
        .eq("business_id", bid).neq("payment_status", "paid").neq("status", "cancelled").lte("invoice_date", to);

      if (billType && (billType === "kacha" || billType === "pakka")) {
        if (billType === "kacha") {
          rmQuery = rmQuery.eq("gst_type", "without_gst");
          pgQuery = pgQuery.eq("bill_type", "kacha");
        } else {
          rmQuery = rmQuery.neq("gst_type", "without_gst");
          pgQuery = pgQuery.eq("bill_type", "pakka");
        }
      }

      if (partyId && partyId !== "all") {
        rmQuery = rmQuery.eq("party_id", partyId);
        pgQuery = pgQuery.eq("party_id", partyId);
      }

      const [rmResult, pgResult] = await Promise.all([rmQuery, pgQuery]);

      const rmRows = (rmResult.data ?? []).map(p => ({
        id: p.id, number: p.purchase_number, date: p.invoice_date, type: "Raw Material",
        bill_type: p.gst_type === "without_gst" ? "kacha" : "pakka",
        party: (p.parties as any)?.company_name ?? (p.parties as any)?.name ?? "—",
        total: Number(p.grand_total), paid: Number(p.paid_amount),
        outstanding: Number(p.grand_total) - Number(p.paid_amount), status: p.payment_status,
      }));
      const pgRows = (pgResult.data ?? []).map(p => ({
        id: p.id, number: p.bill_number, date: p.invoice_date, type: "Finished Goods",
        bill_type: p.bill_type === "kacha" ? "kacha" : "pakka",
        party: (p.parties as any)?.company_name ?? (p.parties as any)?.name ?? "—",
        total: Number(p.grand_total), paid: Number(p.paid_amount),
        outstanding: Number(p.grand_total) - Number(p.paid_amount), status: p.payment_status,
      }));
      const rows = [...rmRows, ...pgRows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);

      const today = new Date();
      const aging = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
      for (const r of rows) {
        const days = Math.floor((today.getTime() - new Date(r.date).getTime()) / 86400000);
        if (days <= 30) aging["0-30"] += r.outstanding;
        else if (days <= 60) aging["31-60"] += r.outstanding;
        else if (days <= 90) aging["61-90"] += r.outstanding;
        else aging["90+"] += r.outstanding;
      }

      return NextResponse.json({ tab, from, to, rows, summary: { totalOutstanding, totalBills: rows.length }, aging });
    }

    const accountCategory = searchParams.get("account_category"); // 'all' | 'pakka' | 'kacha'
    const direction = searchParams.get("direction"); // 'all' | 'received' | 'paid'

    // UPI / Bank / Cash / Combined — filter payments table by payment_mode
    const modeFilter: Record<string, string[]> = {
      upi: ["upi"],
      bank: ["bank_transfer", "neft", "rtgs", "cheque"],
      cash: ["cash"],
      combined: ["cash", "bank_transfer", "neft", "rtgs", "cheque", "upi"],
    };

    const modes = modeFilter[tab] ?? modeFilter["combined"];

    let paymentsQuery = supabase
      .from("payments")
      .select(`
        id, payment_number, payment_date, direction, payment_mode,
        amount, reference_no, remarks, status, bank_account_id,
        bank_account:bank_accounts(id, name, bank_name, type, account_category),
        parties!inner(id, name, company_name)
      `)
      .eq("business_id", bid)
      .eq("status", "completed")
      .in("payment_mode", modes)
      .gte("payment_date", from)
      .lte("payment_date", to)
      .order("payment_date", { ascending: false });

    if (direction && (direction === "received" || direction === "paid")) {
      paymentsQuery = paymentsQuery.eq("direction", direction);
    }

    if (partyId && partyId !== "all") {
      paymentsQuery = paymentsQuery.eq("party_id", partyId);
    }

    const { data: paymentsData, error: payError } = await paymentsQuery;
    if (payError) throw payError;

    const allPaymentRows = (paymentsData ?? []).map((p: any) => {
      const ba = p.bank_account as any;
      const category = ba?.account_category || (p.payment_mode === "cash" ? "kacha" : "pakka");
      return {
        id: p.id,
        number: p.payment_number,
        date: p.payment_date,
        direction: p.direction,
        mode: p.payment_mode,
        account_name: ba?.name || (p.payment_mode === "cash" ? "Cash Register" : "Bank Account"),
        account_category: category,
        party: (p.parties as any)?.company_name ?? (p.parties as any)?.name ?? "—",
        amount: Number(p.amount),
        reference: p.reference_no ?? "—",
        remarks: p.remarks ?? "—",
      };
    });

    const rows = accountCategory && accountCategory !== "all"
      ? allPaymentRows.filter(r => r.account_category === accountCategory || r.account_category === "both")
      : allPaymentRows;

    const totalIn = rows.filter(r => r.direction === "received").reduce((s, r) => s + r.amount, 0);
    const totalOut = rows.filter(r => r.direction === "paid").reduce((s, r) => s + r.amount, 0);

    const totalInPakka = rows.filter(r => r.direction === "received" && (r.account_category === "pakka" || r.account_category === "both")).reduce((s, r) => s + r.amount, 0);
    const totalInKacha = rows.filter(r => r.direction === "received" && r.account_category === "kacha").reduce((s, r) => s + r.amount, 0);

    const totalOutPakka = rows.filter(r => r.direction === "paid" && (r.account_category === "pakka" || r.account_category === "both")).reduce((s, r) => s + r.amount, 0);
    const totalOutKacha = rows.filter(r => r.direction === "paid" && r.account_category === "kacha").reduce((s, r) => s + r.amount, 0);

    const byMode = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.mode] = (acc[r.mode] || 0) + r.amount;
      return acc;
    }, {});

    const byCategory = {
      pakka: {
        received: totalInPakka,
        paid: totalOutPakka,
        net: totalInPakka - totalOutPakka,
      },
      kacha: {
        received: totalInKacha,
        paid: totalOutKacha,
        net: totalInKacha - totalOutKacha,
      },
    };

    const monthMap: Record<string, { received: number; paid: number; pakkaIn: number; kachaIn: number; pakkaOut: number; kachaOut: number }> = {};
    for (const r of rows) {
      const m = r.date.slice(0, 7);
      if (!monthMap[m]) {
        monthMap[m] = { received: 0, paid: 0, pakkaIn: 0, kachaIn: 0, pakkaOut: 0, kachaOut: 0 };
      }
      if (r.direction === "received") {
        monthMap[m].received += r.amount;
        if (r.account_category === "kacha") monthMap[m].kachaIn += r.amount;
        else monthMap[m].pakkaIn += r.amount;
      } else {
        monthMap[m].paid += r.amount;
        if (r.account_category === "kacha") monthMap[m].kachaOut += r.amount;
        else monthMap[m].pakkaOut += r.amount;
      }
    }
    const monthlyTrend = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, vals]) => ({
        month: new Date(month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
        received: vals.received,
        paid: vals.paid,
        pakkaIn: vals.pakkaIn,
        kachaIn: vals.kachaIn,
        pakkaOut: vals.pakkaOut,
        kachaOut: vals.kachaOut,
      }));

    return NextResponse.json({
      tab,
      from,
      to,
      account_category: accountCategory ?? "all",
      direction: direction ?? "all",
      rows,
      summary: {
        totalIn,
        totalOut,
        net: totalIn - totalOut,
        totalInPakka,
        totalInKacha,
        totalOutPakka,
        totalOutKacha,
        totalTransactions: rows.length,
      },
      byCategory,
      byMode,
      monthlyTrend,
    });
  } catch (err: any) {
    console.error("[reports/payments]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
