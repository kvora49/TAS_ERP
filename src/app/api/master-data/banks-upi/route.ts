import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: accounts, error } = await supabase
      .from("bank_accounts")
      .select("*")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ accounts });
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

  try {
    const body = await request.json();
    const {
      type,
      name,
      sub_label,
      bank_name,
      account_number,
      ifsc,
      branch,
      upi_id,
      upi_provider,
      is_default,
      opening_balance,
      is_active,
    } = body;

    if (!type || !name) {
      return NextResponse.json(
        { error: "Account Type and Name are required" },
        { status: 400 }
      );
    }

    if (type === "bank" && (!account_number || !ifsc)) {
      return NextResponse.json(
        { error: "Account Number and IFSC Code are required for bank accounts" },
        { status: 400 }
      );
    }

    if (type === "upi" && !upi_id) {
      return NextResponse.json(
        { error: "UPI ID is required for UPI accounts" },
        { status: 400 }
      );
    }

    // If setting as default, reset others to false
    if (is_default) {
      await supabase
        .from("bank_accounts")
        .update({ is_default: false })
        .eq("business_id", businessId);
    }

    const { data: account, error } = await supabase
      .from("bank_accounts")
      .insert({
        business_id: businessId,
        type,
        name,
        sub_label: sub_label || null,
        bank_name: type === "bank" ? bank_name : null,
        account_number: type === "bank" ? account_number : null,
        ifsc: type === "bank" ? ifsc : null,
        branch: type === "bank" ? branch : null,
        upi_id: type === "upi" ? upi_id : null,
        upi_provider: type === "upi" ? upi_provider : null,
        is_default: !!is_default,
        opening_balance: Number(opening_balance || 0),
        is_active: is_active !== false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ account });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
