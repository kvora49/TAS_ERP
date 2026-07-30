import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userData } = await supabase.from("users").select("business_id").eq("id", user.id).single();
  if (!userData?.business_id) return NextResponse.json({ error: "No business" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const partyId = searchParams.get("party_id");
  const from = searchParams.get("from") ?? `${new Date().getFullYear()}-04-01`;
  const to = searchParams.get("to") ?? new Date().toISOString().split("T")[0];
  const bid = userData.business_id;

  if (!partyId) {
    // Return parties list
    const { data: parties } = await supabase
      .from("parties")
      .select("id, name, company_name, type, phone, gstin")
      .eq("business_id", bid)
      .is("deleted_at", null)
      .order("name");
    return NextResponse.json({ parties: parties ?? [] });
  }

  try {
    const [
      partyRes,
      purchasesRes,
      purchaseBillsRes,
      saleBillsRes,
      paymentsRes,
      writeOffsRes,
      creditNotesRes,
      debitNotesRes,
    ] = await Promise.all([
      supabase.from("parties").select("*").eq("id", partyId).eq("business_id", bid).single(),
      supabase.from("raw_material_purchases").select("id, purchase_number, invoice_date, grand_total").eq("supplier_id", partyId).eq("business_id", bid).neq("status", "cancelled").is("deleted_at", null),
      supabase.from("purchase_bills").select("id, bill_number, invoice_date, grand_total").eq("supplier_id", partyId).eq("business_id", bid).neq("status", "cancelled"),
      supabase.from("sale_bills").select("id, bill_number, bill_date, grand_total").eq("party_id", partyId).eq("business_id", bid).neq("status", "cancelled"),
      supabase.from("payments").select("id, payment_number, payment_date, direction, payment_mode, amount").eq("party_id", partyId).eq("business_id", bid).neq("status", "cancelled"),
      supabase.from("write_offs").select("id, amount, written_off_at").eq("business_id", bid),
      supabase.from("credit_notes").select("id, cn_number, cn_date, amount").eq("party_id", partyId).eq("business_id", bid),
      supabase.from("debit_notes").select("id, dn_number, dn_date, amount").eq("party_id", partyId).eq("business_id", bid),
    ]);

    const party = partyRes.data;
    if (!party) return NextResponse.json({ error: "Party not found" }, { status: 404 });

    const isCustomer = party.type === "customer";
    const openingBalance = Number(party.opening_balance ?? 0);

    interface LedgerEntry {
      date: string;
      type: string;
      reference: string;
      debit: number;
      credit: number;
    }

    const entries: LedgerEntry[] = [];

    // Sales (Debit for customer)
    (saleBillsRes.data ?? []).forEach((b) => {
      entries.push({
        date: b.bill_date,
        type: "Sale Bill",
        reference: b.bill_number,
        debit: Number(b.grand_total),
        credit: 0,
      });
    });

    // RM Purchases (Credit for supplier)
    (purchasesRes.data ?? []).forEach((p) => {
      entries.push({
        date: p.invoice_date,
        type: "Raw Material Purchase",
        reference: p.purchase_number,
        debit: 0,
        credit: Number(p.grand_total),
      });
    });

    // FG Purchase Bills (Credit for supplier)
    (purchaseBillsRes.data ?? []).forEach((p) => {
      entries.push({
        date: p.invoice_date,
        type: "Purchase Bill",
        reference: p.bill_number,
        debit: 0,
        credit: Number(p.grand_total),
      });
    });

    // Payments
    (paymentsRes.data ?? []).forEach((p) => {
      if (p.direction === "received") {
        entries.push({
          date: p.payment_date,
          type: `Payment Received (${p.payment_mode})`,
          reference: p.payment_number,
          debit: 0,
          credit: Number(p.amount),
        });
      } else {
        entries.push({
          date: p.payment_date,
          type: `Payment Made (${p.payment_mode})`,
          reference: p.payment_number,
          debit: Number(p.amount),
          credit: 0,
        });
      }
    });

    // Credit notes
    (creditNotesRes.data ?? []).forEach((cn) => {
      entries.push({
        date: cn.cn_date,
        type: "Credit Note",
        reference: cn.cn_number,
        debit: 0,
        credit: Number(cn.amount),
      });
    });

    // Debit notes
    (debitNotesRes.data ?? []).forEach((dn) => {
      entries.push({
        date: dn.dn_date,
        type: "Debit Note",
        reference: dn.dn_number,
        debit: Number(dn.amount),
        credit: 0,
      });
    });

    // Sort by date
    entries.sort((a, b) => a.date.localeCompare(b.date));

    // Calculate running balance and filter by date range
    let runningBalance = openingBalance;
    const allRowsWithBalance = entries.map((e) => {
      if (isCustomer) {
        runningBalance += e.debit - e.credit;
      } else {
        runningBalance += e.credit - e.debit;
      }
      return { ...e, runningBalance };
    });

    const filteredRows = allRowsWithBalance.filter((r) => r.date >= from && r.date <= to);

    const totalDebit = filteredRows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = filteredRows.reduce((s, r) => s + r.credit, 0);

    // Aging breakdown for outstanding
    const today = new Date();
    const aging = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    filteredRows.forEach((r) => {
      if (r.debit > 0) {
        const days = Math.floor((today.getTime() - new Date(r.date).getTime()) / 86400000);
        if (days <= 30) aging["0-30"] += r.debit;
        else if (days <= 60) aging["31-60"] += r.debit;
        else if (days <= 90) aging["61-90"] += r.debit;
        else aging["90+"] += r.debit;
      }
    });

    return NextResponse.json({
      party,
      rows: filteredRows,
      summary: {
        openingBalance,
        totalDebit,
        totalCredit,
        closingBalance: runningBalance,
      },
      aging,
      from,
      to,
    });
  } catch (err: any) {
    console.error("[reports/party-statement]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
