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
      // Fetch parties & bank accounts
      const [partiesResult, banksResult] = await Promise.all([
        supabase
          .from("parties")
          .select("id, name, company_name")
          .eq("business_id", businessId)
          .is("deleted_at", null),
        supabase
          .from("bank_accounts")
          .select("id, account_name, bank_name")
          .eq("business_id", businessId)
          .is("deleted_at", null)
      ]);

      return NextResponse.json({
        parties: partiesResult.data || [],
        bankAccounts: banksResult.data || [],
      });
    }

    // List misc income
    const { data: income, error } = await supabase
      .from("misc_income")
      .select(`
        id,
        income_number,
        income_type,
        income_date,
        amount,
        notes,
        bank_account:bank_accounts(id, account_name),
        party:parties(id, name)
      `)
      .eq("business_id", businessId)
      .order("income_date", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ income: income || [] });
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
      income_type,
      income_date,
      amount,
      received_in_account_id,
      party_id,
      notes,
    } = body;

    if (!income_type || !income_date || !amount) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // 1. Generate income number
    const dateStr = income_date.replace(/-/g, "");
    const { data: countData } = await supabase
      .from("misc_income")
      .select("id", { count: "exact" })
      .eq("business_id", businessId)
      .eq("income_date", income_date);
    
    const seq = (countData?.length || 0) + 1;
    const incomeNumber = `INC-${dateStr}-${String(seq).padStart(4, "0")}`;

    // 2. Insert record
    const { data: income, error } = await supabase
      .from("misc_income")
      .insert({
        business_id: businessId,
        income_number: incomeNumber,
        income_type,
        income_date,
        amount: Number(amount),
        received_in_account_id: received_in_account_id || null,
        party_id: party_id || null,
        notes: notes || null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, income });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
