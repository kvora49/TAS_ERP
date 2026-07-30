import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const partyId = searchParams.get("party_id");
  const direction = searchParams.get("direction"); // 'received' | 'paid' | 'all'
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "15", 10);

  try {
    if (partyId) {
      // 1. Fetch Outstanding Bills for specific party
      const [saleBillsRes, rmPurchasesRes, fgPurchasesRes, jobWorkRes, creditNotesRes, debitNotesRes, advancesRes] = await Promise.all([
        supabase
          .from("sale_bills")
          .select("id, bill_number, bill_date, due_date, grand_total, paid_amount, payment_status")
          .eq("party_id", partyId)
          .eq("business_id", businessId)
          .neq("status", "cancelled")
          .neq("payment_status", "paid"),

        supabase
          .from("raw_material_purchases")
          .select("id, purchase_number, invoice_date, due_date, grand_total, paid_amount, payment_status")
          .eq("supplier_id", partyId)
          .eq("business_id", businessId)
          .neq("status", "cancelled")
          .neq("payment_status", "paid"),

        supabase
          .from("purchase_bills")
          .select("id, bill_number, invoice_date, due_date, grand_total, paid_amount, payment_status")
          .eq("supplier_id", partyId)
          .eq("business_id", businessId)
          .neq("status", "cancelled")
          .neq("payment_status", "paid"),

        supabase
          .from("stage_entries")
          .select("id, entry_number, entry_date, total_job_work_amount, paid_amount, payment_status")
          .eq("worker_id", partyId)
          .eq("business_id", businessId)
          .neq("payment_status", "paid"),

        supabase
          .from("credit_notes")
          .select("id, cn_number, cn_date, amount, reason")
          .eq("party_id", partyId)
          .eq("business_id", businessId),

        supabase
          .from("debit_notes")
          .select("id, dn_number, dn_date, amount, reason")
          .eq("party_id", partyId)
          .eq("business_id", businessId),

        supabase
          .from("advance_payments")
          .select("id, advance_amount, settled_amount, remaining_amount")
          .eq("party_id", partyId)
          .eq("business_id", businessId)
          .eq("is_settled", false)
      ]);

      const bills: any[] = [];

      (saleBillsRes.data || []).forEach((b) => {
        bills.push({
          id: b.id,
          invoice_number: b.bill_number,
          invoice_date: b.bill_date,
          due_date: b.due_date || b.bill_date,
          total: Number(b.grand_total),
          outstanding: Number(b.grand_total) - Number(b.paid_amount || 0),
          bill_type: "sale_bill",
        });
      });

      (rmPurchasesRes.data || []).forEach((p) => {
        bills.push({
          id: p.id,
          invoice_number: p.purchase_number,
          invoice_date: p.invoice_date,
          due_date: p.due_date || p.invoice_date,
          total: Number(p.grand_total),
          outstanding: Number(p.grand_total) - Number(p.paid_amount || 0),
          bill_type: "raw_material_purchase",
        });
      });

      (fgPurchasesRes.data || []).forEach((p) => {
        bills.push({
          id: p.id,
          invoice_number: p.bill_number,
          invoice_date: p.invoice_date,
          due_date: p.due_date || p.invoice_date,
          total: Number(p.grand_total),
          outstanding: Number(p.grand_total) - Number(p.paid_amount || 0),
          bill_type: "purchase_bill",
        });
      });

      (jobWorkRes.data || []).forEach((jw) => {
        const total = Number(jw.total_job_work_amount || 0);
        const paid = Number(jw.paid_amount || 0);
        if (total > paid) {
          bills.push({
            id: jw.id,
            invoice_number: jw.entry_number,
            invoice_date: jw.entry_date,
            due_date: jw.entry_date,
            total,
            outstanding: total - paid,
            bill_type: "job_work_entry",
          });
        }
      });

      return NextResponse.json({
        bills,
        creditNotes: creditNotesRes.data || [],
        debitNotes: debitNotesRes.data || [],
        advances: advancesRes.data || [],
      });
    }

    // 2. Main Payments Workspace Data
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("payments")
      .select(
        `
        id,
        payment_number,
        direction,
        payment_date,
        payment_mode,
        reference_no,
        amount,
        unallocated_amount,
        is_advance,
        remarks,
        status,
        created_at,
        party:parties(id, name, company_name, type),
        bank_account:bank_accounts(id, name, bank_name)
      `,
        { count: "exact" }
      )
      .eq("business_id", businessId)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (direction && direction !== "all") {
      query = query.eq("direction", direction);
    }

    const { data: payments, count, error: paymentsError } = await query.range(from, to);

    if (paymentsError) {
      return NextResponse.json({ error: paymentsError.message }, { status: 500 });
    }

    // Also fetch parties and bank accounts for dropdowns
    const [partiesRes, banksRes, directLinksRes] = await Promise.all([
      supabase
        .from("parties")
        .select("id, name, company_name, phone, type, opening_balance")
        .eq("business_id", businessId)
        .is("deleted_at", null),

      supabase
        .from("bank_accounts")
        .select("id, name, bank_name, account_number, sub_label, type, is_default")
        .eq("business_id", businessId)
        .is("deleted_at", null),

      supabase
        .from("direct_payment_links")
        .select(`
          id,
          linked_amount,
          remarks,
          created_at,
          source:payments!source_payment_id(payment_number, party:parties(name)),
          target:payments!target_payment_id(payment_number, party:parties(name))
        `)
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(10)
    ]);

    const formattedBanks = (banksRes.data || []).map((b: any) => ({
      id: b.id,
      name: b.name || b.bank_name || "Bank Account",
      account_name: b.name || b.bank_name || "Bank Account",
      bank_name: b.bank_name || b.sub_label || (b.type ? b.type.toUpperCase() : "Bank"),
      account_number: b.account_number || "",
      is_default: !!b.is_default,
    }));

    return NextResponse.json({
      payments: payments || [],
      totalCount: count || 0,
      page,
      limit,
      parties: partiesRes.data || [],
      bankAccounts: formattedBanks,
      directLinks: directLinksRes.data || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "User session not found" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (action === "direct_contra_link") {
      const {
        source_party_id,
        source_payment_id,
        source_bill_id,
        target_party_id,
        target_bill_id,
        target_bill_type,
        linked_amount,
        remarks,
      } = body;

      if (!source_party_id || !linked_amount) {
        return NextResponse.json({ error: "Missing required parameters for direct contra link" }, { status: 400 });
      }

      const { data: linkId, error } = await supabase.rpc("create_direct_contra_link", {
        p_business_id: businessId,
        p_source_party_id: source_party_id,
        p_source_payment_id: source_payment_id || null,
        p_source_bill_id: source_bill_id || null,
        p_target_party_id: target_party_id || null,
        p_target_bill_id: target_bill_id || null,
        p_target_bill_type: target_bill_type || "purchase_bill",
        p_linked_amount: Number(linked_amount),
        p_remarks: remarks || "",
        p_created_by: userId,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, linkId });
    }

    // Default action: Record Unified Payment (Receive or Make)
    const {
      direction,
      party_id,
      payment_date,
      payment_mode,
      reference_no,
      bank_account_id,
      amount,
      remarks,
      allocations,
      applied_notes,
    } = body;

    if (!party_id || !amount || !payment_date || !direction) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data: paymentId, error } = await supabase.rpc("record_unified_payment", {
      p_business_id: businessId,
      p_direction: direction,
      p_party_id: party_id,
      p_payment_date: payment_date,
      p_payment_mode: payment_mode || "bank_transfer",
      p_reference_no: reference_no || "",
      p_bank_account_id: bank_account_id || null,
      p_amount: Number(amount),
      p_remarks: remarks || "",
      p_allocations: allocations || [],
      p_applied_notes: applied_notes || [],
      p_created_by: userId,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, paymentId });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
