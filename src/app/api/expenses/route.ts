import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-response";

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
      throw error;
    }

    return NextResponse.json({ expenses: expenses || [] });
  } catch (err: any) {
    return handleApiError(err);
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

    // Validate sufficient bank balance if paying from a bank/cash account
    if (paid_from_account_id) {
      const { data: bank } = await supabase
        .from("bank_accounts")
        .select("current_balance, name")
        .eq("id", paid_from_account_id)
        .eq("business_id", businessId)
        .maybeSingle();

      if (bank) {
        const curBal = Number(bank.current_balance || 0);
        if (curBal < amt) {
          return NextResponse.json(
            { error: `Insufficient funds in "${bank.name}". Available balance is ₹${curBal.toLocaleString("en-IN")}, but expense amount is ₹${amt.toLocaleString("en-IN")}.` },
            { status: 400 }
          );
        }
      }
    }

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

    // 4. Update bank account current_balance if paid_from_account_id provided
    if (paid_from_account_id) {
      const { data: bank } = await supabase
        .from("bank_accounts")
        .select("current_balance")
        .eq("id", paid_from_account_id)
        .eq("business_id", businessId)
        .maybeSingle();

      if (bank) {
        const newBal = Number(bank.current_balance || 0) - amt;
        await supabase
          .from("bank_accounts")
          .update({ current_balance: newBal, updated_at: new Date().toISOString() })
          .eq("id", paid_from_account_id)
          .eq("business_id", businessId);
      }
    }

    return NextResponse.json({ success: true, expense });
  } catch (err: any) {
    return handleApiError(err);
  }
}
