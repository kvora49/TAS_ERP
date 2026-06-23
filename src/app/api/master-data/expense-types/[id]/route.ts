import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const expenseTypeId = params.id;

  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      description,
      icon,
      color,
      applicable_for,
      is_active,
      updated_at: lastKnownUpdatedAt,
    } = body;

    if (!name || !applicable_for || !Array.isArray(applicable_for) || applicable_for.length === 0 || !lastKnownUpdatedAt) {
      return NextResponse.json(
        { error: "Name, applicable areas list, and last known updated_at timestamp are required" },
        { status: 400 }
      );
    }

    // Optimistic locking update query
    const { data: updatedExpenseType, error } = await supabase
      .from("expense_types")
      .update({
        name,
        description: description || null,
        icon: icon || null,
        color: color || null,
        applicable_for,
        is_active: is_active !== false,
      })
      .eq("id", expenseTypeId)
      .eq("business_id", businessId)
      .eq("updated_at", lastKnownUpdatedAt) // Optimistic Lock Check!
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!updatedExpenseType || updatedExpenseType.length === 0) {
      return NextResponse.json(
        { error: "Conflict: Expense Type was modified by another transaction. Please reload." },
        { status: 409 }
      );
    }

    return NextResponse.json({ expenseType: updatedExpenseType[0] });
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
  const expenseTypeId = params.id;

  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Soft delete: update deleted_at instead of deleting row
    const { error } = await supabase
      .from("expense_types")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", expenseTypeId)
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
