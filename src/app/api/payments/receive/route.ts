import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

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
      // 1. Fetch Outstanding Sale Bills, Sales Returns, and Standalone Credit Notes for this Customer in parallel
      const [billsResult, returnsResult, creditNotesResult] = await Promise.all([
        supabase
          .from("sale_bills")
          .select("id, bill_number, bill_date, due_date, grand_total, paid_amount, payment_status, remarks")
          .eq("party_id", partyId)
          .eq("business_id", businessId)
          .neq("status", "cancelled")
          .neq("payment_status", "paid"),
        supabase
          .from("sales_returns")
          .select("id, original_bill_id, grand_total")
          .eq("party_id", partyId)
          .eq("business_id", businessId)
          .neq("status", "cancelled"),
        supabase
          .from("credit_notes")
          .select("id, cn_number, cn_date, amount, reason, return_id")
          .eq("party_id", partyId)
          .eq("business_id", businessId),
      ]);

      if (billsResult.error) {
        return NextResponse.json({ error: billsResult.error.message }, { status: 500 });
      }

      if (creditNotesResult.error) {
        console.error("creditNotes query error:", creditNotesResult.error);
      }

      const rawBills = billsResult.data || [];
      const bills = rawBills.filter((b: any) => {
        const isTemp = b.bill_number?.startsWith("TEMP-") || b.remarks?.includes("[TEMPORARY]");
        return !isTemp;
      });
      const returnsMap: Record<string, number> = {};

      (returnsResult.data || []).forEach((r) => {
        if (r.original_bill_id) {
          returnsMap[r.original_bill_id] = (returnsMap[r.original_bill_id] || 0) + Number(r.grand_total || 0);
        }
      });

      // Format outstanding bills preserving gross total
      const formattedBills = bills
        .map((b) => {
          const returnedAmount = returnsMap[b.id] || 0;
          const grossTotal = Number(b.grand_total);
          const netPayable = grossTotal - returnedAmount;
          const outstanding = Math.max(0, netPayable - Number(b.paid_amount || 0));

          return {
            id: b.id,
            invoice_number: b.bill_number,
            invoice_date: b.bill_date,
            due_date: b.due_date || b.bill_date,
            total: grossTotal,
            returned_amount: returnedAmount,
            outstanding: outstanding,
            bill_type: "sale_bill",
          };
        })
        .filter((b) => b.outstanding > 0);

      const creditNotes = (creditNotesResult.data || [])
        .filter((cn: any) => !cn.return_id)
        .map((cn: any) => {
          const amt = Number(cn.amount || 0);
          return {
            id: cn.id,
            cn_number: cn.cn_number,
            cn_date: cn.cn_date,
            amount: amt,
            available_amount: amt,
            reason: cn.reason,
          };
        })
        .filter((cn: any) => cn.available_amount > 0);

      return NextResponse.json({ bills: formattedBills, creditNotes });
    } else {
      // 2. Fetch Customers list
      const { data: parties, error: partiesError } = await supabase
        .from("parties")
        .select("id, name, company_name, phone, type")
        .eq("business_id", businessId)
        .is("deleted_at", null);

      if (partiesError) {
        return NextResponse.json({ error: partiesError.message }, { status: 500 });
      }

      const customers = parties.filter((p) => p.type?.includes("customer"));

      // Also fetch bank accounts for dropdown
      const { data: banks, error: banksError } = await supabase
        .from("bank_accounts")
        .select("id, name, bank_name, account_number, sub_label, type, is_default, is_active")
        .eq("business_id", businessId)
        .is("deleted_at", null);

      const formattedBanks = (banks || []).map((b: any) => ({
        id: b.id,
        name: b.name || b.bank_name || "Bank Account",
        account_name: b.name || b.bank_name || "Bank Account",
        bank_name: b.bank_name || b.sub_label || (b.type ? b.type.toUpperCase() : "Bank"),
        account_number: b.account_number || "",
        is_default: !!b.is_default,
      }));

      return NextResponse.json({ customers, bankAccounts: formattedBanks });
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
      credit_note_allocations,
    } = body;

    const numAmount = Number(amount || 0);
    const hasAllocations = (allocations && allocations.length > 0) || (credit_note_allocations && credit_note_allocations.length > 0);

    // Server-side validation
    if (!party_id || !payment_date || (!hasAllocations && numAmount <= 0)) {
      return NextResponse.json({ error: "Missing required fields or payment amount" }, { status: 400 });
    }

    // Call record_payment database RPC function
    const { data: paymentId, error } = await supabase.rpc("record_payment", {
      p_business_id: businessId,
      p_direction: "received",
      p_party_id: party_id,
      p_payment_date: payment_date,
      p_payment_mode: payment_mode,
      p_reference_no: reference_no || "",
      p_bank_account_id: bank_account_id || null,
      p_amount: Number(amount),
      p_remarks: remarks || "",
      p_allocations: allocations || [],
      p_created_by: userId,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fire-and-forget audit log
    void logAudit(businessId, "create", "payments", String(paymentId || ""), {
      party_id,
      amount: Number(amount),
      payment_date,
      payment_mode,
      direction: "received",
    });

    return NextResponse.json({ success: true, paymentId });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
