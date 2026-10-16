import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-response";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  try {
    if (searchParams.get("form_data") === "true") {
      const [typesResult, banksResult] = await Promise.all([
        supabase.from("expense_types").select("id, name").eq("business_id", businessId).is("deleted_at", null),
        supabase.from("bank_accounts").select("id, name, bank_name, type, account_category").eq("business_id", businessId).is("deleted_at", null),
      ]);
      if (typesResult.error) throw typesResult.error;
      if (banksResult.error) throw banksResult.error;
      const bankAccounts = (banksResult.data || []).map((bank: any) => ({
        id: bank.id,
        name: bank.name,
        account_name: bank.name || bank.bank_name || "Account",
        bank_name: bank.bank_name || "",
        type: bank.type,
        account_category: bank.account_category,
      }));
      return NextResponse.json({ expenseTypes: typesResult.data || [], bankAccounts });
    }

    const { data: expenses, error } = await supabase
      .from("expenses")
      .select(`id, expense_number, expense_date, amount, gst_percent, gst_amount,
        vendor_name, vendor_invoice_no, notes,
        expense_type:expense_types(id, name),
        bank_account:bank_accounts!paid_from_account_id(id, account_name:name)`)
      .eq("business_id", businessId)
      .order("expense_date", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ expenses: expenses || [] });
  } catch (err: any) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { expense_type_id, expense_date, amount, gst_percent, paid_from_account_id, vendor_name, vendor_invoice_no, notes } = body;
    const amt = Number(amount);
    const gstPct = Number(gst_percent || 0);
    if (!expense_type_id || !/^\d{4}-\d{2}-\d{2}$/.test(expense_date || "") || !Number.isFinite(amt) || amt <= 0 || !Number.isFinite(gstPct) || gstPct < 0 || gstPct > 100) {
      return NextResponse.json({ error: "Invalid expense amount, date, or GST percentage" }, { status: 400 });
    }

    // This pre-check gives a clear API response. The RPC repeats it inside the
    // transaction, which is the authoritative validation and write boundary.
    const { data: expenseType, error: expenseTypeError } = await supabase
      .from("expense_types").select("id").eq("id", expense_type_id)
      .eq("business_id", businessId).is("deleted_at", null).maybeSingle();
    if (expenseTypeError) throw expenseTypeError;
    if (!expenseType) return NextResponse.json({ error: "Invalid expense type" }, { status: 400 });

    const { data: expense, error } = await supabase.rpc("post_expense_atomic", {
      p_business_id: businessId,
      p_expense_type_id: expense_type_id,
      p_expense_date: expense_date,
      p_amount: amt,
      p_gst_percent: gstPct,
      p_paid_from_account_id: paid_from_account_id || null,
      p_vendor_name: vendor_name || null,
      p_vendor_invoice_no: vendor_invoice_no || null,
      p_notes: notes || null,
    });
    if (error) throw error;
    return NextResponse.json({ success: true, expense });
  } catch (err: any) {
    return handleApiError(err);
  }
}
