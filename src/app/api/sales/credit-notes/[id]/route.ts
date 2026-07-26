import { NextResponse } from "next/server";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    const { data: creditNote, error } = await supabase
      .from("credit_notes")
      .select(`
        *,
        party:parties(id, name, company_name, phone, email, gstin, billing_address_line1, billing_city, billing_state, billing_pincode),
        return:sales_returns(id, return_number, return_date, return_reason, grand_total,
          bill:sale_bills(id, bill_number, bill_date))
      `)
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();

    if (error || !creditNote) {
      return NextResponse.json({ error: "Credit note not found" }, { status: 404 });
    }

    // Also fetch stock ledger entries for item breakdown
    const returnId = creditNote.return_id;
    let ledgerEntries: any[] = [];
    if (returnId) {
      const { data: entries } = await supabase
        .from("stock_ledger")
        .select("*, design:finished_designs(id, name, design_number)")
        .eq("business_id", businessId)
        .eq("reference_table", "sales_returns")
        .eq("reference_id", returnId)
        .eq("transaction_type", "sales_return_inflow");
      ledgerEntries = entries || [];
    }

    return NextResponse.json({ creditNote, ledgerEntries });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    const { error } = await supabase
      .from("credit_notes")
      .delete()
      .eq("id", id)
      .eq("business_id", businessId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
