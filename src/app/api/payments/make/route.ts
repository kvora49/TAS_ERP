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

  try {
    if (partyId) {
      // 1. Fetch Outstanding items from 3 different sources
      const [rmPurchasesResult, fgPurchasesResult, jobWorkResult] = await Promise.all([
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
      ]);

      const rmPurchases = rmPurchasesResult.data || [];
      const fgPurchases = fgPurchasesResult.data || [];
      const jobWork = jobWorkResult.data || [];

      // Combine and format them
      const outstandingBills: any[] = [];

      rmPurchases.forEach((p) => {
        outstandingBills.push({
          id: p.id,
          invoice_number: p.purchase_number,
          invoice_date: p.invoice_date,
          due_date: p.due_date || p.invoice_date,
          total: Number(p.grand_total),
          outstanding: Number(p.grand_total) - Number(p.paid_amount || 0),
          bill_type: "raw_material_purchase",
        });
      });

      fgPurchases.forEach((p) => {
        outstandingBills.push({
          id: p.id,
          invoice_number: p.bill_number,
          invoice_date: p.invoice_date,
          due_date: p.due_date || p.invoice_date,
          total: Number(p.grand_total),
          outstanding: Number(p.grand_total) - Number(p.paid_amount || 0),
          bill_type: "purchase_bill",
        });
      });

      jobWork.forEach((jw) => {
        const total = Number(jw.total_job_work_amount || 0);
        const paid = Number(jw.paid_amount || 0);
        if (total > paid) {
          outstandingBills.push({
            id: jw.id,
            invoice_number: jw.entry_number,
            invoice_date: jw.entry_date,
            due_date: jw.entry_date,
            total: total,
            outstanding: total - paid,
            bill_type: "job_work_entry",
          });
        }
      });

      return NextResponse.json({ bills: outstandingBills });
    } else {
      // 2. Fetch Suppliers & Workers
      const { data: parties, error: partiesError } = await supabase
        .from("parties")
        .select("id, name, company_name, phone, type, opening_balance")
        .eq("business_id", businessId)
        .is("deleted_at", null);

      if (partiesError) {
        return NextResponse.json({ error: partiesError.message }, { status: 500 });
      }

      // Filter suppliers or workers
      const payees = parties.filter(
        (p) => p.type?.includes("supplier") || p.type?.includes("worker")
      );

      // Fetch bank accounts
      const { data: banks } = await supabase
        .from("bank_accounts")
        .select("id, account_name, bank_name, account_number")
        .eq("business_id", businessId)
        .is("deleted_at", null);

      return NextResponse.json({ payees, bankAccounts: banks || [] });
    }
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
    const {
      party_id,
      amount,
      payment_date,
      payment_mode,
      reference_no,
      bank_account_id,
      remarks,
      allocations, // Array of { billId, allocatedAmount, billType }
    } = body;

    // Server-side validation
    if (!party_id || !amount || !payment_date || !payment_mode) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Call record_payment database RPC function for direction: 'paid'
    const { data: paymentId, error } = await supabase.rpc("record_payment", {
      p_business_id: businessId,
      p_direction: "paid",
      p_party_id: party_id,
      p_payment_date: payment_date,
      p_payment_mode: payment_mode,
      p_reference_no: reference_no || "",
      p_bank_account_id: bank_account_id || null,
      p_amount: Number(amount),
      p_remarks: remarks || "",
      p_allocations: JSON.stringify(allocations || []),
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
