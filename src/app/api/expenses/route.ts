import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const formData = searchParams.get("form_data");

  try {
    if (formData === "true") {
      // Fetch expense types & bank accounts
      const [typesResult, banksResult] = await Promise.all([
        supabase
          .from("expense_types")
          .select("id, name")
          .eq("business_id", businessId)
          .is("deleted_at", null),
        supabase
          .from("bank_accounts")
          .select("id, account_name, bank_name")
          .eq("business_id", businessId)
          .is("deleted_at", null)
      ]);

      return NextResponse.json({
        expenseTypes: typesResult.data || [],
        bankAccounts: banksResult.data || [],
      });
    }

    // List expenses
    const { data: expenses, error } = await supabase
      .from("expenses")
      .select(`
        id,
        expense_number,
        expense_date,
        amount,
        gst_percent,
        gst_amount,
        vendor_name,
        vendor_invoice_no,
        notes,
        expense_type:expense_types(id, name),
        bank_account:bank_accounts!paid_from_account_id(id, account_name:name)
      `)
      .eq("business_id", businessId)
      .order("expense_date", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ expenses: expenses || [] });
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
      expense_type_id,
      expense_date,
      amount,
      gst_percent,
      paid_from_account_id,
      vendor_name,
      vendor_invoice_no,
      notes,
    } = body;

    if (!expense_type_id || !expense_date || !amount) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // 1. Generate expense number
    const dateStr = expense_date.replace(/-/g, "");
    const { data: countData } = await supabase
      .from("expenses")
      .select("id", { count: "exact" })
      .eq("business_id", businessId)
      .eq("expense_date", expense_date);
    
    const seq = (countData?.length || 0) + 1;
    const expenseNumber = `EXP-${dateStr}-${String(seq).padStart(4, "0")}`;

    // 2. Compute GST
    const amt = Number(amount);
    const gstPct = Number(gst_percent || 0);
    const gstAmt = amt * (gstPct / 100);

    // 3. Insert record
    const { data: expense, error } = await supabase
      .from("expenses")
      .insert({
        business_id: businessId,
        expense_number: expenseNumber,
        expense_type_id,
        expense_date,
        amount: amt,
        gst_percent: gstPct,
        gst_amount: gstAmt,
        paid_from_account_id: paid_from_account_id || null,
        vendor_name: vendor_name || null,
        vendor_invoice_no: vendor_invoice_no || null,
        notes: notes || null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, expense });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
