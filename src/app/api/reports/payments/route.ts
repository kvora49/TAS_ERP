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
  const bid = userData.business_id;

  try {
    if (tab === "receivables") {
      // Outstanding from customers = sale_bills not fully paid
      const { data: bills } = await supabase
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
      const [rmResult, pgResult] = await Promise.all([
        supabase.from("raw_material_purchases")
          .select(`id, purchase_number, invoice_date, grand_total, paid_amount, payment_status, parties!inner(id, name, company_name)`)
          .eq("business_id", bid).neq("payment_status", "paid").neq("status", "cancelled").is("deleted_at", null).lte("invoice_date", to),
        supabase.from("purchase_bills")
          .select(`id, bill_number, invoice_date, grand_total, paid_amount, payment_status, parties!inner(id, name, company_name)`)
          .eq("business_id", bid).neq("payment_status", "paid").neq("status", "cancelled").lte("invoice_date", to),
      ]);

      const rmRows = (rmResult.data ?? []).map(p => ({
        id: p.id, number: p.purchase_number, date: p.invoice_date, type: "Raw Material",
        party: (p.parties as any)?.company_name ?? (p.parties as any)?.name ?? "—",
        total: Number(p.grand_total), paid: Number(p.paid_amount),
        outstanding: Number(p.grand_total) - Number(p.paid_amount), status: p.payment_status,
      }));
      const pgRows = (pgResult.data ?? []).map(p => ({
        id: p.id, number: p.bill_number, date: p.invoice_date, type: "Finished Goods",
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

    // UPI / Bank / Cash / Combined — filter payments table by payment_mode
    const modeFilter: Record<string, string[]> = {
      upi: ["upi"],
      bank: ["bank_transfer", "neft", "rtgs", "cheque"],
      cash: ["cash"],
      combined: ["cash", "bank_transfer", "neft", "rtgs", "cheque", "upi"],
    };

    const modes = modeFilter[tab] ?? modeFilter["combined"];

    const { data: paymentsData } = await supabase
      .from("payments")
      .select(`
        id, payment_number, payment_date, direction, payment_mode,
        amount, reference_no, remarks, status,
        parties!inner(id, name, company_name)
      `)
      .eq("business_id", bid)
      .eq("status", "completed")
      .in("payment_mode", modes)
      .gte("payment_date", from)
      .lte("payment_date", to)
      .order("payment_date", { ascending: false });

    const rows = (paymentsData ?? []).map(p => ({
      id: p.id,
      number: p.payment_number,
      date: p.payment_date,
      direction: p.direction,
      mode: p.payment_mode,
      party: (p.parties as any)?.company_name ?? (p.parties as any)?.name ?? "—",
      amount: Number(p.amount),
      reference: p.reference_no ?? "—",
      remarks: p.remarks ?? "—",
    }));

    const totalIn = rows.filter(r => r.direction === "received").reduce((s, r) => s + r.amount, 0);
    const totalOut = rows.filter(r => r.direction === "paid").reduce((s, r) => s + r.amount, 0);

    const byMode = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.mode] = (acc[r.mode] || 0) + r.amount;
      return acc;
    }, {});

    const monthMap: Record<string, { received: number; paid: number }> = {};
    for (const r of rows) {
      const m = r.date.slice(0, 7);
      if (!monthMap[m]) monthMap[m] = { received: 0, paid: 0 };
      if (r.direction === "received") monthMap[m].received += r.amount;
      else monthMap[m].paid += r.amount;
    }
    const monthlyTrend = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, vals]) => ({
        month: new Date(month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
        received: vals.received,
        paid: vals.paid,
      }));

    return NextResponse.json({
      tab, from, to, rows,
      summary: { totalIn, totalOut, net: totalIn - totalOut, totalTransactions: rows.length },
      byMode,
      monthlyTrend,
    });
  } catch (err: any) {
    console.error("[reports/payments]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
