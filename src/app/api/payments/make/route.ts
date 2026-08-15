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
      // 1. Fetch Outstanding items, purchase returns, and standalone debit notes in parallel
      const [rmPurchasesResult, fgPurchasesResult, jobWorkResult, returnsResult, debitNotesResult] = await Promise.all([
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
          .from("purchase_returns")
          .select("id, purchase_id, grand_total")
          .eq("supplier_id", partyId)
          .eq("business_id", businessId)
          .neq("status", "cancelled")
          .is("deleted_at", null),
        supabase
          .from("debit_notes")
          .select("id, dn_number, dn_date, amount, reason, related_purchase_return_id")
          .eq("party_id", partyId)
          .eq("business_id", businessId),
      ]);

      if (debitNotesResult.error) {
        console.error("debitNotes query error:", debitNotesResult.error);
      }

      const rmPurchases = rmPurchasesResult.data || [];
      const fgPurchases = fgPurchasesResult.data || [];
      const jobWork = jobWorkResult.data || [];
      const returnsMap: Record<string, number> = {};

      (returnsResult.data || []).forEach((r) => {
        if (r.purchase_id) {
          returnsMap[r.purchase_id] = (returnsMap[r.purchase_id] || 0) + Number(r.grand_total || 0);
        }
      });

      // Combine and format them
      const outstandingBills: any[] = [];

      rmPurchases.forEach((p) => {
        const returnedAmount = returnsMap[p.id] || 0;
        const grossTotal = Number(p.grand_total);
        const netPayable = grossTotal - returnedAmount;
        const outstanding = Math.max(0, netPayable - Number(p.paid_amount || 0));

        if (outstanding > 0) {
          outstandingBills.push({
            id: p.id,
            invoice_number: p.purchase_number,
            invoice_date: p.invoice_date,
            due_date: p.due_date || p.invoice_date,
            total: grossTotal,
            returned_amount: returnedAmount,
            outstanding: outstanding,
            bill_type: "raw_material_purchase",
          });
        }
      });

      fgPurchases.forEach((p) => {
        const returnedAmount = returnsMap[p.id] || 0;
        const grossTotal = Number(p.grand_total);
        const netPayable = grossTotal - returnedAmount;
        const outstanding = Math.max(0, netPayable - Number(p.paid_amount || 0));

        if (outstanding > 0) {
          outstandingBills.push({
            id: p.id,
            invoice_number: p.bill_number,
            invoice_date: p.invoice_date,
            due_date: p.due_date || p.invoice_date,
            total: grossTotal,
            returned_amount: returnedAmount,
            outstanding: outstanding,
            bill_type: "purchase_bill",
          });
        }
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
            returned_amount: 0,
            outstanding: total - paid,
            bill_type: "job_work_entry",
          });
        }
      });

      const debitNotes = (debitNotesResult.data || [])
        .filter((dn: any) => !dn.related_purchase_return_id)
        .map((dn: any) => {
          const amt = Number(dn.amount || 0);
          return {
            id: dn.id,
            dn_number: dn.dn_number,
            dn_date: dn.dn_date,
            amount: amt,
            available_amount: amt,
            reason: dn.reason,
          };
        })
        .filter((dn: any) => dn.available_amount > 0);

      return NextResponse.json({ bills: outstandingBills, debitNotes });
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
        .select("id, name, bank_name, account_number, sub_label, type, account_category, is_default, is_active")
        .eq("business_id", businessId)
        .is("deleted_at", null);

      const formattedBanks = (banks || []).map((b: any) => ({
        id: b.id,
        name: b.name || b.bank_name || "Bank Account",
        account_name: b.name || b.bank_name || "Bank Account",
        bank_name: b.bank_name || b.sub_label || (b.type ? b.type.toUpperCase() : "Bank"),
        account_number: b.account_number || "",
        account_category: b.account_category || (b.type === "cash" ? "kacha" : "pakka"),
        type: b.type,
        is_default: !!b.is_default,
      }));

      return NextResponse.json({ payees, bankAccounts: formattedBanks });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { requireAuthGuard } = await import("@/lib/auth/guards");
  const { handleApiError, validateRequestBody } = await import("@/lib/api-response");
  const { RecordPaymentSchema } = await import("@/lib/schemas/payments.schema");

  const guard = await requireAuthGuard();
  if (!guard.success) return guard.response;
  const { user, businessId } = guard.ctx;
  const supabase = createClient();

  try {
    const valResult = await validateRequestBody(request, RecordPaymentSchema);
    if (!valResult.success) {
      return valResult.response;
    }

    const {
      party_id,
      amount,
      payment_date,
      payment_mode,
      reference_no,
      bank_account_id,
      remarks,
      allocations,
    } = valResult.data;

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
      p_allocations: allocations || [],
      p_created_by: user.id,
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, paymentId });
  } catch (err: any) {
    return handleApiError(err);
  }
}

