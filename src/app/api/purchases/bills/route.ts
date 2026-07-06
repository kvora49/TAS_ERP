import { NextResponse } from "next/server";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const paymentStatus = searchParams.get("payment_status") || "";
  const startDate = searchParams.get("start_date") || "";
  const endDate = searchParams.get("end_date") || "";

  try {
    let query = supabase
      .from("purchase_bills")
      .select(`
        *,
        supplier:parties(*)
      `)
      .eq("business_id", businessId)
      .eq("status", "active");

    if (paymentStatus) {
      query = query.eq("payment_status", paymentStatus);
    }

    if (startDate) {
      query = query.gte("invoice_date", startDate);
    }
    if (endDate) {
      query = query.lte("invoice_date", endDate);
    }

    const { data: bills, error } = await query.order("invoice_date", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Client-side search filtering for names, bill_number, invoice_no
    let filtered = bills || [];
    if (search.trim()) {
      const term = search.toLowerCase();
      filtered = filtered.filter(
        (b: any) =>
          b.bill_number.toLowerCase().includes(term) ||
          (b.invoice_no && b.invoice_no.toLowerCase().includes(term)) ||
          (b.supplier?.name && b.supplier.name.toLowerCase().includes(term)) ||
          (b.supplier?.company_name && b.supplier.company_name.toLowerCase().includes(term))
      );
    }

    return NextResponse.json({ bills: filtered });
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
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;
  if (!businessId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { supplier_id, invoice_no, invoice_date, grand_total, paid_amount = 0 } = body;

    // Validate inputs
    if (!supplier_id) {
      return NextResponse.json({ error: "Supplier is required" }, { status: 400 });
    }
    if (!invoice_date) {
      return NextResponse.json({ error: "Invoice date is required" }, { status: 400 });
    }
    if (grand_total === undefined || grand_total === null || Number(grand_total) < 0) {
      return NextResponse.json({ error: "Grand total must be a positive number" }, { status: 400 });
    }

    // Auto-generate Bill Number (Format: PB-YYYY-XXXX)
    const year = new Date(invoice_date).getFullYear();
    const { count } = await supabase
      .from("purchase_bills")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", `${year}-01-01T00:00:00Z`);

    const sequence = String((count || 0) + 1).padStart(4, "0");
    const billNumber = `PB-${year}-${sequence}`;

    // Determine payment status
    const total = Number(grand_total);
    const paid = Number(paid_amount);
    let paymentStatus = "unpaid";
    if (paid >= total && total > 0) {
      paymentStatus = "paid";
    } else if (paid > 0) {
      paymentStatus = "partially_paid";
    }

    const { data: bill, error } = await supabase
      .from("purchase_bills")
      .insert({
        business_id: businessId,
        bill_number: billNumber,
        supplier_id,
        invoice_no: invoice_no || null,
        invoice_date,
        grand_total: total,
        paid_amount: paid,
        payment_status: paymentStatus,
        status: "active",
        created_by: userId
      })
      .select(`
        *,
        supplier:parties(*)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ bill });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
