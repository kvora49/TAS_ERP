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
      purchaseReturnsRes,
      stageEntriesRes,
      jobWorkPaymentsRes,
      salaryAdvancesRes,
      salaryEntriesRes,
    ] = await Promise.all([
      supabase.from("parties").select("*").eq("id", partyId).eq("business_id", bid).single(),
      supabase.from("raw_material_purchases").select("id, purchase_number, invoice_date, grand_total").eq("supplier_id", partyId).eq("business_id", bid).neq("status", "cancelled").is("deleted_at", null),
      supabase.from("purchase_bills").select("id, bill_number, invoice_date, grand_total").eq("supplier_id", partyId).eq("business_id", bid).neq("status", "cancelled"),
      supabase.from("sale_bills").select("id, bill_number, bill_date, grand_total").eq("party_id", partyId).eq("business_id", bid).neq("status", "cancelled"),
      supabase.from("payments").select("id, payment_number, payment_date, direction, payment_mode, amount").eq("party_id", partyId).eq("business_id", bid).neq("status", "cancelled"),
      supabase.from("write_offs").select("id, amount, written_off_at").eq("business_id", bid),
      supabase.from("credit_notes").select("id, cn_number, cn_date, amount, return_id").eq("party_id", partyId).eq("business_id", bid),
      supabase.from("debit_notes").select("id, dn_number, dn_date, amount, related_purchase_return_id").eq("party_id", partyId).eq("business_id", bid),
      supabase.from("purchase_returns").select("id, return_number, return_date, grand_total").eq("supplier_id", partyId).eq("business_id", bid).neq("status", "cancelled").is("deleted_at", null),
      supabase.from("stage_entries").select("id, entry_number, entry_date, qty_out, job_work_rate, total_job_work_amount").eq("worker_id", partyId).eq("business_id", bid),
      supabase.from("job_work_payments").select("id, payment_number, payment_date, paid_amount, payment_mode").eq("worker_id", partyId).eq("business_id", bid).eq("status", "success"),
      supabase.from("salary_advances").select("id, advance_date, amount, payment_mode, notes").or(`worker_id.eq.${partyId},party_id.eq.${partyId}`).eq("business_id", bid),
      supabase.from("salary_entries").select("id, salary_month, salary_year, net_salary, payment_mode, payment_date").or(`worker_id.eq.${partyId},party_id.eq.${partyId}`).eq("business_id", bid),
    ]);

    let party = partyRes.data;
    if (!party) {
      const { data: workerParty } = await supabase
        .from("workers")
        .select("id, name, opening_balance, created_at")
        .eq("id", partyId)
        .eq("business_id", bid)
        .single();
      if (workerParty) {
        party = {
          ...workerParty,
          type: "worker",
        };
      }
    }

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

    // Worker Job Work Production Stage Entries (Credit for worker)
    (stageEntriesRes.data ?? []).forEach((se: any) => {
      const qty = Number(se.qty_out || 0);
      const rate = Number(se.job_work_rate || 0);
      const total = Number(se.total_job_work_amount || qty * rate);
      entries.push({
        date: se.entry_date,
        type: `Job Work (${qty} Pcs @ ₹${rate})`,
        reference: se.entry_number || se.id.substring(0, 8),
        debit: 0,
        credit: total,
      });
    });

    // Worker Job Work Payments (Debit for worker)
    (jobWorkPaymentsRes.data ?? []).forEach((jp: any) => {
      entries.push({
        date: jp.payment_date,
        type: `Job Work Payment (${jp.payment_mode || "Paid"})`,
        reference: jp.payment_number || "-",
        debit: Number(jp.paid_amount || 0),
        credit: 0,
      });
    });

    // Worker Salary Advances (Debit for worker)
    (salaryAdvancesRes.data ?? []).forEach((sa: any) => {
      entries.push({
        date: sa.advance_date,
        type: `Salary Advance (${sa.payment_mode || "Paid"})`,
        reference: "-",
        debit: Number(sa.amount || 0),
        credit: 0,
      });
    });

    // Worker Salary Entries (Debit for worker)
    (salaryEntriesRes.data ?? []).forEach((se: any) => {
      const dateStr = se.payment_date || `${se.salary_year}-${String(se.salary_month).padStart(2, "0")}-01`;
      entries.push({
        date: dateStr,
        type: `Salary ${se.salary_month}/${se.salary_year}`,
        reference: "-",
        debit: Number(se.net_salary || 0),
        credit: 0,
      });
    });

    // Unified Payments
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

    // Purchase Returns (Debit for supplier)
    (purchaseReturnsRes.data ?? []).forEach((pr: any) => {
      entries.push({
        date: pr.return_date,
        type: "Purchase Return",
        reference: pr.return_number,
        debit: Number(pr.grand_total),
        credit: 0,
      });
    });

    // Credit notes
    (creditNotesRes.data ?? []).forEach((cn: any) => {
      const isReturn = !!cn.return_id;
      entries.push({
        date: cn.cn_date,
        type: isReturn ? "Sales Return / Credit Note" : "Credit Note",
        reference: cn.cn_number,
        debit: 0,
        credit: Number(cn.amount),
      });
    });

    // Standalone Debit notes (exclude debit notes created from purchase returns)
    (debitNotesRes.data ?? [])
      .filter((dn: any) => !dn.related_purchase_return_id)
      .forEach((dn: any) => {
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
