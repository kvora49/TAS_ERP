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
      // 1. Fetch Outstanding Bills for this Customer
      // Include bills that are not fully paid or cancelled
      const { data: bills, error: billsError } = await supabase
        .from("sale_bills")
        .select("id, bill_number, bill_date, due_date, grand_total, paid_amount, payment_status")
        .eq("party_id", partyId)
        .eq("business_id", businessId)
        .neq("status", "cancelled")
        .neq("payment_status", "paid");

      if (billsError) {
        return NextResponse.json({ error: billsError.message }, { status: 500 });
      }

      // Format outstanding bills to the structure required by BillAllocationTable
      const formattedBills = bills.map((b) => ({
        id: b.id,
        invoice_number: b.bill_number,
        invoice_date: b.bill_date,
        due_date: b.due_date || b.bill_date,
        total: Number(b.grand_total),
        outstanding: Number(b.grand_total) - Number(b.paid_amount || 0),
        bill_type: "sale_bill",
      }));

      return NextResponse.json({ bills: formattedBills });
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
        .select("id, account_name, bank_name, account_number")
        .eq("business_id", businessId)
        .is("deleted_at", null);

      return NextResponse.json({ customers, bankAccounts: banks || [] });
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
