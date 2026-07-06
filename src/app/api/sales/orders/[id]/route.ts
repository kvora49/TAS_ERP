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
    const { data: order, error } = await supabase
      .from("sale_orders")
      .select(`
        *,
        party:parties(*),
        bill:sale_bills(bill_number)
      `)
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    const body = await request.json();
    const {
      expected_delivery,
      status,
      total_amount,
      notes,
      converted_bill_id
    } = body;

    // Fetch existing order
    const { data: existingOrder, error: fetchErr } = await supabase
      .from("sale_orders")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();

    if (fetchErr || !existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Prepare update parameters
    const updates: any = {};
    if (expected_delivery !== undefined) updates.expected_delivery = expected_delivery || null;
    if (status !== undefined) updates.status = status;
    if (total_amount !== undefined) updates.total_amount = Number(total_amount);
    if (notes !== undefined) updates.notes = notes || null;
    
    // Handle conversion
    if (converted_bill_id !== undefined) {
      updates.converted_bill_id = converted_bill_id || null;
      if (converted_bill_id) {
        updates.status = "dispatched"; // automatically mark as dispatched on conversion
      }
    }

    updates.updated_at = new Date().toISOString();

    const { data: updatedOrder, error: updateErr } = await supabase
      .from("sale_orders")
      .update(updates)
      .eq("id", id)
      .eq("business_id", businessId)
      .select(`
        *,
        party:parties(*),
        bill:sale_bills(bill_number)
      `)
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ order: updatedOrder });
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
      .from("sale_orders")
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
